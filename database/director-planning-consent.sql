-- Applied migration 20261018031931: hybrid-planning cost consent, reservations and exact token accounting.
-- No model activation, paid call, provider transport or automatic project-result application.
-- Requires foundation + durable-quotes registry columns + operational-controls migration. Server derives actor/scope/profile;
-- canonical SHA256 attestations are not recomputed from PostgreSQL jsonb serialization.
begin;
create table public.director_planning_consents (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id), actor_id uuid not null references auth.users(id),
 scope jsonb not null, profile jsonb not null, model_id text not null references public.director_models(id), registry_snapshot jsonb not null,
 max_micro_usd bigint not null check(max_micro_usd between 1 and 9007199254740991), finish_reserve_micro_usd bigint not null check(finish_reserve_micro_usd>=0 and finish_reserve_micro_usd<max_micro_usd),
 max_calls integer not null check(max_calls between 1 and 10), status text not null default 'active' check(status in('active','revoked')),
 created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,reason text,
 unique(project_id,id)
);
create index director_planning_consents_project on public.director_planning_consents(project_id);
create index director_planning_consents_actor on public.director_planning_consents(actor_id);
create index director_planning_consents_model on public.director_planning_consents(model_id);
create table public.director_planning_reservations (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.director_projects(id),actor_id uuid not null references auth.users(id),consent_id uuid not null,
 project_version integer not null check(project_version>0),operation text not null check(operation in('initial_plan','revise_plan')),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),api_request_fingerprint text not null check(api_request_fingerprint~'^[a-f0-9]{64}$'),api_request jsonb not null,request jsonb not null,bound_quote jsonb not null,profile_fingerprint text not null,
 quoted_micro_usd bigint not null check(quoted_micro_usd between 1 and 9007199254740991),actual_micro_usd bigint check(actual_micro_usd between 0 and 9007199254740991),
 status text not null default 'held' check(status in('held','unknown','completed','released')),submit_claimed boolean not null default false,
 provider_response_id text unique,usage jsonb,result jsonb,result_hash text,usage_unverified boolean not null default false,overrun boolean not null default false,
 created_at timestamptz not null default now(),expires_at timestamptz not null,claimed_at timestamptz,updated_at timestamptz not null default now(),
 foreign key(project_id,consent_id) references public.director_planning_consents(project_id,id),unique(project_id,id)
);
create index director_planning_reservations_project on public.director_planning_reservations(project_id);
create index director_planning_reservations_consent on public.director_planning_reservations(consent_id);
create index director_planning_reservations_actor on public.director_planning_reservations(actor_id);
create table public.director_planning_commands (
 project_id uuid not null references public.director_projects(id),request_id uuid not null,actor_id uuid not null references auth.users(id),command text not null,
 request jsonb not null,response jsonb not null,created_at timestamptz not null default now(),primary key(project_id,request_id)
);
create index director_planning_commands_actor on public.director_planning_commands(actor_id);
create trigger append_only before update or delete on public.director_planning_commands for each row execute function public.director_reject_mutation();
do $$ declare t text;begin
 foreach t in array array['director_planning_consents','director_planning_reservations','director_planning_commands'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy deny_customer on public.%I for all to anon,authenticated using(false) with check(false)',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert on public.%I to service_role',t);
 end loop;
end $$;
grant update on public.director_planning_consents,public.director_planning_reservations to service_role;

create function public.director_planning_token_cost(p_price jsonb,p_usage jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare input_count numeric;cached_count numeric;output_count numeric;k text;n numeric;d numeric;counted numeric;total numeric:=0;
begin
 if jsonb_typeof(p_usage) is distinct from 'object' then return null;end if;
 foreach k in array array['inputTokens','cachedInputTokens','outputTokens'] loop
 if jsonb_typeof(p_usage->k) is distinct from 'number' or (p_usage->>k)::numeric not between 0 and 9007199254740991 or (p_usage->>k)::numeric<>trunc((p_usage->>k)::numeric) then return null;end if;
 end loop;
 input_count=(p_usage->>'inputTokens')::numeric;cached_count=(p_usage->>'cachedInputTokens')::numeric;output_count=(p_usage->>'outputTokens')::numeric;
 if cached_count>input_count then return null;end if;
 foreach k in array array['input','cachedInput','output'] loop
 if jsonb_typeof(p_price->k->'numeratorMicroUsd') is distinct from 'number' or jsonb_typeof(p_price->k->'denominatorTokens') is distinct from 'number' then return null;end if;
 n=(p_price->k->>'numeratorMicroUsd')::numeric;d=(p_price->k->>'denominatorTokens')::numeric;
 if n not between 0 and 9007199254740991 or d not between 1 and 9007199254740991 or n<>trunc(n) or d<>trunc(d) then return null;end if;
 counted=case k when 'input' then input_count-cached_count when 'cachedInput' then cached_count else output_count end;
 total=total+div(counted*n+d-1,d);
 end loop;
 if total>9007199254740991 then return null;end if;
 return total::bigint;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return null;
end $$;
revoke all on function public.director_planning_token_cost(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.director_planning_token_cost(jsonb,jsonb) to service_role;

create function public.director_planning_profile_ready(p_profile jsonb,p_model public.director_models)
returns boolean language plpgsql security invoker set search_path='' as $$
declare planning jsonb:=p_model.capabilities->'planning';price jsonb:=p_model.price_evidence;schema_evidence jsonb:=p_model.schema_evidence;token_evidence jsonb;expiry timestamptz;maximum bigint;k text;
begin
 if p_model.id is null or p_model.provider<>'openai' or p_model.endpoint<>'https://api.openai.com/v1/responses' or not p_model.active or not p_model.execution_tested or not p_model.quality_validated then return false;end if;
 if jsonb_typeof(p_profile) is distinct from 'object' or jsonb_typeof(planning) is distinct from 'object' or planning->'enabled' is distinct from 'true'::jsonb or jsonb_typeof(price) is distinct from 'object' or jsonb_typeof(schema_evidence) is distinct from 'object' then return false;end if;
 foreach k in array array['fingerprint','expiresAt','modelId','modelVersion','priceVersion'] loop
 if jsonb_typeof(p_profile->k) is distinct from 'string' or length(btrim(p_profile->>k)) not between 1 and 500 then return false;end if;
 end loop;
 if p_profile->>'fingerprint'!~'^[a-f0-9]{64}$' or p_profile->>'modelId' is distinct from p_model.id or p_profile->>'modelVersion' is distinct from p_model.model_version or p_profile->>'priceVersion' is distinct from p_model.price_version then return false;end if;
 if price->'verified' is distinct from 'true'::jsonb or price->>'model' is distinct from p_model.model_version or price->>'version' is distinct from p_model.price_version or price->>'currency' is distinct from 'USD' or schema_evidence->'verified' is distinct from 'true'::jsonb or schema_evidence->>'endpoint' is distinct from p_model.endpoint or schema_evidence->>'modelVersion' is distinct from p_model.model_version then return false;end if;
 token_evidence=planning->'tokenBoundEvidence';
 if token_evidence->>'model' is distinct from p_model.model_version or token_evidence->'contextWindowTokens' is distinct from planning->'contextWindowTokens' then return false;end if;
 if token_evidence->'verified' is distinct from 'true'::jsonb or token_evidence->>'type' is distinct from 'context-window-upper-bound' then return false;end if;
 foreach k in array array['sourceUrl','expiresAt'] loop
 if jsonb_typeof(price->k) is distinct from 'string' or jsonb_typeof(schema_evidence->k) is distinct from 'string' or jsonb_typeof(token_evidence->k) is distinct from 'string' then return false;end if;
 end loop;
 if coalesce(price->>'sourceUrl','') not like 'https://%' or coalesce(schema_evidence->>'sourceUrl','') not like 'https://%' or coalesce(token_evidence->>'sourceUrl','') not like 'https://%' or coalesce(token_evidence->>'tokenizerVersion','')='' or coalesce(planning->>'version','')='' or coalesce(schema_evidence->>'version','')='' or coalesce(schema_evidence->>'inputSchemaHash','')!~'^[a-f0-9]{64}$' then return false;end if;
 expiry=(p_profile->>'expiresAt')::timestamptz;
 if expiry is null or expiry<=clock_timestamp() or (price->>'expiresAt')::timestamptz is null or (schema_evidence->>'expiresAt')::timestamptz is null or (token_evidence->>'expiresAt')::timestamptz is null or expiry>(price->>'expiresAt')::timestamptz or expiry>(schema_evidence->>'expiresAt')::timestamptz or expiry>(token_evidence->>'expiresAt')::timestamptz then return false;end if;
 foreach k in array array['contextWindowTokens','maxOutputTokens','maxRequestBytes'] loop
 if jsonb_typeof(planning->k) is distinct from 'number' or (planning->>k)::numeric not between 1 and 9007199254740991 or (planning->>k)::numeric<>trunc((planning->>k)::numeric) then return false;end if;
 end loop;
 if (price->'cachedInput'->>'numeratorMicroUsd')::numeric*(price->'input'->>'denominatorTokens')::numeric>(price->'input'->>'numeratorMicroUsd')::numeric*(price->'cachedInput'->>'denominatorTokens')::numeric then return false;end if;
 maximum=public.director_planning_token_cost(price,jsonb_build_object('inputTokens',planning->'contextWindowTokens','cachedInputTokens',0,'outputTokens',planning->'maxOutputTokens'));
 if maximum is null or maximum<1 or jsonb_typeof(p_profile->'maxCallMicroUsd') is distinct from 'number' or maximum is distinct from (p_profile->>'maxCallMicroUsd')::numeric then return false;end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then return false;
end $$;
revoke all on function public.director_planning_profile_ready(jsonb,public.director_models) from public,anon,authenticated;
grant execute on function public.director_planning_profile_ready(jsonb,public.director_models) to service_role;

create function public.director_planning_consent_json(p public.director_planning_consents)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',p.id,'projectId',p.project_id,'actorId',p.actor_id,'briefScopeHash',p.scope->'briefScopeHash','approvedDecisionDigest',p.scope->'approvedDecisionDigest','approvalOrdinal',p.scope->'approvalOrdinal','profileFingerprint',p.profile->'fingerprint','modelId',p.model_id,'modelVersion',p.profile->'modelVersion','priceVersion',p.profile->'priceVersion','maxCallMicroUsd',p.profile->'maxCallMicroUsd','maxMicroUsd',p.max_micro_usd,'finishReserveMicroUsd',p.finish_reserve_micro_usd,'maxCalls',p.max_calls,'status',p.status,'createdAt',p.created_at,'expiresAt',p.expires_at,'revokedAt',p.revoked_at,'reason',p.reason,'generationAuthorized',false));
$$;
create function public.director_planning_reservation_json(p public.director_planning_reservations)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',p.id,'projectId',p.project_id,'actorId',p.actor_id,'consentId',p.consent_id,'operation',p.operation,'requestHash',p.request_hash,'profileFingerprint',p.profile_fingerprint,'quotedMicroUsd',p.quoted_micro_usd,'actualMicroUsd',p.actual_micro_usd,'status',p.status,'submitClaimed',p.submit_claimed,'createdAt',p.created_at,'expiresAt',p.expires_at,'claimedAt',p.claimed_at,'updatedAt',p.updated_at,'providerResponseId',p.provider_response_id,'usageUnverified',p.usage_unverified,'overrun',p.overrun,'resultHash',p.result_hash,'result',p.result));
$$;
revoke all on function public.director_planning_consent_json(public.director_planning_consents),public.director_planning_reservation_json(public.director_planning_reservations) from public,anon,authenticated;
grant execute on function public.director_planning_consent_json(public.director_planning_consents),public.director_planning_reservation_json(public.director_planning_reservations) to service_role;

create function public.director_planning_command(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_request_id uuid,p_command text,p_body jsonb,p_scope jsonb default null,p_profile jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare project public.director_projects;model public.director_models;consent public.director_planning_consents;reservation public.director_planning_reservations;prior public.director_planning_commands;
 req jsonb;result jsonb;ordinal bigint;expiry timestamptz;maximum bigint;finish bigint;call_count integer;counted bigint;committed numeric;quoted bigint;actual bigint;outcome text;k text;known_usage boolean;result_valid boolean;paused boolean;allowed text[];
begin
 if p_actor_id is null or p_request_id is null or p_expected_version is null or p_expected_version<1 or p_command not in('grant_planning','reserve_planning','claim_planning','settle_planning','revoke_planning') or p_command is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'planning_command_invalid';end if;
 select p.* into project from public.director_projects p where p.id=p_project_id for update;
 if octet_length(p_body::text)>2000000 then raise exception 'planning_command_invalid';end if;
 if project.id is null or project.owner_id<>p_actor_id then raise exception 'not_project_owner';end if;
 -- Scope/profile are freshly revalidated server context, not client command identity. A
 -- replay must return original evidence even after project/profile/approval changes.
 allowed=case p_command when 'grant_planning' then array['maxMicroUsd','finishReserveMicroUsd','maxCalls','expiresAt'] when 'reserve_planning' then array['consentId','operation','requestHash','quotedMicroUsd','request','boundQuote','apiRequestFingerprint','apiRequest'] when 'claim_planning' then array['reservationId'] when 'revoke_planning' then array['consentId','reason'] else array['reservationId','outcome','actualMicroUsd','resultHash','usage','result','providerResponseId'] end;
 for k in select jsonb_object_keys(p_body) loop if not(k=any(allowed)) then raise exception 'planning_command_invalid';end if;end loop;
 req=jsonb_build_object('actorId',p_actor_id,'expectedVersion',p_expected_version,'body',p_body);
 select c.* into prior from public.director_planning_commands c where c.project_id=project.id and c.request_id=p_request_id;
 if prior.request_id is not null then
 if prior.actor_id<>p_actor_id or prior.command<>p_command or prior.request<>req then raise exception 'planning_idempotency_conflict';end if;
 if p_command='claim_planning' then return jsonb_build_object('result',prior.response||jsonb_build_object('claimed',false),'replayed',true);end if;
 return jsonb_build_object('result',prior.response,'replayed',true);
 end if;
 if p_command<>'settle_planning' and (project.brief->>'version')::integer is distinct from p_expected_version then raise exception 'project_version_conflict';end if;
 if p_command in('grant_planning','reserve_planning','claim_planning') then
 select m.* into model from public.director_models m where m.id=p_profile->>'modelId' for share;
 if not public.director_planning_profile_ready(p_profile,model) then raise exception 'planning_profile_invalid';end if;
 if jsonb_typeof(p_scope) is distinct from 'object' then raise exception 'planning_scope_invalid';end if;
 foreach k in array array['briefScopeHash','approvedDecisionDigest'] loop
 if jsonb_typeof(p_scope->k) is distinct from 'string' or coalesce(p_scope->>k,'')!~'^[a-f0-9]{64}$' then raise exception 'planning_scope_invalid';end if;
 end loop;
 select coalesce(max(a.ordinal),0) into ordinal from public.director_approvals a where a.project_id=project.id;
 if jsonb_typeof(p_scope->'approvalOrdinal') is distinct from 'number' or ordinal is distinct from (p_scope->>'approvalOrdinal')::numeric then raise exception 'planning_scope_invalid';end if;
 end if;
 if p_command in('reserve_planning','claim_planning') then
 select c.generation_paused into paused from public.director_operational_controls c where c.id=1 for share;
 if not found or paused is distinct from false then raise exception 'generation_operationally_paused';end if;
 end if;
 if p_command='grant_planning' then
 if exists(select 1 from public.director_planning_reservations r where r.project_id=project.id and (r.status='unknown' or r.status='held' and r.submit_claimed)) then raise exception 'planning_submission_unresolved';end if;
 foreach k in array array['maxMicroUsd','finishReserveMicroUsd','maxCalls'] loop
 if jsonb_typeof(p_body->k) is distinct from 'number' or (p_body->>k)::numeric<>trunc((p_body->>k)::numeric) then raise exception 'planning_cap_invalid';end if;
 end loop;
 maximum=(p_body->>'maxMicroUsd')::bigint;finish=(p_body->>'finishReserveMicroUsd')::bigint;call_count=(p_body->>'maxCalls')::integer;
 if maximum not between 1 and 9007199254740991 or finish<0 or finish>=maximum or call_count not between 1 and 10 or (p_profile->>'maxCallMicroUsd')::numeric>maximum::numeric-finish then raise exception 'planning_cap_invalid';end if;
 expiry=case when p_body ? 'expiresAt' then (p_body->>'expiresAt')::timestamptz else least(clock_timestamp()+interval '1 day',(p_profile->>'expiresAt')::timestamptz) end;
 if expiry is null or expiry<=clock_timestamp() or expiry>(p_profile->>'expiresAt')::timestamptz or expiry>clock_timestamp()+interval '1 day' then raise exception 'planning_expiry_invalid';end if;
 insert into public.director_planning_consents(project_id,actor_id,scope,profile,model_id,registry_snapshot,max_micro_usd,finish_reserve_micro_usd,max_calls,expires_at)
 values(project.id,p_actor_id,p_scope,p_profile,model.id,to_jsonb(model),maximum,finish,call_count,expiry) returning * into consent;
 result=public.director_planning_consent_json(consent);
 elsif p_command in('reserve_planning','claim_planning') then
 if p_command='reserve_planning' then
 select c.* into consent from public.director_planning_consents c where c.id=(p_body->>'consentId')::uuid and c.project_id=project.id and c.actor_id=p_actor_id for update;
 else
 select r.* into reservation from public.director_planning_reservations r where r.id=(p_body->>'reservationId')::uuid and r.project_id=project.id and r.actor_id=p_actor_id for update;
 select c.* into consent from public.director_planning_consents c where c.id=reservation.consent_id and c.project_id=project.id for update;
 end if;
 if consent.id is null or consent.status<>'active' or consent.expires_at<=clock_timestamp() or consent.scope is distinct from p_scope or consent.profile is distinct from p_profile or consent.registry_snapshot is distinct from to_jsonb(model) then raise exception 'planning_consent_stale';end if;
 if p_command='reserve_planning' then
 if exists(select 1 from public.director_planning_reservations r where r.project_id=project.id and (r.status='unknown' or r.status='held' and r.submit_claimed)) then raise exception 'planning_submission_unresolved';end if;
 if p_body->>'operation' not in('initial_plan','revise_plan') or p_body->>'operation' is null or coalesce(p_body->>'requestHash','')!~'^[a-f0-9]{64}$' or jsonb_typeof(p_body->'requestHash') is distinct from 'string' or jsonb_typeof(p_body->'quotedMicroUsd') is distinct from 'number' or (p_body->>'quotedMicroUsd')::numeric<>trunc((p_body->>'quotedMicroUsd')::numeric) then raise exception 'planning_request_invalid';end if;
 quoted=(p_body->>'quotedMicroUsd')::bigint;
 if coalesce(p_body->>'apiRequestFingerprint','')!~'^[a-f0-9]{64}$' or jsonb_typeof(p_body->'apiRequestFingerprint') is distinct from 'string' or jsonb_typeof(p_body->'apiRequest') is distinct from 'object' then raise exception 'planning_request_invalid';end if;
 if quoted<1 or quoted>(p_profile->>'maxCallMicroUsd')::numeric or jsonb_typeof(p_body->'request') is distinct from 'object' or p_body->'request'->>'version' is distinct from 'director-planning-v1' or p_body->'request'->>'model' is distinct from model.model_version or p_body->'request'->>'requestHash' is distinct from p_body->>'requestHash' or p_body->'request'->'body'->>'model' is distinct from model.model_version or p_body->'request'->'body'->'background' is distinct from 'true'::jsonb or p_body->'request'->'body'->'store' is distinct from 'true'::jsonb then raise exception 'planning_request_invalid';end if;
 if jsonb_typeof(p_body->'boundQuote') is distinct from 'object' or p_body->'boundQuote'->>'requestHash' is distinct from p_body->>'requestHash' or p_body->'boundQuote'->>'pricingVersion' is distinct from model.price_version or (p_body->'boundQuote'->>'totalMicroUsd')::numeric is distinct from quoted::numeric or jsonb_typeof(p_body->'boundQuote'->'inputTokenUpperBound') is distinct from 'number' or jsonb_typeof(p_body->'boundQuote'->'outputTokenUpperBound') is distinct from 'number' then raise exception 'planning_request_invalid';end if;
 if (p_body->'boundQuote'->>'inputTokenUpperBound')::numeric<1 or (p_body->'boundQuote'->>'inputTokenUpperBound')::numeric is distinct from (model.capabilities->'planning'->>'contextWindowTokens')::numeric or (p_body->'boundQuote'->>'outputTokenUpperBound')::numeric<1 or (p_body->'boundQuote'->>'outputTokenUpperBound')::numeric>(model.capabilities->'planning'->>'maxOutputTokens')::numeric or (p_body->'request'->'body'->>'max_output_tokens')::numeric is distinct from (p_body->'boundQuote'->>'outputTokenUpperBound')::numeric then raise exception 'planning_request_invalid';end if;
 actual=public.director_planning_token_cost(model.price_evidence,jsonb_build_object('inputTokens',p_body->'boundQuote'->'inputTokenUpperBound','cachedInputTokens',0,'outputTokens',p_body->'boundQuote'->'outputTokenUpperBound'));
 if actual is null or actual<>quoted then raise exception 'planning_request_invalid';end if;
 select count(*) filter(where r.status<>'released'),coalesce(sum(case when r.status='completed' then r.actual_micro_usd when r.status='released' then 0 else greatest(r.quoted_micro_usd,coalesce(r.actual_micro_usd,0)) end),0) into counted,committed from public.director_planning_reservations r where r.consent_id=consent.id;
 if counted>=consent.max_calls or committed+quoted+consent.finish_reserve_micro_usd>consent.max_micro_usd then raise exception 'planning_cap_exceeded';end if;
 insert into public.director_planning_reservations(project_id,actor_id,consent_id,project_version,operation,request_hash,api_request_fingerprint,api_request,request,bound_quote,profile_fingerprint,quoted_micro_usd,expires_at)
 values(project.id,p_actor_id,consent.id,p_expected_version,p_body->>'operation',p_body->>'requestHash',p_body->>'apiRequestFingerprint',p_body->'apiRequest',p_body->'request',p_body->'boundQuote',p_profile->>'fingerprint',quoted,consent.expires_at) returning * into reservation;
 result=public.director_planning_reservation_json(reservation);
 else
 if reservation.id is null or reservation.status<>'held' or reservation.submit_claimed or reservation.project_version is distinct from (project.brief->>'version')::integer then raise exception 'planning_claim_unavailable';end if;
 if exists(select 1 from public.director_planning_reservations r where r.project_id=project.id and r.id<>reservation.id and (r.status='unknown' or r.status='held' and r.submit_claimed)) then raise exception 'planning_submission_unresolved';end if;
 update public.director_planning_reservations r set submit_claimed=true,claimed_at=clock_timestamp(),updated_at=clock_timestamp() where r.id=reservation.id returning * into reservation;
 result=jsonb_build_object('claimed',true,'reservation',public.director_planning_reservation_json(reservation));
 end if;
 elsif p_command='revoke_planning' then
 if jsonb_typeof(p_body->'reason') is distinct from 'string' or length(btrim(p_body->>'reason')) not between 5 and 1000 then raise exception 'planning_reason_invalid';end if;
 update public.director_planning_consents c set status='revoked',revoked_at=coalesce(c.revoked_at,clock_timestamp()),reason=coalesce(c.reason,btrim(p_body->>'reason')) where c.id=(p_body->>'consentId')::uuid and c.project_id=project.id and c.actor_id=p_actor_id returning * into consent;
 if consent.id is null then raise exception 'planning_consent_missing';end if;
 result=public.director_planning_consent_json(consent);
 else
 select r.* into reservation from public.director_planning_reservations r where r.id=(p_body->>'reservationId')::uuid and r.project_id=project.id and r.actor_id=p_actor_id for update;
 select c.* into consent from public.director_planning_consents c where c.id=reservation.consent_id;
 outcome=p_body->>'outcome';
 if reservation.id is null or reservation.status in('completed','released') or outcome is null or outcome not in('completed','unknown','released') then raise exception 'planning_settlement_unavailable';end if;
 if outcome='released' then
 if reservation.submit_claimed or reservation.status='unknown' or p_body ? 'actualMicroUsd' or p_body ? 'resultHash' or p_body ? 'usage' then raise exception 'planning_hold_must_remain';end if;
 update public.director_planning_reservations r set status='released',updated_at=clock_timestamp() where r.id=reservation.id returning * into reservation;
 elsif outcome='unknown' then
 if not reservation.submit_claimed or p_body ? 'actualMicroUsd' or p_body ? 'resultHash' or p_body ? 'usage' then raise exception 'planning_settlement_invalid';end if;
 if p_body ? 'providerResponseId' and p_body->>'providerResponseId' is distinct from reservation.provider_response_id then raise exception 'planning_response_conflict';end if;
 update public.director_planning_reservations r set status='unknown',usage_unverified=true,result=coalesce(p_body->'result',r.result),updated_at=clock_timestamp() where r.id=reservation.id returning * into reservation;
 else
 if not reservation.submit_claimed then raise exception 'planning_settlement_invalid';end if;
 if p_body ? 'providerResponseId' and p_body->>'providerResponseId' is distinct from reservation.provider_response_id then raise exception 'planning_response_conflict';end if;
 actual=public.director_planning_token_cost(consent.registry_snapshot->'price_evidence',p_body->'usage');
 known_usage=actual is not null and reservation.provider_response_id is not null;
 result_valid=jsonb_typeof(p_body->'resultHash')='string' and coalesce(p_body->>'resultHash','')~'^[a-f0-9]{64}$';
 if p_body ? 'actualMicroUsd' and (jsonb_typeof(p_body->'actualMicroUsd') is distinct from 'number' or actual is not null and actual::numeric is distinct from (p_body->>'actualMicroUsd')::numeric) then raise exception 'planning_usage_conflict';end if;
 update public.director_planning_reservations r set status=case when known_usage and coalesce(result_valid,false) and actual<=r.quoted_micro_usd then 'completed' else 'unknown' end,
 actual_micro_usd=coalesce(actual,r.actual_micro_usd),usage=coalesce(p_body->'usage',r.usage),result=p_body->'result',result_hash=p_body->>'resultHash',usage_unverified=not known_usage or not coalesce(result_valid,false),overrun=coalesce(actual>r.quoted_micro_usd,r.overrun),updated_at=clock_timestamp() where r.id=reservation.id returning * into reservation;
 end if;
 result=public.director_planning_reservation_json(reservation);
 end if;
 insert into public.director_planning_commands(project_id,request_id,actor_id,command,request,response) values(project.id,p_request_id,p_actor_id,p_command,req,result);
 return jsonb_build_object('result',result,'replayed',false);
end $$;
revoke all on function public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb) to service_role;

create function public.director_planning_record_response(p_actor_id uuid,p_project_id uuid,p_reservation_id uuid,p_response_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare project public.director_projects;r public.director_planning_reservations;
begin
 select p.* into project from public.director_projects p where p.id=p_project_id for update;
 if project.id is null or p_actor_id is null or project.owner_id<>p_actor_id then raise exception 'not_project_owner';end if;
 if p_response_id is null or p_response_id!~'^resp_[A-Za-z0-9_-]{1,200}$' then raise exception 'planning_response_invalid';end if;
 select x.* into r from public.director_planning_reservations x where x.id=p_reservation_id and x.project_id=project.id and x.actor_id=p_actor_id for update;
 if r.id is null or not r.submit_claimed or r.status='released' or r.provider_response_id is not null and r.provider_response_id<>p_response_id then raise exception 'planning_response_conflict';end if;
 if r.provider_response_id=p_response_id then return public.director_planning_reservation_json(r);end if;
 update public.director_planning_reservations x set provider_response_id=p_response_id,updated_at=clock_timestamp() where x.id=r.id returning * into r;
 return public.director_planning_reservation_json(r);
end $$;
revoke all on function public.director_planning_record_response(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.director_planning_record_response(uuid,uuid,uuid,text) to service_role;
create function public.director_planning_record_status(p_actor_id uuid,p_project_id uuid,p_reservation_id uuid,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare project public.director_projects;r public.director_planning_reservations;k text;
begin
 select p.* into project from public.director_projects p where p.id=p_project_id for update;
 if project.id is null or p_actor_id is null or project.owner_id<>p_actor_id then raise exception 'not_project_owner';end if;
 if jsonb_typeof(p_result) is distinct from 'object' or p_result->>'providerStatus' is null or p_result->>'providerStatus' not in('queued','in_progress','unknown') then raise exception 'planning_status_invalid';end if;
 for k in select jsonb_object_keys(p_result) loop if k not in('providerStatus','normalizationError') then raise exception 'planning_status_invalid';end if;end loop;
 if p_result ? 'normalizationError' and (jsonb_typeof(p_result->'normalizationError') is distinct from 'string' or length(p_result->>'normalizationError') not between 1 and 1000) then raise exception 'planning_status_invalid';end if;
 select x.* into r from public.director_planning_reservations x where x.id=p_reservation_id and x.project_id=project.id and x.actor_id=p_actor_id for update;
 if r.id is null or not r.submit_claimed or r.provider_response_id is null or r.status='released' then raise exception 'planning_status_unavailable';end if;
 if r.status='completed' or r.actual_micro_usd is not null or r.result ? 'plan' or r.result->>'providerStatus' in('completed','failed','cancelled','incomplete') then return jsonb_build_object('saved',true);end if;
 -- Observational status only: never modifies consent, claim, hold, usage or actual cost.
 update public.director_planning_reservations x set result=p_result,updated_at=clock_timestamp() where x.id=r.id;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.director_planning_record_status(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.director_planning_record_status(uuid,uuid,uuid,jsonb) to service_role;

create function public.director_planning_summary(p_actor_id uuid,p_project_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_actor_id is null or not exists(select 1 from public.director_projects p where p.id=p_project_id and p.owner_id=p_actor_id) then raise exception 'not_project_owner';end if;
 return jsonb_build_object('consents',coalesce((select jsonb_agg(public.director_planning_consent_json(c) order by c.created_at,c.id) from public.director_planning_consents c where c.project_id=p_project_id and c.actor_id=p_actor_id),'[]'::jsonb),
 'calls',coalesce((select jsonb_agg((public.director_planning_reservation_json(r)-'result')||case when jsonb_typeof(r.result->'planError')='string' then jsonb_build_object('planError',left(r.result->>'planError',1000)) when r.result->>'providerStatus' in('failed','incomplete','cancelled') then jsonb_build_object('planError','The planning request did not produce a complete proposal.') else '{}'::jsonb end order by r.created_at,r.id) from public.director_planning_reservations r where r.project_id=p_project_id and r.actor_id=p_actor_id),'[]'::jsonb));
end $$;
create function public.director_planning_read(p_actor_id uuid,p_project_id uuid,p_reservation_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.director_planning_reservations;c public.director_planning_consents;
begin
 if p_actor_id is null or not exists(select 1 from public.director_projects p where p.id=p_project_id and p.owner_id=p_actor_id) then raise exception 'not_project_owner';end if;
 select x.* into r from public.director_planning_reservations x where x.id=p_reservation_id and x.project_id=p_project_id and x.actor_id=p_actor_id;
 if r.id is null then raise exception 'planning_reservation_missing';end if;
 select x.* into c from public.director_planning_consents x where x.id=r.consent_id and x.project_id=p_project_id;
 return jsonb_build_object('reservation',public.director_planning_reservation_json(r),'request',r.request,'profileSnapshot',c.registry_snapshot,'providerResponseId',r.provider_response_id,'result',r.result);
end $$;
create function public.director_planning_replay(p_actor_id uuid,p_project_id uuid,p_request_id uuid,p_request_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.director_planning_commands;reservation public.director_planning_reservations;
begin
 if p_actor_id is null or not exists(select 1 from public.director_projects p where p.id=p_project_id and p.owner_id=p_actor_id) then raise exception 'not_project_owner';end if;
 if p_request_id is null or p_request_fingerprint is null or p_request_fingerprint!~'^[a-f0-9]{64}$' then raise exception 'planning_request_invalid';end if;
 select c.* into receipt from public.director_planning_commands c where c.project_id=p_project_id and c.request_id=p_request_id;
 if receipt.request_id is null then return null;end if;
 if receipt.actor_id<>p_actor_id or receipt.command<>'reserve_planning' or receipt.request->'body'->>'apiRequestFingerprint' is distinct from p_request_fingerprint then raise exception 'planning_idempotency_conflict';end if;
 select r.* into reservation from public.director_planning_reservations r where r.id=(receipt.response->>'id')::uuid and r.project_id=p_project_id and r.actor_id=p_actor_id;
 if reservation.id is null then raise exception 'planning_reservation_missing';end if;
 return public.director_planning_read(p_actor_id,p_project_id,reservation.id);
end $$;
revoke all on function public.director_planning_summary(uuid,uuid),public.director_planning_read(uuid,uuid,uuid),public.director_planning_replay(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.director_planning_summary(uuid,uuid),public.director_planning_read(uuid,uuid,uuid),public.director_planning_replay(uuid,uuid,uuid,text) to service_role;

comment on table public.director_planning_consents is 'Scoped generation-cost consent only. Media attempt limits and customer billing are separate. Renewed explicit grants never silently replenish an exhausted grant.';
comment on table public.director_planning_reservations is 'Claim once before transport. Persist known OpenAI response ID and poll GET only; unknown IDs remain held and must never trigger automatic resubmission. Exact micro-USD conservative token ceilings; reconcile provider billing separately.';
commit;

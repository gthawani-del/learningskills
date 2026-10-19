-- Additive, owner-only registry drafts and reviewed publication. Does not activate
-- any existing route or resume generation when the migration is installed.
-- Service code supplies the verified actor/role and calculates review readiness.
begin;
create table public.director_registry_drafts (
 model_id text not null check(model_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'),
 version integer not null check(version>0),profile jsonb not null,profile_hash text not null check(profile_hash ~ '^[a-f0-9]{64}$'),
 base_model jsonb,actor_id uuid not null,reason text not null,
 created_at timestamptz not null default now(),primary key(model_id,version)
);
create table public.director_registry_releases (
 model_id text not null references public.director_models(id),
 draft_version integer not null,actor_id uuid not null,review jsonb not null,
 before_state jsonb,after_state jsonb not null,created_at timestamptz not null default now(),
 primary key(model_id,draft_version),foreign key(model_id,draft_version) references public.director_registry_drafts(model_id,version)
);
create table public.director_registry_commands (
 request_id uuid primary key,actor_id uuid not null,actor_role text not null check(actor_role='owner'),
 command text not null check(command in('save_draft','publish_draft')),
 request jsonb not null,response jsonb not null,created_at timestamptz not null default now()
);
do $$ declare t text;begin
 foreach t in array array['director_registry_drafts','director_registry_releases','director_registry_commands'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy no_customer_access on public.%I for all to anon,authenticated using(false) with check(false)',t);
 execute format('create trigger append_only before update or delete on public.%I for each row execute function public.director_reject_mutation()',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert on public.%I to service_role',t);
 end loop;
end $$;

-- The older operational RPC shares the global control lock but has a separate
-- receipt table. A rejected insert rolls its entire mutation/revision back.
create function public.director_guard_admin_registry_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.director_registry_commands r where r.request_id=new.request_id) then raise exception 'operational_idempotency_conflict';end if;return new;
end $$;
create trigger registry_request_identity before insert on public.director_admin_commands for each row execute function public.director_guard_admin_registry_identity();

create function public.director_registry_profile_shape(p_profile jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text;
begin
 if jsonb_typeof(p_profile) is distinct from 'object' or octet_length(p_profile::text)>120000 or not(p_profile ?& array['provider','endpoint','model_version','capabilities','schema_evidence','price_evidence','price_version','routing_profiles']) then return false;end if;
 for k in select jsonb_object_keys(p_profile) loop if k not in('provider','endpoint','model_version','capabilities','schema_evidence','price_evidence','price_version','routing_profiles') then return false;end if;end loop;
 if p_profile->>'provider' is null or p_profile->>'provider' not in('openai','fal') or jsonb_typeof(p_profile->'endpoint') is distinct from 'string' or length(p_profile->>'endpoint') not between 1 and 300 or jsonb_typeof(p_profile->'model_version') is distinct from 'string' or length(btrim(p_profile->>'model_version')) not between 1 and 200 or jsonb_typeof(p_profile->'price_version') is distinct from 'string' or length(btrim(p_profile->>'price_version')) not between 1 and 200 or jsonb_typeof(p_profile->'capabilities') is distinct from 'object' or jsonb_typeof(p_profile->'schema_evidence') is distinct from 'object' or jsonb_typeof(p_profile->'price_evidence') is distinct from 'object' or jsonb_typeof(p_profile->'routing_profiles') is distinct from 'array' then return false;end if;
 if p_profile->'capabilities' ? 'reviewEvidence' then return false;end if;
 if p_profile->>'provider'='openai' then return p_profile->>'endpoint' ~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$';end if;
 return p_profile->>'endpoint' ~ '^[A-Za-z0-9][A-Za-z0-9_./-]*$' and p_profile->>'endpoint' not like '%..%' and p_profile->>'endpoint' not like '%//%';
end $$;

-- Review metadata is an owner's attestation with supporting evidence, not an
-- automatic claim that a provider was invoked or a quality benchmark was run.
create function public.director_registry_review_ready(p_model_id text,p_profile jsonb,p_review jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare k text;e jsonb;s jsonb:=p_profile->'schema_evidence';p jsonb:=p_profile->'price_evidence';c jsonb:=p_profile->'capabilities';item jsonb;binding jsonb;n integer;seen text[]:='{}';
begin
 if not public.director_registry_profile_shape(p_profile) or jsonb_typeof(p_review) is distinct from 'object' or octet_length(p_review::text)>100000 then return false;end if;
 for k in select jsonb_object_keys(p_review) loop if k not in('schemaVerified','pricingVerified','executionTested','qualityValidated','execution','quality','notes') then return false;end if;end loop;
 if not(p_review ?& array['schemaVerified','pricingVerified','executionTested','qualityValidated','execution','quality','notes']) then return false;end if;
 foreach k in array array['schemaVerified','pricingVerified','executionTested','qualityValidated'] loop if p_review->k is distinct from 'true'::jsonb then return false;end if;end loop;
 if jsonb_typeof(p_review->'notes') is distinct from 'string' or length(btrim(p_review->>'notes')) not between 5 and 2000 then return false;end if;
 if s->'verified' is distinct from 'true'::jsonb or s->>'endpoint' is distinct from p_profile->>'endpoint' or s->>'modelVersion' is distinct from p_profile->>'model_version' or coalesce(s->>'inputSchemaHash','')!~'^[a-f0-9]{64}$' or coalesce(s->>'version','')='' or coalesce(s->>'sourceUrl','')!~'^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or jsonb_typeof(s->'expiresAt') is distinct from 'string' or (s->>'expiresAt')::timestamptz<=clock_timestamp() then return false;end if;
 if p->'verified' is distinct from 'true'::jsonb or p->>'version' is distinct from p_profile->>'price_version' or p->>'currency' is distinct from 'USD' or coalesce(p->>'sourceUrl','')!~'^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or jsonb_typeof(p->'expiresAt') is distinct from 'string' or (p->>'expiresAt')::timestamptz<=clock_timestamp() then return false;end if;
 if jsonb_typeof(c->'tasks') is distinct from 'array' or jsonb_array_length(c->'tasks')<1 then return false;end if;
 foreach k in array array['execution','quality'] loop
 e=p_review->k;
 if jsonb_typeof(e) is distinct from 'object' or e->>'modelId' is distinct from p_model_id or e->>'provider' is distinct from p_profile->>'provider' or e->>'endpoint' is distinct from p_profile->>'endpoint' or e->>'modelVersion' is distinct from p_profile->>'model_version' or coalesce(e->>'version','')='' or coalesce(e->>'sourceUrl','')!~'^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or jsonb_typeof(e->'sampleCount') is distinct from 'number' or (e->>'sampleCount')::numeric<1 or (e->>'sampleCount')::numeric<>trunc((e->>'sampleCount')::numeric) or jsonb_typeof(e->'evaluatedAt') is distinct from 'string' or jsonb_typeof(e->'expiresAt') is distinct from 'string' or (e->>'evaluatedAt')::timestamptz>clock_timestamp() or (e->>'expiresAt')::timestamptz<=clock_timestamp() or (e->>'evaluatedAt')::timestamptz>=(e->>'expiresAt')::timestamptz or jsonb_typeof(e->'tasks') is distinct from 'array' or jsonb_typeof(e->'operations') is distinct from 'array' then return false;end if;
 for item in select value from jsonb_array_elements(c->'tasks') loop if not(e->'tasks' @> jsonb_build_array(item)) then return false;end if;end loop;
 if p_profile->>'provider'='openai' then
 if jsonb_typeof(c->'planning'->'operations') is distinct from 'array' or jsonb_array_length(c->'planning'->'operations')<1 then return false;end if;
 for item in select value from jsonb_array_elements(c->'planning'->'operations') loop if not(e->'operations' @> jsonb_build_array(item)) then return false;end if;end loop;
 else
 if jsonb_typeof(c->'tasks') is distinct from 'array' or jsonb_array_length(c->'tasks')<1 then return false;end if;
 for item in select value from jsonb_array_elements(c->'tasks') loop if not(e->'tasks' @> jsonb_build_array(item)) then return false;end if;end loop;
 end if;
 end loop;
 if p_profile->>'provider'='fal' and p_profile->>'endpoint' not in('minimax/h3-max/reference-to-video','elevenlabs/tts/eleven-v4','bytedance/seedream/v5/pro/edit') then return false;end if;
 if p_profile->>'provider'='openai' then
 if p_profile->>'endpoint' is distinct from 'https://api.openai.com/v1/responses' or p->>'model' is distinct from p_profile->>'model_version' or c->'planning'->'enabled' is distinct from 'true'::jsonb or c->'planning'->'background' is distinct from 'true'::jsonb or c->'planning'->'providerRetentionAcknowledged' is distinct from 'true'::jsonb or jsonb_typeof(c->'planning'->'operationBindings') is distinct from 'array' then return false;end if;
 for item in select value from jsonb_array_elements(c->'planning'->'operations') loop
 if jsonb_typeof(item) is distinct from 'string' or item #>> '{}' not in('initial_plan','revise_plan','interpret_brief','write_script','revise_script') or item #>> '{}'=any(seen) then return false;end if;seen=array_append(seen,item #>> '{}');
 select count(*),min(b.value::text)::jsonb into n,binding from jsonb_array_elements(c->'planning'->'operationBindings') b where b.value->'operation'=item;
 if n<>1 then return false;end if;
 if binding->'reviewed' is distinct from 'true'::jsonb or binding->>'modelId' is distinct from p_model_id or binding->>'provider' is distinct from p_profile->>'provider' or binding->>'endpoint' is distinct from p_profile->>'endpoint' or binding->>'modelVersion' is distinct from p_profile->>'model_version' or coalesce(binding->>'version','')='' or coalesce(binding->>'sourceUrl','')!~'^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or jsonb_typeof(binding->'evaluatedAt') is distinct from 'string' or jsonb_typeof(binding->'expiresAt') is distinct from 'string' or (binding->>'evaluatedAt')::timestamptz>clock_timestamp() or (binding->>'expiresAt')::timestamptz<=clock_timestamp() or (binding->>'evaluatedAt')::timestamptz>=(binding->>'expiresAt')::timestamptz then return false;end if;
 end loop;
 else
 if p->'configurationVerified' is distinct from 'true'::jsonb or jsonb_typeof(p->'configuration') is distinct from 'object' or jsonb_typeof(c->'taskBindings') is distinct from 'array' then return false;end if;
 for item in select value from jsonb_array_elements(c->'tasks') loop
 if jsonb_typeof(item) is distinct from 'string' or length(item #>> '{}') not between 1 and 200 or item #>> '{}'=any(seen) then return false;end if;seen=array_append(seen,item #>> '{}');
 if (item #>> '{}') is distinct from (case p_profile->>'endpoint' when 'minimax/h3-max/reference-to-video' then 'reference_video' when 'elevenlabs/tts/eleven-v4' then 'speech_synthesis' when 'bytedance/seedream/v5/pro/edit' then 'image_edit' end) then return false;end if;
 select count(*),min(b.value::text)::jsonb into n,binding from jsonb_array_elements(c->'taskBindings') b where b.value->'task'=item;
 if n<>1 then return false;end if;
 if binding->'reviewed' is distinct from 'true'::jsonb or binding->>'modelId' is distinct from p_model_id or binding->>'provider' is distinct from p_profile->>'provider' or binding->>'endpoint' is distinct from p_profile->>'endpoint' or binding->>'modelVersion' is distinct from p_profile->>'model_version' or coalesce(binding->>'version','')='' or coalesce(binding->>'sourceUrl','')!~'^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or jsonb_typeof(binding->'evaluatedAt') is distinct from 'string' or jsonb_typeof(binding->'expiresAt') is distinct from 'string' or (binding->>'evaluatedAt')::timestamptz>clock_timestamp() or (binding->>'expiresAt')::timestamptz<=clock_timestamp() or (binding->>'evaluatedAt')::timestamptz>=(binding->>'expiresAt')::timestamptz then return false;end if;
 end loop;
 end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then return false;
end $$;

create function public.director_registry_command(p_actor_id uuid,p_actor_role text,p_request_id uuid,p_expected_revision bigint,p_command text,p_reason text,p_model_id text,p_draft_version integer,p_profile jsonb,p_review jsonb,p_profile_hash text,p_ack_review boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare control public.director_operational_controls;model public.director_models;draft public.director_registry_drafts;prior public.director_registry_commands;release public.director_registry_releases;normalized jsonb;response jsonb;current_version integer;before_model jsonb;capabilities jsonb;
begin
 if p_actor_id is null or p_actor_role is distinct from 'owner' then raise exception 'registry_command_forbidden';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<1 or p_command is null or p_command not in('save_draft','publish_draft') or p_model_id is null or p_model_id!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$' or p_draft_version is null or p_draft_version<0 or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'registry_command_invalid';end if;
 if p_profile_hash is null or p_profile_hash!~'^[a-f0-9]{64}$' or p_command='save_draft' and (not public.director_registry_profile_shape(p_profile) or p_review is not null or p_ack_review is distinct from false) or p_command='publish_draft' and (p_profile is not null or p_draft_version<1 or p_ack_review is distinct from true) then raise exception 'registry_command_invalid';end if;
 normalized=jsonb_build_object('actorId',p_actor_id,'actorRole',p_actor_role,'requestId',p_request_id,'expectedRevision',p_expected_revision,'command',p_command,'reason',btrim(p_reason),'modelId',p_model_id,'expectedDraftVersion',p_draft_version,'profile',p_profile,'review',p_review,'profileHash',p_profile_hash,'acknowledgeEvidenceReview',p_ack_review);
 select x.* into control from public.director_operational_controls x where x.id=1 for update;
 if control.id is null then raise exception 'operational_control_missing';end if;
 select x.* into prior from public.director_registry_commands x where x.request_id=p_request_id;
 if prior.request_id is not null then if prior.request is distinct from normalized then raise exception 'registry_idempotency_conflict';end if;return prior.response||jsonb_build_object('replayed',true);end if;
 if exists(select 1 from public.director_admin_commands x where x.request_id=p_request_id) then raise exception 'registry_idempotency_conflict';end if;
 if control.revision is distinct from p_expected_revision then raise exception 'registry_revision_conflict';end if;
 begin select x.* into model from public.director_models x where x.id=p_model_id for update nowait;exception when lock_not_available then raise exception 'registry_model_busy';end;
 before_model=case when model.id is null then null else to_jsonb(model)-'updated_at' end;
 select coalesce(max(x.version),0) into current_version from public.director_registry_drafts x where x.model_id=p_model_id;
 if current_version is distinct from p_draft_version then raise exception 'registry_draft_conflict';end if;
 if p_command='save_draft' then
 if current_version>=1000 then raise exception 'registry_draft_limit_reached';end if;
 insert into public.director_registry_drafts(model_id,version,profile,profile_hash,base_model,actor_id,reason) values(p_model_id,current_version+1,p_profile,p_profile_hash,before_model,p_actor_id,btrim(p_reason)) returning * into draft;
 else
 select x.* into draft from public.director_registry_drafts x where x.model_id=p_model_id and x.version=p_draft_version;
 if draft.model_id is null then raise exception 'registry_draft_missing';end if;
 if draft.profile_hash is distinct from p_profile_hash then raise exception 'registry_profile_hash_conflict';end if;
 if draft.base_model is distinct from before_model then raise exception 'registry_serving_profile_changed';end if;
 if exists(select 1 from public.director_registry_releases x where x.model_id=p_model_id and x.draft_version=p_draft_version) then raise exception 'registry_draft_already_published';end if;
 if exists(select 1 from public.director_jobs j join public.director_proposals q on q.id=j.proposal_id and q.project_id=j.project_id where q.model_id=p_model_id and (j.status in('reserved','submitted','running','unknown') or j.charge_state in('held','unknown'))) or exists(select 1 from public.director_planning_reservations r join public.director_planning_consents c on c.id=r.consent_id and c.project_id=r.project_id where c.model_id=p_model_id and r.status in('held','unknown')) then raise exception 'registry_model_busy';end if;
 if not public.director_registry_review_ready(p_model_id,draft.profile,p_review) then raise exception 'registry_review_required';end if;
 capabilities=jsonb_set(draft.profile->'capabilities','{reviewEvidence}',jsonb_build_object('execution',p_review->'execution','quality',p_review->'quality'),true);
 insert into public.director_models(id,provider,endpoint,model_version,capabilities,schema_evidence,price_evidence,price_version,routing_profiles,active,execution_tested,quality_validated)
 values(p_model_id,draft.profile->>'provider',draft.profile->>'endpoint',draft.profile->>'model_version',capabilities,draft.profile->'schema_evidence',draft.profile->'price_evidence',draft.profile->>'price_version',draft.profile->'routing_profiles',true,true,true)
 on conflict(id) do update set provider=excluded.provider,endpoint=excluded.endpoint,model_version=excluded.model_version,capabilities=excluded.capabilities,schema_evidence=excluded.schema_evidence,price_evidence=excluded.price_evidence,price_version=excluded.price_version,routing_profiles=excluded.routing_profiles,active=true,execution_tested=true,quality_validated=true,updated_at=now() returning * into model;
 insert into public.director_registry_releases(model_id,draft_version,actor_id,review,before_state,after_state) values(p_model_id,p_draft_version,p_actor_id,p_review,before_model,to_jsonb(model)) returning * into release;
 end if;
 update public.director_operational_controls set revision=revision+1,reason=btrim(p_reason),updated_at=now() where id=1 returning * into control;
 response=jsonb_build_object('control',to_jsonb(control),'draft',jsonb_build_object('modelId',draft.model_id,'version',draft.version,'profile',draft.profile,'profileHash',draft.profile_hash,'baseModel',draft.base_model,'actorId',draft.actor_id,'reason',draft.reason,'createdAt',draft.created_at),'release',case when release.model_id is null then null else jsonb_build_object('modelId',release.model_id,'draftVersion',release.draft_version,'actorId',release.actor_id,'review',release.review,'before',release.before_state,'after',release.after_state,'createdAt',release.created_at) end,'replayed',false);
 insert into public.director_registry_commands(request_id,actor_id,actor_role,command,request,response) values(p_request_id,p_actor_id,p_actor_role,p_command,normalized,response);
 return response;
end $$;

-- Optional operation-specific grants bind a selected model to the exact operation.
-- Previously granted, operation-less allowances retain their original semantics.
alter table public.director_planning_consents add column operation text check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script'));
create function public.director_guard_planning_consent_operation() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.director_planning_consents;
begin
 if TG_OP='UPDATE' then if not(not old.submit_claimed and new.submit_claimed) then return new;end if;end if;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=new.project_id;
 if c.id is null or c.operation is not null and c.operation is distinct from new.operation then raise exception 'planning_operation_scope_changed';end if;return new;
end $$;
create trigger current_planning_operation_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_planning_consent_operation();
create trigger current_planning_operation_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_planning_consent_operation();
do $$
declare definition text;allowed text:='array[''maxMicroUsd'',''finishReserveMicroUsd'',''maxCalls'',''expiresAt'']';anchor text:='insert into public.director_planning_consents(project_id,actor_id,scope,profile,model_id,registry_snapshot,max_micro_usd,finish_reserve_micro_usd,max_calls,expires_at)';values_anchor text:='values(project.id,p_actor_id,p_scope,p_profile,model.id,to_jsonb(model),maximum,finish,call_count,expiry)';json_anchor text:='''generationAuthorized'',false';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,allowed,'')))/length(allowed)<>1 or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 or (length(definition)-length(replace(definition,values_anchor,'')))/length(values_anchor)<>1 then raise exception 'registry_planning_operation_baseline_mismatch';end if;
 definition=replace(definition,allowed,'array[''maxMicroUsd'',''finishReserveMicroUsd'',''maxCalls'',''expiresAt'',''operation'',''expectedModelId'',''expectedProfileFingerprint'']');
 definition=replace(definition,anchor,'if p_body ? ''operation'' and (jsonb_typeof(p_body->''operation'') is distinct from ''string'' or p_body->>''operation'' not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'')) then raise exception ''planning_operation_invalid'';end if; if (p_body ? ''expectedModelId'') is distinct from (p_body ? ''expectedProfileFingerprint'') or (p_body ? ''expectedModelId'' and (jsonb_typeof(p_body->''expectedModelId'') is distinct from ''string'' or jsonb_typeof(p_body->''expectedProfileFingerprint'') is distinct from ''string'' or p_body->>''expectedModelId'' is distinct from model.id or p_body->>''expectedProfileFingerprint'' is distinct from p_profile->>''fingerprint'')) then raise exception ''planning_model_selection_changed'';end if; if jsonb_typeof(model.capabilities->''planning''->''operations'')=''array'' and not(model.capabilities->''planning''->''operations'' @> jsonb_build_array(coalesce(p_body->>''operation'',''interpret_brief''))) then raise exception ''planning_operation_invalid'';end if; '||replace(anchor,'max_calls,expires_at)','max_calls,expires_at,operation)'));
 definition=replace(definition,values_anchor,'values(project.id,p_actor_id,p_scope,p_profile,model.id,to_jsonb(model),maximum,finish,call_count,expiry,coalesce(p_body->>''operation'',''interpret_brief''))');execute definition;
 definition=pg_get_functiondef('public.director_planning_consent_json(public.director_planning_consents)'::regprocedure);
 if (length(definition)-length(replace(definition,json_anchor,'')))/length(json_anchor)<>1 then raise exception 'registry_planning_json_baseline_mismatch';end if;
 execute replace(definition,json_anchor,'''operation'',p.operation,'||json_anchor);
end $$;
revoke all on function public.director_guard_admin_registry_identity(),public.director_registry_profile_shape(jsonb),public.director_registry_review_ready(text,jsonb,jsonb),public.director_registry_command(uuid,text,uuid,bigint,text,text,text,integer,jsonb,jsonb,text,boolean),public.director_guard_planning_consent_operation() from public,anon,authenticated;
grant execute on function public.director_guard_admin_registry_identity(),public.director_registry_profile_shape(jsonb),public.director_registry_review_ready(text,jsonb,jsonb),public.director_registry_command(uuid,text,uuid,bigint,text,text,text,integer,jsonb,jsonb,text,boolean),public.director_guard_planning_consent_operation() to service_role;
comment on table public.director_registry_drafts is 'Immutable editable-profile drafts; saving never changes the serving route. No secrets may be stored in profiles.';
comment on table public.director_registry_releases is 'Immutable owner-reviewed publications with exact before/after profiles and supporting execution/quality attestations. Generation pause and per-user spending consent remain separate.';
commit;

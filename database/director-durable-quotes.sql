-- Applied in migration 20261018025605: durable server quotes / owner spending controls. No generation activation.
-- Requires foundation + currentness + recursive-approval guard helpers. Apply only after review.
-- Payload/quote SHA256 values originate in the trusted server's canonical JSON implementation.
-- SQL binds exact JSONB payload and registry snapshots; it does not claim jsonb::text has
-- the same byte serialization as JavaScript canonicalJson. Dispatch rechecks canonical hash.
begin;
alter table public.director_models add column if not exists model_version text;
alter table public.director_models add column if not exists routing_profiles jsonb not null default '[]';
create table public.director_quote_records (
 quote_id text primary key check(quote_id ~ '^[a-f0-9]{64}$'),
 project_id uuid not null references public.director_projects(id),
 proposal_id uuid not null unique,
 actor_id uuid not null references auth.users(id),
 project_version integer not null check(project_version>0),
 quote jsonb not null,
 registry_snapshot jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(project_id,proposal_id) references public.director_proposals(project_id,id)
);
create index director_quote_records_project on public.director_quote_records(project_id);
create index director_quote_records_actor on public.director_quote_records(actor_id);
create table public.director_spending_commands (
 project_id uuid not null references public.director_projects(id), request_id uuid not null,
 actor_id uuid not null references auth.users(id), command text not null,
 request jsonb not null, response jsonb not null, request_fingerprint text check(request_fingerprint ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
 primary key(project_id,request_id)
);
create index director_spending_commands_actor on public.director_spending_commands(actor_id);
create trigger append_only before update or delete on public.director_quote_records for each row execute function public.director_reject_mutation();
create trigger append_only before update or delete on public.director_spending_commands for each row execute function public.director_reject_mutation();
alter table public.director_quote_records enable row level security;
alter table public.director_spending_commands enable row level security;
create policy no_customer_access on public.director_quote_records for all to anon,authenticated using(false) with check(false);
create policy no_customer_access on public.director_spending_commands for all to anon,authenticated using(false) with check(false);
revoke all on public.director_quote_records,public.director_spending_commands from public,anon,authenticated,service_role;
grant select,insert on public.director_quote_records,public.director_spending_commands to service_role;

create function public.director_composite_quote_valid(p_quote jsonb,p_payload jsonb,p_price jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare tariff jsonb:=p_price->'tariff'; c jsonb; reported jsonb; expected jsonb; seen text[]:='{}'; idx integer:=0; raw numeric; denominator numeric; billed numeric; included numeric; minimum numeric; numerator_rate numeric; denominator_rate numeric; cost numeric; total numeric:=0; duration_text text; fraction text; chars text; n numeric; width numeric; height numeric; key text;
begin
 if p_quote->>'unit' is distinct from 'composite' or p_quote->'priceEvidence' is distinct from p_price or jsonb_typeof(tariff) is distinct from 'object' or tariff->'schemaVersion' is distinct from '1'::jsonb or tariff->>'version' is distinct from p_price->>'version' or jsonb_typeof(tariff->'components') is distinct from 'array' or jsonb_array_length(tariff->'components') not between 1 and 20 or jsonb_typeof(p_quote->'components') is distinct from 'array' or jsonb_array_length(p_quote->'components')<>jsonb_array_length(tariff->'components') then return false; end if;
 for c in select value from jsonb_array_elements(tariff->'components') loop
 if coalesce(c->>'id','')!~'^[A-Za-z][A-Za-z0-9_-]{0,63}$' or c->>'id'=any(seen) or c->>'rounding' is distinct from 'ceil' or jsonb_typeof(c->'rate') is distinct from 'object' then return false; end if;
 seen=array_append(seen,c->>'id');
 if jsonb_typeof(c->'rate'->'numeratorMicroUsd') is distinct from 'number' or jsonb_typeof(c->'rate'->'denominatorUnits') is distinct from 'number' or (c ? 'minimumUnits' and jsonb_typeof(c->'minimumUnits') is distinct from 'number') or (c ? 'includedUnits' and jsonb_typeof(c->'includedUnits') is distinct from 'number') then return false; end if;
 numerator_rate=(c->'rate'->>'numeratorMicroUsd')::numeric;denominator_rate=(c->'rate'->>'denominatorUnits')::numeric;included=coalesce((c->>'includedUnits')::numeric,0);minimum=coalesce((c->>'minimumUnits')::numeric,0);
 if numerator_rate is null or denominator_rate is null or numerator_rate not between 1 and 9007199254740991 or denominator_rate not between 1 and 9007199254740991 or numerator_rate<>trunc(numerator_rate) or denominator_rate<>trunc(denominator_rate) or included not between 0 and 9007199254740991 or minimum not between 0 and 9007199254740991 or included<>trunc(included) or minimum<>trunc(minimum) then return false; end if;
 denominator=1;
 if c->>'unit'='request' then raw=1;
 elsif c->>'unit'='second' then
 if jsonb_typeof(p_payload->'duration') is distinct from 'number' then return false; end if;
 duration_text=p_payload->>'duration';if duration_text!~'^[0-9]+(\.[0-9]{1,9})?$' or duration_text::numeric<=0 then return false; end if;
 fraction=split_part(duration_text,'.',2);denominator=power(10::numeric,length(fraction));raw=duration_text::numeric*denominator;
 elsif c->>'unit' in ('character','thousand_character') then
 if jsonb_typeof(p_payload->'text') is distinct from 'string' then return false; end if;
 chars=p_payload->>'text';
 if c->>'characterCounting'='unicode_codepoint' then raw=length(chars);
 elsif c->>'characterCounting'='utf8_byte' then raw=octet_length(convert_to(chars,'UTF8'));
 elsif c->>'characterCounting'='utf16_code_unit' then select coalesce(sum(case when ascii(substr(chars,i,1))>65535 then 2 else 1 end),0) into raw from generate_series(1,length(chars)) i;
 else return false; end if;
 if c->>'unit'='thousand_character' then denominator=1000; end if;
 elsif c->>'unit' in ('image','megapixel') then
 if jsonb_typeof(p_payload->'num_images') is distinct from 'number' then return false; end if;
 n=(p_payload->>'num_images')::numeric;if n not between 1 and 9007199254740991 or n<>trunc(n) then return false; end if;
 raw=n;
 if c->>'unit'='megapixel' then
 if jsonb_typeof(p_payload->'image_size'->'width') is distinct from 'number' or jsonb_typeof(p_payload->'image_size'->'height') is distinct from 'number' then return false; end if;
 width=(p_payload->'image_size'->>'width')::numeric;height=(p_payload->'image_size'->>'height')::numeric;
 if width not between 1 and 9007199254740991 or height not between 1 and 9007199254740991 or width<>trunc(width) or height<>trunc(height) then return false; end if;
 raw=width*height*n;denominator=1000000;
 end if;
 else return false; -- Token/unknown units require a separate reviewed server usage ledger.
 end if;
 billed=greatest(raw-included*denominator,minimum*denominator,0);
 cost=div(billed*numerator_rate+denominator*denominator_rate-1,denominator*denominator_rate);total=total+cost;
 if cost>9007199254740991 or total>9007199254740991 then return false; end if;
 expected=jsonb_build_object('id',c->>'id','unit',c->>'unit','quantityNumerator',trunc(raw)::text,'quantityDenominator',trunc(denominator)::text,'billableNumerator',trunc(billed)::text,'billableDenominator',trunc(denominator)::text,'includedUnits',included,'minimumUnits',minimum,'rounding','ceil','costMicroUsd',cost);
 reported=p_quote->'components'->idx;idx=idx+1;
 if reported is distinct from expected then return false; end if;
 end loop;
 -- Zero-cost quotes are held rather than inventing a minimum against the existing >0 ledger.
 return total>0 and total is not distinct from (p_quote->>'totalMicroUsd')::numeric;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
revoke all on function public.director_composite_quote_valid(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.director_composite_quote_valid(jsonb,jsonb,jsonb) to service_role;

create function public.director_quote_contract_valid(p_quote jsonb,p_payload jsonb,p_model public.director_models)
returns boolean language plpgsql security invoker set search_path='' as $$
declare k text; v jsonb; units numeric; minimum numeric; total numeric; expiry timestamptz; created timestamptz; schema_expiry timestamptz; price_expiry timestamptz; profile jsonb; intent_evidence jsonb; intent_ready boolean:=false;
begin
 if jsonb_typeof(p_quote->'projectVersion') is distinct from 'number' or (p_quote->>'projectVersion')::numeric<1 or (p_quote->>'projectVersion')::numeric<>trunc((p_quote->>'projectVersion')::numeric) then return false; end if;
 if jsonb_typeof(p_quote) is distinct from 'object' or jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_model.schema_evidence) is distinct from 'object' or jsonb_typeof(p_model.price_evidence) is distinct from 'object' then return false; end if;
 foreach k in array array['id','projectId','task','artifactId','artifactContentHash','payloadHash','modelId','endpoint','modelVersion','priceVersion'] loop
 if jsonb_typeof(p_quote->k) is distinct from 'string' or length(btrim(p_quote->>k)) not between 1 and 500 then return false; end if;
 end loop;
 if jsonb_typeof(p_quote->'artifactVersion') is distinct from 'number' or (p_quote->>'artifactVersion')::numeric not between 1 and 2147483647 or (p_quote->>'artifactVersion')::numeric<>trunc((p_quote->>'artifactVersion')::numeric) or jsonb_typeof(p_quote->'requirements') is distinct from 'object' then return false; end if;
 if length(btrim(p_model.price_version)) not between 1 and 500 then return false; end if;
 if not p_model.active or not p_model.execution_tested or not p_model.quality_validated or p_model.model_version is null or length(p_model.model_version) not between 1 and 200 then return false; end if;
 if p_quote->>'modelId' is distinct from p_model.id or p_quote->>'endpoint' is distinct from p_model.endpoint or p_quote->>'modelVersion' is distinct from p_model.model_version or p_quote->>'priceVersion' is distinct from p_model.price_version then return false; end if;
 if p_quote->'estimateOnly' is distinct from 'true'::jsonb or p_quote->'generationAuthorized' is distinct from 'false'::jsonb or p_quote->>'currency' is distinct from 'USD' or coalesce(p_quote->>'id','') !~ '^[a-f0-9]{64}$' or coalesce(p_quote->>'payloadHash','') !~ '^[a-f0-9]{64}$' or coalesce(p_quote->>'artifactContentHash','') !~ '^[a-f0-9]{64}$' then return false; end if;
 if jsonb_typeof(p_quote->'schemaEvidence') is distinct from 'object' or jsonb_typeof(p_quote->'priceEvidence') is distinct from 'object' then return false; end if;
 if not(p_quote->'schemaEvidence' ?& array['verified','version','sourceUrl','endpoint','modelVersion','inputSchemaHash','expiresAt']) or (not(p_model.price_evidence ? 'tariff') and not(p_quote->'priceEvidence' ?& array['verified','configurationVerified','configuration','version','currency','unit','unitMicroUsd','minimumUnits','rounding','expiresAt','sourceUrl'])) then return false; end if;
 if not(p_quote->'priceEvidence' ?& array['verified','configurationVerified','configuration','version','currency','expiresAt','sourceUrl']) then return false; end if;
 if (case jsonb_typeof(p_quote->'schemaEvidence'->'version') when 'string' then length(btrim(p_quote->'schemaEvidence'->>'version')) between 1 and 500 when 'number' then (p_quote->'schemaEvidence'->>'version') ~ '^[1-9][0-9]*$' else false end) is not true then return false; end if;
 if p_quote->'schemaEvidence'->'version' is distinct from p_quote->'schemaVersion' or jsonb_typeof(p_quote->'schemaEvidence'->'inputSchemaHash') is distinct from 'string' or jsonb_typeof(p_quote->'priceEvidence'->'version') is distinct from 'string' or length(btrim(p_quote->'priceEvidence'->>'version')) not between 1 and 500 then return false; end if;
 if jsonb_typeof(p_quote->'schemaEvidence'->'sourceUrl') is distinct from 'string' or jsonb_typeof(p_quote->'priceEvidence'->'sourceUrl') is distinct from 'string' or jsonb_typeof(p_quote->'createdAt') is distinct from 'string' or jsonb_typeof(p_quote->'expiresAt') is distinct from 'string' or jsonb_typeof(p_quote->'totalMicroUsd') is distinct from 'number' then return false; end if;
 foreach k in array array['sourceUrl','endpoint','modelVersion','inputSchemaHash','expiresAt'] loop
 if jsonb_typeof(p_quote->'schemaEvidence'->k) is distinct from 'string' or length(btrim(p_quote->'schemaEvidence'->>k)) not between 1 and 500 then return false; end if;
 end loop;
 for k,v in select * from jsonb_each(p_quote->'schemaEvidence') loop
 if p_model.schema_evidence->k is distinct from v then return false; end if;
 end loop;
 if p_quote->'schemaEvidence'->'verified' is distinct from 'true'::jsonb or p_quote->'schemaEvidence'->>'endpoint' is distinct from p_model.endpoint or p_quote->'schemaEvidence'->>'modelVersion' is distinct from p_model.model_version or p_quote->'schemaVersion' is distinct from p_model.schema_evidence->'version' or coalesce(p_quote->'schemaEvidence'->>'inputSchemaHash','') !~ '^[a-f0-9]{64}$' then return false; end if;
 for k,v in select * from jsonb_each(p_quote->'priceEvidence') loop
 if k='minimumUnits' then
 if v is distinct from coalesce(p_model.price_evidence->k,'1'::jsonb) then return false; end if;
 elsif p_model.price_evidence->k is distinct from v then return false;
 end if;
 end loop;
 if p_quote->'priceEvidence'->'verified' is distinct from 'true'::jsonb or p_quote->'priceEvidence'->'configurationVerified' is distinct from 'true'::jsonb or (not(p_model.price_evidence ? 'tariff') and p_quote->'priceEvidence'->>'rounding' is distinct from 'ceil') or p_quote->'priceEvidence'->>'currency' is distinct from 'USD' or p_quote->'priceEvidence'->>'version' is distinct from p_model.price_version then return false; end if;
 if jsonb_typeof(p_model.price_evidence->'configuration') is distinct from 'object' or p_quote->'priceConfiguration' is distinct from p_model.price_evidence->'configuration' or not(p_payload @> (p_model.price_evidence->'configuration')) then return false; end if;
 if coalesce(p_quote->'schemaEvidence'->>'sourceUrl','') not like 'https://%' or coalesce(p_quote->'priceEvidence'->>'sourceUrl','') not like 'https://%' then return false; end if;
 if jsonb_typeof(p_quote->'schemaEvidence'->'expiresAt') is distinct from 'string' or jsonb_typeof(p_quote->'priceEvidence'->'expiresAt') is distinct from 'string' then return false; end if;
 expiry=(p_quote->>'expiresAt')::timestamptz;created=(p_quote->>'createdAt')::timestamptz;schema_expiry=(p_model.schema_evidence->>'expiresAt')::timestamptz;price_expiry=(p_model.price_evidence->>'expiresAt')::timestamptz;
 if schema_expiry is null or price_expiry is null or schema_expiry<=clock_timestamp() or price_expiry<=clock_timestamp() then return false; end if;
 if expiry is null or created is null or expiry<=created or expiry<=clock_timestamp() or expiry>created+interval '1 hour' or created>clock_timestamp()+interval '30 seconds' or expiry>(p_quote->'schemaEvidence'->>'expiresAt')::timestamptz or expiry>(p_quote->'priceEvidence'->>'expiresAt')::timestamptz or (p_model.schema_evidence->>'expiresAt')::timestamptz<=clock_timestamp() or (p_model.price_evidence->>'expiresAt')::timestamptz<=clock_timestamp() then return false; end if;
 if p_quote ? 'intent' and jsonb_typeof(p_quote->'intent') is distinct from 'object' then return false; end if;
 if p_quote ? 'intent' and p_quote->'intent' not in ('{}'::jsonb,'{"qualityGoals":[]}'::jsonb) then
 intent_evidence=p_quote->'intentEvidence';
 if jsonb_typeof(intent_evidence) is distinct from 'object' or jsonb_typeof(intent_evidence->'evidenceVersion') is distinct from 'string' or length(btrim(intent_evidence->>'evidenceVersion')) not between 1 and 500 or jsonb_typeof(intent_evidence->'evidenceHash') is distinct from 'string' or coalesce(intent_evidence->>'evidenceHash','')!~'^[a-f0-9]{64}$' or jsonb_typeof(intent_evidence->'expiresAt') is distinct from 'string' or jsonb_typeof(intent_evidence->'evaluatedAt') is distinct from 'string' then return false; end if;
 if (intent_evidence->>'expiresAt')::timestamptz is null or (intent_evidence->>'expiresAt')::timestamptz<=clock_timestamp() or expiry>(intent_evidence->>'expiresAt')::timestamptz or (intent_evidence->>'evaluatedAt')::timestamptz is null or (intent_evidence->>'evaluatedAt')::timestamptz>clock_timestamp() or (intent_evidence->>'evaluatedAt')::timestamptz>=(intent_evidence->>'expiresAt')::timestamptz then return false; end if;
 for profile in select value from jsonb_array_elements(p_model.routing_profiles) loop
 if profile->'verified'='true'::jsonb and profile->>'task'=p_quote->>'task' and profile->>'modelId'=p_model.id and profile->>'endpoint'=p_model.endpoint and profile->>'modelVersion'=p_model.model_version and profile->>'evidenceVersion'=intent_evidence->>'evidenceVersion' and profile->>'expiresAt'=intent_evidence->>'expiresAt' and profile->>'evaluatedAt'=intent_evidence->>'evaluatedAt' and coalesce(profile->>'sourceUrl','') like 'https://%' and jsonb_typeof(profile->'sampleCount')='number' and (profile->>'sampleCount')::numeric>=1 and (profile->>'sampleCount')::numeric=trunc((profile->>'sampleCount')::numeric) then intent_ready=true; end if;
 end loop;
 if not intent_ready then return false; end if;
 -- The evidenceHash is a trusted-server canonical attestation. SQL checks its format,
 -- exact profile metadata/model binding, expiry and the immutable whole registry snapshot.
 end if;
 if p_model.price_evidence ? 'tariff' then return public.director_composite_quote_valid(p_quote,p_payload,p_model.price_evidence); end if;
 if jsonb_typeof(p_model.price_evidence->'unitMicroUsd') is distinct from 'number' or jsonb_typeof(p_quote->'unitMicroUsd') is distinct from 'number' or jsonb_typeof(p_quote->'units') is distinct from 'number' then return false; end if;
 if p_model.price_evidence ? 'minimumUnits' and jsonb_typeof(p_model.price_evidence->'minimumUnits') is distinct from 'number' then return false; end if;
 if p_quote->>'unit' is distinct from p_model.price_evidence->>'unit' or p_quote->'unitMicroUsd' is distinct from p_model.price_evidence->'unitMicroUsd' then return false; end if;
 if p_model.price_evidence->>'unit'='second' then units=ceil((p_payload->>'duration')::numeric);
 elsif p_model.price_evidence->>'unit'='image' then units=(p_payload->>'num_images')::numeric;
 elsif p_model.price_evidence->>'unit'='character' then units=length(p_payload->>'text');
 elsif p_model.price_evidence->>'unit'='request' then units=1;
 else return false; end if;
 if (p_model.price_evidence->>'unitMicroUsd')::numeric>9007199254740991 or (p_model.price_evidence->>'unitMicroUsd')::numeric<1 or (p_model.price_evidence->>'unitMicroUsd')::numeric<>trunc((p_model.price_evidence->>'unitMicroUsd')::numeric) then return false; end if;
 minimum=coalesce((p_model.price_evidence->>'minimumUnits')::numeric,1);
 if units is null or units<1 or units<>trunc(units) or units>1000000 or minimum<1 or minimum<>trunc(minimum) or minimum>1000000 then return false; end if;
 units=greatest(units,minimum);total=units*(p_model.price_evidence->>'unitMicroUsd')::numeric;
 if total is null or total<1 or total<>trunc(total) or total>9007199254740991 or total is distinct from (p_quote->>'totalMicroUsd')::numeric or units is distinct from (p_quote->>'units')::numeric then return false; end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then return false;
end $$;
revoke all on function public.director_quote_contract_valid(jsonb,jsonb,public.director_models) from public,anon,authenticated;
grant execute on function public.director_quote_contract_valid(jsonb,jsonb,public.director_models) to service_role;

create function public.director_spending_replay(p_actor_id uuid,p_project_id uuid,p_request_id uuid,p_request_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; receipt public.director_spending_commands;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id<>p_actor_id then raise exception 'not_project_owner'; end if;
 if p_request_id is null or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'spending_request_invalid'; end if;
 select x.* into receipt from public.director_spending_commands x where x.project_id=p.id and x.request_id=p_request_id;
 if receipt.request_id is null then return null; end if;
 if receipt.actor_id<>p_actor_id or receipt.request_fingerprint is distinct from p_request_fingerprint then raise exception 'spending_idempotency_conflict'; end if;
 return receipt.response||jsonb_build_object('replayed',true);
end $$;
revoke all on function public.director_spending_replay(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.director_spending_replay(uuid,uuid,uuid,text) to service_role;

create function public.director_persist_quote(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_request_id uuid,p_request_fingerprint text,p_quote jsonb,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; m public.director_models; a public.director_artifacts; q public.director_proposals; saved public.director_quote_records; receipt public.director_spending_commands; req jsonb; result jsonb;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id<>p_actor_id then raise exception 'not_project_owner'; end if;
 if p_request_id is null or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'spending_request_invalid'; end if;
 req=jsonb_build_object('actorId',p_actor_id,'expectedVersion',p_expected_version,'quote',p_quote,'payload',p_payload);
 select c.* into receipt from public.director_spending_commands c where c.project_id=p.id and c.request_id=p_request_id;
 if receipt.request_id is not null then
 if receipt.command<>'persist_quote' or receipt.actor_id<>p_actor_id or receipt.request_fingerprint is distinct from p_request_fingerprint then raise exception 'spending_idempotency_conflict'; end if;
 return receipt.response||jsonb_build_object('replayed',true); end if;
 if p_expected_version is null or (p.brief->>'version')::integer is distinct from p_expected_version or p_quote->>'projectId' is distinct from p.id::text or (p_quote->>'projectVersion')::integer is distinct from p_expected_version then raise exception 'project_version_conflict'; end if;
 select x.* into m from public.director_models x where x.id=p_quote->>'modelId' for share;
 if m.id is null or not public.director_quote_contract_valid(p_quote,p_payload,m) then raise exception 'quote_contract_invalid'; end if;
 select x.* into a from public.director_artifacts x where x.project_id=p.id and x.logical_key=p_quote->>'artifactId' and x.version=(p_quote->>'artifactVersion')::integer;
 if a.id is null or a.content_hash is distinct from p_quote->>'artifactContentHash' or not public.director_artifact_is_current(p.id,a.id) then raise exception 'artifact_superseded'; end if;
 select x.* into saved from public.director_quote_records x where x.quote_id=p_quote->>'id';
 if saved.quote_id is not null then
 select x.* into q from public.director_proposals x where x.id=saved.proposal_id;
 if saved.actor_id<>p_actor_id or saved.project_id<>p.id or saved.project_version<>p_expected_version or saved.quote<>p_quote or q.payload<>p_payload then raise exception 'spending_idempotency_conflict'; end if;
 else
 insert into public.director_proposals(project_id,artifact_id,model_id,price_version,payload,payload_hash,quote_micro_usd,quote_expires_at)
 values(p.id,a.id,m.id,m.price_version,p_payload,p_quote->>'payloadHash',(p_quote->>'totalMicroUsd')::bigint,(p_quote->>'expiresAt')::timestamptz) returning * into q;
 insert into public.director_quote_records(quote_id,project_id,proposal_id,actor_id,project_version,quote,registry_snapshot)
 values(p_quote->>'id',p.id,q.id,p_actor_id,p_expected_version,p_quote,to_jsonb(m));
 end if;
 result=jsonb_build_object('proposal',to_jsonb(q),'quote',p_quote,'replayed',false);
 insert into public.director_spending_commands(project_id,request_id,actor_id,command,request,response,request_fingerprint) values(p.id,p_request_id,p_actor_id,'persist_quote',req,result,p_request_fingerprint);
 return result;
end $$;
revoke all on function public.director_persist_quote(uuid,uuid,integer,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.director_persist_quote(uuid,uuid,integer,uuid,text,jsonb,jsonb) to service_role;

create function public.director_authorize_quote(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_request_id uuid,p_quote_id text,p_max_micro_usd bigint,p_finish_reserve_micro_usd bigint,p_expires_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; saved public.director_quote_records; q public.director_proposals; a public.director_artifacts; m public.director_models; v_authorization public.director_budget_authorizations; receipt public.director_spending_commands; req jsonb; result jsonb; used_amount numeric;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id<>p_actor_id then raise exception 'not_project_owner'; end if;
 if p_request_id is null then raise exception 'spending_request_invalid'; end if;
 req=jsonb_build_object('actorId',p_actor_id,'expectedVersion',p_expected_version,'quoteId',p_quote_id,'maxMicroUsd',p_max_micro_usd,'finishReserveMicroUsd',p_finish_reserve_micro_usd,'expiresAt',p_expires_at);
 select c.* into receipt from public.director_spending_commands c where c.project_id=p.id and c.request_id=p_request_id;
 if receipt.request_id is not null then if receipt.command<>'authorize_quote' or receipt.request<>req then raise exception 'spending_idempotency_conflict'; end if; return receipt.response||jsonb_build_object('replayed',true); end if;
 if p_expected_version is null or (p.brief->>'version')::integer is distinct from p_expected_version then raise exception 'project_version_conflict'; end if;
 select x.* into saved from public.director_quote_records x where x.quote_id=p_quote_id and x.project_id=p.id and x.actor_id=p_actor_id;
 select x.* into q from public.director_proposals x where x.id=saved.proposal_id and x.project_id=p.id;
 select x.* into m from public.director_models x where x.id=q.model_id for share;
 select x.* into a from public.director_artifacts x where x.id=q.artifact_id and x.project_id=p.id;
 if q.id is null or m.id is null or saved.project_version<>p_expected_version or (saved.quote->>'projectVersion')::integer is distinct from p_expected_version or saved.registry_snapshot is distinct from to_jsonb(m) or not public.director_quote_contract_valid(saved.quote,q.payload,m) then raise exception 'quote_contract_invalid'; end if;
 if a.id is null or not public.director_artifact_is_current(p.id,a.id) or a.content_hash is distinct from saved.quote->>'artifactContentHash' then raise exception 'artifact_superseded'; end if;
 -- Financial consent is separate from creative approval and reservation. Existing
 -- reserve/claim guards still enforce recursive approvals and the project spending cap.
 if p_max_micro_usd is null or p_finish_reserve_micro_usd is null or p_max_micro_usd<1 or p_max_micro_usd>9007199254740991 or p_finish_reserve_micro_usd<0 or p_max_micro_usd::numeric<q.quote_micro_usd::numeric+p_finish_reserve_micro_usd or p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>q.quote_expires_at then raise exception 'authorization_invalid'; end if;
 select coalesce(sum(case when j.charge_state='settled' then j.actual_micro_usd when j.charge_state in ('held','unknown') then j.reserved_micro_usd else 0 end),0) into used_amount from public.director_jobs j where j.project_id=p.id;
 insert into public.director_budget_authorizations(project_id,proposal_id,actor_id,max_micro_usd,finish_reserve_micro_usd,expires_at) values(p.id,q.id,p_actor_id,p_max_micro_usd,p_finish_reserve_micro_usd,p_expires_at) returning * into v_authorization;
 result=jsonb_build_object('authorization',to_jsonb(v_authorization),'replayed',false);
 insert into public.director_spending_commands(project_id,request_id,actor_id,command,request,response) values(p.id,p_request_id,p_actor_id,'authorize_quote',req,result);
 return result;
end $$;
revoke all on function public.director_authorize_quote(uuid,uuid,integer,uuid,text,bigint,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.director_authorize_quote(uuid,uuid,integer,uuid,text,bigint,bigint,timestamptz) to service_role;

create function public.director_revoke_authorization(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_request_id uuid,p_authorization_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; a public.director_budget_authorizations; receipt public.director_spending_commands; req jsonb; result jsonb;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id<>p_actor_id then raise exception 'not_project_owner'; end if;
 if p_request_id is null or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'spending_request_invalid'; end if;
 req=jsonb_build_object('actorId',p_actor_id,'expectedVersion',p_expected_version,'authorizationId',p_authorization_id,'reason',btrim(p_reason));
 select c.* into receipt from public.director_spending_commands c where c.project_id=p.id and c.request_id=p_request_id;
 if receipt.request_id is not null then if receipt.command<>'revoke_authorization' or receipt.request<>req then raise exception 'spending_idempotency_conflict'; end if; return receipt.response||jsonb_build_object('replayed',true); end if;
 if p_expected_version is null or (p.brief->>'version')::integer is distinct from p_expected_version then raise exception 'project_version_conflict'; end if;
 update public.director_budget_authorizations x set revoked_at=coalesce(x.revoked_at,now()) where x.id=p_authorization_id and x.project_id=p.id and x.actor_id=p_actor_id returning * into a;
 if a.id is null then raise exception 'authorization_invalid'; end if;
 -- Revocation prevents new reservation/claim; it never releases a held/unknown charge.
 result=jsonb_build_object('authorization',to_jsonb(a),'replayed',false);
 insert into public.director_spending_commands(project_id,request_id,actor_id,command,request,response) values(p.id,p_request_id,p_actor_id,'revoke_authorization',req,result);
 return result;
end $$;
revoke all on function public.director_revoke_authorization(uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.director_revoke_authorization(uuid,uuid,integer,uuid,uuid,text) to service_role;

create function public.director_set_project_budget(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_request_id uuid,p_budget_micro_usd bigint,p_finish_reserve_micro_usd bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; receipt public.director_spending_commands; req jsonb; result jsonb; used_amount numeric;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id<>p_actor_id then raise exception 'not_project_owner'; end if;
 if p_request_id is null then raise exception 'spending_request_invalid'; end if;
 req=jsonb_build_object('actorId',p_actor_id,'expectedVersion',p_expected_version,'budgetMicroUsd',p_budget_micro_usd,'finishReserveMicroUsd',p_finish_reserve_micro_usd);
 select c.* into receipt from public.director_spending_commands c where c.project_id=p.id and c.request_id=p_request_id;
 if receipt.request_id is not null then if receipt.command<>'set_project_budget' or receipt.request<>req then raise exception 'spending_idempotency_conflict'; end if; return receipt.response||jsonb_build_object('replayed',true); end if;
 if p_expected_version is null or (p.brief->>'version')::integer is distinct from p_expected_version then raise exception 'project_version_conflict'; end if;
 if p_budget_micro_usd is null or p_finish_reserve_micro_usd is null or p_budget_micro_usd<0 or p_budget_micro_usd>9007199254740991 or p_finish_reserve_micro_usd<0 or p_finish_reserve_micro_usd>p_budget_micro_usd then raise exception 'project_budget_invalid'; end if;
 select coalesce(sum(case when j.charge_state='settled' then j.actual_micro_usd when j.charge_state in ('held','unknown') then j.reserved_micro_usd else 0 end),0) into used_amount from public.director_jobs j where j.project_id=p.id;
 if used_amount+p_finish_reserve_micro_usd>p_budget_micro_usd then raise exception 'project_budget_below_existing_exposure'; end if;
 update public.director_projects x set budget_micro_usd=p_budget_micro_usd,finish_reserve_micro_usd=p_finish_reserve_micro_usd where x.id=p.id;
 result=jsonb_build_object('projectBudget',jsonb_build_object('projectId',p.id,'budgetMicroUsd',p_budget_micro_usd,'finishReserveMicroUsd',p_finish_reserve_micro_usd,'committedMicroUsd',used_amount),'replayed',false);
 insert into public.director_spending_commands(project_id,request_id,actor_id,command,request,response) values(p.id,p_request_id,p_actor_id,'set_project_budget',req,result);
 return result;
end $$;
revoke all on function public.director_set_project_budget(uuid,uuid,integer,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.director_set_project_budget(uuid,uuid,integer,uuid,bigint,bigint) to service_role;
-- Every reservation and dispatch requires the saved immutable quote and exact registry
-- snapshot; no legacy unquoted proposal can enter paid execution through this gate.
create function public.director_guard_job_quote_contract() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; q public.director_proposals; saved public.director_quote_records; m public.director_models;
begin
 if TG_OP='UPDATE' then
 if not(old.status='reserved' and new.status='submitted') then return new; end if;
 end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into q from public.director_proposals x where x.id=new.proposal_id and x.project_id=p.id;
 select x.* into saved from public.director_quote_records x where x.proposal_id=q.id and x.project_id=p.id;
 select x.* into m from public.director_models x where x.id=q.model_id for share;
 if p.id is null or q.id is null or saved.quote_id is null or m.id is null or saved.actor_id is distinct from p.owner_id
 or saved.project_version is distinct from (p.brief->>'version')::integer or (saved.quote->>'projectVersion')::integer is distinct from saved.project_version
 or saved.registry_snapshot is distinct from to_jsonb(m)
 or q.payload_hash is distinct from saved.quote->>'payloadHash'
 or q.price_version is distinct from saved.quote->>'priceVersion'
 or q.quote_micro_usd is distinct from (saved.quote->>'totalMicroUsd')::bigint
 or not public.director_quote_contract_valid(saved.quote,q.payload,m) then raise exception 'quote_contract_invalid'; end if;
 return new;
end $$;
revoke all on function public.director_guard_job_quote_contract() from public,anon,authenticated;
grant execute on function public.director_guard_job_quote_contract() to service_role;
create trigger director_approval_quote_insert_guard before insert on public.director_jobs
for each row execute function public.director_guard_job_quote_contract();
create trigger director_approval_quote_dispatch_guard before update of status on public.director_jobs
for each row execute function public.director_guard_job_quote_contract();

commit;

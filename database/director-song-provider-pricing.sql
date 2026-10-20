-- PREPARED ONLY. Requires existing storyboard/reference production, source-media
-- publication and director-song-intelligence.sql. No route activation or spending.
begin;

-- Only published, inspection-backed source records qualify for the preproduction
-- analysis exception. An approved edit record is not otherwise a media shortcut.
create function public.director_song_source_asset(p_project_id uuid,p_key text,p_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;asset public.director_assets;receipt public.director_source_uploads;inspection public.director_source_inspections;b jsonb;r jsonb;s jsonb;expected jsonb;decision text;actor uuid;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id;if p.id is null then return null;end if;
 b=public.director_song_source_binding(p.brief);if b is null or p_key is distinct from 'record:'||(b->>'recordId')or b->'version'is distinct from to_jsonb(p_version)then return null;end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key=p_key and x.version=p_version and x.kind='edit';
 if a.id is null or not public.director_artifact_is_current(p.id,a.id)then return null;end if;
 select x.value into r from jsonb_array_elements(p.brief->'production'->'records')x where x.value->>'id'=b->>'recordId';
 select x.value into s from jsonb_array_elements(r->'versions')x where x.value->'version'=b->'version';
 expected=jsonb_build_object('recordId',r->'id','type',r->'type','name',coalesce(s->'name',r->'name'))||s;
 if a.content is distinct from expected or a.content->>'recordId'is distinct from b->>'recordId'or a.content->>'type'is distinct from'edit'or coalesce(s->'dependencies','[]'::jsonb)is distinct from'[]'::jsonb or s->'references'is distinct from jsonb_build_array(jsonb_build_object('assetId',b->'master'->'assetId','version',b->'master'->'assetVersion'))then return null;end if;
 select ap.decision,ap.actor_id into decision,actor from public.director_approvals ap where ap.project_id=p.id and ap.artifact_id=a.id order by ap.ordinal desc limit 1;
 if decision is distinct from'approved'or actor is distinct from p.owner_id then return null;end if;
 select x.*into asset from public.director_assets x join public.director_source_publications pub on pub.project_id=x.project_id and pub.asset_id=x.id and pub.upload_id=x.id where x.project_id=p.id and x.id=(b->'master'->>'assetId')::uuid;
 if asset.id is null or asset.metadata->'version'is distinct from b->'master'->'assetVersion'or asset.metadata->>'sourceUploadId'is distinct from asset.id::text or asset.metadata->>'bucket'is distinct from'director-source-media'or asset.metadata->>'checksumAlgorithm'is distinct from'sha256-bytes'or asset.metadata->>'inspectionVersion'is distinct from'director-source-inspection-v1'or asset.metadata->'decodeVerified'is distinct from'true'::jsonb or asset.metadata->>'checksum'is distinct from b->'master'->>'checksum'or asset.metadata->>'role'is distinct from'master_song'or asset.metadata->>'scope'is distinct from'project'or asset.metadata->>'projectId'is distinct from p.id::text or asset.metadata->>'id'is distinct from asset.id::text or coalesce(asset.metadata->>'mime','')not in('audio/wav','audio/mpeg')then return null;end if;
 select x.*into receipt from public.director_source_uploads x where x.id=asset.id and x.project_id=p.id and x.owner_id=p.owner_id;
 select x.*into inspection from public.director_source_inspections x where x.upload_id=asset.id and x.project_id=p.id and x.owner_id=p.owner_id;
 if receipt.id is null or inspection.upload_id is null or inspection.status is distinct from'passed'or inspection.source_document is distinct from receipt.document or inspection.result->>'inspectionVersion'is distinct from'director-source-inspection-v1'or inspection.result->'decodeVerified'is distinct from'true'::jsonb or inspection.result->>'sha256'is distinct from b->'master'->>'checksum'or receipt.document->'manifest'->>'sha256'is distinct from b->'master'->>'checksum'or inspection.result->'mime'is distinct from asset.metadata->'mime'or inspection.result->'mime'is distinct from receipt.document->'manifest'->'mime'or asset.kind is distinct from asset.metadata->>'mime'or receipt.document->>'bucket'is distinct from'director-source-media'or asset.storage_key is distinct from p.owner_id::text||'/'||p.id::text||'/'||asset.id::text or receipt.document->>'storageKey'is distinct from asset.storage_key or asset.metadata->>'storageKey'is distinct from asset.storage_key then return null;end if;
 if jsonb_typeof(inspection.result->'durationSeconds')is distinct from'number'or(inspection.result->>'durationSeconds')::numeric<=0 or(inspection.result->>'durationSeconds')::numeric>300 or asset.metadata->'durationSeconds'is distinct from inspection.result->'durationSeconds'or abs((inspection.result->>'durationSeconds')::numeric*1000-(b->'master'->>'durationMs')::numeric)>250 then return null;end if;
 return asset.metadata;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return null;
end $$;

create function public.director_song_quote_units(p_quote jsonb,p_payload jsonb,p_price jsonb)
returns numeric language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;m public.director_models;asset jsonb;b jsonb;expected jsonb;e jsonb;c jsonb;quantity numeric;block_seconds integer;purpose text;profile jsonb;profile_ready boolean:=false;k text;url text;canonical_text text;vocal_mode text;
begin
 if jsonb_typeof(p_quote->'songIntelligenceBinding')is distinct from'object'or jsonb_typeof(p_payload)is distinct from'object'or p_payload ? 'duration'then return null;end if;
 select x.*into p from public.director_projects x where x.id=(p_quote->>'projectId')::uuid;
 select x.*into m from public.director_models x where x.id=p_quote->>'modelId';
 if p.id is null or m.id is null or m.provider is distinct from'fal'or m.endpoint is distinct from p_quote->>'endpoint'or m.price_version is distinct from p_price->>'version'or m.price_evidence is distinct from p_price or not coalesce(m.capabilities->'tasks'@>jsonb_build_array(p_quote->>'task'),false)then return null;end if;
 b=public.director_song_source_binding(p.brief);if b is null then return null;end if;
 asset=public.director_song_source_asset(p.id,p_quote->>'artifactId',(p_quote->>'artifactVersion')::integer);if asset is null then return null;end if;
 if p_quote->'songIntelligenceBinding'->>'operation'='interpret'and m.endpoint='fal-ai/audio-understanding'and p_quote->>'task'='song_analysis'then block_seconds=5;purpose='musical_audio_analysis';
 elsif p_quote->'songIntelligenceBinding'->>'operation'='transcribe'and m.endpoint='fal-ai/elevenlabs/speech-to-text/scribe-v2'and p_quote->>'task'='transcription'then block_seconds=60;purpose='singing_transcription';
 elsif p_quote->'songIntelligenceBinding'->>'operation'='align'and m.endpoint='fal-ai/elevenlabs/forced-alignment'and p_quote->>'task'='alignment'then
  block_seconds=3600;purpose='sung_lyric_alignment';
  select a.content->'content'->'lyrics'->>'canonicalText',a.content->'content'->'lyrics'->>'vocalMode'into canonical_text,vocal_mode from public.director_artifacts a where a.project_id=p.id and a.logical_key=p_quote->>'artifactId'and a.version=(p_quote->>'artifactVersion')::integer;
  -- Equality preserves Unicode, line breaks and whitespace. Do not normalize or
  -- substitute provider text; an edited canonical source requires a fresh quote.
  if jsonb_typeof(p_payload->'text')is distinct from'string'or canonical_text is null or canonical_text!~'[^[:space:]]'or vocal_mode='instrumental'or p_payload->>'text'is distinct from canonical_text then return null;end if;
 else return null;end if;
 expected=b||jsonb_build_object('inspectedDurationSeconds',asset->'durationSeconds','measurementVersion','director-source-inspection-v1','operation',p_quote->'songIntelligenceBinding'->>'operation');
 if p_quote->'songIntelligenceBinding'is distinct from expected or p_quote->'requirements'->'durationSeconds'is distinct from asset->'durationSeconds'or p_quote->'intent'->>'purpose'is distinct from purpose then return null;end if;
 if jsonb_typeof(m.routing_profiles)is distinct from'array'then return null;end if;
 for profile in select value from jsonb_array_elements(m.routing_profiles)loop
  if profile->'verified'='true'::jsonb and profile->>'task'=p_quote->>'task'and profile->>'modelId'=m.id and profile->>'endpoint'=m.endpoint and profile->>'modelVersion'=m.model_version and profile->>'evidenceVersion'=p_quote->'intentEvidence'->>'evidenceVersion'and profile->>'evaluatedAt'=p_quote->'intentEvidence'->>'evaluatedAt'and profile->>'expiresAt'=p_quote->'intentEvidence'->>'expiresAt'and jsonb_typeof(profile->'sampleCount')='number'and(profile->>'sampleCount')::numeric>=1 and(profile->>'sampleCount')::numeric=trunc((profile->>'sampleCount')::numeric)and(profile->>'evaluatedAt')::timestamptz<=clock_timestamp()and(profile->>'expiresAt')::timestamptz>clock_timestamp()and profile->'purposes'@>jsonb_build_array(purpose)then profile_ready=true;end if;
 end loop;
 if not profile_ready then return null;end if;
 url=p_payload->>'audio_url';
 if url is null or url!~'^https://[a-z0-9-]+\.supabase\.co(:443)?/storage/v1/object/sign/'or position('#'in url)>0 or split_part(regexp_replace(url,'^https://[a-z0-9-]+\.supabase\.co(:443)?',''), '?',1)is distinct from'/storage/v1/object/sign/director-source-media/'||(asset->>'storageKey')or url!~'[?&]token=[^&#]+'then return null;end if;
 if jsonb_typeof(p_price->'tariff'->'components')is distinct from'array'or jsonb_array_length(p_price->'tariff'->'components')<>1 then return null;end if;c=p_price->'tariff'->'components'->0;
 if c->>'id'is distinct from'audio_duration'or c->>'unit'is distinct from'second'or c->>'rounding'is distinct from'ceil'or coalesce(c->'includedUnits','0'::jsonb)is distinct from'0'::jsonb or coalesce(c->'minimumUnits','0'::jsonb)is distinct from'0'::jsonb then return null;end if;
 for k in select jsonb_object_keys(c)loop if k not in('id','unit','rate','rounding','includedUnits','minimumUnits')then return null;end if;end loop;
 if jsonb_typeof(c->'rate')is distinct from'object'then return null;end if;for k in select jsonb_object_keys(c->'rate')loop if k not in('numeratorMicroUsd','denominatorUnits')then return null;end if;end loop;
 if jsonb_typeof(c->'rate'->'numeratorMicroUsd')is distinct from'number'or jsonb_typeof(c->'rate'->'denominatorUnits')is distinct from'number'or(c->'rate'->>'numeratorMicroUsd')::numeric not between 1 and 9007199254740991 or(c->'rate'->>'denominatorUnits')::numeric not between 1 and 9007199254740991 or(c->'rate'->>'numeratorMicroUsd')::numeric<>trunc((c->'rate'->>'numeratorMicroUsd')::numeric)or(c->'rate'->>'denominatorUnits')::numeric<>trunc((c->'rate'->>'denominatorUnits')::numeric)then return null;end if;
 quantity=ceil((asset->>'durationSeconds')::numeric/block_seconds)*block_seconds;
 e=jsonb_build_object('verified',true,'priceVersion',m.price_version,'inputHash',p_quote->>'payloadHash','measurementVersion','director-source-inspection-v1','components',jsonb_build_object('audio_duration',jsonb_build_object('bounded',true,'quantity',quantity)));
 if p_quote->'usageEvidence'is distinct from e then return null;end if;return quantity;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then return null;
end $$;

-- Preserve existing arithmetic and every ordinary tariff. Only validated song
-- usage can substitute trusted measured billing blocks for a duration API input.
do $$
declare definition text;anchor text;ending text;
begin
 definition=pg_get_functiondef('public.director_composite_quote_valid(jsonb,jsonb,jsonb)'::regprocedure);
 anchor='if jsonb_typeof(p_payload->''duration'') is distinct from ''number'' then return false; end if;';ending='fraction=split_part(duration_text,''.'',2);denominator=power(10::numeric,length(fraction));raw=duration_text::numeric*denominator;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 or(length(definition)-length(replace(definition,ending,'')))/length(ending)<>1 then raise exception'song_composite_baseline_mismatch';end if;
 definition=replace(definition,anchor,'if p_quote ? ''songIntelligenceBinding'' then raw=public.director_song_quote_units(p_quote,p_payload,p_price);denominator=1;if raw is null then return false;end if;else '||anchor);
 execute replace(definition,ending,ending||'end if;');
 definition=pg_get_functiondef('public.director_quote_contract_valid(jsonb,jsonb,public.director_models)'::regprocedure);anchor='begin';
 -- First BEGIN is the function body; the declaration contains no other BEGIN.
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'song_quote_contract_baseline_mismatch';end if;
 execute replace(definition,anchor,anchor||' if p_model.endpoint=''fal-ai/elevenlabs/forced-alignment''or p_quote ? ''songIntelligenceBinding''or exists(select 1 from public.director_artifacts song_target where song_target.project_id=(p_quote->>''projectId'')::uuid and song_target.logical_key=p_quote->>''artifactId''and song_target.version=(p_quote->>''artifactVersion'')::integer and song_target.kind=''edit''and song_target.content->''content''->>''kind''=''song_intelligence_v1'')then if public.director_song_quote_units(p_quote,p_payload,p_model.price_evidence)is null then return false;end if;end if;');
 definition=pg_get_functiondef('public.director_document_approval_ready(uuid,text,integer)'::regprocedure);anchor='if project.id is null or project.owner_id is null then return false; end if;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'song_approval_exception_baseline_mismatch';end if;
 execute replace(definition,anchor,anchor||'if public.director_song_source_asset(project.id,p_logical_key,p_version)is not null then return true;end if;');
 definition=pg_get_functiondef('public.director_storyboard_media_ready(uuid,uuid)'::regprocedure);anchor='if a.kind in(''shot_contract'',''storyboard_sequence'')';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'song_storyboard_exception_baseline_mismatch';end if;
 execute replace(definition,anchor,'if a.kind=''edit''and public.director_song_source_asset(p.id,a.logical_key,a.version)is not null then return true;end if;'||anchor);
end $$;

-- Extend reviewed adapter admission, not active registry rows. Alignment uses the
-- documented upward hourly block; the reviewed registry still supplies the rate.
do $$
declare definition text;anchor text;
begin
 definition=pg_get_functiondef('public.director_registry_review_ready(text,jsonb,jsonb)'::regprocedure);
 anchor='p_profile->>''endpoint'' not in(''minimax/h3-max/reference-to-video'',''elevenlabs/tts/eleven-v4'',''bytedance/seedream/v5/pro/edit'',''fal-ai/flux-2-pro'',''fal-ai/flux-2/klein/9b'')';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'song_registry_endpoint_baseline_mismatch';end if;
 definition=replace(definition,anchor,'p_profile->>''endpoint'' not in(''minimax/h3-max/reference-to-video'',''elevenlabs/tts/eleven-v4'',''bytedance/seedream/v5/pro/edit'',''fal-ai/flux-2-pro'',''fal-ai/flux-2/klein/9b'',''fal-ai/audio-understanding'',''fal-ai/elevenlabs/speech-to-text/scribe-v2'',''fal-ai/elevenlabs/forced-alignment'')');
 anchor='when''fal-ai/flux-2/klein/9b''then item#>>''{}''=''reference_image''else false end,false)';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'song_registry_task_baseline_mismatch';end if;
 definition=replace(definition,anchor,'when''fal-ai/flux-2/klein/9b''then item#>>''{}''=''reference_image''when''fal-ai/audio-understanding''then item#>>''{}''in(''song_analysis'',''audio_analysis'')when''fal-ai/elevenlabs/speech-to-text/scribe-v2''then item#>>''{}''=''transcription''when''fal-ai/elevenlabs/forced-alignment''then item#>>''{}''=''alignment''else false end,false)');
 anchor='if p_profile->>''provider''=''openai'' then';
 -- There is one executable OpenAI branch plus one earlier evidence-loop branch.
 definition=replace(definition,anchor,anchor||' if c->''planning'' ? ''songIntelligenceVersion''and c->''planning''->>''songIntelligenceVersion''is distinct from''song_intelligence_v1''then return false;end if;');execute definition;
 definition=pg_get_functiondef('public.director_planning_profile_ready(jsonb,public.director_models)'::regprocedure);anchor='begin';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'song_planning_optin_baseline_mismatch';end if;
 execute replace(definition,anchor,anchor||' if planning ? ''songIntelligenceVersion''and planning->>''songIntelligenceVersion''is distinct from''song_intelligence_v1''then return false;end if;');
end $$;

create function public.director_reserve_song_job(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_quote_id text,p_authorization_id uuid,p_idempotency_key text)
returns public.director_jobs language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;s public.director_quote_records;q public.director_proposals;a public.director_artifacts;m public.director_models;w public.director_work_units;j public.director_jobs;unit_key text;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id for update;if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception'not_project_owner';end if;
 select x.*into s from public.director_quote_records x where x.quote_id=p_quote_id and x.project_id=p.id and x.actor_id=p_actor_id;select x.*into q from public.director_proposals x where x.id=s.proposal_id and x.project_id=p.id;
 select x.*into j from public.director_jobs x where x.project_id=p.id and x.idempotency_key=p_idempotency_key;
 if j.id is not null then if q.id is null or j.proposal_id is distinct from q.id or j.authorization_id is distinct from p_authorization_id or j.payload_hash is distinct from q.payload_hash then raise exception'idempotency_conflict';end if;return j;end if;
 if p_expected_version is null or p.brief->'version'is distinct from to_jsonb(p_expected_version)then raise exception'song_save_stale';end if;
 if s.quote_id is null or s.project_version is distinct from p_expected_version or s.quote->'projectVersion'is distinct from to_jsonb(p_expected_version)then raise exception'song_quote_stale';end if;
 select x.*into m from public.director_models x where x.id=q.model_id;select x.*into a from public.director_artifacts x where x.id=q.artifact_id and x.project_id=p.id and x.kind='edit';
 if a.id is null or public.director_song_quote_units(s.quote,q.payload,m.price_evidence)is null or not public.director_quote_contract_valid(s.quote,q.payload,m)then raise exception'song_quote_invalid';end if;
 unit_key='song:'||(s.quote->'songIntelligenceBinding'->>'recordId')||':'||(s.quote->'songIntelligenceBinding'->>'version')||':'||(s.quote->'songIntelligenceBinding'->>'operation');
 insert into public.director_work_units(project_id,logical_key,artifact_id)values(p.id,unit_key,a.id)on conflict(project_id,logical_key)do nothing;
 select x.*into w from public.director_work_units x where x.project_id=p.id and x.logical_key=unit_key;if w.artifact_id is distinct from a.id then raise exception'song_work_unit_conflict';end if;
 return public.director_reserve_job(p_actor_id,p.id,w.id,q.id,p_authorization_id,p_idempotency_key,q.payload_hash);
end $$;
create function public.director_review_song_job(p_actor_id uuid,p_project_id uuid,p_job_id uuid,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;j public.director_jobs;q public.director_proposals;s public.director_quote_records;a public.director_artifacts;r public.director_reviews;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id for update;if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception'not_project_owner';end if;
 if p_expected_version is null or p.brief->'version'is distinct from to_jsonb(p_expected_version)or p_reason is null or length(btrim(p_reason))not between 5 and 2000 then raise exception'song_review_invalid';end if;
 select x.*into j from public.director_jobs x where x.id=p_job_id and x.project_id=p.id;select x.*into q from public.director_proposals x where x.id=j.proposal_id and x.project_id=p.id;select x.*into s from public.director_quote_records x where x.proposal_id=q.id and x.project_id=p.id;select x.*into a from public.director_artifacts x where x.id=q.artifact_id and x.project_id=p.id;
 if j.id is null or j.status not in('completed','failed')or j.provider_request_id is null or a.kind is distinct from'edit'or a.content->'content'->>'kind'is distinct from'song_intelligence_v1'or a.logical_key is distinct from'record:'||(s.quote->'songIntelligenceBinding'->>'recordId')or to_jsonb(a.version)is distinct from s.quote->'songIntelligenceBinding'->'version'or not coalesce((s.quote->'songIntelligenceBinding'->>'operation'='interpret'and s.quote->>'endpoint'='fal-ai/audio-understanding'and s.quote->>'task'='song_analysis')or(s.quote->'songIntelligenceBinding'->>'operation'='transcribe'and s.quote->>'endpoint'='fal-ai/elevenlabs/speech-to-text/scribe-v2'and s.quote->>'task'='transcription')or(s.quote->'songIntelligenceBinding'->>'operation'='align'and s.quote->>'endpoint'='fal-ai/elevenlabs/forced-alignment'and s.quote->>'task'='alignment'),false)then raise exception'song_review_unavailable';end if;
 insert into public.director_reviews(project_id,job_id,actor_id,verdict,evidence)values(p.id,j.id,p_actor_id,'correction_required',jsonb_build_object('reason',p_reason,'source','explicit_user_review'))returning*into r;
 return jsonb_build_object('id',r.id,'projectId',p.id,'jobId',j.id,'verdict',r.verdict,'evidence',r.evidence,'createdAt',r.created_at);
end $$;

revoke all on function public.director_song_source_asset(uuid,text,integer),public.director_song_quote_units(jsonb,jsonb,jsonb),public.director_reserve_song_job(uuid,uuid,integer,text,uuid,text),public.director_review_song_job(uuid,uuid,uuid,integer,text)from public,anon,authenticated;
grant execute on function public.director_song_source_asset(uuid,text,integer),public.director_song_quote_units(jsonb,jsonb,jsonb),public.director_reserve_song_job(uuid,uuid,integer,text,uuid,text),public.director_review_song_job(uuid,uuid,uuid,integer,text)to service_role;
commit;

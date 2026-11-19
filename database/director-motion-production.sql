-- PREPARED ONLY. Requires the foundation, durable quotes, source inspection,
-- storyboard production and reviewed motion pricing adapters. No migration run.
-- Existing quotes, work units, reservations and correction reviews remain the
-- financial authority. No account, route or quality flag is activated here.
begin;
create function public.director_motion_quote_current(p_project_id uuid,p_quote jsonb,p_payload jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; b jsonb; pins jsonb; r jsonb; v jsonb; plan jsonb; pv jsonb; assignment jsonb; shot jsonb; frame jsonb; a public.director_artifacts; ap public.director_approvals; latest uuid; image public.director_assets; audio public.director_assets; e jsonb; rate numeric; first_sample numeric; last_sample numeric; seconds numeric;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id;
 b=p_quote->'performanceBinding';pins=b->'sourcePins';
 if p.id is null or p.brief->>'format'is distinct from'music_video'or jsonb_typeof(b)is distinct from'object'or p_quote->'projectVersion'is distinct from p.brief->'version'or p_quote->>'projectId'is distinct from p.id::text then return false;end if;
 select x.id into latest from public.director_approvals x where x.project_id=p.id order by x.ordinal desc limit 1;
 if b->>'latestApprovalId'is distinct from latest::text then return false;end if;
 select x.value into r from jsonb_array_elements(p.brief->'production'->'records')x where x.value->>'id'=b->>'recordId';
 select x.value into v from jsonb_array_elements(r->'versions')x where x.value->'version'=r->'currentVersion';
 if r->>'type'is distinct from'edit'or r->'currentVersion'is distinct from b->'version'or v->'content'->>'kind'is distinct from'music_video_motion_spec_v1'or v->'content'->'sourcePins'is distinct from pins or p_quote->>'artifactId'is distinct from'record:'||(b->>'recordId')or p_quote->'artifactVersion'is distinct from b->'version'then return false;end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key=p_quote->>'artifactId'and x.version=(b->>'version')::integer;
 if a.id is null or a.content->'content'is distinct from v->'content'then return false;end if;
 select x.*into ap from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 if ap.decision is distinct from'approved'or ap.actor_id is distinct from p.owner_id then return false;end if;
 select x.value into plan from jsonb_array_elements(p.brief->'production'->'records')x where x.value->>'id'=pins->'songPlan'->>'recordId';
 select x.value into pv from jsonb_array_elements(plan->'versions')x where x.value->'version'=plan->'currentVersion';
 if plan->'currentVersion'is distinct from pins->'songPlan'->'version'or pv->'content'->>'kind'is distinct from'music_video_plan_v1'or pv->'content'->'master'->'assetId'is distinct from pins->'master'->'assetId'or pv->'content'->'master'->'assetVersion'is distinct from pins->'master'->'assetVersion'or pv->'content'->'master'->'checksum'is distinct from pins->'master'->'checksum'then return false;end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='record:'||(plan->>'id')and x.version=(plan->>'currentVersion')::integer;
 select x.*into ap from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 if a.id is null or ap.decision is distinct from'approved'or ap.actor_id is distinct from p.owner_id then return false;end if;
 select x.value into assignment from jsonb_array_elements(pv->'content'->'shots')x where x.value->>'shotId'=v->'content'->>'shotId';
 select x.value into shot from jsonb_array_elements(p.brief->'shots')x where x.value->>'id'=assignment->>'shotId';
 if assignment is null or assignment is distinct from pins->'assignment'or assignment->'shotVersion'is distinct from shot->'version'or assignment->>'timingBasis'is distinct from'user_reviewed'then return false;end if;
 select x.value into frame from jsonb_array_elements(p.brief->'storyboardProduction'->'selections')with ordinality x(value,n)where x.value->>'shotId'=assignment->>'shotId'order by n desc limit 1;
 if frame->'version'is distinct from pins->'frame'->'selectionVersion'or frame->'specVersion'is distinct from pins->'frame'->'specVersion'or frame->'assetId'is distinct from pins->'frame'->'assetId'or frame->'assetVersion'is distinct from pins->'frame'->'assetVersion'or not public.director_storyboard_production_selection_current(p.id,p.brief,assignment->>'shotId',(frame->>'version')::integer)then return false;end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='storyboard_frame:'||(assignment->>'shotId')and x.version=(frame->>'version')::integer;
 select x.*into ap from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 if a.id is null or ap.decision is distinct from'approved'or ap.actor_id is distinct from p.owner_id then return false;end if;
 select x.*into image from public.director_assets x where x.project_id=p.id and x.id=(frame->>'assetId')::uuid;
 if image.id is null or image.metadata->>'checksum'is distinct from pins->'frame'->>'checksum'or image.metadata->'version'is distinct from frame->'assetVersion'or coalesce((image.metadata->>'size')::numeric,0)not between 1 and 30000000 or coalesce((image.metadata->>'width')::numeric,0)not between 300 and 6000 or coalesce((image.metadata->>'height')::numeric,0)not between 300 and 6000 or(image.metadata->>'width')::numeric/(image.metadata->>'height')::numeric not between 0.4 and 2.5 or p_payload->>'image_url'is null or p_payload->>'image_url'not like 'https://%.supabase.co/storage/v1/object/sign/'||(image.metadata->>'bucket')||'/'||image.storage_key||'?%token=%'then return false;end if;
 if assignment->>'role'='singing'then
  if p_quote->>'task'is distinct from'singing_performance'or p_quote->>'endpoint'is distinct from'bytedance/omnihuman/v2'or assignment->>'syncClass'is distinct from'sync_required'or jsonb_array_length(assignment->'performers')<>1 or p_payload ? 'duration'or p_payload-'image_url'-'audio_url'-'prompt'<>'{}'::jsonb then return false;end if;
  select x.*into audio from public.director_assets x join public.director_source_publications pub on pub.project_id=x.project_id and pub.asset_id=x.id and pub.upload_id=x.id where x.project_id=p.id and x.id=(pins->'master'->>'assetId')::uuid;
  if audio.id is null or audio.metadata->'version'is distinct from pins->'master'->'assetVersion'or audio.metadata->>'checksum'is distinct from pins->'master'->>'checksum'or audio.metadata->>'checksumAlgorithm'is distinct from'sha256-bytes'or audio.metadata->>'inspectionVersion'is distinct from'director-source-inspection-v1'or audio.metadata->'decodeVerified'is distinct from'true'::jsonb or audio.metadata->>'role'is distinct from'master_song'or audio.metadata->>'scope'is distinct from'project'or coalesce(audio.metadata->>'mime','')not in('audio/wav','audio/mpeg')then return false;end if;
  e=b->'excerpt';rate=(audio.metadata->'streams'->0->>'sampleRate')::numeric;
  first_sample=round((assignment->>'startMs')::numeric*rate/1000);last_sample=round((assignment->>'endMs')::numeric*rate/1000);seconds=(last_sample-first_sample)/rate;
  if rate is null or rate not between 8000 and 192000 or seconds is null or seconds not between 4 and 300 or (assignment->>'endMs')::numeric>(audio.metadata->>'durationSeconds')::numeric*1000 or e->'master'is distinct from pins->'master'or e->'range'is distinct from jsonb_build_object('startMs',assignment->'startMs','endMs',assignment->'endMs')or(e->>'startSample')::numeric is distinct from first_sample or(e->>'endSample')::numeric is distinct from last_sample or(e->>'sampleCount')::numeric is distinct from last_sample-first_sample or(e->>'sampleRate')::numeric is distinct from rate or abs((e->>'durationSeconds')::numeric-seconds)>0.00000001 or coalesce((e->>'estimatedMaxBytes')::numeric,0)not between 1 and 15000000 or p_payload->>'audio_url'is null or p_payload->>'audio_url'!~('^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/sign/director-source-media/'||p.owner_id::text||'/'||p.id::text||'/motion-excerpt-[a-f0-9]{64}[?].*token=')then return false;end if;
 else
  if coalesce(assignment->>'role','')not in('narrative','broll','dance')or p_quote->>'task'is distinct from'reference_video'or p_quote->>'endpoint'is distinct from'minimax/h3-max/reference-to-video'or assignment->>'syncClass'='sync_required'or b->'excerpt'is distinct from'null'::jsonb or p_payload-'image_url'-'prompt'-'duration'-'resolution'-'prompt_expansion_mode'<>'{}'::jsonb or(p_payload->>'duration')::numeric is distinct from((assignment->>'endMs')::numeric-(assignment->>'startMs')::numeric)/1000 or(p_payload->>'duration')::numeric not between 0.92 and 15 or p_payload->>'resolution'is distinct from'768P'or p_payload->>'prompt_expansion_mode'is distinct from'disabled'then return false;end if;
 end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or division_by_zero then return false;
end $$;
-- Feed validated native-sample upper bounds into the existing composite
-- arithmetic. The observed per-second tariff is not an invoice/rounding claim.
create function public.director_motion_quote_units(p_quote jsonb,p_payload jsonb,p_price jsonb)
returns numeric language plpgsql security invoker set search_path=''as $$
declare e jsonb;c jsonb;seconds numeric;quantity numeric;
begin
 if p_quote->>'task'is distinct from'singing_performance'or not coalesce(public.director_motion_quote_current((p_quote->>'projectId')::uuid,p_quote,p_payload),false)or p_quote->'priceEvidence'is distinct from p_price or jsonb_array_length(p_price->'tariff'->'components')<>1 then return null;end if;
 c=p_price->'tariff'->'components'->0;
 if c->>'unit'is distinct from'second'or c->>'rounding'is distinct from'ceil'or coalesce(c->'includedUnits','0'::jsonb)is distinct from'0'::jsonb or coalesce(c->'minimumUnits','0'::jsonb)is distinct from'0'::jsonb then return null;end if;
 seconds=(p_quote->'performanceBinding'->'excerpt'->>'durationSeconds')::numeric;quantity=ceil(seconds);
 e=jsonb_build_object('verified',true,'priceVersion',p_price->>'version','inputHash',p_quote->>'payloadHash','measurementVersion','director-original-audio-excerpt-v1','components',jsonb_build_object(c->>'id',jsonb_build_object('bounded',true,'quantity',quantity)));
 if p_quote->'usageEvidence'is distinct from e then return null;end if;return quantity;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return null;
end $$;
do $$declare definition text;anchor text;
begin
 definition=pg_get_functiondef('public.director_composite_quote_valid(jsonb,jsonb,jsonb)'::regprocedure);
 anchor='if p_quote ? ''songIntelligenceBinding'' then raw=public.director_song_quote_units(p_quote,p_payload,p_price);';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'motion_composite_baseline_mismatch';end if;
 execute replace(definition,anchor,'if p_quote ? ''performanceBinding''and p_quote->>''task''=''singing_performance''then raw=public.director_motion_quote_units(p_quote,p_payload,p_price);denominator=1;if raw is null then return false;end if;elsif p_quote ? ''songIntelligenceBinding'' then raw=public.director_song_quote_units(p_quote,p_payload,p_price);');
 definition=pg_get_functiondef('public.director_quote_contract_valid(jsonb,jsonb,public.director_models)'::regprocedure);anchor='begin';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'motion_contract_baseline_mismatch';end if;
 execute replace(definition,anchor,anchor||' if p_quote ? ''performanceBinding''or p_quote->>''task''=''singing_performance''or exists(select 1 from public.director_artifacts motion_target where motion_target.project_id=(p_quote->>''projectId'')::uuid and motion_target.logical_key=p_quote->>''artifactId''and motion_target.version=(p_quote->>''artifactVersion'')::integer and motion_target.content->''content''->>''kind''=''music_video_motion_spec_v1'')then if not coalesce(public.director_motion_quote_current((p_quote->>''projectId'')::uuid,p_quote,p_payload),false)then return false;end if;end if;');
end $$;
create function public.director_motion_job_guard()returns trigger language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;q public.director_proposals;s public.director_quote_records;a public.director_artifacts;
begin
 if TG_OP='UPDATE'and not(old.status='reserved'and new.status='submitted')then return new;end if;
 select x.*into p from public.director_projects x where x.id=new.project_id for update;
 select x.*into q from public.director_proposals x where x.id=new.proposal_id and x.project_id=p.id;
 select x.*into a from public.director_artifacts x where x.id=q.artifact_id and x.project_id=p.id;
 select x.*into s from public.director_quote_records x where x.proposal_id=q.id and x.project_id=p.id;
 if a.content->'content'->>'kind'='music_video_motion_spec_v1'or s.quote ? 'performanceBinding'then
  if s.quote_id is null or not coalesce(public.director_motion_quote_current(p.id,s.quote,q.payload),false)then raise exception'motion_source_or_approval_changed';end if;
 end if;return new;
end $$;
create trigger motion_job_insert_guard before insert on public.director_jobs for each row execute function public.director_motion_job_guard();
create trigger motion_job_claim_guard before update of status on public.director_jobs for each row execute function public.director_motion_job_guard();
create function public.director_reserve_motion_job(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_quote_id text,p_authorization_id uuid,p_idempotency_key text)
returns public.director_jobs language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;s public.director_quote_records;q public.director_proposals;m public.director_models;w public.director_work_units;j public.director_jobs;k text;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id for update;if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception'not_project_owner';end if;
 select x.*into s from public.director_quote_records x where x.quote_id=p_quote_id and x.project_id=p.id and x.actor_id=p_actor_id;select x.*into q from public.director_proposals x where x.id=s.proposal_id and x.project_id=p.id;
 select x.*into j from public.director_jobs x where x.project_id=p.id and x.idempotency_key=p_idempotency_key;
 if j.id is not null then if q.id is null or j.proposal_id is distinct from q.id or j.authorization_id is distinct from p_authorization_id or j.payload_hash is distinct from q.payload_hash then raise exception'idempotency_conflict';end if;return j;end if;
 select x.*into m from public.director_models x where x.id=q.model_id;
 if p_expected_version is null or s.project_version is distinct from p_expected_version or p.brief->'version'is distinct from to_jsonb(p_expected_version)or not coalesce(public.director_motion_quote_current(p.id,s.quote,q.payload),false)or not coalesce(public.director_quote_contract_valid(s.quote,q.payload,m),false)then raise exception'motion_quote_invalid';end if;
 k='motion:'||(s.quote->'performanceBinding'->>'recordId')||':'||(s.quote->>'artifactVersion');
 insert into public.director_work_units(project_id,logical_key,artifact_id)values(p.id,k,q.artifact_id)on conflict(project_id,logical_key)do nothing;
 select x.*into w from public.director_work_units x where x.project_id=p.id and x.logical_key=k;
 if w.artifact_id is distinct from q.artifact_id then raise exception'motion_work_unit_conflict';end if;
 return public.director_reserve_job(p_actor_id,p.id,w.id,q.id,p_authorization_id,p_idempotency_key,q.payload_hash);
end $$;
create function public.director_review_motion_job(p_actor_id uuid,p_project_id uuid,p_job_id uuid,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;j public.director_jobs;s public.director_quote_records;r public.director_reviews;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id for update;if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception'not_project_owner';end if;
 if p_expected_version is null or p.brief->'version'is distinct from to_jsonb(p_expected_version)or p_reason is null or length(btrim(p_reason))not between 5 and 2000 then raise exception'motion_review_invalid';end if;
 select x.*into j from public.director_jobs x where x.id=p_job_id and x.project_id=p.id;select x.*into s from public.director_quote_records x where x.proposal_id=j.proposal_id and x.project_id=p.id;
 if j.id is null or j.status not in('completed','failed')or not(s.quote ? 'performanceBinding')then raise exception'motion_review_unavailable';end if;
 insert into public.director_reviews(project_id,job_id,actor_id,verdict,evidence)values(p.id,j.id,p_actor_id,'correction_required',jsonb_build_object('reason',p_reason,'source','explicit_user_review'))returning*into r;
 return jsonb_build_object('id',r.id,'projectId',p.id,'jobId',j.id,'verdict',r.verdict,'evidence',r.evidence,'createdAt',r.created_at);
end $$;
revoke all on function public.director_motion_quote_current(uuid,jsonb,jsonb),public.director_motion_job_guard(),public.director_motion_quote_units(jsonb,jsonb,jsonb),public.director_reserve_motion_job(uuid,uuid,integer,text,uuid,text),public.director_review_motion_job(uuid,uuid,uuid,integer,text)from public,anon,authenticated;
grant execute on function public.director_motion_quote_current(uuid,jsonb,jsonb),public.director_motion_job_guard(),public.director_motion_quote_units(jsonb,jsonb,jsonb),public.director_reserve_motion_job(uuid,uuid,integer,text,uuid,text),public.director_review_motion_job(uuid,uuid,uuid,integer,text)to service_role;
create function public.director_save_motion_selection(p_actor uuid,p_project uuid,p_expected_version integer,p_expected_approval uuid,p_asset_pins jsonb,p_document jsonb,p_artifacts jsonb,p_event jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; latest uuid; pin jsonb; a public.director_assets; existing public.director_audit_events;
begin
 select *into p from public.director_projects where id=p_project and owner_id=p_actor for update;if not found then raise exception 'not_project_owner';end if;
 select id into latest from public.director_approvals where project_id=p.id order by ordinal desc limit 1;
 if p.brief->'version'is distinct from to_jsonb(p_expected_version)or latest is distinct from p_expected_approval then raise exception 'motion_selection_review_changed';end if;
 for pin in select *from jsonb_array_elements(p_asset_pins)loop
  select *into a from public.director_assets where id=(pin->>'id')::uuid and project_id=p.id;
  if not found or a.metadata->'version'is distinct from pin->'version'or a.metadata->'checksum'is distinct from pin->'checksum'then raise exception 'motion_selection_source_changed';end if;
 end loop;
 if p_event->>'type'is distinct from'production_outcome'or p_event->>'projectId'is distinct from p.id::text or p_event->>'actorId'is distinct from p_actor::text or p_event->'details'->>'kind'is distinct from'media_outcome_v1'or p_event->'details'->>'decision'is distinct from'accepted'then raise exception 'motion_selection_event_invalid';end if;
 if p_document is distinct from p.brief then perform public.director_save_project(p_actor,p_project,p_expected_version,p_document,p_artifacts);end if;
 select *into existing from public.director_audit_events where id=(p_event->>'id')::uuid;
 if found then if existing.project_id<>p.id or existing.details is distinct from p_event->'details'then raise exception 'motion_selection_review_conflict';end if;
 else insert into public.director_audit_events(id,project_id,actor_id,event_type,details)values((p_event->>'id')::uuid,p.id,p_actor,'production_outcome',p_event->'details');end if;
 return p_event;
end $$;
revoke all on function public.director_save_motion_selection(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb,jsonb)from public,anon,authenticated;
grant execute on function public.director_save_motion_selection(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb,jsonb)to service_role;

commit;

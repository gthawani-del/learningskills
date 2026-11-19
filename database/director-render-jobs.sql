-- PREPARED ONLY. Not applied. Requires foundation, durable quotes/currentness,
-- ordinary production artifacts/approvals and existing private director-source-media.
-- Server validates timeline with prepareSongRender before this service-only RPC.
begin;
create table public.director_render_quotes (
 id uuid primary key,project_id uuid not null references public.director_projects(id),
 owner_id uuid not null references auth.users(id),document jsonb not null
);
create table public.director_render_jobs (
 id uuid primary key,project_id uuid not null references public.director_projects(id),
 owner_id uuid not null references auth.users(id),source_digest text not null,
 document jsonb not null,
 check(document->>'id'=id::text and document->>'projectId'=project_id::text and document->>'ownerId'=owner_id::text),
 check(document->>'status' in ('reserved','running','unknown','completed','released'))
);
create unique index director_render_active_source on public.director_render_jobs(project_id,source_digest) where document->>'status'<>'released';
create table public.director_render_cancellations(project_id uuid not null references public.director_projects(id),request_id uuid not null,owner_id uuid not null references auth.users(id),command jsonb not null,response jsonb not null,primary key(project_id,request_id));
alter table public.director_render_cancellations enable row level security;
revoke all on public.director_render_cancellations from public,anon,authenticated;
grant select,insert on public.director_render_cancellations to service_role;
create unique index director_render_request on public.director_render_jobs(project_id,(document->>'idempotencyKey'));
alter table public.director_render_quotes enable row level security;
alter table public.director_render_jobs enable row level security;
revoke all on public.director_render_quotes,public.director_render_jobs from public,anon,authenticated;
grant select,insert on public.director_render_quotes to service_role;
grant select,insert,update on public.director_render_jobs to service_role;

create function public.director_render_exposure(p_project uuid) returns numeric
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(case document->>'status' when 'released' then 0 when 'completed' then (document->>'actualMicroUsd')::numeric else greatest((document->'quote'->>'maxMicroUsd')::numeric,coalesce((document->>'actualMicroUsd')::numeric,0)) end),0)
 from public.director_render_jobs where project_id=p_project
$$;
create function public.director_render_budget_snapshot(p_actor uuid,p_project uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare p public.director_projects; used numeric;
begin
 select * into p from public.director_projects where id=p_project and owner_id=p_actor;
 if not found then raise exception 'not_project_owner';end if;
 select coalesce(sum(case charge_state when 'settled' then actual_micro_usd when 'held' then reserved_micro_usd when 'unknown' then reserved_micro_usd else 0 end),0) into used from public.director_jobs where project_id=p.id;
 used:=used+public.director_render_exposure(p.id);
 if used>9007199254740991 then raise exception 'render_exposure_reconciliation_required';end if;
 return jsonb_build_object('projectId',p.id,'budgetMicroUsd',p.budget_micro_usd,'finishReserveMicroUsd',p.finish_reserve_micro_usd,'committedMicroUsd',used);
end $$;
-- Only source-affecting fields and the ordinary record dependency closure.
-- Navigation stage, project bookkeeping version and Director sessions are absent.
create function public.director_render_project_snapshot(doc jsonb,dependency_ids jsonb,shot_ids jsonb,uses_upstream boolean) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare configuration jsonb; records_now jsonb; shots_now jsonb; upstream_now jsonb:=null;
begin
 select jsonb_object_agg(k,doc->k) into configuration from unnest(array['format','duration','ratio']) k;
 select coalesce(jsonb_agg(jsonb_build_object('id',r->'id','type',r->'type','currentVersion',r->'currentVersion','current',(select value from jsonb_array_elements(r->'versions') where value->'version'=r->'currentVersion')) order by r->>'id'),'[]'::jsonb) into records_now from jsonb_array_elements(coalesce(doc->'production'->'records','[]')) r where dependency_ids ? (r->>'id');
 select coalesce(jsonb_agg((select jsonb_object_agg(k,shot->k) from unnest(array['id','version','sceneId','description','durationSeconds','productionBindings']) k) order by shot->>'id'),'[]'::jsonb) into shots_now from jsonb_array_elements(coalesce(doc->'shots','[]')) shot where shot_ids ? (shot->>'id');
 if uses_upstream then select jsonb_object_agg(k,doc->k) into upstream_now from unnest(array['title','premise','language','direction','story','creativeBrief','screenplay','departmentPlanning','referenceProduction','storyboardHandoff','storyboardProduction']) k;end if;
 return jsonb_build_object('configuration',configuration,'records',records_now,'shots',shots_now,'upstream',upstream_now);
end $$;
create function public.director_render_scope_current(s jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare p public.director_projects; r jsonb; snap jsonb; pin jsonb; a public.director_assets; review public.director_approvals; artifact public.director_artifacts; pin_projection jsonb; approvals_now jsonb; outcomes_now jsonb;
begin
 select * into p from public.director_projects where id=(s->>'projectId')::uuid and owner_id=(s->>'ownerId')::uuid;
 if not found then return false;end if;
 -- The trusted JS coordinator validates timelineContext. These immutable
 -- snapshots fence every source/review mutation before native transitions.
 if public.director_render_project_snapshot(p.brief||jsonb_build_object('id',p.id,'ownerId',p.owner_id,'title',p.title,'stage',p.stage),s->'dependencyIds',s->'shotIds',(s->>'usesUpstream')::boolean) is distinct from s->'projectSnapshot' then return false;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',decision_row.id,'artifactId',artifact_row.logical_key,'version',artifact_row.version,'decision',decision_row.decision) order by decision_row.id),'[]'::jsonb) into approvals_now from public.director_approvals decision_row left join public.director_artifacts artifact_row on artifact_row.id=decision_row.artifact_id and artifact_row.project_id=decision_row.project_id where decision_row.project_id=p.id and (s->'relevantApprovalKeys') ? artifact_row.logical_key;
 if approvals_now is distinct from s->'approvalSnapshot' then return false;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'details',e.details) order by e.id),'[]'::jsonb) into outcomes_now from public.director_audit_events e where e.project_id=p.id and e.event_type='production_outcome' and exists(select 1 from jsonb_array_elements(s->'manifest'->'clips') clip where clip->>'assetId'=e.details->'asset'->>'id');
 if outcomes_now is distinct from s->'outcomeSnapshot' then return false;end if;
 select value into r from jsonb_array_elements(coalesce(p.brief->'production'->'records','[]')) where value->>'id'=s->>'timelineId' and value->>'type'='edit';
 if r is null or r->'currentVersion' is distinct from s->'timelineVersion' then return false;end if;
 select value into snap from jsonb_array_elements(r->'versions') where value->'version'=s->'timelineVersion';
 if snap->'content' is distinct from s->'content' or snap->'content'->>'kind' is distinct from 'music_video_timeline_v1' then return false;end if;
 select * into artifact from public.director_artifacts where project_id=p.id and logical_key='record:'||(s->>'timelineId') and version=(s->>'timelineVersion')::integer;
 select * into review from public.director_approvals where project_id=p.id and artifact_id=artifact.id order by ordinal desc limit 1;
 if review.id is null or review.id::text is distinct from s->>'approvalId' or review.decision<>'approved' then return false;end if;
 for pin in select value from jsonb_array_elements(s->'sources') loop
  select * into a from public.director_assets where id=(pin->>'id')::uuid and project_id=p.id;
  if not found then return false;end if;
  select jsonb_object_agg(k,case k when 'id' then to_jsonb(a.id) when 'projectId' then to_jsonb(a.project_id) else a.metadata->k end) into pin_projection
  from unnest(array['id','projectId','version','mime','role','checksum','checksumAlgorithm','size','bucket','storageKey','scope','shotId','durationSeconds','decodeVerified','streams','generated','width','height','sourceUploadId','inspectionVersion']) k
  where k in ('id','projectId') or a.metadata ? k;
  if pin_projection is distinct from pin then return false;end if;
 end loop;
 return true;
end $$;

create function public.director_release_unclaimed_render(j jsonb,reason text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
begin
 if j->>'status' is distinct from 'reserved' or j->>'claimToken' is not null or j->>'leaseUntil' is not null or j->>'claimedAt' is not null or coalesce((j->>'actualMicroUsd')::numeric,0)<>0 then raise exception 'render_claimed_or_uncertain_execution_cannot_release';end if;
 return j||jsonb_build_object('status','released','releaseReason',reason);
end $$;
create function public.director_render_command(p_action text,p_command jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; q jsonb; j jsonb; prior jsonb; s jsonb; a jsonb; cost numeric; used numeric; token text:=p_command->>'token'; lease integer; job_id uuid; projection jsonb; review public.director_approvals;
begin
 if p_action in ('quote','reserve','read','cancel') then
  select * into p from public.director_projects where id=(p_command->>'projectId')::uuid and owner_id=(p_command->>'actorId')::uuid for update;
  if not found then raise exception 'not_project_owner';end if;
 else
  select document into j from public.director_render_jobs where id=(p_command->>'id')::uuid;
  if j is null then if p_action='claim' then return null;else raise exception 'render_missing';end if;end if;
  select * into p from public.director_projects where id=(j->>'projectId')::uuid for update;
  select document into j from public.director_render_jobs where id=(p_command->>'id')::uuid for update;
 end if;
 if p_action='cancel' then
  if p_command->>'requestId' is null or (p_command ? 'reason' and (jsonb_typeof(p_command->'reason')<>'string' or length(btrim(p_command->>'reason')) not between 1 and 1000)) or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('actorId','projectId','renderId','requestId','reason')) then raise exception 'render_cancel_invalid';end if;perform (p_command->>'requestId')::uuid;
  select command,response into projection,prior from public.director_render_cancellations where project_id=p.id and request_id=(p_command->>'requestId')::uuid;
  if found then if projection is distinct from p_command then raise exception 'render_cancel_identity_conflict';end if;return prior;end if;
  select document into j from public.director_render_jobs where id=(p_command->>'renderId')::uuid and project_id=p.id and owner_id=p.owner_id for update;
  if not found then raise exception 'render_missing';end if;
  if j->>'status'<>'released' then j:=public.director_release_unclaimed_render(j,'owner_cancelled_before_claim')||jsonb_build_object('releasedAt',clock_timestamp());update public.director_render_jobs set document=j where id=(j->>'id')::uuid;end if;
  insert into public.director_render_cancellations values(p.id,(p_command->>'requestId')::uuid,p.owner_id,p_command,j);return j;
 elsif p_action='read' then
  select document into j from public.director_render_jobs where id=(p_command->>'id')::uuid and project_id=p.id and owner_id=p.owner_id;
  if j is null then raise exception 'render_missing';end if;return j;
 elsif p_action='quote' then
  q:=p_command->'quote';s:=q->'scope';
  if (p.brief->>'version')::integer is distinct from (p_command->>'expectedVersion')::integer or q->>'ownerId' is distinct from p.owner_id::text or q->>'projectId' is distinct from p.id::text or s->>'ownerId' is distinct from p.owner_id::text or s->>'projectId' is distinct from p.id::text or q->>'sourceDigest' is distinct from s->>'sourceDigest' or q->>'currency' is distinct from 'USD' or coalesce(q->>'executorId','')='' or coalesce(q->>'sourceDigest','') !~ '^[a-f0-9]{64}$' or coalesce(q->>'maxMicroUsd','') !~ '^[0-9]+$' or (q->>'maxMicroUsd')::numeric>9007199254740991 or q->>'expiresAt' is null or (q->>'expiresAt')::timestamptz<=clock_timestamp() or (q->>'expiresAt')::timestamptz>clock_timestamp()+interval '1 hour' or public.director_render_scope_current(s) is not true then raise exception 'render_quote_invalid';end if;
  insert into public.director_render_quotes values((q->>'id')::uuid,p.id,p.owner_id,q);return q;
 elsif p_action='reserve' then
  select document into prior from public.director_render_jobs where project_id=p.id and document->>'idempotencyKey'=p_command->>'idempotencyKey';
  if prior is not null then if prior->'requestCommand' is distinct from p_command then raise exception 'render_identity_conflict';end if;return prior;end if;
  select document into q from public.director_render_quotes where id=(p_command->>'quoteId')::uuid and project_id=p.id and owner_id=p.owner_id;
  s:=q->'scope';
  if q is null or (p.brief->>'version')::integer is distinct from (p_command->>'expectedVersion')::integer or s->>'timelineId' is distinct from p_command->>'timelineId' or public.director_render_scope_current(s) is not true or q->>'expiresAt' is null or (q->>'expiresAt')::timestamptz<=clock_timestamp() then raise exception 'render_sources_or_approval_changed';end if;
  if p_command->'acknowledgeRender' is distinct from 'true'::jsonb or coalesce(p_command->>'maxMicroUsd','') !~ '^[0-9]+$' or (p_command->>'maxMicroUsd')::numeric<(q->>'maxMicroUsd')::numeric or (p_command->>'maxMicroUsd')::numeric>9007199254740991 then raise exception 'render_cap_invalid';end if;
  update public.director_render_jobs set document=public.director_release_unclaimed_render(document,'quote_expired_before_claim')||jsonb_build_object('releasedAt',clock_timestamp()) where project_id=p.id and document->>'status'='reserved' and (document->'quote'->>'expiresAt')::timestamptz<=clock_timestamp();
  if exists(select 1 from public.director_render_jobs where project_id=p.id and source_digest=q->>'sourceDigest' and document->>'status'<>'released') then raise exception 'render_existing_execution';end if;
  job_id:=gen_random_uuid();j:=jsonb_build_object('id',job_id,'projectId',p.id,'ownerId',p.owner_id,'sourceDigest',q->'sourceDigest','scope',s,'quote',q,'authorization',jsonb_build_object('id',gen_random_uuid(),'quoteId',q->'id','actorId',p.owner_id,'maxMicroUsd',p_command->'maxMicroUsd','acknowledgeRender',true),'idempotencyKey',(p_command->>'idempotencyKey')::uuid,'requestCommand',p_command,'status','reserved','createdAt',clock_timestamp(),'claimToken',null,'leaseUntil',null,'result',null);
  insert into public.director_render_jobs values(job_id,p.id,p.owner_id,q->>'sourceDigest',j);return j;
 elsif p_action='recover' then
  if j->>'status'='reserved' and (j->'quote'->>'expiresAt')::timestamptz<=clock_timestamp() then j:=public.director_release_unclaimed_render(j,'quote_expired_before_claim')||jsonb_build_object('releasedAt',clock_timestamp());end if;
  if j->>'status'='running' and (j->>'leaseUntil')::timestamptz<=clock_timestamp() then j:=j||jsonb_build_object('status','unknown','claimToken',null,'leaseUntil',null,'hold','Execution outcome unknown; reconcile existing work without redispatch.');end if;
 elsif p_action='claim' then
  if j->>'status'<>'reserved' then return null;end if;
  if (j->'quote'->>'expiresAt')::timestamptz<=clock_timestamp() then j:=public.director_release_unclaimed_render(j,'quote_expired_before_claim')||jsonb_build_object('releasedAt',clock_timestamp());update public.director_render_jobs set document=j where id=(j->>'id')::uuid;return null;end if;
  if public.director_render_scope_current(j->'scope') is not true or (j->'quote'->>'expiresAt')::timestamptz<=clock_timestamp() then raise exception 'render_sources_or_approval_changed';end if;
  lease:=(p_command->>'leaseSeconds')::integer;
  if lease is null or lease not between 30 and 900 or token is null then raise exception 'render_lease_invalid';end if;perform token::uuid;
  j:=j||jsonb_build_object('status','running','claimedAt',clock_timestamp(),'claimToken',token,'leaseUntil',clock_timestamp()+make_interval(secs=>lease));
 elsif p_action in ('heartbeat','finish') then
  if j->>'status'<>'running' or token is null or j->>'claimToken' is distinct from token or (j->>'leaseUntil')::timestamptz<=clock_timestamp() then raise exception 'render_lease_stale';end if;
  if p_action='heartbeat' then
   lease:=(p_command->>'leaseSeconds')::integer;if lease is null or lease not between 30 and 900 or public.director_render_scope_current(j->'scope') is not true then raise exception 'render_lease_or_approval_stale';end if;
   j:=j||jsonb_build_object('leaseUntil',clock_timestamp()+make_interval(secs=>lease));
  elsif p_command->'outcome'->>'status'='unknown' then
   if p_command->'outcome' ? 'actualMicroUsd' then
    cost:=(p_command->'outcome'->>'actualMicroUsd')::numeric;if cost is null or cost<0 or cost>9007199254740991 or mod(cost,1)<>0 then raise exception 'render_settlement_invalid';end if;
    j:=j||jsonb_build_object('actualMicroUsd',cost,'overrun',cost>(j->'quote'->>'maxMicroUsd')::numeric);
   end if;
   j:=j||jsonb_build_object('status','unknown','claimToken',null,'leaseUntil',null,'finishedAt',clock_timestamp());
  else
   a:=p_command->'outcome'->'asset';cost:=(p_command->'outcome'->>'actualMicroUsd')::numeric;s:=j->'scope'->'manifest';
   if public.director_render_scope_current(j->'scope') is not true or p_command->'outcome'->>'status' is distinct from 'completed' or a->>'id' is distinct from j->>'id' or a->>'projectId' is distinct from p.id::text or a->>'mime' is distinct from 'video/mp4' or a->>'bucket' is distinct from 'director-source-media' or a->>'storageKey' is distinct from p.owner_id::text||'/'||p.id::text||'/'||(j->>'id') or coalesce(a->>'size','') !~ '^[0-9]+$' or (a->>'size')::numeric not between 1 and 134217728 or coalesce(a->>'checksum','') !~ '^[a-f0-9]{64}$' or a->>'checksumAlgorithm' is distinct from 'sha256-bytes' or a->'generated'->>'kind' is distinct from 'finished_movie' or a->'generated'->>'renderId' is distinct from j->>'id' or a->'generated'->>'masterChecksum' is distinct from s->'master'->>'checksum' or a->'masterBytesUnchanged' is distinct from 'true'::jsonb or a->>'technicalValidation' is distinct from 'passed' or a->'streams'->'video'->>'codec' is distinct from 'h264' or a->'streams'->'audio'->>'codec' is distinct from 'aac' or a->'streams'->'video'->'frameCount' is distinct from s->'totalFrames' or a->'streams'->'video'->'width' is distinct from s->'width' or a->'streams'->'video'->'height' is distinct from s->'height' or coalesce(a->>'durationSeconds','') !~ '^[0-9]+(\.[0-9]+)?$' or abs((a->>'durationSeconds')::numeric-((s->'range'->>'endMs')::numeric-(s->'range'->>'startMs')::numeric)/1000)>greatest(0.1,1/(s->>'fps')::numeric) or cost is null or cost<0 or cost>9007199254740991 or mod(cost,1)<>0 then raise exception 'render_result_invalid';end if;
   insert into public.director_assets(id,project_id,kind,storage_key,metadata,rights_evidence) values((a->>'id')::uuid,p.id,'video/mp4',a->>'storageKey',a,'{"status":"supplied-media-assembly-unverified-creative-quality"}');
   j:=j||jsonb_build_object('status','completed','result',a,'actualMicroUsd',cost,'overrun',cost>(j->'quote'->>'maxMicroUsd')::numeric,'claimToken',null,'leaseUntil',null,'finishedAt',clock_timestamp());
  end if;
 else raise exception 'render_command_invalid';end if;
 update public.director_render_jobs set document=j where id=(j->>'id')::uuid;return j;
end $$;

-- Shared project lock guards BOTH media and render inserts. Truthful settlement
-- updates remain allowed, even when actual incurred charges exceed a quote/cap.
create function public.director_guard_render_budget() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; used numeric; additional numeric;
begin
 if tg_table_name='director_projects' then
  if new.budget_micro_usd=old.budget_micro_usd and new.finish_reserve_micro_usd=old.finish_reserve_micro_usd then return new;end if;
  p:=new;additional:=0;
 else
  select * into p from public.director_projects where id=new.project_id for update;
  if tg_table_name='director_jobs' then additional:=new.reserved_micro_usd;else additional:=(new.document->'quote'->>'maxMicroUsd')::numeric;end if;
 end if;
 select coalesce(sum(case charge_state when 'settled' then actual_micro_usd when 'held' then reserved_micro_usd when 'unknown' then reserved_micro_usd else 0 end),0) into used from public.director_jobs where project_id=p.id;
 used:=used+public.director_render_exposure(p.id);
 if used+additional+p.finish_reserve_micro_usd>p.budget_micro_usd then raise exception 'render_project_spending_cap_exceeded';end if;return new;
end $$;
create trigger director_media_render_cap before insert on public.director_jobs for each row execute function public.director_guard_render_budget();
create trigger director_render_cap before insert on public.director_render_jobs for each row execute function public.director_guard_render_budget();
create trigger director_render_budget_lowering before update of budget_micro_usd,finish_reserve_micro_usd on public.director_projects for each row execute function public.director_guard_render_budget();
revoke all on function public.director_render_project_snapshot(jsonb,jsonb,jsonb,boolean),public.director_release_unclaimed_render(jsonb,text),public.director_render_exposure(uuid),public.director_render_budget_snapshot(uuid,uuid),public.director_render_scope_current(jsonb),public.director_render_command(text,jsonb),public.director_guard_render_budget() from public,anon,authenticated;
grant execute on function public.director_render_project_snapshot(jsonb,jsonb,jsonb,boolean),public.director_release_unclaimed_render(jsonb,text),public.director_render_exposure(uuid),public.director_render_budget_snapshot(uuid,uuid),public.director_render_scope_current(jsonb),public.director_render_command(text,jsonb),public.director_guard_render_budget() to service_role;
commit;

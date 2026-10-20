-- Additive schema source, after director-media-ingestion.sql. Not auto-applied.
-- No worker receives database credentials. Only the trusted service coordinator
-- calls claim/finish; the isolated decoder receives a scoped source download.
begin;
create table public.director_source_inspections (
 upload_id uuid primary key references public.director_source_uploads(id),
 owner_id uuid not null references auth.users(id),
 project_id uuid not null references public.director_projects(id),
 source_document jsonb not null,
 status text not null default 'queued' check(status in ('queued','running','passed','held')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 claim_token uuid,
 used_tokens uuid[] not null default '{}',
 lease_until timestamptz,
 result jsonb,
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 check ((status='running')=(claim_token is not null and lease_until is not null))
);
create index director_source_inspections_pending on public.director_source_inspections(status,lease_until) where status in ('queued','running');
alter table public.director_source_inspections enable row level security;
revoke all on public.director_source_inspections from public,anon,authenticated;
grant select,insert,update on public.director_source_inspections to service_role;

create function public.director_enqueue_source_inspection()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.document->>'status'='inspection_pending' then
  insert into public.director_source_inspections(upload_id,owner_id,project_id,source_document)
  values(new.id,new.owner_id,new.project_id,new.document)
  on conflict(upload_id) do nothing;
 end if;
 return new;
end $$;
create trigger director_source_inspection_enqueue after insert or update on public.director_source_uploads
for each row execute function public.director_enqueue_source_inspection();
-- Catch transport receipts that predate installation without duplicating jobs.
insert into public.director_source_inspections(upload_id,owner_id,project_id,source_document)
select id,owner_id,project_id,document from public.director_source_uploads where document->>'status'='inspection_pending';

create function public.director_claim_source_inspection(p_upload uuid,p_token uuid,p_lease_seconds integer default 600)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.director_source_uploads; job public.director_source_inspections;
begin
 if p_token is null or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then raise exception 'inspection_claim_invalid'; end if;
 -- Always receipt then job: serialize with cancellation and finish, in one order.
 select * into receipt from public.director_source_uploads where id=p_upload for update;
 if not found then return null; end if;
 select * into job from public.director_source_inspections where upload_id=p_upload for update;
 if not found or job.status in ('passed','held') then return null; end if;
 if receipt.document->>'status'<>'inspection_pending' or (receipt.document->>'expiresAt')::timestamptz<=now()
 or receipt.document is distinct from job.source_document then
  update public.director_source_inspections set status='held',claim_token=null,lease_until=null,result='{"status":"held","code":"source_no_longer_current"}',finished_at=now() where upload_id=p_upload;
  return null;
 end if;
 if job.status='running' and job.lease_until>now() then return null; end if;
 if p_token=any(job.used_tokens) then raise exception 'inspection_claim_token_reused'; end if;
 if job.attempts>=3 then
  update public.director_source_inspections set status='held',claim_token=null,lease_until=null,result='{"status":"held","code":"inspection_attempts_exhausted"}',finished_at=now() where upload_id=p_upload;
  return null;
 end if;
 -- Rotate the private fencing token on every claim. No automatic paid retry.
 update public.director_source_inspections set status='running',attempts=attempts+1,claim_token=p_token,used_tokens=array_append(used_tokens,p_token),lease_until=now()+make_interval(secs=>p_lease_seconds) where upload_id=p_upload returning * into job;
 return jsonb_build_object('uploadId',job.upload_id,'ownerId',job.owner_id,'projectId',job.project_id,'source',job.source_document,'attempt',job.attempts,'leaseUntil',job.lease_until);
end $$;

create function public.director_finish_source_inspection(p_upload uuid,p_token uuid,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.director_source_uploads; job public.director_source_inspections; m jsonb; s jsonb; clean_streams jsonb:='[]'; audio_count integer:=0; video_count integer:=0;
begin
 select * into receipt from public.director_source_uploads where id=p_upload for update;
 if not found then raise exception 'inspection_source_missing'; end if;
 select * into job from public.director_source_inspections where upload_id=p_upload for update;
 if not found then raise exception 'inspection_job_missing'; end if;
 if job.status<>'running' or p_token is null or job.claim_token is distinct from p_token or job.lease_until<=now()
 or receipt.document->>'status'<>'inspection_pending' or (receipt.document->>'expiresAt')::timestamptz<=now()
 or receipt.document is distinct from job.source_document then raise exception 'inspection_claim_stale'; end if;
 m:=job.source_document->'manifest';
 if p_result->>'status'='held' then
  p_result:='{"status":"held","code":"source_inspection_failed"}';
 elsif (p_result->>'status'='passed' and p_result->>'inspectionVersion'='director-source-inspection-v1'
 and p_result->'assetPublished'='false'::jsonb and p_result->'decodeVerified'='true'::jsonb
 and p_result->>'checksumAlgorithm'='sha256-bytes' and p_result->'sha256'=m->'sha256'
 and p_result->'mime'=m->'mime' and p_result->'size'=m->'size'
 and jsonb_typeof(p_result->'durationSeconds')='number' and (p_result->>'durationSeconds')::numeric>0 and (p_result->>'durationSeconds')::numeric<=1800
 and jsonb_typeof(p_result->'streams')='array' and jsonb_array_length(p_result->'streams') between 1 and 8) is true then
  for s in select value from jsonb_array_elements(p_result->'streams') loop
   if s->>'type'='audio' then
    audio_count:=audio_count+1;
    if (jsonb_typeof(s->'sampleRate')='number' and (s->>'sampleRate')::numeric between 8000 and 192000 and mod((s->>'sampleRate')::numeric,1)=0
    and jsonb_typeof(s->'channels')='number' and (s->>'channels')::numeric between 1 and 8 and mod((s->>'channels')::numeric,1)=0
    and case m->>'mime' when 'audio/mpeg' then s->>'codec'='mp3' when 'audio/wav' then s->>'codec' in ('pcm_s16le','pcm_s24le','pcm_s32le','pcm_f32le','pcm_f64le','pcm_u8','pcm_alaw','pcm_mulaw','adpcm_ima_wav') else s->>'codec' in ('aac','mp3','alac','ac3','opus','flac') end) is not true then raise exception 'inspection_result_invalid'; end if;
    clean_streams:=clean_streams||jsonb_build_array(jsonb_build_object('type','audio','codec',s->>'codec','sampleRate',s->'sampleRate','channels',s->'channels'));
   elsif s->>'type'='video' then
    video_count:=video_count+1;
    if (m->>'mime'='video/mp4' and s->>'codec' in ('h264','hevc','av1','vp9','mpeg4')
    and jsonb_typeof(s->'width')='number' and (s->>'width')::numeric between 1 and 4096 and mod((s->>'width')::numeric,1)=0
    and jsonb_typeof(s->'height')='number' and (s->>'height')::numeric between 1 and 4096 and mod((s->>'height')::numeric,1)=0
    and (s->>'width')::numeric*(s->>'height')::numeric<=8847360
    and jsonb_typeof(s->'framesPerSecond')='number' and (s->>'framesPerSecond')::numeric>0 and (s->>'framesPerSecond')::numeric<=120) is not true then raise exception 'inspection_result_invalid'; end if;
    clean_streams:=clean_streams||jsonb_build_array(jsonb_build_object('type','video','codec',s->>'codec','width',s->'width','height',s->'height','framesPerSecond',s->'framesPerSecond'));
   else raise exception 'inspection_result_invalid'; end if;
  end loop;
  if (case when m->>'mime'='video/mp4' then video_count<>1 else audio_count<>1 or video_count<>0 end) then raise exception 'inspection_result_invalid'; end if;
  p_result:=jsonb_build_object('status','passed','inspectionVersion','director-source-inspection-v1','assetPublished',false,'decodeVerified',true,'checksumAlgorithm','sha256-bytes','sha256',m->'sha256','size',m->'size','mime',m->'mime','durationSeconds',p_result->'durationSeconds','streams',clean_streams);
 else raise exception 'inspection_result_invalid'; end if;
 update public.director_source_inspections set status=p_result->>'status',result=p_result,claim_token=null,lease_until=null,finished_at=now() where upload_id=p_upload;
 -- Inspection success is not publication. Never create a ready asset here.
 return jsonb_build_object('uploadId',p_upload,'status',p_result->>'status','assetPublished',false);
end $$;
revoke all on function public.director_enqueue_source_inspection(),public.director_claim_source_inspection(uuid,uuid,integer),public.director_finish_source_inspection(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.director_enqueue_source_inspection(),public.director_claim_source_inspection(uuid,uuid,integer),public.director_finish_source_inspection(uuid,uuid,jsonb) to service_role;
commit;

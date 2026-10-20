-- Additive schema source after director-source-inspection-jobs.sql.
-- Reuse the exact inspected private object; do not copy or re-encode the master.
begin;
create table public.director_source_publications (
 upload_id uuid primary key references public.director_source_uploads(id),
 project_id uuid not null references public.director_projects(id),
 asset_id uuid not null unique,
 created_at timestamptz not null default now(),
 foreign key(project_id,asset_id) references public.director_assets(project_id,id)
);
alter table public.director_source_publications enable row level security;
revoke all on public.director_source_publications from public,anon,authenticated;
grant select,insert on public.director_source_publications to service_role;

create function public.director_publish_source_asset(p_actor uuid,p_project uuid,p_upload uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.director_source_uploads; job public.director_source_inspections; project public.director_projects; asset public.director_assets; m jsonb; metadata jsonb;
begin
 select * into project from public.director_projects where id=p_project and owner_id=p_actor for update;
 if not found then raise exception 'source_upload_missing'; end if;
 select * into receipt from public.director_source_uploads where id=p_upload and project_id=p_project and owner_id=p_actor for update;
 if not found then raise exception 'source_upload_missing'; end if;
 select a.* into asset from public.director_source_publications p join public.director_assets a on a.project_id=p.project_id and a.id=p.asset_id where p.upload_id=p_upload;
 if found then return asset.metadata; end if;
 select * into job from public.director_source_inspections where upload_id=p_upload for update;
 if not found or job.status<>'passed' or job.source_document is distinct from receipt.document
 or receipt.document->>'status'<>'inspection_pending' or (receipt.document->>'expiresAt')::timestamptz<=now()
 then raise exception 'source_upload_inspection_pending'; end if;
 m:=receipt.document->'manifest';
 if job.result->>'sha256' is distinct from m->>'sha256' or job.result->'size' is distinct from m->'size'
 or job.result->'mime' is distinct from m->'mime' or job.result->'decodeVerified' is distinct from 'true'::jsonb
 or job.result->>'inspectionVersion' is distinct from 'director-source-inspection-v1'
 or receipt.document->>'storageKey' is distinct from p_actor::text||'/'||p_project::text||'/'||p_upload::text
 or receipt.document->>'bucket' is distinct from 'director-source-media'
 then raise exception 'source_upload_inspection_invalid'; end if;
 if m->>'scope'='shot' and not exists(select 1 from jsonb_array_elements(coalesce(project.brief->'shots','[]')) s where s->>'id'=m->>'shotId')
 then raise exception 'source_upload_shot_changed'; end if;
 metadata:=jsonb_build_object('id',p_upload,'projectId',p_project,'name',m->>'name','mime',m->>'mime','role',m->>'role','scope',m->>'scope','shotId',m->'shotId','version',1,
 'storageKey',receipt.document->>'storageKey','bucket','director-source-media','size',m->'size','checksum',m->>'sha256','checksumAlgorithm','sha256-bytes',
 'sourceUploadId',p_upload,'inspectionVersion',job.result->>'inspectionVersion','durationSeconds',job.result->'durationSeconds','streams',job.result->'streams','decodeVerified',true);
 insert into public.director_assets(id,project_id,kind,storage_key,metadata,rights_evidence)
 values(p_upload,p_project,m->>'mime',receipt.document->>'storageKey',metadata,'{"status":"user-supplied-unverified"}');
 insert into public.director_source_publications(upload_id,project_id,asset_id) values(p_upload,p_project,p_upload);
 return metadata;
end $$;
revoke all on function public.director_publish_source_asset(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.director_publish_source_asset(uuid,uuid,uuid) to service_role;
commit;

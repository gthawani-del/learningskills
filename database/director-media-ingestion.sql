-- Additive schema source. Install through the existing reviewed migration process.
-- No existing bucket/policy is widened; no model or generation control changes.
begin;
create table public.director_source_uploads (
 id uuid primary key,
 project_id uuid not null references public.director_projects(id),
 owner_id uuid not null references auth.users(id),
 request_id uuid not null,
 document jsonb not null,
 created_at timestamptz not null default now(),
 unique(project_id,request_id),
 check(document->>'id'=id::text and document->>'projectId'=project_id::text and document->>'ownerId'=owner_id::text),
 check(document->>'status' in ('uploading','inspection_pending','cancelled'))
);
create index director_source_uploads_project on public.director_source_uploads(project_id,created_at desc);
alter table public.director_source_uploads enable row level security;
revoke all on public.director_source_uploads from public,anon,authenticated;
grant select,insert,update on public.director_source_uploads to service_role;

create function public.director_create_source_upload(p_actor uuid,p_project uuid,p_document jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior jsonb; active_count bigint; active_bytes bigint; m jsonb:=p_document->'manifest';
begin
 perform 1 from public.director_projects where id=p_project and owner_id=p_actor for update;
 if not found then raise exception 'not_project_owner'; end if;
 if p_document->>'ownerId' is distinct from p_actor::text or p_document->>'projectId' is distinct from p_project::text
 or p_document->>'bucket' is distinct from 'director-source-media'
 or p_document->>'status' is distinct from 'uploading'
 or p_document->>'storageKey' is distinct from p_actor::text||'/'||p_project::text||'/'||(p_document->>'id')
 or coalesce(p_document->>'manifestHash','') !~ '^[a-f0-9]{64}$'
 or coalesce(m->>'sha256','') !~ '^[a-f0-9]{64}$'
 or coalesce(m->>'mime','') not in ('audio/wav','audio/mpeg','video/mp4')
 or coalesce(m->>'role','') not in ('master_song','dialogue','voice_reference','ambience','shot_reference')
 or coalesce(m->>'scope','') not in ('project','shot')
 or coalesce(length(m->>'name'),0) not between 1 and 240
 or coalesce(m->>'size','') !~ '^[0-9]+$'
 then raise exception 'source_upload_invalid'; end if;
 if (m->>'size')::bigint not between 1 and 134217728
 or p_document->>'expiresAt' is null
 or (p_document->>'expiresAt')::timestamptz<=now()
 or (p_document->>'expiresAt')::timestamptz>now()+interval '25 hours'
 then raise exception 'source_upload_invalid'; end if;
 select document into prior from public.director_source_uploads where project_id=p_project and request_id=(p_document->>'requestId')::uuid;
 if found then
  if prior->'manifest' is distinct from m then raise exception 'source_upload_conflict'; end if;
  return prior;
 end if;
 select count(*),coalesce(sum((document->'manifest'->>'size')::bigint),0) into active_count,active_bytes
 from public.director_source_uploads where project_id=p_project and document->>'status'<>'cancelled' and (document->>'expiresAt')::timestamptz>now();
 if active_count>=10 or active_bytes+(m->>'size')::bigint>536870912 then raise exception 'source_upload_capacity'; end if;
 insert into public.director_source_uploads(id,project_id,owner_id,request_id,document)
 values((p_document->>'id')::uuid,p_project,p_actor,(p_document->>'requestId')::uuid,p_document);
 return p_document;
end $$;
create function public.director_transition_source_upload(p_actor uuid,p_project uuid,p_upload uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare doc jsonb;
begin
 perform 1 from public.director_projects where id=p_project and owner_id=p_actor for update;
 if not found then raise exception 'not_project_owner'; end if;
 select document into doc from public.director_source_uploads where id=p_upload and project_id=p_project and owner_id=p_actor for update;
 if not found then raise exception 'source_upload_missing'; end if;
 if p_status not in ('inspection_pending','cancelled') or p_status is null
 or (doc->>'status'<>p_status and doc->>'status'<>'uploading' and p_status<>'cancelled')
 then raise exception 'source_upload_conflict'; end if;
 doc:=jsonb_set(doc,'{status}',to_jsonb(p_status));
 update public.director_source_uploads set document=doc where id=p_upload;
 return doc;
end $$;
revoke all on function public.director_create_source_upload(uuid,uuid,jsonb),public.director_transition_source_upload(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.director_create_source_upload(uuid,uuid,jsonb),public.director_transition_source_upload(uuid,uuid,uuid,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('director-source-media','director-source-media',false,134217728,array['audio/wav','audio/mpeg','video/mp4']);
commit;

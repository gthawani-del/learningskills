begin;
create function public.director_save_project(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_document jsonb,p_artifacts jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.director_projects; a jsonb; existing_hash text;
begin
 select * into p from public.director_projects where id=p_project_id for update;
 if p.id is null or p.owner_id<>p_actor_id or p_actor_id is null then raise exception 'not_project_owner'; end if;
 if (p.brief->>'version')::integer<>p_expected_version or (p_document->>'version')::integer<>p_expected_version+1 then raise exception 'project_version_conflict'; end if;
 if p_document->>'ownerId'<>p_actor_id::text or p_document->>'id'<>p_project_id::text then raise exception 'project_identity_conflict'; end if;
 update public.director_projects set title=p_document->>'title',stage=p_document->>'stage',brief=p_document where id=p.id;
 for a in select * from jsonb_array_elements(p_artifacts) loop
 select content_hash into existing_hash from public.director_artifacts where project_id=p.id and logical_key=a->>'logical_key' and version=(a->>'version')::integer;
 if found then
 if existing_hash<>a->>'content_hash' then raise exception 'immutable_artifact_conflict'; end if;
 else
 insert into public.director_artifacts(project_id,kind,logical_key,version,content,content_hash)
 values(p.id,a->>'kind',a->>'logical_key',(a->>'version')::integer,a->'content',a->>'content_hash');
 end if;
 end loop;
 insert into public.director_audit_events(project_id,actor_id,event_type,details) values(p.id,p_actor_id,'project_saved',jsonb_build_object('version',p_document->'version'));
end $$;
revoke all on function public.director_save_project(uuid,uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.director_save_project(uuid,uuid,integer,jsonb,jsonb) to service_role;
-- All writes use the server authorization/validation path; direct owner updates could skip
-- immutable snapshots and are removed. Owner SELECT stays governed by RLS.
revoke insert(id,owner_id,title,brief,stage), update(title,brief,stage) on public.director_projects from authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('director-media','director-media',false,2097152,array['image/jpeg','image/png','image/webp','video/mp4','audio/wav','audio/mpeg','application/pdf','text/plain','text/markdown']);
-- No public/tenant storage policy is added. Verified server requests authorize every download.
commit;

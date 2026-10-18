begin;
create function public.director_record_version_is_current(p_document jsonb,p_record_id text,p_version integer,p_path text[] default '{}')
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb; snapshot jsonb; dep jsonb;
begin
 if p_record_id is null or p_version is null or p_version<1 or p_record_id=any(p_path) or cardinality(p_path)>200 then return false; end if;
 select value into r from jsonb_array_elements(coalesce(p_document->'production'->'records','[]'::jsonb)) where value->>'id'=p_record_id;
 if r is null or (r->>'currentVersion')::integer is distinct from p_version then return false; end if;
 select value into snapshot from jsonb_array_elements(r->'versions') where (value->>'version')::integer=p_version;
 if snapshot is null then return false; end if;
 for dep in select value from jsonb_array_elements(coalesce(snapshot->'dependencies','[]'::jsonb)) loop
 if not public.director_record_version_is_current(p_document,dep->>'recordId',(dep->>'version')::integer,p_path||p_record_id) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.director_record_version_is_current(jsonb,text,integer,text[]) from public,anon,authenticated;
grant execute on function public.director_record_version_is_current(jsonb,text,integer,text[]) to service_role;
create function public.director_document_artifact_is_current(p_document jsonb,p_key text,p_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare s jsonb; binding jsonb;
begin
 if p_key is null or p_version is null or p_version<1 then return false; end if;
 if p_key='story' then return coalesce((p_document->'story'->>'version')::integer=p_version,false); end if;
 if left(p_key,7)='record:' then return public.director_record_version_is_current(p_document,substr(p_key,8),p_version); end if;
 select value into s from jsonb_array_elements(coalesce(p_document->'shots','[]'::jsonb)) where value->>'id'=p_key and (value->>'version')::integer=p_version;
 if s is null then return false; end if;
 for binding in select value from jsonb_array_elements(coalesce(s->'productionBindings','[]'::jsonb)) loop
 if not public.director_record_version_is_current(p_document,binding->>'recordId',(binding->>'version')::integer) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.director_document_artifact_is_current(jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.director_document_artifact_is_current(jsonb,text,integer) to service_role;
create or replace function public.director_artifact_is_current(p_project_id uuid,p_artifact_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select public.director_document_artifact_is_current(p.brief,a.logical_key,a.version)
 from public.director_projects p join public.director_artifacts a on a.project_id=p.id
 where p.id=p_project_id and a.id=p_artifact_id),false);
$$;
revoke all on function public.director_artifact_is_current(uuid,uuid) from public,anon,authenticated;
grant execute on function public.director_artifact_is_current(uuid,uuid) to service_role;
commit;

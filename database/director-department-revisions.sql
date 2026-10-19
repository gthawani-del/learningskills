-- Additive department dependency pins and targeted department revision requests.
-- Supabase CLI discovery returned unavailable in this workspace; keep the reviewed
-- named SQL source for the repository's native-MCP migration application workflow.
-- Requires director-department-planning.sql. No model/route activation or spending.
begin;

create function public.director_department_dependency_ids(p_department_id text)
returns text[] language sql immutable security invoker set search_path='' as $$
 select case p_department_id
 when 'producing' then array['script_breakdown'] when 'direction' then array['script_breakdown'] when 'script_breakdown' then array['rights']
 when 'casting' then array['script_breakdown','rights'] when 'look' then array['casting','direction'] when 'locations' then array['script_breakdown','direction']
 when 'camera' then array['direction','locations','look'] when 'lighting' then array['locations','camera','look']
 when 'voice' then array['script_breakdown','casting','direction','rights'] when 'sound' then array['script_breakdown','direction','voice'] when 'music' then array['direction','rights']
 when 'continuity' then array['script_breakdown','casting','look','locations','camera','lighting']
 when 'storyboard' then array['direction','casting','look','locations','camera','lighting','voice','continuity']
 when 'animatic' then array['storyboard','voice','music','sound'] when 'vfx' then array['storyboard','animatic','continuity']
 when 'editorial' then array['animatic','vfx','sound','music','continuity','producing'] when 'rights' then array[]::text[] else null end;
$$;

-- Retain the reviewed source-only predicate as an internal building block. The
-- public currentness helper below adds exact, recursively current dependency pins.
do $$
declare definition text;anchor text:='public.director_department_snapshot_current(';
begin
 definition=pg_get_functiondef('public.director_department_snapshot_current(jsonb,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'department_dependency_source_baseline_mismatch';end if;
 execute replace(definition,anchor,'public.director_department_source_current(');
end $$;

create function public.director_department_dependencies_current(p_document jsonb,p_department_id text,p_version integer,p_path text[] default '{}')
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'departmentPlanning';department jsonb;snapshot jsonb;context jsonb;binding jsonb;expected text[];k text;ordinal integer;pinned integer;queue jsonb;item jsonb;cursor_index integer:=0;department_id text;version_number integer;path text[];validated text[]:='{}';visit_key text;
begin
 if p_path is null or cardinality(p_path)>17 then return false;end if;
 queue=jsonb_build_array(jsonb_build_object('departmentId',p_department_id,'version',p_version,'path',to_jsonb(p_path)));
 while cursor_index<jsonb_array_length(queue) loop
 if cursor_index>300 then return false;end if;
 item=queue->cursor_index;cursor_index=cursor_index+1;department_id=item->>'departmentId';version_number=(item->>'version')::integer;select coalesce(array_agg(x.value),'{}'::text[]) into path from jsonb_array_elements_text(item->'path') x(value);
 expected=public.director_department_dependency_ids(department_id);
 if expected is null or version_number is null or version_number<1 or department_id=any(path) or cardinality(path)>17 then return false;end if;
 visit_key=department_id||'@'||version_number::text;if visit_key=any(validated) then continue;end if;
 if cardinality(validated)>=17 or not public.director_department_source_current(p_document,department_id,version_number) then return false;end if;
 validated=array_append(validated,visit_key);
 select d.value into department from jsonb_array_elements(archive->'departments') d where d.value->>'id'=department_id;
 select v.value into snapshot from jsonb_array_elements(department->'versions') v where v.value->'version'=to_jsonb(version_number);
 if jsonb_typeof(department->'currentVersion') is distinct from 'number' or (department->>'currentVersion')::numeric not between 1 and 100 or (department->>'currentVersion')::numeric<>trunc((department->>'currentVersion')::numeric) or (department->>'currentVersion')::numeric is distinct from version_number::numeric or jsonb_typeof(snapshot->'sourceVersion') is distinct from 'number' or (snapshot->>'sourceVersion')::numeric not between 1 and 50 or (snapshot->>'sourceVersion')::numeric<>trunc((snapshot->>'sourceVersion')::numeric) then return false;end if;
 context=snapshot->'dependencyContext';
 if jsonb_typeof(context) is distinct from 'object' or not(context ?& array['policyVersion','bindings']) or context->>'policyVersion' is distinct from 'director-department-dependencies-v1' or jsonb_typeof(context->'bindings') is distinct from 'array' or jsonb_array_length(context->'bindings')<>cardinality(expected) then return false;end if;
 for k in select jsonb_object_keys(context) loop if k not in('policyVersion','bindings') then return false;end if;end loop;
 ordinal=0;for binding in select value from jsonb_array_elements(context->'bindings') loop
 ordinal=ordinal+1;
 if jsonb_typeof(binding) is distinct from 'object' or not(binding ?& array['departmentId','version']) or binding->>'departmentId' is distinct from expected[ordinal] or jsonb_typeof(binding->'version') is distinct from 'number' or (binding->>'version')::numeric not between 1 and 100 or (binding->>'version')::numeric<>trunc((binding->>'version')::numeric) then return false;end if;
 for k in select jsonb_object_keys(binding) loop if k not in('departmentId','version') then return false;end if;end loop;
 pinned=(binding->>'version')::integer;
 queue=queue||jsonb_build_array(jsonb_build_object('departmentId',binding->>'departmentId','version',pinned,'path',to_jsonb(path||department_id)));
 end loop;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
create or replace function public.director_department_snapshot_current(p_document jsonb,p_department_id text,p_version integer)
returns boolean language sql immutable security invoker set search_path='' as $$
 select public.director_department_dependencies_current(p_document,p_department_id,p_version,'{}'::text[]);
$$;

create function public.director_department_revision_source_current(p_document jsonb,p_source_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'departmentPlanning';source jsonb;brief jsonb;screenplay jsonb;expected jsonb;n integer;
begin
 if p_source_version is null or p_source_version<1 or jsonb_typeof(archive->'sources') is distinct from 'array' or jsonb_typeof(p_document->'creativeBrief'->'versions') is distinct from 'array' or jsonb_typeof(p_document->'screenplay'->'versions') is distinct from 'array' then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,source from jsonb_array_elements(archive->'sources') s where s.value->'version'=to_jsonb(p_source_version);if n<>1 or jsonb_typeof(source->'inputSignature') is distinct from 'string' then return false;end if;
 select count(*),min(b.value::text)::jsonb into n,brief from jsonb_array_elements(p_document->'creativeBrief'->'versions') b where b.value->'version'=p_document->'creativeBrief'->'currentVersion';if n<>1 then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,screenplay from jsonb_array_elements(p_document->'screenplay'->'versions') s where s.value->'version'=p_document->'screenplay'->'currentVersion';if n<>1 then return false;end if;
 expected=jsonb_build_object('project',jsonb_build_object('premise',coalesce(nullif(p_document->'premise','null'::jsonb),'""'::jsonb),'direction',coalesce(nullif(p_document->'direction','null'::jsonb),'""'::jsonb),'language',coalesce(nullif(p_document->'language','null'::jsonb),'""'::jsonb),'duration',coalesce(p_document->'duration','null'::jsonb),'format',coalesce(nullif(p_document->'format','null'::jsonb),'""'::jsonb)),'brief',jsonb_build_object('version',brief->'version','fields',brief->'fields','inputSignature',brief->'inputSignature'),'screenplay',jsonb_build_object('version',screenplay->'version','document',screenplay->'document'));
 return (source->>'inputSignature')::jsonb=expected;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_department_revision_request_current(p_document jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'departmentPlanning';requests jsonb:=archive->'revisionRequests';request jsonb;binding jsonb;department jsonb;selected jsonb;k text;department_ids text[]:=array['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights'];source_version integer;request_ordinal integer:=0;binding_ordinal integer;selected_index integer;previous_index integer;n integer;current_request boolean;
begin
 if jsonb_typeof(requests) is distinct from 'array' or jsonb_array_length(requests) not between 1 and 50 or jsonb_typeof(archive->'departments') is distinct from 'array' or jsonb_array_length(archive->'departments')<>17 or jsonb_typeof(archive->'sources') is distinct from 'array' then return false;end if;
 for request in select value from jsonb_array_elements(requests) loop
 request_ordinal=request_ordinal+1;current_request=request_ordinal=jsonb_array_length(requests);
 if jsonb_typeof(request) is distinct from 'object' or not(request ?& array['version','departmentIds','instruction','sourceVersion','departmentVersions','createdAt']) or request->'version' is distinct from to_jsonb(request_ordinal) or jsonb_typeof(request->'departmentIds') is distinct from 'array' or jsonb_array_length(request->'departmentIds') not between 1 and 17 or jsonb_typeof(request->'instruction') is distinct from 'string' or length(btrim(request->>'instruction')) not between 1 and 4000 or jsonb_typeof(request->'sourceVersion') is distinct from 'number' or (request->>'sourceVersion')::numeric not between 1 and 50 or (request->>'sourceVersion')::numeric<>trunc((request->>'sourceVersion')::numeric) or jsonb_typeof(request->'departmentVersions') is distinct from 'array' or jsonb_array_length(request->'departmentVersions')<>17 or jsonb_typeof(request->'createdAt') is distinct from 'string' then return false;end if;
 for k in select jsonb_object_keys(request) loop if k not in('version','departmentIds','instruction','sourceVersion','departmentVersions','createdAt') then return false;end if;end loop;
 perform (request->>'createdAt')::timestamptz;
 source_version=(request->>'sourceVersion')::integer;
 select count(*) into n from jsonb_array_elements(archive->'sources') s where s.value->'version'=to_jsonb(source_version);if n<>1 or current_request and not public.director_department_revision_source_current(p_document,source_version) then return false;end if;
 previous_index=0;
 for selected in select value from jsonb_array_elements(request->'departmentIds') loop
 if jsonb_typeof(selected) is distinct from 'string' then return false;end if;selected_index=array_position(department_ids,selected #>> '{}');if selected_index is null or selected_index<=previous_index then return false;end if;previous_index=selected_index;
 end loop;
 binding_ordinal=0;
 for binding in select value from jsonb_array_elements(request->'departmentVersions') loop
 binding_ordinal=binding_ordinal+1;
 if jsonb_typeof(binding) is distinct from 'object' or not(binding ?& array['departmentId','version']) or binding->>'departmentId' is distinct from department_ids[binding_ordinal] or jsonb_typeof(binding->'version') is distinct from 'number' or (binding->>'version')::numeric not between 1 and 100 or (binding->>'version')::numeric<>trunc((binding->>'version')::numeric) then return false;end if;
 for k in select jsonb_object_keys(binding) loop if k not in('departmentId','version') then return false;end if;end loop;
 select count(*),min(d.value::text)::jsonb into n,department from jsonb_array_elements(archive->'departments') d where d.value->>'id'=binding->>'departmentId';if n<>1 or jsonb_typeof(department->'versions') is distinct from 'array' then return false;end if;
 select count(*) into n from jsonb_array_elements(department->'versions') v where v.value->'version'=binding->'version';if n<>1 or current_request and department->'currentVersion' is distinct from binding->'version' then return false;end if;
 end loop;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then return false;
end $$;

create function public.director_guard_department_revision_request() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;c public.director_planning_consents;input jsonb;planning jsonb;revision jsonb;latest_request jsonb;unit jsonb;department jsonb;snapshot jsonb;department_ids text[]:=array['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights'];i integer:=0;n integer;
begin
 if new.operation is distinct from 'revise_departments' then return new;end if;
 if TG_OP='UPDATE' then if not(not old.submit_claimed and new.submit_claimed) then return new;end if;end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if p.id is null or c.id is null or new.actor_id is distinct from p.owner_id or c.actor_id is distinct from p.owner_id or c.operation is distinct from 'revise_departments' or c.department_planning_snapshot is distinct from p.brief->'departmentPlanning' or not public.director_current_brief_approved(p.id) or not public.director_current_screenplay_approved(p.id) or not public.director_department_revision_request_current(p.brief) then raise exception 'planning_department_revision_stale';end if;
 if new.request->>'version' is distinct from 'director-planning-v5' or new.request->>'operation' is distinct from 'revise_departments' or jsonb_typeof(new.request->'body'->'input') is distinct from 'string' then raise exception 'planning_department_revision_invalid';end if;
 begin input=(new.request->'body'->>'input')::jsonb;exception when invalid_text_representation then raise exception 'planning_department_revision_invalid';end;
 planning=input->'context'->'departmentPlanning';revision=planning->'revision';latest_request=p.brief->'departmentPlanning'->'revisionRequests'->-1;
 if input->>'operation' is distinct from 'revise_departments' or jsonb_typeof(planning) is distinct from 'object' or jsonb_typeof(revision) is distinct from 'object' or revision->'request' is distinct from latest_request or revision->'valid' is distinct from 'true'::jsonb or revision->>'status' is distinct from 'current' or revision->'sourceStale' is distinct from 'false'::jsonb or revision->'departmentChanges' is distinct from '[]'::jsonb or revision->'selectedDepartmentIds' is distinct from latest_request->'departmentIds' or jsonb_typeof(planning->'departments') is distinct from 'array' or jsonb_array_length(planning->'departments')<>17 then raise exception 'planning_department_revision_invalid';end if;
 for unit in select value from jsonb_array_elements(planning->'departments') loop
 i=i+1;if unit->>'id' is distinct from department_ids[i] then raise exception 'planning_department_revision_invalid';end if;
 select count(*),min(d.value::text)::jsonb into n,department from jsonb_array_elements(p.brief->'departmentPlanning'->'departments') d where d.value->>'id'=unit->>'id';
 if n<>1 then raise exception 'planning_department_revision_invalid';end if;
 select v.value into snapshot from jsonb_array_elements(department->'versions') v where v.value->'version'=department->'currentVersion';
 if unit->'current' is distinct from snapshot then raise exception 'planning_department_revision_invalid';end if;
 end loop;return new;
end $$;
create trigger current_department_revision_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_department_revision_request();
create trigger current_department_revision_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_department_revision_request();

alter table public.director_planning_reservations drop constraint director_planning_reservations_operation_check;
alter table public.director_planning_reservations add constraint director_planning_reservations_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments'));
alter table public.director_planning_consents drop constraint director_planning_consents_operation_check;
alter table public.director_planning_consents add constraint director_planning_consents_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments'));
do $$
declare definition text;operations text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'')';expanded text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'',''revise_departments'')';version_test text:='case when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end';guard_test text:='if new.operation=''plan_departments'' and (c.operation is distinct from ''plan_departments'' or';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,operations,'')))/length(operations)<>2 or (length(definition)-length(replace(definition,version_test,'')))/length(version_test)<>1 then raise exception 'department_revision_command_baseline_mismatch';end if;
 definition=replace(definition,operations,expanded);definition=replace(definition,version_test,'case when p_body->>''operation''=''revise_departments'' then ''director-planning-v5'' when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end');execute definition;
 definition=pg_get_functiondef('public.director_registry_review_ready(text,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,operations,'')))/length(operations)<>1 then raise exception 'department_revision_registry_baseline_mismatch';end if;execute replace(definition,operations,expanded);
 definition=pg_get_functiondef('public.director_guard_planning_departments()'::regprocedure);
 if (length(definition)-length(replace(definition,guard_test,'')))/length(guard_test)<>1 then raise exception 'department_revision_prerequisite_baseline_mismatch';end if;
 execute replace(definition,guard_test,'if new.operation in(''plan_departments'',''revise_departments'') and (c.operation is distinct from new.operation or');
end $$;

revoke all on function public.director_department_dependency_ids(text),public.director_department_source_current(jsonb,text,integer),public.director_department_dependencies_current(jsonb,text,integer,text[]),public.director_department_snapshot_current(jsonb,text,integer),public.director_department_revision_source_current(jsonb,integer),public.director_department_revision_request_current(jsonb),public.director_guard_department_revision_request() from public,anon,authenticated;
grant execute on function public.director_department_dependency_ids(text),public.director_department_source_current(jsonb,text,integer),public.director_department_dependencies_current(jsonb,text,integer,text[]),public.director_department_snapshot_current(jsonb,text,integer),public.director_department_revision_source_current(jsonb,integer),public.director_department_revision_request_current(jsonb),public.director_guard_department_revision_request() to service_role;
comment on function public.director_department_dependencies_current(jsonb,text,integer,text[]) is 'Exact reviewed-DAG pins, current source and recursive pinned-version freshness. Missing legacy pins require explicit review; dependency freshness never invents upstream approval authority.';
comment on function public.director_department_revision_request_current(jsonb) is 'Latest explicit revision request binds selected known departments, current source and exact versions of all 17 departments. Historical requests are retained after becoming stale.';
commit;

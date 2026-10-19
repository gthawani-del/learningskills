-- Additive department planning and source-bound, per-department approvals.
-- Requires director-registry-management.sql and director-project-persistence.sql.
-- Installs no models or live routes.
-- Request v3 remains valid for the five existing operations; v4 is only for
-- plan_departments. Known-response recovery/accounting never gains freshness gates.
begin;
alter table public.director_approvals add column department_evidence jsonb;
alter table public.director_planning_consents add column department_planning_snapshot jsonb not null default 'null';

create function public.director_department_id_valid(p_id text)
returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(p_id=any(array['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights']),false);
$$;

-- Canonical input signatures are parsed as JSONB and independently reconstructed.
-- A trusted server hash alone cannot make an old source snapshot current.
create function public.director_department_snapshot_current(p_document jsonb,p_department_id text,p_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'departmentPlanning';department jsonb;snapshot jsonb;source jsonb;brief jsonb;screenplay jsonb;expected jsonb;n integer;
begin
 if not public.director_department_id_valid(p_department_id) or p_version is null or p_version<1 or jsonb_typeof(archive) is distinct from 'object' or jsonb_typeof(archive->'sources') is distinct from 'array' or jsonb_typeof(archive->'departments') is distinct from 'array' then return false;end if;
 select count(*),min(d.value::text)::jsonb into n,department from jsonb_array_elements(archive->'departments') d where d.value->>'id'=p_department_id;
 if n<>1 or jsonb_typeof(department->'versions') is distinct from 'array' or (department->>'currentVersion')::integer is distinct from p_version then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,snapshot from jsonb_array_elements(department->'versions') s where s.value->'version'=to_jsonb(p_version);
 if n<>1 or jsonb_typeof(snapshot->'document') is distinct from 'object' or jsonb_typeof(snapshot->'sourceVersion') is distinct from 'number' or snapshot->'document'->>'applicability' is null or snapshot->'document'->>'applicability' not in('required','conditional','not_applicable') or jsonb_typeof(snapshot->'document'->'rationale') is distinct from 'string' or length(btrim(snapshot->'document'->>'rationale'))<1 then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,source from jsonb_array_elements(archive->'sources') s where s.value->'version'=snapshot->'sourceVersion';
 if n<>1 or jsonb_typeof(source->'inputSignature') is distinct from 'string' then return false;end if;
 if jsonb_typeof(p_document->'creativeBrief'->'versions') is distinct from 'array' or jsonb_typeof(p_document->'screenplay'->'versions') is distinct from 'array' then return false;end if;
 select count(*),min(b.value::text)::jsonb into n,brief from jsonb_array_elements(p_document->'creativeBrief'->'versions') b where b.value->'version'=p_document->'creativeBrief'->'currentVersion';
 if n<>1 then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,screenplay from jsonb_array_elements(p_document->'screenplay'->'versions') s where s.value->'version'=p_document->'screenplay'->'currentVersion';
 if n<>1 then return false;end if;
 expected=jsonb_build_object('project',jsonb_build_object('premise',coalesce(nullif(p_document->'premise','null'::jsonb),'""'::jsonb),'direction',coalesce(nullif(p_document->'direction','null'::jsonb),'""'::jsonb),'language',coalesce(nullif(p_document->'language','null'::jsonb),'""'::jsonb),'duration',coalesce(p_document->'duration','null'::jsonb),'format',coalesce(nullif(p_document->'format','null'::jsonb),'""'::jsonb)),'brief',jsonb_build_object('version',brief->'version','fields',brief->'fields','inputSignature',brief->'inputSignature'),'screenplay',jsonb_build_object('version',screenplay->'version','document',screenplay->'document'));
 return (source->>'inputSignature')::jsonb=expected;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

do $$
declare definition text;anchor text:='if p_key=''story'' then';
begin
 definition=pg_get_functiondef('public.director_document_artifact_is_current(jsonb,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'department_currentness_baseline_mismatch';end if;
 execute replace(definition,anchor,'if left(p_key,11)=''department:'' then return public.director_department_snapshot_current(p_document,substr(p_key,12),p_version);end if; '||anchor);
end $$;
-- Compare complete snapshot content as well as its current version/source binding.
-- An artifact with an authentic key but altered content cannot receive approval.
create or replace function public.director_artifact_is_current(p_project_id uuid,p_artifact_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select public.director_document_artifact_is_current(p.brief,a.logical_key,a.version)
 and case when a.logical_key in('brief','screenplay') then a.kind=a.logical_key and a.content=(select s.value from jsonb_array_elements(case when a.logical_key='brief' then coalesce(p.brief->'creativeBrief'->'versions','[]'::jsonb) else coalesce(p.brief->'screenplay'->'versions','[]'::jsonb) end) s where s.value->'version'=to_jsonb(a.version) limit 1)
 when left(a.logical_key,11)='department:' then a.kind='department_plan' and a.content=(select jsonb_build_object('departmentId',d.value->'id')||s.value from jsonb_array_elements(coalesce(p.brief->'departmentPlanning'->'departments','[]'::jsonb)) d cross join lateral jsonb_array_elements(coalesce(d.value->'versions','[]'::jsonb)) s where d.value->>'id'=substr(a.logical_key,12) and s.value->'version'=to_jsonb(a.version) limit 1)
 else true end from public.director_projects p join public.director_artifacts a on a.project_id=p.id where p.id=p_project_id and a.id=p_artifact_id),false);
$$;

create function public.director_guard_department_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;e jsonb:=new.department_evidence;
begin
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into a from public.director_artifacts x where x.id=new.artifact_id and x.project_id=p.id;
 if left(a.logical_key,11) is distinct from 'department:' then if e is not null then raise exception 'department_evidence_wrong_artifact';end if;return new;end if;
 if new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 if new.decision='approved' then
 if jsonb_typeof(e) is distinct from 'object' or e->'archive' is distinct from p.brief->'departmentPlanning' or e->'acknowledgePlanningOnly' is distinct from 'true'::jsonb or (e->>'expectedVersion')::integer is distinct from (p.brief->>'version')::integer or e->>'departmentId' is distinct from substr(a.logical_key,12) or (e->>'departmentVersion')::integer is distinct from a.version or not public.director_current_brief_approved(p.id) or not public.director_current_screenplay_approved(p.id) or not public.director_artifact_is_current(p.id,a.id) then raise exception 'department_review_required';end if;
 end if;return new;
end $$;
create trigger department_approval_guard before insert on public.director_approvals for each row execute function public.director_guard_department_approval();

create function public.director_approve_department(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_department_id text,p_department_version integer,p_archive jsonb,p_ack_planning_only boolean,p_decision text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;approval public.director_approvals;e jsonb;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception 'not_project_owner';end if;
 if not public.director_department_id_valid(p_department_id) or p_department_version is null or p_department_version<1 or p_decision is null or p_decision not in('approved','rejected','revoked') then raise exception 'department_decision_invalid';end if;
 if p_expected_version is null or (p.brief->>'version')::integer is distinct from p_expected_version or p.brief->'departmentPlanning' is distinct from p_archive then raise exception 'department_approval_stale';end if;
 select x.* into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='department:'||p_department_id and x.kind='department_plan' and x.version=p_department_version;
 if a.id is null then raise exception 'department_artifact_missing';end if;
 e=case when p_decision='approved' then jsonb_build_object('archive',p_archive,'departmentId',p_department_id,'departmentVersion',p_department_version,'acknowledgePlanningOnly',p_ack_planning_only,'expectedVersion',p_expected_version) else null end;
 insert into public.director_approvals(project_id,artifact_id,actor_id,decision,department_evidence) values(p.id,a.id,p_actor_id,p_decision,e) returning * into approval;
 insert into public.director_audit_events(project_id,actor_id,event_type,details) values(p.id,p_actor_id,'department_approval',jsonb_build_object('departmentId',p_department_id,'version',a.version,'decision',p_decision,'planningOnlyAcknowledged',p_ack_planning_only));
 return jsonb_build_object('id',approval.id,'projectId',p.id,'artifactId',a.logical_key,'version',a.version,'decision',p_decision,'actorId',p_actor_id,'createdAt',approval.created_at,'department',case when p_decision='approved' then jsonb_build_object('id',p_department_id,'planningOnlyAcknowledged',true) else null end);
end $$;

create function public.director_current_department_approved(p_project_id uuid,p_department_id text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;department jsonb;a public.director_artifacts;approval public.director_approvals;
begin
 if not public.director_department_id_valid(p_department_id) then return false;end if;
 select x.* into p from public.director_projects x where x.id=p_project_id;
 if p.id is null or not public.director_current_brief_approved(p.id) or not public.director_current_screenplay_approved(p.id) then return false;end if;
 select d.value into department from jsonb_array_elements(coalesce(p.brief->'departmentPlanning'->'departments','[]'::jsonb)) d where d.value->>'id'=p_department_id;
 select x.* into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='department:'||p_department_id and x.kind='department_plan' and x.version=(department->>'currentVersion')::integer;
 if a.id is null or not public.director_artifact_is_current(p.id,a.id) then return false;end if;
 select x.* into approval from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 return coalesce(approval.actor_id is not distinct from p.owner_id and approval.decision is not distinct from 'approved' and approval.department_evidence->'acknowledgePlanningOnly'='true'::jsonb and approval.department_evidence->>'departmentId'=p_department_id and (approval.department_evidence->>'departmentVersion')::integer=a.version,false);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
create function public.director_current_departments_approved(p_project_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;department_id text;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id;if p.id is null then return false;end if;
 -- Existing projects without a department archive retain their prior gate.
 if not(p.brief ? 'departmentPlanning') or p.brief->'departmentPlanning'='null'::jsonb then return true;end if;
 if jsonb_typeof(p.brief->'departmentPlanning') is distinct from 'object' then return false;end if;
 foreach department_id in array array['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights'] loop
 if not public.director_current_department_approved(p.id,department_id) then return false;end if;
 end loop;return true;
end $$;
-- Approvals are append-only and do not increment the project document version.
-- Guard the review snapshot under the same project lock before invoking the
-- existing atomic document/artifact save. A newly approved unit or revocation
-- cannot be overwritten by a proposal prepared against earlier review decisions.
create function public.director_save_departments(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_expected_approval_id uuid,p_document jsonb,p_artifacts jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;latest_approval_id uuid;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception 'not_project_owner';end if;
 if p_expected_version is null or (p.brief->>'version')::integer is distinct from p_expected_version or jsonb_typeof(p_document) is distinct from 'object' or (p_document->>'version')::integer is distinct from p_expected_version+1 or jsonb_typeof(p_artifacts) is distinct from 'array' then raise exception 'department_save_version_invalid';end if;
 select a.id into latest_approval_id from public.director_approvals a where a.project_id=p.id order by a.ordinal desc limit 1;
 if latest_approval_id is distinct from p_expected_approval_id then raise exception 'department_approval_changed';end if;
 if jsonb_typeof(p.brief->'creativeBrief') is distinct from 'object' or jsonb_typeof(p.brief->'screenplay') is distinct from 'object' or coalesce((p.brief->'screenplay'->>'currentVersion')::integer,0)<1 or not public.director_current_brief_approved(p.id) or not public.director_current_screenplay_approved(p.id) then raise exception 'department_source_approval_required';end if;
 if jsonb_typeof(p_document->'departmentPlanning') is distinct from 'object' or p_document-'departmentPlanning'-'version' is distinct from p.brief-'departmentPlanning'-'version' then raise exception 'department_save_scope_invalid';end if;
 perform public.director_save_project(p_actor_id,p_project_id,p_expected_version,p_document,p_artifacts);
end $$;
-- Department plans are independently approved; another department's edit need not
-- invalidate this unchanged artifact. Source/brief/script freshness is still required.
do $$
declare definition text;anchor text:='-- The existing helper validates exact bound/dependent versions and fails closed on cycles.';
begin
 definition=pg_get_functiondef('public.director_document_approval_ready(uuid,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'department_approval_ready_baseline_mismatch';end if;
 execute replace(definition,anchor,'if left(p_logical_key,11)=''department:'' then return public.director_current_department_approved(project.id,substr(p_logical_key,12));end if; if not public.director_current_departments_approved(project.id) then return false;end if; '||anchor);
end $$;

-- A textual department approval is not approval of a visual/voice/performance
-- asset. Reject media quotations/authorization/dispatch targeting a plan itself.
do $$
declare definition text;persist_anchor text:='if a.id is null or a.content_hash is distinct from p_quote->>''artifactContentHash''';authorize_anchor text:='if a.id is null or not public.director_artifact_is_current(p.id,a.id)';job_anchor text:='if artifact.id is null or not coalesce(public.director_document_approval_ready';target_guard text:='if a.kind=''department_plan'' or left(a.logical_key,11)=''department:'' then raise exception ''department_plan_media_invalid'';end if; ';
begin
 definition=pg_get_functiondef('public.director_persist_quote(uuid,uuid,integer,uuid,text,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,persist_anchor,'')))/length(persist_anchor)<>1 then raise exception 'department_media_quote_baseline_mismatch';end if;
 execute replace(definition,persist_anchor,target_guard||persist_anchor);
 definition=pg_get_functiondef('public.director_authorize_quote(uuid,uuid,integer,uuid,text,bigint,bigint,timestamptz)'::regprocedure);
 if (length(definition)-length(replace(definition,authorize_anchor,'')))/length(authorize_anchor)<>1 then raise exception 'department_media_authorization_baseline_mismatch';end if;
 execute replace(definition,authorize_anchor,target_guard||authorize_anchor);
 definition=pg_get_functiondef('public.director_guard_recursive_job_approvals()'::regprocedure);
 if (length(definition)-length(replace(definition,job_anchor,'')))/length(job_anchor)<>1 then raise exception 'department_media_dispatch_baseline_mismatch';end if;
 execute replace(definition,job_anchor,'if artifact.id is null or artifact.kind=''department_plan'' or left(artifact.logical_key,11)=''department:'' or not coalesce(public.director_document_approval_ready');
end $$;

create function public.director_capture_planning_departments() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;
begin
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 if p.id is null or new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 new.department_planning_snapshot=coalesce(p.brief->'departmentPlanning','null'::jsonb);return new;
end $$;
create function public.director_guard_planning_departments() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;c public.director_planning_consents;
begin
 if TG_OP='UPDATE' then if not(not old.submit_claimed and new.submit_claimed) then return new;end if;end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if p.id is null or c.id is null or c.actor_id is distinct from p.owner_id or c.department_planning_snapshot is distinct from coalesce(p.brief->'departmentPlanning','null'::jsonb) then raise exception 'planning_department_scope_changed';end if;
 if new.operation='plan_departments' and (c.operation is distinct from 'plan_departments' or jsonb_typeof(p.brief->'creativeBrief') is distinct from 'object' or jsonb_typeof(p.brief->'screenplay') is distinct from 'object' or coalesce((p.brief->'screenplay'->>'currentVersion')::integer,0)<1 or not public.director_current_brief_approved(p.id) or not public.director_current_screenplay_approved(p.id)) then raise exception 'planning_department_prerequisites_required';end if;
 return new;
end $$;
create trigger capture_departments before insert on public.director_planning_consents for each row execute function public.director_capture_planning_departments();
create trigger current_departments_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_planning_departments();
create trigger current_departments_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_planning_departments();

alter table public.director_planning_reservations drop constraint director_planning_reservations_operation_check;
alter table public.director_planning_reservations add constraint director_planning_reservations_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments'));
alter table public.director_planning_consents drop constraint director_planning_consents_operation_check;
alter table public.director_planning_consents add constraint director_planning_consents_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments'));
do $$
declare definition text;operations text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'')';expanded text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'')';version_test text:='p_body->''request''->>''version'' is distinct from ''director-planning-v3''';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,operations,'')))/length(operations)<>2 or (length(definition)-length(replace(definition,version_test,'')))/length(version_test)<>1 then raise exception 'department_planning_command_baseline_mismatch';end if;
 definition=replace(definition,operations,expanded);
 definition=replace(definition,version_test,'p_body->''request''->>''version'' is distinct from (case when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end)');execute definition;
 definition=pg_get_functiondef('public.director_registry_review_ready(text,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,operations,'')))/length(operations)<>1 then raise exception 'department_registry_review_baseline_mismatch';end if;
 execute replace(definition,operations,expanded);
end $$;
revoke all on function public.director_department_id_valid(text),public.director_department_snapshot_current(jsonb,text,integer),public.director_artifact_is_current(uuid,uuid),public.director_guard_department_approval(),public.director_approve_department(uuid,uuid,integer,text,integer,jsonb,boolean,text),public.director_current_department_approved(uuid,text),public.director_current_departments_approved(uuid),public.director_save_departments(uuid,uuid,integer,uuid,jsonb,jsonb),public.director_capture_planning_departments(),public.director_guard_planning_departments() from public,anon,authenticated;
grant execute on function public.director_department_id_valid(text),public.director_department_snapshot_current(jsonb,text,integer),public.director_artifact_is_current(uuid,uuid),public.director_guard_department_approval(),public.director_approve_department(uuid,uuid,integer,text,integer,jsonb,boolean,text),public.director_current_department_approved(uuid,text),public.director_current_departments_approved(uuid),public.director_save_departments(uuid,uuid,integer,uuid,jsonb,jsonb),public.director_capture_planning_departments(),public.director_guard_planning_departments() to service_role;
comment on column public.director_approvals.department_evidence is 'Exact service-reviewed department archive at approval with explicit planning-only acknowledgement. Approval never proves casting, voice, visuals, rights or generated media have been executed.';
comment on column public.director_planning_consents.department_planning_snapshot is 'Exact department archive captured at allowance creation; changed plans hold fresh reservations/claims without preventing recovery/accounting of known provider requests.';
commit;

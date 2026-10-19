-- Additive screenplay planning and deterministic service-reviewed approval fences.
-- Requires director-structured-brief-planning.sql. No model/route activation.
-- No CLI is available in this workspace: reviewed native migration application is
-- performed separately by the parent agent, never by a browser or this proof.
begin;
alter table public.director_planning_consents add column screenplay_snapshot jsonb not null default 'null';
alter table public.director_approvals add column screenplay_evidence jsonb;

create function public.director_capture_planning_screenplay() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;
begin
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 if p.id is null or new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 new.screenplay_snapshot=coalesce(p.brief->'screenplay','null'::jsonb);return new;
end $$;
create function public.director_guard_planning_screenplay() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;c public.director_planning_consents;
begin
 if TG_OP='UPDATE' then if not(not old.submit_claimed and new.submit_claimed) then return new;end if;end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if p.id is null or c.id is null or c.actor_id is distinct from p.owner_id or c.screenplay_snapshot is distinct from coalesce(p.brief->'screenplay','null'::jsonb) then raise exception 'planning_screenplay_scope_changed';end if;
 return new;
end $$;
create trigger capture_screenplay before insert on public.director_planning_consents for each row execute function public.director_capture_planning_screenplay();
create trigger current_screenplay_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_planning_screenplay();
create trigger current_screenplay_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_planning_screenplay();
alter table public.director_planning_reservations drop constraint director_planning_reservations_operation_check;
alter table public.director_planning_reservations add constraint director_planning_reservations_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script'));
do $$
declare definition text;operations text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'')';version_test text:='''director-planning-v2''';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,operations,'')))/length(operations)<>1 or (length(definition)-length(replace(definition,version_test,'')))/length(version_test)<>1 then raise exception 'screenplay_planning_baseline_mismatch';end if;
 definition=replace(definition,operations,'not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'')');
 definition=replace(definition,version_test,'''director-planning-v3''');execute definition;
end $$;

create function public.director_screenplay_snapshot_current(p_document jsonb,p_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'screenplay';snapshot jsonb;brief jsonb:='null';expected jsonb;n integer;
begin
 if p_version is null or p_version<1 or jsonb_typeof(archive) is distinct from 'object' or jsonb_typeof(archive->'versions') is distinct from 'array' or jsonb_typeof(archive->'sources') is distinct from 'array' or (archive->>'currentVersion')::integer is distinct from p_version then return false;end if;
 select count(*) into n from jsonb_array_elements(archive->'versions') s where s.value->'version'=to_jsonb(p_version);if n<>1 then return false;end if;
 select s.value into snapshot from jsonb_array_elements(archive->'versions') s where s.value->'version'=to_jsonb(p_version);
 if jsonb_typeof(snapshot->'inputSignature') is distinct from 'string' or jsonb_typeof(snapshot->'document') is distinct from 'object' then return false;end if;
 if jsonb_typeof(p_document->'creativeBrief'->'versions')='array' then select s.value into brief from jsonb_array_elements(p_document->'creativeBrief'->'versions') s where s.value->'version'=p_document->'creativeBrief'->'currentVersion' limit 1;end if;
 expected=jsonb_build_object('project',jsonb_build_object('premise',coalesce(nullif(p_document->'premise','null'::jsonb),'""'::jsonb),'direction',coalesce(nullif(p_document->'direction','null'::jsonb),'""'::jsonb),'language',coalesce(nullif(p_document->'language','null'::jsonb),'""'::jsonb),'duration',coalesce(p_document->'duration','null'::jsonb),'format',coalesce(nullif(p_document->'format','null'::jsonb),'""'::jsonb)),'brief',coalesce(brief,'null'::jsonb),'sources',archive->'sources');
 return (snapshot->>'inputSignature')::jsonb=expected;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

-- Reconstruct only the scanner input, not its fuzzy matcher. The report is calculated
-- by trusted server code; exact locked JSON binds its result to this script/source set.
create function public.director_screenplay_report_valid(p_document jsonb,p_report jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'screenplay';snapshot jsonb;doc jsonb;parts text[]:='{}';item jsonb;line jsonb;script_text text;sources jsonb;expected jsonb;review jsonb;finding jsonb;
begin
 if jsonb_typeof(p_report) is distinct from 'object' or p_report->>'policyVersion' is distinct from 'director-originality-project-v1' or p_report->'truncated' is distinct from 'false'::jsonb or p_report->'legalClearance' is distinct from 'false'::jsonb or jsonb_typeof(p_report->'findings') is distinct from 'array' or p_report->'coverage'->>'status' is null or p_report->'coverage'->>'status' not in('project_sources_only','unavailable') or p_report->>'status' is null or p_report->>'status' not in('review_required','no_matches_within_coverage','coverage_unavailable') then return false;end if;
 select s.value into snapshot from jsonb_array_elements(archive->'versions') s where s.value->'version'=archive->'currentVersion';doc=snapshot->'document';
 parts=array[doc->>'title',doc->>'logline',doc->>'treatment'];
 for item in select value from jsonb_array_elements(doc->'characters') loop parts=parts||array[item->>'name',item->>'description'];end loop;
 for item in select value from jsonb_array_elements(doc->'scenes') loop
 parts=parts||array[item->>'heading',item->>'action'];
 for line in select value from jsonb_array_elements(item->'dialogue') loop parts=parts||array[line->>'direction',line->>'text'];end loop;
 end loop;
 select string_agg(t.value,E'\n\n' order by t.ordinality) into script_text from unnest(parts) with ordinality t(value,ordinality) where t.value is not null and t.value<>'';
 select coalesce(jsonb_agg(jsonb_build_object('id',s.value->'id','title',s.value->'title','text',s.value->'text','permittedUse',s.value->'permittedUse') order by s.ordinality),'[]'::jsonb) into sources from jsonb_array_elements(archive->'sources') with ordinality s(value,ordinality);
 expected=jsonb_build_object('policyVersion','director-originality-project-v1','text',script_text,'sources',sources);
 if jsonb_typeof(p_report->'inputSignature') is distinct from 'string' or (p_report->>'inputSignature')::jsonb is distinct from expected then return false;end if;
 select r.value into review from jsonb_array_elements(coalesce(archive->'reviews','[]'::jsonb)) with ordinality r(value,ordinality) where r.value->'screenplayVersion'=archive->'currentVersion' and r.value->>'inputSignature'=p_report->>'inputSignature' order by r.ordinality desc limit 1;
 for finding in select value from jsonb_array_elements(p_report->'findings') loop
 if jsonb_typeof(finding->'key') is distinct from 'string' or not exists(select 1 from jsonb_array_elements(coalesce(review->'dispositions','[]'::jsonb)) d where d.value->>'findingKey'=finding->>'key' and d.value->>'decision'='authorized_use' and length(btrim(d.value->>'note'))>0) then return false;end if;
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

do $$
declare definition text;anchor text:='if p_key=''story'' then';
begin
 definition=pg_get_functiondef('public.director_document_artifact_is_current(jsonb,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'screenplay_currentness_baseline_mismatch';end if;
 execute replace(definition,anchor,'if p_key=''screenplay'' then return public.director_screenplay_snapshot_current(p_document,p_version);end if; '||anchor);
end $$;
create or replace function public.director_artifact_is_current(p_project_id uuid,p_artifact_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select public.director_document_artifact_is_current(p.brief,a.logical_key,a.version)
 and case when a.logical_key in('brief','screenplay') then a.kind=a.logical_key and a.content=(select s.value from jsonb_array_elements(case when a.logical_key='brief' then coalesce(p.brief->'creativeBrief'->'versions','[]'::jsonb) else coalesce(p.brief->'screenplay'->'versions','[]'::jsonb) end) s where s.value->'version'=to_jsonb(a.version) limit 1) else true end
 from public.director_projects p join public.director_artifacts a on a.project_id=p.id where p.id=p_project_id and a.id=p_artifact_id),false);
$$;

create function public.director_guard_screenplay_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;e jsonb:=new.screenplay_evidence;
begin
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into a from public.director_artifacts x where x.id=new.artifact_id and x.project_id=p.id;
 if a.logical_key is distinct from 'screenplay' then if e is not null then raise exception 'screenplay_evidence_wrong_artifact';end if;return new;end if;
 if new.actor_id is distinct from p.owner_id or (p.brief->'screenplay'->>'currentVersion')::integer is distinct from a.version then raise exception 'screenplay_approval_stale';end if;
 if new.decision='approved' then
 if jsonb_typeof(e) is distinct from 'object' or e->'archive' is distinct from p.brief->'screenplay' or e->'acknowledgeLimitedCoverage' is distinct from 'true'::jsonb or (e->>'expectedVersion')::integer is distinct from (p.brief->>'version')::integer or not public.director_current_brief_approved(p.id) or not public.director_artifact_is_current(p.id,a.id) or not public.director_screenplay_report_valid(p.brief,e->'report') then raise exception 'screenplay_review_required';end if;
 end if;return new;
end $$;
create trigger screenplay_approval_guard before insert on public.director_approvals for each row execute function public.director_guard_screenplay_approval();

create function public.director_approve_screenplay(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_screenplay_version integer,p_archive jsonb,p_report jsonb,p_ack_limited boolean,p_decision text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;approval public.director_approvals;e jsonb;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id for update;
 if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception 'not_project_owner';end if;
 if p_decision is null or p_decision not in('approved','rejected','revoked') then raise exception 'screenplay_decision_invalid';end if;
 if (p.brief->>'version')::integer is distinct from p_expected_version or p_expected_version is null or (p.brief->'screenplay'->>'currentVersion')::integer is distinct from p_screenplay_version or p.brief->'screenplay' is distinct from p_archive then raise exception 'screenplay_approval_stale';end if;
 select x.* into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='screenplay' and x.kind='screenplay' and x.version=p_screenplay_version;
 if a.id is null then raise exception 'screenplay_artifact_missing';end if;
 e=case when p_decision='approved' then jsonb_build_object('archive',p_archive,'report',p_report,'acknowledgeLimitedCoverage',p_ack_limited,'expectedVersion',p_expected_version) else null end;
 insert into public.director_approvals(project_id,artifact_id,actor_id,decision,screenplay_evidence) values(p.id,a.id,p_actor_id,p_decision,e) returning * into approval;
 insert into public.director_audit_events(project_id,actor_id,event_type,details) values(p.id,p_actor_id,'screenplay_approval',jsonb_build_object('version',a.version,'decision',p_decision,'limitedCoverageAcknowledged',p_ack_limited));
 return jsonb_build_object('id',approval.id,'projectId',p.id,'artifactId','screenplay','version',a.version,'decision',p_decision,'actorId',p_actor_id,'createdAt',approval.created_at,'originality',case when p_decision='approved' then jsonb_build_object('policyVersion',p_report->'policyVersion','status',p_report->'status','coverage',p_report->'coverage','legalClearance',false) else null end);
end $$;

create function public.director_current_screenplay_approved(p_project_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;approval public.director_approvals;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id;if p.id is null then return false;end if;
 -- An archive with sources but no written script is not a production-ready script.
 if not(p.brief ? 'screenplay') or p.brief->'screenplay'='null'::jsonb then return true;end if;
 select x.* into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='screenplay' and x.kind='screenplay' and x.version=(p.brief->'screenplay'->>'currentVersion')::integer;
 if a.id is null or not public.director_artifact_is_current(p.id,a.id) or not public.director_current_brief_approved(p.id) then return false;end if;
 select x.* into approval from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 return coalesce(approval.actor_id is not distinct from p.owner_id and approval.decision is not distinct from 'approved' and approval.screenplay_evidence->'acknowledgeLimitedCoverage'='true'::jsonb and public.director_screenplay_report_valid(p.brief,approval.screenplay_evidence->'report'),false);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
do $$
declare definition text;anchor text:='if not public.director_current_brief_approved(p_project_id) then return false; end if;';
begin
 definition=pg_get_functiondef('public.director_document_approval_ready(uuid,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'screenplay_media_gate_baseline_mismatch';end if;
 execute replace(definition,anchor,anchor||' if not public.director_current_screenplay_approved(p_project_id) then return false;end if;');
end $$;
revoke all on function public.director_capture_planning_screenplay(),public.director_guard_planning_screenplay(),public.director_screenplay_snapshot_current(jsonb,integer),public.director_screenplay_report_valid(jsonb,jsonb),public.director_artifact_is_current(uuid,uuid),public.director_guard_screenplay_approval(),public.director_approve_screenplay(uuid,uuid,integer,integer,jsonb,jsonb,boolean,text),public.director_current_screenplay_approved(uuid) from public,anon,authenticated;
grant execute on function public.director_capture_planning_screenplay(),public.director_guard_planning_screenplay(),public.director_screenplay_snapshot_current(jsonb,integer),public.director_screenplay_report_valid(jsonb,jsonb),public.director_artifact_is_current(uuid,uuid),public.director_guard_screenplay_approval(),public.director_approve_screenplay(uuid,uuid,integer,integer,jsonb,jsonb,boolean,text),public.director_current_screenplay_approved(uuid) to service_role;
comment on column public.director_approvals.screenplay_evidence is 'Trusted server-calculated originality comparison bound to the locked script/archive and acknowledged limited coverage. No global originality or legal clearance.';
commit;

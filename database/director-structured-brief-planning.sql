-- ADDITIVE / STAGED ONLY. Structured creative brief and interpret_brief planning support.
-- Requires director-planning-consent.sql and currentness helpers. No route activation.
-- JS scope SHA256 remains a trusted-server attestation. Exact JSONB snapshots and
-- parsed canonical input signatures supply an independent database freshness fence.
begin;
alter table public.director_planning_consents add column creative_brief_snapshot jsonb not null default 'null';
comment on column public.director_planning_consents.creative_brief_snapshot is 'Exact creativeBrief archive at consent creation. Existing grants retain null and cannot authorize a changed/present brief.';

create function public.director_capture_planning_brief() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;
begin
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 if p.id is null or new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 new.creative_brief_snapshot=coalesce(p.brief->'creativeBrief','null'::jsonb);
 return new;
end $$;
create function public.director_guard_planning_brief() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;c public.director_planning_consents;
begin
 if TG_OP='UPDATE' then
 if not(not old.submit_claimed and new.submit_claimed) then return new;end if;
 end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if p.id is null or c.id is null or c.actor_id is distinct from p.owner_id or c.creative_brief_snapshot is distinct from coalesce(p.brief->'creativeBrief','null'::jsonb) then raise exception 'planning_brief_scope_changed';end if;
 return new;
end $$;
revoke all on function public.director_capture_planning_brief(),public.director_guard_planning_brief() from public,anon,authenticated;
grant execute on function public.director_capture_planning_brief(),public.director_guard_planning_brief() to service_role;
create trigger capture_creative_brief before insert on public.director_planning_consents for each row execute function public.director_capture_planning_brief();
create trigger current_creative_brief_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_planning_brief();
create trigger current_creative_brief_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_planning_brief();

alter table public.director_planning_reservations drop constraint director_planning_reservations_operation_check;
alter table public.director_planning_reservations add constraint director_planning_reservations_operation_check check(operation in('initial_plan','revise_plan','interpret_brief'));
-- Narrow source transformation of the existing reviewed command function: preserve all
-- budget, idempotency, settlement, pause and recovery behavior. Fail if baseline differs.
do $$
declare definition text;operation_test text:='not in(''initial_plan'',''revise_plan'')';version_test text:='p_body->''request''->>''version'' is distinct from ''director-planning-v1''';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,operation_test,'')))/length(operation_test)<>1 or (length(definition)-length(replace(definition,version_test,'')))/length(version_test)<>1 then raise exception 'structured_brief_migration_baseline_mismatch';end if;
 definition=replace(definition,operation_test,'not in(''initial_plan'',''revise_plan'',''interpret_brief'')');
 definition=replace(definition,version_test,'(p_body->''request''->>''version'' is distinct from ''director-planning-v2'' or p_body->''request''->>''operation'' is distinct from p_body->>''operation'')');
 execute definition;
end $$;

create function public.director_brief_snapshot_current(p_document jsonb,p_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'creativeBrief';snapshot jsonb;expected jsonb;matches integer;
begin
 if p_version is null or p_version<1 or jsonb_typeof(archive) is distinct from 'object' or jsonb_typeof(archive->'currentVersion') is distinct from 'number' or (archive->>'currentVersion')::integer is distinct from p_version or jsonb_typeof(archive->'versions') is distinct from 'array' then return false;end if;
 select count(*) into matches from jsonb_array_elements(archive->'versions') s where s.value->'version'=to_jsonb(p_version);
 if matches<>1 then return false;end if;
 select s.value into snapshot from jsonb_array_elements(archive->'versions') s where s.value->'version'=to_jsonb(p_version);
 if jsonb_typeof(snapshot->'inputSignature') is distinct from 'string' then return false;end if;
 expected=jsonb_build_object('premise',coalesce(nullif(p_document->'premise','null'::jsonb),'""'::jsonb),'direction',coalesce(nullif(p_document->'direction','null'::jsonb),'""'::jsonb),'language',coalesce(nullif(p_document->'language','null'::jsonb),'""'::jsonb),'duration',coalesce(p_document->'duration','null'::jsonb),'format',coalesce(nullif(p_document->'format','null'::jsonb),'""'::jsonb));
 return (snapshot->>'inputSignature')::jsonb=expected;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
revoke all on function public.director_brief_snapshot_current(jsonb,integer) from public,anon,authenticated;
grant execute on function public.director_brief_snapshot_current(jsonb,integer) to service_role;
-- Add the brief branch without replacing other artifact kinds or dependency semantics.
do $$
declare definition text;anchor text:='if p_key=''story'' then';
begin
 definition=pg_get_functiondef('public.director_document_artifact_is_current(jsonb,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'structured_brief_currentness_baseline_mismatch';end if;
 definition=replace(definition,anchor,'if p_key=''brief'' then return public.director_brief_snapshot_current(p_document,p_version); end if; '||anchor);
 execute definition;
end $$;
create or replace function public.director_artifact_is_current(p_project_id uuid,p_artifact_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select public.director_document_artifact_is_current(p.brief,a.logical_key,a.version)
 and case when a.logical_key='brief' then a.kind='brief' and a.content=(select s.value from jsonb_array_elements(case when jsonb_typeof(p.brief->'creativeBrief'->'versions')='array' then p.brief->'creativeBrief'->'versions' else '[]'::jsonb end) s where s.value->'version'=to_jsonb(a.version) limit 1) else true end
 from public.director_projects p join public.director_artifacts a on a.project_id=p.id where p.id=p_project_id and a.id=p_artifact_id),false);
$$;
revoke all on function public.director_artifact_is_current(uuid,uuid) from public,anon,authenticated;
grant execute on function public.director_artifact_is_current(uuid,uuid) to service_role;
create function public.director_current_brief_approved(p_project_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;a public.director_artifacts;actor uuid;decision text;
begin
 select x.* into p from public.director_projects x where x.id=p_project_id;
 if p.id is null then return false;end if;
 -- Legacy projects without any structured brief retain existing review behavior.
 if not(p.brief ? 'creativeBrief') or p.brief->'creativeBrief'='null'::jsonb then return true;end if;
 if not public.director_brief_snapshot_current(p.brief,(p.brief->'creativeBrief'->>'currentVersion')::integer) then return false;end if;
 select x.* into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='brief' and x.version=(p.brief->'creativeBrief'->>'currentVersion')::integer;
 if a.id is null or not public.director_artifact_is_current(p.id,a.id) then return false;end if;
 select ap.actor_id,ap.decision into actor,decision from public.director_approvals ap where ap.project_id=p.id and ap.artifact_id=a.id order by ap.ordinal desc limit 1;
 return actor is not distinct from p.owner_id and decision is not distinct from 'approved';
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
revoke all on function public.director_current_brief_approved(uuid) from public,anon,authenticated;
grant execute on function public.director_current_brief_approved(uuid) to service_role;
-- Existing reservation/dispatch triggers acquire the project lock before this predicate;
-- approval inserts and project saves use the same lock, fencing revocations and edits.
do $$
declare definition text;anchor text:='if project.id is null or project.owner_id is null then return false; end if;';
begin
 definition=pg_get_functiondef('public.director_document_approval_ready(uuid,text,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'structured_brief_media_gate_baseline_mismatch';end if;
 definition=replace(definition,anchor,anchor||' if not public.director_current_brief_approved(p_project_id) then return false; end if;');
 execute definition;
end $$;

-- Existing owner-only approval insertion trigger calls director_artifact_is_current.
-- Thus old, source-stale or mismatched brief snapshots cannot gain an approval; no new
-- customer grants or approval-writing endpoint is introduced. Poll/accounting unaffected.
commit;

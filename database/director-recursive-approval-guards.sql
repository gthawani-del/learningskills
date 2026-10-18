-- Applied with reviewed migration 20261018025605_director_quote_authorization_guards.
-- Dependencies: foundation, dispatch claims and production_record_currentness helpers.
-- Adds a creative-approval gate; does not confer route, budget, rights or quality approval.
begin;
create function public.director_document_approval_ready(p_project_id uuid,p_logical_key text,p_version integer)
returns boolean language plpgsql security invoker set search_path='' as $$
<<approval_check>>
declare
 project public.director_projects;
 target public.director_artifacts;
 artifact public.director_artifacts;
 queue jsonb;
 item jsonb;
 record jsonb;
 snapshot jsonb;
 dependency jsonb;
 reference jsonb;
 shot jsonb;
 asset public.director_assets;
 seen text[] := '{}';
 cursor_index integer := 0;
 v_logical_key text;
 version_number integer;
 latest_decision text;
 latest_actor uuid;
 visit_key text;
begin
 if p_project_id is null or p_logical_key is null or p_version is null or p_version<1 then return false; end if;
 select p.* into project from public.director_projects p where p.id=p_project_id;
 if project.id is null or project.owner_id is null then return false; end if;
 select a.* into target from public.director_artifacts a where a.project_id=project.id and a.logical_key=p_logical_key and a.version=p_version;
 if target.id is null or not coalesce(public.director_artifact_is_current(project.id,target.id),false) then return false; end if;
 -- The existing helper validates exact bound/dependent versions and fails closed on cycles.
 -- Always require the current story, even when the operation targets a library record.
 queue=jsonb_build_array(jsonb_build_object('key','story','version',(project.brief->'story'->>'version')::integer),jsonb_build_object('key',p_logical_key,'version',p_version));
 while cursor_index<jsonb_array_length(queue) loop
 if cursor_index>20100 then return false; end if; -- bounded malformed graph defense
 item=queue->cursor_index;cursor_index=cursor_index+1;
 v_logical_key=item->>'key';version_number=(item->>'version')::integer;
 if v_logical_key is null or version_number is null or version_number<1 then return false; end if;
 visit_key=v_logical_key||'@'||version_number::text;
 if visit_key=any(seen) then continue; end if;
 if cardinality(seen)>201 then return false; end if;
 seen=array_append(seen,visit_key);
 select a.* into artifact from public.director_artifacts a where a.project_id=project.id and a.logical_key=approval_check.v_logical_key and a.version=version_number;
 if artifact.id is null then return false; end if;
 latest_decision=null;latest_actor=null;
 select ap.decision,ap.actor_id into latest_decision,latest_actor from public.director_approvals ap
 where ap.project_id=project.id and ap.artifact_id=artifact.id order by ap.ordinal desc limit 1;
 if latest_decision is distinct from 'approved' or latest_actor is distinct from project.owner_id then return false; end if;
 if v_logical_key='story' then
 if (project.brief->'story'->>'version')::integer is distinct from version_number then return false; end if;
 elsif left(v_logical_key,7)='record:' then
 select value into record from jsonb_array_elements(coalesce(project.brief->'production'->'records','[]'::jsonb)) where value->>'id'=substr(v_logical_key,8);
 if record is null or (record->>'currentVersion')::integer is distinct from version_number then return false; end if;
 select value into snapshot from jsonb_array_elements(record->'versions') where (value->>'version')::integer=version_number;
 if snapshot is null then return false; end if;
 for reference in select value from jsonb_array_elements(coalesce(snapshot->'references','[]'::jsonb)) loop
 select a.* into asset from public.director_assets a where a.project_id=project.id and a.id=(reference->>'assetId')::uuid;
 if asset.id is null or (reference->>'version') is null or (reference->>'version')::integer<1 or coalesce((asset.metadata->>'version')::integer,1) is distinct from (reference->>'version')::integer then return false; end if;
 end loop;
 for dependency in select value from jsonb_array_elements(coalesce(snapshot->'dependencies','[]'::jsonb)) loop
 queue=queue||jsonb_build_array(jsonb_build_object('key','record:'||(dependency->>'recordId'),'version',(dependency->>'version')::integer));
 end loop;
 else
 select value into shot from jsonb_array_elements(coalesce(project.brief->'shots','[]'::jsonb)) where value->>'id'=v_logical_key and (value->>'version')::integer=version_number;
 if shot is null then return false; end if;
 for dependency in select value from jsonb_array_elements(coalesce(shot->'productionBindings','[]'::jsonb)) loop
 queue=queue||jsonb_build_array(jsonb_build_object('key','record:'||(dependency->>'recordId'),'version',(dependency->>'version')::integer));
 end loop;
 end if;
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
 -- Invalid archived JSON/casts fail closed. SQL programming/permission errors deliberately
 -- propagate so a broken positive path cannot be hidden as an ordinary creative hold.
 return false;
end $$;
revoke all on function public.director_document_approval_ready(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.director_document_approval_ready(uuid,text,integer) to service_role;

create function public.director_guard_recursive_job_approvals() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 project public.director_projects;
 proposal public.director_proposals;
 artifact public.director_artifacts;
begin
 if TG_OP='UPDATE' then
 if not (old.status='reserved' and new.status='submitted') then return new; end if;
 end if;
 -- Same project lock used by save and approval insertion. A committed revocation or
 -- dependency revision is visible before a later reservation/dispatch can pass.
 select p.* into project from public.director_projects p where p.id=new.project_id for update;
 if project.id is null then raise exception 'creative_dependencies_not_approved'; end if;
 select q.* into proposal from public.director_proposals q where q.id=new.proposal_id and q.project_id=project.id;
 select a.* into artifact from public.director_artifacts a where a.id=proposal.artifact_id and a.project_id=project.id;
 if artifact.id is null or not coalesce(public.director_document_approval_ready(project.id,artifact.logical_key,artifact.version),false) then raise exception 'creative_dependencies_not_approved'; end if;
 return new;
end $$;
revoke all on function public.director_guard_recursive_job_approvals() from public,anon,authenticated;
grant execute on function public.director_guard_recursive_job_approvals() to service_role;
create trigger director_approval_recursive_insert_guard before insert on public.director_jobs
for each row execute function public.director_guard_recursive_job_approvals();
create trigger director_approval_recursive_dispatch_guard before update of status on public.director_jobs
for each row execute function public.director_guard_recursive_job_approvals();
comment on function public.director_document_approval_ready(uuid,text,integer) is 'Creative currentness and latest-owner-approval check for current story, target and recursive production record dependencies. Does not authorize generation or replace route, quote, budget, rights or operational controls.';
commit;

-- Review/rollback fixture plan; do not insert synthetic auth.users into a live project.
-- 1. Read pg_proc to confirm SECURITY INVOKER, empty search_path and service-only EXECUTE.
-- 2. Using a designated account/project in a transaction ending ROLLBACK, snapshot story,
--    voice->audio->take records and a bound shot. Helpers must return false for missing
--    project/artifact, old target version, missing story approval and missing upstream approval.
-- 3. Insert latest owner approvals for all required current artifacts: helper becomes true.
--    Append upstream revocation: helper becomes false without changing media/artifact versions.
-- 4. Revise upstream record, retain old bound version: false until dependent versions,
--    bindings and corresponding current approvals are refreshed. Foreign/missing asset
--    references and mismatched reference versions must return false. Cycles fail closed.
-- 5. With a valid operational fixture and reviewed budget/quote, try job INSERT and then
--    reserved->submitted before/after revocation. Held paths raise creative_dependencies_not_approved.
--    Existing running->completed and unknown/reconciliation updates must remain allowed.
-- 6. Two-session test: approval/save transaction holds project lock; later dispatch blocks,
--    then observes committed revocation. Do not invoke a provider or activate real models.
-- Operational pause triggers remain installed. Removing this increment requires disabling
-- generation first; drop only these two triggers/helper functions after a reviewed rollback.
-- Keep all historical approvals, artifacts, media and audit events intact.

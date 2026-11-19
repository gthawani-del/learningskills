-- PREPARED ONLY. Apply after the existing storyboard/reference/planning migrations.
-- No new tables, providers or authority. Existing service-only access remains.
begin;
alter table public.director_planning_reservations drop constraint director_planning_reservations_operation_check;
alter table public.director_planning_reservations add constraint director_planning_reservations_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments','plan_storyboard','director_turn'));
alter table public.director_planning_consents drop constraint director_planning_consents_operation_check;
alter table public.director_planning_consents add constraint director_planning_consents_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments','plan_storyboard','director_turn'));
do $$
declare definition text;operations text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'',''revise_departments'',''plan_storyboard'')';expanded text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'',''revise_departments'',''plan_storyboard'',''director_turn'')';version_test text:='case when p_body->>''operation''=''plan_storyboard'' then ''director-planning-v6'' when p_body->>''operation''=''revise_departments'' then ''director-planning-v5'' when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,operations,'')))/length(operations)<>2 or(length(definition)-length(replace(definition,version_test,'')))/length(version_test)<>1 then raise exception 'director_conversation_planning_baseline_mismatch';end if;
 definition=replace(definition,operations,expanded);definition=replace(definition,version_test,'case when p_body->>''operation''=''director_turn'' then ''director-planning-v7'' when p_body->>''operation''=''plan_storyboard'' then ''director-planning-v6'' when p_body->>''operation''=''revise_departments'' then ''director-planning-v5'' when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end');execute definition;
 definition=pg_get_functiondef('public.director_registry_review_ready(text,jsonb,jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,operations,'')))/length(operations)<>1 then raise exception 'director_conversation_registry_baseline_mismatch';end if;
 execute replace(definition,operations,expanded);
end $$;

alter table public.director_planning_consents add column director_snapshot jsonb;
create function public.director_conversation_snapshot(p_project_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'creative',(select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from jsonb_each(p.brief)e where e.key=any(array['title','premise','direction','language','format','duration','stage','briefExplicitFields','creativeBrief','story','screenplay','departmentPlanning','storyboardHandoff','referenceProduction','storyboardProduction','production','shots','referenceIds','notes'])),
  'approvals',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'artifact',a.artifact_id,'decision',a.decision,'ordinal',a.ordinal)order by a.ordinal)from public.director_approvals a where a.project_id=p.id),'[]'::jsonb),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'version',a.metadata->'version','checksum',a.metadata->'checksum')order by a.id)from public.director_assets a where a.project_id=p.id),'[]'::jsonb)
 ) from public.director_projects p where p.id=p_project_id;
$$;
create function public.director_capture_conversation() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;
begin
 if new.operation<>'director_turn' then return new;end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 if p.id is null or new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 if p.brief->>'format' is distinct from 'music_video' or new.registry_snapshot#>>'{capabilities,planning,directorConversationVersion}' is distinct from 'director_conversation_v1' or p.brief#>>'{directorSession,kind}' is distinct from 'director_session_v1' or not exists(select 1 from jsonb_array_elements(p.brief#>'{directorSession,messages}')m where m->>'role'='user') then raise exception 'director_conversation_profile_or_message_required';end if;
 new.director_snapshot=public.director_conversation_snapshot(p.id);return new;
end $$;
create function public.director_guard_conversation() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;c public.director_planning_consents;
begin
 if new.operation<>'director_turn' then return new;end if;
 if TG_OP='UPDATE' then if not(not old.submit_claimed and new.submit_claimed)then return new;end if;end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if c.id is null or new.actor_id is distinct from p.owner_id or c.actor_id is distinct from p.owner_id or c.operation<>'director_turn' or c.director_snapshot is null or c.director_snapshot is distinct from public.director_conversation_snapshot(p.id) then raise exception 'director_conversation_sources_changed';end if;
 if new.request->>'version' is distinct from 'director-planning-v7' or new.request->>'operation' is distinct from 'director_turn' then raise exception 'director_conversation_contract_required';end if;
 return new;
end $$;
create function public.director_immutable_conversation_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.director_snapshot is distinct from old.director_snapshot then raise exception 'director_conversation_snapshot_immutable';end if;return new;
end $$;
create trigger capture_director_conversation before insert on public.director_planning_consents for each row execute function public.director_capture_conversation();
create trigger immutable_director_conversation before update of director_snapshot on public.director_planning_consents for each row execute function public.director_immutable_conversation_snapshot();
create trigger current_director_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_conversation();
create trigger current_director_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_conversation();
revoke all on function public.director_conversation_snapshot(uuid),public.director_capture_conversation(),public.director_guard_conversation(),public.director_immutable_conversation_snapshot() from public,anon,authenticated;
grant execute on function public.director_conversation_snapshot(uuid),public.director_capture_conversation(),public.director_guard_conversation(),public.director_immutable_conversation_snapshot() to service_role;
commit;

-- Director operational controls; applied as migration 20261018002640.
-- Depends on director-foundation.sql and its append-only trigger function.
-- No activation or resume operation exists in this increment. Seeded pause fails closed.
-- Server authenticates actor and derives owner/operator role from trusted configuration;
-- never accept either identity or role from an ordinary browser request body.
begin;

create table public.director_operational_controls (
 id smallint primary key default 1 check(id=1),
 revision bigint not null default 1 check(revision>0),
 generation_paused boolean not null default true,
 reason text not null default 'Generation is paused pending operational release.' check(length(reason) between 5 and 1000),
 updated_at timestamptz not null default now()
);
insert into public.director_operational_controls(id) values(1);
create table public.director_admin_commands (
 request_id uuid primary key,
 actor_id uuid not null,
 actor_role text not null check(actor_role in ('owner','operator')),
 command text not null check(command in ('pause_generation','disable_model','update_model_notes')),
 request jsonb not null,
 before_state jsonb not null,
 after_state jsonb not null,
 created_at timestamptz not null default now()
);
create index director_admin_commands_created on public.director_admin_commands(created_at desc);
create index director_admin_commands_actor on public.director_admin_commands(actor_id,created_at desc);
create trigger append_only before update or delete on public.director_admin_commands
 for each row execute function public.director_reject_mutation();
alter table public.director_operational_controls enable row level security;
alter table public.director_admin_commands enable row level security;
create policy director_controls_deny on public.director_operational_controls for all to anon,authenticated using(false) with check(false);
create policy director_commands_deny on public.director_admin_commands for all to anon,authenticated using(false) with check(false);
-- Explicit deny policies plus no customer grants: service-only metadata and audit history.
revoke all on public.director_operational_controls,public.director_admin_commands from public,anon,authenticated;
revoke all on public.director_operational_controls,public.director_admin_commands from service_role;
grant select,update on public.director_operational_controls to service_role;
grant select,insert on public.director_admin_commands to service_role;

create function public.director_admin_command(
 p_actor_id uuid,p_actor_role text,p_request_id uuid,p_expected_revision bigint,
 p_command text,p_reason text,p_model_id text default null,p_notes text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
<<admin_operation>>
declare
 control public.director_operational_controls;
 model public.director_models;
 prior public.director_admin_commands;
 normalized jsonb;
 before_state jsonb;
 after_state jsonb;
 actor_role text := btrim(p_actor_role);
 command text := btrim(p_command);
 reason text := btrim(p_reason);
 model_id text := case when p_model_id is null then null else btrim(p_model_id) end;
 notes text := case when p_notes is null then null else btrim(p_notes) end;
begin
 if p_actor_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision<1
 or actor_role is null or actor_role not in ('owner','operator')
 or command is null or command not in ('pause_generation','disable_model','update_model_notes')
 or reason is null or length(reason) not between 5 and 1000 then
 raise exception 'operational_command_invalid';
 end if;
 if command='pause_generation' and (model_id is not null or notes is not null) then raise exception 'operational_command_invalid'; end if;
 if command in ('disable_model','update_model_notes') and (model_id is null or length(model_id) not between 1 and 300) then raise exception 'operational_command_invalid'; end if;
 if command='disable_model' and notes is not null then raise exception 'operational_command_invalid'; end if;
 if command='update_model_notes' and (actor_role<>'owner' or notes is null or length(notes)>2000) then raise exception 'operational_command_forbidden'; end if;
 normalized=jsonb_build_object('actorId',p_actor_id,'actorRole',actor_role,'requestId',p_request_id,'expectedRevision',p_expected_revision,'command',command,'reason',reason,'modelId',model_id,'notes',notes);
 -- Serialize all operational commands before reading replay state or locking a model.
 select * into control from public.director_operational_controls where id=1 for update;
 if control.id is null then raise exception 'operational_control_missing'; end if;
 select * into prior from public.director_admin_commands where request_id=p_request_id;
 if prior.request_id is not null then
 if prior.request<>normalized then raise exception 'operational_idempotency_conflict'; end if;
 return jsonb_build_object('control',prior.after_state->'control','before',prior.before_state,'after',prior.after_state,'replayed',true);
 end if;
 if control.revision<>p_expected_revision then raise exception 'operational_revision_conflict'; end if;
 if command in ('disable_model','update_model_notes') then
 -- Existing reservation/claim code may hold a model share-lock before its job trigger
 -- requests the control lock. NOWAIT avoids a control->model/model->control deadlock.
 -- A busy response rolls back fully; explicit retry uses the SAME request UUID.
 begin
 select * into model from public.director_models where id=model_id for update nowait;
 exception when lock_not_available then raise exception 'operational_model_busy';
 end;
 if model.id is null then raise exception 'operational_model_missing'; end if;
 end if;
 before_state=jsonb_build_object('control',to_jsonb(control),'model',case when model.id is null then null else to_jsonb(model) end);
 if command='disable_model' then
 update public.director_models set active=false,updated_at=now() where id=model_id returning * into model;
 elsif command='update_model_notes' then
 if jsonb_typeof(model.capabilities)<>'object' then raise exception 'operational_model_capabilities_invalid'; end if;
 update public.director_models set capabilities=jsonb_set(capabilities,'{admin_notes}',to_jsonb(notes),true),updated_at=now()
 where id=model_id returning * into model;
 end if;
 update public.director_operational_controls set revision=revision+1,
 generation_paused=case when command='pause_generation' then true else generation_paused end,
 reason=admin_operation.reason,updated_at=now() where id=1 returning * into control;
 after_state=jsonb_build_object('control',to_jsonb(control),'model',case when model.id is null then null else to_jsonb(model) end);
 insert into public.director_admin_commands(request_id,actor_id,actor_role,command,request,before_state,after_state)
 values(p_request_id,p_actor_id,admin_operation.actor_role,admin_operation.command,normalized,before_state,after_state);
 return jsonb_build_object('control',to_jsonb(control),'before',before_state,'after',after_state,'replayed',false);
end $$;
revoke all on function public.director_admin_command(uuid,text,uuid,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.director_admin_command(uuid,text,uuid,bigint,text,text,text,text) to service_role;

create function public.director_guard_generation_control() returns trigger
 language plpgsql security invoker set search_path = '' as $$
declare paused boolean;
begin
 -- Completion, poll, reconciliation, cancellation and unknown-charge updates are allowed.
 if TG_OP='UPDATE' then
 if not (old.status='reserved' and new.status='submitted') then return new; end if;
 end if;
 select generation_paused into paused from public.director_operational_controls where id=1 for share;
 if not found or paused is distinct from false then raise exception 'generation_operationally_paused'; end if;
 return new;
end $$;
revoke all on function public.director_guard_generation_control() from public,anon,authenticated;
grant execute on function public.director_guard_generation_control() to service_role;
create trigger director_generation_insert_guard before insert on public.director_jobs
 for each row execute function public.director_guard_generation_control();
create trigger director_generation_dispatch_guard before update of status on public.director_jobs
 for each row execute function public.director_guard_generation_control();

comment on table public.director_operational_controls is 'Fail-closed generation gate. Pause waits for earlier DB reservations/claims holding shared control locks. It cannot undo a provider request already in flight or revoke a claim committed before pause.';
comment on table public.director_admin_commands is 'Immutable operational command history; request UUID plus exact normalized payload and actor provide application idempotency. Replay returns the original result, not a fresh current-control snapshot.';
commit;

-- Read-only proof queries after a separately reviewed deployment:
-- SELECT relname,relrowsecurity FROM pg_class WHERE oid IN
-- ('public.director_operational_controls'::regclass,'public.director_admin_commands'::regclass);
-- SELECT * FROM public.director_operational_controls; -- expect id1, revision1, pausedtrue initially
-- SELECT has_function_privilege('anon','public.director_admin_command(uuid,text,uuid,bigint,text,text,text,text)','EXECUTE'); -- false
-- SELECT has_function_privilege('authenticated','public.director_admin_command(uuid,text,uuid,bigint,text,text,text,text)','EXECUTE'); -- false
-- SELECT has_table_privilege('service_role','public.director_admin_commands','UPDATE'); -- false
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.director_jobs'::regclass AND NOT tgisinternal;
-- Transaction-only functional proof plan (reviewed synthetic fixtures, always ROLLBACK):
-- 1. SET LOCAL ROLE service_role; pause_generation owner/operator increments revision once.
-- 2. Same request UUID/payload replays; altered actor/reason/command conflicts; stale revision conflicts.
-- 3. Operator notes/resume/activate rejected; owner notes changes admin_notes only; disable sets activefalse.
-- 4. INSERT jobs / reserved->submitted fail when paused; running->completed / charge reconciliation allowed.
-- 5. Separate sessions verify pause serializes behind shared control lock; modelbusy command leaves no audit/revision change.
-- Rollback of this increment must first disable all generation at the server; dropping guards while
-- requests remain enabled removes the database gate. Preserve immutable command audit during rollback.
-- No destructive rollback SQL is included; reverting pause requires a separate reviewed release design.

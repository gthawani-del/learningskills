-- Director foundation: additive Supabase schema. Application status is recorded in docs/IMPLEMENTATION_STATUS.md.
-- Requires Supabase PostgreSQL (auth.users, auth.uid(), anon/authenticated/service_role).
-- Owner-only tenancy initially. Workspace membership and Storage policies are deliberately
-- separate future migrations; storage_key is not a public URL or an upload permission.
-- Monetary values are integer USD microdollars, never floating-point estimates.
-- service_role is trusted server infrastructure: never expose it to a browser.
begin;

create table public.director_projects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 title text not null check (length(title) between 1 and 200), brief jsonb not null default '{}',
 stage text not null default 'brief', budget_micro_usd bigint not null default 0 check(budget_micro_usd>=0),
 finish_reserve_micro_usd bigint not null default 0 check(finish_reserve_micro_usd>=0), created_at timestamptz not null default now()
);
create index director_projects_owner on public.director_projects(owner_id);
create table public.director_artifacts (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 kind text not null, logical_key text not null, version integer not null check(version>0),
 content jsonb not null, content_hash text not null, created_at timestamptz not null default now(),
 unique(project_id,logical_key,version), unique(project_id,id)
);
create table public.director_assets (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 kind text not null, storage_key text not null, metadata jsonb not null default '{}',
 rights_evidence jsonb not null default '{}', created_at timestamptz not null default now(), unique(project_id,id)
);
create table public.director_approvals (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 artifact_id uuid not null, actor_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected','revoked')),
 ordinal bigint generated always as identity unique,
 reason text, created_at timestamptz not null default now(),
 foreign key(project_id,artifact_id) references public.director_artifacts(project_id,id)
);
create table public.director_models (
 id text primary key, provider text not null, endpoint text not null,
 capabilities jsonb not null default '{}', schema_evidence jsonb not null default '{}',
 price_evidence jsonb not null default '{}', price_version text not null,
 active boolean not null default false, execution_tested boolean not null default false,
 quality_validated boolean not null default false, updated_at timestamptz not null default now()
);
-- Proposal payload is immutable; an approval must bind exact payload, route and price.
create table public.director_proposals (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 artifact_id uuid not null, model_id text not null references public.director_models(id),
 price_version text not null, payload jsonb not null, payload_hash text not null,
 quote_micro_usd bigint not null check(quote_micro_usd>0), quote_expires_at timestamptz not null,
 created_at timestamptz not null default now(), unique(project_id,id),
 foreign key(project_id,artifact_id) references public.director_artifacts(project_id,id)
);
-- Each authorization binds one exact proposal, including approved maximum and finish reserve.
-- A replacement authorization is a new row, never a mutation of old approval evidence.
create table public.director_budget_authorizations (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 proposal_id uuid not null, actor_id uuid not null references auth.users(id),
 max_micro_usd bigint not null check(max_micro_usd>0),
 finish_reserve_micro_usd bigint not null default 0 check(finish_reserve_micro_usd>=0),
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 unique(project_id,id), foreign key(project_id,proposal_id) references public.director_proposals(project_id,id),
 check(max_micro_usd>=finish_reserve_micro_usd)
);
create table public.director_work_units (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 logical_key text not null, artifact_id uuid not null,
 created_at timestamptz not null default now(), unique(project_id,logical_key), unique(project_id,id),
 foreign key(project_id,artifact_id) references public.director_artifacts(project_id,id)
);
create table public.director_jobs (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 work_unit_id uuid not null, proposal_id uuid not null, authorization_id uuid not null,
 idempotency_key text not null check(length(idempotency_key) between 1 and 200), payload_hash text not null,
 status text not null default 'reserved' check(status in ('reserved','submitted','running','unknown','completed','failed','cancelled')),
 provider_request_id text, reserved_micro_usd bigint not null check(reserved_micro_usd>0),
 actual_micro_usd bigint check(actual_micro_usd>=0),
 charge_state text not null default 'held' check(charge_state in ('held','unknown','settled','released')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(project_id,id), unique(project_id,idempotency_key),
 foreign key(project_id,work_unit_id) references public.director_work_units(project_id,id),
 foreign key(project_id,proposal_id) references public.director_proposals(project_id,id),
 foreign key(project_id,authorization_id) references public.director_budget_authorizations(project_id,id),
 check((charge_state='settled' and actual_micro_usd is not null) or charge_state<>'settled')
);
create unique index director_jobs_provider_id on public.director_jobs(provider_request_id) where provider_request_id is not null;
create table public.director_attempts (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 work_unit_id uuid not null, job_id uuid not null unique,
 attempt_number integer not null check(attempt_number between 1 and 2),
 diagnosis jsonb, created_at timestamptz not null default now(),
 unique(work_unit_id,attempt_number),
 foreign key(project_id,work_unit_id) references public.director_work_units(project_id,id),
 foreign key(project_id,job_id) references public.director_jobs(project_id,id)
);
create table public.director_reviews (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 job_id uuid not null, actor_id uuid references auth.users(id),
 verdict text not null check(verdict in ('accepted','correction_required','blocked')),
 evidence jsonb not null, created_at timestamptz not null default now(),
 foreign key(project_id,job_id) references public.director_jobs(project_id,id)
);
create table public.director_audit_events (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.director_projects(id),
 actor_id uuid references auth.users(id), event_type text not null, details jsonb not null,
 created_at timestamptz not null default now()
);

-- Append-only evidence even for trusted application writers. Owner/migration administrator
-- can still change schema: this is an application integrity control, not tamper-proof storage.
create function public.director_reject_mutation() returns trigger language plpgsql security invoker
set search_path = '' as $$ begin raise exception 'append_only_evidence'; end $$;
revoke all on function public.director_reject_mutation() from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['director_artifacts','director_approvals','director_proposals','director_work_units','director_attempts','director_reviews','director_audit_events'] loop
 execute format('create trigger append_only before update or delete on public.%I for each row execute function public.director_reject_mutation()',t);
 end loop;
 foreach t in array array['director_projects','director_artifacts','director_assets','director_approvals','director_models','director_proposals','director_budget_authorizations','director_work_units','director_jobs','director_attempts','director_reviews','director_audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 if t<>'director_models' and t<>'director_projects' then
 execute format('create index %I on public.%I(project_id)',t||'_project',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (exists(select 1 from public.director_projects p where p.id=project_id and p.owner_id=(select auth.uid())))',t);
 execute format('grant select on public.%I to authenticated',t);
 end if;
 end loop;
end $$;
create policy owner_read on public.director_projects for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_insert on public.director_projects for insert to authenticated with check(owner_id=(select auth.uid()));
-- Only mutable product fields can be updated by an owner. No owner reassignment or deletion.
create policy owner_update on public.director_projects for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select on public.director_projects to authenticated;
grant insert(id,owner_id,title,brief,stage) on public.director_projects to authenticated;
grant update(title,brief,stage) on public.director_projects to authenticated;
-- No browser ledger/job/approval/registry writes. Trusted backend verifies the JWT and passes
-- its verified subject as p_actor_id. Never accept p_actor_id from a request body unchecked.

create function public.director_reserve_job(
 p_actor_id uuid,p_project_id uuid,p_work_unit_id uuid,p_proposal_id uuid,
 p_authorization_id uuid,p_idempotency_key text,p_payload_hash text
) returns public.director_jobs language plpgsql security invoker set search_path = '' as $$
declare
 p public.director_projects; q public.director_proposals; a public.director_budget_authorizations;
 w public.director_work_units; m public.director_models; j public.director_jobs;
 used_amount bigint; next_attempt integer;
begin
 -- Single project lock serializes reservations across authorizations and logical work units.
 select * into p from public.director_projects where id=p_project_id for update;
 if p.id is null or p.owner_id<>p_actor_id or p_actor_id is null then raise exception 'not_project_owner'; end if;
 select * into j from public.director_jobs where project_id=p_project_id and idempotency_key=p_idempotency_key;
 if j.id is not null then
 if j.payload_hash<>p_payload_hash or j.proposal_id<>p_proposal_id or j.work_unit_id<>p_work_unit_id or j.authorization_id<>p_authorization_id then raise exception 'idempotency_conflict'; end if;
 return j;
 end if;
 select * into q from public.director_proposals where id=p_proposal_id and project_id=p_project_id;
 select * into a from public.director_budget_authorizations where id=p_authorization_id and project_id=p_project_id for update;
 select * into w from public.director_work_units where id=p_work_unit_id and project_id=p_project_id;
 if q.id is null or a.id is null or w.id is null then raise exception 'missing_contract'; end if;
 if a.actor_id<>p_actor_id or a.proposal_id<>q.id or a.revoked_at is not null or a.expires_at<=now() then raise exception 'authorization_invalid'; end if;
 if q.payload_hash<>p_payload_hash or q.quote_expires_at<=now() or w.artifact_id<>q.artifact_id then raise exception 'proposal_invalid'; end if;
 if not exists(select 1 from public.director_approvals ap where ap.project_id=p_project_id and ap.artifact_id=q.artifact_id and ap.actor_id=p_actor_id and ap.decision='approved'
 and not exists(select 1 from public.director_approvals later where later.artifact_id=ap.artifact_id and later.ordinal>ap.ordinal)) then raise exception 'artifact_not_approved'; end if;
 if p_payload_hash is null or p_idempotency_key is null then raise exception 'invalid_job_identity'; end if;
 select * into m from public.director_models where id=q.model_id for share;
 if not m.active or not m.execution_tested or not m.quality_validated or m.price_version<>q.price_version then raise exception 'route_not_eligible'; end if;
 -- Unknown charges retain the full hold and block automatic replacement submission.
 if exists(select 1 from public.director_jobs where work_unit_id=w.id and (status in ('reserved','submitted','running','unknown') or charge_state='unknown')) then raise exception 'work_unit_in_flight'; end if;
 select coalesce(max(attempt_number),0)+1 into next_attempt from public.director_attempts where work_unit_id=w.id;
 if next_attempt>2 then raise exception 'attempt_limit'; end if;
 if next_attempt=2 and not exists(select 1 from public.director_reviews r join public.director_attempts at on at.job_id=r.job_id where at.work_unit_id=w.id and at.attempt_number=1 and r.verdict='correction_required' and r.evidence<>'{}'::jsonb) then raise exception 'diagnosed_correction_required'; end if;
 select coalesce(sum(case when charge_state='settled' then actual_micro_usd when charge_state in ('held','unknown') then reserved_micro_usd else 0 end),0)
 into used_amount from public.director_jobs where authorization_id=a.id;
 if used_amount+q.quote_micro_usd+a.finish_reserve_micro_usd>a.max_micro_usd then raise exception 'budget_exceeded'; end if;
 select coalesce(sum(case when charge_state='settled' then actual_micro_usd when charge_state in ('held','unknown') then reserved_micro_usd else 0 end),0)
 into used_amount from public.director_jobs where project_id=p.id;
 if used_amount+q.quote_micro_usd+p.finish_reserve_micro_usd>p.budget_micro_usd then raise exception 'project_budget_exceeded'; end if;
 insert into public.director_jobs(project_id,work_unit_id,proposal_id,authorization_id,idempotency_key,payload_hash,reserved_micro_usd)
 values(p_project_id,w.id,q.id,a.id,p_idempotency_key,p_payload_hash,q.quote_micro_usd) returning * into j;
 insert into public.director_attempts(project_id,work_unit_id,job_id,attempt_number) values(p_project_id,w.id,j.id,next_attempt);
 insert into public.director_audit_events(project_id,actor_id,event_type,details) values(p_project_id,p_actor_id,'job_reserved',jsonb_build_object('job_id',j.id,'attempt',next_attempt,'reserved_micro_usd',j.reserved_micro_usd));
 return j;
end $$;
revoke all on function public.director_reserve_job(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.director_reserve_job(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;
-- Identity sequence privilege for append-only approval ordering (not granted to customers).
grant usage, select on sequence public.director_approvals_ordinal_seq to service_role;

comment on table public.director_jobs is 'Durable outbox. Worker must claim before dispatch; unknown submission outcome is held for reconciliation, never blindly retried. Provider billing idempotency is not guaranteed.';
comment on table public.director_budget_authorizations is 'Per-proposal authorizations are independent approved budgets, not shared wallet balances. Aggregate wallet/top-up enforcement requires separate ledger before customer billing.';
comment on table public.director_models is 'No production routes seeded. Catalog/schema evidence does not confer execution or quality validation.';
commit;

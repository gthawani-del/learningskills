begin;
create function public.director_artifact_is_current(p_project_id uuid,p_artifact_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select case when a.logical_key='story' then (p.brief->'story'->>'version')::integer=a.version
 else exists(select 1 from jsonb_array_elements(p.brief->'shots') s where s->>'id'=a.logical_key and (s->>'version')::integer=a.version) end
 from public.director_projects p join public.director_artifacts a on a.project_id=p.id
 where p.id=p_project_id and a.id=p_artifact_id),false);
$$;
revoke all on function public.director_artifact_is_current(uuid,uuid) from public,anon,authenticated;
grant execute on function public.director_artifact_is_current(uuid,uuid) to service_role;
create function public.director_guard_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;
begin
 select * into p from public.director_projects where id=new.project_id for update;
 if p.owner_id<>new.actor_id or new.actor_id is null then raise exception 'not_project_owner'; end if;
 if new.decision='approved' and not public.director_artifact_is_current(new.project_id,new.artifact_id) then raise exception 'artifact_superseded'; end if;
 return new;
end $$;
revoke all on function public.director_guard_approval() from public,anon,authenticated;
create trigger lock_approval before insert on public.director_approvals for each row execute function public.director_guard_approval();
create function public.director_claim_job(p_job_id uuid) returns public.director_jobs
language plpgsql security invoker set search_path='' as $$
declare j public.director_jobs; p public.director_projects; q public.director_proposals;
 a public.director_budget_authorizations; m public.director_models;
begin
 select * into j from public.director_jobs where id=p_job_id;
 if j.id is null then raise exception 'job_not_found'; end if;
 select * into p from public.director_projects where id=j.project_id for update;
 select * into j from public.director_jobs where id=p_job_id for update;
 if j.status<>'reserved' then return null; end if;
 select * into q from public.director_proposals where id=j.proposal_id and project_id=p.id;
 select * into a from public.director_budget_authorizations where id=j.authorization_id and project_id=p.id for share;
 select * into m from public.director_models where id=q.model_id for share;
 if j.charge_state<>'held' or a.revoked_at is not null or a.expires_at<=now() or q.quote_expires_at<=now() then raise exception 'authorization_invalid'; end if;
 if not public.director_artifact_is_current(p.id,q.artifact_id) then raise exception 'artifact_superseded'; end if;
 if not exists(select 1 from public.director_approvals ap where ap.project_id=p.id and ap.artifact_id=q.artifact_id and ap.actor_id=p.owner_id and ap.decision='approved'
 and not exists(select 1 from public.director_approvals later where later.artifact_id=ap.artifact_id and later.ordinal>ap.ordinal)) then raise exception 'artifact_not_approved'; end if;
 if not m.active or not m.execution_tested or not m.quality_validated or m.price_version<>q.price_version then raise exception 'route_not_eligible'; end if;
 update public.director_jobs set status='submitted',updated_at=now() where id=j.id returning * into j;
 insert into public.director_audit_events(project_id,actor_id,event_type,details) values(p.id,p.owner_id,'job_claimed',jsonb_build_object('job_id',j.id));
 return j;
end $$;
revoke all on function public.director_claim_job(uuid) from public,anon,authenticated;
grant execute on function public.director_claim_job(uuid) to service_role;
commit;

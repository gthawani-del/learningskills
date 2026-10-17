begin;
-- A previously approved artifact must not authorize a superseded version.
create function public.director_guard_current_job() returns trigger language plpgsql security invoker set search_path='' as $$
declare q public.director_proposals; a public.director_artifacts;
begin
 select * into q from public.director_proposals where id=new.proposal_id and project_id=new.project_id;
 select * into a from public.director_artifacts where id=q.artifact_id and project_id=new.project_id;
 if exists(select 1 from public.director_artifacts n where n.project_id=a.project_id and n.logical_key=a.logical_key and n.version>a.version) then raise exception 'artifact_superseded'; end if;
 return new;
end $$;
revoke all on function public.director_guard_current_job() from public,anon,authenticated;
create trigger current_artifact_before_job before insert on public.director_jobs for each row execute function public.director_guard_current_job();
commit;

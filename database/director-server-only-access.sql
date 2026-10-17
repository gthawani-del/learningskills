begin;
-- The implemented application uses verified server endpoints, not direct browser database
-- reads. Retain owner RLS as defense in depth, but remove unnecessary Data API discovery.
do $$ declare t text; begin
 foreach t in array array['director_projects','director_artifacts','director_assets','director_approvals','director_models','director_proposals','director_budget_authorizations','director_work_units','director_jobs','director_attempts','director_reviews','director_audit_events'] loop
 execute format('revoke select on public.%I from authenticated',t);
 end loop;
end $$;
create policy registry_server_only on public.director_models for select to authenticated using(false);
commit;

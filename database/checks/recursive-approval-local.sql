-- DISPOSABLE LOCAL POSTGRES ONLY. NOT EXECUTED / NOT VERIFIED IN THIS WORKSPACE.
-- Run as local test superuser against a FRESH database named director_guard_test:
-- psql --set=ON_ERROR_STOP=1 --dbname=director_guard_test --file=database/checks/recursive-approval-local.sql
-- Never run against Supabase or any database containing customer/auth data.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database()<>'director_guard_test' OR EXISTS(SELECT FROM pg_namespace WHERE nspname='auth') THEN
 RAISE EXCEPTION 'Fresh disposable director_guard_test database required'; END IF;
END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'select null::uuid';
\ir ../director-foundation.sql
\ir ../director-dispatch-claims.sql
\ir ../20261017235051_production_record_currentness.sql
\ir ../director-recursive-approval-guards.sql

BEGIN;
-- Fixture data and all subsequent mutations are rolled back. Schema/roles belong only
-- to this disposable cluster; destroy the entire cluster after the proof.
DO $$
DECLARE
 owner_id uuid := '11111111-1111-4111-8111-111111111111';
 v_project_id uuid := '22222222-2222-4222-8222-222222222222';
 asset_id uuid := '33333333-3333-4333-8333-333333333333';
 voice_id text := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 audio_id text := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 take_id text := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 document jsonb; changed jsonb;
 voice_artifact uuid;
BEGIN
 INSERT INTO auth.users(id) VALUES(owner_id);
 document=jsonb_build_object('version',1,'story',jsonb_build_object('version',1,'treatment','A keeper waits.'),
 'shots',jsonb_build_array(jsonb_build_object('id','shot-one','version',1,'productionBindings',jsonb_build_array(jsonb_build_object('recordId',take_id,'version',1)))),
 'production',jsonb_build_object('records',jsonb_build_array(
 jsonb_build_object('id',voice_id,'currentVersion',1,'versions',jsonb_build_array(jsonb_build_object('version',1,'references',jsonb_build_array(jsonb_build_object('assetId',asset_id,'version',1)),'dependencies','[]'::jsonb))),
 jsonb_build_object('id',audio_id,'currentVersion',1,'versions',jsonb_build_array(jsonb_build_object('version',1,'references','[]'::jsonb,'dependencies',jsonb_build_array(jsonb_build_object('recordId',voice_id,'version',1))))),
 jsonb_build_object('id',take_id,'currentVersion',1,'versions',jsonb_build_array(jsonb_build_object('version',1,'references','[]'::jsonb,'dependencies',jsonb_build_array(jsonb_build_object('recordId',audio_id,'version',1)))))
 )));
 INSERT INTO public.director_projects(id,owner_id,title,brief) VALUES(v_project_id,owner_id,'Local guard fixture',document);
 INSERT INTO public.director_assets(id,project_id,kind,storage_key,metadata) VALUES(asset_id,v_project_id,'audio/wav','fixture-only',jsonb_build_object('version',1));
 INSERT INTO public.director_artifacts(project_id,kind,logical_key,version,content,content_hash)
 SELECT v_project_id,v.kind,v.key,1,'{}'::jsonb,'fixture-hash' FROM (VALUES ('story','story'),('shot','shot-one'),('voice','record:'||voice_id),('audio','record:'||audio_id),('take','record:'||take_id)) v(kind,key);
 IF public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Missing approvals unexpectedly passed'; END IF;
 INSERT INTO public.director_approvals(project_id,artifact_id,actor_id,decision)
 SELECT v_project_id,a.id,owner_id,'approved' FROM public.director_artifacts a WHERE a.project_id=v_project_id;
 IF NOT public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'POSITIVE approved graph failed'; END IF;
 IF NOT public.director_document_approval_ready(v_project_id,'record:'||take_id,1) THEN RAISE EXCEPTION 'POSITIVE approved take failed'; END IF;
 IF public.director_document_approval_ready(gen_random_uuid(),'shot-one',1) OR public.director_document_approval_ready(v_project_id,'missing',1) OR public.director_document_approval_ready(v_project_id,'shot-one',2) THEN RAISE EXCEPTION 'Missing/stale contract passed'; END IF;
 UPDATE public.director_assets a SET metadata=jsonb_build_object('version',2) WHERE a.id=asset_id;
 IF public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Old reference version passed'; END IF;
 UPDATE public.director_assets a SET metadata=jsonb_build_object('version',1) WHERE a.id=asset_id;
 SELECT a.id INTO voice_artifact FROM public.director_artifacts a WHERE a.project_id=v_project_id AND a.logical_key='record:'||voice_id;
 INSERT INTO public.director_approvals(project_id,artifact_id,actor_id,decision) VALUES(v_project_id,voice_artifact,owner_id,'revoked');
 IF public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Revoked upstream approval passed'; END IF;
 INSERT INTO public.director_approvals(project_id,artifact_id,actor_id,decision) VALUES(v_project_id,voice_artifact,owner_id,'approved');
 IF NOT public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Reapproved graph failed'; END IF;
 changed=jsonb_set(document,'{production,records,0,currentVersion}','2');
 UPDATE public.director_projects p SET brief=changed WHERE p.id=v_project_id;
 IF public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Stale bound dependency passed'; END IF;
 changed=jsonb_set(document,'{production,records,0,versions,0,dependencies}',jsonb_build_array(jsonb_build_object('recordId',take_id,'version',1)));
 UPDATE public.director_projects p SET brief=changed WHERE p.id=v_project_id;
 IF public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Cyclic dependency passed'; END IF;
 UPDATE public.director_projects p SET brief=document WHERE p.id=v_project_id;
 IF NOT public.director_document_approval_ready(v_project_id,'shot-one',1) THEN RAISE EXCEPTION 'Restored positive graph failed'; END IF;
 RAISE NOTICE 'Helper positive/negative fixtures passed (local only).';
END $$;
ROLLBACK;
-- Additional two-session concurrency proof is still required:
-- A: BEGIN; SELECT id FROM director_projects WHERE id=<fixture> FOR UPDATE;
--    append upstream revocation; leave transaction open.
-- B: reserve/claim the fixture job: must wait on the project lock.
-- A: COMMIT; B must reject creative_dependencies_not_approved (never call provider).
-- To exercise INSERT/status triggers, create a valid synthetic model/proposal/authorization/
-- work_unit/job inside a rollback fixture and explicitly test the two guarded transitions.
-- This file currently proves helper behavior only; it does NOT claim those integration tests.

// Existing isolated PostgreSQL/WASM infrastructure; never a hosted migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {registryCandidate} from './registry-fixture-server.mjs';
import {planningRequiredSchemaHash} from '../planning-profile.mjs';
import {newProject} from '../domain.mjs';
const prior=['director-foundation.sql','director-registry-seed.sql','director-registry-roles.sql','director-project-persistence.sql','director-route-freshness.sql','director-server-only-access.sql','director-dispatch-claims.sql','20261017235051_production_record_currentness.sql','director-recursive-approval-guards.sql','director-durable-quotes.sql','20261018002640_director_operational_controls.sql','director-planning-consent.sql','director-structured-brief-planning.sql','director-screenplay-planning.sql','director-registry-management.sql','director-department-planning.sql','director-department-revisions.sql','director-storyboard-handoff.sql','director-reference-production.sql','director-storyboard-production.sql'];
test('prepared conversation migration extends existing financial contracts and snapshots exact authority',async()=>{
 const db=new PGlite();try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql as 'select null::uuid';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  for(const name of prior)await db.exec(await readFile(new URL('../../../database/'+name,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../../database/director-conversation-planning.sql',import.meta.url),'utf8'));
  const candidate=registryCandidate('O-native-conversation',{operations:['director_turn']});candidate.profile.capabilities.planning.directorConversationVersion='director_conversation_v1';candidate.profile.schema_evidence.inputSchemaHash=planningRequiredSchemaHash(candidate.profile);
  const ready=async profile=>(await db.query('select public.director_registry_review_ready($1,$2,$3) ready',[candidate.modelId,profile,candidate.review])).rows[0].ready;
  assert.equal(await ready(candidate.profile),true);const missing=structuredClone(candidate.profile);delete missing.capabilities.planning.directorConversationVersion;assert.equal(await ready(missing),false,'Native publication must reject an unqualified conversation contract');
  const owner='11111111-1111-4111-8111-111111111111',p=newProject({format:'music_video'},owner);
  await db.query('insert into auth.users(id)values($1)',[owner]);await db.query('insert into public.director_projects(id,owner_id,title,brief)values($1,$2,$3,$4)',[p.id,owner,p.title,p]);
  const snapshot=async()=> (await db.query('select public.director_conversation_snapshot($1) value',[p.id])).rows[0].value;
  const before=await snapshot();p.version++;p.directorSession={kind:'director_session_v1',mode:'create_with_me',messages:[{role:'user',text:'Keep the song.'}],commands:[]};await db.query('update public.director_projects set brief=$1 where id=$2',[p,p.id]);assert.deepEqual(await snapshot(),before,'chat bookkeeping must not change creative authority');
  p.direction='Changed visual world';await db.query('update public.director_projects set brief=$1 where id=$2',[p,p.id]);assert.notDeepEqual(await snapshot(),before);
  const command=(await db.query("select pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure) definition")).rows[0].definition;
  assert.ok(command.includes("'director_turn'"));assert.ok(command.includes("'director-planning-v7'"));assert.ok(command.includes("'director-planning-v3'"));
  const check=(await db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conname='director_planning_reservations_operation_check'")).rows[0].definition;assert.ok(check.includes('director_turn'));
  assert.equal((await db.query("select has_function_privilege('authenticated','public.director_conversation_snapshot(uuid)','EXECUTE') allowed")).rows[0].allowed,false);
  const next={...p,version:p.version+1};
  await db.query('select public.director_save_conversation($1,$2,$3,$4,$5,$6,$7)',[owner,p.id,p.version,null,(await snapshot()).assets,next,[]]);
  assert.equal((await db.query('select brief->>\'version\' value from public.director_projects where id=$1',[p.id])).rows[0].value,String(next.version));
  await assert.rejects(async()=>db.query('select public.director_save_conversation($1,$2,$3,$4,$5,$6,$7)',[owner,p.id,p.version,null,(await snapshot()).assets,next,[]]),/version_conflict/);
  await assert.rejects(()=>db.query('select public.director_save_conversation($1,$2,$3,$4,$5,$6,$7)',[owner,p.id,next.version,null,[{id:'changed'}],{...next,version:next.version+1},[]]),/reference_assets_changed/);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.director_save_conversation(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

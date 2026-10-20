// Focused isolated PostgreSQL/WASM proof. No native migration or network/provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {newProject,artifacts} from '../domain.mjs';
import {applyBriefCommand,currentBrief} from '../public/creative-brief-core.js';
import {applyScreenplayCommand,currentScreenplay,screenplaySourceSignature,screenplayOriginality} from '../public/screenplay-core.js';
import {departmentSourceSignature,DEPARTMENT_IDS,departmentDependencyPolicy} from '../public/department-plan-core.js';
import {songSourceBinding} from '../public/song-intelligence-core.js';

const owner='11111111-1111-4111-8111-111111111111',clone=structuredClone;
const prior=['director-foundation.sql','director-registry-seed.sql','director-registry-roles.sql','director-project-persistence.sql','director-route-freshness.sql','director-server-only-access.sql','director-dispatch-claims.sql','20261017235051_production_record_currentness.sql','director-recursive-approval-guards.sql','director-durable-quotes.sql','20261018002640_director_operational_controls.sql','director-planning-consent.sql','director-structured-brief-planning.sql','director-screenplay-planning.sql','director-registry-management.sql','director-department-planning.sql','director-department-revisions.sql'];
function songRecord(){return {id:randomUUID(),type:'edit',name:'Synthetic song evidence',currentVersion:1,versions:[{version:1,content:{kind:'song_intelligence_v1',master:{assetId:randomUUID(),assetVersion:1,checksum:'a'.repeat(64),durationMs:30000,timingBasis:'user_reviewed'}},references:[],dependencies:[]}]};}
function fixture({music=true,song=true}={}){
 let p=newProject({title:'Song source SQL proof',premise:'A performer waits for the dawn.'},owner);p.format=music?'music_video':'short_film';p.duration=30;
 p=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});
 p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:{title:'Dawn',logline:'A performer waits for dawn.',treatment:'A quiet visual progression.',characters:[],scenes:[{id:'dawn',heading:'EXT. ROOFTOP — DAWN',action:'The city changes from dark to dawn.',dialogue:[],durationSeconds:30}]}});
 if(song)p.production={records:[songRecord()]};
 p.screenplay.versions[0].inputSignature=screenplaySourceSignature(p);
 p.departmentPlanning={sources:[{version:1,inputSignature:departmentSourceSignature(p),createdAt:'2026-10-20T00:00:00.000Z'}],departments:DEPARTMENT_IDS.map(id=>({id,currentVersion:1,versions:[{version:1,sourceVersion:1,document:{applicability:'conditional',rationale:'Synthetic source-currentness proof, not completed production.',summary:'Proof document.',requirements:[],choices:[],handoffs:[],checks:[]},provenance:{kind:'rule',modelCallId:null},createdAt:'2026-10-20T00:00:00.000Z',dependencyContext:{policyVersion:'director-department-dependencies-v1',bindings:departmentDependencyPolicy.find(d=>d.departmentId===id).dependsOn.map(departmentId=>({departmentId,version:1}))}}]})),revisionRequests:[{version:1,departmentIds:['camera'],instruction:'Review camera coverage.',sourceVersion:1,departmentVersions:DEPARTMENT_IDS.map(departmentId=>({departmentId,version:1})),createdAt:'2026-10-20T00:00:00.000Z'}]};
 return p;
}

test('native optional-song source and planning fences preserve existing authority',async t=>{
 const db=new PGlite(),query=(s,a=[])=>db.query(s,a),rpc=async(n,a=[])=>{const result=await query(`select public.${n}(${a.map((_,i)=>'$'+(i+1)).join(',')}) value`,a);return result.rows[0].value;};
 async function denied(fn,pattern){await db.exec('savepoint expected_denial');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint expected_denial;release savepoint expected_denial');}}
 const save=p=>query('update public.director_projects set brief=$1 where id=$2',[p,p.id]);
 async function insertProject(p){await query('insert into public.director_projects(id,owner_id,title,brief)values($1,$2,$3,$4)',[p.id,owner,p.title,p]);for(const a of artifacts(p))await query('insert into public.director_artifacts(project_id,logical_key,kind,version,content,content_hash)values($1,$2,$3,$4,$5,$6)',[p.id,a.logical_key,a.kind,a.version,a.content,a.content_hash]);}
 async function consent(p){return (await query("insert into public.director_planning_consents(project_id,actor_id,scope,profile,model_id,registry_snapshot,max_micro_usd,finish_reserve_micro_usd,max_calls,expires_at,operation)values($1,$2,'{}','{}','M01','{}',1000,0,2,clock_timestamp()+interval '10 minutes','initial_plan')returning id,song_intelligence_snapshot",[p.id,owner])).rows[0];}
 async function reserve(p,c){return (await query("insert into public.director_planning_reservations(project_id,actor_id,consent_id,project_version,operation,request_hash,api_request_fingerprint,api_request,request,bound_quote,profile_fingerprint,quoted_micro_usd,expires_at)values($1,$2,$3,$4,'initial_plan',$5,$5,'{}','{}','{}',$5,1,clock_timestamp()+interval '5 minutes')returning id",[p.id,owner,c.id,p.version,'f'.repeat(64)])).rows[0];}
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql as 'select null::uuid';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  for(const name of prior)await db.exec(await readFile(new URL('../../../database/'+name,import.meta.url),'utf8'));
  await query('insert into auth.users(id)values($1)',[owner]);
  // A pre-increment consent intentionally has no new song snapshot.
  const old=fixture();await insertProject(old);const oldConsent=(await query("insert into public.director_planning_consents(project_id,actor_id,scope,profile,model_id,registry_snapshot,max_micro_usd,finish_reserve_micro_usd,max_calls,expires_at,operation)values($1,$2,'{}','{}','M01','{}',1000,0,2,clock_timestamp()+interval '10 minutes','initial_plan')returning id",[old.id,owner])).rows[0];
  await db.exec(await readFile(new URL('../../../database/director-song-intelligence.sql',import.meta.url),'utf8'));
  await db.exec('begin;set local role service_role');

  await t.test('helper matches JS exact source pin; nonmusic and absent song remain null; malformed/ambiguous records fail closed',async()=>{
   const p=fixture();assert.deepEqual(await rpc('director_song_source_binding',[p]),songSourceBinding(p));assert.equal(await rpc('director_song_source_binding',[fixture({song:false})]),null);assert.equal(await rpc('director_song_source_binding',[fixture({music:false})]),null);
   for(const mutate of [x=>x.production.records.push(songRecord()),x=>x.production.records[0].versions.push(clone(x.production.records[0].versions[0])),x=>x.production.records[0].currentVersion=2,x=>x.production.records[0].id='not-a-uuid',x=>x.production.records[0].versions[0].content.master.checksum='wrong',x=>x.production.records[0].versions[0].content.master.extra=true]){const bad=clone(p);mutate(bad);await denied(()=>rpc('director_song_source_binding',[bad]),/song_intelligence_binding_invalid/);assert.equal(await rpc('director_screenplay_snapshot_current',[bad,1]),false);assert.equal(await rpc('director_department_source_current',[bad,'rights',1]),false);}
  });

  await t.test('native screenplay, 17-department and revision source signatures match JS and invalidate prior song versions without erasing approvals',async()=>{
   for(const p of [fixture(),fixture({song:false}),fixture({music:false})]){
    assert.equal(await rpc('director_screenplay_snapshot_current',[p,1]),true);for(const id of DEPARTMENT_IDS)assert.equal(await rpc('director_department_snapshot_current',[p,id,1]),true);assert.equal(await rpc('director_department_revision_source_current',[p,1]),true);assert.equal(await rpc('director_department_revision_request_current',[p]),true);
   }
   const p=fixture();await insertProject(p);
   const briefId=(await query("select id from public.director_artifacts where project_id=$1 and logical_key='brief' and version=$2",[p.id,currentBrief(p).version])).rows[0].id;
   await query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'approved')",[p.id,briefId,owner]);
   await rpc('director_approve_screenplay',[owner,p.id,p.version,1,p.screenplay,screenplayOriginality(p),true,'approved']);for(const id of DEPARTMENT_IDS)await rpc('director_approve_department',[owner,p.id,p.version,id,1,p.departmentPlanning,true,'approved']);
   assert.equal(await rpc('director_current_screenplay_approved',[p.id]),true);assert.equal(await rpc('director_current_departments_approved',[p.id]),true);const count=Number((await query('select count(*)n from public.director_approvals where project_id=$1',[p.id])).rows[0].n);
   const changed=clone(p),record=changed.production.records[0];record.currentVersion=2;record.versions.push({...clone(record.versions[0]),version:2});await save(changed);
   assert.equal(await rpc('director_screenplay_snapshot_current',[changed,1]),false);assert.equal(await rpc('director_department_revision_source_current',[changed,1]),false);assert.equal(await rpc('director_department_revision_request_current',[changed]),false);assert.equal(await rpc('director_current_screenplay_approved',[p.id]),false);assert.equal(await rpc('director_current_departments_approved',[p.id]),false);assert.equal(Number((await query('select count(*)n from public.director_approvals where project_id=$1',[p.id])).rows[0].n),count);
   await denied(()=>rpc('director_approve_department',[owner,p.id,p.version,'camera',1,p.departmentPlanning,true,'approved']),/department_review_required|artifact_superseded/);
   const legacy=fixture({song:false});legacy.production={records:[songRecord()]};assert.equal(await rpc('director_screenplay_snapshot_current',[legacy,1]),false);assert.equal(await rpc('director_department_revision_source_current',[legacy,1]),false);
  });

  await t.test('exact song snapshot fences new reservation/claim, old grants and snapshot mutation while preserving known-result accounting',async()=>{
   await denied(()=>reserve(old,oldConsent),/planning_song_scope_changed/);
   const p=fixture();await insertProject(p);const grant=await consent(p);assert.deepEqual(grant.song_intelligence_snapshot,songSourceBinding(p));const held=await reserve(p,grant),known=await reserve(p,grant);await query('update public.director_planning_reservations set submit_claimed=true where id=$1',[known.id]);
   const changed=clone(p),record=changed.production.records[0];record.currentVersion=2;record.versions.push({...clone(record.versions[0]),version:2});await save(changed);
   await denied(()=>reserve(changed,grant),/planning_song_scope_changed/);await denied(()=>query('update public.director_planning_reservations set submit_claimed=true where id=$1',[held.id]),/planning_song_scope_changed/);
   await denied(()=>query('update public.director_planning_consents set song_intelligence_snapshot=$1 where id=$2',[songSourceBinding(changed),grant.id]),/planning_song_snapshot_immutable/);
   await query("update public.director_planning_reservations set provider_response_id='resp_known_song_proof',status='completed',actual_micro_usd=1 where id=$1",[known.id]);assert.equal((await query('select status from public.director_planning_reservations where id=$1',[known.id])).rows[0].status,'completed');
   const after=await consent(changed);assert.deepEqual(after.song_intelligence_snapshot,songSourceBinding(changed));assert.ok((await reserve(changed,after)).id);
   const plain=fixture({music:false});await insertProject(plain);const nonmusic=await consent(plain);assert.equal(nonmusic.song_intelligence_snapshot,null);assert.ok((await reserve(plain,nonmusic)).id);
  });

  await t.test('helper/guards retain service-only invoker access, empty search paths and existing RLS',async()=>{
   const names=['director_song_source_binding','director_capture_planning_song','director_guard_planning_song','director_guard_song_consent_snapshot','director_screenplay_snapshot_current','director_department_source_current','director_department_revision_source_current'];
   const security=(await query("select count(*)::integer n,bool_and(not p.prosecdef and p.proconfig @> array['search_path=\"\"'])safe,bool_and(has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE'))scoped from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[])",[names])).rows[0];assert.equal(security.n,names.length);assert.equal(security.safe,true);assert.equal(security.scoped,true);
   assert.equal((await query("select bool_and(relrowsecurity)ok from pg_class where oid in('public.director_planning_consents'::regclass,'public.director_planning_reservations'::regclass,'public.director_projects'::regclass)")).rows[0].ok,true);assert.equal(Number((await query('select count(*)n from public.director_models where active')).rows[0].n),0);assert.equal((await query('select generation_paused from public.director_operational_controls where id=1')).rows[0].generation_paused,true);
  });
  await db.exec('rollback');
 }finally{await db.close();}
});

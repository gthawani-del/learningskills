import {createPrivateSongRenderWorker} from '../render-worker.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {LocalStore} from '../store.mjs';
import {saveMusicVideoTimeline} from '../music-video-editing.mjs';
import {musicVideoEditingFixture} from './music-video-editing-fixture.mjs';
import * as renders from '../render-jobs.mjs';
const run=promisify(execFile),digest=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const f=musicVideoEditingFixture();f.project=saveMusicVideoTimeline(f.project,f.body,f.assets,f.approvals,f.outcomes);f.project.title='Test song';f.project.stage='edit';
 const timeline=f.project.production.records.at(-1),timelineId=timeline.id,content=timeline.versions[0].content;
 f.approvals.push({id:randomUUID(),projectId:f.project.id,artifactId:'record:'+timelineId,version:1,decision:'approved'});
 const store=new LocalStore();Object.assign(store,renders.localRenderMethods);store.state.projects.push(f.project);store.state.projectBudgets=[{projectId:f.project.id,budgetMicroUsd:100,finishReserveMicroUsd:10}];store.state.assets.push(...f.assets);store.state.approvals.push(...f.approvals);store.state.audit.push(...f.outcomes);
 const request={actorId:f.project.ownerId,projectId:f.project.id,expectedVersion:f.project.version,timelineId},executor={id:'local-test',quote:async()=>({maxMicroUsd:5,expiresAt:new Date(Date.now()+60000).toISOString()})};
 return {...f,store,request,executor,content};
}

async function reserve(f,key=randomUUID()) {const q=await renders.quoteRenderJob({...f.request,store:f.store,executor:f.executor});return renders.requestRenderJob({...f.request,store:f.store,quoteId:q.id,idempotencyKey:key,maxMicroUsd:5,acknowledgeRender:true});}
test('render requests bind approved current timeline, trusted quote and explicit idempotent cap',async()=>{
 assert.equal(typeof renders.quoteRenderJob,'function');const f=fixture();await assert.rejects(()=>renders.quoteRenderJob({...f.request,store:f.store}),/executor/);
 const q=await renders.quoteRenderJob({...f.request,store:f.store,executor:f.executor}),c={...f.request,store:f.store,quoteId:q.id,idempotencyKey:randomUUID(),maxMicroUsd:5,acknowledgeRender:true};
 await assert.rejects(()=>renders.requestRenderJob({...c,maxMicroUsd:4}),/cap/);const j=await renders.requestRenderJob(c);assert.equal(j.status,'reserved');assert.equal((await renders.requestRenderJob(c)).id,j.id);
 await assert.rejects(()=>renders.requestRenderJob({...c,maxMicroUsd:6}),/identity/);
 f.store.state.approvals.push({...f.store.state.approvals[0],id:randomUUID(),decision:'revoked'});await assert.rejects(()=>f.store.claimRenderJob(j.id,randomUUID(),60),/approv/i);
});
test('render leases fence late results and quarantine expired execution without replay',async()=>{
 const f=fixture(),j=await reserve(f),token=randomUUID();assert.ok(await f.store.claimRenderJob(j.id,token,60));assert.equal((await f.store.readRenderJob(f.request.actorId,f.project.id,j.id)).claimToken,undefined);assert.equal(await f.store.claimRenderJob(j.id,randomUUID(),60),null);
 await assert.rejects(()=>f.store.heartbeatRenderJob(j.id,randomUUID(),60),/lease/);await f.store.heartbeatRenderJob(j.id,token,60);
 f.store.state.renderJobs[0].leaseUntil=new Date(0).toISOString();assert.equal((await f.store.recoverRenderJob(j.id)).status,'unknown');assert.equal(await f.store.claimRenderJob(j.id,randomUUID(),60),null);
 await assert.rejects(()=>f.store.finishRenderJob(j.id,token,{status:'completed'}),/lease/);await assert.rejects(()=>reserve(f),/existing/);
});
test('unknown executor outcome never dispatches again',async()=>{
 const f=fixture(),j=await reserve(f);let calls=0;const executor={...f.executor,execute:async()=>{calls++;throw Error('unknown');}};
 await assert.rejects(()=>renders.runRenderJob({store:f.store,renderId:j.id,executor,publish:async()=>{}}),/not confirmed/);
 assert.equal((await f.store.readRenderJob(f.request.actorId,f.request.projectId,j.id)).status,'unknown');await renders.runRenderJob({store:f.store,renderId:j.id,executor,publish:async()=>{}});assert.equal(calls,1);
});
test('actual supplied renderer output is verified, privately published and persisted once',async()=>{
 const root=await mkdtemp(join(tmpdir(),'director-render-job-')),f=fixture();
 try{
  await run('ffmpeg',['-v','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=8000:duration=4','-c:a','pcm_s16le','-f','wav',join(root,f.assets[0].id)]);const bytes=await readFile(join(root,f.assets[0].id));f.assets[0].checksum=digest(bytes);f.content.songPlan.master.checksum=f.assets[0].checksum;f.store.state.assets[0].checksum=f.assets[0].checksum;for(const r of f.project.production.records)if(r.versions[0].content.master)r.versions[0].content.master.checksum=f.assets[0].checksum;
  await run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24:d=6','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-f','mp4',join(root,f.assets[1].id)]);f.assets[1].checksumAlgorithm='sha256-bytes';f.assets[1].checksum=digest(await readFile(join(root,f.assets[1].id)));f.outcomes[0].details.asset.checksum=f.assets[1].checksum;
  for(const asset of f.assets){asset.bucket='director-source-media';asset.storageKey=`${f.project.ownerId}/${f.project.id}/${asset.id}`;}
  const executor=f.executor,j=await reserve(f);let publications=0;
  const publish=async({bytes,...receipt})=>{publications++;await mkdir(join(root,'private'),{recursive:true});await writeFile(join(root,'private',receipt.assetId),bytes,{mode:0o600});return receipt;};
  const worker=createPrivateSongRenderWorker({store:f.store,executorId:'local-test',reportActual:async()=>0,storage:{get:key=>readFile(join(root,key.split('/').at(-1))),putIfAbsent:async(key,bytes,mime,checksum,{bucket})=>{assert.equal(digest(bytes),checksum);await publish({bytes,assetId:j.id,storageKey:key,mime,bucket});}}});
  const result=await worker.run({actorId:f.project.ownerId,projectId:f.project.id,renderId:j.id});assert.equal(result.status,'completed');assert.equal(result.result.generated.kind,'finished_movie');assert.equal(result.result.generated.masterChecksum,f.assets[0].checksum);assert.equal(result.result.generated.renderId,j.id);assert.equal(result.result.bucket,'director-source-media');assert.equal(result.result.durationSeconds,4);assert.equal(result.result.streams.video.frameCount,96);assert.equal(f.store.state.assets.filter(a=>a.generated?.renderId===j.id).length,1);const stored=await f.store.readRenderJob(f.request.actorId,f.project.id,j.id),listed=await f.store.readRenderJobs(f.request.actorId,f.project.id);assert.deepEqual(stored.asset,stored.result);assert.deepEqual(listed[0].asset,stored.asset);assert.equal(f.store.state.renderJobs[0].asset,undefined);
  await worker.run({actorId:f.project.ownerId,projectId:f.project.id,renderId:j.id});assert.equal(publications,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('render reservations share project cap with concurrent media and preserve finish reserve',async()=>{
 const f=fixture();f.store.state.jobs.push({project_id:f.project.id,charge_state:'held',reserved_micro_usd:86});await assert.rejects(()=>reserve(f),/spending cap/);
 f.store.state.jobs[0].reserved_micro_usd=85;const j=await reserve(f);assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),5);
 f.store.state.jobs[0].charge_state='settled';f.store.state.jobs[0].actual_micro_usd=90;assert.throws(()=>renders.assertRenderReservation(f.store.state,f.project.id,0),/spending cap/);
 f.store.state.renderJobs[0].status='completed';f.store.state.renderJobs[0].actualMicroUsd=8;assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),8);
});

test('prepared render RPC enforces service-only access, approval fencing and shared cap in PostgreSQL',async()=>{
 const {PGlite}=await import('@electric-sql/pglite'),db=new PGlite(),f=fixture(),q=await renders.quoteRenderJob({...f.request,store:f.store,executor:f.executor});
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table director_projects(id uuid primary key,owner_id uuid,brief jsonb,title text,stage text,budget_micro_usd bigint,finish_reserve_micro_usd bigint);create table director_assets(id uuid primary key,project_id uuid,kind text,storage_key text,metadata jsonb,rights_evidence jsonb);create table director_artifacts(id uuid primary key,project_id uuid,logical_key text,version int);create table director_approvals(id uuid primary key,project_id uuid,artifact_id uuid,decision text,ordinal bigint);create table director_audit_events(id uuid primary key,project_id uuid,event_type text,details jsonb);create table director_jobs(project_id uuid,reserved_micro_usd bigint,actual_micro_usd bigint,charge_state text);grant usage on schema public to service_role;grant select,insert,update on all tables in schema public to service_role;");
  await db.query('insert into auth.users values($1)',[f.request.actorId]);await db.query("insert into director_projects values($1,$2,$3,'Test song','edit',100,10)",[f.project.id,f.request.actorId,f.project]);
  for(const asset of f.assets)await db.query("insert into director_assets(id,project_id,kind,storage_key,metadata) values($1,$2,$3,'private',$4)",[asset.id,f.project.id,asset.mime,asset]);
  let artifact;let ordinal=0;for(const approval of f.store.state.approvals){const id=randomUUID();if(approval.artifactId==='record:'+f.request.timelineId)artifact=id;await db.query('insert into director_artifacts values($1,$2,$3,1)',[id,f.project.id,approval.artifactId]);await db.query("insert into director_approvals values($1,$2,$3,'approved',$4)",[approval.id,f.project.id,id,++ordinal]);}for(const event of f.outcomes)await db.query("insert into director_audit_events values($1,$2,'production_outcome',$3)",[event.id,f.project.id,event.details]);
  await db.exec(await readFile(new URL('../../../database/director-render-jobs.sql',import.meta.url),'utf8'));await db.exec('set role service_role');
  const rpc=async(action,c)=>(await db.query('select public.director_render_command($1,$2) value',[action,c])).rows[0].value;
  await rpc('quote',{...f.request,quote:q});const c={...f.request,quoteId:q.id,idempotencyKey:randomUUID(),maxMicroUsd:5,acknowledgeRender:true};
  await db.query("insert into director_jobs values($1,86,null,'held')",[f.project.id]);await assert.rejects(()=>rpc('reserve',c),/spending_cap/);await db.query('update director_jobs set reserved_micro_usd=85');
  const job=await rpc('reserve',c);assert.equal((await rpc('reserve',c)).id,job.id);await assert.rejects(()=>db.query("insert into director_jobs values($1,1,null,'held')",[f.project.id]),/spending_cap/);
  const cancellation={actorId:f.request.actorId,projectId:f.project.id,renderId:job.id,requestId:randomUUID(),reason:'Cancel before the first dispatch.'};
  assert.equal((await rpc('cancel',cancellation)).status,'released');assert.equal((await rpc('cancel',cancellation)).status,'released');await assert.rejects(()=>rpc('cancel',{...cancellation,reason:'Different cancellation.'}),/identity/);await assert.rejects(()=>rpc('cancel',{...cancellation,actorId:randomUUID(),requestId:randomUUID()}),/not_project_owner/);
  assert.equal((await db.query('select public.director_render_budget_snapshot($1,$2) value',[f.request.actorId,f.project.id])).rows[0].value.committedMicroUsd,85);
  const replacement=await rpc('reserve',{...c,idempotencyKey:randomUUID()});assert.notEqual(replacement.id,job.id);
  await db.query("update director_render_jobs set document=jsonb_set(document,'{quote,expiresAt}',to_jsonb('2000-01-01T00:00:00Z'::text)) where id=$1",[replacement.id]);assert.equal(await rpc('claim',{id:replacement.id,token:randomUUID(),leaseSeconds:60}),null);
  const active=await rpc('reserve',{...c,idempotencyKey:randomUUID()});job.id=active.id;
  const budget=(await db.query('select public.director_render_budget_snapshot($1,$2) value',[f.request.actorId,f.project.id])).rows[0].value;assert.equal(budget.committedMicroUsd,90);
  const race=randomUUID();await db.exec('begin');await db.query("insert into director_audit_events values($1,$2,'production_outcome',$3)",[race,f.project.id,{...f.outcomes[0].details,decision:'rejected'}]);await assert.rejects(()=>rpc('claim',{id:job.id,token:randomUUID(),leaseSeconds:60}),/sources_or_approval/);await db.exec('rollback');
  await db.exec('begin');await db.query("update director_projects set brief=jsonb_set(brief,'{production,records,1,versions,0,content,lyrics,canonicalText}',to_jsonb('Changed canonical'::text)) where id=$1",[f.project.id]);await assert.rejects(()=>rpc('claim',{id:job.id,token:randomUUID(),leaseSeconds:60}),/sources_or_approval/);await db.exec('rollback');
  await db.query("update director_projects set stage='export',brief=jsonb_set(jsonb_set(brief,'{version}',to_jsonb(5)),'{directorSession}',jsonb_build_object('navigation','export')) where id=$1",[f.project.id]);
  const unrelatedArtifact=randomUUID();await db.query('insert into director_artifacts values($1,$2,$3,1)',[unrelatedArtifact,f.project.id,'record:'+randomUUID()]);await db.query("insert into director_approvals values($1,$2,$3,'approved',50)",[randomUUID(),f.project.id,unrelatedArtifact]);await db.query("insert into director_audit_events values($1,$2,'production_outcome',$3)",[randomUUID(),f.project.id,{...f.outcomes[0].details,decision:'rejected',asset:{...f.outcomes[0].details.asset,id:randomUUID()}}]);
  const token=randomUUID();assert.equal((await rpc('claim',{id:job.id,token,leaseSeconds:60})).status,'running');await assert.rejects(()=>rpc('cancel',{...cancellation,renderId:job.id,requestId:randomUUID()}),/claimed|execution/);await assert.rejects(()=>rpc('heartbeat',{id:job.id,token:randomUUID(),leaseSeconds:60}),/lease_stale/);
  await db.query("insert into director_approvals values($1,$2,$3,'revoked',100)",[randomUUID(),f.project.id,artifact]);await assert.rejects(()=>rpc('heartbeat',{id:job.id,token,leaseSeconds:60}),/approval_stale/);
  await db.query("update director_render_jobs set document=jsonb_set(document,'{leaseUntil}',to_jsonb('2000-01-01T00:00:00Z'::text)) where id=$1",[job.id]);assert.equal((await rpc('recover',{id:job.id})).status,'unknown');await assert.rejects(()=>rpc('cancel',{...cancellation,renderId:job.id,requestId:randomUUID()}),/claimed|execution/);assert.equal(await rpc('claim',{id:job.id,token:randomUUID(),leaseSeconds:60}),null);
  await db.exec('reset role');for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>rpc('read',{actorId:f.request.actorId,projectId:f.project.id,id:job.id}),/permission denied/);await assert.rejects(()=>db.query('select * from director_render_jobs'),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();}
});

test('known charges survive an invalid output or uncertain publication',async()=>{
 const f=fixture(),j=await reserve(f);const executor={...f.executor,execute:async()=>({bytes:Buffer.from('invalid mp4'),actualMicroUsd:8})};
 await assert.rejects(()=>renders.runRenderJob({store:f.store,renderId:j.id,executor,publish:async()=>{}}),/not confirmed/);
 const saved=await f.store.readRenderJob(f.request.actorId,f.project.id,j.id);assert.equal(saved.status,'unknown');assert.equal(saved.actualMicroUsd,8);assert.equal(saved.overrun,true);assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),8);
});

test('render quote and claim enforce current song approval, canonical lyrics and accepted source review',async()=>{
 for(const mutate of [f=>f.store.state.approvals.push({...f.store.state.approvals[0],id:randomUUID(),decision:'revoked'}),f=>f.store.state.projects[0].production.records[1].versions[0].content.lyrics.canonicalText='Changed canonical',f=>f.store.state.audit.push({...f.outcomes[0],id:randomUUID(),details:{...f.outcomes[0].details,decision:'rejected',supersedesReviewIds:[f.outcomes[0].id]}})]){
  const f=fixture();mutate(f);await assert.rejects(()=>renders.quoteRenderJob({...f.request,store:f.store,executor:f.executor}),e=>e.status===409);
  const fresh=fixture(),j=await reserve(fresh);mutate(fresh);await assert.rejects(()=>fresh.store.claimRenderJob(j.id,randomUUID(),60),e=>e.status===409);
 }
 const f=fixture(),q=await renders.quoteRenderJob({...f.request,store:f.store,executor:f.executor});f.store.state.audit.push({...f.outcomes[0],id:randomUUID()});await assert.rejects(()=>renders.requestRenderJob({...f.request,store:f.store,quoteId:q.id,idempotencyKey:randomUUID(),maxMicroUsd:5,acknowledgeRender:true}),/conflict|accepted/);
});

test('expired unclaimed renders release holds and permit a fresh same-source reservation',async()=>{
 const f=fixture(),j=await reserve(f);f.store.state.renderJobs[0].quote.expiresAt=new Date(0).toISOString();
 assert.equal(await f.store.claimRenderJob(j.id,randomUUID(),60),null);const released=await f.store.readRenderJob(f.request.actorId,f.project.id,j.id);assert.equal(released.status,'released');assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),0);
 const fresh=await reserve(f);assert.notEqual(fresh.id,j.id);assert.equal(fresh.sourceDigest,j.sourceDigest);assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),5);
});
test('owner cancellation is idempotent only before a render has been claimed',async()=>{
 const f=fixture(),j=await reserve(f),c={actorId:f.request.actorId,projectId:f.project.id,renderId:j.id,requestId:randomUUID(),reason:'Cancel this unclaimed render.'};
 assert.equal(typeof f.store.cancelRenderJob,'function');await assert.rejects(()=>f.store.cancelRenderJob({...c,actorId:randomUUID()}),e=>e.status===404);
 const result=await f.store.cancelRenderJob(c);assert.equal(result.status,'released');assert.deepEqual(await f.store.cancelRenderJob(c),result);await assert.rejects(()=>f.store.cancelRenderJob({...c,reason:'Different request content.'}),/identity/);assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),0);
 const fresh=await reserve(f),token=randomUUID();await f.store.claimRenderJob(fresh.id,token,60);await assert.rejects(()=>f.store.cancelRenderJob({...c,renderId:fresh.id,requestId:randomUUID()}),/claimed|execution/);
 f.store.state.renderJobs.find(r=>r.id===fresh.id).leaseUntil=new Date(0).toISOString();await f.store.recoverRenderJob(fresh.id);await assert.rejects(()=>f.store.cancelRenderJob({...c,renderId:fresh.id,requestId:randomUUID()}),/claimed|execution/);assert.equal(renders.renderExposure(f.store.state.renderJobs,f.project.id),5);
});

test('navigation and unrelated media review do not invalidate an authorized render',async()=>{
 const f=fixture(),j=await reserve(f),p=f.store.state.projects[0];p.version++;p.stage='export';p.directorSession={updatedAt:new Date().toISOString()};
 const unrelated=randomUUID();p.production.records.push({id:unrelated,type:'edit',currentVersion:1,versions:[{version:1,name:'Unrelated notes',content:{notes:'separate work'},references:[],dependencies:[]}]});f.store.state.approvals.push({id:randomUUID(),projectId:p.id,artifactId:'record:'+unrelated,version:1,decision:'approved'});
 f.store.state.audit.push({id:randomUUID(),projectId:p.id,type:'production_outcome',details:{...f.outcomes[0].details,asset:{...f.outcomes[0].details.asset,id:randomUUID()},decision:'rejected'}});
 assert.ok(await f.store.claimRenderJob(j.id,randomUUID(),60));assert.equal(f.store.state.renderJobs[0].status,'running');
});

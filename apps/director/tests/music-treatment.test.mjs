import {applyScreenplayProjectCommand} from '../public/screenplay-project.js';
import {createImportController} from '../imports.mjs';
import {LocalStore} from '../store.mjs';
import {hash} from '../domain.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {musicTreatmentFixture,musicPlanningCall} from './music-treatment-fixture-server.mjs';
import {currentScreenplay,assertScopedScreenplayRevision} from '../public/screenplay-core.js';
import {songDirectorContext,songIntelligenceContext} from '../public/song-intelligence-core.js';
import {editMusicSequence} from '../public/music-treatment-core.js';
import {validateMusicTreatment} from '../public/music-treatment-timing.js';
import {DEPARTMENT_IDS,departmentPlanningContext,currentDepartmentPlan} from '../public/department-plan-core.js';
import {buildPlanningRequest,validatePlanningResult} from '../planning-provider.mjs';
import {call} from './animatic-fixture-server.mjs';
import {songSession} from './song-provider-fixture-server.mjs';
const approveBody=async(f,p=f.project)=>{const ledger=await f.store.records('approvals',p.id),context=departmentPlanningContext(p,ledger);return {expectedVersion:p.version,expectedApprovalId:ledger.at(-1)?.id??null,departmentVersions:context.departments.map(u=>({id:u.id,version:u.current?.version??null})),ackPlanningOnly:true};};

test('timed treatment covers the whole original song and rejects gaps, overlaps, false section links and stale master pins',async()=>{
 const f=await musicTreatmentFixture(),song=songDirectorContext(f.project,await f.store.records('approvals',f.project.id));assert.equal(validateMusicTreatment(f.document,song,{complete:true}).range.endMs,180000);
 for(const edit of [d=>d.musicTiming.sequences[1].startMs++,d=>d.musicTiming.sequences[1].endMs++,d=>d.musicTiming.sequences[0].sectionIds=['invented'],d=>d.musicTiming.source.master.checksum='b'.repeat(64),d=>d.musicTiming.source.version++,d=>d.musicTiming.sequences[0].emotion='',d=>d.musicTiming.sequences[0].roles=['singing']]){const d=structuredClone(f.document);edit(d);assert.throws(()=>validateMusicTreatment(d,song,{complete:true}));}
 assert.deepEqual(song.lyrics.canonicalText,'  नमस्ते\nHello 世界  ');assert.equal(song.unknown.includes('lyric alignment'),true);
});

test('manual scaffold and saved musical treatment remain unapproved until complete source-aware review',async()=>{
 const f=await musicTreatmentFixture(),saved=await f.post('/screenplay',{expectedVersion:f.project.version,action:'save',document:f.draft});f.project=saved.project;assert.equal(saved.screenplayContext.approved,false);
 await assert.rejects(()=>f.post('/approvals',{expectedVersion:f.project.version,artifactId:'screenplay',version:1,decision:'approved',acknowledgeLimitedCoverage:true}),/Complete|Write/);
 const full=await f.post('/screenplay',{expectedVersion:f.project.version,action:'save',document:f.document});f.project=full.project;await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'screenplay',version:2,decision:'approved',acknowledgeLimitedCoverage:true});
 assert.equal((await f.get('/screenplay')).data.screenplayContext.approved,true);assert.equal(f.planning.submits,0);assert.equal(f.counters.submits,0);assert.equal(currentScreenplay(f.project).version,2);
});

test('all seventeen departments contribute timed actionable directions and one action signs off the existing artifact versions',async()=>{
 const f=await musicTreatmentFixture({prepared:true,instrumental:true}),p=f.project,context=departmentPlanningContext(p,await f.store.records('approvals',p.id));assert.deepEqual(context.departments.map(u=>u.id),DEPARTMENT_IDS);
 for(const unit of context.departments){assert.ok(unit.current.document.rationale);assert.ok(unit.current.document.handoffs.length);assert.ok(unit.current.document.requirements.some(r=>r.id==='music_time_1'&&r.sceneIds.includes('music_sequence_1')&&r.direction.includes('0–60000 ms')));}
 assert.equal(context.departments.find(u=>u.id==='voice').current.document.applicability,'not_applicable');
 const body=await approveBody(f),response=await f.post('/music-video/department-package/approve',body);assert.ok(response.departmentContext.departments.every(u=>u.approved));assert.equal(response.approvals.filter(a=>a.artifactId.startsWith('department:')).length,17);
 assert.equal(response.departmentContext.assetsApproved,false);assert.equal(response.departmentContext.generationAuthorized,false);assert.equal(f.counters.submits,0);assert.equal(f.planning.submits,0);
 await assert.rejects(()=>f.post('/music-video/department-package/approve',body),{status:409});
 const replay=await f.post('/music-video/department-package/approve',await approveBody(f));assert.equal(replay.approvals.length,response.approvals.length);
});

test('package rejects foreign/stale/injected requests and a changed approval ledger before any new signoff',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),body=await approveBody(f),path=f.base+'/music-video/department-package/approve';
 for(const token of [null,'foreign-fixture-session'])assert.equal((await call(f.handler,path,body,token)).status,token?404:401);
 for(const patch of [{expectedVersion:1},{expectedApprovalId:randomUUID()},{departmentVersions:body.departmentVersions.slice(1)},{ackPlanningOnly:false},{approved:true}])await assert.rejects(()=>f.post('/music-video/department-package/approve',{...body,...patch}),{status:409});
 assert.equal((await f.store.records('approvals',f.project.id)).filter(a=>a.artifactId.startsWith('department:')).length,0);
});

test('interrupted package signoff retains valid history and resumes without duplicate approvals or paid work',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),approve=f.store.approve.bind(f.store);let count=0;f.store.approve=async(...args)=>{if(++count===5)throw Object.assign(Error('Synthetic interrupted approval'),{status:503});return approve(...args);};
 await assert.rejects(async()=>f.post('/music-video/department-package/approve',await approveBody(f)),{status:503});let ledger=await f.store.records('approvals',f.project.id);assert.equal(ledger.filter(a=>a.artifactId.startsWith('department:')).length,4);assert.equal(departmentPlanningContext(f.project,ledger).departments.every(u=>u.approved),false);
 f.store.approve=approve;const result=await f.post('/music-video/department-package/approve',await approveBody(f));assert.ok(result.departmentContext.departments.every(u=>u.approved));assert.equal(result.approvals.filter(a=>a.artifactId.startsWith('department:')).length,17);
});

test('focused musical corrections preserve other sequences, original lyrics, character references and prior department snapshots',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),before=structuredClone(f.project),ledger=await f.store.records('approvals',before.id);
 const next=editMusicSequence(before,ledger,'music_sequence_1',{action:'The traveller pauses at the door and listens.',emotion:'Resolve replaces hesitation.'});
 assert.deepEqual(next.musicTiming.sequences.slice(1),currentScreenplay(before).document.musicTiming.sequences.slice(1));assert.deepEqual(next.characters,currentScreenplay(before).document.characters);
 const saved=await f.post('/screenplay',{expectedVersion:before.version,action:'save',document:next});assert.deepEqual(saved.project.departmentPlanning,before.departmentPlanning);assert.deepEqual(saved.project.referenceProduction,before.referenceProduction);assert.deepEqual(songIntelligenceContext(saved.project,ledger).document.lyrics,songIntelligenceContext(before,ledger).document.lyrics);assert.equal(saved.project.screenplay.versions.length,2);
 assertScopedScreenplayRevision(currentScreenplay(before).document,next,{instruction:'Only this scene.',sceneIds:['music_sequence_1']});const bad=structuredClone(next);bad.musicTiming.sequences[1].emotion='Unrequested change';assert.throws(()=>assertScopedScreenplayRevision(currentScreenplay(before).document,bad,{instruction:'Only this scene.',sceneIds:['music_sequence_1']}),/unselected/);
 const cut=editMusicSequence(before,ledger,'music_sequence_1',{cutAfterMs:65000});assert.equal(cut.musicTiming.sequences[1].startMs,65000);assert.deepEqual(cut.musicTiming.sequences[2],next.musicTiming.sequences[2]);assert.equal(cut.scenes[0].durationSeconds,65);assert.deepEqual(cut.musicTiming.sequences[0].sectionIds,['passage_0','passage_1']);
});

test('shared authorized OpenAI planning uses timed schema and saved proposal application without auto-approval or real provider quality claims',async()=>{
 const f=await musicTreatmentFixture(),run=await musicPlanningCall(f,'write_script');const id=run.call?.id||run.id;assert.ok(id,JSON.stringify(run));assert.equal(f.planning.submits,1);assert.equal(currentScreenplay(await f.store.get(f.project.id,f.project.ownerId)),null);
 const request=f.planning.requests[0];assert.ok(request.body.text.format.schema.required.includes('musicTiming'));assert.match(request.body.instructions,/Timed music-treatment contract/);assert.equal(validatePlanningResult(f.document,request).musicTiming.range.endMs,180000);
 const result=await f.post('/screenplay/apply-proposal',{expectedVersion:f.project.version,callId:id});f.project=result.project;assert.equal(result.screenplayContext.approved,false);assert.equal(currentScreenplay(f.project).provenance.modelCallId,id);
 await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'screenplay',version:1,decision:'approved',acknowledgeLimitedCoverage:true});
 const departments=await musicPlanningCall(f,'plan_departments'),departmentId=departments.call?.id||departments.id;const applied=await f.post('/department-plans/apply-proposal',{expectedVersion:f.project.version,callId:departmentId});assert.equal(applied.departmentContext.departments.length,17);assert.ok(applied.departmentContext.departments.every(u=>u.current.provenance.kind==='model'&&!u.approved));assert.equal(f.planning.submits,2);
});

test('old non-music request schema is unchanged and an unqualified music result cannot claim valid timing',async()=>{
 const f=await musicTreatmentFixture(),context={approved:true,status:'approved',screenplay:{inputSignature:'fixture',sources:[],current:null}},legacy=buildPlanningRequest({brief:'Original fixture',duration:180,model:'synthetic',maxOutputTokens:100,operation:'write_script',context});assert.equal(legacy.body.text.format.schema.required.includes('musicTiming'),false);assert.equal(legacy.body.instructions.includes('Timed music-treatment contract'),false);
 const request={...legacy};assert.equal(request.version,'director-planning-v3');const d=structuredClone(f.document);delete d.musicTiming;const song=songDirectorContext(f.project,await f.store.records('approvals',f.project.id));assert.throws(()=>validateMusicTreatment(d,song),/timing/);
});

test('saved targeted department AI revision changes only selected plans and flags dependent reviews',async()=>{
 const f=await musicTreatmentFixture({prepared:true});await f.post('/music-video/department-package/approve',await approveBody(f));const before=structuredClone(f.project);
 const requested=await f.post('/department-plans',{expectedVersion:before.version,action:'request_revision',departmentIds:['camera'],instruction:'Refine camera movement only; preserve all other approved decisions.'});f.project=requested.project;
 const run=await musicPlanningCall(f,'revise_departments'),result=await f.post('/department-plans/apply-proposal',{expectedVersion:f.project.version,callId:run.call.id});f.project=result.project;
 assert.equal(currentDepartmentPlan(f.project,'camera').version,2);assert.equal(currentDepartmentPlan(f.project,'rights').version,1);
 for(const id of DEPARTMENT_IDS.filter(id=>id!=='camera'))assert.deepEqual(currentDepartmentPlan(f.project,id),currentDepartmentPlan(before,id));
 assert.equal(result.departmentContext.departments.find(u=>u.id==='rights').approved,true);assert.equal(result.departmentContext.departments.find(u=>u.id==='camera').approved,false);assert.ok(result.departmentContext.departments.some(u=>u.dependencyStale));
 assert.equal(f.planning.submits,1);assert.equal(f.counters.submits,0);
});

test('a concurrent project change interrupts package signoff without falsely approving the complete package',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),approve=f.store.approve.bind(f.store);let changed=false;
 f.store.approve=async(...args)=>{const result=await approve(...args);if(!changed){changed=true;const p=await f.store.get(f.project.id,f.project.ownerId);await f.store.save({...p,version:p.version+1},p.version);}return result;};
 const body=await approveBody(f);await assert.rejects(()=>f.post('/music-video/department-package/approve',body),{status:409});
 const ledger=await f.store.records('approvals',f.project.id);assert.equal(ledger.filter(a=>a.artifactId.startsWith('department:')).length,1);
});


test('device-to-cloud import maps timed treatment media references and strips approval authority',async()=>{
 const f=await musicTreatmentFixture({prepared:true,durationSeconds:30}),source=structuredClone(f.project),checksum=hash(f.original.toString('base64'));
 source.id='device-'+source.id;source.approvals=(await f.store.records('approvals',f.project.id));
 for(const record of source.production.records)for(const v of record.versions)if(v.content.master)v.content.master.checksum=checksum;
 for(const v of source.screenplay.versions)v.document.musicTiming.source.master.checksum=checksum;
 const manifest={...f.asset,checksum},store=await new LocalStore().init(),importer=createImportController({store,storage:{putIfAbsent:async()=>{}}}),owner=randomUUID();
 const pending=await importer.start(owner,{sourceId:source.id,project:source,assets:[manifest]});const asset=await importer.upload(owner,pending.id,f.asset.id,{bytes:f.original,mime:f.asset.mime}),copied=await importer.complete(owner,pending.id);
 assert.equal(currentScreenplay(copied).document.musicTiming.source.master.assetId,asset.id);assert.equal(currentScreenplay(copied).document.musicTiming.source.master.checksum,checksum);assert.deepEqual(currentScreenplay(copied).document.scenes,currentScreenplay(source).document.scenes);assert.deepEqual(await store.records('approvals',copied.id),[]);assert.equal(copied.approvals,undefined);assert.equal(songIntelligenceContext(copied,[]).approved,false);
});


test('saved scene-scoped writing revisions preserve unselected timing and reject an overreaching model proposal',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),before=structuredClone(f.project),ledger=await f.store.records('approvals',before.id);
 const next=editMusicSequence(before,ledger,'music_sequence_1',{action:'The traveller holds the door, listens, then steps into the light.'});
 const requested=await f.post('/screenplay',{expectedVersion:before.version,action:'set_revision',revisionRequest:{instruction:'Refine only the first visual sequence; keep original timing and every other decision.',sceneIds:['music_sequence_1']}});f.project=requested.project;f.planning.output=next;
 const run=await musicPlanningCall(f,'revise_script'),request=f.planning.requests.at(-1),bad=structuredClone(next);bad.musicTiming.sequences[2].performance='Unrequested replacement direction';assert.throws(()=>validatePlanningResult(bad,request),/unselected/);
 const applied=await f.post('/screenplay/apply-proposal',{expectedVersion:f.project.version,callId:run.call.id});assert.equal(applied.screenplayContext.approved,false);assert.deepEqual(currentScreenplay(applied.project).document.musicTiming.sequences.slice(1),currentScreenplay(before).document.musicTiming.sequences.slice(1));assert.deepEqual(applied.project.departmentPlanning,before.departmentPlanning);assert.equal(f.planning.submits,1);
});


test('performance-only sequence revisions flag only linked shots and retain their selected media',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),ledger=await f.store.records('approvals',f.project.id),project={...f.project,shots:[{id:'first',sceneId:'music_sequence_1',version:1,status:'approved',clipAssetId:'retained-first-take'},{id:'second',sceneId:'music_sequence_2',version:4,status:'approved',clipAssetId:'retained-second-take'}]},document=editMusicSequence(project,ledger,'music_sequence_1',{performance:'A settled gaze follows a specific visible trigger; keep hands still.'});
 const next=applyScreenplayProjectCommand(project,{expectedVersion:project.version,action:'save',document},ledger);assert.equal(next.shots[0].version,2);assert.equal(next.shots[0].status,'draft');assert.equal(next.shots[0].clipAssetId,'retained-first-take');assert.deepEqual(next.shots[1],project.shots[1]);assert.deepEqual(next.production,project.production);
});


test('complete 100-sequence musical treatment fits the existing department contract without dropping scene coverage',async()=>{
 const f=await musicTreatmentFixture(),d=structuredClone(f.document),source=d.musicTiming;
 d.scenes=Array.from({length:100},(_,i)=>({id:'sequence_'+i,heading:'Visual passage '+i,action:'An explicitly authored fixture action, not generated media.',dialogue:[],durationSeconds:1.8}));
 source.sequences=d.scenes.map((scene,i)=>({...structuredClone(source.sequences[0]),sceneId:scene.id,startMs:i*1800,endMs:(i+1)*1800,sectionIds:['passage_'+Math.floor(i*1800/60000),...((i+1)*1800>Math.min(180000,(Math.floor(i*1800/60000)+1)*60000)?['passage_'+(Math.floor(i*1800/60000)+1)]:[])]}));
 let result=await f.post('/screenplay',{expectedVersion:f.project.version,action:'save',document:d});f.project=result.project;await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'screenplay',version:1,decision:'approved',acknowledgeLimitedCoverage:true});result=await f.post('/department-plans',{expectedVersion:f.project.version,action:'prepare'});
 for(const unit of result.departmentContext.departments){assert.ok(unit.current.document.requirements.length<=120);const covered=new Set(unit.current.document.requirements.filter(r=>r.id.startsWith('music_time_')).flatMap(r=>r.sceneIds));assert.equal(covered.size,100);}
});

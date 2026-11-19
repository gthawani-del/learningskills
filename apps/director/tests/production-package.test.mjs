// Synthetic offline recommendations; no provider/media-quality acceptance or paid calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,hash,artifacts} from '../domain.mjs';
import {recordArtifacts} from '../production-records.mjs';
import {musicTreatmentFixture,musicReferenceFixture} from './music-treatment-fixture-server.mjs';
import {overlappingSections} from '../public/music-treatment-core.js';
import {songDirectorContext} from '../public/song-intelligence-core.js';
import * as packageModule from '../production-package.mjs';
const now='2026-11-19T10:00:00.000Z';
const build=args=>packageModule.buildProductionPackage({...args,now});
async function fixture(){
 const f=await musicTreatmentFixture({prepared:true,cast:true}),approvals=await f.store.records('approvals',f.project.id),song=songDirectorContext(f.project,approvals),document=f.project.screenplay.versions.at(-1).document;
 // Deliberately uneven fixture cuts catch invented equal-spacing recommendations.
 const cuts=[0,17000,117000,180000];document.musicTiming.sequences.forEach((s,i)=>{s.startMs=cuts[i];s.endMs=cuts[i+1];s.sectionIds=overlappingSections(song,s.startMs,s.endMs);document.scenes[i].durationSeconds=(s.endMs-s.startMs)/1000;});
 return {project:f.project,approvals,assets:await f.store.records('assets',f.project.id)};
}

test('synthetic missing analysis remains a hold without invented sections, cast or evenly spaced shots',()=>{
 const project=newProject({format:'music_video',title:'Unknown song'},'owner'),before=structuredClone(project),p=build({project});
 assert.equal(p.status,'held');assert.deepEqual(p.recommendation.sequences,[]);assert.deepEqual(p.recommendation.cast,[]);assert.deepEqual(p.recommendation.shots,[]);assert.match(p.holds.join(' '),/song/i);assert.equal(p.generationAuthorized,false);assert.ok(p.stages.every(s=>s.ready||s.holds.length>0));assert.equal(p.costs.wholePlanTotalMicroUsd,null);assert.deepEqual(project,before);
});

test('synthetic package preserves actual full-song treatment and all 17 department documents across modes',async()=>{
 const input=await fixture(),before=structuredClone(input),p=build({...input,mode:'plan_for_me'}),collaborative=build({...input,mode:'create_with_me'}),d=input.project.screenplay.versions.at(-1).document;
 assert.equal(p.recommendation.concept,d.logline);assert.equal(p.recommendation.visualDirection,d.treatment);assert.deepEqual(p.recommendation.sequences,d.musicTiming.sequences.map(s=>({...s,...{heading:d.scenes.find(c=>c.id===s.sceneId).heading,action:d.scenes.find(c=>c.id===s.sceneId).action}})));
 assert.deepEqual(p.recommendation.cast,d.characters);assert.equal(p.coverage.selectedIntervalComplete,true);assert.equal(p.coverage.originalMasterComplete,true);assert.equal(p.departments.length,17);assert.deepEqual(p.departments.map(u=>u.document),input.project.departmentPlanning.departments.map(u=>u.versions.at(-1).document));
 assert.deepEqual(p.recommendation,collaborative.recommendation);assert.equal(p.sourceDigest,collaborative.sourceDigest);assert.notEqual(p.presentation.primaryAction,collaborative.presentation.primaryAction);assert.deepEqual(input,before);
 assert.equal(p.stages.find(s=>s.id==='departments').ready,false);assert.equal(p.stages.find(s=>s.id==='delivery').ready,false);assert.ok(p.protectedDecisions.approvals.length);assert.ok(p.actions.some(a=>a.operation==='review_department_package'));
});

test('synthetic costs itemize only exact current unexpired quoted evidence and never claim a total to finish',async()=>{
 const input=await fixture(),artifact=[...artifacts(input.project),...recordArtifacts(input.project)][0];
 const quote={projectId:input.project.id,projectVersion:input.project.version,artifactId:artifact.logical_key,artifactVersion:artifact.version,artifactContentHash:artifact.content_hash,totalMicroUsd:1234,currency:'USD',createdAt:now,expiresAt:'2026-11-19T10:05:00.000Z',estimateOnly:true,generationAuthorized:false,task:'synthetic_task',modelId:'synthetic',priceEvidence:{verified:true,expiresAt:'2026-11-19T10:05:00.000Z'},schemaEvidence:{verified:true,expiresAt:'2026-11-19T10:05:00.000Z'}};
 const signed=q=>({id:hash(q),...q}),expired={...quote,expiresAt:'2026-11-19T09:00:00.000Z'},p=build({...input,quotes:[signed(quote),signed(quote),signed(expired),{...signed(quote),totalMicroUsd:1}]});
 assert.equal(p.costs.knownQuotedMicroUsd,1234);assert.equal(p.costs.items.filter(i=>i.status==='current_quote').length,1);assert.equal(p.costs.wholePlanTotalMicroUsd,null);assert.ok(p.costs.unknown.length>0);
});

test('synthetic bounded dispatch rejects stale approval/source, forged operations and missing explicit authority, and calls one existing handler',async()=>{
 const input=await fixture(),p=build(input),action=p.actions.find(a=>a.operation==='review_department_package'),request={actionId:action.id,sourceDigest:p.sourceDigest,expectedVersion:p.projectVersion};let calls=0;
 const args={package:p,current:{...input,now},request,handler:async a=>{calls++;return {operation:a.operation};},assertAuthorized:async()=>true};
 assert.deepEqual(await packageModule.dispatchProductionPackageAction(args),{operation:'review_department_package'});assert.equal(calls,1);
 await assert.rejects(()=>packageModule.dispatchProductionPackageAction({...args,assertAuthorized:async()=>false}),{status:403});
 await assert.rejects(()=>packageModule.dispatchProductionPackageAction({...args,current:{...input,now,approvals:[...input.approvals,{id:'changed',artifactId:'screenplay',version:input.project.screenplay.currentVersion,decision:'rejected'}]}}),{status:409});
 await assert.rejects(()=>packageModule.dispatchProductionPackageAction({...args,current:{...input,now,project:{...input.project,direction:'Changed world'}}}),{status:409});
 await assert.rejects(()=>packageModule.dispatchProductionPackageAction({...args,request:{...request,actionId:'arbitrary_tool'}}),{status:409});assert.equal(calls,1);
});


test('synthetic approved cast/reference reuse is revoked when its actual candidate or asset changes',async()=>{
 const f=await musicReferenceFixture(),input={project:f.project,approvals:await f.store.records('approvals',f.project.id),assets:await f.store.records('assets',f.project.id),referenceCandidates:await f.store.referenceCandidates(f.project.ownerId,f.project.id)},p=build(input);
 const pending=build({...input,project:{...input.project,referenceProduction:undefined,storyboardProduction:undefined}});assert.ok(pending.stages.every(s=>s.ready||s.holds.length>0));
 const identity=p.recommendation.assetStrategy.references.find(s=>s.kind==='character_identity');assert.equal(identity.approved,true);assert.equal(p.stages.find(s=>s.id==='references').ready,true);
 const changed=build({...input,assets:input.assets.filter(a=>a.id!==identity.selection.assetId)});assert.equal(changed.recommendation.assetStrategy.references.find(s=>s.subjectId===identity.subjectId).approved,false);assert.notEqual(changed.sourceDigest,p.sourceDigest);
 assert.equal(changed.stages.find(s=>s.id==='references').ready,false);assert.deepEqual(changed.protectedDecisions.selectedReferences.find(s=>s.subjectId===identity.subjectId).selection,identity.selection);
});
test('approved complete-song editing advances the recommendation instead of a permanent planning hold',async()=>{
 const {musicVideoEditingFixture}=await import('./music-video-editing-fixture.mjs'),{saveMusicVideoTimeline}=await import('../music-video-editing.mjs'),{newProject}=await import('../domain.mjs');const f=musicVideoEditingFixture();f.project={...newProject({format:'music_video'},f.project.ownerId),...f.project};f.project.shots[0].description='Reviewed shot.';f.project=saveMusicVideoTimeline(f.project,f.body,f.assets,f.approvals,f.outcomes);const r=f.project.production.records.at(-1);f.approvals.push({id:crypto.randomUUID(),projectId:f.project.id,artifactId:'record:'+r.id,version:r.currentVersion,decision:'approved'});
 const p=packageModule.buildProductionPackage({...f,now:Date.now()});assert.equal(p.stages.find(s=>s.id==='edit').ready,true);assert.equal(p.stages.find(s=>s.id==='motion').ready,true);assert.equal(p.stages.find(s=>s.id==='delivery').ready,false);
});

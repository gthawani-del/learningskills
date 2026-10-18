import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../store.mjs';
import {newProject} from '../domain.mjs';
import {createImportController} from '../imports.mjs';
import {productionState} from '../production-state.mjs';
import {applyBriefCommand,currentBrief,briefInputSignature,briefPlanningContext} from '../public/creative-brief-core.js';

const owner='11111111-1111-4111-8111-111111111111';
const sourceId='device-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const assetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const edit=(project,changes,approvals=[])=>applyBriefCommand(project,{expectedVersion:project.version,action:'update',changes},approvals);
function film(){
 let project=newProject({title:'Letter',premise:'A station keeper finds a letter.',format:'short_film'},owner);
 project=edit(project,{tone:'Restrained',cast:['Mira']});
 project.story={version:project.story.version,treatment:'Mira waits for the last train.',scenes:[{id:'station',description:'The platform at dusk.'}]};
 project.shots=[{id:'shot-1',version:1,status:'approved',title:'Waiting',description:'Mira reads the letter.',duration:5,sceneId:'station',clipAssetId:assetId,referenceAssetId:null,productionBindings:[]}];
 return project;
}
const approvals=project=>[
 {artifactId:'brief',version:currentBrief(project).version,decision:'approved'},
 {artifactId:'story',version:project.story.version,decision:'approved'},
 {artifactId:'shot-1',version:1,decision:'approved'}
];
const assets=project=>[{id:assetId,projectId:project.id,mime:'video/mp4',version:1,role:'shot_reference'}];
const node=(graph,id)=>graph.nodes.find(n=>n.id===id);
async function importer(){
 const store=await new LocalStore().init();
 const storage={putIfAbsent:async()=>{throw Error('This no-media import must not write storage.');}};
 return {store,controller:createImportController({store,storage})};
}
function deviceRequest(project){
 const source=structuredClone(project);source.id=sourceId;source.isLocal=true;
 // Byte migration is independently tested; these copies contain the brief and
 // editable specifications, without an uploaded-media manifest.
 source.shots=source.shots.map(shot=>({...shot,clipAssetId:null,referenceAssetId:null}));
 source.approvals=approvals(project);
 return {sourceId,project:source,assets:[]};
}

test('cloud copies retain validated brief history/signature and require fresh approvals',async()=>{
 const s=await importer(),source=film(),request=deviceRequest(source),before=structuredClone(request);
 const pending=await s.controller.start(owner,request);
 const copied=await s.controller.complete(owner,pending.id);
 assert.notEqual(copied.id,source.id);
 assert.deepEqual(copied.creativeBrief,source.creativeBrief);
 assert.equal(currentBrief(copied).inputSignature,currentBrief(source).inputSignature);
 assert.equal(briefInputSignature(copied),briefInputSignature(source));
 assert.equal(briefPlanningContext(copied,[]).stale,false);
 assert.equal(briefPlanningContext(copied,[]).approved,false);
 assert.equal(copied.approvals,undefined);
 assert.equal(s.store.state.approvals.length,0);
 assert.deepEqual(request,before);
});

test('a manual brief correction changes import identity without a source-text change',async()=>{
 const s=await importer(),source=film(),changed=edit(source,{tone:'Warm and playful'});
 assert.equal(briefInputSignature(changed),briefInputSignature(source));
 const first=await s.controller.start(owner,deviceRequest(source));
 const second=await s.controller.start(owner,deviceRequest(changed));
 assert.notEqual(first.importState.fingerprint,second.importState.fingerprint);
 assert.notEqual(first.id,second.id);
 assert.equal(currentBrief(first).fields.tone.value,'Restrained');
 assert.equal(currentBrief(second).fields.tone.value,'Warm and playful');
 assert.equal(s.store.state.approvals.length,0);
});

test('authority fields embedded anywhere in a brief archive fail before a cloud copy exists',async()=>{
 for(const tamper of [
  brief=>{brief.approved=true;},
  brief=>{brief.versions[0].generationAuthorized=true;},
  brief=>{brief.versions[0].fields.tone.authorization={allowed:true};}
 ]){
  const s=await importer(),request=deviceRequest(film());tamper(request.project.creativeBrief);
  await assert.rejects(()=>s.controller.start(owner,request),error=>error.status===400);
  assert.equal(s.store.state.projects.length,0);
  assert.equal(s.store.state.approvals.length,0);
 }
});

test('revoking or staling a brief holds already approved story and shot specifications',()=>{
 const project=film(),accepted=approvals(project),media=assets(project);
 const ready=productionState(project,media,accepted);
 assert.equal(node(ready,'brief').approved,true);
 assert.equal(node(ready,'story').approved,true);
 assert.equal(node(ready,'shot-1').readyForRouteReview,true);
 const revoked=productionState(project,media,[...accepted,{artifactId:'brief',version:currentBrief(project).version,decision:'revoked'}]);
 assert.equal(node(revoked,'brief').approved,false);
 assert.equal(node(revoked,'story').approved,false);
 assert(node(revoked,'story').holds.some(hold=>/creative brief/i.test(hold)));
 assert.equal(node(revoked,'shot-1').specificationApproved,true);
 assert.equal(node(revoked,'shot-1').readyForRouteReview,false);
 const stale=structuredClone(project);stale.direction='Morning instead of dusk';
 const held=productionState(stale,media,accepted);
 assert(node(held,'brief').holds.some(hold=>/source brief changed/i.test(hold)));
 assert.equal(node(held,'story').approved,false);
 assert.equal(node(held,'shot-1').readyForRouteReview,false);
 assert.equal(held.generationAuthorized,false);
});

test('targeted brief edits invalidate story approval while preserving uploaded media and shot versions',()=>{
 const project=film(),accepted=approvals(project),original=structuredClone(project);
 const changed=edit(project,{tone:'More hopeful'},accepted);
 assert.equal(changed.story.version,project.story.version+1);
 assert.equal(changed.creativeBrief.currentVersion,project.creativeBrief.currentVersion+1);
 assert.equal(changed.story.treatment,project.story.treatment);
 assert.deepEqual(changed.shots,project.shots);
 assert.equal(changed.shots[0].clipAssetId,assetId);
 assert.deepEqual(project,original);
 const held=productionState(changed,assets(changed),accepted);
 assert.equal(node(held,'brief').approved,false);
 assert.equal(node(held,'story').approved,false);
 assert.equal(node(held,'shot-1').specificationApproved,true);
 assert.equal(node(held,'shot-1').readyForRouteReview,false);
 assert.equal(node(held,'asset:'+assetId).version,1);
});

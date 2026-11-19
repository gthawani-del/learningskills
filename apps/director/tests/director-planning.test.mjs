import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildPlanningRequest,validatePlanningResult} from '../planning-provider.mjs';
import {planningRequiredSchemaHash} from '../planning-profile.mjs';
import {buildDirectorContext} from '../director-context.mjs';
import {newProject,hash} from '../domain.mjs';
import {musicTreatmentFixture,musicPlanningCall} from './music-treatment-fixture-server.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';
import {applyDirectorSessionCommand} from '../public/director-session-core.js';

const reply=c=>({kind:'director_conversation_v1',message:'Keep the approved world. Let us review the existing animatic.',sourceDigest:c.sourceDigest,nextAction:{kind:'review_animatic',sceneIds:[],departmentIds:[],instruction:''},limitations:['Text-only planning; no media inspected.']});
test('Director turns have an isolated v7 schema and reject cross-version or forged results',()=>{
 const context=buildDirectorContext({project:newProject({format:'music_video'},'owner')}),request=buildPlanningRequest({brief:'Discuss the song',duration:180,model:'fixture-director-model',maxOutputTokens:1000,operation:'director_turn',context});
 assert.equal(request.version,'director-planning-v7');assert.equal(request.body.text.format.name,'director_conversation');assert.equal(validatePlanningResult(reply(context),request).kind,'director_conversation_v1');
 assert.throws(()=>validatePlanningResult({...reply(context),approved:true},request));
 const changed={...request,version:'director-planning-v3'};changed.requestHash=hash({version:changed.version,body:changed.body});assert.throws(()=>validatePlanningResult(reply(context),changed));
});
async function fixture({instrumental=false}={}){
 const f=await musicTreatmentFixture({prepared:true,instrumental});let p=await f.store.get(f.project.id,f.project.ownerId);p=applyDirectorSessionCommand(p,{requestId:randomUUID(),expectedVersion:p.version,action:'append_user_message',text:'Make the next chorus more emotional without changing the original recording.'});await f.store.save(p,p.version-1);f.project=p;
 const model=reviewedPlanningFixture(f.store.state.models[0],{operations:['write_script','revise_script','plan_departments','revise_departments','director_turn']});model.capabilities.planning.directorConversationVersion='director_conversation_v1';model.schema_evidence.inputSchemaHash=planningRequiredSchemaHash(model);f.store.state.models=[model];let submits=0;
 f.planningProvider.submit=async({request})=>{submits++;const c=JSON.parse(request.body.input).context;return {id:'resp_director_fixture_'+submits,status:'completed',usage:{inputTokens:30,outputTokens:40,cachedInputTokens:0},directorProposal:reply(c)};};return {...f,submits:()=>submits};
}
test('reviewed Director calls reuse scoped consent/reservation and save the result without media generation',async()=>{
 const f=await fixture(),result=await musicPlanningCall(f,'director_turn');assert.equal(result.call.operation,'director_turn');assert.equal(result.call.result.directorProposal.kind,'director_conversation_v1');assert.equal(f.submits(),1);assert.equal(f.store.state.jobs.length,0);
 const saved=await f.store.get(f.project.id,f.project.ownerId);assert.equal(saved.directorSession.messages.filter(m=>m.role==='assistant').length,0,'Call result review must not fabricate a user approval or an appended message');
});
test('missing qualification and paused generation hold conversation before a provider submission',async()=>{
 const f=await fixture();f.store.state.models[0].quality_validated=false;assert.equal((await f.get('/planning/director_turn')).data.availability.enabled,false);assert.equal(f.submits(),0);
 f.store.state.models[0].quality_validated=true;f.store.state.operationalControl.generationPaused=true;await assert.rejects(()=>musicPlanningCall(f,'director_turn'));assert.equal(f.submits(),0);
});
test('real song records preserve instrumental mode and canonical multilingual lyrics in Director context',async()=>{
 for(const instrumental of [false,true]){const f=await fixture({instrumental}),c=buildDirectorContext({project:f.project,approvals:await f.store.records('approvals',f.project.id),assets:await f.store.records('assets',f.project.id)});assert.equal(c.song.lyrics.vocalMode,instrumental?'instrumental':'sung');if(!instrumental)assert.ok(JSON.stringify(c.song.lyrics).includes('世界'));assert.equal(c.songReady,true);}
});
test('an uncertain submission is retained and the same request cannot create another paid call',async()=>{
 const f=await fixture(),p=await f.store.get(f.project.id,f.project.ownerId),q=(await f.get('/planning/director_turn')).data;let submitted=0;
 f.planningProvider.submit=async()=>{submitted++;throw Error('Synthetic transport uncertainty');};
 const consent=(await f.post('/planning-consents',{requestId:randomUUID(),expectedVersion:p.version,operation:'director_turn',expectedModelId:q.quote.modelId,expectedProfileFingerprint:q.quote.profileFingerprint,maxMicroUsd:100000,finishReserveMicroUsd:0,maxCalls:2})).consent;
 const body={requestId:randomUUID(),expectedVersion:p.version,consentId:consent.id,operation:'director_turn'};
 const first=await f.post('/planning-calls',body),again=await f.post('/planning-calls',body);assert.equal(first.call.id,again.call.id);assert.equal(submitted,1);assert.equal(first.call.chargeState,'unknown');assert.equal(first.call.result?.directorProposal,undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {musicTreatmentFixture,musicPlanningCall} from './music-treatment-fixture-server.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';
import {planningRequiredSchemaHash} from '../planning-profile.mjs';
import {buildDirectorContext} from '../director-context.mjs';
import {prepareDirectorAction,recordDirectorReply,applyDirectorAction} from '../director-actions.mjs';
import {applyDirectorSessionCommand} from '../public/director-session-core.js';

async function fixture(kind='prepare_script_revision'){
 const f=await musicTreatmentFixture({prepared:true});let p=applyDirectorSessionCommand(f.project,{requestId:randomUUID(),expectedVersion:f.project.version,action:'append_user_message',text:'Make the second passage more emotional.'});await f.store.save(p,f.project.version);f.project=p;
 const model=reviewedPlanningFixture(f.store.state.models[0],{operations:['write_script','revise_script','plan_departments','revise_departments','director_turn']});model.capabilities.planning.directorConversationVersion='director_conversation_v1';model.schema_evidence.inputSchemaHash=planningRequiredSchemaHash(model);f.store.state.models=[model];
 f.planningProvider.submit=async({request})=>{const c=JSON.parse(request.body.input).context;return {id:'resp_director_action_'+randomUUID().replaceAll('-',''),status:'completed',usage:{inputTokens:30,outputTokens:40,cachedInputTokens:0},directorProposal:{kind:'director_conversation_v1',message:'Preserve the approved cast; revise only this passage.',sourceDigest:c.sourceDigest,nextAction:{kind,sceneIds:kind==='prepare_script_revision'?[c.sceneIds[1]]:[],departmentIds:kind==='prepare_department_revision'?['camera']:[],instruction:kind.startsWith('prepare_')?'Make this passage more emotional while preserving the original recording.':''},limitations:['Simulated response; no creative qualification.']}};};
 const result=await musicPlanningCall(f,'director_turn');return {...f,callId:result.call.id};
}
test('a saved owned response becomes an inspectable assistant message without approvals or duplicate replies',async()=>{
 const f=await fixture(),args={actorId:f.project.ownerId,project:f.project,store:f.store,body:{requestId:randomUUID(),expectedVersion:f.project.version,planningCallId:f.callId}};
 const saved=await recordDirectorReply(args);assert.equal(saved.project.directorSession.messages.at(-1).role,'assistant');assert.equal(saved.project.directorSession.messages.at(-1).planningCallId,f.callId);
 const again=await recordDirectorReply({...args,project:saved.project});assert.equal(again.project.directorSession.messages.length,2);assert.equal((await f.store.records('approvals',f.project.id)).length,(await f.store.records('approvals',saved.project.id)).length);
});
test('a scoped handoff saves only the existing screenplay revision request and preserves accepted media',async()=>{
 const f=await fixture(),approvals=await f.store.records('approvals',f.project.id),assets=await f.store.records('assets',f.project.id),call=await f.store.readPlanningCall(f.project.ownerId,f.project.id,f.callId),proposal=call.result.directorProposal;
 const preview=prepareDirectorAction({project:f.project,approvals,assets,proposal,planningCallId:f.callId});
 const body={requestId:randomUUID(),expectedVersion:f.project.version,planningCallId:f.callId,actionId:preview.actionId};const result=await applyDirectorAction({project:f.project,actorId:f.project.ownerId,store:f.store,body});
 assert.deepEqual(result.project.screenplay.versions,f.project.screenplay.versions);assert.deepEqual(result.project.shots,f.project.shots);assert.deepEqual(result.project.screenplay.revisionRequest.sceneIds,proposal.nextAction.sceneIds);
 const repeat=await applyDirectorAction({project:result.project,actorId:f.project.ownerId,store:f.store,body});assert.equal(repeat.project.version,result.project.version);
});
test('stale sources, forged action identities and foreign accounts cannot apply a Director suggestion',async()=>{
 const f=await fixture(),base={project:f.project,actorId:f.project.ownerId,store:f.store,body:{requestId:randomUUID(),expectedVersion:f.project.version,planningCallId:f.callId,actionId:'0'.repeat(64)}};
 await assert.rejects(()=>applyDirectorAction(base));await assert.rejects(()=>recordDirectorReply({...base,actorId:'foreign',body:{requestId:randomUUID(),expectedVersion:f.project.version,planningCallId:f.callId}}),{status:404});
 const changed={...f.project,direction:'Different world',version:f.project.version+1};await f.store.save(changed,f.project.version);
 await assert.rejects(()=>recordDirectorReply({...base,project:changed,body:{requestId:randomUUID(),expectedVersion:changed.version,planningCallId:f.callId}}),{status:409});
});
test('department handoff preserves all department documents and prepares only selected revision scope',async()=>{
 const f=await fixture('prepare_department_revision'),approvals=await f.store.records('approvals',f.project.id),assets=await f.store.records('assets',f.project.id),call=await f.store.readPlanningCall(f.project.ownerId,f.project.id,f.callId),preview=prepareDirectorAction({project:f.project,approvals,assets,proposal:call.result.directorProposal,planningCallId:f.callId});
 const result=await applyDirectorAction({project:f.project,actorId:f.project.ownerId,store:f.store,body:{requestId:randomUUID(),expectedVersion:f.project.version,planningCallId:f.callId,actionId:preview.actionId}});
 assert.deepEqual(result.project.departmentPlanning.departments,f.project.departmentPlanning.departments);assert.deepEqual(result.project.departmentPlanning.revisionRequests.at(-1).departmentIds,['camera']);assert.equal(f.store.state.jobs.length,0);
});

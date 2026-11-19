import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {LocalStore} from '../store.mjs';
import {newProject} from '../domain.mjs';
import {recordProductionOutcome,productionOutcomeSummary,providerHealth,discountedOutcomeEvidence} from '../production-outcomes.mjs';
async function fixture(){const store=await new LocalStore().init(),project=newProject({format:'music_video'},'owner'),asset={id:randomUUID(),projectId:project.id,version:1,mime:'video/mp4',checksum:'a'.repeat(64),durationSeconds:12,decodeVerified:true};await store.create(project);await store.add('assets',asset);return {store,project,asset};}
const body=f=>({requestId:randomUUID(),expectedVersion:f.project.version,assetId:f.asset.id,assetVersion:1,decision:'accepted',defects:[],reason:'Reviewed the actual supplied performance.'});
test('owned explicit reviews are idempotent evidence without granting generation or quality certification',async()=>{
 const f=await fixture(),command=body(f),r=await recordProductionOutcome({...f,actorId:'owner',body:command});assert.equal(r.event.details.kind,'media_outcome_v1');assert.equal(r.event.details.asset.checksum,f.asset.checksum);assert.equal((await recordProductionOutcome({...f,actorId:'owner',body:command})).event.id,r.event.id);assert.equal((await f.store.records('audit',f.project.id)).length,1);assert.equal(f.store.state.jobs.length,0);assert.equal(f.store.state.approvals.length,0);
 await assert.rejects(()=>recordProductionOutcome({...f,actorId:'foreign',body:body(f)}),{status:404});await assert.rejects(()=>recordProductionOutcome({...f,actorId:'owner',body:{...command,decision:'rejected'}}),{status:409});
});
test('outcome summary separates explicit acceptance from unknown cost and cannot inflate finished minutes with clip downloads',async()=>{
 const f=await fixture();await recordProductionOutcome({...f,actorId:'owner',body:body(f)});const a=await productionOutcomeSummary({...f,actorId:'owner'});assert.equal(a.quality.accepted,1);assert.equal(a.quality.firstPassAcceptance,null);assert.equal(a.economics.acceptedFinishedMinutes,0);assert.equal(a.economics.costPerAcceptedFinishedMinuteMicroUsd,null);
 await recordProductionOutcome({...f,actorId:'owner',body:{...body(f),decision:'needs_correction',defects:['lip_sync'],reason:'The mouth closes late on the sung phrase.'}});const b=await productionOutcomeSummary({...f,actorId:'owner'});assert.equal(b.quality.accepted,0);assert.equal(b.quality.needsCorrection,1);
});
test('health distinguishes classified provider errors from user cancellation and unknown evidence',()=>{
 const now=Date.parse('2026-11-19T12:00:00Z'),observations=[{requestId:'a',at:'2026-11-19T11:59:00Z',kind:'provider_error'},{requestId:'b',at:'2026-11-19T11:59:00Z',kind:'success'},{requestId:'c',at:'2026-11-19T11:59:00Z',kind:'user_cancelled'}],policy={windowMs:900000,minimumSamples:2,maxErrorRate:0.4};assert.equal(providerHealth({observations,policy,now}).state,'hold');assert.equal(providerHealth({observations:[observations[0]],policy,now}).state,'insufficient_evidence');assert.equal(providerHealth({observations:[...observations,observations[0]],policy,now}).sampleCount,2);
});
test('discounted learning uses explicit verdicts and never authorizes paid exploration',()=>{
 const r=discountedOutcomeEvidence({outcomes:[{id:'a',decision:'accepted',ordinal:1},{id:'b',decision:'rejected',ordinal:2}],decay:0.5});assert.equal(r.successWeight,0.5);assert.equal(r.failureWeight,1);assert.equal(r.alpha,1.5);assert.equal(r.beta,2);assert.equal(r.explorationAuthorized,false);
});
test('offline Thompson sampling is reproducible and uses only eligible version-matched reviewed outcomes',async()=>{
 const {sampleOutcomeRecommendations}=await import('../production-outcomes.mjs'),candidates=[{modelId:'A',modelVersion:'v1',eligible:true},{modelId:'B',modelVersion:'v1',eligible:true},{modelId:'C',modelVersion:'v1',eligible:false}],evidence=[{modelId:'A',modelVersion:'v1',samples:20,alpha:18,beta:4},{modelId:'B',modelVersion:'v1',samples:20,alpha:5,beta:17},{modelId:'C',modelVersion:'v1',samples:20,alpha:100,beta:1}];
 const r=sampleOutcomeRecommendations({candidates,evidence,seed:42,minimumSamples:5});assert.deepEqual(r,sampleOutcomeRecommendations({candidates:[...candidates].reverse(),evidence,seed:42,minimumSamples:5}));assert.equal(r.recommendations.length,2);assert.equal(r.recommendations[0].modelId,'A');assert.equal(r.explorationAuthorized,false);assert.equal(r.generationAuthorized,false);
 assert.equal(sampleOutcomeRecommendations({candidates,evidence:evidence.map(e=>({...e,modelVersion:'retired'})),seed:42,minimumSamples:5}).status,'insufficient_evidence');
});
test('released charges, unsettled overruns and unavailable render accounting remain distinct',async()=>{
 const {summarizeProductionOutcomes}=await import('../production-outcomes.mjs');
 const released=summarizeProductionOutcomes({reservations:[{id:'released',status:'failed',chargeState:'released',reservedMicroUsd:20}]});assert.equal(released.economics.unknownChargeCount,0);
 const unknown=summarizeProductionOutcomes({reservations:[{id:'unknown',status:'unknown',chargeState:'unknown',reservedMicroUsd:20,actualMicroUsd:30}]});assert.equal(unknown.economics.pendingExposureMicroUsd,'30');
 const missing=summarizeProductionOutcomes({renderAccountingAvailable:false});assert.equal(missing.economics.renderAccountingAvailable,false);assert.equal(missing.economics.costPerAcceptedFinishedMinuteMicroUsd,null);
});
test('cloud-style reviewed media uses its immutable proposal snapshot and task for model evidence',async()=>{
 const f=await fixture(),jobId=randomUUID();f.asset.generated={kind:'music_video_motion',jobId};f.store.state.assets[0]=f.asset;f.store.state.jobs.push({id:jobId,projectId:f.project.id,status:'completed',proposal_id:'proposal',provider_request_id:'original'});f.store.readProposal=async(projectId,id)=>{assert.equal(projectId,f.project.id);return {id,model_id:'motion',model_snapshot:{model_version:'reviewed-v2',endpoint:'bytedance/omnihuman/v2'},artifact_id:'record:motion',task:'singing_performance'};};
 const r=await recordProductionOutcome({...f,actorId:'owner',body:body(f)});assert.equal(r.event.details.job.modelVersion,'reviewed-v2');assert.equal(r.event.details.job.task,'singing_performance');
});

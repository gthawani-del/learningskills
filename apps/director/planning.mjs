import {randomUUID} from 'node:crypto';
import {hash,fail} from './domain.mjs';
import {planningScope,decidePlanningPath} from './planning-policy.mjs';
import {preparePlanningRequest} from './planning-profile.mjs';
import {calculatePlanningCost,validatePlanningResult} from './planning-provider.mjs';
import {briefPlanningContext} from './public/creative-brief-core.js';
export function createPlanningController({store,provider,env,now=()=>new Date()}){
 async function context(actorId,projectId,operation='initial_plan'){
  const project=await store.get(projectId,actorId),approvals=await store.records('approvals',projectId),scope=planningScope(project,approvals);
  const models=(await store.planningModels()).filter(m=>m.provider==='openai'&&m.model_version===env.OPENAI_STORY_MODEL);
  if(models.length!==1)fail(409,'No verified planning model is configured. Manual editing remains available.');
  return {project,scope,model:models[0],...preparePlanningRequest(project,models[0],operation,now(),approvals)};
 }
 async function enabled(){
  if(env.DIRECTOR_PLANNING_ENABLED!=='1'||!env.OPENAI_API_KEY)fail(409,'Paid planning is not enabled. Manual editing remains available.');
  const control=await store.generationControl();if(control?.generationPaused!==false)fail(409,'New paid planning is paused. Existing requests can still be checked.');
 }
 async function recordSnapshot(actorId,projectId,call,snapshot){
  await store.recordPlanningResponse(actorId,projectId,call.id,snapshot.id);
  const current=await store.readPlanningCall(actorId,projectId,call.id);
  const terminal=['completed','failed','cancelled','incomplete'].includes(snapshot.status);
  if(!terminal){
   if(snapshot.status==='unknown'){const project=await store.get(projectId,actorId);await store.planningCommand('settle_planning',{actorId,projectId,requestId:randomUUID(),expectedVersion:project.version,reservationId:call.id,outcome:'unknown'},{result:{providerStatus:'unknown',normalizationError:snapshot.normalizationError||'The provider status needs reconciliation.'},providerResponseId:snapshot.id});}
   else await store.savePlanningResult(actorId,projectId,call.id,{providerStatus:snapshot.status});
   return store.readPlanningCall(actorId,projectId,call.id);
  }
  let actualMicroUsd;
  try{if(snapshot.usage)actualMicroUsd=calculatePlanningCost({pricing:current.profileSnapshot.price_evidence,model:current.profileSnapshot.model_version,...snapshot.usage,now:Date.parse(current.reservation.createdAt)}).totalMicroUsd;}catch{}
  const proposal=snapshot.briefProposal??snapshot.plan;
  if(proposal)try{validatePlanningResult(proposal,current.request);}catch{snapshot={...snapshot,plan:undefined,briefProposal:undefined,planError:'The proposed result did not meet the saved creative request requirements.'};}
  const result={providerStatus:snapshot.status,...(snapshot.plan?{plan:snapshot.plan}:{}),...(snapshot.briefProposal?{briefProposal:snapshot.briefProposal}:{}),...(snapshot.planError?{planError:snapshot.planError}:{}),...(snapshot.usageError?{usageError:snapshot.usageError}:{}),...(snapshot.error?{error:snapshot.error}:{})};
  const project=await store.get(projectId,actorId);
  await store.planningCommand('settle_planning',{actorId,projectId,requestId:randomUUID(),expectedVersion:project.version,reservationId:call.id,outcome:actualMicroUsd===undefined?'unknown':'completed',...(actualMicroUsd===undefined?{}:{actualMicroUsd,resultHash:hash(result)})},{usage:snapshot.usage,result,providerResponseId:snapshot.id});
  return store.readPlanningCall(actorId,projectId,call.id);
 }
 async function dispatch(c,call,ctx){
  await enabled();const fresh=await context(c.actorId,c.projectId,call.operation);
  if(fresh.request.requestHash!==call.requestHash||fresh.profile.fingerprint!==call.profileFingerprint)fail(409,'This saved planning request no longer matches the approved scope. Cancel the unstarted call before preparing another.');
  let claim;
  try{claim=await store.planningCommand('claim_planning',{actorId:c.actorId,projectId:c.projectId,expectedVersion:c.expectedVersion,requestId:randomUUID(),reservationId:call.id},fresh);}
  catch(e){const saved=await store.readPlanningCall(c.actorId,c.projectId,call.id);if(saved.reservation.submitClaimed)return saved;throw e;}
  if(!claim.claimed)return store.readPlanningCall(c.actorId,c.projectId,call.id);
  let snapshot;
  try{snapshot=await provider.submit({request:ctx.request,authorized:true});}
  catch{await store.planningCommand('settle_planning',{actorId:c.actorId,projectId:c.projectId,requestId:randomUUID(),expectedVersion:c.expectedVersion,reservationId:call.id,outcome:'unknown'});return store.readPlanningCall(c.actorId,c.projectId,call.id);}
  try{return await recordSnapshot(c.actorId,c.projectId,call,snapshot);}
  catch{return {...await store.readPlanningCall(c.actorId,c.projectId,call.id),providerResponseId:snapshot.id,recoveryWarning:'Response received; durable reconciliation is pending. Check this existing request before doing more work.'};}
 }
 return {
  async summary(actorId,projectId){
   const project=await store.get(projectId,actorId),approvals=await store.records('approvals',projectId),scope=planningScope(project,approvals),briefContext=briefPlanningContext(project,approvals);let availability={enabled:false,reason:'No verified planning model is configured.'},quote=null;
   try{const c=await context(actorId,projectId,'interpret_brief');quote={maxCallMicroUsd:c.quote.totalMicroUsd,currency:'USD',expiresAt:c.profile.expiresAt,quoteKind:c.quote.quoteKind};await enabled();availability={enabled:true,reason:'Creative planning can use an explicitly approved scope and budget.'};}catch(e){availability.reason=e.status?e.message:'Planning controls are temporarily unavailable.';}
   const records=await store.planningSummary(actorId,projectId);
   return {policy:{path:availability.enabled?'llm':'manual',reason:'Manual and supported rule-based edits use no model. Creative planning uses a scoped allowance.'},availability,scope,quote,briefContext,...records,providerDataPolicy:'Background planning stores a response with the configured provider; approved project data policies must permit this.'};
  },
  async consent(c){const previous=await store.replayPlanningDecision('grant_planning',c);if(previous)return previous;const ctx=await context(c.actorId,c.projectId,'interpret_brief');return store.planningCommand('grant_planning',c,ctx);},
  async revoke(c){return store.planningCommand('revoke_planning',c);},
  async start(c){
   const replay=await store.replayPlanningCall(c);if(replay?.reservation.submitClaimed||replay&&replay.reservation.status!=='held')return replay;
   await enabled();const ctx=await context(c.actorId,c.projectId,c.operation);
   const policy=decidePlanningPath({operation:c.operation,requestHash:ctx.request.requestHash,scope:ctx.scope,policy:{creativePlanningEnabled:true,allowedOperations:['initial_plan','revise_plan','interpret_brief']}});
   if(policy.path!=='llm')fail(409,'This operation does not require a new creative planning call.');
   const call=replay?.reservation||await store.planningCommand('reserve_planning',{...c,requestHash:ctx.request.requestHash,quotedMicroUsd:ctx.quote.totalMicroUsd},{...ctx,apiRequest:c});
   return dispatch(c,call,ctx);
  },
  async resume(c,callId){const saved=await store.readPlanningCall(c.actorId,c.projectId,callId);if(saved.reservation.submitClaimed||saved.reservation.status!=='held')return saved;const ctx=await context(c.actorId,c.projectId,saved.reservation.operation);return dispatch(c,saved.reservation,ctx);},
  async release(c,callId){await store.planningCommand('settle_planning',{...c,reservationId:callId,outcome:'released'});return store.readPlanningCall(c.actorId,c.projectId,callId);},
  async poll(actorId,projectId,callId){
   const saved=await store.readPlanningCall(actorId,projectId,callId);if(saved.reservation.status==='completed'||!saved.providerResponseId)return saved;
   let snapshot;try{snapshot=await provider.poll({responseId:saved.providerResponseId,request:saved.request});}catch{return saved;}
   return recordSnapshot(actorId,projectId,saved.reservation,snapshot);
  }
 };
}

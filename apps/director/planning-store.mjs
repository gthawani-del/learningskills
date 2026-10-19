import {hash,fail} from './domain.mjs';
import {planningScope} from './planning-policy.mjs';
import {planningProfile} from './planning-profile.mjs';
import {grantPlanningConsent,reservePlanningCall,claimPlanningCall,settlePlanningCall,revokePlanningConsent} from './planning-consent.mjs';
const operations={grant_planning:grantPlanningConsent,reserve_planning:reservePlanningCall,claim_planning:claimPlanningCall,settle_planning:settlePlanningCall,revoke_planning:revokePlanningConsent};
const own=(s,actorId,projectId)=>{const p=s.projects.find(p=>p.id===projectId&&p.ownerId===actorId);if(!p)fail(404,'Project not found.');return p;};
export function visiblePlanningCall(saved){
 const r=saved.reservation??saved,result=saved.result??r.result;
 const planError=result?.planError??r.planError??(['failed','cancelled','incomplete'].includes(result?.providerStatus)?'Planning did not produce a completed proposal. Usage remains recorded.':null);
 return {...structuredClone(r),status:r.status==='held'?(r.submitClaimed?'submitted':'reserved'):r.status,chargeState:r.status==='completed'?'settled':r.status==='unknown'?'unknown':r.status==='released'?'released':'held',...(saved.providerResponseId?{providerResponseId:saved.providerResponseId}:{}),...(result?{result:structuredClone(result)}:{}),...(planError?{planError}:{}),...(saved.recoveryWarning?{recoveryWarning:saved.recoveryWarning}:{})};
}
export const localPlanningMethods={
 async replayPlanningDecision(operation,c){own(this.state,c.actorId,c.projectId);const previous=(this.state.planningCommands||[]).find(r=>r.requestId===c.requestId);if(!previous)return null;if(previous.fingerprint!==hash({operation,...c}))fail(409,'This request identity belongs to another planning decision.');return structuredClone(previous.result);},
 async planningModels(){return structuredClone(this.state.models||[]);},
 async planningSummary(actorId,projectId){own(this.state,actorId,projectId);return {consents:structuredClone((this.state.planningConsents||[]).filter(g=>g.projectId===projectId)),calls:(this.state.planningReservations||[]).filter(r=>r.projectId===projectId).map(r=>visiblePlanningCall({reservation:r,...(this.state.planningSavedCalls||[]).find(c=>c.reservationId===r.id)}))};},
 async replayPlanningCall(c){own(this.state,c.actorId,c.projectId);const prev=(this.state.planningCallRequests||[]).find(r=>r.requestId===c.requestId);if(!prev)return null;if(prev.fingerprint!==hash(c))fail(409,'This request ID belongs to a different planning call.');return this.readPlanningCall(c.actorId,c.projectId,prev.reservationId);},
 async planningCommand(operation,c,options={}){return this.spendingTransaction(state=>{
  const p=own(state,c.actorId,c.projectId);if(!operations[operation])fail(400,'Unknown planning command.');
  const previous=(state.planningCommands||[]).find(r=>r.requestId===c.requestId);
  if(previous){if(previous.fingerprint!==hash({operation,...c}))fail(409,'This request identity belongs to another planning decision.');return operation==='claim_planning'?{...structuredClone(previous.result),claimed:false}:structuredClone(previous.result);}
  let trusted={now:new Date()};
  if(['grant_planning','reserve_planning','claim_planning'].includes(operation)){
   const current=state.models.find(m=>m.id===options.profile?.modelId);const profile=planningProfile(current),scope=planningScope(p,state.approvals.filter(a=>a.projectId===p.id));
   if(hash(profile)!==hash(options.profile)||hash(scope)!==hash(options.scope))fail(409,'Planning evidence or approvals changed. Refresh before continuing.');
   trusted={...trusted,profile,scope};
  }
  const result=['settle_planning','revoke_planning'].includes(operation)?operations[operation](state,c,trusted.now):operations[operation](state,c,trusted);
  if(operation==='reserve_planning'){
   const original=options.apiRequest;
   const previous=(state.planningCallRequests||[]).find(r=>r.requestId===c.requestId);
   if(previous&&previous.fingerprint!==hash(original))fail(409,'This planning request identity changed.');
   if(!previous){(state.planningCallRequests||=[]).push({requestId:c.requestId,fingerprint:hash(original),reservationId:result.id});(state.planningSavedCalls||=[]).push({reservationId:result.id,apiRequest:structuredClone(original),request:structuredClone(options.request),profileSnapshot:structuredClone(options.model)});}
  }
  if(operation==='settle_planning'&&options.result){const saved=(state.planningSavedCalls||[]).find(s=>s.reservationId===c.reservationId);if(!saved||saved.providerResponseId!==options.providerResponseId)fail(409,'Planning response identity changed.');saved.result=structuredClone(options.result);saved.usage=structuredClone(options.usage);}
  return result;
 });},
 async readPlanningCall(actorId,projectId,callId){own(this.state,actorId,projectId);const reservation=(this.state.planningReservations||[]).find(r=>r.id===callId&&r.projectId===projectId);if(!reservation)fail(404,'Planning call not found.');return structuredClone({reservation,...(this.state.planningSavedCalls||[]).find(s=>s.reservationId===callId)});},
 async recordPlanningResponse(actorId,projectId,callId,responseId){return this.spendingTransaction(s=>{own(s,actorId,projectId);if(!/^resp_[A-Za-z0-9_-]{1,180}$/.test(responseId))fail(400,'Invalid planning response identity.');const r=s.planningReservations?.find(r=>r.id===callId&&r.projectId===projectId),saved=s.planningSavedCalls?.find(c=>c.reservationId===callId);if(!r?.submitClaimed||!saved||saved.providerResponseId&&saved.providerResponseId!==responseId)fail(409,'Planning response identity cannot be replaced.');if(s.planningSavedCalls.some(c=>c.reservationId!==callId&&c.providerResponseId===responseId))fail(409,'Planning response is already bound.');saved.providerResponseId=responseId;return {saved:true};});},
 async savePlanningResult(actorId,projectId,callId,result){return this.spendingTransaction(s=>{own(s,actorId,projectId);const saved=s.planningSavedCalls?.find(c=>c.reservationId===callId),r=s.planningReservations?.find(r=>r.id===callId&&r.projectId===projectId);if(!saved||!r)fail(404,'Planning call not found.');if(['completed','released'].includes(r.status))return {saved:false};saved.result=structuredClone(result);return {saved:true};});}
};
export const cloudPlanningMethods={
 async replayPlanningDecision(operation,c){await this.get(c.projectId,c.actorId);const rows=await this.request(`/rest/v1/director_planning_commands?project_id=eq.${c.projectId}&request_id=eq.${c.requestId}`);if(!rows.length)return null;const {actorId,projectId,requestId,expectedVersion,...body}=c;if(rows[0].command!==operation||hash(rows[0].request)!==hash({actorId,expectedVersion,body}))fail(409,'This request identity belongs to another planning decision.');return rows[0].response;},
 async planningModels(){return this.request('/rest/v1/director_models?order=id');},
 async planningSummary(actorId,projectId){await this.get(projectId,actorId);const result=await this.request(`/rest/v1/rpc/director_planning_summary`,{method:'POST',body:{p_actor_id:actorId,p_project_id:projectId}});return {...result,calls:(result.calls||[]).map(visiblePlanningCall)};},
 async replayPlanningCall(c){await this.get(c.projectId,c.actorId);return this.request('/rest/v1/rpc/director_planning_replay',{method:'POST',body:{p_actor_id:c.actorId,p_project_id:c.projectId,p_request_id:c.requestId,p_request_fingerprint:hash(c)}});},
 async planningCommand(command,c,options={}){
  const {actorId,projectId,expectedVersion,requestId,...body}=c;
  const result=await this.request('/rest/v1/rpc/director_planning_command',{method:'POST',body:{p_actor_id:actorId,p_project_id:projectId,p_expected_version:expectedVersion,p_request_id:requestId,p_command:command,p_body:{...body,...(command==='reserve_planning'?{request:options.request,boundQuote:options.quote,apiRequest:options.apiRequest,apiRequestFingerprint:hash(options.apiRequest)}:{}),...(command==='settle_planning'?{...(options.usage?{usage:options.usage}:{}),...(options.result?{result:options.result}:{}),...(options.providerResponseId?{providerResponseId:options.providerResponseId}:{})}:{})},p_scope:options.scope??null,p_profile:options.profile??null}});
  return result.result;
 },
 async readPlanningCall(actorId,projectId,callId){await this.get(projectId,actorId);return this.request('/rest/v1/rpc/director_planning_read',{method:'POST',body:{p_actor_id:actorId,p_project_id:projectId,p_reservation_id:callId}});},
 async recordPlanningResponse(actorId,projectId,callId,responseId){return this.request('/rest/v1/rpc/director_planning_record_response',{method:'POST',body:{p_actor_id:actorId,p_project_id:projectId,p_reservation_id:callId,p_response_id:responseId}});},
 async savePlanningResult(actorId,projectId,callId,result){return this.request('/rest/v1/rpc/director_planning_record_status',{method:'POST',body:{p_actor_id:actorId,p_project_id:projectId,p_reservation_id:callId,p_result:result}});}
};

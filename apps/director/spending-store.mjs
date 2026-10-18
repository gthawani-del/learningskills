import {writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {persistQuote,authorizeSpending,revokeSpending} from './spending.mjs';
import {fail} from './domain.mjs';

const summary = (quotes,authorizations,reservations=[]) => ({quotes,authorizations,reservations,currency:'USD',generationEnabled:false,scope:'Generation cost estimates and spending limits; not customer billing or a wallet balance.'});
export const visibleQuote = q => Object.fromEntries(['id','projectId','projectVersion','artifactId','artifactVersion','modelId','endpoint','task','requirements','intent','currency','totalMicroUsd','createdAt','expiresAt','estimateOnly','generationAuthorized'].filter(k=>Object.hasOwn(q,k)).map(k=>[k,structuredClone(q[k])]));
const owner = (state,actorId,projectId) => {const p=state.projects.find(p=>p.id===projectId&&p.ownerId===actorId);if(!p)fail(404,'Project not found.');return p;};

export const localSpendingMethods={
 async spendingTransaction(fn){
  const run=this.tail.then(async()=>{
   const draft=structuredClone(this.state),result=await fn(draft);
   if(this.file){await mkdir(dirname(this.file),{recursive:true});const temp=this.file+'.spending.tmp';await writeFile(temp,JSON.stringify(draft),{mode:0o600});await rename(temp,this.file);}
   this.state=draft;return structuredClone(result);
  });this.tail=run.catch(()=>{});return run;
 },
 async replayCostQuote({actorId,projectId,requestId,requestFingerprint}){
  owner(this.state,actorId,projectId);
  const previous=(this.state.spendingQuoteRequests||[]).find(c=>c.requestId===requestId);
  if(previous&&(previous.actorId!==actorId||previous.projectId!==projectId||previous.requestFingerprint!==requestFingerprint))fail(409,'This request ID was used for another quote.');
  return previous?structuredClone(previous.result):null;
 },
 async persistCostQuote(command){return this.spendingTransaction(state=>{
  owner(state,command.actorId,command.projectId);
  const previous=(state.spendingQuoteRequests||[]).find(c=>c.requestId===command.requestId);
  if(previous){if(previous.actorId!==command.actorId||previous.projectId!==command.projectId||previous.requestFingerprint!==command.requestFingerprint)fail(409,'This request ID was used for another quote.');return previous.result;}
  const {requestFingerprint,...request}=command;
  const model=state.models.find(m=>m.id===request.quote.modelId);
  const result=persistQuote(state,request,{model,now:new Date()});
  (state.spendingQuoteRequests||=[]).push({requestId:request.requestId,projectId:request.projectId,actorId:request.actorId,requestFingerprint,result});
  return result;
 });},
 async readCostQuote(actorId,projectId,quoteId){owner(this.state,actorId,projectId);const q=(this.state.quotes||[]).find(q=>q.id===quoteId&&q.projectId===projectId);if(!q)fail(404,'Saved quote not found.');return structuredClone(q);},
 async authorizeCostQuote(command){return this.spendingTransaction(state=>{
  owner(state,command.actorId,command.projectId);
  const q=(state.quotes||[]).find(q=>q.id===command.quoteId&&q.projectId===command.projectId);
  const model=state.models.find(m=>m.id===q?.quote.modelId);
  return authorizeSpending(state,command,{model,now:new Date()});
 });},
 async revokeCostAuthorization(command){return this.spendingTransaction(state=>revokeSpending(state,command,new Date()));},
 async spendingSummary(actorId,projectId){
  owner(this.state,actorId,projectId);
  return summary((this.state.quotes||[]).filter(q=>q.projectId===projectId).map(q=>visibleQuote(q.quote)),structuredClone((this.state.spendingAuthorizations||[]).filter(a=>a.projectId===projectId)),(this.state.jobs||[]).filter(j=>(j.projectId||j.project_id)===projectId).map(j=>({id:j.id,status:j.status,chargeState:j.charge_state,reservedMicroUsd:j.reserved_micro_usd,actualMicroUsd:j.actual_micro_usd??null})));
 }
};

// Database methods are bound below once the staged service-only RPC contract is
// installed. An unavailable schema must never fall back to process-local money.
export const cloudSpendingMethods={
 async spendingRPC(name,body){return this.request(`/rest/v1/rpc/${name}`,{method:'POST',body});},
 async replayCostQuote({actorId,projectId,requestId,requestFingerprint}){
  await this.get(projectId,actorId);
  const result=await this.spendingRPC('director_spending_replay',{p_actor_id:actorId,p_project_id:projectId,p_request_id:requestId,p_request_fingerprint:requestFingerprint});
  return result?visibleQuote(result.quote):null;
 },
 async persistCostQuote(c){
  const result=await this.spendingRPC('director_persist_quote',{p_actor_id:c.actorId,p_project_id:c.projectId,p_expected_version:c.expectedVersion,p_request_id:c.requestId,p_request_fingerprint:c.requestFingerprint,p_quote:c.quote,p_payload:c.input});
  return visibleQuote(result.quote);
 },
 async readCostQuote(actorId,projectId,quoteId){
  await this.get(projectId,actorId);
  const rows=await this.request(`/rest/v1/director_quote_records?project_id=eq.${projectId}&quote_id=eq.${encodeURIComponent(quoteId)}`);
  if(rows.length!==1)fail(404,'Saved quote not found.');
  const proposal=await this.readProposal(projectId,rows[0].proposal_id);if(!proposal)fail(409,'The saved quote contract is unavailable.');
  return {id:rows[0].quote_id,projectId,actorId,quote:rows[0].quote,input:proposal.payload};
 },
 async authorizeCostQuote(c){
  const project=await this.get(c.projectId,c.actorId),saved=await this.readCostQuote(c.actorId,c.projectId,c.quoteId);
  // Replays are decided transactionally by the RPC before revalidation. The
  // temporary pure transition below validates new requests without persisting.
  const request={actorId:c.actorId,expectedVersion:c.expectedVersion,quoteId:c.quoteId,maxMicroUsd:c.maxMicroUsd,finishReserveMicroUsd:c.finishReserveMicroUsd,expiresAt:saved.quote.expiresAt};
  const receipts=await this.request(`/rest/v1/director_spending_commands?project_id=eq.${c.projectId}&request_id=eq.${c.requestId}`);
  if(!receipts.length){const model=await this.readModel(saved.quote.modelId);authorizeSpending({projects:[project],quotes:[saved]},c,{model,now:new Date()});}
  const result=await this.spendingRPC('director_authorize_quote',{p_actor_id:c.actorId,p_project_id:c.projectId,p_expected_version:c.expectedVersion,p_request_id:c.requestId,p_quote_id:c.quoteId,p_max_micro_usd:c.maxMicroUsd,p_finish_reserve_micro_usd:c.finishReserveMicroUsd,p_expires_at:request.expiresAt});
  return this.spendingAuthorizationView(result.authorization,saved.quote);
 },
 spendingAuthorizationView(a,q){return {id:a.id,projectId:a.project_id,actorId:a.actor_id,quoteId:q?.id??null,currency:'USD',quotedMicroUsd:q?.totalMicroUsd??null,maxMicroUsd:a.max_micro_usd,finishReserveMicroUsd:a.finish_reserve_micro_usd,status:a.revoked_at?'revoked':'authorized',revokedAt:a.revoked_at??null,expiresAt:a.expires_at,createdAt:a.created_at,generationAuthorized:false,reservationCreated:false};},
 async revokeCostAuthorization(c){
  await this.get(c.projectId,c.actorId);
  const result=await this.spendingRPC('director_revoke_authorization',{p_actor_id:c.actorId,p_project_id:c.projectId,p_expected_version:c.expectedVersion,p_request_id:c.requestId,p_authorization_id:c.authorizationId,p_reason:c.reason});
  const rows=await this.request(`/rest/v1/director_quote_records?project_id=eq.${c.projectId}&proposal_id=eq.${result.authorization.proposal_id}`);
  return this.spendingAuthorizationView(result.authorization,rows[0]?.quote);
 },
 async spendingSummary(actorId,projectId){
  await this.get(projectId,actorId);
  const results=await Promise.allSettled([
   this.allRows(`/rest/v1/director_quote_records?project_id=eq.${projectId}&order=created_at.asc,quote_id.asc`),
   this.allRows(`/rest/v1/director_budget_authorizations?project_id=eq.${projectId}&order=created_at.asc,id.asc`),
   this.allRows(`/rest/v1/director_jobs?project_id=eq.${projectId}&order=created_at.asc,id.asc`)
  ]);
  const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
  const [quotes,authorizations,jobs]=results.map(r=>r.value);
  return summary(quotes.map(q=>visibleQuote(q.quote)),authorizations.map(a=>this.spendingAuthorizationView(a,quotes.find(q=>q.proposal_id===a.proposal_id)?.quote)),jobs.map(j=>({id:j.id,status:j.status,chargeState:j.charge_state,reservedMicroUsd:j.reserved_micro_usd,actualMicroUsd:j.actual_micro_usd??null})));
 }
};

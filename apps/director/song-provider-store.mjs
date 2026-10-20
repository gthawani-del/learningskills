import {randomUUID} from 'node:crypto';
import {fail,hash} from './domain.mjs';
import {reserveLocalMediaState,localReferenceMethods,cloudReferenceMethods} from './reference-store.mjs';
import {localStoryboardProductionMethods} from './storyboard-production-store.mjs';
import {songQuoteFacts} from './song-pricing.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const copy=structuredClone;
const workKeyFor=q=>`song:${q.songIntelligenceBinding.recordId}:${q.artifactVersion}:${q.songIntelligenceBinding.operation}`;
function songGate(state,p,q){
 const saved=state.quotes.find(r=>r.id===q.id&&r.projectId===p.id),model=state.models.find(m=>m.id===q.modelId);
 const facts=songQuoteFacts({project:p,assets:state.assets,task:q.task,model,input:saved?.input,artifactId:q.artifactId,artifactVersion:q.artifactVersion,requirements:q.requirements});
 if(!facts||hash(facts.songIntelligenceBinding)!==hash(q.songIntelligenceBinding)||hash(facts.usageEvidence)!==hash(q.usageEvidence))fail(409,'The trusted song source/quote changed.');
 const review=state.approvals.filter(a=>a.projectId===p.id&&a.artifactId===q.artifactId&&a.version===q.artifactVersion).at(-1);if(review?.decision!=='approved')fail(409,'Review the exact song source before paid analysis.');
 return {id:`song:${q.songIntelligenceBinding.recordId}:${q.artifactVersion}:${q.songIntelligenceBinding.operation}`,current:{version:q.artifactVersion}};
}
export const localSongProviderMethods={
 async reserveSongJob(c){return this.spendingTransaction(s=>{const p=s.projects.find(p=>p.id===c.projectId&&p.ownerId===c.actorId);if(!p)fail(404,'Project not found.');if(!uuid.test(c.idempotencyKey||''))fail(400,'A request UUID is required.');const old=s.jobs.find(j=>j.project_id===p.id&&j.idempotency_key===c.idempotencyKey);if(old){if(old.quoteId!==c.quoteId||old.authorization_id!==c.authorizationId)fail(409,'Song request identity conflicts.');return old;}return reserveLocalMediaState(s,c,{domainGate:songGate,reviewCollection:'songProviderReviews',workKeyFor});});},
 async claimJob(id){const original=this.state.jobs.find(j=>j.id===id),proposal=this.state.proposals.find(q=>q.id===original?.proposal_id);const saved=this.state.quotes.find(q=>q.quote?.id===original?.quoteId);if(!saved?.quote?.songIntelligenceBinding)return localStoryboardProductionMethods.claimJob.call(this,id);return this.spendingTransaction(s=>{const j=s.jobs.find(j=>j.id===id);if(j.status!=='reserved')return null;const p=s.projects.find(p=>p.id===j.project_id);reserveLocalMediaState(s,{actorId:p.ownerId,projectId:p.id,quoteId:j.quoteId,authorizationId:j.authorization_id,expectedVersion:p.version},{claim:true,job:j,domainGate:songGate,reviewCollection:'songProviderReviews',workKeyFor});j.status='submitted';return j;});},
 async songJobScope(actorId,projectId,jobId){const job=await this.readJob(actorId,projectId,jobId),proposal=await this.readProposal(projectId,job.proposal_id),saved=this.state.quotes.find(q=>q.id===job.quoteId&&q.projectId===projectId);if(!saved?.quote?.songIntelligenceBinding||!proposal||proposal.payload_hash!==job.payload_hash||hash(proposal.payload)!==job.payload_hash||!proposal.model_snapshot)fail(409,'The saved song request contract is unavailable.');return copy({job,proposal,quote:saved.quote,model:proposal.model_snapshot});},
 async readSongJobOutput(...args){return localReferenceMethods.readReferenceJobOutput.call(this,...args);},
 async reviewSongJob(c){return this.spendingTransaction(s=>{const p=s.projects.find(p=>p.id===c.projectId&&p.ownerId===c.actorId),j=s.jobs.find(j=>j.id===c.jobId&&j.project_id===c.projectId),q=s.quotes.find(q=>q.id===j?.quoteId)?.quote;if(!p)fail(404,'Project not found.');if(p.version!==c.expectedVersion||typeof c.reason!=='string'||c.reason.trim().length<5||c.reason.length>2000||!q?.songIntelligenceBinding||!['completed','failed'].includes(j?.status))fail(409,'Review a completed or failed owned song request with a correction reason.');const r={id:randomUUID(),projectId:p.id,jobId:j.id,actorId:c.actorId,verdict:'correction_required',evidence:{reason:c.reason,source:'explicit_user_review'},createdAt:new Date().toISOString()};(s.songProviderReviews??=[]).push(r);return r;});}
};
export const cloudSongProviderMethods={
 async reserveSongJob(c){return this.request('/rest/v1/rpc/director_reserve_song_job',{method:'POST',body:{p_actor_id:c.actorId,p_project_id:c.projectId,p_expected_version:c.expectedVersion,p_quote_id:c.quoteId,p_authorization_id:c.authorizationId,p_idempotency_key:c.idempotencyKey}});},
 async songJobScope(actorId,projectId,jobId){const job=await this.readJob(actorId,projectId,jobId),proposal=await this.readProposal(projectId,job.proposal_id),rows=await this.request(`/rest/v1/director_quote_records?project_id=eq.${projectId}&proposal_id=eq.${job.proposal_id}`);if(rows.length!==1||!rows[0].quote?.songIntelligenceBinding||!proposal||proposal.payload_hash!==job.payload_hash||hash(proposal.payload)!==job.payload_hash||!proposal.model_snapshot)fail(409,'The saved song request contract is unavailable.');return {job,proposal,quote:rows[0].quote,model:proposal.model_snapshot};},
 async readSongJobOutput(...args){return cloudReferenceMethods.readReferenceJobOutput.call(this,...args);},
 async reviewSongJob(c){return this.request('/rest/v1/rpc/director_review_song_job',{method:'POST',body:{p_actor_id:c.actorId,p_project_id:c.projectId,p_job_id:c.jobId,p_expected_version:c.expectedVersion,p_reason:c.reason}});}
};

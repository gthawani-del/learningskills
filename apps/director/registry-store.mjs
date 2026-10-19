import {applyModelRegistryCommand,modelRegistrySnapshot,validateModelPublication} from './model-registry.mjs';
import {normalizedControl} from './operations.mjs';
import {hash,fail} from './domain.mjs';

const draftView=row=>({modelId:row.modelId??row.model_id,version:row.version,profile:row.profile,profileHash:row.profileHash??row.profile_hash,baseModel:row.baseModel??row.base_model??null,actorId:row.actorId??row.actor_id,reason:row.reason,createdAt:row.createdAt??row.created_at});
const releaseView=row=>({modelId:row.modelId??row.model_id,draftVersion:row.draftVersion??row.draft_version,actorId:row.actorId??row.actor_id,review:row.review,before:row.before??row.before_state??null,after:row.after??row.after_state,createdAt:row.createdAt??row.created_at});
const commandView=row=>({requestId:row.requestId??row.request_id,actorId:row.actorId??row.actor_id,actorRole:row.actorRole??row.actor_role,command:row.command,reason:row.reason??row.request?.reason,modelId:row.modelId??row.request?.modelId,createdAt:row.createdAt??row.created_at});
const requestView=r=>({actorId:r.actorId,actorRole:r.actorRole,requestId:r.requestId,expectedRevision:r.expectedRevision,command:r.command,reason:r.reason,modelId:r.modelId,expectedDraftVersion:r.expectedDraftVersion,profile:r.profile??null,review:r.review??null,profileHash:r.command==='save_draft'?hash(r.profile):r.expectedProfileHash,acknowledgeEvidenceReview:r.acknowledgeEvidenceReview===true});
const resultView=result=>({...result,control:normalizedControl(result.control),...(result.draft?{draft:draftView(result.draft)}:{}),...(result.release?{release:releaseView(result.release)}:{})});

export const localRegistryMethods={
 async registryManagement(){return modelRegistrySnapshot(this.state);},
 async registryCommand(request){return this.spendingTransaction(state=>applyModelRegistryCommand(state,request,{now:new Date()}));}
};

export const cloudRegistryMethods={
 async registryManagement(){
  const results=await Promise.allSettled([
   this.allRows('/rest/v1/director_registry_drafts?order=model_id.asc,version.asc'),
   this.allRows('/rest/v1/director_registry_releases?order=created_at.asc,model_id.asc,draft_version.asc'),
   this.request('/rest/v1/director_registry_commands?order=created_at.desc,request_id.desc&limit=100')
  ]);
  const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
  const [drafts,releases,commands]=results.map(r=>r.value);
  return {drafts:drafts.map(draftView),releases:releases.map(releaseView),commands:commands.map(commandView)};
 },
 async registryCommand(r){
  // Reconcile known outcomes before freshness checks: an expired evidence record
  // must not make a successful, response-lost publication appear unconfirmed.
  const normalized=requestView(r),prior=await this.request(`/rest/v1/director_registry_commands?request_id=eq.${r.requestId}`);
  if(prior.length){if(prior.length!==1||hash(prior[0].request)!==hash(normalized))fail(409,'This request identity belongs to a different registry command.');return resultView({...prior[0].response,replayed:true});}
  if(r.command==='publish_draft'){
   const drafts=await this.request(`/rest/v1/director_registry_drafts?model_id=eq.${encodeURIComponent(r.modelId)}&version=eq.${r.expectedDraftVersion}`);
   if(drafts.length!==1)fail(409,'The saved model draft is unavailable. Refresh before reviewing it.');
   const draft=draftView(drafts[0]);
   if(draft.profileHash!==r.expectedProfileHash||hash(draft.profile)!==r.expectedProfileHash)fail(409,'The saved model draft changed. Review its exact profile before publishing.');
   validateModelPublication({modelId:r.modelId,profile:draft.profile,review:r.review,now:new Date()});
  }
  const result=await this.request('/rest/v1/rpc/director_registry_command',{method:'POST',body:{p_actor_id:r.actorId,p_actor_role:r.actorRole,p_request_id:r.requestId,p_expected_revision:r.expectedRevision,p_command:r.command,p_reason:r.reason,p_model_id:r.modelId,p_draft_version:r.expectedDraftVersion,p_profile:r.profile??null,p_review:r.review??null,p_profile_hash:normalized.profileHash,p_ack_review:normalized.acknowledgeEvidenceReview}});
  return resultView(result);
 }
};

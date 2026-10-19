import {fail,hash} from './domain.mjs';
import {applyStoryboardHandoffCommand,storyboardHandoffContext,storyboardHandoffInputSignature} from './public/storyboard-handoff-core.js';
import {planningCreativeContext} from './planning-profile.mjs';
import {validatePlanningResult} from './planning-provider.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields={prepare:[],update:['shotId','document'],reorder:['shotIds'],review_sequence:['acknowledgeShotChanges'],refresh:['shotId','acknowledgeSourceChange']};

// Creative source, review identity and the provider proposal remain bound to the
// same owned project. Only this explicit command may update managed shot fields.
export async function changeStoryboardHandoff({project,body,actorId,store,applying=false}){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Supply a current version and a supported shot-plan edit.');
 const allowed=applying?['expectedVersion','callId']:['expectedVersion','action',...(Object.hasOwn(fields,body.action)?fields[body.action]:[])];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||!applying&&!Object.hasOwn(fields,body.action))fail(400,'Supply a current version and a supported shot-plan edit.');
 if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen it before editing its shot plan.');
 const approvals=await store.records('approvals',project.id);let command=body;
 if(applying){
  if(!uuid.test(body.callId||''))fail(400,'Choose a saved storyboard proposal.');
  const saved=await store.readPlanningCall(actorId,project.id,body.callId),proposal=saved.result?.storyboard;
  if(saved.reservation?.operation!=='plan_storyboard'||saved.result?.providerStatus!=='completed'||!proposal||saved.result.planError)fail(409,'This call has no completed storyboard proposal to review.');
  validatePlanningResult(proposal,saved.request);
  const input=JSON.parse(saved.request.body.input),signature=storyboardHandoffInputSignature(project,approvals);
  if(hash(input.context)!==hash(planningCreativeContext(project,approvals,'plan_storyboard'))||input.context?.storyboardHandoff?.inputSignature!==hash(signature))fail(409,'The script, department plans, shot plan or review decisions changed. Preserve the current plan and review a fresh proposal.');
  command={expectedVersion:project.version,action:'apply_proposal',proposal:{inputSignature:signature,shots:proposal.shots,modelCallId:body.callId}};
 }
 const next=applyStoryboardHandoffCommand(project,command,approvals),saved=next.version===project.version?project:await store.saveStoryboardHandoff(next,project.version,{expectedApprovalId:approvals.at(-1)?.id??null});
 return {project:saved,storyboardContext:storyboardHandoffContext(saved,approvals)};
}

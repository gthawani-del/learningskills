import {fail,hash} from './domain.mjs';
import {screenplayContext,screenplayInputSignature} from './public/screenplay-core.js';
import {applyScreenplayProjectCommand} from './public/screenplay-project.js';
import {planningCreativeContext} from './planning-profile.mjs';
import {validatePlanningResult} from './planning-provider.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields={add_source:['source'],save:['document'],use_source:['sourceId'],set_revision:['revisionRequest'],record_review:['dispositions']};

// Only a stored, owned provider result may establish model-call provenance.
// Client bodies cannot supply proposals, scan results, approvals or history.
export async function changeScreenplay({project,body,actorId,store,applying=false}){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Supply a current version and a supported screenplay edit.');
 const allowed=applying?['expectedVersion','callId']:['expectedVersion','action',...(Object.hasOwn(fields,body.action)?fields[body.action]:[])];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||!applying&&!Object.hasOwn(fields,body.action))fail(400,'Supply a current version and a supported screenplay edit.');
 if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen it before editing the screenplay.');
 const approvals=await store.records('approvals',project.id);let command=body;
 if(applying){
  if(!uuid.test(body.callId||''))fail(400,'Choose a saved screenplay proposal.');
  const saved=await store.readPlanningCall(actorId,project.id,body.callId),document=saved.result?.screenplay,operation=saved.reservation?.operation;
  if(!['write_script','revise_script'].includes(operation)||saved.result?.providerStatus!=='completed'||!document||saved.result.planError)fail(409,'This call has no completed screenplay proposal to review.');
  validatePlanningResult(document,saved.request);
  const input=JSON.parse(saved.request.body.input);
  if(hash(input.context)!==hash(planningCreativeContext(project,approvals,operation))||input.context?.screenplay?.inputSignature!==screenplayInputSignature(project))fail(409,'The screenplay, sources or reviewed decisions changed. Keep the current version and review a fresh proposal.');
  command={expectedVersion:project.version,action:'apply_proposal',proposal:{inputSignature:input.context.screenplay.inputSignature,document,modelCallId:body.callId}};
 }
 const next=applyScreenplayProjectCommand(project,command,approvals),context=screenplayContext(next,approvals);
 const saved=next.version===project.version?project:await store.save(next,project.version);
 return {project:saved,screenplayContext:context};
}

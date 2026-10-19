import {fail,hash} from './domain.mjs';
import {applyDepartmentCommand,departmentPlanningContext,departmentPlanningInputSignature} from './public/department-plan-core.js';
import {planningCreativeContext} from './planning-profile.mjs';
import {validatePlanningResult} from './planning-provider.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields={prepare:[],refresh:['departmentId','acknowledgeSourceChange'],update:['departmentId','document'],review_dependencies:['departmentId','acknowledgeDependencies'],request_revision:['departmentIds','instruction']};

// Model provenance can only come from a completed, saved provider call owned by
// this project. Device or client documents never create approvals or spend rights.
export async function changeDepartmentPlans({project,body,actorId,store,applying=false}){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Supply a current version and a supported department planning edit.');
 const allowed=applying?['expectedVersion','callId']:['expectedVersion','action',...(Object.hasOwn(fields,body.action)?fields[body.action]:[])];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||!applying&&!Object.hasOwn(fields,body.action))fail(400,'Supply a current version and a supported department planning edit.');
 if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen it before editing department plans.');
 const approvals=await store.records('approvals',project.id);let command=body;
 if(applying){
  if(!uuid.test(body.callId||''))fail(400,'Choose a saved department proposal.');
  const saved=await store.readPlanningCall(actorId,project.id,body.callId),document=saved.result?.departments,operation=saved.reservation?.operation;
  if(!['plan_departments','revise_departments'].includes(operation)||saved.result?.providerStatus!=='completed'||!document||saved.result.planError)fail(409,'This call has no completed department proposal to review.');
  validatePlanningResult(document,saved.request);
  const input=JSON.parse(saved.request.body.input),signature=departmentPlanningInputSignature(project,approvals);
  if(hash(input.context)!==hash(planningCreativeContext(project,approvals,operation))||input.context?.departmentPlanning?.inputSignature!==hash(signature))fail(409,'The brief, script, department choices or reviewed decisions changed. Keep the current plans and review a fresh proposal.');
  command={expectedVersion:project.version,action:operation==='revise_departments'?'apply_revision':'apply_proposal',proposal:{inputSignature:signature,departments:document.departments,modelCallId:body.callId,...(operation==='revise_departments'?{revisionRequestVersion:input.context?.departmentPlanning?.revision?.request?.version}:{})}};
 }
 // Approval writes have their own append-only ordering and do not advance the
 // project version. Bind both under the store's transaction so a newly reviewed
 // decision cannot slip between proposal validation and persistence.
 const next=applyDepartmentCommand(project,command,approvals),saved=next.version===project.version?project:await store.saveDepartmentPlans(next,project.version,{expectedApprovalId:approvals.at(-1)?.id??null});
 return {project:saved,departmentContext:departmentPlanningContext(saved,approvals)};
}

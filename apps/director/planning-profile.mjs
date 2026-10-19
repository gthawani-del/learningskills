import {hash,fail,artifacts} from './domain.mjs';
import {recordArtifacts} from './production-records.mjs';
import {planSchema} from './providers.mjs';
import {briefProposalSchema,briefProposalInstruction} from './brief-proposal.mjs';
import {briefPlanningContext,briefInputSignature} from './public/creative-brief-core.js';
import {screenplayPlanningContext,screenplayContext} from './public/screenplay-core.js';
import {departmentPlanningContext} from './public/department-plan-core.js';
import {DEPARTMENT_GUIDANCE_VERSION,departmentPromptGuidance} from './public/department-guidance.js';
import {screenplayProposalSchema,screenplayPlanningInstruction} from './screenplay-proposal.mjs';
import {departmentIds,departmentProposalSchema,departmentPlanningInstruction} from './department-proposal.mjs';
import {planningOperationTask} from './routing-task-catalog.mjs';
import {PLANNING_VERSION,DEPARTMENT_PLANNING_VERSION,filmPlanningInstruction,buildPlanningRequest,quotePlanningBound,calculatePlanningCost} from './planning-provider.mjs';
export const planningSchemaHash=hash({version:PLANNING_VERSION,planSchema,filmPlanningInstruction,briefProposalSchema,briefProposalInstruction,screenplayProposalSchema,screenplayPlanningInstruction});
export const departmentPlanningSchemaHash=hash({version:DEPARTMENT_PLANNING_VERSION,contextSignatures:'sha256-canonical-department-source-and-decisions-v1',guidanceVersion:DEPARTMENT_GUIDANCE_VERSION,guidance:departmentPromptGuidance(departmentIds),planSchema,filmPlanningInstruction,briefProposalSchema,briefProposalInstruction,screenplayProposalSchema,screenplayPlanningInstruction,departmentProposalSchema,departmentPlanningInstruction});
export const planningRequiredSchemaHash=model=>model?.capabilities?.planning?.operations?.includes('plan_departments')?departmentPlanningSchemaHash:planningSchemaHash;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const source=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const instant=now=>now instanceof Date?now.getTime():typeof now==='string'?Date.parse(now):now;
const labels=value=>Array.isArray(value)&&value.length>0&&value.length<=50&&new Set(value).size===value.length&&value.every(x=>typeof x==='string'&&x.trim()&&x.length<=200);
const reviewBound=(evidence,model,now)=>evidence&&evidence.modelId===model.id&&evidence.provider===model.provider&&evidence.endpoint===model.endpoint&&evidence.modelVersion===model.model_version&&typeof evidence.version==='string'&&evidence.version.trim()&&source(evidence.sourceUrl)&&Number.isFinite(Date.parse(evidence.evaluatedAt))&&Date.parse(evidence.evaluatedAt)<=now&&Date.parse(evidence.expiresAt)>now&&Date.parse(evidence.evaluatedAt)<Date.parse(evidence.expiresAt);
export function planningOperationEvidence(model,operation,now=Date.now()){
 const time=instant(now),task=planningOperationTask(operation),c=model?.capabilities?.planning;
 if(!Number.isFinite(time)||!task||!labels(c?.operations)||c.operations.some(op=>!planningOperationTask(op))||!c.operations.includes(operation)||!labels(model?.capabilities?.tasks)||!model.capabilities.tasks.includes(task))fail(409,'The registry model does not declare this planning operation and task.');
 const bindings=Array.isArray(c.operationBindings)?c.operationBindings.filter(binding=>binding?.operation===operation):[];
 if(bindings.length!==1||bindings[0].reviewed!==true||!reviewBound(bindings[0],model,time))fail(409,'A fresh model-bound planning operation review is required.');
 const evidence={};
 for(const kind of ['execution','quality']){
  const review=model.capabilities.reviewEvidence?.[kind];
  if(!reviewBound(review,model,time)||!positive(review.sampleCount)||!labels(review.tasks)||!review.tasks.includes(task)||!labels(review.operations)||!review.operations.includes(operation))fail(409,'Fresh model-bound execution and quality evidence must cover this planning task and operation.');
  evidence[kind]=review;
 }
 return {operation,task,binding:bindings[0],...evidence};
}
export function planningProfile(model,now=Date.now(),operation){
 const time=now instanceof Date?now.getTime():typeof now==='string'?Date.parse(now):now,c=model?.capabilities?.planning,s=model?.schema_evidence,p=model?.price_evidence,t=c?.tokenBoundEvidence;
 if(!model||model.provider!=='openai'||model.endpoint!=='https://api.openai.com/v1/responses'||![model.active,model.execution_tested,model.quality_validated,c?.enabled,c?.background,c?.providerRetentionAcknowledged,s?.verified].every(x=>x===true))fail(409,'A reviewed planning model and background-data policy are required.');
 if(typeof model.model_version!=='string'||!c.version||s.endpoint!==model.endpoint||s.modelVersion!==model.model_version||s.inputSchemaHash!==planningRequiredSchemaHash(model)||!s.version||!source(s.sourceUrl)||!(Date.parse(s.expiresAt)>time))fail(409,'The planning schema or model evidence is unavailable or expired.');
 if(!positive(c.contextWindowTokens)||!positive(c.maxOutputTokens)||c.maxOutputTokens>100000||c.maxOutputTokens>c.contextWindowTokens||!positive(c.maxRequestBytes)||c.maxRequestBytes>200000||t?.verified!==true||t.type!=='context-window-upper-bound'||t.model!==model.model_version||t.contextWindowTokens!==c.contextWindowTokens||!t.tokenizerVersion||!source(t.sourceUrl)||!(Date.parse(t.expiresAt)>time))fail(409,'Verified planning token bounds are required.');
 if(p?.version!==model.price_version)fail(409,'Planning prices have changed.');
 if(!labels(c.operations)||c.operations.some(op=>!planningOperationTask(op)))fail(409,'Reviewed planning operation declarations are required.');
 const operationEvidence=c.operations.map(op=>planningOperationEvidence(model,op,time));
 if(operation!==undefined)planningOperationEvidence(model,operation,time);
 const cost=calculatePlanningCost({pricing:p,model:model.model_version,inputTokens:c.contextWindowTokens,outputTokens:c.maxOutputTokens,now:time});
 if(!positive(cost.totalMicroUsd))fail(409,'A positive bounded planning reservation is required.');
 return {fingerprint:hash(model),expiresAt:new Date(Math.min(Date.parse(s.expiresAt),Date.parse(p.expiresAt),Date.parse(t.expiresAt),...operationEvidence.flatMap(e=>[e.binding,e.execution,e.quality].map(review=>Date.parse(review.expiresAt))))).toISOString(),maxCallMicroUsd:cost.totalMicroUsd,modelId:model.id,modelVersion:model.model_version,priceVersion:model.price_version};
}
export function planningCreativeContext(project,approvals=[],operation='initial_plan'){
 const creative=briefPlanningContext(project,approvals);
 const decisions=approvals.map((a,index)=>({artifactId:a.artifactId??null,version:a.version??null,decision:a.decision??null,ordinal:Number.isSafeInteger(a.ordinal)&&a.ordinal>0?a.ordinal:index+1,id:a.id??null}));
 // Sort explicit ledger ordinals, falling back to the stable saved array order.
 const ordered=decisions.map((decision,index)=>({...decision,index})).sort((a,b)=>a.ordinal-b.ordinal||a.index-b.index);
 const latest=new Map();for(const decision of ordered)latest.set(`${decision.artifactId}@${decision.version}`,decision);
 const current=[...artifacts({...project,story:project.story??{version:1,treatment:'',scenes:[]},shots:project.shots??[]}),...recordArtifacts(project)];
 const approvedArtifacts=current.filter(artifact=>latest.get(`${artifact.logical_key}@${artifact.version}`)?.decision==='approved').map(artifact=>({artifactId:artifact.logical_key,kind:artifact.kind,version:artifact.version,contentHash:artifact.content_hash,content:structuredClone(artifact.content)}));
 const references=new Map();
 for(const artifact of approvedArtifacts){
  for(const ref of artifact.content.references??[])if(typeof ref.assetId==='string')references.set(`${ref.assetId}@${ref.version??''}`,{assetId:ref.assetId,...(Number.isSafeInteger(ref.version)?{version:ref.version}:{})});
  for(const field of ['referenceAssetId','clipAssetId'])if(typeof artifact.content[field]==='string'&&artifact.content[field])references.set(`${artifact.content[field]}@`,{assetId:artifact.content[field]});
 }
 for(const id of project.referenceIds??[])if(typeof id==='string'&&id)references.set(`${id}@`,{assetId:id});
 const context={inputSignature:briefInputSignature(project),structuredBrief:creative.brief,status:creative.status,approved:creative.approved,departmentPlan:creative.departmentPlan,questions:creative.questions,approvedDecisionDigest:hash(decisions),approvedArtifacts,referenceIds:[...references.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId)||(a.version??0)-(b.version??0))};
 if(['write_script','revise_script','plan_departments'].includes(operation))context.screenplay=screenplayPlanningContext(project);
 if(operation==='plan_departments'){
  const departments=departmentPlanningContext(project,approvals);
  // The opaque canonical signatures duplicate the script and department records
  // already included in full. Send exact digest bindings, retaining all actual
  // source material, current decisions and filmmaking guidance below.
  context.departmentPlanning={...departments,inputSignature:hash(departments.inputSignature),sourceSignature:hash(departments.sourceSignature)};
 }
 const serialized=JSON.stringify(context);
 if(serialized.length>(context.screenplay?180000:30000))fail(409,'Approved creative decisions and script sources exceed the reviewed planning context limit; no approved constraints or source text were truncated.');
 if(/data:(?:image|audio|video)\//i.test(serialized))fail(409,'Planning creative context cannot contain embedded media bytes.');
 return context;
}
export function preparePlanningRequest(project,model,operation='initial_plan',now=Date.now(),approvals=[]){
 const profile=planningProfile(model,now,operation),c=model.capabilities.planning;
 const creative=briefPlanningContext(project,approvals);
 if(operation!=='interpret_brief'&&project.creativeBrief&&(!creative.approved||creative.stale))fail(409,'Review and approve the current structured brief before film planning.');
 if(['write_script','revise_script'].includes(operation)&&(!creative.approved||creative.stale))fail(409,'Review and approve the current structured brief before screenplay writing.');
 if(operation==='plan_departments'&&(!creative.approved||creative.stale||!screenplayContext(project,approvals).approved))fail(409,'Department planning requires the current approved creative brief and screenplay.');
 const context=planningCreativeContext(project,approvals,operation);
 const brief=JSON.stringify({premise:project.premise,direction:project.direction,language:project.language,format:project.format,operation,...(operation==='revise_plan'?{existingStory:project.story}:{} )});
 const request=buildPlanningRequest({brief,duration:project.duration,model:model.model_version,maxOutputTokens:c.maxOutputTokens,operation,context});
 if(Buffer.byteLength(JSON.stringify(request.body),'utf8')>c.maxRequestBytes)fail(409,'This planning request exceeds the reviewed input limit. Shorten the brief before continuing.');
 const quote=quotePlanningBound({request,pricing:model.price_evidence,tokenEvidence:{...c.tokenBoundEvidence,model:request.model,requestHash:request.requestHash,inputTokenUpperBound:c.contextWindowTokens,contextWindowTokens:c.contextWindowTokens},now});
 return {profile,request,quote};
}

import {hash,fail,artifacts} from './domain.mjs';
import {recordArtifacts} from './production-records.mjs';
import {planSchema} from './providers.mjs';
import {briefProposalSchema,briefProposalInstruction} from './brief-proposal.mjs';
import {briefPlanningContext,briefInputSignature} from './public/creative-brief-core.js';
import {PLANNING_VERSION,filmPlanningInstruction,buildPlanningRequest,quotePlanningBound,calculatePlanningCost} from './planning-provider.mjs';
export const planningSchemaHash=hash({version:PLANNING_VERSION,planSchema,filmPlanningInstruction,briefProposalSchema,briefProposalInstruction});
const positive=n=>Number.isSafeInteger(n)&&n>0;
const source=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
export function planningProfile(model,now=Date.now()){
 const time=now instanceof Date?now.getTime():typeof now==='string'?Date.parse(now):now,c=model?.capabilities?.planning,s=model?.schema_evidence,p=model?.price_evidence,t=c?.tokenBoundEvidence;
 if(!model||model.provider!=='openai'||model.endpoint!=='https://api.openai.com/v1/responses'||![model.active,model.execution_tested,model.quality_validated,c?.enabled,c?.background,c?.providerRetentionAcknowledged,s?.verified].every(x=>x===true))fail(409,'A reviewed planning model and background-data policy are required.');
 if(typeof model.model_version!=='string'||!c.version||s.endpoint!==model.endpoint||s.modelVersion!==model.model_version||s.inputSchemaHash!==planningSchemaHash||!s.version||!source(s.sourceUrl)||!(Date.parse(s.expiresAt)>time))fail(409,'The planning schema or model evidence is unavailable or expired.');
 if(!positive(c.contextWindowTokens)||!positive(c.maxOutputTokens)||c.maxOutputTokens>100000||c.maxOutputTokens>c.contextWindowTokens||!positive(c.maxRequestBytes)||c.maxRequestBytes>200000||t?.verified!==true||t.type!=='context-window-upper-bound'||t.model!==model.model_version||t.contextWindowTokens!==c.contextWindowTokens||!t.tokenizerVersion||!source(t.sourceUrl)||!(Date.parse(t.expiresAt)>time))fail(409,'Verified planning token bounds are required.');
 if(p?.version!==model.price_version)fail(409,'Planning prices have changed.');
 const cost=calculatePlanningCost({pricing:p,model:model.model_version,inputTokens:c.contextWindowTokens,outputTokens:c.maxOutputTokens,now:time});
 if(!positive(cost.totalMicroUsd))fail(409,'A positive bounded planning reservation is required.');
 return {fingerprint:hash(model),expiresAt:new Date(Math.min(Date.parse(s.expiresAt),Date.parse(p.expiresAt),Date.parse(t.expiresAt))).toISOString(),maxCallMicroUsd:cost.totalMicroUsd,modelId:model.id,modelVersion:model.model_version,priceVersion:model.price_version};
}
export function planningCreativeContext(project,approvals=[]){
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
 const serialized=JSON.stringify(context);
 if(serialized.length>30000)fail(409,'Approved creative decisions exceed the reviewed planning context limit; no approved constraints were truncated.');
 if(/data:(?:image|audio|video)\//i.test(serialized))fail(409,'Planning creative context cannot contain embedded media bytes.');
 return context;
}
export function preparePlanningRequest(project,model,operation='initial_plan',now=Date.now(),approvals=[]){
 const profile=planningProfile(model,now),c=model.capabilities.planning;
 const creative=briefPlanningContext(project,approvals);
 if(operation!=='interpret_brief'&&project.creativeBrief&&(!creative.approved||creative.stale))fail(409,'Review and approve the current structured brief before film planning.');
 const context=planningCreativeContext(project,approvals);
 const brief=JSON.stringify({premise:project.premise,direction:project.direction,language:project.language,format:project.format,operation,...(operation==='revise_plan'?{existingStory:project.story}:{} )});
 const request=buildPlanningRequest({brief,duration:project.duration,model:model.model_version,maxOutputTokens:c.maxOutputTokens,operation,context});
 if(Buffer.byteLength(JSON.stringify(request.body),'utf8')>c.maxRequestBytes)fail(409,'This planning request exceeds the reviewed input limit. Shorten the brief before continuing.');
 const quote=quotePlanningBound({request,pricing:model.price_evidence,tokenEvidence:{...c.tokenBoundEvidence,model:request.model,requestHash:request.requestHash,inputTokenUpperBound:c.contextWindowTokens,contextWindowTokens:c.contextWindowTokens},now});
 return {profile,request,quote};
}

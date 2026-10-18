import {hash,fail} from './domain.mjs';
import {planSchema,instruction} from './providers.mjs';
import {PLANNING_VERSION,buildPlanningRequest,quotePlanningBound,calculatePlanningCost} from './planning-provider.mjs';
export const planningSchemaHash=hash({version:PLANNING_VERSION,planSchema,instruction});
const positive=n=>Number.isSafeInteger(n)&&n>0;
const source=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
export function planningProfile(model,now=Date.now()){
 const time=now instanceof Date?now.getTime():now,c=model?.capabilities?.planning,s=model?.schema_evidence,p=model?.price_evidence,t=c?.tokenBoundEvidence;
 if(!model||model.provider!=='openai'||model.endpoint!=='https://api.openai.com/v1/responses'||![model.active,model.execution_tested,model.quality_validated,c?.enabled,c?.background,c?.providerRetentionAcknowledged,s?.verified].every(x=>x===true))fail(409,'A reviewed planning model and background-data policy are required.');
 if(typeof model.model_version!=='string'||!c.version||s.endpoint!==model.endpoint||s.modelVersion!==model.model_version||s.inputSchemaHash!==planningSchemaHash||!s.version||!source(s.sourceUrl)||!(Date.parse(s.expiresAt)>time))fail(409,'The planning schema or model evidence is unavailable or expired.');
 if(!positive(c.contextWindowTokens)||!positive(c.maxOutputTokens)||c.maxOutputTokens>100000||c.maxOutputTokens>c.contextWindowTokens||!positive(c.maxRequestBytes)||c.maxRequestBytes>200000||t?.verified!==true||t.type!=='context-window-upper-bound'||t.model!==model.model_version||t.contextWindowTokens!==c.contextWindowTokens||!t.tokenizerVersion||!source(t.sourceUrl)||!(Date.parse(t.expiresAt)>time))fail(409,'Verified planning token bounds are required.');
 if(p?.version!==model.price_version)fail(409,'Planning prices have changed.');
 const cost=calculatePlanningCost({pricing:p,model:model.model_version,inputTokens:c.contextWindowTokens,outputTokens:c.maxOutputTokens,now:time});
 if(!positive(cost.totalMicroUsd))fail(409,'A positive bounded planning reservation is required.');
 return {fingerprint:hash(model),expiresAt:new Date(Math.min(Date.parse(s.expiresAt),Date.parse(p.expiresAt),Date.parse(t.expiresAt))).toISOString(),maxCallMicroUsd:cost.totalMicroUsd,modelId:model.id,modelVersion:model.model_version,priceVersion:model.price_version};
}
export function preparePlanningRequest(project,model,operation='initial_plan',now=Date.now()){
 const profile=planningProfile(model,now),c=model.capabilities.planning;
 const brief=JSON.stringify({premise:project.premise,direction:project.direction,language:project.language,format:project.format,operation,...(operation==='revise_plan'?{existingStory:project.story}:{} )});
 const request=buildPlanningRequest({brief,duration:project.duration,model:model.model_version,maxOutputTokens:c.maxOutputTokens});
 if(Buffer.byteLength(JSON.stringify(request.body),'utf8')>c.maxRequestBytes)fail(409,'This planning request exceeds the reviewed input limit. Shorten the brief before continuing.');
 const quote=quotePlanningBound({request,pricing:model.price_evidence,tokenEvidence:{...c.tokenBoundEvidence,model:request.model,requestHash:request.requestHash,inputTokenUpperBound:c.contextWindowTokens,contextWindowTokens:c.contextWindowTokens},now});
 return {profile,request,quote};
}

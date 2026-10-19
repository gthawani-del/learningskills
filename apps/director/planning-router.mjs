import {fail} from './domain.mjs';
import {preparePlanningRequest} from './planning-profile.mjs';
import {planningOperationTask,planningOperationTasks,knownRoutingTask} from './routing-task-catalog.mjs';
import {validateRoutingIntent,evaluateRoutingIntent} from './routing-intent.mjs';

const text=x=>typeof x==='string'&&x.trim()&&x.length<=200;
const list=x=>Array.isArray(x)&&x.length<=50&&new Set(x).size===x.length&&x.every(text);
export const planningOperations=Object.freeze(Object.keys(planningOperationTasks).map(id=>Object.freeze({id,task:planningOperationTasks[id],label:knownRoutingTask(planningOperationTasks[id]).label})));
const policy='Match the reviewed operation, task, language, format, schema, execution, quality and exact reservation. Explicit quality preferences require matching fresh task evaluations; rank their measured fit, then registry priority and stable registry ID. Without those preferences, priority applies after quality admission. Price is a hard bound, never a cheapest-model default. No automatic paid fallback or model switch.';

// Registry discovery and eligibility are distinct from a user's spending consent.
// Only the admitted Responses adapter can execute structured paid planning today;
// fal remains discoverable with an explicit hold until its planning adapter is reviewed.
export function routePlanning({project,approvals=[],models,operation='interpret_brief',modelId,now=Date.now(),budgetMicroUsd,intent}={}){
 const task=planningOperationTask(operation);
 if(!task)fail(400,'Choose a supported planning operation.');
 if(!Array.isArray(models)||models.length>10000||!project||typeof project!=='object')fail(400,'A saved project and server registry are required.');
 if(modelId!==undefined&&!text(modelId))fail(400,'Invalid authorized planning model identity.');
 if(budgetMicroUsd!==undefined&&(!Number.isSafeInteger(budgetMicroUsd)||budgetMicroUsd<1))fail(400,'A positive explicit planning budget is required.');
 validateRoutingIntent(intent);
 const time=now instanceof Date?now.getTime():typeof now==='string'?Date.parse(now):now;
 if(!Number.isFinite(time))fail(400,'Invalid planning routing time.');
 const seen=new Set(),prepared=new Map();
 const candidates=models.map(model=>{
  if(!model||!text(model.id)||seen.has(model.id))fail(400,'Registry planning identities must be unique.');seen.add(model.id);
  const holds=[],explanation=[],priority=model.capabilities?.priority??0;
  if(model.provider!=='openai')holds.push(model.provider==='fal'?'fal_structured_planning_adapter_unavailable':'planning_provider_adapter_unavailable');
  if(!Number.isInteger(priority)||priority<0||priority>1000)holds.push('planning_priority_invalid');
  if(!list(model.capabilities?.languages)||!model.capabilities.languages.includes(project.language))holds.push('planning_language_unsupported');
  if(!list(model.capabilities?.planning?.formats)||!model.capabilities.planning.formats.includes(project.format))holds.push('planning_format_unsupported');
  if(!model.capabilities?.planning?.operations?.includes(operation))holds.push('planning_operation_not_declared');
  const fit=evaluateRoutingIntent({intent,model,task,now:time});holds.push(...fit.holds);explanation.push(...fit.explanation);
  let context;
  if(model.provider==='openai'){
   try{context=preparePlanningRequest(project,model,operation,now,approvals);prepared.set(model.id,context);}
   catch(error){holds.push('planning_evidence_or_context_held');explanation.push(error.status?error.message:'Planning evidence could not be reviewed.');}
  }
  if(context){
   if(budgetMicroUsd!==undefined&&context.quote.totalMicroUsd>budgetMicroUsd)holds.push('planning_reservation_exceeds_budget');
   explanation.push(`Reviewed ${operation} task ${task}; maximum reservation ${context.quote.totalMicroUsd} micro USD.`);
  }
  if(!holds.includes('planning_language_unsupported'))explanation.push(`Explicit language capability: ${project.language}.`);
  if(!holds.includes('planning_format_unsupported'))explanation.push(`Explicit project-format capability: ${project.format}.`);
  return {modelId:model.id,provider:model.provider??null,endpoint:model.endpoint??null,modelVersion:model.model_version??null,priority:Number.isInteger(priority)&&priority>=0&&priority<=1000?priority:0,eligible:holds.length===0,holds,explanation,...(intent===undefined?{}:{intentFit:fit}),...(context?{maxCallMicroUsd:context.quote.totalMicroUsd,profileFingerprint:context.profile.fingerprint,expiresAt:context.profile.expiresAt}:{})};
 });
 candidates.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.intentFit?.score??0)-(a.intentFit?.score??0)||b.priority-a.priority||(a.modelId<b.modelId?-1:a.modelId>b.modelId?1:0));
 const selectedCandidate=modelId===undefined?candidates.find(candidate=>candidate.eligible):candidates.find(candidate=>candidate.modelId===modelId&&candidate.eligible);
 const selected=selectedCandidate?{...selectedCandidate}:null;
 return {operation,task,status:selected?'selected':'held',selectedModelId:selected?.modelId??null,selected,candidates,policy,...(intent===undefined?{}:{intent:structuredClone(intent)}),...(selected?{context:prepared.get(selected.modelId),model:models.find(model=>model.id===selected.modelId)}:{})};
}

export function publicPlanningRoute(route){
 const {context,model,...visible}=route;
 return visible;
}

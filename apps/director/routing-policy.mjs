import {hash,fail} from './domain.mjs';
import {validateRoutingIntent} from './routing-intent.mjs';
import {planningOperationTasks,routingTasks} from './routing-task-catalog.mjs';
import {applyProductionRecord} from './production-records.mjs';
export const ROUTING_POLICY_KIND='director_routing_policy_v1';
const policyOperations=new Set([...Object.keys(planningOperationTasks),...routingTasks.map(t=>t.id)]);
const current=r=>r.versions?.find(v=>v.version===r.currentVersion);
export function routingPolicyRecords(project){return (project.production?.records||[]).filter(r=>r.type==='edit'&&current(r)?.content?.kind===ROUTING_POLICY_KIND);}
function document(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4||!['kind','intent','operations','sourceBriefVersion'].every(k=>Object.hasOwn(value,k))||value.kind!==ROUTING_POLICY_KIND)fail(400,'Invalid routing preference contract.');
 validateRoutingIntent(value.intent);if(value.intent===undefined)fail(400,'Routing preferences require an explicit intent object.');
 if(!Array.isArray(value.operations)||!value.operations.length||value.operations.length>policyOperations.size||new Set(value.operations).size!==value.operations.length||value.operations.some(op=>!policyOperations.has(op)))fail(400,'Choose registered production tasks or implemented planning operations for these preferences.');
 if(value.sourceBriefVersion!==null&&(!Number.isSafeInteger(value.sourceBriefVersion)||value.sourceBriefVersion<1))fail(400,'Invalid routing preference source version.');
 return structuredClone(value);
}
export function saveRoutingPolicy(project,body,assets=[]){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['expectedVersion','intent','operations'].includes(k)))fail(400,'Routing preferences cannot set model, price or spending authority.');
 const records=routingPolicyRecords(project);if(records.length>1)fail(409,'Resolve duplicate routing preference records before continuing.');
 const content=document({kind:ROUTING_POLICY_KIND,intent:body.intent,operations:body.operations??Object.keys(planningOperationTasks),sourceBriefVersion:project.creativeBrief?.currentVersion??null});
 return applyProductionRecord(project,{expectedVersion:body.expectedVersion,...(records[0]?{id:records[0].id}:{}),type:'edit',name:'Director routing preferences',content,references:[],dependencies:[]},assets);
}
export function routingPolicyContext(project,approvals=[],operation){
 const records=routingPolicyRecords(project);if(!records.length)return {intent:undefined,policy:null};
 if(records.length!==1)fail(409,'Resolve duplicate routing preference records before planning.');
 const r=records[0],snapshot=current(r),content=document(snapshot.content),decision=approvals.filter(a=>a.artifactId==='record:'+r.id&&a.version===r.currentVersion).at(-1);
 if(decision?.decision!=='approved')fail(409,'Review and approve the current routing preferences before planning.');
 if(content.sourceBriefVersion!==(project.creativeBrief?.currentVersion??null))fail(409,'The brief changed. Review updated routing preferences before planning.');
 const applies=content.operations.includes(operation),policy={kind:ROUTING_POLICY_KIND,recordId:r.id,version:r.currentVersion,contentHash:hash(content),approvalId:decision.id,applies};
 return {intent:applies?structuredClone(content.intent):undefined,policy};
}

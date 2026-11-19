import {fail} from './domain.mjs';
import {buildProductionPackage,dispatchProductionPackageAction} from './production-package.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const paid=new Set(['write_script','plan_departments','plan_storyboard']);
export function createProductionPackageController({store,planningController,now=()=>new Date()}){
 async function facts(actorId,projectId){
  const project=await store.get(projectId,actorId);const [assets,approvals,referenceCandidates,storyboardCandidates,quotes,outcomes]=await Promise.all([store.records('assets',projectId),store.records('approvals',projectId),project.referenceProduction?store.referenceCandidates(actorId,projectId):[],project.storyboardProduction?store.storyboardCandidates(actorId,projectId):[],store.readProductionQuotes?store.readProductionQuotes(actorId,projectId,project.version):[],store.records('audit',projectId)]);
  let renderJobs=[],renderAccountingAvailable=true;try{renderJobs=await store.readRenderJobs(actorId,projectId);}catch(e){if(e.status!==503)throw e;renderAccountingAvailable=false;}
  return {project,assets,approvals,referenceCandidates,storyboardCandidates,quotes,outcomes,renderJobs,renderAccountingAvailable,now:now()};
 }
 return {
  async summary(actorId,projectId){return buildProductionPackage(await facts(actorId,projectId));},
  async action(actorId,projectId,body){
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['requestId','expectedVersion','actionId','sourceDigest','consentId'].includes(k))||!uuid.test(body.requestId||'')||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||!/^[a-f0-9]{64}$/.test(body.actionId||'')||!/^[a-f0-9]{64}$/.test(body.sourceDigest||'')||body.consentId!==undefined&&!uuid.test(body.consentId))fail(400,'Choose one current production action and its exact source.');
   const current=await facts(actorId,projectId),recommendation=buildProductionPackage(current),action=recommendation.actions.find(a=>a.id===body.actionId);
   if(!action)fail(409,'Review the current production recommendation before continuing.');
   return dispatchProductionPackageAction({package:recommendation,request:body,current,
    assertAuthorized:async()=>{await store.get(projectId,actorId);if(!paid.has(action.operation))return true;if(!planningController||!body.consentId)fail(409,'Review an operation-specific estimate and approve its planning allowance first.');const summary=await store.planningSummary(actorId,projectId);return summary.consents.some(c=>c.id===body.consentId&&c.operation===action.operation&&c.status==='active');},
    handler:async()=>paid.has(action.operation)?{action,call:await planningController.start({actorId,projectId,requestId:body.requestId,expectedVersion:body.expectedVersion,consentId:body.consentId,operation:action.operation})}:{action,destination:action.destination,generationAuthorized:false}
   });
  }
 };
}

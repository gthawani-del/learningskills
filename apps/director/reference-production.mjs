import {createHash} from 'node:crypto';
import {fail,hash} from './domain.mjs';
import {applyReferenceProductionCommand,referenceProductionContext} from './public/reference-production-core.js';
import {buildReferenceInput,referenceImageOutput} from './reference-input.mjs';
import {downloadReferencePNG,inspectReferencePNG} from './reference-images.mjs';
import {selectRoutes} from './model-router.mjs';
import {taskCandidates} from './routing-task-catalog.mjs';
import {quoteRequirements} from './quote-input.mjs';
import {createCostQuote} from './cost-quotes.mjs';
import {createJobController} from './jobs.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quoteId=/^[a-f0-9]{64}$/;
const stableId=value=>{const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const taskFor=subject=>subject.kind==='character_look'?'reference_look':'reference_image';
const requirementsFor=task=>({modality:'image',inputModes:task==='reference_look'?['image','text']:['text'],resolution:'1024x1024',aspectRatio:'1:1',identityReferences:task==='reference_look'});
const exact=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Supply supported reference production fields.');};
const current=(project,body)=>{if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion!==project.version)fail(409,'The project changed. Reopen reference production before continuing.');};
const requestId=value=>{if(!uuid.test(value||''))fail(400,'A valid saved reference request identity is required.');};
const visibleAsset=(project,asset)=>{const {storageKey,bucket,...value}=asset;return {...value,url:`/api/projects/${project.id}/assets/${asset.id}/content`};};

export function createReferenceController({store,providers,storage,fetcher=fetch,generationConfigured=false}){
 const jobs=createJobController({store,providers});
 async function facts(actorId,project){const r=await Promise.allSettled([store.records('approvals',project.id),store.records('assets',project.id),store.referenceCandidates(actorId,project.id)]);const error=r.find(x=>x.status==='rejected');if(error)throw error.reason;return{approvals:r[0].value,assets:r[1].value,candidates:r[2].value};}
 function context(project,info){return referenceProductionContext(project,info.approvals,info);}
 function visibleContext(project,value){return {...value,subjects:value.subjects.map(s=>({...s,candidates:s.candidates.map(c=>({...c,...(c.asset?{asset:visibleAsset(project,c.asset)}:{})}))}))};}
 async function jobScope(actorId,projectId,jobId){requestId(jobId);return store.referenceJobScope(actorId,projectId,jobId);}
 return {
  async summary(actorId,project){
   const r=await Promise.allSettled([facts(actorId,project),store.registry(),store.generationControl(),store.readProjectSpendingBudget(actorId,project.id),store.readReferenceJobs(actorId,project.id)]);const error=r.find(x=>x.status==='rejected');if(error)throw error.reason;
   const [info,registry,control,projectBudget,referenceJobs]=r.map(x=>x.value),models=[];
   for(const task of ['reference_image','reference_look']){
    const candidates=taskCandidates(task,registry),routing=selectRoutes({task,requirements:requirementsFor(task),models:candidates});
    for(const result of routing.candidates){const model=candidates.find(m=>m.id===result.modelId);models.push({id:model.id,provider:model.provider,endpoint:model.endpoint,task,eligible:result.eligibleForQuote,holds:result.holds,price:model.price_evidence??null});}
   }
   const generationHolds=[];if(!generationConfigured)generationHolds.push('Model generation requires a connected workspace and configured server credentials.');if(control?.generationPaused!==false)generationHolds.push('New generation is paused by the studio administrator.');if(!models.some(m=>m.eligible))generationHolds.push('No reviewed reference model is currently eligible.');
   return {referenceContext:visibleContext(project,context(project,info)),models,jobs:referenceJobs.map(j=>({id:j.id,subjectId:j.subjectId,subjectVersion:j.subjectVersion,status:j.status,chargeState:j.charge_state,reservedMicroUsd:j.reserved_micro_usd,actualMicroUsd:j.actual_micro_usd??null,providerRequestKnown:!!j.provider_request_id,quoteId:j.quoteId??null,authorizationId:j.authorizationId??j.authorization_id??null,failureReviewed:j.failureReviewed===true})),projectBudget,generationAvailable:generationHolds.length===0,generationHolds};
  },
  async change(actorId,project,body){
   current(project,body);const info=await facts(actorId,project);
   if(body.action==='add_uploaded'){
    exact(body,['expectedVersion','action','subjectId','assetId']);requestId(body.assetId);
    const subject=context(project,info).subjects.find(s=>s.id===body.subjectId),asset=info.assets.find(a=>a.id===body.assetId&&a.projectId===project.id);
    if(!subject||!asset)fail(404,'Choose a saved image and reference subject in this project.');
    if(asset.generated)fail(400,'A generated image must use its recorded generation receipt.');
    const candidate=await store.registerReferenceCandidate({actorId,projectId:project.id,candidate:{id:stableId(`upload:${project.id}:${subject.id}:${subject.current.version}:${asset.id}:${asset.version}`),projectId:project.id,subjectId:subject.id,subjectVersion:subject.current.version,assetId:asset.id,assetVersion:asset.version,origin:'uploaded',jobId:null,createdAt:new Date().toISOString()}});
    return {project,candidate,referenceContext:visibleContext(project,context(project,await facts(actorId,project)))};
   }
   const next=applyReferenceProductionCommand(project,body,info.approvals,info),saved=next.version===project.version?project:await store.saveReferenceProduction(next,project.version,{expectedApprovalId:info.approvals.at(-1)?.id??null});
   return {project:saved,referenceContext:visibleContext(saved,context(saved,info))};
  },
  async quote(actorId,project,body){
   exact(body,['expectedVersion','requestId','subjectId','modelId','shareIdentityReference']);requestId(body.requestId);
   const requestFingerprint=hash({operation:'reference_image_quote',...body});
   const previous=await store.replayCostQuote({actorId,projectId:project.id,requestId:body.requestId,requestFingerprint});if(previous)return {quote:previous,saved:true};
   current(project,body);const info=await facts(actorId,project),subject=context(project,info).subjects.find(s=>s.id===body.subjectId);
   if(!subject||!subject.directionApproved||subject.sourceStale||subject.identityStale)fail(409,'Approve the current reference direction and identity before reviewing its generation cost.');
   const task=taskFor(subject),models=taskCandidates(task,await store.registry()),model=models.find(m=>m.id===body.modelId);
   const routing=selectRoutes({task,requirements:requirementsFor(task),models});
   if(!model||!routing.eligibleForQuote.includes(model.id))fail(409,'No reviewed model is eligible for this reference.');
   let identityUrl;
   if(task==='reference_look'){
    if(body.shareIdentityReference!==true)fail(400,'Allow this approved identity image to be shared with fal for this look generation.');
    const binding=subject.current.identityBinding,asset=info.assets.find(a=>a.id===binding?.assetId&&a.version===binding.assetVersion&&a.projectId===project.id);
    if(!asset)fail(409,'The approved private identity image is unavailable.');
    identityUrl=await storage.sign(asset.storageKey,{bucket:asset.bucket||'director-media',expiresIn:3600});
   }else if(body.shareIdentityReference!==undefined&&body.shareIdentityReference!==false)fail(400,'Initial identity and location creation do not share an existing identity image.');
   const input=buildReferenceInput({project,subject,model,identityUrl}),requirements=quoteRequirements({task,requirements:requirementsFor(task),model,input});
   const quote=createCostQuote({project,artifactId:'reference_brief:'+subject.id,artifactVersion:subject.current.version,task,requirements,model,input,now:new Date()});
   const saved=await store.persistCostQuote({actorId,projectId:project.id,requestId:body.requestId,expectedVersion:project.version,requestFingerprint,quote,input});
   return {quote:saved,saved:true};
  },
  async start(actorId,project,body){
   exact(body,['expectedVersion','quoteId','authorizationId','requestId']);requestId(body.requestId);requestId(body.authorizationId);if(!quoteId.test(body.quoteId||'')||!Number.isSafeInteger(body.expectedVersion))fail(400,'Choose a saved reference quote and authorization.');
   if(!generationConfigured)fail(503,'Reference generation is not configured. No model request was started.');
   const job=await store.reserveReferenceJob({actorId,projectId:project.id,expectedVersion:body.expectedVersion,quoteId:body.quoteId,authorizationId:body.authorizationId,idempotencyKey:body.requestId});
   return {job:await jobs.dispatch({actorId,projectId:project.id,jobId:job.id})};
  },
  async review(actorId,project,body){exact(body,['jobId','expectedVersion','reason']);requestId(body.jobId);current(project,body);if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>2000)fail(400,'Describe the visible correction needed in 5–2000 characters.');return{review:await store.reviewReferenceJob({actorId,projectId:project.id,...body})};},
  async importOutput(actorId,project,body){
   exact(body,['jobId']);const {job,proposal,model,subjectId,subjectVersion}=await jobScope(actorId,project.id,body.jobId);
   if(job.status!=='completed'||!job.provider_request_id)fail(409,'Wait for this saved request to complete before importing its image.');
   const assetId=stableId('reference-asset:'+job.id),candidateId=stableId('reference-candidate:'+job.id),assets=await store.records('assets',project.id),receipts=await store.referenceCandidates(actorId,project.id);
   let asset=assets.find(a=>a.id===assetId),candidate=receipts.find(c=>c.jobId===job.id);
   if(candidate&&asset)return {candidate,asset:visibleAsset(project,asset)};
   const generated={jobId:job.id,requestId:job.provider_request_id,endpoint:model.endpoint,payloadHash:job.payload_hash,subjectId,subjectVersion},bucket='director-reference-media',key=`${actorId}/${project.id}/${assetId}`;
   if(asset&&hash(asset.generated)!==hash(generated))fail(409,'The stored image provenance conflicts with this request.');
   if(!asset){
    const output=await store.readReferenceJobOutput(actorId,project.id,job.id);if(!output)fail(409,'The saved provider output is pending. Check this existing request without generating again.');
    const descriptor=referenceImageOutput(model.endpoint,output);let bytes,metadata;
    // Recover an immutable object written before a metadata interruption, even
    // when the provider's temporary download URL has since expired.
    try{const stored=await storage.get(key,{bucket});metadata=inspectReferencePNG(stored);bytes=stored;}catch(error){if(error.status===415)throw error;}
    if(!bytes){const downloaded=await downloadReferencePNG(descriptor.url,{fetcher,width:descriptor.width??1024,height:descriptor.height??1024});bytes=downloaded.bytes;metadata={mime:downloaded.mime,width:downloaded.width,height:downloaded.height,size:downloaded.size};}
    const checksum=hash(bytes.toString('base64'));await storage.putIfAbsent(key,bytes,'image/png',checksum,{bucket});
    const record=project.referenceProduction?.subjects.find(s=>s.id===subjectId),role=record?.kind==='character_identity'?'character_identity':record?.kind==='character_look'?'wardrobe':'location';
    const value={id:assetId,projectId:project.id,name:`${record?.versions.find(v=>v.version===subjectVersion)?.document.name||'Reference'} — candidate`,mime:'image/png',role,scope:'project',shotId:null,version:1,storageKey:key,bucket,size:metadata.size,width:metadata.width,height:metadata.height,checksum,generated};
    try{asset=await store.add('assets',value);}catch(error){if(error.status!==409)throw error;asset=(await store.records('assets',project.id)).find(a=>a.id===assetId&&a.checksum===checksum&&hash(a.generated)===hash(generated));if(!asset)throw error;}
   }
   candidate=await store.registerReferenceCandidate({actorId,projectId:project.id,candidate:{id:candidateId,projectId:project.id,subjectId,subjectVersion,assetId:asset.id,assetVersion:asset.version,origin:'generated',jobId:job.id,createdAt:new Date().toISOString()}});
   return {candidate,asset:visibleAsset(project,asset)};
  }
 };
}

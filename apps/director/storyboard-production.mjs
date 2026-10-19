import {createHash} from 'node:crypto';
import {fail,hash} from './domain.mjs';
import {applyStoryboardProductionCommand,storyboardProductionContext,currentStoryboardProductionSpec} from './public/storyboard-production-core.js';
import {buildStoryboardFrameInput,storyboardFrameOutput,storyboardFrameRequirements,STORYBOARD_FRAME_CONFIGURATIONS} from './storyboard-frame-input.mjs';
import {downloadReferencePNG,inspectReferencePNG} from './reference-images.mjs';
import {assertStoryboardFramePricing} from './storyboard-pricing.mjs';
import {selectRoutes} from './model-router.mjs';
import {taskCandidates} from './routing-task-catalog.mjs';
import {quoteRequirements} from './quote-input.mjs';
import {createCostQuote} from './cost-quotes.mjs';
import {createJobController} from './jobs.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stableId=value=>{const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const exact=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Supply supported storyboard production fields.');};
const requestId=id=>{if(!uuid.test(id||''))fail(400,'Use a valid saved storyboard request identity.');};
const current=(project,body)=>{if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion!==project.version)fail(409,'The project changed. Reopen the storyboard before continuing.');};
const visibleAsset=(project,asset)=>{const{storageKey,bucket,...value}=asset;return {...value,url:`/api/projects/${project.id}/assets/${asset.id}/content`};};

export function createStoryboardProductionController({store,providers,storage,fetcher=fetch,generationConfigured=false}){
 const jobs=createJobController({store,providers});
 async function facts(actorId,project){const r=await Promise.allSettled([store.records('approvals',project.id),store.records('assets',project.id),store.referenceCandidates(actorId,project.id),store.storyboardCandidates(actorId,project.id)]);const error=r.find(x=>x.status==='rejected');if(error)throw error.reason;return {approvals:r[0].value,assets:r[1].value,referenceCandidates:r[2].value,candidates:r[3].value};}
 const context=(project,info)=>storyboardProductionContext(project,info.approvals,info);
 const visibleContext=(project,value)=>({...value,shots:value.shots.map(shot=>({...shot,uniqueReferenceAssets:shot.uniqueReferenceAssets.map(a=>visibleAsset(project,a)),candidates:shot.candidates.map(c=>({...c,...(c.asset?{asset:visibleAsset(project,c.asset)}:{})}))}))});
 return {
  async summary(actorId,project){
   const r=await Promise.allSettled([facts(actorId,project),store.registry(),store.generationControl(),store.readProjectSpendingBudget(actorId,project.id),store.readStoryboardJobs(actorId,project.id)]);const error=r.find(x=>x.status==='rejected');if(error)throw error.reason;
   const[info,registry,control,projectBudget,savedJobs]=r.map(x=>x.value),value=context(project,info),task='storyboard_frame',candidates=taskCandidates(task,registry),routing=selectRoutes({task,requirements:{modality:'image',inputModes:['image','text'],identityReferences:true},models:candidates});
   const models=routing.candidates.map(result=>{const model=candidates.find(m=>m.id===result.modelId),holds=[...result.holds];try{assertStoryboardFramePricing(model.price_evidence,{num_images:1,image_urls:['https://reference.example.test/image']});}catch{holds.push('complete_input_image_tariff_required');}
    const shotEligibility=Object.fromEntries(value.shots.map(shot=>{let fit;try{fit=selectRoutes({task,requirements:storyboardFrameRequirements(shot),models:[model]}).candidates[0];}catch{return[shot.shotId,{eligible:false,holds:['unsupported_frame_configuration']}];}return[shot.shotId,{eligible:fit.eligibleForQuote&&holds.length===0,holds:[...new Set([...holds,...fit.holds])]}];}));
    return{id:model.id,provider:model.provider,endpoint:model.endpoint,task,eligible:holds.length===0,holds,price:model.price_evidence??null,shotEligibility};});
   const generationHolds=[];if(!generationConfigured)generationHolds.push('Frame generation requires a connected workspace and configured server credentials.');if(control?.generationPaused!==false)generationHolds.push('New generation is paused by the studio administrator.');if(!models.some(m=>m.eligible))generationHolds.push('No reviewed frame model with complete input-image pricing is currently eligible.');
   return {storyboardProductionContext:visibleContext(project,value),models,jobs:savedJobs.map(j=>({id:j.id,shotId:j.shotId,specVersion:j.specVersion,status:j.status,chargeState:j.charge_state,reservedMicroUsd:j.reserved_micro_usd,actualMicroUsd:j.actual_micro_usd??null,providerRequestKnown:!!j.provider_request_id,quoteId:j.quoteId??null,authorizationId:j.authorizationId??j.authorization_id??null,failureReviewed:j.failureReviewed===true})),projectBudget,generationAvailable:generationHolds.length===0,generationHolds};
  },
  async change(actorId,project,body){current(project,body);const info=await facts(actorId,project),next=applyStoryboardProductionCommand(project,body,info.approvals,info),saved=next.version===project.version?project:await store.saveStoryboardProduction(next,project.version,{expectedApprovalId:info.approvals.at(-1)?.id??null});return {project:saved,storyboardProductionContext:visibleContext(saved,context(saved,info))};},
  async quote(actorId,project,body){
   exact(body,['expectedVersion','requestId','shotId','modelId','shareReferences']);requestId(body.requestId);
   const requestFingerprint=hash({operation:'storyboard_frame_quote',...body}),previous=await store.replayCostQuote({actorId,projectId:project.id,requestId:body.requestId,requestFingerprint});if(previous)return {quote:previous,saved:true};
   current(project,body);if(body.shareReferences!==true)fail(400,'Allow the exact approved input images to be shared with fal for this frame.');
   const info=await facts(actorId,project),shot=context(project,info).shots.find(s=>s.shotId===body.shotId);
   if(!shot?.directionApproved||shot.sourceStale||shot.referenceStale)fail(409,'Approve the current frame direction, shot plan and exact reference bindings before quoting.');
   const task='storyboard_frame',models=taskCandidates(task,await store.registry()),model=models.find(m=>m.id===body.modelId),routing=selectRoutes({task,requirements:storyboardFrameRequirements(shot),models});
   if(!model||!routing.eligibleForQuote.includes(model.id))fail(409,'No reviewed model supports this exact frame and output configuration.');
   assertStoryboardFramePricing(model.price_evidence,{num_images:1,image_urls:shot.uniqueReferenceAssets.map((a,i)=>'https://reference.example.test/image-'+i)});
   const referenceUrls=await Promise.all(shot.uniqueReferenceAssets.map(a=>storage.sign(a.storageKey,{bucket:a.bucket||'director-media',expiresIn:3600})));
   const input=buildStoryboardFrameInput({project,shot,model,referenceUrls}),requirements=quoteRequirements({task,requirements:storyboardFrameRequirements(shot),model,input});
   const quote=createCostQuote({project,artifactId:'storyboard_brief:'+shot.shotId,artifactVersion:shot.current.version,task,requirements,model,input,now:new Date()});
   return {quote:await store.persistCostQuote({actorId,projectId:project.id,requestId:body.requestId,expectedVersion:project.version,requestFingerprint,quote,input}),saved:true};
  },
  async start(actorId,project,body){
   exact(body,['expectedVersion','quoteId','authorizationId','requestId']);requestId(body.requestId);requestId(body.authorizationId);if(!/^[a-f0-9]{64}$/.test(body.quoteId||'')||!Number.isSafeInteger(body.expectedVersion))fail(400,'Choose a saved frame quote and authorization.');
   if(!generationConfigured)fail(503,'Storyboard generation is not configured. No provider call was started.');
   const job=await store.reserveStoryboardJob({actorId,projectId:project.id,expectedVersion:body.expectedVersion,quoteId:body.quoteId,authorizationId:body.authorizationId,idempotencyKey:body.requestId});return {job:await jobs.dispatch({actorId,projectId:project.id,jobId:job.id})};
  },
  async review(actorId,project,body){exact(body,['jobId','expectedVersion','reason']);requestId(body.jobId);current(project,body);if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>2000)fail(400,'Describe the pictured correction needed in 5–2000 characters.');return {review:await store.reviewStoryboardJob({actorId,projectId:project.id,...body})};},
  async importOutput(actorId,project,body){
   exact(body,['jobId']);requestId(body.jobId);const{job,proposal,model,shotId,specVersion}=await store.storyboardJobScope(actorId,project.id,body.jobId);
   if(job.status!=='completed'||!job.provider_request_id)fail(409,'Wait for this saved request to complete before importing the frame.');
   const archived=project.storyboardProduction?.shots.find(s=>s.shotId===shotId)?.versions.find(v=>v.version===specVersion),dimensions=STORYBOARD_FRAME_CONFIGURATIONS[archived?.document.aspectRatio];if(!dimensions)fail(409,'The saved frame specification and exact output dimensions are unavailable.');
   const assetId=stableId('storyboard-asset:'+job.id),candidateId=stableId('storyboard-candidate:'+job.id),assets=await store.records('assets',project.id),receipts=await store.storyboardCandidates(actorId,project.id);let asset=assets.find(a=>a.id===assetId),candidate=receipts.find(c=>c.jobId===job.id);if(candidate&&asset)return {candidate,asset:visibleAsset(project,asset)};
   const generated={kind:'storyboard_frame',jobId:job.id,requestId:job.provider_request_id,endpoint:model.endpoint,payloadHash:job.payload_hash,shotId,specVersion},bucket='director-reference-media',key=`${actorId}/${project.id}/${assetId}`;
   if(asset&&hash(asset.generated)!==hash(generated))fail(409,'The stored frame provenance conflicts with this saved request.');
   if(!asset){
    const output=await store.readReferenceJobOutput(actorId,project.id,job.id);if(!output)fail(409,'The saved result is pending. Check this original request without generating again.');const descriptor=storyboardFrameOutput(model.endpoint,output,dimensions);let bytes,metadata;
    try{const stored=await storage.get(key,{bucket});metadata=inspectReferencePNG(stored,dimensions);bytes=stored;}catch(error){if(error.status===415)throw error;}
    if(!bytes){const downloaded=await downloadReferencePNG(descriptor.url,{fetcher,...dimensions});bytes=downloaded.bytes;metadata={mime:downloaded.mime,width:downloaded.width,height:downloaded.height,size:downloaded.size};}
    const checksum=hash(bytes.toString('base64'));await storage.putIfAbsent(key,bytes,'image/png',checksum,{bucket});
    const title=project.storyboardHandoff?.shots.find(s=>s.id===shotId)?.versions.find(v=>v.version===archived.contractVersion)?.document.title||shotId;
    const value={id:assetId,projectId:project.id,name:`${title} — storyboard candidate`,mime:'image/png',role:'storyboard_frame',scope:'shot',shotId,version:1,storageKey:key,bucket,size:metadata.size,width:metadata.width,height:metadata.height,checksum,generated};
    try{asset=await store.add('assets',value);}catch(error){if(error.status!==409)throw error;asset=(await store.records('assets',project.id)).find(a=>a.id===assetId&&a.checksum===checksum&&hash(a.generated)===hash(generated));if(!asset)throw error;}
   }
   candidate=await store.registerStoryboardCandidate({actorId,projectId:project.id,candidate:{id:candidateId,projectId:project.id,shotId,specVersion,assetId:asset.id,assetVersion:asset.version,origin:'generated',jobId:job.id,createdAt:new Date().toISOString()}});return {candidate,asset:visibleAsset(project,asset)};
  }
 };
}

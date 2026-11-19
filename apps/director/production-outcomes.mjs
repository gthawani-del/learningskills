import {currentMusicVideo} from './public/music-video-core.js';
import {hash,fail} from './domain.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PRODUCTION_DEFECTS=Object.freeze(['identity','lip_sync','timing','motion','camera','continuity','typography','audio','technical','creative_direction']);
const auditKind=r=>r.type??r.event_type;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const micro=v=>typeof v==='number'&&integer(v)?BigInt(v):typeof v==='string'&&/^(0|[1-9]\d{0,25})$/.test(v)?BigInt(v):null;
export async function recordProductionOutcome({project,actorId,store,body}){
 await store.get(project.id,actorId);
 if(!exact(body,['requestId','expectedVersion','assetId','assetVersion','decision','defects','reason'])||!uuid.test(body.requestId||'')||!uuid.test(body.assetId||'')||!Number.isSafeInteger(body.assetVersion)||body.assetVersion<1||!['accepted','needs_correction','rejected'].includes(body.decision)||!Array.isArray(body.defects)||body.defects.length>10||new Set(body.defects).size!==body.defects.length||body.defects.some(x=>!PRODUCTION_DEFECTS.includes(x))||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000)fail(400,'Review an exact media version with a decision, supported defects and reason.');
 if(body.decision==='needs_correction'&&!body.defects.length)fail(400,'Identify the defect before requesting a correction.');
 const fingerprint=hash({projectId:project.id,actorId,...body});
 const history=await store.records('audit',project.id),previous=history.find(e=>e.id===body.requestId);
 if(previous){if(auditKind(previous)!=='production_outcome'||previous.details?.fingerprint!==fingerprint)fail(409,'This review identity belongs to a different decision.');return {event:previous,replayed:true,generationAuthorized:false};}
 const current=await store.get(project.id,actorId);if(current.version!==body.expectedVersion)fail(409,'The project changed. Review the current media before saving a verdict.');
 const assets=await store.records('assets',project.id),asset=assets.find(a=>a.id===body.assetId&&a.version===body.assetVersion);
 if(!asset||!asset.mime?.match(/^(image|video|audio)\//)||!asset.checksum)fail(409,'The reviewed media version is unavailable.');
 if(asset.generated?.kind==='finished_movie'){const render=await store.readRenderJob(actorId,project.id,asset.generated.renderId);if(render.status!=='completed'||render.asset?.checksum!==asset.checksum)fail(409,'Wait for the verified finished render before reviewing it.');}
 const jobs=await store.records('jobs',project.id),job=asset.generated?.jobId?jobs.find(j=>j.id===asset.generated.jobId):null;
 if(asset.generated?.jobId&&(!job||job.status!=='completed'))fail(409,'Wait for the exact generated media job to complete before reviewing it.');
 const proposal=job?await store.readProposal(project.id,job.proposal_id):null;
 const prior=history.filter(e=>auditKind(e)==='production_outcome'&&e.details?.asset?.id===asset.id&&e.details?.asset?.version===asset.version),superseded=new Set(prior.flatMap(e=>e.details.supersedesReviewIds||[])),supersedesReviewIds=prior.filter(e=>!superseded.has(e.id)).map(e=>e.id).sort();
 const source={id:asset.id,version:asset.version,checksum:asset.checksum,mime:asset.mime,durationSeconds:asset.durationSeconds??null,decodeVerified:asset.decodeVerified===true,generated:asset.generated??null};
 const event={id:body.requestId,projectId:project.id,actorId,type:'production_outcome',createdAt:new Date().toISOString(),details:{kind:'media_outcome_v1',fingerprint,supersedesReviewIds,decision:body.decision,defects:[...body.defects],reason:body.reason,asset:source,job:job?{id:job.id,modelId:job.model_id??proposal?.model_id??null,modelVersion:proposal?.model_snapshot?.model_version??asset.generated?.modelVersion??null,task:asset.generated?.task??(asset.generated?.kind==='storyboard_frame'?'storyboard_frame':proposal?.task??null),providerRequestId:job.provider_request_id??null}:null,sourceScope:'explicit_owned_media_review',modelQualificationGranted:false}};
 try{const saved=await store.add('audit',event);return {event:Array.isArray(saved)?saved[0]:saved,replayed:false,generationAuthorized:false};}
 catch(error){if(error.status!==409)throw error;const saved=(await store.records('audit',project.id)).find(e=>e.id===body.requestId);if(saved?.details?.fingerprint!==fingerprint)throw error;return {event:saved,replayed:true,generationAuthorized:false};}
}
export function summarizeProductionOutcomes({events=[],reservations=[],planningCalls=[],attempts=[],renderAccountingAvailable=true,currentMasterChecksum}={}){
 const groups=new Map();for(const e of events)if(auditKind(e)==='production_outcome'&&e.details?.kind==='media_outcome_v1'){const key=e.details.asset.id+':'+e.details.asset.version;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 const reviews=[],conflicts=[];for(const list of groups.values()){const superseded=new Set(list.flatMap(e=>e.details.supersedesReviewIds||[])),leaves=list.filter(e=>!superseded.has(e.id));if(leaves.length===1)reviews.push(leaves[0]);else conflicts.push(leaves.map(e=>e.id));}
 reviews.sort((a,b)=>String(a.createdAt??a.created_at).localeCompare(String(b.createdAt??b.created_at))||a.id.localeCompare(b.id));
 const accepted=reviews.filter(e=>e.details.decision==='accepted'),needs=reviews.filter(e=>e.details.decision==='needs_correction'),rejected=reviews.filter(e=>e.details.decision==='rejected');
 // Explicit accepted finished-output artifacts only; ordinary clips and downloads
 // are never counted as finished productions. One latest finished output/project.
 const finished=accepted.filter(e=>e.details.asset.mime==='video/mp4'&&e.details.asset.decodeVerified&&e.details.asset.generated?.kind==='finished_movie'&&e.details.asset.generated?.masterChecksum&&(!currentMasterChecksum||e.details.asset.generated.masterChecksum===currentMasterChecksum)&&Number.isFinite(e.details.asset.durationSeconds)&&e.details.asset.durationSeconds>0).at(-1);
 const verdicts=new Map(reviews.filter(e=>e.details.job?.id).map(e=>[e.details.job.id,e.details.decision])),groupsByWork=new Map();
 for(const a of attempts){if(!a.work_unit_id||!a.job_id||![1,2].includes(a.attempt_number))continue;if(!groupsByWork.has(a.work_unit_id))groupsByWork.set(a.work_unit_id,new Map());const group=groupsByWork.get(a.work_unit_id);if(group.has(a.attempt_number)&&group.get(a.attempt_number)!==a.job_id)fail(409,'Attempt evidence conflicts for one work unit.');group.set(a.attempt_number,a.job_id);}
 let firstReviewed=0,firstAccepted=0,twoResolved=0,twoAccepted=0;
 for(const group of groupsByWork.values()){const first=verdicts.get(group.get(1)),second=verdicts.get(group.get(2));if(first){firstReviewed++;if(first==='accepted')firstAccepted++;}if(first==='accepted'||second){twoResolved++;if(first==='accepted'||second==='accepted')twoAccepted++;}}
 const minutes=finished?finished.details.asset.durationSeconds/60:0;
 let known=0n,exposure=0n,unknown=0;const seen=new Set();
 for(const r of [...reservations,...planningCalls.map(c=>({id:'planning:'+c.id,chargeState:c.chargeState,actualMicroUsd:c.actualMicroUsd,reservedMicroUsd:c.quotedMicroUsd,status:c.status}))]){
  if(seen.has(r.id))continue;seen.add(r.id);const actual=micro(r.actualMicroUsd),reserved=micro(r.reservedMicroUsd);
  if(r.chargeState==='settled'&&actual!==null)known+=actual;
  else if(r.chargeState!=='released'&&r.status!=='released'){unknown++;if(reserved!==null||actual!==null)exposure+=(actual??0n)>(reserved??0n)?actual:reserved??0n;}
 }
 return {kind:'production_quality_summary_v1',quality:{conflictedReviewCount:conflicts.length,conflicts,reviewed:reviews.length,accepted:accepted.length,needsCorrection:needs.length,rejected:rejected.length,acceptanceRate:reviews.length?accepted.length/reviews.length:null,firstPassAcceptance:firstReviewed?firstAccepted/firstReviewed:null,acceptedWithinTwoAttempts:twoResolved?twoAccepted/twoResolved:null,attemptCoverage:{firstAttemptReviewed:firstReviewed,withinTwoResolved:twoResolved,workUnits:groupsByWork.size},attemptMetricHold:firstReviewed?'Rates cover explicitly reviewed attempts; unfinished/unreviewed groups remain outside the measured denominator.':'Complete attempt-group and used-take evidence is required; media review rate is not first-pass acceptance.'},economics:{currency:'USD',renderAccountingAvailable,knownActualMicroUsd:known.toString(),pendingExposureMicroUsd:exposure.toString(),unknownChargeCount:unknown,acceptedFinishedMinutes:minutes,costPerAcceptedFinishedMinuteMicroUsd:minutes>0&&unknown===0&&renderAccountingAvailable&&known<=BigInt(Number.MAX_SAFE_INTEGER)?Number(known)/minutes:null,scope:'Known provider generation/planning charges only; hosting, fees, taxes and customer billing are not certified.'},reviews:reviews.map(e=>({id:e.id,createdAt:e.createdAt??e.created_at,...e.details})),generationAuthorized:false};
}
export async function productionOutcomeSummary({project,actorId,store}){
 await store.get(project.id,actorId);const results=await Promise.all([store.records('audit',project.id),store.spendingSummary(actorId,project.id),store.planningSummary(actorId,project.id),store.records('attempts',project.id)]);
 return summarizeProductionOutcomes({events:results[0],renderAccountingAvailable:results[1].renderAccountingAvailable!==false,currentMasterChecksum:currentMusicVideo(project)?.snapshot.content.master.checksum,reservations:[...results[1].reservations,...(results[1].renderReservations||[])],planningCalls:results[2].calls,attempts:results[3]});
}
export function providerHealth({observations=[],policy,now=Date.now()}){
 if(!exact(policy,['windowMs','minimumSamples','maxErrorRate'])||!Number.isSafeInteger(policy.windowMs)||policy.windowMs<1000||policy.windowMs>86400000||!Number.isSafeInteger(policy.minimumSamples)||policy.minimumSamples<2||policy.minimumSamples>10000||!Number.isFinite(policy.maxErrorRate)||policy.maxErrorRate<=0||policy.maxErrorRate>=1||!Number.isFinite(now))fail(400,'Supply an explicit bounded provider-health policy.');
 const latest=new Map();for(const o of observations){const at=Date.parse(o.at);if(typeof o.requestId!=='string'||!Number.isFinite(at)||at>now||at<now-policy.windowMs||!['success','provider_error'].includes(o.kind))continue;const old=latest.get(o.requestId);if(!old||at>=Date.parse(old.at))latest.set(o.requestId,o);}const samples=[...latest.values()];
 const errors=samples.filter(o=>o.kind==='provider_error').length,rate=samples.length?errors/samples.length:null;
 return {state:samples.length<policy.minimumSamples?'insufficient_evidence':rate>policy.maxErrorRate?'hold':'available',sampleCount:samples.length,errorCount:errors,errorRate:rate,policy:structuredClone(policy),generationAuthorized:false,liveQueueGuarantee:false};
}
export function discountedOutcomeEvidence({outcomes=[],decay=1}){
 if(!Number.isFinite(decay)||decay<=0||decay>1||!Array.isArray(outcomes)||outcomes.length>10000)fail(400,'Use a bounded explicit outcome dataset and decay in (0,1].');
 const unique=new Map();for(const e of outcomes){if(!e||typeof e.id!=='string'||!Number.isSafeInteger(e.ordinal)||e.ordinal<1||!['accepted','needs_correction','rejected'].includes(e.decision))fail(400,'Only explicit ordered outcome verdicts can update the evidence.');if(unique.has(e.id)&&hash(unique.get(e.id))!==hash(e))fail(409,'An outcome identity has conflicting verdicts.');unique.set(e.id,e);}
 const rows=[...unique.values()].sort((a,b)=>a.ordinal-b.ordinal||a.id.localeCompare(b.id)),latest=rows.at(-1)?.ordinal??0;let successWeight=0,failureWeight=0;
 for(const e of rows){const weight=decay**(latest-e.ordinal);if(e.decision==='accepted')successWeight+=weight;else failureWeight+=weight;}
 return {version:'discounted-explicit-outcomes-v1',samples:rows.length,decay,successWeight,failureWeight,alpha:1+successWeight,beta:1+failureWeight,posteriorMean:(1+successWeight)/(2+successWeight+failureWeight),explorationAuthorized:false,modelPromotionAuthorized:false};
}
export function modelProviderHealth(model,events,now=Date.now()){
 if(!model.capabilities?.healthPolicy)return {state:'not_configured',scope:'owned_project',generationAuthorized:false};
 const observations=events.filter(e=>auditKind(e)==='provider_health_observation'&&e.details?.kind==='provider_health_v1'&&e.details.modelId===model.id&&e.details.endpoint===model.endpoint&&e.details.modelVersion===(model.model_version??model.version)).map(e=>({requestId:e.details.requestId,at:e.details.at,kind:e.details.observation==='provider_error'&&(!Number.isInteger(e.details.httpStatus)||e.details.httpStatus<500||e.details.httpStatus>599)?'unclassified':e.details.observation}));
 return {...providerHealth({observations,policy:model.capabilities.healthPolicy,now}),scope:'owned_project',modelVersion:model.model_version??model.version};
}
export async function observeProviderHealth({store,projectId,actorId,model,requestId,kind,httpStatus}){
 if(!['success','provider_error'].includes(kind)||kind==='provider_error'&&(!Number.isInteger(httpStatus)||httpStatus<500||httpStatus>599))return;
 // Auxiliary telemetry never changes a charge, triggers another call or makes a
 // successful provider result disappear if the audit store is unavailable.
 try{await store.add('audit',{projectId,actorId,type:'provider_health_observation',details:{kind:'provider_health_v1',modelId:model.id,modelVersion:model.model_version??model.version,endpoint:model.endpoint,requestId:String(requestId),observation:kind,...(kind==='provider_error'?{httpStatus}:{}),at:new Date().toISOString()}});}catch{/* Missing health evidence stays unknown. */}
}
export function outcomeModelEvidence(reviews,{decay=1}={}){
 const groups=new Map();for(const r of reviews){if(!r.job?.modelId||!r.job?.modelVersion||!r.job?.task)continue;const key=[r.job.modelId,r.job.modelVersion,r.job.task].join('|');if(!groups.has(key))groups.set(key,{modelId:r.job.modelId,modelVersion:r.job.modelVersion,task:r.job.task,outcomes:[]});const g=groups.get(key);g.outcomes.push({id:r.id,decision:r.decision,ordinal:g.outcomes.length+1});}
 return [...groups.values()].map(({outcomes,...identity})=>({...identity,...discountedOutcomeEvidence({outcomes,decay})}));
}
export function sampleOutcomeRecommendations({candidates=[],evidence=[],seed,minimumSamples=1}){
 if(!Array.isArray(candidates)||candidates.length>1000||!Array.isArray(evidence)||evidence.length>1000||!Number.isSafeInteger(seed)||seed<0||seed>4294967295||!Number.isSafeInteger(minimumSamples)||minimumSamples<1||minimumSamples>10000)fail(400,'Supply bounded qualified candidates, explicit evidence, seed and sample minimum.');
 let state=seed||0x9e3779b9;const uniform=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return ((state>>>0)+0.5)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
 function gamma(shape){const d=shape-1/3,c=1/Math.sqrt(9*d);for(let i=0;i<1000;i++){const z=normal(),v=1+c*z;if(v<=0)continue;const x=v*v*v,u=uniform();if(u<1-0.0331*z**4||Math.log(u)<0.5*z*z+d*(1-x+Math.log(x)))return d*x;}fail(503,'Offline sampling did not converge; no policy changed.');}
 const key=x=>x.modelId+'|'+x.modelVersion+'|'+(x.task??''),seen=new Set(),recommendations=[];
 for(const c of [...candidates].sort((a,b)=>key(a).localeCompare(key(b)))){
  if(!c.eligible)continue;if(typeof c.modelId!=='string'||typeof c.modelVersion!=='string'||seen.has(key(c)))fail(400,'Qualified candidate identities must be unique.');seen.add(key(c));
  const matches=evidence.filter(e=>key(e)===key(c));if(matches.length>1)fail(409,'An evaluated model/version/task has conflicting evidence sets.');const e=matches[0];if(!e||!Number.isSafeInteger(e.samples)||e.samples<minimumSamples)continue;
  if(![e.alpha,e.beta].every(x=>Number.isFinite(x)&&x>=1&&x<=10001)||e.alpha+e.beta>e.samples+2+1e-8)fail(400,'Invalid discounted posterior evidence.');
  const a=gamma(e.alpha),b=gamma(e.beta);recommendations.push({modelId:c.modelId,modelVersion:c.modelVersion,...(c.task?{task:c.task}:{}),samples:e.samples,posteriorMean:e.alpha/(e.alpha+e.beta),sample:a/(a+b)});
 }
 recommendations.sort((a,b)=>b.sample-a.sample||key(a).localeCompare(key(b)));
 return {kind:'offline_thompson_replay_v1',status:recommendations.length?'reviewable':'insufficient_evidence',seed,minimumSamples,recommendations,explorationAuthorized:false,generationAuthorized:false,modelPromotionAuthorized:false,scope:'Reproducible offline recommendation from explicit owned version/task-bound verdicts; no live routing weights changed.'};
}

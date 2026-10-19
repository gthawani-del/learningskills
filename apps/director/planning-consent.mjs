import {randomUUID} from 'node:crypto';
import {hash,fail} from './domain.mjs';
export {planningScope} from './planning-policy.mjs';
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const positive = x => Number.isSafeInteger(x) && x > 0;
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function time(now) {const n=now instanceof Date?now.getTime():typeof now==='number'?now:typeof now==='string'?Date.parse(now):NaN;if(!Number.isSafeInteger(n)||Math.abs(n)>8.64e15)fail(400,'A valid operation time is required.');return n;}
function context(state,c,operation,extra) {
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['actorId','projectId','requestId','expectedVersion',...extra].includes(k))||!uuid(c.requestId)||typeof c.actorId!=='string'||!positive(c.expectedVersion))fail(400,'Invalid scoped planning command.');
 const project=state.projects?.find(p=>p.id===c.projectId);if(!project||project.ownerId!==c.actorId)fail(404,'Project not found.');
 const fingerprint=hash({operation,...c});const previous=(state.planningCommands||[]).find(x=>x.requestId===c.requestId);
 if(previous&&(previous.fingerprint!==fingerprint||previous.actorId!==c.actorId))fail(409,'The request ID belongs to a different planning command.');
 if(!previous&&operation!=='settle_planning'&&project.version!==c.expectedVersion)fail(409,'The project changed. Refresh before continuing.');
 return {previous,fingerprint};
}
function remember(state,c,operation,fingerprint,result){(state.planningCommands||=[]).push({requestId:c.requestId,actorId:c.actorId,projectId:c.projectId,operation,fingerprint,result:structuredClone(result)});return structuredClone(result);}
function trusted(profile,scope,now){
 const n=time(now);if(!digest(profile?.fingerprint)||!positive(profile?.maxCallMicroUsd)||!['modelId','modelVersion','priceVersion'].every(k=>typeof profile[k]==='string'&&profile[k].trim()&&profile[k].length<=500)||!Number.isFinite(Date.parse(profile.expiresAt))||Date.parse(profile.expiresAt)<=n||!digest(scope?.briefScopeHash)||!digest(scope?.approvedDecisionDigest)||!Number.isSafeInteger(scope?.approvalOrdinal)||scope.approvalOrdinal<0)fail(409,'A fresh trusted planning profile and exact brief scope are required.');return n;
}
function consentFor(state,c){const grant=(state.planningConsents||[]).find(g=>g.id===c.consentId&&g.projectId===c.projectId&&g.actorId===c.actorId);if(!grant)fail(404,'Planning consent not found.');return grant;}
function reservationFor(state,c){const row=(state.planningReservations||[]).find(r=>r.id===c.reservationId&&r.projectId===c.projectId&&r.actorId===c.actorId);if(!row)fail(404,'Planning reservation not found.');return row;}
// All transitions require a caller-held lock plus one durable atomic commit.
// These records express generation cost consent, never a billing balance.
export function grantPlanningConsent(state,c,{profile,scope,now}){
 const op='grant_planning';const ctx=context(state,c,op,['maxMicroUsd','finishReserveMicroUsd','maxCalls','expiresAt']);if(ctx.previous)return structuredClone(ctx.previous.result);
 const n=trusted(profile,scope,now),finish=c.finishReserveMicroUsd;
 if((state.planningReservations||[]).some(r=>r.projectId===c.projectId&&(r.status==='unknown'||r.status==='held'&&r.submitClaimed)))fail(409,'Reconcile the earlier planning submission before granting another cost allowance.');
 if(!positive(c.maxMicroUsd)||!Number.isSafeInteger(finish)||finish<0||finish>=c.maxMicroUsd||!positive(c.maxCalls)||c.maxCalls>10||profile.maxCallMicroUsd>c.maxMicroUsd-finish)fail(400,'The planning cap must cover a call and protected finishing amount; allow 1–10 calls.');
 const expiry=c.expiresAt===undefined?Math.min(n+86400000,Date.parse(profile.expiresAt)):Date.parse(c.expiresAt);
 if(!Number.isFinite(expiry)||expiry<=n||expiry>Date.parse(profile.expiresAt)||expiry>n+86400000)fail(400,'Consent must expire within one day and the trusted profile lifetime.');
 const grant={id:randomUUID(),projectId:c.projectId,actorId:c.actorId,briefScopeHash:scope.briefScopeHash,approvedDecisionDigest:scope.approvedDecisionDigest,approvalOrdinal:scope.approvalOrdinal,profileFingerprint:profile.fingerprint,modelId:profile.modelId,modelVersion:profile.modelVersion,priceVersion:profile.priceVersion,maxCallMicroUsd:profile.maxCallMicroUsd,maxMicroUsd:c.maxMicroUsd,finishReserveMicroUsd:finish,maxCalls:c.maxCalls,status:'active',createdAt:new Date(n).toISOString(),expiresAt:new Date(expiry).toISOString(),generationAuthorized:false};
 (state.planningConsents||=[]).push(grant);return remember(state,c,op,ctx.fingerprint,grant);
}
export function reservePlanningCall(state,c,{profile,scope,now}){
 const op='reserve_planning';const ctx=context(state,c,op,['consentId','operation','requestHash','quotedMicroUsd']);if(ctx.previous)return structuredClone(ctx.previous.result);
 const n=trusted(profile,scope,now),grant=consentFor(state,c);
 if(grant.status!=='active'||Date.parse(grant.expiresAt)<=n||grant.briefScopeHash!==scope.briefScopeHash||grant.approvedDecisionDigest!==scope.approvedDecisionDigest||grant.approvalOrdinal!==scope.approvalOrdinal||grant.profileFingerprint!==profile.fingerprint||grant.modelId!==profile.modelId||grant.modelVersion!==profile.modelVersion||grant.priceVersion!==profile.priceVersion||grant.maxCallMicroUsd!==profile.maxCallMicroUsd)fail(409,'Planning scope or trusted model pricing changed. A new consent is required.');
 if(!['initial_plan','revise_plan','interpret_brief','write_script','revise_script'].includes(c.operation)||!digest(c.requestHash)||!positive(c.quotedMicroUsd)||c.quotedMicroUsd>profile.maxCallMicroUsd)fail(400,'A bounded creative planning operation and exact request are required.');
 const rows=(state.planningReservations||[]).filter(r=>r.consentId===grant.id);
 if((state.planningReservations||[]).some(r=>r.projectId===c.projectId&&(r.status==='unknown'||r.status==='held'&&r.submitClaimed)))fail(409,'An earlier planning submission needs reconciliation. Automatic replacement is blocked.');
 const counted=rows.filter(r=>r.status!=='released');const committed=counted.reduce((sum,r)=>sum+BigInt(r.status==='completed'?r.actualMicroUsd:Math.max(r.quotedMicroUsd,r.actualMicroUsd||0)),0n);
 if(counted.length>=grant.maxCalls||committed+BigInt(c.quotedMicroUsd)+BigInt(grant.finishReserveMicroUsd)>BigInt(grant.maxMicroUsd))fail(409,'The planning call count or generation cost cap has been reached.');
 const row={id:randomUUID(),projectId:c.projectId,actorId:c.actorId,consentId:grant.id,operation:c.operation,requestHash:c.requestHash,profileFingerprint:profile.fingerprint,quotedMicroUsd:c.quotedMicroUsd,status:'held',submitClaimed:false,createdAt:new Date(n).toISOString(),expiresAt:grant.expiresAt};
 (state.planningReservations||=[]).push(row);return remember(state,c,op,ctx.fingerprint,row);
}
export function claimPlanningCall(state,c,{profile,scope,now}){
 const op='claim_planning';const ctx=context(state,c,op,['reservationId']);if(ctx.previous)return {claimed:false,reservation:structuredClone(ctx.previous.result.reservation)};
 const row=reservationFor(state,c),n=trusted(profile,scope,now),grant=(state.planningConsents||[]).find(g=>g.id===row.consentId);
 if((state.planningReservations||[]).some(other=>other.id!==row.id&&other.projectId===c.projectId&&(other.status==='unknown'||other.status==='held'&&other.submitClaimed)))fail(409,'Reconcile the earlier planning submission before claiming another call.');
 if(row.status!=='held'||row.submitClaimed||grant?.status!=='active'||Date.parse(row.expiresAt)<=n||grant.briefScopeHash!==scope.briefScopeHash||grant.approvedDecisionDigest!==scope.approvedDecisionDigest||grant.approvalOrdinal!==scope.approvalOrdinal||grant.profileFingerprint!==profile.fingerprint||grant.modelId!==profile.modelId||grant.modelVersion!==profile.modelVersion||grant.priceVersion!==profile.priceVersion||grant.maxCallMicroUsd!==profile.maxCallMicroUsd)fail(409,'This planning call cannot be submitted again.');
 Object.assign(row,{submitClaimed:true,claimedAt:new Date(n).toISOString()});return remember(state,c,op,ctx.fingerprint,{claimed:true,reservation:row});
}
export function settlePlanningCall(state,c,now){
 const op='settle_planning';const ctx=context(state,c,op,['reservationId','outcome','actualMicroUsd','resultHash']);if(ctx.previous)return structuredClone(ctx.previous.result);
 const row=reservationFor(state,c),n=time(now);
 if(!['completed','unknown','released'].includes(c.outcome)||['completed','released'].includes(row.status))fail(409,'This planning settlement is unavailable or already final.');
 if(c.outcome==='released'){if(row.submitClaimed||row.status==='unknown')fail(409,'A submitted or unknown call must retain its cost hold.');if(c.actualMicroUsd!==undefined||c.resultHash!==undefined)fail(400,'A released call cannot report provider usage.');}
 else if(c.outcome==='completed'){if(!row.submitClaimed||(c.actualMicroUsd!==undefined&&(!Number.isSafeInteger(c.actualMicroUsd)||c.actualMicroUsd<0))||(c.resultHash!==undefined&&!digest(c.resultHash)))fail(400,'A claimed call and valid verified usage values are required.');}
 else if(!row.submitClaimed||c.actualMicroUsd!==undefined||c.resultHash!==undefined)fail(400,'Only a claimed call may have an unknown outcome.');
 const missingUsage=c.outcome==='completed'&&(c.actualMicroUsd===undefined||!digest(c.resultHash));
 const overrun=c.outcome==='completed'&&c.actualMicroUsd>row.quotedMicroUsd;
 Object.assign(row,{status:missingUsage||overrun?'unknown':c.outcome,updatedAt:new Date(n).toISOString(),...(c.outcome==='completed'?{...(c.actualMicroUsd===undefined?{}:{actualMicroUsd:c.actualMicroUsd}),...(c.resultHash===undefined?{}:{resultHash:c.resultHash}),overrun,usageUnverified:missingUsage}:{})});return remember(state,c,op,ctx.fingerprint,row);
}
export function revokePlanningConsent(state,c,now){
 const op='revoke_planning';const ctx=context(state,c,op,['consentId','reason']);if(ctx.previous)return structuredClone(ctx.previous.result);
 if(typeof c.reason!=='string'||c.reason.trim().length<5||c.reason.length>1000)fail(400,'A reason of 5–1,000 characters is required.');
 const grant=consentFor(state,c);if(grant.status!=='revoked')Object.assign(grant,{status:'revoked',revokedAt:new Date(time(now)).toISOString(),reason:c.reason.trim()});return remember(state,c,op,ctx.fingerprint,grant);
}

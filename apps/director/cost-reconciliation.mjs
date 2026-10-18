import {hash,fail} from './domain.mjs';

// Internal normalized DELTA events only. Raw fal billing rows are per-request totals,
// not proven delta events; the feed documents neither stable event IDs nor finality.
// A trusted ingestion adapter must deduplicate snapshots before calling this module.
// https://fal.ai/docs/api-reference/platform-apis/for-models/billing-events
const keys=new Set(['id','providerRequestId','amountNanoUsd','currency','evidenceUrl','observedAt','final','authoritativeTotalNanoUsd']);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value);
function nano(value,{signed=true}={}){
 if(typeof value!=='string'||!(signed?/^-?(0|[1-9]\d{0,29})$/:/^(0|[1-9]\d{0,29})$/).test(value)||value==='-0')fail(400,'Cost must be a canonical decimal integer nano-USD string.');
 return BigInt(value);
}
function time(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail(400,'A UTC evidence timestamp is required.');return Date.parse(value);}
function trusted(provenance){if(provenance?.trusted!==true||provenance.provider!=='fal'||provenance.kind!=='billing-events')fail(403,'Verified server-side fal billing provenance is required.');}
export function ceilNanoToMicroUsd(value){const n=nano(value);return (n>=0n?(n+999n)/1000n:n/1000n).toString();}

export function normalizeCostEvent(event,{provenance,now=new Date()}={}){
 trusted(provenance);
 if(!event||typeof event!=='object'||Array.isArray(event)||Object.keys(event).some(k=>!keys.has(k)))fail(400,'Unsupported normalized billing event.');
 if(!id(event.id)||!id(event.providerRequestId)||event.currency!=='USD')fail(400,'Bounded billing identities and USD currency are required.');
 nano(event.amountNanoUsd);
 let evidence;try{evidence=new URL(event.evidenceUrl);}catch{fail(400,'An HTTPS billing evidence URL is required.');}
 if(evidence.protocol!=='https:'||evidence.username||evidence.password||event.evidenceUrl.length>2000)fail(400,'An HTTPS billing evidence URL is required.');
 const observed=time(event.observedAt),clock=now instanceof Date?now.getTime():typeof now==='number'?now:NaN;
 if(!Number.isFinite(clock)||observed>clock)fail(400,'Billing observation cannot be in the future.');
 if(event.final!==undefined&&typeof event.final!=='boolean')fail(400,'Finality must be an explicit boolean.');
 const final=event.final===true;
 if(final){if(provenance.authoritativeFinalTotal!==true)fail(409,'A feed observation alone does not establish a final invoice total.');nano(event.authoritativeTotalNanoUsd,{signed:false});}
 else if(event.authoritativeTotalNanoUsd!==undefined)fail(400,'An authoritative total requires explicit final evidence.');
 return Object.freeze({...event,final,amountMicroUsd:ceilNanoToMicroUsd(event.amountNanoUsd)});
}

/** Pure transaction preparation. Persist returned state and jobUpdate atomically in a
 * trusted database transaction; this function itself performs no writes, releases,
 * reservations, provider calls or customer-visible cost announcements.
 */
export function reconcileCostEvent(state,event,options={}){
 const normalized=normalizeCostEvent(event,options);
 if(!state||!Array.isArray(state.jobs))fail(400,'A trusted job ledger snapshot is required.');
 const matches=state.jobs.filter(job=>job.provider_request_id===normalized.providerRequestId);
 if(matches.length!==1||!id(matches[0].id))fail(409,'Billing request must match exactly one recorded provider request.');
 const job=matches[0],events=state.costEvents??[];
 if(!Array.isArray(events))fail(400,'Invalid billing event ledger.');
 const previous=events.find(row=>row.event.id===normalized.id);
 if(previous){if(previous.jobId!==job.id||hash(previous.event)!==hash(normalized))fail(409,'Billing event identity conflicts with existing evidence.');return {state:structuredClone(state),result:{...structuredClone(previous.result),replayed:true},jobUpdate:null};}
 const requestEvents=events.filter(row=>row.jobId===job.id);
 let total=0n;for(const row of requestEvents){if(row.event.providerRequestId!==normalized.providerRequestId)fail(409,'Recorded billing request identity changed.');total+=nano(row.event.amountNanoUsd);}
 total+=nano(normalized.amountNanoUsd);
 if(total<0n)fail(409,'Credits exceed the recorded charges; reconcile missing evidence first.');
 if(total.toString().length>30)fail(400,'Billing total exceeds supported integer bounds.');
 if(normalized.final&&nano(normalized.authoritativeTotalNanoUsd,{signed:false})!==total)fail(409,'Authoritative final total does not match the exact event ledger.');
 const result={jobId:job.id,providerRequestId:normalized.providerRequestId,totalNanoUsd:total.toString(),totalMicroUsd:ceilNanoToMicroUsd(total.toString()),chargeState:normalized.final?'settled':'unknown',replayed:false};
 const next=structuredClone(state);(next.costEvents??=[]).push({jobId:job.id,event:structuredClone(normalized),result:structuredClone(result)});
 next.costReconciliations??=[];next.costReconciliations.push({...structuredClone(result),eventId:normalized.id,observedAt:normalized.observedAt});
 return {state:next,result,jobUpdate:{id:job.id,provider_request_id:normalized.providerRequestId,charge_state:result.chargeState,actual_micro_usd:normalized.final?result.totalMicroUsd:null}};
}

// Trusted coordinator only. Never expose these methods as customer HTTP routes
// or give database credentials/lease tokens to the isolated media decoder.
import {fail} from './domain.mjs';
import {randomUUID} from 'node:crypto';
import {SOURCE_INSPECTION_VERSION,INSPECTION_LIMITS} from './workers/source-inspection.mjs';

export function inspectionOutcome(report,source){
 if(report?.status==='held')return {status:'held',code:'source_inspection_failed'};
 const valid=report?.status==='passed'&&report.inspectionVersion===SOURCE_INSPECTION_VERSION&&report.assetPublished===false&&report.decodeVerified===true&&report.checksumAlgorithm==='sha256-bytes'&&report.sha256===source.sha256&&report.size===source.size&&report.mime===source.mime&&Number.isFinite(report.durationSeconds)&&report.durationSeconds>0&&report.durationSeconds<=INSPECTION_LIMITS.maxDurationSeconds&&Array.isArray(report.streams)&&report.streams.length>0&&report.streams.length<=INSPECTION_LIMITS.maxStreams;
 if(!valid)fail(422,'Inspection result does not match the saved source.');
 const streams=report.streams.map(s=>{
  if(s.type==='audio'){
   const codecs=source.mime==='audio/wav'?['pcm_s16le','pcm_s24le','pcm_s32le','pcm_f32le','pcm_f64le','pcm_u8','pcm_alaw','pcm_mulaw','adpcm_ima_wav']:source.mime==='audio/mpeg'?['mp3']:['aac','mp3','alac','ac3','opus','flac'];
   if(!codecs.includes(s.codec)||!Number.isInteger(s.sampleRate)||s.sampleRate<8000||s.sampleRate>192000||!Number.isInteger(s.channels)||s.channels<1||s.channels>8)fail(422,'Unsupported inspected audio stream.');
   return {type:s.type,codec:s.codec,sampleRate:s.sampleRate,channels:s.channels};
  }
  if(s.type!=='video'||source.mime!=='video/mp4'||!['h264','hevc','av1','vp9','mpeg4'].includes(s.codec)||!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<1||s.height<1||s.width>4096||s.height>4096||s.width*s.height>4096*2160||!Number.isFinite(s.framesPerSecond)||s.framesPerSecond<=0||s.framesPerSecond>120)fail(422,'Unsupported inspected video stream.');
  return {type:s.type,codec:s.codec,width:s.width,height:s.height,framesPerSecond:s.framesPerSecond};
 });
 const audio=streams.filter(s=>s.type==='audio').length,video=streams.filter(s=>s.type==='video').length;
 if(source.mime==='video/mp4'?video!==1:audio!==1||video!==0)fail(422,'Inspection stream layout does not match the source.');
 // Only measured fields cross the trusted persistence boundary; discard tags,
 // URLs, diagnostic stderr and any other worker-supplied data.
 return {status:'passed',inspectionVersion:SOURCE_INSPECTION_VERSION,size:report.size,sha256:report.sha256,checksumAlgorithm:'sha256-bytes',mime:report.mime,durationSeconds:report.durationSeconds,streams,decodeVerified:true,assetPublished:false};
}

export const cloudSourceInspectionMethods={
 async claimSourceInspection(uploadId,claimToken,leaseSeconds=600){return this.request('/rest/v1/rpc/director_claim_source_inspection',{method:'POST',body:{p_upload:uploadId,p_token:claimToken,p_lease_seconds:leaseSeconds}});},
 async finishSourceInspection(uploadId,claimToken,source,report){return this.request('/rest/v1/rpc/director_finish_source_inspection',{method:'POST',body:{p_upload:uploadId,p_token:claimToken,p_result:inspectionOutcome(report,source)}});}
};

export async function runSourceInspectionJob({store,uploadId,execute,enabled=false,publish=false}){
 if(!enabled)fail(503,'Source inspection dispatch awaits runtime qualification.');
 if(typeof execute!=='function')fail(503,'A qualified isolated inspection executor is required.');
 const token=randomUUID(),claim=await store.claimSourceInspection(uploadId,token,600);
 if(!claim)return {claimed:false,assetPublished:false};
 if(claim.uploadId!==uploadId||claim.source?.id!==uploadId||claim.source.ownerId!==claim.ownerId||claim.source.projectId!==claim.projectId||claim.source.bucket!=='director-source-media'||claim.source.storageKey!==`${claim.ownerId}/${claim.projectId}/${uploadId}`||claim.source.status!=='inspection_pending')fail(409,'Inspection claim does not match the requested source.');
 const source=structuredClone(claim.source.manifest);
 let report;
 try{
  // The trusted executor signs a short-lived private URL and owns sandbox cleanup.
  // It receives no database key or claim token, and cannot select another source.
  report=await execute({uploadId,ownerId:claim.ownerId,projectId:claim.projectId,bucket:claim.source.bucket,storageKey:claim.source.storageKey,source:structuredClone(source)});
 }catch{
  // Quarantine dispatch/cleanup uncertainty, rather than silently dispatching
  // another paid runtime after the lease expires. Never persist raw diagnostics.
  await store.finishSourceInspection(uploadId,token,source,{status:'held'}).catch(()=>{});
  fail(503,'Inspection execution was not confirmed. Check the existing worker before retrying.');
 }
 const accepted=await store.finishSourceInspection(uploadId,token,source,report);
 if(publish&&accepted.status==='passed'){const asset=await store.publishSourceUpload(claim.ownerId,claim.projectId,uploadId);return {claimed:true,uploadId,status:'passed',assetId:asset.id,assetPublished:true};}
 return {claimed:true,...accepted,assetPublished:false};
}

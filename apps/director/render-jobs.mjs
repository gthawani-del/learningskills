// Trusted coordinator/store contracts. No hosted SDK, credentials or automatic retry.
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fail,hash} from './domain.mjs';
import {prepareSongRender,renderSongTimeline} from './song-render.mjs';
import {timelineContext} from './music-video-editing.mjs';
const execute=promisify(execFile),copy=structuredClone,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now=()=>new Date().toISOString(),sha=b=>createHash('sha256').update(b).digest('hex');
const money=n=>Number.isSafeInteger(n)&&n>=0;
export const visibleRenderJob=job=>{
 const {claimToken,requestCommand,requestFingerprint,asset,...visible}=job;
 if(job.status==='completed'&&job.result?.decodeVerified===true){try{validateRenderAsset(job,job.result);visible.asset=job.result;}catch{/* Inconsistent persisted output never becomes a downloadable asset. */}}
 return copy(visible);
};
const sourcePin=a=>Object.fromEntries(['id','projectId','version','mime','role','checksum','checksumAlgorithm','size','bucket','storageKey','scope','shotId','durationSeconds','decodeVerified','streams','generated','width','height','sourceUploadId','inspectionVersion'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
const upstreamFields=['title','premise','language','direction','story','creativeBrief','screenplay','departmentPlanning','referenceProduction','storyboardHandoff','storyboardProduction'];
const shotFields=['id','version','sceneId','description','durationSeconds','productionBindings'];
function meaningfulProject(project,dependencyIds,shotIds,usesUpstream){
 const configuration=Object.fromEntries(['format','duration','ratio'].map(k=>[k,project[k]??null]));
 const records=project.production.records.filter(r=>dependencyIds.includes(r.id)).map(r=>({id:r.id,type:r.type,currentVersion:r.currentVersion,current:r.versions.find(v=>v.version===r.currentVersion)})).sort((a,b)=>a.id.localeCompare(b.id));
 const shots=(project.shots??[]).filter(r=>shotIds.includes(r.id)).map(r=>Object.fromEntries(shotFields.map(k=>[k,r[k]??null]))).sort((a,b)=>a.id.localeCompare(b.id));
 const upstream=usesUpstream?Object.fromEntries(upstreamFields.map(k=>[k,project[k]??null])):null;
 return {configuration,records,shots,upstream};
}
export function renderScope({project,assets,approvals,outcomes=[],timelineId,expectedVersion}){
 if(project.version!==expectedVersion)fail(409,'The render project version changed.');
 const record=project.production?.records?.find(r=>r.id===timelineId&&r.type==='edit'),snapshot=record?.versions?.find(v=>v.version===record.currentVersion),content=snapshot?.content;
 if(content?.kind!=='music_video_timeline_v1'||Object.keys(content).some(k=>!['kind','songPlan','selections','finishing','output'].includes(k)))fail(409,'Choose the saved music_video_timeline_v1 edit record.');
 const approval=approvals.filter(a=>a.projectId===project.id&&a.artifactId==='record:'+timelineId&&a.version===record.currentVersion).at(-1);
 if(approval?.decision!=='approved')fail(409,'The exact timeline record needs current approval.');
 const checked=timelineContext(project,assets,approvals,outcomes);if(!checked.ready||checked.recordId!==timelineId)fail(409,checked.holds.join(' ')||'The exact complete-song timeline needs current source approval.');
 const input={project,songPlan:content.songPlan,selections:content.selections,finishing:content.finishing??{},output:content.output??{},assets},manifest=prepareSongRender(input);
 const ids=new Set([manifest.master.assetId,...manifest.clips.map(c=>c.assetId)]),clipIds=new Set(manifest.clips.map(c=>c.assetId)),sources=assets.filter(a=>ids.has(a.id)).map(sourcePin).sort((a,b)=>a.id.localeCompare(b.id));
 const dependencySet=new Set([timelineId]);let changed=true;
 while(changed){changed=false;for(const r of project.production.records)if(dependencySet.has(r.id))for(const dep of r.versions.find(v=>v.version===r.currentVersion)?.dependencies??[])if(!dependencySet.has(dep.recordId)){dependencySet.add(dep.recordId);changed=true;}}
 const dependencyIds=[...dependencySet].sort(),shotIds=manifest.clips.map(c=>c.shotId).sort(),usesUpstream=sources.some(a=>a.mime.startsWith('image/')||a.generated?.kind==='music_video_motion'),approvalKeys=dependencyIds.map(id=>'record:'+id);
 if(usesUpstream){approvalKeys.push('brief','creative_brief','screenplay','storyboard_sequence');for(const id of shotIds)approvalKeys.push('shot_contract:'+id,'storyboard_brief:'+id,'storyboard_frame:'+id);for(const a of approvals)if(a.artifactId?.startsWith('department:'))approvalKeys.push(a.artifactId);for(const shot of project.storyboardProduction?.shots??[])if(shotIds.includes(shot.shotId))for(const ref of shot.versions.at(-1)?.document.referenceBindings??[])approvalKeys.push('reference_brief:'+ref.subjectId,'reference_selection:'+ref.subjectId);}
 const relevantApprovalKeys=[...new Set(approvalKeys)].sort();
 const approvalSnapshot=approvals.filter(a=>(a.projectId??a.project_id)===project.id&&relevantApprovalKeys.includes(a.artifactId)).map(a=>({id:a.id,artifactId:a.artifactId,version:a.version,decision:a.decision})).sort((a,b)=>a.id.localeCompare(b.id));
 const outcomeSnapshot=outcomes.filter(e=>(e.projectId??e.project_id)===project.id&&(e.type??e.event_type)==='production_outcome'&&clipIds.has(e.details?.asset?.id)).map(e=>({id:e.id,details:copy(e.details)})).sort((a,b)=>a.id.localeCompare(b.id));
 const binding={projectId:project.id,ownerId:project.ownerId,timelineId,timelineVersion:record.currentVersion,approvalId:approval.id,dependencyIds,shotIds,usesUpstream,relevantApprovalKeys,projectSnapshot:meaningfulProject(project,dependencyIds,shotIds,usesUpstream),approvalSnapshot,outcomeSnapshot,content:copy(content),sources,manifest};
 return {...binding,projectVersion:project.version,sourceDigest:hash(binding)};
}
const stateScope=(s,c)=>{const project=s.projects.find(p=>p.id===c.projectId&&p.ownerId===c.actorId);if(!project)fail(404,'Project not found.');return renderScope({project,assets:s.assets.filter(a=>(a.projectId??a.project_id)===project.id),approvals:s.approvals,outcomes:s.audit??[],timelineId:c.timelineId,expectedVersion:c.expectedVersion});};
function gate(s,job){const scope=stateScope(s,{actorId:job.ownerId,projectId:job.projectId,timelineId:job.scope.timelineId,expectedVersion:s.projects.find(p=>p.id===job.projectId)?.version});if(scope.sourceDigest!==job.sourceDigest)fail(409,'Render sources or approval changed.');return scope;}
function lease(job,token){if(!job||job.status!=='running'||job.claimToken!==token||Date.parse(job.leaseUntil)<=Date.now())fail(409,'The render lease is stale.');}
function seconds(n){if(!Number.isInteger(n)||n<30||n>900)fail(400,'Render lease must be 30–900 seconds.');}
function releaseUnclaimed(job,reason){
 if(job.status!=='reserved'||job.claimToken!=null||job.leaseUntil!=null||job.claimedAt||job.actualMicroUsd!==undefined&&job.actualMicroUsd!==0)fail(409,'A claimed render or uncertain execution cannot release its spending hold.');
 job.status='released';job.releaseReason=reason;job.releasedAt=now();return job;
}
export function renderExposure(jobs=[],projectId){
 return jobs.filter(j=>j.projectId===projectId).reduce((sum,j)=>{const amount=j.status==='released'?0:j.status==='completed'?j.actualMicroUsd:Math.max(j.quote?.maxMicroUsd,j.actualMicroUsd??0);if(!money(amount)||!Number.isSafeInteger(sum+amount))fail(409,'Render exposure requires reconciliation.');return sum+amount;},0);
}
export function assertRenderReservation(state,projectId,additionalMicroUsd){
 const budget=state.projectBudgets?.find(b=>b.projectId===projectId);
 const media=(state.jobs??[]).filter(j=>(j.projectId??j.project_id)===projectId).reduce((sum,j)=>{const amount=j.charge_state==='settled'?j.actual_micro_usd:['held','unknown'].includes(j.charge_state)?j.reserved_micro_usd:0;if(!money(amount)||!Number.isSafeInteger(sum+amount))fail(409,'Media exposure requires reconciliation.');return sum+amount;},0);
 const committed=media+renderExposure(state.renderJobs,projectId);
 if(!budget||!money(additionalMicroUsd)||!money(budget.budgetMicroUsd)||!money(budget.finishReserveMicroUsd)||!Number.isSafeInteger(committed+additionalMicroUsd+budget.finishReserveMicroUsd)||committed+additionalMicroUsd+budget.finishReserveMicroUsd>budget.budgetMicroUsd)fail(409,'Project spending cap would be exceeded by rendering and media exposure.');
 return {committedMicroUsd:committed,...budget};
}
export const localRenderMethods={
 async readRenderJobs(actorId,projectId){await this.get(projectId,actorId);return (this.state.renderJobs??[]).filter(j=>j.projectId===projectId&&j.ownerId===actorId).map(visibleRenderJob);},
 async persistRenderQuote(c){return this.spendingTransaction(s=>{const scope=stateScope(s,c);if(scope.sourceDigest!==c.quote.sourceDigest)fail(409,'Render sources changed before quoting.');(s.renderQuotes??=[]).push(copy(c.quote));return c.quote;});},
 async reserveRenderJob(c){return this.spendingTransaction(s=>{
  const scope=stateScope(s,c);if(!uuid.test(c.idempotencyKey||''))fail(400,'A render request UUID is required.');
  const fingerprint=hash(c),jobs=s.renderJobs??=[],old=jobs.find(j=>j.projectId===c.projectId&&j.idempotencyKey===c.idempotencyKey);
  if(old){if(old.requestFingerprint!==fingerprint)fail(409,'Render request identity conflicts.');return old;}
  const quote=(s.renderQuotes??[]).find(q=>q.id===c.quoteId&&q.ownerId===c.actorId&&q.projectId===c.projectId);
  if(!quote||quote.sourceDigest!==scope.sourceDigest||Date.parse(quote.expiresAt)<=Date.now())fail(409,'The render quote expired or sources changed.');
  if(c.acknowledgeRender!==true||!money(c.maxMicroUsd)||c.maxMicroUsd<quote.maxMicroUsd)fail(409,'Explicit quote-specific authorization and a sufficient render cap are required.');
  for(const existing of jobs)if(existing.projectId===c.projectId&&existing.status==='reserved'&&Date.parse(existing.quote.expiresAt)<=Date.now())releaseUnclaimed(existing,'quote_expired_before_claim');
  if(jobs.some(j=>j.projectId===c.projectId&&j.sourceDigest===scope.sourceDigest&&j.status!=='released'))fail(409,'Inspect the existing render before requesting another execution.');
  assertRenderReservation(s,c.projectId,quote.maxMicroUsd);
  const job={id:randomUUID(),ownerId:c.actorId,projectId:c.projectId,scope,sourceDigest:scope.sourceDigest,quote,authorization:{id:randomUUID(),quoteId:quote.id,maxMicroUsd:c.maxMicroUsd,actorId:c.actorId,acknowledgeRender:true},idempotencyKey:c.idempotencyKey,requestFingerprint:fingerprint,status:'reserved',createdAt:now(),claimToken:null,leaseUntil:null,result:null};jobs.push(job);return job;
 });},
 async readRenderJob(actorId,projectId,id){await this.get(projectId,actorId);const job=(this.state.renderJobs??[]).find(j=>j.id===id&&j.projectId===projectId&&j.ownerId===actorId);if(!job)fail(404,'Render not found.');return visibleRenderJob(job);},
 async claimRenderJob(id,token,leaseSeconds=900){seconds(leaseSeconds);if(!uuid.test(token||''))fail(400,'A private render claim UUID is required.');return this.spendingTransaction(s=>{const j=(s.renderJobs??[]).find(j=>j.id===id);if(!j||j.status!=='reserved')return null;if(Date.parse(j.quote.expiresAt)<=Date.now()){releaseUnclaimed(j,'quote_expired_before_claim');return null;}gate(s,j);j.status='running';j.claimedAt=now();j.claimToken=token;j.leaseUntil=new Date(Date.now()+leaseSeconds*1000).toISOString();return j;});},
 async heartbeatRenderJob(id,token,leaseSeconds=900){seconds(leaseSeconds);return this.spendingTransaction(s=>{const j=s.renderJobs?.find(j=>j.id===id);lease(j,token);gate(s,j);j.leaseUntil=new Date(Date.now()+leaseSeconds*1000).toISOString();return j;});},
 async recoverRenderJob(id){return this.spendingTransaction(s=>{const j=s.renderJobs?.find(j=>j.id===id);if(!j)fail(404,'Render not found.');if(j.status==='reserved'&&Date.parse(j.quote.expiresAt)<=Date.now())releaseUnclaimed(j,'quote_expired_before_claim');if(j.status==='running'&&Date.parse(j.leaseUntil)<=Date.now()){j.status='unknown';j.claimToken=null;j.leaseUntil=null;j.hold='Execution outcome is unknown. Reconcile the existing worker/object; never redispatch this render.';}return j;});},
 async cancelRenderJob(c){return this.spendingTransaction(s=>{
  const project=s.projects.find(p=>p.id===c.projectId&&p.ownerId===c.actorId);if(!project)fail(404,'Project not found.');
  if(!uuid.test(c.requestId??'')||Object.keys(c).some(k=>!['actorId','projectId','renderId','requestId','reason'].includes(k))||c.reason!==undefined&&(typeof c.reason!=='string'||!c.reason.trim()||c.reason.length>1000))fail(400,'Supply an exact owned render cancellation request UUID and bounded reason.');
  const fingerprint=hash(c),commands=s.renderCancellations??=[],prior=commands.find(r=>r.projectId===c.projectId&&r.requestId===c.requestId);
  if(prior){if(prior.fingerprint!==fingerprint)fail(409,'Render cancellation request identity conflicts.');return prior.result;}
  const job=s.renderJobs?.find(j=>j.id===c.renderId&&j.projectId===c.projectId&&j.ownerId===c.actorId);if(!job)fail(404,'Render not found.');
  if(job.status!=='released')releaseUnclaimed(job,'owner_cancelled_before_claim');
  const result=visibleRenderJob(job);commands.push({projectId:c.projectId,requestId:c.requestId,fingerprint,result});return result;
 });},
 async finishRenderJob(id,token,outcome){return this.spendingTransaction(s=>{const j=s.renderJobs?.find(j=>j.id===id);lease(j,token);if(outcome.status==='unknown'){if(outcome.actualMicroUsd!==undefined){if(!money(outcome.actualMicroUsd))fail(409,'Invalid render settlement.');j.actualMicroUsd=outcome.actualMicroUsd;j.overrun=outcome.actualMicroUsd>j.quote.maxMicroUsd;}j.status='unknown';j.hold='Execution or publication was not confirmed. Reconcile existing work without redispatch.';}else{gate(s,j);validateRenderAsset(j,outcome.asset);if(!money(outcome.actualMicroUsd))fail(409,'Render settlement must report truthful integer USD micro-units.');j.overrun=outcome.actualMicroUsd>j.quote.maxMicroUsd;j.status='completed';j.actualMicroUsd=outcome.actualMicroUsd;j.result=copy(outcome.asset);s.assets.push(copy(outcome.asset));}j.claimToken=null;j.leaseUntil=null;j.finishedAt=now();return j;});}
};
function validateRenderAsset(job,asset){
 const m=job.scope.manifest,duration=(m.range.endMs-m.range.startMs)/1000;
 if(!asset||asset.id!==job.id||asset.projectId!==job.projectId||asset.mime!=='video/mp4'||asset.bucket!=='director-source-media'||asset.storageKey!==`${job.ownerId}/${job.projectId}/${job.id}`||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>128*1024*1024||!/^[a-f0-9]{64}$/.test(asset.checksum||'')||asset.checksumAlgorithm!=='sha256-bytes'||asset.generated?.kind!=='finished_movie'||asset.generated.renderId!==job.id||asset.generated.masterChecksum!==m.master.checksum||asset.masterBytesUnchanged!==true||asset.technicalValidation!=='passed'||!Number.isFinite(asset.durationSeconds)||Math.abs(asset.durationSeconds-duration)>Math.max(0.1,1/m.fps)||asset.streams?.video?.frameCount!==m.totalFrames||asset.streams.video.width!==m.width||asset.streams.video.height!==m.height||asset.streams.video.codec!=='h264'||asset.streams.audio?.codec!=='aac')fail(422,'Finished render metadata does not match its exact source contract.');
 return asset;
}
async function scopeFor(store,c){const project=await store.get(c.projectId,c.actorId);return renderScope({project,assets:await store.records('assets',project.id),approvals:await store.records('approvals',project.id),outcomes:await store.records('audit',project.id),timelineId:c.timelineId,expectedVersion:c.expectedVersion});}
export async function quoteRenderJob({store,executor,...c}){
 if(!executor?.id||typeof executor.quote!=='function')fail(503,'A trusted render executor and bounded compute quote are required; hosted dispatch is unavailable.');
 const scope=await scopeFor(store,c),facts=await executor.quote({manifest:copy(scope.manifest),sourceDigest:scope.sourceDigest});
 if(!money(facts?.maxMicroUsd)||!Number.isFinite(Date.parse(facts.expiresAt))||Date.parse(facts.expiresAt)<=Date.now()||Date.parse(facts.expiresAt)>Date.now()+3600000)fail(503,'The trusted executor must quote an integer USD ceiling valid for at most one hour.');
 const quote={id:randomUUID(),ownerId:c.actorId,projectId:c.projectId,sourceDigest:scope.sourceDigest,scope,executorId:executor.id,currency:'USD',maxMicroUsd:facts.maxMicroUsd,expiresAt:facts.expiresAt,createdAt:now()};return store.persistRenderQuote({...c,quote});
}
export async function requestRenderJob({store,...c}){return visibleRenderJob(await store.reserveRenderJob(c));}
export function createLocalRenderExecutor({assetDir,id='local-ffmpeg',quote}){
 return {id,quote,async execute({scope,signal}){const project={id:scope.projectId,ownerId:scope.ownerId,format:'music_video',version:scope.projectVersion,duration:(scope.manifest.range.endMs-scope.manifest.range.startMs)/1000,ratio:scope.manifest.width===scope.manifest.height?'1:1':scope.manifest.width>scope.manifest.height?'16:9':'9:16'};return {...await renderSongTimeline({project,...scope.content,assets:scope.sources,assetDir,signal}),actualMicroUsd:0};}};
}
/** Verify actual worker MP4 bytes again at the coordinator boundary. */
export async function verifyRenderOutput(job,result){
 const m=job.scope.manifest;
 if(!Buffer.isBuffer(result?.bytes)||result.bytes.length<1||result.bytes.length>128*1024*1024||result.manifest?.masterBytesUnchanged!==true||result.manifest.technicalValidation!=='passed')fail(422,'A bounded verified worker MP4 and original-master proof are required.');
 const {masterBytesUnchanged,output,technicalValidation,creativeReview,...workerManifest}=result.manifest;if(hash(workerManifest)!==hash(m))fail(422,'Worker result source pins changed.');
 const root=await mkdtemp(join(tmpdir(),'director-render-verify-')),path=join(root,'output.mp4');
 try{await writeFile(path,result.bytes,{mode:0o600});const run=(bin,args)=>execute(bin,args,{timeout:120000,maxBuffer:1024*1024,windowsHide:true});const {stdout}=await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov','-count_frames','-show_format','-show_streams','-of','json',path]);const probe=JSON.parse(stdout),v=probe.streams?.find(s=>s.codec_type==='video'),a=probe.streams?.find(s=>s.codec_type==='audio'),duration=(m.range.endMs-m.range.startMs)/1000;
 if(probe.streams.length!==2||v?.codec_name!=='h264'||a?.codec_name!=='aac'||v.width!==m.width||v.height!==m.height||Number(v.nb_read_frames)!==m.totalFrames||v.avg_frame_rate!==`${m.fps}/1`||!/^1\/[1-9][0-9]*$/.test(v.time_base)||Number(v.time_base.split('/')[1])%m.fps||!Number.isFinite(Number(a.duration))||Math.abs(Number(a.duration)-duration)>0.05||!Number.isFinite(Number(probe.format.duration))||Math.abs(Number(probe.format.duration)-duration)>Math.max(0.1,1/m.fps))fail(422,'Actual finished MP4 streams, frames or duration failed validation.');
 await run('ffmpeg',['-v','error','-nostdin','-xerror','-protocol_whitelist','file,pipe','-format_whitelist','mov','-i',path,'-map','0:v:0','-map','0:a:0','-f','null','-']);return {durationSeconds:Number(probe.format.duration),streams:{video:{codec:v.codec_name,width:v.width,height:v.height,frameCount:Number(v.nb_read_frames),timeBase:v.time_base,fps:m.fps},audio:{codec:a.codec_name,sampleRate:Number(a.sample_rate),channels:a.channels,timeBase:a.time_base}}};
 }finally{await rm(root,{recursive:true,force:true});}
}
export async function runRenderJob({store,renderId,executor,publish,signal}){
 if(!executor?.id||typeof executor.execute!=='function')fail(503,'A qualified trusted render executor is required; hosted dispatch is unavailable.');if(typeof publish!=='function')fail(503,'Private director-source-media output publication is required before rendering.');
 const token=randomUUID(),job=await store.claimRenderJob(renderId,token,900);if(!job)return {claimed:false};let actualMicroUsd;
 try{
  if(job.quote.executorId!==executor.id)fail(409,'The render executor differs from its authorized quote.');
  const result=await executor.execute({renderId,scope:copy(job.scope),maxMicroUsd:job.quote.maxMicroUsd,signal});if(money(result?.actualMicroUsd))actualMicroUsd=result.actualMicroUsd;const verified=await verifyRenderOutput(job,result);
  if(!money(result.actualMicroUsd))fail(409,'Render executor must report truthful integer USD settlement.');
  await store.heartbeatRenderJob(renderId,token,900);
  const receipt={assetId:renderId,bucket:'director-source-media',storageKey:`${job.ownerId}/${job.projectId}/${renderId}`,size:result.bytes.length,sha256:sha(result.bytes),mime:'video/mp4'};
  const stored=await publish({...receipt,bytes:result.bytes});if(hash(stored)!==hash(receipt))fail(422,'Private render publication receipt does not match verified bytes.');
  const asset={id:renderId,projectId:job.projectId,name:'Finished music video',version:1,role:'finished_movie',scope:'project',mime:'video/mp4',bucket:receipt.bucket,storageKey:receipt.storageKey,size:receipt.size,checksum:receipt.sha256,checksumAlgorithm:'sha256-bytes',...verified,generated:{kind:'finished_movie',renderId,masterChecksum:job.scope.manifest.master.checksum},masterBytesUnchanged:true,decodeVerified:true,technicalValidation:'passed',creativeReview:'unverified'};
  return visibleRenderJob(await store.finishRenderJob(renderId,token,{status:'completed',asset,actualMicroUsd:result.actualMicroUsd}));
 }catch{await store.finishRenderJob(renderId,token,{status:'unknown',...(actualMicroUsd!==undefined?{actualMicroUsd}:{})}).catch(()=>{});fail(503,'Render execution or private publication was not confirmed. Reconcile the existing render before retrying.');}
}
// Prepared SQL is mandatory for cloud use; never fall back to process-local jobs.
const rpc=async(store,action,command)=>store.request('/rest/v1/rpc/director_render_command',{method:'POST',body:{p_action:action,p_command:command}});
export const cloudRenderMethods={
 async readRenderSpendingBudget(actorId,projectId){return this.request('/rest/v1/rpc/director_render_budget_snapshot',{method:'POST',body:{p_actor:actorId,p_project:projectId}});},
 async readRenderJobs(actorId,projectId){await this.get(projectId,actorId);return (await this.allRows(`/rest/v1/director_render_jobs?project_id=eq.${projectId}&owner_id=eq.${actorId}&select=document&order=id.asc`)).map(r=>visibleRenderJob(r.document));},
 async cancelRenderJob(c){return visibleRenderJob(await rpc(this,'cancel',c));},persistRenderQuote(c){return rpc(this,'quote',c);},reserveRenderJob(c){return rpc(this,'reserve',c);},async readRenderJob(actorId,projectId,id){return visibleRenderJob(await rpc(this,'read',{actorId,projectId,id}));},claimRenderJob(id,token,leaseSeconds=900){return rpc(this,'claim',{id,token,leaseSeconds});},heartbeatRenderJob(id,token,leaseSeconds=900){return rpc(this,'heartbeat',{id,token,leaseSeconds});},recoverRenderJob(id){return rpc(this,'recover',{id});},finishRenderJob(id,token,outcome){return rpc(this,'finish',{id,token,outcome});}
};

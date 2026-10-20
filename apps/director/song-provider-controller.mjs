import {fail,hash} from './domain.mjs';
import {createCostQuote} from './cost-quotes.mjs';
import {quoteRequirements} from './quote-input.mjs';
import {createJobController} from './jobs.mjs';
import {selectRoutes} from './model-router.mjs';
import {taskCandidates} from './routing-task-catalog.mjs';
import {SONG_INTELLIGENCE_KIND,songIntelligenceContext,songSourceBinding,saveSongIntelligence} from './public/song-intelligence-core.js';
import {SONG_AUDIO_ENDPOINTS,prepareSongProviderInput,songProposalFromProvider,reviewSongProviderProposal} from './song-provider-results.mjs';
import {SONG_PROVIDER_TASKS,ownedSongAudio,trustedSongDuration} from './song-pricing.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const exact=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Unsupported song-provider command fields.');};
const current=(project,body)=>{if(project.version!==body.expectedVersion)fail(409,'The project changed. Reopen this song before continuing.');};
const identity=id=>{if(!uuid.test(id||''))fail(400,'A valid request identity is required.');};
const intent=operation=>({purpose:operation==='interpret'?'musical_audio_analysis':operation==='transcribe'?'singing_transcription':'sung_lyric_alignment'});
const requirements=(operation,duration)=>({modality:'text',inputModes:operation==='transcribe'?['audio']:['audio','text'],...(duration?{durationSeconds:duration}:{})});
export function createSongProviderController({store,providers,storage,generationConfigured=false}){
 const jobs=createJobController({store,providers});
 async function info(project){const results=await Promise.allSettled([store.records('assets',project.id),store.records('approvals',project.id)]);for(const r of results)if(r.status==='rejected')throw r.reason;return {assets:results[0].value,approvals:results[1].value};}
 async function scope(actorId,project,jobId){identity(jobId);return store.songJobScope(actorId,project.id,jobId);}
 async function proposed(actorId,project,jobId){
  const {job,proposal,quote,model}=await scope(actorId,project,jobId);if(job.status!=='completed'||!job.provider_request_id)fail(409,'Wait for the original request to complete; do not generate a replacement.');
  const facts=await info(project),{song}=ownedSongAudio(project,facts.assets),binding=songSourceBinding(project),original=quote.songIntelligenceBinding;
  if(original.recordId!==binding.recordId||hash(original.master)!==hash(binding.master))fail(409,'This completed result belongs to a different original master. It is retained in request history.');
  const output=await store.readSongJobOutput(actorId,project.id,jobId);if(!output)fail(409,'The original provider result is pending. Check this existing request.');
  const value=songProposalFromProvider({operation:original.operation,document:song.document,sourceBinding:binding,input:proposal.payload,output,jobId:job.id,providerRequestId:job.provider_request_id,modelId:model.id,endpoint:model.endpoint});
  value.originalSourceVersion=original.version;value.reusedAgainstCurrentSongVersion=binding.version;return {proposal:value,fingerprint:hash(value),requiresListeningReview:true,canonicalTextChanged:false,generationAuthorized:false};
 }
 return {
  async summary(actorId,project){
   const facts=await info(project),song=songIntelligenceContext(project,facts.approvals),registry=await store.registry(),control=await store.generationControl(),holds=[];let duration;
   try{const source=ownedSongAudio(project,facts.assets);duration=trustedSongDuration(source.asset,source.song.document.master);}catch(error){holds.push(error.message);}
   if(!song.approved)holds.push('Review and approve the current source record before paid analysis.');if(!generationConfigured)holds.push('Server audio generation credentials are not configured.');if(control?.generationPaused!==false)holds.push('New generation is paused.');
   const routes=[];
   for(const operation of ['interpret','transcribe','align']){
    const task=SONG_PROVIDER_TASKS[operation],models=taskCandidates(task,registry).filter(m=>m.endpoint===SONG_AUDIO_ENDPOINTS[operation]),selected=selectRoutes({task,requirements:requirements(operation,duration),intent:intent(operation),models});
    for(const route of selected.candidates){const model=models.find(m=>m.id===route.modelId);routes.push({operation,modelId:model.id,endpoint:model.endpoint,eligible:route.eligibleForQuote&&!holds.length,holds:[...route.holds,...holds],price:model.price_evidence??null});}
   }
   const projectJobs=await store.records('jobs',project.id),analysisJobs=[];for(const j of projectJobs){try{const s=await scope(actorId,project,j.id);analysisJobs.push({id:j.id,status:j.status,chargeState:j.charge_state,operation:s.quote.songIntelligenceBinding.operation,sourceVersion:s.quote.songIntelligenceBinding.version,providerRequestId:j.provider_request_id||null});}catch(error){if(error.status!==409)throw error;}}
   return {routes,holds,jobs:analysisJobs,estimatePolicy:'Quotes reserve conservative whole published billing blocks; actual provider charges require reconciliation. A quote is not an invoice.',generationAuthorized:false};
  },
  async quote(actorId,project,body){
   exact(body,['expectedVersion','requestId','operation','modelId','shareOriginalAudio']);identity(body.requestId);if(!['interpret','transcribe','align'].includes(body.operation)||typeof body.modelId!=='string')fail(400,'Choose a song-analysis operation and registry model.');
   const requestFingerprint=hash({scope:'song_provider_quote_v1',...body});const previous=await store.replayCostQuote({actorId,projectId:project.id,requestId:body.requestId,requestFingerprint});if(previous)return {quote:previous,saved:true};current(project,body);
   if(body.shareOriginalAudio!==true)fail(400,'Explicitly permit sharing this private original with the selected audio provider.');
   const facts=await info(project),{song,asset}=ownedSongAudio(project,facts.assets),context=songIntelligenceContext(project,facts.approvals);if(!context.approved)fail(409,'Approve the current exact song source record before paid analysis.');
   if(body.operation==='transcribe'&&song.document.lyrics.vocalMode==='instrumental')fail(409,'This song is marked instrumental. No transcription request is needed.');
   const duration=trustedSongDuration(asset,song.document.master),task=SONG_PROVIDER_TASKS[body.operation],models=taskCandidates(task,await store.registry()).filter(m=>m.endpoint===SONG_AUDIO_ENDPOINTS[body.operation]),model=models.find(m=>m.id===body.modelId),reqs=requirements(body.operation,duration);
   if(!model||!selectRoutes({task,requirements:reqs,intent:intent(body.operation),models:[model]}).eligibleForQuote.includes(model.id))fail(409,'No qualified route covers this musical-audio task, exact duration and singing requirements.');
   const audioUrl=await storage.sign(asset.storageKey,{bucket:asset.bucket,expiresIn:3600}),input=prepareSongProviderInput({operation:body.operation,document:song.document,audioUrl}),actual=quoteRequirements({task,requirements:reqs,model,input,trustedAudioDurationSeconds:duration});
   const quote=createCostQuote({project,assets:facts.assets,artifactId:'record:'+song.recordId,artifactVersion:song.version,task,requirements:actual,intent:intent(body.operation),model,input,now:new Date()});
   const saved=await store.persistCostQuote({actorId,projectId:project.id,requestId:body.requestId,expectedVersion:project.version,requestFingerprint,quote,input});return {quote:saved,saved:true,estimatePolicy:'Conservative upper bound in whole published audio billing blocks. Actual charges remain separately reconciled.'};
  },
  async start(actorId,project,body){exact(body,['expectedVersion','requestId','quoteId','authorizationId']);identity(body.requestId);identity(body.authorizationId);if(!/^[a-f0-9]{64}$/.test(body.quoteId||''))fail(400,'Choose a saved audio quote.');if(!generationConfigured)fail(503,'Server audio generation is not configured.');const job=await store.reserveSongJob({actorId,projectId:project.id,expectedVersion:body.expectedVersion,quoteId:body.quoteId,authorizationId:body.authorizationId,idempotencyKey:body.requestId});return {job:await jobs.dispatch({actorId,projectId:project.id,jobId:job.id})};},
  async poll(actorId,project,body){exact(body,['jobId']);await scope(actorId,project,body.jobId);return {job:await jobs.poll({actorId,projectId:project.id,jobId:body.jobId})};},
  async proposal(actorId,project,body){exact(body,['jobId']);return proposed(actorId,project,body.jobId);},
  async apply(actorId,project,body){
   exact(body,['expectedVersion','jobId','proposalFingerprint','acknowledgeListening','replaceCanonical','useTranscriptTiming']);current(project,body);if(body.acknowledgeListening!==true)fail(400,'Listen to the original and review this proposal before applying it.');
   const result=await proposed(actorId,project,body.jobId);if(result.fingerprint!==body.proposalFingerprint)fail(409,'The song or proposal changed since preview; review the current proposal without generating again.');
   const facts=await info(project),song=songIntelligenceContext(project,[]),document=reviewSongProviderProposal({document:song.document,sourceBinding:songSourceBinding(project),proposal:result.proposal,acknowledgeListening:true,replaceCanonical:body.replaceCanonical===true,useTranscriptTiming:body.useTranscriptTiming===true});
   const next=saveSongIntelligence(project,{expectedVersion:project.version,document,acknowledgeEvidence:true},facts.assets),saved=next.version===project.version?project:await store.save(next,project.version);
   await store.addAudit(project.id,actorId,'song_provider_proposal_applied',{jobId:body.jobId,proposalFingerprint:result.fingerprint,sourceVersion:result.proposal.originalSourceVersion,reviewedAgainstVersion:result.proposal.sourceBinding.version,savedSongVersion:songIntelligenceContext(saved,[]).version,recordKind:SONG_INTELLIGENCE_KIND,approvalGranted:false,spendingReconciled:false});return {project:saved,songIntelligence:songIntelligenceContext(saved,facts.approvals)};
  },
  async review(actorId,project,body){exact(body,['expectedVersion','jobId','reason']);current(project,body);identity(body.jobId);return {review:await store.reviewSongJob({actorId,projectId:project.id,...body})};}
 };
}

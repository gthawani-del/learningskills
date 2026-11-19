import {timelineContext} from './music-video-editing.mjs';
import {summarizeProductionOutcomes} from './production-outcomes.mjs';
import {hash,fail,artifacts} from './domain.mjs';
import {recordArtifacts} from './production-records.mjs';
import {directorAssetSources} from './director-context.mjs';
import {directorSession} from './public/director-session-core.js';
import {productionState} from './production-state.mjs';
import {briefPlanningContext} from './public/creative-brief-core.js';
import {songIntelligenceContext,songDirectorContext} from './public/song-intelligence-core.js';
import {currentScreenplay,screenplayContext} from './public/screenplay-core.js';
import {validateMusicTreatment} from './public/music-treatment-timing.js';
import {departmentPlanningContext} from './public/department-plan-core.js';
import {referenceProductionContext} from './public/reference-production-core.js';
import {storyboardHandoffContext} from './public/storyboard-handoff-core.js';
import {storyboardProductionContext} from './public/storyboard-production-core.js';
import {musicVideoContext} from './public/music-video-core.js';
import {animaticContext} from './public/animatic-core.js';

const clone=structuredClone;
const unique=rows=>[...new Set(rows)];
const operations=Object.freeze(['review_song','review_treatment','write_script','plan_departments','review_department_package','plan_storyboard','review_references','review_storyboard','review_animatic','review_production','review_edit','review_delivery']);
const time=value=>value instanceof Date?value.getTime():typeof value==='number'?value:Date.parse(value);
function quotedCosts(project,quotes,now){
 const current=[...artifacts(project),...recordArtifacts(project)],seen=new Set(),items=[];
 for(const q of quotes){
  if(!q||typeof q!=='object')continue;
  const {id,...content}=q;
  if(seen.has(id))continue;
  // Stored quotes are trusted server output; their hash and current artifact pin
  // protect the read model from presenting a changed payload as quoted evidence.
  const artifact=current.find(a=>a.logical_key===q.artifactId&&a.version===q.artifactVersion);
  const valid=typeof id==='string'&&id===hash(content)&&q.projectId===project.id&&q.projectVersion===project.version&&q.currency==='USD'&&q.estimateOnly===true&&q.generationAuthorized===false&&Number.isSafeInteger(q.totalMicroUsd)&&q.totalMicroUsd>0&&artifact?.content_hash===q.artifactContentHash&&time(q.createdAt)<=now&&time(q.expiresAt)>now&&q.priceEvidence?.verified===true&&time(q.priceEvidence.expiresAt)>now&&q.schemaEvidence?.verified===true&&time(q.schemaEvidence.expiresAt)>now;
  if(valid)seen.add(id);
  items.push({quoteId:id??null,artifactId:q.artifactId??null,artifactVersion:q.artifactVersion??null,task:q.task??null,modelId:q.modelId??null,status:valid?'current_quote':'unavailable_quote',totalMicroUsd:valid?q.totalMicroUsd:null,expiresAt:q.expiresAt??null,reason:valid?'Exact current operation estimate; not spending authority.':'Expired, changed, foreign or unverified quote; request a current quote.'});
 }
 const known=items.filter(i=>i.status==='current_quote').reduce((sum,i)=>sum+i.totalMicroUsd,0);
 return {currency:'USD',items,knownQuotedMicroUsd:Number.isSafeInteger(known)?known:null,wholePlanTotalMicroUsd:null,estimateOnly:true,unknown:['Unquoted reference and storyboard options or retries.','Motion/performance proofs and remaining full-song takes, including any repair.','Finishing, hosted rendering and delivery costs without current bound quotes.'],scope:'Sum of distinct current operation quotes, including alternatives; not a budget to finish or a claim that all quoted options are needed.'};
}

/** Read-only composition over the existing planning/approval engines. No state or
 * media is created and no new approvals, cast, musical labels or shot cuts inferred.
 * now must come from the server clock; quotes must be owned stored quote records.
 */
export function buildProductionPackage({project,approvals=[],assets=[],referenceCandidates=[],storyboardCandidates=[],quotes=[],outcomes=[],renderJobs=[],renderAccountingAvailable=true,now,mode}={}){
 const clock=time(now);if(!Number.isFinite(clock))fail(400,'Supply the server time for current quote review.');
 if(!project||project.format!=='music_video'||!Array.isArray(approvals)||!Array.isArray(assets))fail(400,'Production recommendations require an owned music-video project.');
 if(assets.some(a=>a.projectId&&a.projectId!==project.id)||referenceCandidates.some(c=>c.projectId!==project.id)||storyboardCandidates.some(c=>c.projectId!==project.id))fail(400,'Production evidence belongs to another project.');
 // Reuse the Director source projection without its text-model request byte cap:
 // a complete production archive must remain reviewable after it grows past a prompt.
 const {directorSession:conversation,...sources}=project,decisions=approvals.map((a,index)=>({artifactId:a.artifactId??null,version:a.version??null,decision:a.decision??null,ordinal:a.ordinal??index+1,id:a.id??null}));
 const director={sourceDigest:hash({sources,decisions,references:directorAssetSources(assets),outcomes,renderJobs}),decisions},participation=mode??directorSession(project).mode;
 if(!['plan_for_me','create_with_me'].includes(participation))fail(400,'Unsupported Director participation style.');
 const song=songIntelligenceContext(project,approvals),brief=briefPlanningContext(project,approvals),script=screenplayContext(project,approvals),document=currentScreenplay(project)?.document??null;
 const music=musicVideoContext(project,assets),departments=departmentPlanningContext(project,approvals),references=referenceProductionContext(project,approvals,{assets,candidates:referenceCandidates}),handoff=storyboardHandoffContext(project,approvals),frames=storyboardProductionContext(project,approvals,{assets,referenceCandidates,candidates:storyboardCandidates}),animatic=animaticContext(project,frames,assets),state=productionState(project,assets,approvals,referenceCandidates,storyboardCandidates);
 const treatmentHolds=[];let timing=null;
 if(!song.approved)treatmentHolds.push(...song.holds,'Approve current original-song evidence before treatment recommendation.');
 if(!document)treatmentHolds.push('Prepare a complete timed visual treatment from the approved song and brief.');
 if(document&&song.approved){try{timing=validateMusicTreatment(document,songDirectorContext(project,approvals),{complete:true});}catch(error){treatmentHolds.push(error.message);}}
 if(!script.approved)treatmentHolds.push('Review and approve the current treatment and its source decisions.');
 const sequences=timing?timing.sequences.map(s=>({...clone(s),heading:document.scenes.find(c=>c.id===s.sceneId).heading,action:document.scenes.find(c=>c.id===s.sceneId).action})):[];
 const selectedIntervalComplete=!!timing,originalMasterComplete=selectedIntervalComplete&&timing.range.startMs===0&&timing.range.endMs===timing.source.master.durationMs;
 const holds=unique([...(!brief.approved?['Review the current creative brief.']:[]),...treatmentHolds,...music.projectHolds,...(!originalMasterComplete?['Full original-master coverage is not established; preserve the selected range and explicitly review any scope change.']:[])]);
 const cost=quotedCosts(project,quotes,clock);
 const sourceDigest=hash({director:director.sourceDigest,projectVersion:project.version,referenceCandidates,storyboardCandidates,quotes,costStatus:cost.items.map(i=>({quoteId:i.quoteId,status:i.status}))});
 const stage=(id,ready,stageHolds,review)=>({id,ready,holds:unique(stageHolds),review});
 const edit=timelineContext(project,assets,approvals,outcomes),quality=summarizeProductionOutcomes({events:outcomes}),motionReady=edit.readyForApproval&&edit.manifest.clips.every(c=>c.mime.startsWith('video/'));
 const delivered=renderJobs.filter(j=>j.status==='completed'&&j.asset&&j.scope?.timelineId===edit.recordId&&j.scope?.timelineVersion===edit.version&&hash(j.scope.content)===hash(edit.document)&&assets.some(a=>a.id===j.asset.id&&a.checksum===j.asset.checksum)&&quality.reviews.some(r=>r.decision==='accepted'&&r.asset.id===j.asset.id&&r.asset.checksum===j.asset.checksum)).at(-1);
 const stages=[
  stage('song',song.approved&&music.projectHolds.length===0,[...song.holds,...music.projectHolds],'Original master and reviewed song evidence; unknown analysis remains explicit.'),
  stage('treatment',treatmentHolds.length===0,treatmentHolds,'Full selected interval, emotional progression, roles and exact master timing.'),
  stage('departments',departments.departments.every(d=>d.approved),departments.departments.flatMap(d=>d.current?d.approved?[]:[...d.holds,'Review '+d.title+'.']:['Prepare '+d.title+'.']),'One consolidated package review through existing per-artifact approval machinery.'),
  stage('references',references.subjects.length>0&&references.subjects.every(s=>s.selectionApproved),[...(!references.subjects.length?['Prepare applicable reference subjects and review their actual images.']:[]),...references.holds,...references.subjects.flatMap(s=>s.selectionApproved?[]:[...s.holds,'Review actual reference image for '+s.id+'.'])],'Inspect actual selected identity, look and location images; preserve exact approved bindings.'),
  stage('shot_plan',handoff.planningApproved,handoff.holds,'Current shot contracts and complete ordered sequence.'),
  stage('storyboard',frames.shots.length>0&&frames.shots.every(s=>s.selectionApproved),[...(!frames.shots.length?['Prepare and review current full-song storyboard frame directions and actual images.']:[]),...frames.holds,...frames.shots.flatMap(s=>s.selectionApproved?[]:s.holds)],'Review actual full-song keyframes against current reference and shot bindings.'),
  stage('animatic',animatic.saved&&animatic.canPlay,[...animatic.holds,...(!animatic.saved?['Save and review the original-song storyboard animatic.']:[])],'Existing playable storyboard preview; this does not establish motion or singing acceptance.'),
  stage('motion',motionReady,motionReady?[]:['Current accepted motion is not established for every shot; review exact selected takes and any intended still-image passages.'],'Use selected original-audio intervals; inspect proof before scaling; preserve accepted neighbors and two-attempt controls.'),
  stage('edit',edit.ready,edit.holds,'Reuse suitable approved footage before requesting new takes; deterministic canonical text finishing.'),
  stage('delivery',!!delivered&&edit.ready,delivered&&edit.ready?[]:[...(!renderAccountingAvailable?['Render records require the reviewed database update.']:[]),'A current verified stored full-song render and explicit complete-film acceptance are still required.'],'Inspect the complete picture and original audio before final human acceptance.')
 ];
 const actions=[];
 function action(operation,destination,label,actionHolds=[]){const base={operation,destination,label,holds:unique(actionHolds),requiresExistingAuthorization:true,generationAuthorized:false};actions.push({...base,id:hash({sourceDigest,...base}),executable:base.holds.length===0});}
 if(!song.approved)action('review_song','brief','Review original-song evidence');
 if(!document)action('write_script','story','Prepare the complete timed treatment',[...(!song.approved?['Approve song evidence.']:[]),...(!brief.approved?['Approve creative brief.']:[])]);
 else if(treatmentHolds.length)action('review_treatment','story','Review the current timed treatment');
 if(departments.departments.some(d=>!d.current))action('plan_departments','story','Prepare all applicable department plans',treatmentHolds);
 else if(departments.departments.some(d=>!d.approved))action('review_department_package','story','Review the complete department package');
 if(!handoff.sequence.current)action('plan_storyboard','storyboard','Prepare the complete source-bound shot plan',[...treatmentHolds,...(!stages.find(s=>s.id==='departments').ready?['Review the department package.']:[])]);
 action('review_references','cast','Reuse and review actual identity, look and location references');
 action('review_storyboard','storyboard','Review the full-song shot plan and actual keyframes');
 action('review_animatic','edit','Review the original-song storyboard preview');
 action('review_production','production','Review scoped motion proofs, remaining takes and operation quotes');
 action('review_edit','edit','Review the complete full-song assembly');
 action('review_delivery','export','Review full-song render readiness and delivery');
 return {kind:'director_production_package_v1',projectId:project.id,projectVersion:project.version,sourceDigest,status:holds.length?'held':'recommended',mode:participation,generationAuthorized:false,mediaAcceptance:'not_established',holds,
  presentation:{primaryAction:participation==='plan_for_me'?'Review recommended production':'Discuss and refine this production',detailsExpandable:true},
  recommendation:{concept:document?.logline??null,visualDirection:document?.treatment??null,cast:clone(document?.characters??[]),sequences,shots:clone(music.document?.shots??[]),performanceStrategy:sequences.map(s=>({sceneId:s.sceneId,startMs:s.startMs,endMs:s.endMs,roles:s.roles,syncClass:s.syncClass,performance:s.performance})),assetStrategy:{policy:'Reuse exact approved selections before generating; identity/look changes and missing images require actual review.',references:references.subjects.map(s=>({subjectId:s.id,kind:s.kind,sourceId:s.sourceId,shotUsage:clone(s.shotUsage),selection:clone(s.selection),approved:s.selectionApproved,reusableUploadCount:s.reusableUploadCount,holds:clone(s.holds)}))}},
  coverage:{selectedIntervalComplete,originalMasterComplete,range:clone(timing?.range??music.document?.range??null),master:clone(song.document?.master??null),unknown:clone(song.unknown??[])},
  departments:departments.departments.map(d=>({id:d.id,title:d.title,status:d.status,approved:d.approved,applicability:d.current?.document.applicability??'unknown',version:d.current?.version??null,document:clone(d.current?.document??null),holds:clone(d.holds)})),
  stages,costs:cost,actions,productionState:state,protectedDecisions:{approvals:clone(director.decisions),originalMaster:clone(song.document?.master??null),canonicalLyrics:clone(song.document?.lyrics??null),creativeBrief:clone(project.creativeBrief??null),treatmentVersion:script.currentVersion,selectedReferences:references.subjects.filter(s=>s.selection).map(s=>({subjectId:s.id,selection:clone(s.selection),currentlyApproved:s.selectionApproved}))},
  reviewPoints:['Review proposed creative scope and material uncertainties.','Inspect actual selected look/keyframes.','Inspect representative difficult performance before scaling.','Inspect the complete assembled film and original audio.'],limitations:['This recommendation does not create media, approve unseen images, establish rights or authorize spending.','Quote and ceiling, allowed operation, sharing, attempt and currentness checks remain enforced by existing handlers.','Motion, final edit and delivery acceptance require their actual media records; this package cannot infer acceptance from planning approvals.']};
}

/** Integration supplies ONE existing operation handler and its existing authority
 * check. That handler must retain transactional ownership/currentness/consent,
 * idempotency, quote/ceiling, sharing and attempt limits; no tool-loop is run here.
 */
export async function dispatchProductionPackageAction({package:recommendation,request,current,handler,assertAuthorized}={}){
 if(!request||typeof handler!=='function'||typeof assertAuthorized!=='function')fail(400,'Supply one existing handler and its explicit authorization check.');
 const fresh=buildProductionPackage(current);
 if(recommendation?.projectId!==fresh.projectId||recommendation?.sourceDigest!==fresh.sourceDigest||request.sourceDigest!==fresh.sourceDigest||request.expectedVersion!==fresh.projectVersion)fail(409,'Production sources or approvals changed. Review the current package.');
 const action=fresh.actions.find(a=>a.id===request.actionId);
 if(!action||!operations.includes(action.operation)||!action.executable)fail(409,'Choose one current available production-package action.');
 if(await assertAuthorized({project:current.project,action:clone(action),request:clone(request),sourceDigest:fresh.sourceDigest})!==true)fail(403,'Explicit existing authorization is required for this exact operation.');
 if(buildProductionPackage(current).sourceDigest!==fresh.sourceDigest)fail(409,'Production sources changed during authorization.');
 return handler(clone(action),{projectId:fresh.projectId,expectedVersion:fresh.projectVersion,sourceDigest:fresh.sourceDigest,request:clone(request)});
}

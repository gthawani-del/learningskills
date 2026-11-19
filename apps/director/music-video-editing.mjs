import {hash,fail} from './domain.mjs';
import {applyProductionRecord,recordDependencies} from './public/production-records-core.js';
import {currentMusicVideo,normalizeMusicVideoDocument,musicVideoContext} from './public/music-video-core.js';
import {songDirectorContext,currentSongIntelligence} from './public/song-intelligence-core.js';
import {summarizeProductionOutcomes} from './production-outcomes.mjs';
import {prepareSongRender} from './song-render.mjs';
import {currentStoryboardFrameSelection,currentStoryboardProductionSpec} from './public/storyboard-production-core.js';
import {storyboardHandoffContext,currentStoryboardShot} from './public/storyboard-handoff-core.js';
import {currentReferenceBrief,currentReferenceSelection,referenceSourceSignature} from './public/reference-production-core.js';
import {performanceSourcePins,currentPerformanceSpec} from './performance-input.mjs';
export const MUSIC_VIDEO_TIMELINE_KIND='music_video_timeline_v1';
const clone=structuredClone,snapshot=r=>r?.versions?.find(v=>v.version===r.currentVersion);
const approved=(approvals,key,version)=>approvals.filter(a=>a.artifactId===key&&a.version===version).at(-1)?.decision==='approved';
function currentTimeline(project){const rows=(project.production?.records??[]).filter(r=>r.type==='edit'&&snapshot(r)?.content.kind===MUSIC_VIDEO_TIMELINE_KIND);if(rows.length>1)fail(409,'Resolve duplicate music-video timelines explicitly.');return rows[0]?{record:rows[0],snapshot:snapshot(rows[0])}:null;}
function songSources(project,assets,approvals){
 const saved=currentMusicVideo(project);if(!saved)fail(409,'Save and approve the current complete original-song plan.');const plan=normalizeMusicVideoDocument(saved.snapshot.content);
 if(plan.range.startMs!==0||plan.range.endMs!==plan.master.durationMs)fail(409,'The complete-song timeline must cover the full original master.');
 if(!approved(approvals,'record:'+saved.record.id,saved.record.currentVersion))fail(409,'Approve the current complete song plan before editing.');
 const context=musicVideoContext(project,assets);if(context.holds.length)fail(409,context.holds.join(' '));
 const graph=recordDependencies(project);if(graph.records.find(r=>r.recordId===saved.record.id)?.holds.length)fail(409,'Current song-plan dependencies require review.');
 const song=songDirectorContext(project,approvals),intelligence=currentSongIntelligence(project),master=assets.find(a=>a.id===plan.master.assetId);
 if(graph.records.find(r=>r.recordId===intelligence.record.id)?.holds.length)fail(409,'Current song intelligence dependencies require review.');
 if(!master?.decodeVerified||!Number.isFinite(master.durationSeconds)||Math.abs(master.durationSeconds-plan.master.durationMs/1000)>0.25)fail(409,'The exact original master needs inspected audio duration.');
 return {saved,plan,song,intelligence};
}
function approvedStill(project,shotId,asset,assets,approvals){
 const selection=currentStoryboardFrameSelection(project,shotId),spec=currentStoryboardProductionSpec(project,shotId),contract=currentStoryboardShot(project,shotId),handoff=storyboardHandoffContext(project,approvals),g=asset.generated;
 if(!handoff.planningApproved||!selection||!spec||!contract||selection.assetId!==asset.id||selection.assetVersion!==asset.version||selection.specVersion!==spec.version||selection.review?.criteriaAcknowledged!==true||spec.contractVersion!==contract.version||spec.sourceVersion!==contract.sourceVersion||!approved(approvals,'storyboard_brief:'+shotId,spec.version)||!approved(approvals,'storyboard_frame:'+shotId,selection.version)||g?.kind!=='storyboard_frame'||g.shotId!==shotId||g.specVersion!==spec.version||asset.role!=='storyboard_frame'||asset.scope!=='shot'||asset.shotId!==shotId||asset.bucket!=='director-reference-media'||!g.jobId||!g.requestId||!g.payloadHash||!asset.checksum||![asset.width,asset.height].every(n=>Number.isSafeInteger(n)&&n>0))fail(409,'Choose the actual current approved storyboard still with its exact stored provenance.');
 for(const binding of spec.document.referenceBindings){
  const brief=currentReferenceBrief(project,binding.subjectId),selected=currentReferenceSelection(project,binding.subjectId),ref=assets.find(a=>a.id===binding.assetId&&a.version===binding.assetVersion&&a.projectId===project.id);
  if(!brief||brief.version!==binding.subjectVersion||!selected||selected.version!==binding.selectionVersion||selected.assetId!==binding.assetId||selected.assetVersion!==binding.assetVersion||project.referenceProduction?.sources?.find(s=>s.version===brief.sourceVersion)?.inputSignature!==referenceSourceSignature(project)||!approved(approvals,'reference_brief:'+binding.subjectId,brief.version)||!approved(approvals,'reference_selection:'+binding.subjectId,selected.version)||!ref?.checksum)fail(409,'A selected storyboard reference changed or needs approval.');
 }
}
function acceptedVideo(project,asset,events){
 if(asset.decodeVerified!==true||!Number.isFinite(asset.durationSeconds)||asset.durationSeconds<=0)fail(409,'Each selected video needs inspected actual source duration.');
 const relevant=events.filter(e=>(e.projectId??e.project_id)===project.id&&e.details?.asset?.id===asset.id&&e.details.asset.version===asset.version),summary=summarizeProductionOutcomes({events:relevant});
 const review=summary.reviews[0],expected={id:asset.id,version:asset.version,checksum:asset.checksum,mime:asset.mime,durationSeconds:asset.durationSeconds,decodeVerified:true,generated:asset.generated??null};
 if(summary.quality.conflictedReviewCount||summary.reviews.length!==1||review.decision!=='accepted'||hash(review.asset)!==hash(expected))fail(409,'The exact selected video needs an unconflicted accepted media outcome.');
}
export function reviewedMotionTake(project,asset,shotId,approvals){
 const binding=asset.generated?.performanceBinding,spec=currentPerformanceSpec(project,shotId);
 if(!spec||spec.record.id!==binding?.recordId||spec.record.currentVersion!==binding.version||!approved(approvals,'record:'+spec.record.id,spec.record.currentVersion))fail(409,'Review and approve the current motion direction before using this take.');
 const take=(project.production?.records||[]).find(r=>{const v=snapshot(r),c=v?.content;return r.type==='take'&&c?.kind==='music_video_motion_selection_v1'&&c.shotId===shotId&&c.jobId===asset.generated.jobId&&c.review?.motion===true&&c.review.originalMaster===true&&(binding.sourcePins.assignment.role!=='singing'||c.review.singing===true)&&v.references?.some(a=>a.assetId===asset.id&&a.version===asset.version)&&v.dependencies?.some(d=>d.recordId===spec.record.id&&d.version===spec.record.currentVersion);});
 if(!take||project.shots.find(s=>s.id===shotId)?.clipAssetId!==asset.id)fail(409,'Use the exact selected take after explicit motion and applicable singing review.');
 return take;
}
function validateTimeline(project,document,assets,approvals,outcomes){
 const source=songSources(project,assets,approvals);
 if(hash(document.songPlan)!==hash(source.plan)||document.finishing?.canonicalLyrics!==source.song.lyrics.canonicalText)fail(409,'The song plan or canonical lyrics changed; explicitly review the saved timeline.');
 const manifest=prepareSongRender({project,songPlan:document.songPlan,selections:document.selections,finishing:document.finishing,output:document.output,assets});
 for(const clip of manifest.clips){
  const asset=assets.find(a=>a.id===clip.assetId),selection=document.selections.find(s=>s.shotId===clip.shotId);
  if(asset.mime.startsWith('image/')){if(clip.syncClass==='sync_required')fail(409,'Visible singing cannot use a still.');approvedStill(project,clip.shotId,asset,assets,approvals);}
  else{
   acceptedVideo(project,asset,outcomes);if(asset.durationSeconds+0.001<clip.sourceInMs/1000+clip.frameCount/manifest.fps)fail(409,'The inspected source duration is too short for its exact trim.');
   if(asset.generated?.kind==='music_video_motion'){
    reviewedMotionTake(project,asset,clip.shotId,approvals);
    const binding=asset.generated.performanceBinding,pins=performanceSourcePins({project,assets,shotId:clip.shotId});
    const frame=assets.find(a=>a.id===pins.frame.assetId&&a.version===pins.frame.assetVersion);if(!frame)fail(409,'The selected motion frame is unavailable.');approvedStill(project,clip.shotId,frame,assets,approvals);
    if(hash(binding?.sourcePins)!==hash(pins))fail(409,'The accepted motion source belongs to earlier song, treatment, frame or reference versions.');
    if(clip.syncClass==='sync_required'){
     const expected={masterAssetId:pins.master.assetId,masterAssetVersion:pins.master.assetVersion,checksum:pins.master.checksum,masterStartMs:pins.assignment.startMs,sourceStartMs:0,reviewed:true};
     if(hash(selection.syncBinding)!==hash(expected))fail(409,'Use the exact accepted original-master performance timing binding.');
    }
   }else if(clip.syncClass==='sync_required')fail(409,'Visible singing requires an accepted source-bound original-master performance, not an unverified timing declaration.');
  }
 }
 return {manifest,source};
}

/** Pure save through ordinary production records. Does not approve or render. */
export function saveMusicVideoTimeline(project,body,assets,approvals,outcomes=[]){
 if(!body||Object.keys(body).some(k=>!['expectedVersion','selections','finishing','output','acknowledgeTimeline'].includes(k))||body.expectedVersion!==project.version||body.acknowledgeTimeline!==true)fail(409,'Review the current project and acknowledge saving the complete-song timeline.');
 const source=songSources(project,assets,approvals),finishing=clone(body.finishing??{});
 if(!finishing||typeof finishing!=='object'||Array.isArray(finishing))fail(400,'Supply supported finishing fields as an object.');
 if(Object.hasOwn(finishing,'canonicalLyrics')&&finishing.canonicalLyrics!==source.song.lyrics.canonicalText)fail(409,'Canonical lyrics must match the exact approved original-song evidence.');finishing.canonicalLyrics=source.song.lyrics.canonicalText;
 const draft={kind:MUSIC_VIDEO_TIMELINE_KIND,songPlan:clone(source.plan),selections:clone(body.selections),finishing,output:clone(body.output??{})},checked=validateTimeline(project,draft,assets,approvals,outcomes),document={...draft,finishing:checked.manifest.finishing},current=currentTimeline(project);
 const dependencies=new Map([[source.saved.record.id,source.saved.record.currentVersion],[source.intelligence.record.id,source.intelligence.record.currentVersion]]);
 for(const shot of source.plan.shots)for(const performer of shot.performers)dependencies.set(performer.recordId,performer.version);
 const used=new Set(checked.manifest.clips.map(c=>c.assetId));
 for(const r of project.production.records){const snap=snapshot(r);if(r.type==='take'&&snap.references?.some(ref=>used.has(ref.assetId)))dependencies.set(r.id,r.currentVersion);}
 const references=new Map([[source.plan.master.assetId,source.plan.master.assetVersion],...checked.manifest.clips.map(c=>[c.assetId,c.assetVersion])]);
 const next=applyProductionRecord(project,{expectedVersion:project.version,...(current?{id:current.record.id}:{}),type:'edit',name:'Music video — complete original-song timeline',content:document,references:[...references].map(([assetId,version])=>({assetId,version})),dependencies:[...dependencies].map(([recordId,version])=>({recordId,version}))},assets);
 if(hash(currentTimeline(next).snapshot.content)!==hash(document))fail(409,'The ordinary edit-record serializer must preserve canonical timeline text exactly.');return next;
}

/** Source invalidation and current ordinary approval are checked every time. */
export function timelineContext(project,assets=[],approvals=[],outcomes=[]){
 const result={recordId:null,version:null,document:null,holds:[],readyForApproval:false,approved:false,ready:false,generationAuthorized:false};
 try{
  const current=currentTimeline(project);if(!current){result.holds.push('Save the complete-song timeline from approved source media.');return result;}
  result.recordId=current.record.id;result.version=current.record.currentVersion;result.document=clone(current.snapshot.content);
  const checked=validateTimeline(project,result.document,assets,approvals,outcomes),deps=recordDependencies(project).records.find(r=>r.recordId===current.record.id);if(deps?.holds.length)fail(409,deps.holds.join(' '));
  for(const id of [checked.source.saved.record.id,checked.source.intelligence.record.id]){const record=project.production.records.find(r=>r.id===id);if(!current.snapshot.dependencies?.some(d=>d.recordId===id&&d.version===record.currentVersion))fail(409,'The exact current song-plan and canonical-intelligence dependency pins are required.');}
  result.manifest=checked.manifest;result.readyForApproval=true;result.approved=approved(approvals,'record:'+current.record.id,current.record.currentVersion);result.ready=result.approved;
 }catch(error){result.holds.push(error.message);}
 return result;
}

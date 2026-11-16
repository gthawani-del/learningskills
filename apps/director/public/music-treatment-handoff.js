import {currentScreenplay,screenplayContext} from './screenplay-core.js';
import {songDirectorContext} from './song-intelligence-core.js';
import {validateMusicTreatment} from './music-treatment-timing.js';
import {storyboardHandoffContext} from './storyboard-handoff-core.js';
import {currentMusicVideo,normalizeMusicVideoDocument,saveMusicVideo} from './music-video-core.js';
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
// Reuse the existing song-plan record, without new approval or media authority.
export function musicTreatmentShotPlan(project,approvals=[]){
 if(project.format!=='music_video')fail('Treatment timing is available only for music-video projects.');
 const screenplay=screenplayContext(project,approvals),document=currentScreenplay(project)?.document,song=songDirectorContext(project,approvals);
 if(!screenplay.approved||!document)fail('Approve the current music treatment before using its shot timing.');
 validateMusicTreatment(document,song,{complete:true});
 const handoff=storyboardHandoffContext(project,approvals),timing=handoff.sequence.coverage.musicTiming;
 if(!handoff.planningApproved||!timing?.ready)fail('Approve a current storyboard sequence covering every treatment interval exactly.');
 const plan=currentMusicVideo(project)?.snapshot.content;if(!plan)fail('Save the original-song plan first.');
 const shots=timing.shots.map(binding=>{
  const shot=project.shots.find(s=>s.id===binding.shotId),contract=project.storyboardHandoff.shots.find(s=>s.id===binding.shotId),old=plan.shots.find(s=>s.shotId===binding.shotId);
  if(binding.roles.length!==1&&!old)fail('This treatment mixes roles within a sequence. Assign its shot roles explicitly in the existing song coverage editor; no role is guessed.');
  const role=old&&binding.roles.includes(old.role)?old.role:binding.roles[0];
  const pin={shotId:shot.id,shotVersion:shot.version,contractVersion:contract.currentVersion,startMs:binding.startMs,endMs:binding.endMs,role,syncClass:role==='singing'?binding.syncClass:'no_sync',performers:old?structuredClone(old.performers):[],timingBasis:'provisional'};
  if(old){if(['shotVersion','contractVersion','startMs','endMs','role','syncClass'].some(k=>old[k]!==pin[k]))fail('Existing shot assignments differ from the treatment. Review them in the song coverage editor; saved timing and performer choices were not replaced.');return structuredClone(old);}
  return pin;
 });
 if(plan.shots.some(pin=>!shots.some(s=>s.shotId===pin.shotId)))fail('Earlier shot assignments are retained. Resolve them explicitly before using treatment timing.');
 const sections=song.sections.filter(s=>s.startMs<song.range.endMs&&s.endMs>song.range.startMs).map(s=>({id:s.id,label:s.label,startMs:Math.max(s.startMs,song.range.startMs),endMs:Math.min(s.endMs,song.range.endMs),timingBasis:s.basis==='user_reviewed'?'user_reviewed':'provisional'}));
 return normalizeMusicVideoDocument({...plan,master:structuredClone(song.master),range:structuredClone(song.range),sections,shots});
}
export function saveMusicTreatmentShotPlan(project,body,assets,approvals=[]){
 if(!body||Object.keys(body).some(k=>!['expectedVersion','acknowledgePlanning'].includes(k))||body.expectedVersion!==project.version||body.acknowledgePlanning!==true)fail('Review the current project and acknowledge this planning-only handoff.');
 return saveMusicVideo(project,{...body,document:musicTreatmentShotPlan(project,approvals)},assets);
}

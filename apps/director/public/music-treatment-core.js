import {currentScreenplay} from './screenplay-core.js';
import {songDirectorContext} from './song-intelligence-core.js';
import {validateMusicTreatment} from './music-treatment-timing.js';
const clone=x=>structuredClone(x);
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
export const overlappingSections=(song,startMs,endMs)=>song.sections.filter(s=>s.startMs<endMs&&s.endMs>startMs).map(s=>s.id);
export function musicTreatmentDraft(project,approvals=[]){
 const song=songDirectorContext(project,approvals),current=currentScreenplay(project),duration=(song.range.endMs-song.range.startMs)/1000;
 const sections=song.sections.filter(s=>s.startMs<song.range.endMs&&s.endMs>song.range.startMs);
 const document=current?clone(current.document):{title:project.title||'Music treatment',logline:project.premise||'',treatment:'',characters:[],scenes:sections.map((s,i)=>({id:'music_sequence_'+(i+1),heading:s.label,action:'',dialogue:[],durationSeconds:(Math.min(s.endMs,song.range.endMs)-Math.max(s.startMs,song.range.startMs))/1000}))};
 if(document.musicTiming)return document;
 if(Math.abs(document.scenes.reduce((n,s)=>n+s.durationSeconds,0)-duration)>0.000001)fail('Existing scene durations do not cover the requested song. Edit their durations or request an explicit music-treatment revision; the existing script has not been replaced.');
 let start=song.range.startMs;
 const sequences=document.scenes.map(scene=>{const end=start+Math.round(scene.durationSeconds*1000),row={sceneId:scene.id,startMs:start,endMs:end,sectionIds:overlappingSections(song,start,end),roles:[],emotion:'',performance:'',transition:'',syncClass:'no_sync'};start=end;return row;});
 document.musicTiming={source:{recordId:song.recordId,version:song.version,master:clone(song.master)},range:clone(song.range),sequences};validateMusicTreatment(document,song);return document;
}
export function editMusicSequence(project,approvals,sceneId,patch){
 const song=songDirectorContext(project,approvals),document=clone(currentScreenplay(project)?.document);
 if(!document?.musicTiming)fail('Create or adopt a timed treatment before editing a sequence.');
 validateMusicTreatment(document,song);const index=document.scenes.findIndex(s=>s.id===sceneId);if(index<0)fail('This treatment sequence is unavailable.');
 const allowed=['action','emotion','performance','transition','roles','syncClass','cutAfterMs'];if(!patch||Object.keys(patch).some(k=>!allowed.includes(k)))fail('Unsupported sequence correction.');
 const row=document.musicTiming.sequences[index];for(const key of ['emotion','performance','transition','roles','syncClass'])if(Object.hasOwn(patch,key))row[key]=clone(patch[key]);
 if(Object.hasOwn(patch,'action'))document.scenes[index].action=patch.action;
 if(Object.hasOwn(patch,'cutAfterMs')){
  const next=document.musicTiming.sequences[index+1];if(!next||!Number.isSafeInteger(patch.cutAfterMs)||patch.cutAfterMs<=row.startMs||patch.cutAfterMs>=next.endMs)fail('A cut must stay inside its two neighbouring sequences; the original song endpoints remain fixed.');
  row.endMs=patch.cutAfterMs;next.startMs=patch.cutAfterMs;
  for(const i of [index,index+1]){const sequence=document.musicTiming.sequences[i];document.scenes[i].durationSeconds=(sequence.endMs-sequence.startMs)/1000;sequence.sectionIds=overlappingSections(song,sequence.startMs,sequence.endMs);}
 }
 validateMusicTreatment(document,song);return document;
}

import {applyProductionRecord} from './production-records-core.js';
const kind='storyboard_animatic_draft';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function currentAnimatic(project){const record=(project.production?.records||[]).filter(r=>r.type==='edit'&&r.versions.find(v=>v.version===r.currentVersion)?.content?.kind===kind).at(-1);return record?{record,snapshot:record.versions.find(v=>v.version===record.currentVersion)}:null;}
export function frameAt(frames,frame){if(!Number.isSafeInteger(frame)||frame<0)throw Error('Invalid playhead frame.');let start=0;for(let i=0;i<frames.length;i++){const end=start+frames[i].frameCount;if(frame<end)return {index:i,start,end};start=end;}return {index:Math.max(0,frames.length-1),start:Math.max(0,start-(frames.at(-1)?.frameCount||0)),end:start};}
export function animaticContext(project,frameContext){
 const sequence=project.storyboardHandoff?.sequences?.at(-1),byId=new Map((frameContext.shots||[]).map(s=>[s.shotId,s])),holds=[];
 if(!sequence?.shots?.length)holds.push('Prepare and approve a complete ordered shot plan.');
 const frames=(sequence?.shots||[]).map((binding,index)=>{
  const s=byId.get(binding.shotId),selection=s?.selection;
  if(!s?.selectionApproved||!selection)holds.push('Select and approve the current storyboard frame for '+binding.shotId+'.');
  return {shotId:binding.shotId,label:project.shots?.find(shot=>shot.id===binding.shotId)?.title||'Shot '+(index+1),specVersion:selection?.specVersion??null,frameSelectionVersion:selection?.version??null,assetId:selection?.assetId??null,assetVersion:selection?.assetVersion??null,frameCount:Math.max(1,Math.round((s?.contract?.document?.durationSeconds||1)*24)),aspectRatio:s?.output?.aspectRatio||s?.current?.document?.aspectRatio||null};
 });
 if((frameContext.holds||[]).length)holds.push(...frameContext.holds);
 if(new Set(frames.map(f=>f.aspectRatio)).size>1)holds.push('Use one reviewed frame aspect across this animatic; no automatic crop is applied.');
 const saved=currentAnimatic(project),content=saved?.snapshot.content;
 if(content){
  if(![24,25,30].includes(content.fps)||content.sequenceVersion!==sequence?.version||!Array.isArray(content.frames)||content.frames.length!==frames.length||content.audio!==null||!['estimated','manually_timed'].includes(content.timingBasis))holds.push('The saved draft needs current sequence, timing and silent-preview review.');
  else for(let i=0;i<frames.length;i++){
   const pin=content.frames[i],now=frames[i];if(['shotId','specVersion','frameSelectionVersion','assetId','assetVersion','aspectRatio'].some(k=>pin?.[k]!==now[k])||!Number.isSafeInteger(pin?.frameCount)||pin.frameCount<1||pin.frameCount>content.fps*900)holds.push('The saved draft has changed or unavailable frame inputs; explicitly refresh its timing draft.');
  }
 }
 const active=Array.isArray(content?.frames)?content.frames:frames,fps=content?.fps||24,totalFrames=active.reduce((n,f)=>n+(Number.isSafeInteger(f?.frameCount)?f.frameCount:0),0);
 if(totalFrames<1||totalFrames>fps*3600)holds.push('Animatic timing must fit within one hour.');
 return {projectId:project.id,projectVersion:project.version,recordId:saved?.record.id||null,version:saved?.record.currentVersion||null,sequenceVersion:sequence?.version||null,fps,frames:active,totalFrames,durationSeconds:totalFrames/fps,timingBasis:content?.timingBasis||'estimated',holds:[...new Set(holds)],canPlay:holds.length===0,saved:!!saved,silent:true,productionAuthorized:false,sourceFrames:frames};
}
export function saveAnimatic(project,body,frameContext,assets){
 if(!body||Object.keys(body).some(k=>!['expectedVersion','fps','frameCounts','refresh','acknowledgeTiming'].includes(k)))fail(400,'Unsupported animatic draft command.');
 if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen before saving timing.');
 if(body.acknowledgeTiming!==true)fail(400,'Confirm this is a silent draft timing plan, not audio, motion or final-film approval.');
 const existing=currentAnimatic(project),fresh=animaticContext({...project,production:{...project.production,records:(project.production?.records||[]).filter(r=>r.id!==existing?.record.id)}},frameContext);
 if(!fresh.canPlay)fail(409,fresh.holds.join(' '));
 if(existing&&!animaticContext(project,frameContext).canPlay&&body.refresh!==true)fail(409,'Explicitly refresh changed frame inputs; older timing versions remain saved.');
 const fps=body.fps??24;if(![24,25,30].includes(fps))fail(400,'Choose 24, 25 or 30 frames per second.');
 const counts=body.frameCounts;if(!Array.isArray(counts)||counts.length!==fresh.frames.length||counts.some(n=>!Number.isSafeInteger(n)||n<1||n>fps*900)||counts.reduce((a,b)=>a+b,0)>fps*3600)fail(400,'Provide one bounded integer frame count for every shot.');
 const frames=fresh.frames.map((f,i)=>({...f,frameCount:counts[i]})),references=[...new Map(frames.map(f=>[f.assetId,{assetId:f.assetId,version:f.assetVersion}])).values()];
 if(references.length>100)fail(400,'This draft exceeds the existing edit-record limit of 100 unique assets; split the production explicitly.');
 return applyProductionRecord(project,{expectedVersion:project.version,...(existing?{id:existing.record.id}:{}),type:'edit',name:'Storyboard animatic — silent timing draft',content:{kind,fps,sequenceVersion:fresh.sequenceVersion,frames,audio:null,timingBasis:body.refresh===true?'estimated':'manually_timed'},references,dependencies:[]},assets);
}

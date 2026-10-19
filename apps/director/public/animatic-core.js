import {applyProductionRecord} from './production-records-core.js';
const kind='storyboard_animatic_draft';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const audioAsset=(project,pin,assets)=>assets.find(a=>a.id===pin?.assetId&&a.projectId===project.id&&a.version===pin?.assetVersion&&['audio/wav','audio/mpeg'].includes(a.mime)&&['master_song','dialogue'].includes(a.role)&&a.scope==='project'&&/^[a-f0-9]{64}$/.test(a.checksum||''));
export function fitFrameCounts(counts,target){
 if(!Array.isArray(counts)||!counts.length||counts.length>200||counts.some(n=>!Number.isSafeInteger(n)||n<1||n>27000)||!Number.isSafeInteger(target)||target<counts.length||target>108000)fail(400,'The complete audio needs bounded timing with at least one frame for each shot.');
 const sum=counts.reduce((a,b)=>a+b,0),remaining=target-counts.length,shares=counts.map((n,index)=>({index,value:remaining*n/sum})),result=shares.map(s=>1+Math.floor(s.value));
 const order=shares.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index);let residual=target-result.reduce((a,b)=>a+b,0);
 for(let i=0;i<residual;i++)result[order[i].index]++;return result;
}
export function currentAnimatic(project){const record=(project.production?.records||[]).filter(r=>r.type==='edit'&&r.versions.find(v=>v.version===r.currentVersion)?.content?.kind===kind).at(-1);return record?{record,snapshot:record.versions.find(v=>v.version===record.currentVersion)}:null;}
export function frameAt(frames,frame){if(!Number.isSafeInteger(frame)||frame<0)throw Error('Invalid playhead frame.');let start=0;for(let i=0;i<frames.length;i++){const end=start+frames[i].frameCount;if(frame<end)return {index:i,start,end};start=end;}return {index:Math.max(0,frames.length-1),start:Math.max(0,start-(frames.at(-1)?.frameCount||0)),end:start};}
export function animaticContext(project,frameContext,assets=[]){
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
  if(![24,25,30].includes(content.fps)||content.sequenceVersion!==sequence?.version||!Array.isArray(content.frames)||content.frames.length!==frames.length||!['estimated','manually_timed'].includes(content.timingBasis))holds.push('The saved draft needs current sequence and timing review.');
  else for(let i=0;i<frames.length;i++){
   const pin=content.frames[i],now=frames[i];if(['shotId','specVersion','frameSelectionVersion','assetId','assetVersion','aspectRatio'].some(k=>pin?.[k]!==now[k])||!Number.isSafeInteger(pin?.frameCount)||pin.frameCount<1||pin.frameCount>content.fps*900)holds.push('The saved draft has changed or unavailable frame inputs; explicitly refresh its timing draft.');
  }
 }
 const frameSourcesCurrent=holds.length===0,audio=content?.audio??null,audioSource=audio?audioAsset(project,audio,assets):null;
 if(audio!==null&&(!audioSource||audio.checksum!==audioSource.checksum||Object.keys(audio).some(k=>!['assetId','assetVersion','checksum'].includes(k))))holds.push('The exact linked original audio is unavailable or changed. Explicitly refresh or unlink it.');
 const active=Array.isArray(content?.frames)?content.frames:frames,fps=content?.fps||24,totalFrames=active.reduce((n,f)=>n+(Number.isSafeInteger(f?.frameCount)?f.frameCount:0),0);
 if(totalFrames<1||totalFrames>fps*3600)holds.push('Animatic timing must fit within one hour.');
 return {projectId:project.id,projectVersion:project.version,recordId:saved?.record.id||null,version:saved?.record.currentVersion||null,sequenceVersion:sequence?.version||null,fps,frames:active,totalFrames,durationSeconds:totalFrames/fps,timingBasis:content?.timingBasis||'estimated',holds:[...new Set(holds)],canPlay:holds.length===0,frameSourcesCurrent,saved:!!saved,silent:!audio,audio:audioSource?{assetId:audioSource.id,assetVersion:audioSource.version,name:audioSource.name,checksum:audioSource.checksum}:null,audioLinked:audio!==null,audioOptions:assets.filter(a=>audioAsset(project,{assetId:a.id,assetVersion:a.version},assets)).map(a=>({assetId:a.id,assetVersion:a.version,name:a.name})),productionAuthorized:false,sourceFrames:frames};
}
export function saveAnimatic(project,body,frameContext,assets){
 if(!body||Object.keys(body).some(k=>!['expectedVersion','fps','frameCounts','refresh','acknowledgeTiming','audio','acknowledgeAudio'].includes(k)))fail(400,'Unsupported animatic draft command.');
 if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen before saving timing.');
 if(body.acknowledgeTiming!==true)fail(400,'Confirm this is draft timing, not audiovisual, motion or final-film approval.');
 const existing=currentAnimatic(project),fresh=animaticContext({...project,production:{...project.production,records:(project.production?.records||[]).filter(r=>r.id!==existing?.record.id)}},frameContext,assets);
 if(!fresh.canPlay)fail(409,fresh.holds.join(' '));
 if(existing&&!animaticContext(project,frameContext,assets).canPlay&&body.refresh!==true)fail(409,'Explicitly refresh changed inputs; older timing versions remain saved.');
 let audio=existing?.snapshot.content.audio??null;
 if(Object.hasOwn(body,'audio')){
  if(body.acknowledgeAudio!==true)fail(400,'Explicitly confirm linking or unlinking the original audio for draft preview.');
  if(body.audio===null)audio=null;
  else{if(!body.audio||typeof body.audio!=='object'||Object.keys(body.audio).some(k=>!['assetId','assetVersion'].includes(k)))fail(400,'Choose an exact owned audio asset version, without a URL or client duration.');const source=audioAsset(project,body.audio,assets);if(!source)fail(400,'Choose an existing project song or dialogue WAV/MP3 source.');audio={assetId:source.id,assetVersion:source.version,checksum:source.checksum};}
 }
 if(audio&&audioAsset(project,audio,assets)?.checksum!==audio.checksum)fail(409,'The original audio version is unavailable or changed. Explicitly unlink it or choose a current source.');
 const fps=body.fps??24;if(![24,25,30].includes(fps))fail(400,'Choose 24, 25 or 30 frames per second.');
 const counts=body.frameCounts;if(!Array.isArray(counts)||counts.length!==fresh.frames.length||counts.some(n=>!Number.isSafeInteger(n)||n<1||n>fps*900)||counts.reduce((a,b)=>a+b,0)>fps*3600)fail(400,'Provide one bounded integer frame count for every shot.');
 const frames=fresh.frames.map((f,i)=>({...f,frameCount:counts[i]})),references=[...new Map([...frames.map(f=>[f.assetId,{assetId:f.assetId,version:f.assetVersion}]),...(audio?[[audio.assetId,{assetId:audio.assetId,version:audio.assetVersion}]]:[])]).values()];
 if(references.length>100)fail(400,'This draft exceeds the existing edit-record limit of 100 unique assets; split the production explicitly.');
 return applyProductionRecord(project,{expectedVersion:project.version,...(existing?{id:existing.record.id}:{}),type:'edit',name:'Storyboard animatic — '+(audio?'original-audio':'silent')+' timing draft',content:{kind,fps,sequenceVersion:fresh.sequenceVersion,frames,audio,timingBasis:body.refresh===true?'estimated':'manually_timed'},references,dependencies:[]},assets);
}

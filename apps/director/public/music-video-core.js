import {applyProductionRecord} from './production-records-core.js';

export const MUSIC_VIDEO_KIND='music_video_plan_v1';
export const MUSIC_VIDEO_ROLES=['singing','narrative','broll','dance','lyric_graphics'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function keys(x,allowed){if(!plain(x)||Object.keys(x).length!==allowed.length||allowed.some(k=>!Object.hasOwn(x,k)))fail(400,'Unsupported or missing music-video fields.');}
function integer(x,min,max,label){if(!Number.isSafeInteger(x)||x<min||x>max)fail(400,'Invalid '+label+'.');return x;}
function text(x,max,label){if(typeof x!=='string'||!x.trim()||x.length>max)fail(400,'Invalid '+label+'.');return x.trim();}
function list(x,max,label){if(!Array.isArray(x)||x.length>max)fail(400,'Invalid '+label+'.');return x;}
function unique(items,label){if(new Set(items).size!==items.length)fail(400,'Duplicate '+label+'.');}
const snapshot=r=>r.versions?.find(v=>v.version===r.currentVersion);
export function currentMusicVideo(project){
 const records=(project.production?.records||[]).filter(r=>r.type==='edit'&&snapshot(r)?.content?.kind===MUSIC_VIDEO_KIND);
 if(records.length>1)fail(409,'Multiple song plans need resolution; no plan is selected automatically.');
 return records.length?{record:records[0],snapshot:snapshot(records[0])}:null;
}
export function normalizeMusicVideoDocument(value){
 keys(value,['kind','master','range','fps','sections','shots']);if(value.kind!==MUSIC_VIDEO_KIND)fail(400,'Unsupported music-video document version.');
 keys(value.master,['assetId','assetVersion','checksum','durationMs','timingBasis']);
 const master={assetId:text(value.master.assetId,100,'song asset'),assetVersion:integer(value.master.assetVersion,1,100000,'song version'),checksum:text(value.master.checksum,64,'song checksum'),durationMs:integer(value.master.durationMs,1,3600000,'song duration'),timingBasis:value.master.timingBasis};
 if(!/^[a-f0-9]{64}$/.test(master.checksum)||master.timingBasis!=='user_reviewed')fail(400,'Song metadata must be explicitly reviewed; it is not server-measured analysis.');
 keys(value.range,['startMs','endMs']);const range={startMs:integer(value.range.startMs,0,master.durationMs-1,'excerpt start'),endMs:integer(value.range.endMs,1,master.durationMs,'excerpt end')};if(range.startMs>=range.endMs)fail(400,'The excerpt must have positive duration.');
 if(![24,25,30].includes(value.fps))fail(400,'Choose 24, 25 or 30 fps.');
 const interval=(x,label)=>{integer(x.startMs,range.startMs,range.endMs-1,label+' start');integer(x.endMs,range.startMs+1,range.endMs,label+' end');if(x.startMs>=x.endMs)fail(400,'Invalid '+label+' interval.');};
 const sections=list(value.sections,100,'song sections').map(s=>{keys(s,['id','label','startMs','endMs','timingBasis']);interval(s,'section');if(!['provisional','user_reviewed'].includes(s.timingBasis))fail(400,'Song sections cannot claim unperformed analysis.');return {id:text(s.id,80,'section ID'),label:text(s.label,160,'section label'),startMs:s.startMs,endMs:s.endMs,timingBasis:s.timingBasis};});
 unique(sections.map(s=>s.id),'section IDs');if(!sections.length||sections[0].startMs!==range.startMs||sections.at(-1).endMs!==range.endMs||sections.some((s,i)=>i&&s.startMs!==sections[i-1].endMs))fail(400,'Song sections must cover the excerpt in order without gaps or overlaps.');
 const shots=list(value.shots,200,'song shots').map(s=>{
  keys(s,['shotId','shotVersion','contractVersion','startMs','endMs','role','syncClass','performers','timingBasis']);interval(s,'shot');
  if(!MUSIC_VIDEO_ROLES.includes(s.role)||!['sync_required','performance_no_visible_sync','no_sync'].includes(s.syncClass)||s.role==='singing'&&s.syncClass==='no_sync'||s.role==='lyric_graphics'&&s.syncClass!=='no_sync'||!['provisional','user_reviewed'].includes(s.timingBasis))fail(400,'Choose an explicit shot role, performance sync class and timing basis.');
  const performers=list(s.performers,10,'performers').map(p=>{keys(p,['recordId','version']);return {recordId:text(p.recordId,100,'performer ID'),version:integer(p.version,1,100,'performer version')};});unique(performers.map(p=>p.recordId),'performers');
  return {shotId:text(s.shotId,100,'shot ID'),shotVersion:integer(s.shotVersion,1,100000,'shot version'),contractVersion:s.contractVersion===null?null:integer(s.contractVersion,1,100,'contract version'),startMs:s.startMs,endMs:s.endMs,role:s.role,syncClass:s.syncClass,performers,timingBasis:s.timingBasis};
 });unique(shots.map(s=>s.shotId),'shot IDs');
 return {kind:MUSIC_VIDEO_KIND,master,range,fps:value.fps,sections,shots};
}
function sourceFor(project,pin,assets){return assets.find(a=>a.id===pin.assetId&&a.version===pin.assetVersion&&a.projectId===project.id&&a.scope==='project'&&a.role==='master_song'&&['audio/wav','audio/mpeg'].includes(a.mime)&&a.checksum===pin.checksum);}
export function musicVideoContext(project,assets=[]){
 const options=assets.filter(a=>a.projectId===project.id&&a.scope==='project'&&a.role==='master_song'&&['audio/wav','audio/mpeg'].includes(a.mime)&&/^[a-f0-9]{64}$/.test(a.checksum||'')).map(a=>({assetId:a.id,assetVersion:a.version,name:a.name,checksum:a.checksum}));
 const result={projectId:project.id,projectVersion:project.version,songOptions:options,recordId:null,version:null,document:null,holds:[],shotChecks:[],readyForStoryboardReview:false,generationAuthorized:false,lipSyncValidated:false};
 let current;try{current=currentMusicVideo(project);if(current){result.recordId=current.record.id;result.version=current.record.currentVersion;result.document=normalizeMusicVideoDocument(current.snapshot.content);}}catch(error){result.holds.push(error.message);return result;}
 if(!current){result.holds.push('Choose and review the original song before music-video production.');return result;}
 const d=result.document;if(!sourceFor(project,d.master,assets)||!current.snapshot.references?.some(r=>r.assetId===d.master.assetId&&r.version===d.master.assetVersion))result.holds.push('The exact original song is unavailable or changed.');
 if(project.duration!==(d.range.endMs-d.range.startMs)/1000)result.holds.push('Review the project runtime against the selected song interval.');
 if(d.sections.some(s=>s.timingBasis==='provisional'))result.holds.push('Review the provisional song sections; no beat or lyric analysis has been performed.');
 const planned=new Set(d.shots.map(s=>s.shotId));if(!project.shots?.length||project.shots.some(s=>!planned.has(s.id)))result.holds.push('Assign song intervals and roles to every storyboard shot.');
 const order=project.storyboardHandoff?.sequences?.at(-1)?.shots?.map(s=>s.shotId)||project.shots?.map(s=>s.id)||[];
 if(d.shots.length===order.length&&d.shots.some((s,i)=>s.shotId!==order[i]))result.holds.push('Review song assignments against the current storyboard order.');
 let cursor=d.range.startMs;
 for(const s of d.shots){
  const holds=[],shot=project.shots?.find(x=>x.id===s.shotId),contract=project.storyboardHandoff?.shots?.find(x=>x.id===s.shotId);
  if(!shot||shot.version!==s.shotVersion||(contract?.currentVersion??null)!==s.contractVersion)holds.push('The source shot changed; review its timing and performance assignment.');
  if(s.startMs!==cursor)holds.push('Resolve the timeline gap, overlap or shot ordering.');cursor=s.endMs;
  if(s.timingBasis==='provisional')holds.push('Review provisional shot timing.');
  if(s.syncClass!=='no_sync'&&s.performers.length!==1)holds.push('Assign one performer; multi-singer vocal attribution needs separate review.');
  for(const p of s.performers){const r=project.production?.records?.find(r=>r.id===p.recordId&&r.type==='character');if(!r||r.currentVersion!==p.version)holds.push('The selected performer is missing or changed.');}
  result.shotChecks.push({shotId:s.shotId,holds,syncRequired:s.syncClass==='sync_required',requiresSingingProof:s.syncClass==='sync_required',masterStartMs:s.startMs,masterEndMs:s.endMs,sourceAudioUnchanged:true});
 }
 if(!d.shots.length||cursor!==d.range.endMs)result.holds.push('The shot timeline must cover the complete selected song interval.');
 if(result.shotChecks.some(s=>s.holds.length))result.holds.push('Resolve shot-specific timing and performer holds.');
 result.readyForStoryboardReview=result.holds.length===0;return result;
}
export function saveMusicVideo(project,body,assets){
 keys(body,['expectedVersion','document','acknowledgePlanning']);if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen before saving the song plan.');
 if(project.format!=='music_video')fail(409,'Song planning requires a music-video project.');if(body.acknowledgePlanning!==true)fail(400,'Confirm this saves planning only, without generation or media acceptance.');
 const document=normalizeMusicVideoDocument(body.document);if(!sourceFor(project,document.master,assets))fail(400,'Choose the exact owned original song asset and checksum.');
 const current=currentMusicVideo(project),dependencies=new Map();
 for(const s of document.shots){const shot=project.shots?.find(x=>x.id===s.shotId),contract=project.storyboardHandoff?.shots?.find(x=>x.id===s.shotId);if(!shot||shot.version!==s.shotVersion||(contract?.currentVersion??null)!==s.contractVersion)fail(409,'Bind each current storyboard shot and contract version.');for(const p of s.performers){const r=project.production?.records?.find(r=>r.id===p.recordId&&r.type==='character'&&r.currentVersion===p.version);if(!r)fail(400,'Select current characters from this project.');dependencies.set(p.recordId,{recordId:p.recordId,version:p.version});}}
 const next=applyProductionRecord(project,{expectedVersion:project.version,...(current?{id:current.record.id}:{}),type:'edit',name:'Music video — original song and shot plan',content:document,references:[{assetId:document.master.assetId,version:document.master.assetVersion}],dependencies:[...dependencies.values()]},assets);
 // Choosing an exact song interval explicitly sets the intended runtime; source
 // signatures in existing brief/department/storyboard code then flag review.
 if(next.duration!==(document.range.endMs-document.range.startMs)/1000){next.duration=(document.range.endMs-document.range.startMs)/1000;next.briefExplicitFields=[...new Set([...(next.briefExplicitFields||[]),'duration'])];if(next.version===project.version)next.version++;}
 return next;
}

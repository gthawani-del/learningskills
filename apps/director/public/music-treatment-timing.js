// Music-only additions to the shared screenplay document. Times always address
// the unchanged original master; this contract grants no media or spend rights.
export const MUSIC_TREATMENT_CONTRACT='director-music-treatment-v1';
export const MUSIC_TREATMENT_ROLES=Object.freeze(['singing','narrative','broll','dance','lyric_graphics']);
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const same=(a,b)=>canonical(a)===canonical(b);
function keys(v,names){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==names.length||names.some(k=>!Object.hasOwn(v,k)))fail('Invalid timed music-treatment fields.');}
function text(v,max){if(typeof v!=='string'||v.length>max)fail('Music-treatment direction must be bounded text.');return v;}
const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('Music-treatment times must be original-song milliseconds.');return v;};
export function normalizeMusicTiming(value,scenes){
 keys(value,['source','range','sequences']);keys(value.source,['recordId','version','master']);text(value.source.recordId,100);if(!value.source.recordId)fail('Pin the saved song evidence.');integer(value.source.version,1,100);
 const master=value.source.master;keys(master,['assetId','assetVersion','checksum','durationMs','timingBasis']);text(master.assetId,100);if(!master.assetId||!/^[a-f0-9]{64}$/.test(master.checksum)||master.timingBasis!=='user_reviewed')fail('Pin the exact original song.');integer(master.assetVersion,1,100000);integer(master.durationMs,1000,3600000);
 keys(value.range,['startMs','endMs']);integer(value.range.startMs,0,master.durationMs-1000);integer(value.range.endMs,value.range.startMs+1000,master.durationMs);
 if(!Array.isArray(value.sequences)||value.sequences.length!==scenes.length)fail('Every treatment scene needs exactly one timed sequence.');
 let previous=value.range.startMs;
 const sequences=value.sequences.map((s,i)=>{
  keys(s,['sceneId','startMs','endMs','sectionIds','roles','emotion','performance','transition','syncClass']);
  if(s.sceneId!==scenes[i].id)fail('Timed sequences must follow the exact treatment scene IDs and order.');integer(s.startMs,value.range.startMs,value.range.endMs-1);integer(s.endMs,s.startMs+1,value.range.endMs);
  if(s.startMs!==previous||Math.abs((s.endMs-s.startMs)/1000-scenes[i].durationSeconds)>0.000001)fail('Treatment scenes must cover the requested song without gaps, overlaps or conflicting durations.');previous=s.endMs;
  for(const [name,max] of [['sectionIds',100],['roles',5]])if(!Array.isArray(s[name])||s[name].length>max||new Set(s[name]).size!==s[name].length||s[name].some(x=>typeof x!=='string'||!x||x.length>100))fail('Invalid music-section or creative-role links.');
  if(s.roles.some(r=>!MUSIC_TREATMENT_ROLES.includes(r))||!['sync_required','performance_no_visible_sync','no_sync'].includes(s.syncClass)||s.roles.includes('singing')&&s.syncClass==='no_sync'||!s.roles.includes('singing')&&s.syncClass!=='no_sync')fail('Choose an explicit singing/performance synchronization requirement.');
  return {...structuredClone(s),emotion:text(s.emotion,2000),performance:text(s.performance,3000),transition:text(s.transition,1500)};
 });
 if(previous!==value.range.endMs)fail('The treatment must reach the end of the requested song.');
 return {source:structuredClone(value.source),range:structuredClone(value.range),sequences};
}
export function validateMusicTreatment(document,song,{complete=false}={}){
 if(!document.musicTiming)fail('Add original-song timing to this music treatment before review.');
 const timing=normalizeMusicTiming(document.musicTiming,document.scenes);
 if(!song||timing.source.recordId!==song.recordId||timing.source.version!==song.version||!['assetId','assetVersion','checksum','durationMs','timingBasis'].every(k=>timing.source.master[k]===song.master[k])||!['startMs','endMs'].every(k=>timing.range[k]===song.range[k]))fail('The treatment uses earlier song evidence or a different original-song interval.');
 for(const s of timing.sequences){
  const intersecting=song.sections.filter(section=>section.startMs<s.endMs&&section.endMs>s.startMs).map(section=>section.id);
  if(s.sectionIds.length!==intersecting.length||s.sectionIds.some(id=>!intersecting.includes(id)))fail('Each sequence must name the actual musical sections overlapping its time interval.');
  if(complete&&(!s.roles.length||!s.emotion.trim()||!s.performance.trim()||!s.transition.trim()||!document.scenes.find(scene=>scene.id===s.sceneId)?.action.trim()))fail('Complete each sequence’s visible action, creative role, emotional progression, performance and transition before approval.');
 }
 if(complete&&(!document.logline.trim()||!document.treatment.trim()))fail('Write the complete visual treatment and logline before approval.');
 return timing;
}
export function assertScopedMusicTiming(previous,next,sceneIds){
 if(!sceneIds?.length)return;
 if(!!previous.musicTiming!==!!next.musicTiming)fail('A targeted revision cannot replace the treatment timing contract.');
 if(!previous.musicTiming)return;
 const a=previous.musicTiming,b=next.musicTiming;
 if(!same(a.source,b.source)||!same(a.range,b.range))fail('A targeted revision must preserve the original-song source and range.');
 for(const row of a.sequences)if(!sceneIds.includes(row.sceneId)&&!same(row,b.sequences.find(s=>s.sceneId===row.sceneId)))fail('A targeted revision changed an unselected musical sequence.');
}

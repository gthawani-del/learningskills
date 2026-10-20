import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {normalizeMusicVideoDocument} from './public/music-video-core.js';

const runFile=promisify(execFile),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reject=message=>{throw Object.assign(new Error(message),{status:422});};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(asset,project)=>asset&&(asset.projectId??asset.project_id)===project.id;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const protocols=['-protocol_whitelist','file,pipe'];
const formats=['-format_whitelist','mov,matroska,webm,ogg,wav,mp3,image2,png_pipe,jpeg_pipe'];
const number=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function fields(value,allowed,required=allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))reject('Unsupported or missing supplied-media render fields.');}

/** Pure preflight. A sync declaration is a required timing binding, not quality proof. */
export function prepareSongRender({project,songPlan,selections,assets,output={}}){
 if(!project?.id||project.format!=='music_video'||!Array.isArray(assets))reject('Choose an owned music-video project and supplied media.');
 const plan=normalizeMusicVideoDocument(songPlan);
 if(!plan.shots.length||!Array.isArray(selections)||selections.length!==plan.shots.length||selections.length>200)reject('Select exactly one source for every planned shot.');
 fields(output,['width','height'],[]);const ratio=project.ratio??'16:9',dimensions={'16:9':[1280,720],'9:16':[720,1280],'1:1':[1024,1024]};
 if(!Object.hasOwn(dimensions,ratio))reject('Choose a supported approved 16:9, 9:16 or 1:1 delivery aspect.');
 const [defaultWidth,defaultHeight]=dimensions[ratio],width=output.width??defaultWidth,height=output.height??defaultHeight,[ratioWidth,ratioHeight]=ratio.split(':').map(Number);
 if(!number(width,160,1920)||!number(height,90,1920)||width%2||height%2||width*height>2073600)reject('Choose even output dimensions within the 1080p supplied-media render bound.');
 if(width*ratioHeight!==height*ratioWidth)reject('Output dimensions must preserve the approved project aspect ratio.');
 const master=assets.find(a=>a.id===plan.master.assetId);
 if(!own(master,project)||master.version!==plan.master.assetVersion||master.checksum!==plan.master.checksum||master.role!=='master_song'||!['audio/wav','audio/mpeg'].includes(master.mime))reject('The original master must match the exact owned asset, version, checksum and audio role.');
 const byShot=new Map();
 for(const item of selections){fields(item,['shotId','assetId','assetVersion','sourceInMs','syncBinding'],['shotId','assetId','assetVersion','sourceInMs']);if(byShot.has(item.shotId))reject('A source selection repeats a shot.');byShot.set(item.shotId,item);}
 let end=plan.range.startMs;
 const clips=plan.shots.map(shot=>{
  if(shot.startMs!==end)reject('The planned shots must cover the approved song interval without gaps, overlaps or reordering.');end=shot.endMs;
  const selected=byShot.get(shot.shotId),asset=assets.find(a=>a.id===selected?.assetId);
  if(!selected||!own(asset,project)||!number(selected.assetVersion,1,100000)||asset.version!==selected.assetVersion||!['image/png','image/jpeg','video/mp4','video/webm'].includes(asset.mime)||!number(selected.sourceInMs,0,3600000))reject('Each shot needs an exact owned image/video source and an explicit source trim.');
  const still=asset.mime.startsWith('image/');if(still&&selected.sourceInMs!==0)reject('A still image has no source trim.');
  const startFrame=Math.round((shot.startMs-plan.range.startMs)*plan.fps/1000),endFrame=Math.round((shot.endMs-plan.range.startMs)*plan.fps/1000);
  if(shot.syncClass==='sync_required'){
   if(still)reject('Visible singing cannot be delivered by holding a still image.');
   const sync=selected.syncBinding;fields(sync,['masterAssetId','masterAssetVersion','checksum','masterStartMs','sourceStartMs','reviewed']);
   if(sync.masterAssetId!==master.id||sync.masterAssetVersion!==master.version||sync.checksum!==master.checksum||sync.reviewed!==true||!number(sync.masterStartMs,0,plan.master.durationMs)||!number(sync.sourceStartMs,0,3600000)||selected.sourceInMs!==sync.sourceStartMs+shot.startMs-sync.masterStartMs)reject('Singing footage needs the reviewed exact master-to-source timing binding; no retiming is permitted.');
  }else if(selected.syncBinding!==undefined)reject('Only a sync-required shot accepts a singing timing binding.');
  return {shotId:shot.shotId,assetId:asset.id,assetVersion:asset.version,mime:asset.mime,sourceInMs:selected.sourceInMs,startFrame,endFrame,frameCount:endFrame-startFrame,syncClass:shot.syncClass,...(selected.syncBinding?{syncBinding:structuredClone(selected.syncBinding)}:{})};
 });
 if(end!==plan.range.endMs)reject('The supplied-media timeline must include the complete approved song interval.');
 if(!Number.isFinite(project.duration)||project.duration<=0||Math.abs(project.duration-(plan.range.endMs-plan.range.startMs)/1000)>1/plan.fps)reject('The project runtime must match its approved song interval.');
 return {version:'director-supplied-song-render-v1',projectId:project.id,master:{...plan.master},range:{...plan.range},fps:plan.fps,width,height,totalFrames:clips.at(-1).endFrame,clips,audioPolicy:'original-master-content-no-time-stretch',audioEncoding:'aac',limitations:['Assembly does not establish creative, identity or singing quality acceptance.','Final AAC is encoded from the approved original; it is not a byte-identical audio stream.']};
}

/** Portable local/worker entry point. No hosting, dispatch, storage or paid services. */
export async function renderSongTimeline({project,songPlan,selections,assets,assetDir,output={},signal}){
 const manifest=prepareSongRender({project,songPlan,selections,assets,output});
 if(typeof assetDir!=='string')reject('Supplied-media asset storage is unavailable.');
 let root;try{root=await realpath(assetDir);}catch{reject('Supplied-media asset storage is unavailable.');}
 const deadline=Date.now()+600000;
 async function run(bin,args){
  if(signal?.aborted)reject('Song rendering was cancelled.');
  const remaining=deadline-Date.now();if(remaining<=0)reject('Song rendering exceeded its processing bound.');
  try{return await runFile(bin,args,{timeout:Math.min(120000,remaining),maxBuffer:4*1024*1024,windowsHide:true,signal});}
  catch(error){reject(signal?.aborted?'Song rendering was cancelled.':`${bin} failed; the original master and supplied media are unchanged.`);}
 }
 async function pathFor(id){
  if(!uuid.test(id))reject('Invalid supplied-media asset identity.');
  const path=resolve(root,id);try{const stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile()||!(await realpath(path)).startsWith(root+sep))reject('Unsafe supplied-media asset path.');}catch{reject('Supplied media is missing or uses an unsafe path.');}return path;
 }
 async function probe(path,count=false){const result=await run('ffprobe',['-v','error',...protocols,...formats,...(count?['-count_frames']:[]),'-show_format','-show_streams','-of','json',path]);try{return JSON.parse(result.stdout);}catch{reject('Unreadable supplied-media metadata.');}}
 const masterPath=await pathFor(manifest.master.assetId),masterAsset=assets.find(a=>a.id===manifest.master.assetId),masterStat=await lstat(masterPath);
 if(masterStat.size>128*1024*1024||masterAsset.size!==undefined&&masterAsset.size!==masterStat.size)reject('Original master size exceeds the inspected-source bound or changed.');
 const masterBytes=await readFile(masterPath),rawHash=digest(masterBytes);
 const masterHash=masterAsset.checksumAlgorithm==='sha256-bytes'?rawHash:masterAsset.checksumAlgorithm===undefined?digest(JSON.stringify(masterBytes.toString('base64'))):null;
 if(masterHash!==manifest.master.checksum)reject('Original master bytes do not match the approved source.');
 const source=await probe(masterPath),audio=source.streams?.find(s=>s.codec_type==='audio'),sourceDuration=Number(audio?.duration??source.format?.duration);
 if(!audio||source.streams.some(s=>s.codec_type==='video')||![1,2].includes(Number(audio.channels))||!Number.isFinite(sourceDuration)||Math.abs(sourceDuration-manifest.master.durationMs/1000)>0.25||sourceDuration+0.001<manifest.range.endMs/1000)reject('The original song duration/audio properties need review before rendering.');
 const sources=new Map();
 for(const clip of manifest.clips){if(sources.has(clip.assetId))continue;const path=await pathFor(clip.assetId),info=await probe(path),video=info.streams?.find(s=>s.codec_type==='video');if(!video?.width||!video.height||video.width*video.height>33554432)reject('A supplied source has no supported bounded picture stream.');sources.set(clip.assetId,{path,info,video});}
 for(const clip of manifest.clips)if(clip.mime.startsWith('video/')){const src=sources.get(clip.assetId),duration=Number(src.video.duration??src.info.format?.duration);if(!Number.isFinite(duration)||duration+0.001<clip.sourceInMs/1000+clip.frameCount/manifest.fps)reject('A source clip is too short for its explicit trim. The renderer will not loop, freeze or stretch it.');}
 const temp=await mkdtemp(join(tmpdir(),'director-song-render-'));
 try{
  for(let i=0;i<manifest.clips.length;i++){
   const clip=manifest.clips[i],path=sources.get(clip.assetId).path,still=clip.mime.startsWith('image/');
   const args=['-v','error','-nostdin','-y',...protocols,...formats,...(still?['-loop','1','-framerate',String(manifest.fps)]:['-ss',String(clip.sourceInMs/1000)]),'-i',path,'-map','0:v:0','-an','-vf',`scale=${manifest.width}:${manifest.height}:force_original_aspect_ratio=decrease,pad=${manifest.width}:${manifest.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${manifest.fps}`,'-frames:v',String(clip.frameCount),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','1','-movflags','+faststart',join(temp,`shot-${i}.mp4`)];
   await run('ffmpeg',args);
  }
  await writeFile(join(temp,'sequence.txt'),manifest.clips.map((_,i)=>`file 'shot-${i}.mp4'`).join('\n'));
  const finalPath=join(temp,'music-video.mp4');
  await run('ffmpeg',['-v','error','-nostdin','-y',...protocols,'-f','concat','-safe','1','-i',join(temp,'sequence.txt'),...protocols,...formats,'-i',masterPath,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',`atrim=start=${manifest.range.startMs/1000}:end=${manifest.range.endMs/1000},asetpts=PTS-STARTPTS`,'-c:a','aac','-b:a','192k','-threads','1','-movflags','+faststart',finalPath]);
  const final=await probe(finalPath,true),video=final.streams?.find(s=>s.codec_type==='video'),finalAudio=final.streams?.find(s=>s.codec_type==='audio'),duration=(manifest.range.endMs-manifest.range.startMs)/1000;
  if(Number(video?.nb_read_frames)!==manifest.totalFrames||video?.width!==manifest.width||video?.height!==manifest.height||video?.avg_frame_rate!==`${manifest.fps}/1`||!finalAudio||Math.abs(Number(finalAudio.duration)-duration)>0.05||Math.abs(Number(final.format?.duration)-duration)>Math.max(0.1,1/manifest.fps))reject('Finished song render failed frame, audio, size or duration validation.');
  await run('ffmpeg',['-v','error','-nostdin',...protocols,...formats,'-i',finalPath,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  if(digest(await readFile(masterPath))!==rawHash)reject('Original master changed during rendering; no output delivered.');
  if((await lstat(finalPath)).size>512*1024*1024)reject('Finished output exceeds this portable worker response bound.');
  return {bytes:await readFile(finalPath),manifest:{...manifest,masterBytesUnchanged:true,output:{mime:'video/mp4',videoCodec:video.codec_name,audioCodec:finalAudio.codec_name,durationSeconds:Number(final.format.duration),audioDurationSeconds:Number(finalAudio.duration),audioSampleRate:Number(finalAudio.sample_rate),audioChannels:Number(finalAudio.channels)},technicalValidation:'passed',creativeReview:'unverified'}};
 }finally{await rm(temp,{recursive:true,force:true});}
}

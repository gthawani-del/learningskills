import {analyzeSongChannels} from '../public/song-analysis-core.js';
// Portable deterministic inspection worker. Run untrusted media in an isolated
// sandbox. This module never changes storage, publishes assets or calls models.
import {createHash} from 'node:crypto';
import {createReadStream,constants as fsConstants} from 'node:fs';
import {lstat,realpath,open,mkdir,readFile,rm} from 'node:fs/promises';
import {resolve,sep,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile);
export const SOURCE_INSPECTION_VERSION='director-source-inspection-v1';
export const INSPECTION_LIMITS=Object.freeze({maxBytes:128*1024*1024,maxDurationSeconds:1800,maxDimension:4096,maxPixels:4096*2160,maxStreams:8,maxChannels:8,maxSampleRate:192000,maxFramesPerSecond:120,commandTimeoutMs:120000,downloadTimeoutMs:45000});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=(code,message)=>{throw Object.assign(new Error(message),{code,status:422});};
function manifest(value){if(!value||!['audio/wav','audio/mpeg','video/mp4'].includes(value.mime)||!Number.isSafeInteger(value.size)||value.size<1||value.size>INSPECTION_LIMITS.maxBytes||!/^[a-f0-9]{64}$/.test(value.sha256||''))deny('source_manifest_invalid','A bounded source manifest and raw-byte checksum are required.');return value;}
export function privateSourceURL(value){
 if(!value||typeof value.url!=='string'||typeof value.projectRef!=='string'||!/^[a-z0-9-]+$/.test(value.projectRef)||![value.ownerId,value.projectId,value.uploadId].every(v=>uuid.test(v||'')))deny('source_location_invalid','Invalid private source identity.');
 let url;try{url=new URL(value.url);}catch{deny('source_location_invalid','Invalid private source location.');}
 const expected=`/storage/v1/object/sign/director-source-media/${value.ownerId}/${value.projectId}/${value.uploadId}`;
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||![`${value.projectRef}.supabase.co`,`${value.projectRef}.storage.supabase.co`].includes(url.hostname)||url.pathname!==expected||!url.searchParams.get('token')||[...url.searchParams.keys()].some(k=>k!=='token')||url.searchParams.getAll('token').length!==1)deny('source_location_invalid','The download must reference the exact private source object.');
 return url.href;
}
async function checkedPath(root,path){
 if(typeof root!=='string'||typeof path!=='string')deny('source_path_invalid','A valid isolated source path is required.');const base=await realpath(root),target=resolve(path);if(!target.startsWith(base+sep))deny('source_path_invalid','Source must be inside its isolated work directory.');
 const info=await lstat(target);if(!info.isFile()||info.isSymbolicLink()||await realpath(target)!==target)deny('source_path_invalid','Source must be a regular isolated file.');return {target,info};
}
export async function downloadPrivateSource({storage,source,root,fetcher=fetch}){
 manifest(source);const url=privateSourceURL(storage);await mkdir(root,{recursive:true});const base=await realpath(root),path=join(base,'source.bin');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),INSPECTION_LIMITS.downloadTimeoutMs);let handle,response,created=false;
 try{
  response=await fetcher(url,{redirect:'error',signal:controller.signal});if(!response.ok||!response.body)deny('source_download_failed','Private source could not be downloaded.');
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==source.size))deny('source_size_mismatch','Private source length differs from the saved manifest.');
  handle=await open(path,'wx',0o600);created=true;let size=0;const checksum=createHash('sha256');
  for await(const chunk of response.body){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>source.size||size>INSPECTION_LIMITS.maxBytes)deny('source_size_mismatch','Private source exceeds the saved size limit.');checksum.update(bytes);await handle.writeFile(bytes);}
  if(size!==source.size)deny('source_size_mismatch','Private source download was incomplete.');if(checksum.digest('hex')!==source.sha256)deny('source_checksum_mismatch','Private source bytes differ from the selected file.');
  await handle.close();handle=null;return path;
 }catch(error){controller.abort();if(handle)await handle.close().catch(()=>{});if(created)await rm(path,{force:true}).catch(()=>{});if(error.status===422)throw error;deny('source_download_failed','Private source download failed or exceeded its time limit.');}
 finally{clearTimeout(timer);if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
}
function signature(bytes){if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')return 'audio/wav';if(bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp')return 'video/mp4';if(bytes.length>=3&&(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224))return 'audio/mpeg';return null;}
const rate=value=>{if(typeof value!=='string'||!/^\d+(?:\/\d+)?$/.test(value))return NaN;const [n,d=1]=value.split('/').map(Number);return d===0?NaN:n/d;};
export function inspectProbe(probe,source){
 manifest(source);const formats=String(probe?.format?.format_name||'').split(','),expected=source.mime==='audio/wav'?'wav':source.mime==='audio/mpeg'?'mp3':'mp4';
 if(!formats.includes(expected)||!Array.isArray(probe.streams)||!probe.streams.length||probe.streams.length>INSPECTION_LIMITS.maxStreams)deny('source_container_invalid','Source container or stream count is unsupported.');
 const duration=Number(probe.format.duration);if(!Number.isFinite(duration)||duration<=0||duration>INSPECTION_LIMITS.maxDurationSeconds)deny('source_duration_invalid','Source duration is missing or outside the inspected pilot limit.');
 const streams=[];for(const s of probe.streams){
  if(s.codec_type==='video'&&Number(s.disposition?.attached_pic)===1){if(!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<1||s.height<1||s.width>INSPECTION_LIMITS.maxDimension||s.height>INSPECTION_LIMITS.maxDimension)deny('source_stream_invalid','Embedded artwork exceeds inspection limits.');continue;}
  if(s.codec_type==='audio'){
   const allowed=source.mime==='audio/mpeg'?['mp3']:source.mime==='audio/wav'?['pcm_s16le','pcm_s24le','pcm_s32le','pcm_f32le','pcm_f64le','pcm_u8','pcm_alaw','pcm_mulaw','adpcm_ima_wav']:['aac','mp3','alac','ac3','opus','flac'];
   const sampleRate=Number(s.sample_rate);if(!allowed.includes(s.codec_name)||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>INSPECTION_LIMITS.maxSampleRate||!Number.isInteger(s.channels)||s.channels<1||s.channels>INSPECTION_LIMITS.maxChannels)deny('source_stream_invalid','Audio codec, sample rate or channel count is unsupported.');
   streams.push({type:'audio',codec:s.codec_name,sampleRate,channels:s.channels});
  }else if(s.codec_type==='video'){
   const fps=rate(s.avg_frame_rate);if(source.mime!=='video/mp4'||!['h264','hevc','av1','vp9','mpeg4'].includes(s.codec_name)||!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<1||s.height<1||s.width>INSPECTION_LIMITS.maxDimension||s.height>INSPECTION_LIMITS.maxDimension||s.width*s.height>INSPECTION_LIMITS.maxPixels||!Number.isFinite(fps)||fps<=0||fps>INSPECTION_LIMITS.maxFramesPerSecond)deny('source_stream_invalid','Video codec, dimensions or frame rate is unsupported.');
   streams.push({type:'video',codec:s.codec_name,width:s.width,height:s.height,framesPerSecond:fps});
  }else deny('source_stream_invalid','Subtitle, data and attachment streams require a separate inspection route.');
 }
 const audio=streams.filter(s=>s.type==='audio'),video=streams.filter(s=>s.type==='video');
 if(source.mime==='video/mp4'?video.length!==1:audio.length!==1||video.length!==0)deny('source_stream_invalid','Source does not contain the expected media stream.');
 return {durationSeconds:duration,streams};
}
async function command(bin,args){try{return await execute(bin,args,{timeout:INSPECTION_LIMITS.commandTimeoutMs,maxBuffer:1024*1024,killSignal:'SIGKILL',windowsHide:true,env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});}catch{deny('source_decode_failed','Source probing or decoding failed within the inspection limits.');}}
export async function inspectLocalSource({root,path,source,songAnalysis=false}){
 manifest(source);const {target,info}=await checkedPath(root,path);if(info.size!==source.size)deny('source_size_mismatch','Source length differs from the selected file.');
 const checksum=createHash('sha256');let size=0,head=Buffer.alloc(0);for await(const bytes of createReadStream(target,{flags:fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW})){size+=bytes.length;if(size>source.size)deny('source_size_mismatch','Source changed during inspection.');checksum.update(bytes);if(head.length<16)head=Buffer.concat([head,bytes.subarray(0,16-head.length)]);}
 const actual=checksum.digest('hex');if(size!==source.size||actual!==source.sha256)deny('source_checksum_mismatch','Source bytes differ from the selected file.');if(signature(head)!==source.mime)deny('source_mime_mismatch','Source signature does not match its declared media type.');
 if(source.mime==='audio/wav'&&(head.readUInt32LE(4)+8>size||head.readUInt32LE(4)<36))deny('source_container_invalid','The WAV header is incomplete or its declared length exceeds the available bytes.');
 const whitelist=source.mime==='audio/wav'?'wav':source.mime==='audio/mpeg'?'mp3':'mov';
 const {stdout}=await command('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-format_whitelist',whitelist,'-show_entries','format=format_name,duration:stream=codec_type,codec_name,width,height,sample_rate,channels,avg_frame_rate:stream_disposition=attached_pic','-of','json',target]);
 let probe;try{probe=JSON.parse(stdout);}catch{deny('source_probe_invalid','Source probe returned invalid metadata.');}const details=inspectProbe(probe,source);
 let signalFeatures;
 if(songAnalysis===true&&source.mime.startsWith('audio/')&&details.durationSeconds<=300&&details.streams[0].channels<=2){
  const channels=details.streams[0].channels;let pcm;
  try{const result=await execute('ffmpeg',['-v','error','-nostdin','-xerror','-err_detect','explode','-threads','1','-protocol_whitelist','file,pipe','-format_whitelist',whitelist,'-i',target,'-map','0:a:0','-vn','-sn','-dn','-ac',String(channels),'-ar','16000','-threads','1','-f','f32le','pipe:1'],{encoding:'buffer',timeout:INSPECTION_LIMITS.commandTimeoutMs,maxBuffer:16000*300*channels*4+65536,killSignal:'SIGKILL',windowsHide:true,env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});pcm=result.stdout;}catch{deny('source_decode_failed','Bounded song decoding failed. Original source is unchanged.');}
  if(!pcm.length||pcm.length%(channels*4))deny('source_decode_failed','Invalid decoded song sample layout.');
  const count=pcm.length/(channels*4),samples=Array.from({length:channels},(_,c)=>Float32Array.from({length:count},(_,i)=>pcm.readFloatLE((i*channels+c)*4)));
  const measured=analyzeSongChannels({channels:samples,sampleRate:16000});if(Math.abs(measured.durationMs-details.durationSeconds*1000)>250)deny('source_decode_failed','Decoded song duration differs from the inspected source.');
  signalFeatures={...measured,version:'director-ffmpeg-audio-features-v1',provenance:'worker_decoded'};
 }else await command('ffmpeg',['-v','error','-nostdin','-xerror','-err_detect','explode','-threads','1','-protocol_whitelist','file,pipe','-format_whitelist',whitelist,'-i',target,'-map','0:V?','-map','0:a?','-threads','1','-f','null','-']);
 const after=await lstat(target);if(after.size!==info.size||after.ino!==info.ino||after.mtimeMs!==info.mtimeMs||after.ctimeMs!==info.ctimeMs)deny('source_changed','Source changed during inspection.');
 return {inspectionVersion:SOURCE_INSPECTION_VERSION,status:'passed',size,sha256:actual,checksumAlgorithm:'sha256-bytes',mime:source.mime,...details,decodeVerified:true,assetPublished:false,...(signalFeatures?{songAnalysis:signalFeatures}:{})};
}
export async function runInspection(config,{fetcher=fetch}={}){
 if(!config||!['file','private-download'].includes(config.mode)||typeof config.root!=='string')deny('source_configuration_invalid','Invalid isolated inspection configuration.');
 let path=config.path,downloaded=false;try{if(config.mode==='private-download'){path=await downloadPrivateSource({storage:config.storage,source:config.source,root:config.root,fetcher});downloaded=true;}return await inspectLocalSource({root:config.root,path,source:config.source,songAnalysis:config.songAnalysis===true});}finally{if(downloaded)await rm(path,{force:true}).catch(()=>{});}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{const config=JSON.parse(await readFile(process.argv[2],'utf8'));process.stdout.write(JSON.stringify(await runInspection(config))+'\n');}
 catch(error){process.stdout.write(JSON.stringify({inspectionVersion:SOURCE_INSPECTION_VERSION,status:'held',code:error.status===422?error.code:'source_inspection_failed',message:error.status===422?error.message:'Source inspection could not finish. The original upload remains unchanged.',assetPublished:false})+'\n');process.exitCode=1;}
}

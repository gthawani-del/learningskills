import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,lstat,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectLocalSource,SOURCE_INSPECTION_VERSION,INSPECTION_LIMITS} from './workers/source-inspection.mjs';
const execute=promisify(execFile),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(code,message)=>{throw Object.assign(new Error(message),{status:422,code});};
const digest=b=>createHash('sha256').update(b).digest('hex');
const nativeCodecs={pcm_s16le:2,pcm_s24le:3,pcm_s32le:4,pcm_f32le:4,pcm_f64le:8,pcm_u8:1};
const decodedCodecs={mp3:'pcm_f32le',pcm_alaw:'pcm_s16le',pcm_mulaw:'pcm_s16le',adpcm_ima_wav:'pcm_s16le'};
const fields=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==allowed.length||allowed.some(k=>!Object.hasOwn(v,k)))fail('excerpt_invalid','Supply an exact original master pin and excerpt range.');};

/** Pure derivative descriptor. No padding, resampling, downmixing or publication. */
export function prepareAudioExcerpt({project,master,assets,inspection,range}){
 fields(master,['assetId','assetVersion','checksum']);fields(range,['startMs','endMs']);
 const asset=assets?.find(a=>a.id===master.assetId);
 if(!project?.id||project.format!=='music_video'||!uuid.test(master.assetId)||!Number.isSafeInteger(master.assetVersion)||master.assetVersion<1||!asset||(asset.projectId??asset.project_id)!==project.id||asset.version!==master.assetVersion||asset.role!=='master_song'||!['audio/wav','audio/mpeg'].includes(asset.mime)||asset.checksumAlgorithm!=='sha256-bytes'||asset.checksum!==master.checksum||!/^[a-f0-9]{64}$/.test(master.checksum))fail('excerpt_source_invalid','Choose the exact owned original master asset version and raw-byte checksum.');
 if(inspection?.inspectionVersion!==SOURCE_INSPECTION_VERSION||inspection.status!=='passed'||inspection.decodeVerified!==true||inspection.checksumAlgorithm!=='sha256-bytes'||inspection.sha256!==master.checksum||inspection.mime!==asset.mime||inspection.size!==asset.size||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>INSPECTION_LIMITS.maxBytes||!Number.isFinite(inspection.durationSeconds)||inspection.durationSeconds<=0||inspection.durationSeconds>INSPECTION_LIMITS.maxDurationSeconds||!Array.isArray(inspection.streams)||inspection.streams.length!==1||inspection.streams[0].type!=='audio')fail('excerpt_inspection_invalid','An exact passed original master inspection is required.');
 const audio=inspection.streams[0],sampleRate=audio.sampleRate,channels=audio.channels,codec=Object.hasOwn(nativeCodecs,audio.codec)?audio.codec:Object.hasOwn(decodedCodecs,audio.codec)?decodedCodecs[audio.codec]:null;
 if(!codec||asset.mime==='audio/mpeg'&&audio.codec!=='mp3'||asset.mime==='audio/wav'&&audio.codec==='mp3'||!Number.isSafeInteger(sampleRate)||sampleRate<8000||sampleRate>INSPECTION_LIMITS.maxSampleRate||!Number.isSafeInteger(channels)||channels<1||channels>2)fail('excerpt_audio_unsupported','Use an inspected mono or stereo master with supported native audio properties.');
 if(!Number.isSafeInteger(range.startMs)||!Number.isSafeInteger(range.endMs)||range.startMs<0||range.endMs>inspection.durationSeconds*1000||range.endMs-range.startMs<4000||range.endMs-range.startMs>300000)fail('excerpt_range_invalid','Select an exact 4–300 second range within the original master; short ranges are never extended or padded.');
 // Positive half-sample ties round forward. All products remain safe integers
 // under the inspected limits, so error is derived before floating division.
 const startSample=Math.round(range.startMs*sampleRate/1000),endSample=Math.round(range.endMs*sampleRate/1000),sampleCount=endSample-startSample;
 const quantization={method:'nearest-native-sample',tieBreak:'forward',startErrorSamples:(startSample*1000-range.startMs*sampleRate)/1000,endErrorSamples:(endSample*1000-range.endMs*sampleRate)/1000,maxBoundaryErrorSamples:0.5,maxBoundaryErrorMs:1000/sampleRate/2};
 if(sampleCount<4*sampleRate||sampleCount>300*sampleRate||Math.abs(quantization.startErrorSamples)>0.5||Math.abs(quantization.endErrorSamples)>0.5)fail('excerpt_range_invalid','The actual quantized native sample range must remain 4–300 seconds.');
 const actualRange={startMs:startSample*1000/sampleRate,endMs:endSample*1000/sampleRate},estimatedBytes=sampleCount*channels*nativeCodecs[codec]+4096;
 if(estimatedBytes>15000000)fail('excerpt_too_large','Exact native PCM derivative exceeds the conservative 15,000,000 byte model input limit. Select a shorter exact range; no lossy substitution was made.');
 return {version:'director-original-audio-excerpt-v1',projectId:project.id,master:{...master},range:{...range},actualRange,quantization,mime:'audio/wav',codec,sampleRate,channels,startSample,endSample,sampleCount,durationSeconds:sampleCount/sampleRate,estimatedMaxBytes:estimatedBytes,maxBytes:15000000,audioPolicy:'native-decoded-original-samples-no-retiming',assetPublished:false};
}

/** Local portable worker; returns private derivative bytes, leaving publication to its caller. */
export async function renderAudioExcerpt({project,master,assets,inspection,range,assetDir,signal}){
 const descriptor=prepareAudioExcerpt({project,master,assets,inspection,range});
 const cancelled=()=>{if(signal?.aborted)fail('excerpt_cancelled','Audio excerpt rendering was cancelled.');};cancelled();
 if(typeof assetDir!=='string')fail('excerpt_source_invalid','Private source storage is unavailable.');
 const sourcePath=resolve(assetDir,master.assetId),asset=assets.find(a=>a.id===master.assetId);
 const measured=await inspectLocalSource({root:assetDir,path:sourcePath,source:{mime:asset.mime,size:asset.size,sha256:master.checksum}});cancelled();
 const audio=measured.streams[0];
 if(audio.codec!==inspection.streams[0].codec||audio.sampleRate!==descriptor.sampleRate||audio.channels!==descriptor.channels||Math.abs(measured.durationSeconds-inspection.durationSeconds)>1/descriptor.sampleRate)fail('excerpt_inspection_changed','Original master inspection properties changed.');
 const temp=await mkdtemp(join(tmpdir(),'director-audio-excerpt-')),output=join(temp,'excerpt.wav');
 async function command(bin,args){cancelled();try{return await execute(bin,args,{timeout:120000,maxBuffer:1024*1024,killSignal:'SIGKILL',windowsHide:true,signal,env:{PATH:process.env.PATH,LANG:'C',LC_ALL:'C'}});}catch{cancelled();fail('excerpt_decode_failed','Bounded excerpt decoding failed; the original master remains unchanged.');}}
 try{
  await command('ffmpeg',['-v','error','-nostdin','-y','-xerror','-err_detect','explode','-threads','1','-protocol_whitelist','file,pipe','-format_whitelist',asset.mime==='audio/wav'?'wav':'mp3','-i',sourcePath,'-map','0:a:0','-vn','-sn','-dn','-af',`atrim=start_sample=${descriptor.startSample}:end_sample=${descriptor.endSample},asetpts=PTS-STARTPTS`,'-c:a',descriptor.codec,'-map_metadata','-1','-threads','1','-f','wav',output]);
  await chmod(output,0o600);const stat=await lstat(output);if(stat.size>descriptor.maxBytes||stat.size>descriptor.estimatedMaxBytes)fail('excerpt_too_large','Exact PCM derivative exceeds the 15,000,000 byte model input limit.');
  const {stdout}=await command('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','wav','-show_format','-show_streams','-of','json',output]);let probe;try{probe=JSON.parse(stdout);}catch{fail('excerpt_validation_failed','Excerpt output metadata is invalid.');}
  const stream=probe.streams?.[0];
  if(probe.streams?.length!==1||stream.codec_type!=='audio'||stream.codec_name!==descriptor.codec||Number(stream.sample_rate)!==descriptor.sampleRate||stream.channels!==descriptor.channels||stream.time_base!==`1/${descriptor.sampleRate}`||Number(stream.duration_ts)!==descriptor.sampleCount||!Number.isFinite(Number(probe.format?.duration))||Math.abs(Number(probe.format.duration)-descriptor.durationSeconds)>1/descriptor.sampleRate)fail('excerpt_validation_failed','Excerpt output failed native sample, duration or stream validation; no padding is allowed.');
  await command('ffmpeg',['-v','error','-nostdin','-xerror','-protocol_whitelist','file,pipe','-format_whitelist','wav','-i',output,'-map','0:a:0','-f','null','-']);
  const bytes=await readFile(output);if(digest(await readFile(sourcePath))!==master.checksum)fail('excerpt_source_changed','Original master changed during excerpt rendering.');cancelled();
  return {bytes,descriptor:{...descriptor,size:bytes.length,sha256:digest(bytes),checksumAlgorithm:'sha256-bytes',masterBytesUnchanged:true,technicalValidation:'passed',timeBase:stream.time_base}};
 }finally{await rm(temp,{recursive:true,force:true});}
}

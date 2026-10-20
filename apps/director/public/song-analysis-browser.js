import {analyzeSongChannels,readSongAnalysisBytes,verifySongAnalysisBytes,SONG_ANALYSIS_LIMITS} from './song-analysis-core.js';
let remembered=null;
export function rememberSongAnalysis(asset,result){remembered={id:asset.id,version:asset.version,checksum:asset.checksum,result};}
export function rememberedSongAnalysis(asset){return asset&&remembered?.id===asset.id&&remembered.version===asset.version&&remembered.checksum===asset.checksum?remembered.result:null;}
export async function analyzeOriginalSong({asset,durationMs,signal,fetcher=fetch,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext}){
 if(!Number.isSafeInteger(durationMs)||durationMs<1000||durationMs>SONG_ANALYSIS_LIMITS.maxDurationSeconds*1000)throw Error('Browser analysis supports complete songs up to five minutes. Your source and plan are unchanged.');
 if(!Number.isSafeInteger(asset?.size)||asset.size<1||asset.size>SONG_ANALYSIS_LIMITS.maxBytes)throw Error('Browser analysis supports source files up to 12 MiB.');
 if(!AudioContextClass)throw Error('Audio analysis is unavailable in this browser. You can still review and plan the song.');
 let bytes;
 if(asset.blob instanceof Blob){if(asset.blob.size!==asset.size)throw Error('Source length differs from the selected file.');bytes=new Uint8Array(await asset.blob.arrayBuffer());}
 else if(asset.bucket==='director-source-media'){
  const expected=`/api/projects/${encodeURIComponent(asset.projectId)}/assets/${encodeURIComponent(asset.id)}/content`;if(asset.url!==expected)throw Error('Reopen the exact private original before analysis.');
  bytes=new Uint8Array(asset.size);const chunkSize=2*1024*1024,url=expected.replace(/\/content$/,'/analysis-content');
  for(let start=0;start<asset.size;start+=chunkSize){if(signal?.aborted)throw Error('Song analysis cancelled.');const end=Math.min(asset.size-1,start+chunkSize-1),response=await fetcher(url,{signal,cache:'no-store',credentials:'same-origin',headers:{Range:`bytes=${start}-${end}`}});if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${asset.size}`)throw Error('Private original source range changed or is unavailable.');bytes.set(await readSongAnalysisBytes(response,end-start+1,{signal,allowPartial:true}),start);}
 }
 else{const response=await fetcher(asset.url,{signal,cache:'no-store',credentials:'same-origin'});bytes=await readSongAnalysisBytes(response,asset.size,{signal});}
 await verifySongAnalysisBytes(bytes,asset);if(signal?.aborted)throw Error('Song analysis cancelled.');
 const context=new AudioContextClass({sampleRate:SONG_ANALYSIS_LIMITS.decodeSampleRate});
 try{const decoded=await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(signal?.aborted)throw Error('Song analysis cancelled.');const result=analyzeSongChannels({channels:Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),sampleRate:decoded.sampleRate});if(Math.abs(result.durationMs-durationMs)>250)throw Error('Decoded timing differs from the selected song. Review the source before applying suggestions.');return result;}
 finally{await context.close().catch(()=>{});}
}

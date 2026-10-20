// Deterministic signal features. No lyric, language, genre, emotion or vocal
// inference. Energy boundaries/tempo are suggestions, never musical ground truth.
export const SONG_ANALYSIS_VERSION='director-browser-audio-features-v2';
export const SONG_ANALYSIS_LIMITS=Object.freeze({maxBytes:12*1024*1024,maxDurationSeconds:300,decodeSampleRate:16000});
const reject=message=>{throw Error(message);};
const db=value=>Math.max(-120,20*Math.log10(Math.max(value,1e-6)));
export function analyzeSongChannels({channels,sampleRate}){
 if(!Array.isArray(channels)||channels.length<1||channels.length>2||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000||!channels.every(c=>c instanceof Float32Array&&c.length===channels[0].length)||!channels[0].length)reject('Choose readable mono or stereo audio.');
 const count=channels[0].length,duration=count/sampleRate;if(duration<1||duration>SONG_ANALYSIS_LIMITS.maxDurationSeconds)reject('Browser analysis supports complete songs from one second to five minutes. Your song and existing plan are unchanged.');
 const step=Math.round(sampleRate/100),energy=[];let sum=0,peak=0,nearFullScale=0;
 for(let start=0;start<count;start+=step){let squares=0;const end=Math.min(count,start+step);for(const channel of channels)for(let i=start;i<end;i++){const value=channel[i];if(!Number.isFinite(value))reject('Decoded audio contains invalid sample levels.');const a=Math.abs(value);squares+=value*value;peak=Math.max(peak,a);if(a>=0.999)nearFullScale++;}sum+=squares;energy.push(Math.sqrt(squares/((end-start)*channels.length)));}
 const durationMs=Math.round(duration*1000),rms=Math.sqrt(sum/(count*channels.length)),silent=peak<1e-6;
 const framesPerSecond=Math.round(sampleRate/step),envelope=[];for(let i=0;i<energy.length;i+=framesPerSecond){const items=energy.slice(i,i+framesPerSecond),start=i*step,end=Math.min(count,(i+items.length)*step),squares=items.reduce((n,v,j)=>n+v*v*(Math.min(count,(i+j+1)*step)-(i+j)*step),0);envelope.push({startMs:Math.round(start/sampleRate*1000),endMs:Math.round(end/sampleRate*1000),rmsDbFS:db(Math.sqrt(squares/(end-start)))});}
 const waveform=[];for(let b=0;b<Math.min(128,count);b++){const start=Math.floor(b*count/Math.min(128,count)),end=Math.floor((b+1)*count/Math.min(128,count));let min=Infinity,max=-Infinity;for(const channel of channels)for(let i=start;i<end;i++){min=Math.min(min,channel[i]);max=Math.max(max,channel[i]);}waveform.push({startMs:Math.round(start/sampleRate*1000),endMs:Math.round(end/sampleRate*1000),min:Number(min.toFixed(5)),max:Number(max.toFixed(5))});}
 const changes=envelope.slice(1).map((v,i)=>({time:v.startMs,score:Math.abs(v.rmsDbFS-envelope[i].rmsDbFS)})).filter(v=>v.score>=5&&v.time>=8000&&durationMs-v.time>=8000).sort((a,b)=>b.score-a.score),boundaries=[0,durationMs];
 for(const change of changes){if(boundaries.length>=13)break;if(boundaries.every(t=>Math.abs(change.time-t)>=8000))boundaries.push(change.time);}
 boundaries.sort((a,b)=>a-b);
 const sections=boundaries.slice(0,-1).map((startMs,i)=>({id:'energy-'+(i+1),label:boundaries.length===2?'Complete song — energy review':'Energy section '+(i+1),startMs,endMs:boundaries[i+1],timingBasis:'provisional'}));
 const onset=energy.map((v,i)=>i?Math.max(0,v-energy[i-1]):0),candidates=[],events=[];
 const threshold=Math.max(0.002,onset.reduce((n,v)=>n+v,0)/onset.length*3);let last=-Infinity;
 for(let i=1;i<onset.length-1;i++){const timeMs=Math.round(i*step/sampleRate*1000);if(onset[i]>=threshold&&onset[i]>=onset[i-1]&&onset[i]>onset[i+1]&&timeMs-last>=80){events.push({timeMs,strength:Number(onset[i].toFixed(5)),uncertaintyMs:Math.ceil(step/sampleRate*1000)});last=timeMs;}}
 if(!silent&&duration>=8){for(let lag=Math.ceil(60*sampleRate/(step*200));lag<=Math.floor(60*sampleRate/(step*60));lag++){let dot=0,left=0,right=0;for(let i=lag;i<onset.length;i++){dot+=onset[i]*onset[i-lag];left+=onset[i]*onset[i];right+=onset[i-lag]*onset[i-lag];}const score=left&&right?dot/Math.sqrt(left*right):0;if(score>0.4)candidates.push({bpm:Math.round(60*sampleRate/(step*lag)),score});}candidates.sort((a,b)=>b.score-a.score||b.bpm-a.bpm);}
 const onsets=events.sort((a,b)=>b.strength-a.strength||a.timeMs-b.timeMs).slice(0,200).sort((a,b)=>a.timeMs-b.timeMs);
 return {version:SONG_ANALYSIS_VERSION,provenance:'browser_decoded',durationMs,audioProperties:{analysisSampleRate:sampleRate,decodedChannels:channels.length,decodedSampleCount:count},rmsDbFS:db(rms),peakAmplitude:peak,nearFullScaleSampleFraction:nearFullScale/(count*channels.length),silent,waveform,envelope,onsets,onsetEvidence:{method:'positive-rms-change',totalDetected:events.length,retained:onsets.length,selection:'strongest-200',beatGridVerified:false},sections,tempo:{bpm:candidates[0]?.bpm??null,confidence:candidates.length?'low':'unknown',reviewRequired:true,ambiguity:'Half-time and double-time are possible. This is not a verified beat grid.'},unknown:['lyrics','language','vocals','verse_chorus_labels','emotion','stems','lip_sync']};
}

export async function readSongAnalysisBytes(response,expectedSize,{signal,allowPartial=false}={}){
 if(!Number.isSafeInteger(expectedSize)||expectedSize<1||expectedSize>SONG_ANALYSIS_LIMITS.maxBytes)reject('Browser analysis supports source files up to 12 MiB.');
 if(!(response.status===200||allowPartial===true&&response.status===206)||!response.body){await response.body?.cancel().catch(()=>{});reject('The original song could not be read.');}
 const chunks=[];let length=0;const reader=response.body.getReader();
 try{while(true){if(signal?.aborted)reject('Song analysis cancelled.');const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>expectedSize||length>SONG_ANALYSIS_LIMITS.maxBytes)reject('Source length differs from the selected file.');chunks.push(value);}if(length!==expectedSize)reject('The original song download was incomplete.');}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function verifySongAnalysisBytes(bytes,asset,cryptoProvider=globalThis.crypto){
 if(!cryptoProvider?.subtle||!/^[a-f0-9]{64}$/.test(asset.checksum||''))reject('The original song identity could not be checked.');
 let input=bytes;
 if(asset.checksumAlgorithm!=='sha256-bytes'){
  if(asset.checksumAlgorithm!==undefined)reject('Unsupported original-song checksum.');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));input=new TextEncoder().encode(JSON.stringify(btoa(binary)));
 }
 const digest=new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',input)),actual=[...digest].map(v=>v.toString(16).padStart(2,'0')).join('');if(actual!==asset.checksum)reject('Source bytes differ from the selected song. No analysis was applied.');
}

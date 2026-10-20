import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectLocalSource} from '../workers/source-inspection.mjs';
import {runSourceInspectionJob} from '../source-inspection-jobs.mjs';
import {storedSongSignal,recordInspectedSongSignal} from '../song-signal.mjs';
import {analyzeOriginalSong} from '../public/song-analysis-browser.js';
import {analyzeSongChannels} from '../public/song-analysis-core.js';
import {normalizeSongIntelligence,newSongIntelligence} from '../public/song-intelligence-core.js';
import {SupabaseStore} from '../store.mjs';
import {songProviderFixture,songSession} from './song-provider-fixture-server.mjs';
import {call} from './animatic-fixture-server.mjs';
const exec=promisify(execFile),digest=b=>createHash('sha256').update(b).digest('hex');
const signal=()=>({...analyzeSongChannels({channels:[new Float32Array(8000*3)],sampleRate:8000}),version:'director-ffmpeg-audio-features-v1',provenance:'worker_decoded'});
const report=(source,analysis)=>({inspectionVersion:'director-source-inspection-v1',status:'passed',size:source.size,sha256:source.sha256,checksumAlgorithm:'sha256-bytes',mime:source.mime,durationSeconds:analysis.durationMs/1000,streams:[{type:'audio',codec:'pcm_s16le',sampleRate:48000,channels:2}],decodeVerified:true,assetPublished:false,songAnalysis:analysis});

test('actual 180-second stereo 48k WAV over 12 MiB yields bounded full-song worker measurements without changing the master',async()=>{
 const root=await mkdtemp(join(tmpdir(),'director-song-signal-'));
 try{
  const path=join(root,'master.wav');await exec('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=180','-ac','2','-c:a','pcm_s16le',path],{timeout:30000});
  const before=await stat(path),bytes=await readFile(path),source={mime:'audio/wav',size:bytes.length,sha256:digest(bytes)};assert.ok(source.size>12*1024*1024);
  const r=await inspectLocalSource({root,path,source,songAnalysis:true}),f=r.songAnalysis;
  assert.equal(r.durationSeconds,180);assert.equal(r.streams[0].sampleRate,48000);assert.equal(f.durationMs,180000);assert.equal(f.audioProperties.analysisSampleRate,16000);assert.equal(f.audioProperties.decodedChannels,2);assert.equal(f.waveform.length,128);assert.equal(f.envelope.length,180);assert.equal(f.tempo.reviewRequired,true);assert.equal(f.onsetEvidence.beatGridVerified,false);assert.ok(f.sections.every(s=>s.timingBasis==='provisional'));assert.equal(f.provenance,'worker_decoded');
  const master={assetId:randomUUID(),assetVersion:1,checksum:source.sha256,durationMs:180000,timingBasis:'user_reviewed'};assert.equal(normalizeSongIntelligence(newSongIntelligence(master,f)).technical.version,'director-ffmpeg-audio-features-v1');
  assert.equal(digest(await readFile(path)),source.sha256);assert.equal((await stat(path)).mtimeMs,before.mtimeMs);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('existing inspection coordinator saves only validated signal before source publication, with no paid replay on persistence failure',async()=>{
 const uploadId=randomUUID(),ownerId=randomUUID(),projectId=randomUUID(),source={mime:'audio/wav',size:14*1024*1024,sha256:'a'.repeat(64)},r=report(source,signal());let runs=0;
 const claim={uploadId,ownerId,projectId,source:{id:uploadId,ownerId,projectId,manifest:source,bucket:'director-source-media',storageKey:`${ownerId}/${projectId}/${uploadId}`,status:'inspection_pending'}},events=[],order=[];
 const store={claimSourceInspection:async()=>claim,addAudit:async(p,o,type,details)=>{assert.equal(p,projectId);assert.equal(o,ownerId);order.push('signal');events.push({type,details});},finishSourceInspection:async(id,token,s,result)=>{order.push(result.status);return {status:result.status};},publishSourceUpload:async()=>{order.push('publish');return {id:uploadId};},records:async()=>events};
 const result=await runSourceInspectionJob({store,uploadId,enabled:true,publish:true,execute:async()=>{runs++;return {...r,arbitrary:'discard',songAnalysis:{...r.songAnalysis,observations:['invented mood']}};}});
 assert.equal(result.songFeaturesSaved,true);assert.deepEqual(order,['signal','passed','publish']);assert.equal(events[0].details.observations,undefined);assert.equal(events[0].details.technical.observations,undefined);
 const asset={id:uploadId,projectId,sourceUploadId:uploadId,bucket:'director-source-media',decodeVerified:true,inspectionVersion:r.inspectionVersion,checksumAlgorithm:'sha256-bytes',checksum:source.sha256,role:'master_song',version:1,durationSeconds:3};assert.equal((await storedSongSignal(store,{id:projectId},asset)).durationMs,3000);
 await assert.rejects(()=>storedSongSignal(store,{id:projectId},{...asset,checksum:'b'.repeat(64)}),e=>e.status===409);
 await assert.rejects(()=>recordInspectedSongSignal({store,claim,source,report:{...r,inspectionVersion:'unknown'}}),e=>e.status===422);
 store.addAudit=async()=>{throw Error('Storage unavailable');};await assert.rejects(()=>runSourceInspectionJob({store,uploadId,enabled:true,publish:true,execute:async()=>{runs++;return r;}}),e=>e.status===503);assert.equal(runs,2);assert.equal(order.at(-1),'held');assert.equal(order.filter(s=>s==='publish').length,1);
});

test('owned saved-feature API and browser path use exact source binding without fetching or decoding the large master again',async()=>{
 const f=await songProviderFixture(),analysis=signal();f.asset.size=14*1024*1024;
 const source={mime:f.asset.mime,size:f.asset.size,sha256:f.asset.checksum};await recordInspectedSongSignal({store:f.store,claim:{uploadId:f.asset.id,projectId:f.project.id,ownerId:f.project.ownerId},source,report:report(source,analysis)});
 const asset={...f.asset,url:f.base+'/assets/'+f.asset.id+'/content'},path='/assets/'+f.asset.id+'/song-analysis',owned=await f.get(path);assert.equal(owned.status,200);assert.equal(owned.data.source.checksum,asset.checksum);
 const foreign=await call(f.handler,f.base+path,undefined,'foreign-fixture-session');assert.equal(foreign.status,404);
 let reads=0;const measured=await analyzeOriginalSong({asset,durationMs:3000,AudioContextClass:null,fetcher:async(url,opts)=>{reads++;assert.equal(url,f.base+path);assert.equal(opts.credentials,'same-origin');return Response.json(owned.data);}});assert.equal(measured.provenance,'worker_decoded');assert.equal(reads,1);assert.equal(f.counters.submits,0);
 await assert.rejects(()=>analyzeOriginalSong({asset,durationMs:3000,AudioContextClass:null,fetcher:async()=>Response.json({...owned.data,source:{...owned.data.source,checksum:'b'.repeat(64)}})}),/differ/);
 await assert.rejects(()=>analyzeOriginalSong({asset:{...asset,bucket:'director-media'},durationMs:3000,AudioContextClass:null,fetcher:async()=>{throw Error('must not fetch');}}),/Larger originals/);
 const absent=await f.get('/assets/'+randomUUID()+'/song-analysis');assert.equal(absent.status,404);
});

test('cloud saved-feature read filters one exact event before pagination instead of scanning unrelated audit history',async()=>{
 const calls=[],store=new SupabaseStore({url:'https://fixture.supabase.co',key:'fixture',fetcher:async(url)=>{calls.push(url);return {ok:true,json:async()=>[]};}});await store.readInspectedSongSignal(randomUUID(),randomUUID(),'a'.repeat(64));assert.match(calls[0],/event_type=eq.song_signal_measured/);assert.match(calls[0],/sourceChecksum=eq.a{64}/);assert.match(calls[0],/order=created_at.desc,id.desc&limit=1/);
});

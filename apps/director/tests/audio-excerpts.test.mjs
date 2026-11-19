import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {SOURCE_INSPECTION_VERSION} from '../workers/source-inspection.mjs';
import * as excerpts from '../audio-excerpts.mjs';
const run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const project={id:'owned',format:'music_video'},asset={id:randomUUID(),projectId:'owned',version:2,role:'master_song',mime:'audio/wav',checksum:'a'.repeat(64),checksumAlgorithm:'sha256-bytes',size:2880078};
 return {project,master:{assetId:asset.id,assetVersion:2,checksum:asset.checksum},assets:[asset],inspection:{inspectionVersion:SOURCE_INSPECTION_VERSION,status:'passed',decodeVerified:true,checksumAlgorithm:'sha256-bytes',sha256:asset.checksum,mime:asset.mime,size:asset.size,durationSeconds:180,streams:[{type:'audio',codec:'pcm_s16le',sampleRate:8000,channels:1}]},range:{startMs:59875,endMs:63875}};
}
test('audio excerpt descriptor pins the owned inspected source and exact native sample interval',()=>{
 assert.equal(typeof excerpts.prepareAudioExcerpt,'function');
 const args=fixture(),d=excerpts.prepareAudioExcerpt(args);assert.equal(d.startSample,479000);assert.equal(d.endSample,511000);assert.equal(d.sampleCount,32000);assert.equal(d.codec,'pcm_s16le');assert.equal(d.durationSeconds,4);assert.deepEqual(d.master,args.master);
 for(const mutate of [a=>a.assets[0].projectId='foreign',a=>a.master.assetVersion=1,a=>a.inspection.sha256='b'.repeat(64),a=>a.range.endMs=63874,a=>a.range.endMs=180001,a=>a.inspection.decodeVerified=false,a=>a.inspection.streams[0].codec='constructor']){const bad=structuredClone(args);mutate(bad);assert.throws(()=>excerpts.prepareAudioExcerpt(bad));}
 const large=fixture();large.inspection.streams[0]={type:'audio',codec:'pcm_s24le',sampleRate:192000,channels:2};large.range={startMs:0,endMs:20000};assert.throws(()=>excerpts.prepareAudioExcerpt(large),/15,000,000/);
 const fractional=fixture();fractional.inspection.streams[0].sampleRate=44100;fractional.range={startMs:1,endMs:4001};const quantized=excerpts.prepareAudioExcerpt(fractional);assert.equal(quantized.startSample,44);assert.equal(quantized.endSample,176444);assert.deepEqual(quantized.range,{startMs:1,endMs:4001});assert.equal(quantized.durationSeconds,4);assert.ok(Math.abs(quantized.quantization.startErrorSamples)<=0.5);assert.ok(Math.abs(quantized.quantization.endErrorSamples)<=0.5);
});
test('local excerpt is sample-exact to a 180-second master, hash-pinned and never padded or published',async()=>{
 const root=await mkdtemp(join(tmpdir(),'director-excerpt-test-')),args=fixture(),asset=args.assets[0],path=join(root,asset.id);
 try{
  assert.equal(typeof excerpts.renderAudioExcerpt,'function');
  await run('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','aevalsrc=0.2*sin(2*PI*if(lt(t\\,60)\\,220\\,440)*t):s=8000:d=180','-c:a','pcm_s16le','-f','wav',path]);
  const original=await readFile(path);asset.size=original.length;asset.checksum=hash(original);args.master.checksum=asset.checksum;Object.assign(args.inspection,{sha256:asset.checksum,size:asset.size});
  const result=await excerpts.renderAudioExcerpt({...args,assetDir:root});
  assert.equal(result.descriptor.durationSeconds,4);assert.equal(result.descriptor.sampleCount,32000);assert.equal(result.descriptor.sha256,hash(result.bytes));assert.equal(result.descriptor.masterBytesUnchanged,true);assert.equal(result.descriptor.assetPublished,false);assert.ok(result.bytes.length<=15000000);
  const output=join(root,'excerpt.wav');await writeFile(output,result.bytes);
  const decode=async input=>(await run('ffmpeg',['-v','error','-i',input,'-map','0:a:0','-c:a','pcm_s16le','-f','s16le','pipe:1'],{encoding:'buffer',maxBuffer:3000000})).stdout;
  const whole=await decode(path),cut=await decode(output);assert.equal(cut.length,64000);assert.deepEqual(cut,whole.subarray(479000*2,511000*2));assert.equal(hash(await readFile(path)),asset.checksum);
  const link=randomUUID();await symlink(path,join(root,link));const unsafe=structuredClone(args);unsafe.master.assetId=link;unsafe.assets[0].id=link;await assert.rejects(()=>excerpts.renderAudioExcerpt({...unsafe,assetDir:root}),/regular|isolated|path/);
  const controller=new AbortController();controller.abort();await assert.rejects(()=>excerpts.renderAudioExcerpt({...args,assetDir:root,signal:controller.signal}),/cancelled/);
  await writeFile(path,Buffer.from('changed'));await assert.rejects(()=>excerpts.renderAudioExcerpt({...args,assetDir:root}),/length|checksum|source/i);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('stereo floating-point master keeps native precision, channels and sample rate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'director-excerpt-float-')),args=fixture(),asset=args.assets[0],path=join(root,asset.id);
 try{
  await run('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','aevalsrc=0.1234567*sin(2*PI*220*t)|0.2345678*sin(2*PI*440*t):s=16000:d=6','-c:a','pcm_f32le','-f','wav',path]);
  const bytes=await readFile(path);asset.size=bytes.length;asset.checksum=hash(bytes);args.master.checksum=asset.checksum;args.range={startMs:1000,endMs:5000};Object.assign(args.inspection,{sha256:asset.checksum,size:asset.size,durationSeconds:6,streams:[{type:'audio',codec:'pcm_f32le',sampleRate:16000,channels:2}]});
  const result=await excerpts.renderAudioExcerpt({...args,assetDir:root});assert.equal(result.descriptor.codec,'pcm_f32le');assert.equal(result.descriptor.channels,2);assert.equal(result.descriptor.sampleRate,16000);assert.equal(result.descriptor.sampleCount,64000);
  const output=join(root,'float.wav');await writeFile(output,result.bytes);
  const decode=async input=>(await run('ffmpeg',['-v','error','-i',input,'-c:a','pcm_f32le','-f','f32le','pipe:1'],{encoding:'buffer',maxBuffer:1000000})).stdout;
  assert.deepEqual(await decode(output),(await decode(path)).subarray(16000*2*4,80000*2*4));assert.equal(hash(await readFile(path)),asset.checksum);
 }finally{await rm(root,{recursive:true,force:true});}
});


test('44.1kHz millisecond boundaries explicitly quantize to nearest native samples',async()=>{
 const root=await mkdtemp(join(tmpdir(),'director-excerpt-quantized-')),args=fixture(),asset=args.assets[0],path=join(root,asset.id);
 try{
  await run('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=6','-c:a','pcm_s16le','-f','wav',path]);
  const bytes=await readFile(path);asset.size=bytes.length;asset.checksum=hash(bytes);args.master.checksum=asset.checksum;args.range={startMs:1001,endMs:5002};Object.assign(args.inspection,{sha256:asset.checksum,size:asset.size,durationSeconds:6,streams:[{type:'audio',codec:'pcm_s16le',sampleRate:44100,channels:1}]});
  const result=await excerpts.renderAudioExcerpt({...args,assetDir:root}),d=result.descriptor;
  assert.deepEqual(d.range,{startMs:1001,endMs:5002});assert.equal(d.startSample,44144);assert.equal(d.endSample,220588);assert.equal(d.sampleCount,176444);assert.equal(d.durationSeconds,176444/44100);
  assert.deepEqual(d.actualRange,{startMs:44144*1000/44100,endMs:220588*1000/44100});assert.equal(d.quantization.method,'nearest-native-sample');assert.equal(d.quantization.maxBoundaryErrorSamples,0.5);
  assert.ok(Math.abs(d.quantization.startErrorSamples+0.1)<1e-9);assert.ok(Math.abs(d.quantization.endErrorSamples+0.2)<1e-9);assert.ok(d.quantization.maxBoundaryErrorMs<=1000/44100/2);
  const output=join(root,'quantized.wav');await writeFile(output,result.bytes);
  const decode=async input=>(await run('ffmpeg',['-v','error','-i',input,'-c:a','pcm_s16le','-f','s16le','pipe:1'],{encoding:'buffer',maxBuffer:1000000})).stdout;
  assert.deepEqual(await decode(output),(await decode(path)).subarray(44144*2,220588*2));assert.equal(hash(await readFile(path)),asset.checksum);
 }finally{await rm(root,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {prepareSongRender,renderSongTimeline} from '../song-render.mjs';

const run=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(seconds=180){
 const masterId=randomUUID(),imageId=randomUUID(),clipId=randomUUID(),checksum='a'.repeat(64),project={id:'owned-project',format:'music_video',duration:seconds};
 const assets=[{id:masterId,version:1,projectId:project.id,mime:'audio/wav',role:'master_song',checksum,checksumAlgorithm:'sha256-bytes'},{id:imageId,version:1,projectId:project.id,mime:'image/png'},{id:clipId,version:1,projectId:project.id,mime:'video/mp4'}];
 const third=seconds*1000/3;
 const songPlan={kind:'music_video_plan_v1',master:{assetId:masterId,assetVersion:1,checksum,durationMs:seconds*1000,timingBasis:'user_reviewed'},range:{startMs:0,endMs:seconds*1000},fps:24,sections:[{id:'whole-song',label:'User-reviewed complete song',startMs:0,endMs:seconds*1000,timingBasis:'user_reviewed'}],shots:[0,1,2].map(i=>({shotId:'shot-'+i,shotVersion:1,contractVersion:null,startMs:i*third,endMs:(i+1)*third,role:'broll',syncClass:'no_sync',performers:[],timingBasis:'user_reviewed'}))};
 const selections=songPlan.shots.map((s,i)=>({shotId:s.shotId,assetId:i===2?clipId:imageId,assetVersion:1,sourceInMs:i===2?1000:0}));
 return {project,assets,songPlan,selections,output:{width:320,height:180}};
}
const clone=structuredClone;
test('supplied song assembly requires exact complete coverage and rejects gaps, repeats and hidden retiming',()=>{
 const args=fixture(),plan=prepareSongRender(args);assert.equal(plan.totalFrames,4320);assert.equal(plan.clips[2].sourceInMs,1000);assert.equal(plan.audioPolicy,'original-master-content-no-time-stretch');
 const gap=clone(args);gap.songPlan.shots[1].startMs++;assert.throws(()=>prepareSongRender(gap),/gaps/);
 const missing=clone(args);missing.selections.pop();assert.throws(()=>prepareSongRender(missing),/every planned shot/);
 const repeated=clone(args);repeated.selections[1].shotId=repeated.selections[0].shotId;assert.throws(()=>prepareSongRender(repeated),/repeats/);
 const retimed=clone(args);retimed.selections[2].speed=0.5;assert.throws(()=>prepareSongRender(retimed),/Unsupported/);
 const shortened=clone(args);shortened.project.duration=60;assert.throws(()=>prepareSongRender(shortened),/runtime/);
 const absentDuration=clone(args);delete absentDuration.project.duration;assert.throws(()=>prepareSongRender(absentDuration),/runtime/);
 const portrait=clone(args);portrait.project.ratio='9:16';portrait.output={width:180,height:320};assert.equal(prepareSongRender(portrait).width,180);portrait.output={width:320,height:180};assert.throws(()=>prepareSongRender(portrait),/aspect ratio/);
});
test('source preflight rejects foreign ownership, changed pins, invalid dimensions and unsupported still trims',()=>{
 const args=fixture();for(const [mutate,message] of [[a=>a.assets[0].projectId='foreign',/master/],[a=>a.assets[1].projectId='foreign',/owned image/],[a=>a.selections[0].assetVersion=2,/owned image/],[a=>a.songPlan.master.checksum='b'.repeat(64),/master/],[a=>a.selections[0].sourceInMs=1000,/still image/],[a=>a.output.width=321,/dimensions/]]){const bad=clone(args);mutate(bad);assert.throws(()=>prepareSongRender(bad),message);}
});
test('visible singing requires a source-video and exact reviewed master-to-source sync binding',()=>{
 const args=fixture();args.songPlan.shots[2].syncClass='sync_required';args.songPlan.shots[2].role='singing';
 assert.throws(()=>prepareSongRender(args),/missing/);
 const master=args.songPlan.master;args.selections[2].syncBinding={masterAssetId:master.assetId,masterAssetVersion:1,checksum:master.checksum,masterStartMs:120000,sourceStartMs:1000,reviewed:true};
 assert.equal(prepareSongRender(args).clips[2].syncBinding.masterStartMs,120000);
 const shifted=clone(args);shifted.selections[2].sourceInMs=2000;assert.throws(()=>prepareSongRender(shifted),/no retiming/);
 const still=clone(args);still.selections[2].assetId=still.assets[1].id;still.selections[2].sourceInMs=0;assert.throws(()=>prepareSongRender(still),/still image/);
});

test('real three-minute MP4 assembles supplied stills and trimmed footage with the unchanged master recording',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'director-song-render-test-')),args=fixture();
 try{
  const [master,image,clip]=args.assets;
  await run('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','aevalsrc=0.2*sin(2*PI*if(lt(t\\,60)\\,220\\,if(lt(t\\,120)\\,440\\,660))*t):s=8000:d=180','-c:a','pcm_s16le','-f','wav',join(dir,master.id)]);
  const bytes=await readFile(join(dir,master.id));master.size=bytes.length;master.checksum=hash(bytes);args.songPlan.master.checksum=master.checksum;
  await run('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','color=c=blue:s=160x90:r=24:d=1','-frames:v','1','-threads','1','-c:v','png','-f','image2',join(dir,image.id)]);
  await run('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i','color=c=green:s=160x90:r=24:d=62','-f','lavfi','-i','sine=frequency=1400:sample_rate=8000:duration=62','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-f','mp4',join(dir,clip.id)]);
  const result=await renderSongTimeline({...args,assetDir:dir});assert.ok(result.bytes.length>10000);assert.equal(result.manifest.totalFrames,4320);assert.equal(result.manifest.masterBytesUnchanged,true);assert.equal(result.manifest.technicalValidation,'passed');assert.equal(result.manifest.creativeReview,'unverified');assert.equal(result.manifest.output.audioChannels,1);assert.ok(Math.abs(result.manifest.output.durationSeconds-180)<=0.1);assert.equal(hash(await readFile(join(dir,master.id))),master.checksum);
  const final=join(dir,'finished.mp4');await writeFile(final,result.bytes);
  for(const [time,frequency] of [[20,220],[80,440],[140,660]]){
   const {stdout:pcm}=await run('ffmpeg',['-v','error','-ss',String(time),'-i',final,'-t','1','-vn','-ac','1','-ar','8000','-f','s16le','pipe:1'],{encoding:'buffer',maxBuffer:65536});let crossings=0;for(let i=1;i<pcm.length/2;i++)if(pcm.readInt16LE((i-1)*2)<=0&&pcm.readInt16LE(i*2)>0)crossings++;assert.ok(Math.abs(crossings-frequency)<5,`original ${frequency}Hz at ${time}s; observed ${crossings}, not generated clip sound`);
  }
  const unsafe=clone(args),foreign=randomUUID();await symlink(join(dir,master.id),join(dir,foreign));unsafe.assets[0].id=foreign;unsafe.songPlan.master.assetId=foreign;await assert.rejects(()=>renderSongTimeline({...unsafe,assetDir:dir}),/unsafe path/);
  const short=clone(args);short.selections[2].sourceInMs=3000;await assert.rejects(()=>renderSongTimeline({...short,assetDir:dir}),/too short/);
  const changed=clone(args);changed.assets[0].checksum='c'.repeat(64);changed.songPlan.master.checksum='c'.repeat(64);await assert.rejects(()=>renderSongTimeline({...changed,assetDir:dir}),/bytes do not match/);
  const controller=new AbortController();controller.abort();await assert.rejects(()=>renderSongTimeline({...args,assetDir:dir,signal:controller.signal}),/cancelled/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {newProject} from '../domain.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {musicTreatmentFixture} from './music-treatment-fixture-server.mjs';import {musicVideoEditingFixture} from './music-video-editing-fixture.mjs';import {call} from './animatic-fixture-server.mjs';import {songSession} from './song-provider-fixture-server.mjs';
test('new production API saves and approves a real-contract full-song timeline while hosted compute stays held',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),e=musicVideoEditingFixture();e.project={...newProject({format:'music_video'},f.project.ownerId),...e.project,ownerId:f.project.ownerId};await f.store.create(e.project);f.store.state.assets.push(...e.assets);f.store.state.approvals.push(...e.approvals);f.store.state.audit.push(...e.outcomes);const base='/api/projects/'+e.project.id;
 let r=await call(f.handler,base+'/music-video/timeline',e.body,songSession);assert.equal(r.status,200,JSON.stringify(r.data));const saved=r.data.project;
 r=await call(f.handler,base+'/music-video/timeline',undefined,songSession);assert.equal(r.data.timeline.readyForApproval,true);assert.equal(r.data.timeline.approved,false);assert.equal(r.data.songPlan.range.endMs,4000);assert.equal(r.data.renderConfigured,false);
 const timeline=r.data.timeline;assert.equal((await call(f.handler,base+'/approvals',{artifactId:'record:'+timeline.recordId,version:timeline.version,decision:'approved'},songSession)).status,201);
 assert.equal((await call(f.handler,base+'/music-video/timeline',undefined,songSession)).data.timeline.ready,true);
 assert.equal((await call(f.handler,base+'/music-video/render/quote',{expectedVersion:saved.version,timelineId:timeline.recordId},songSession)).status,503);
 const motion=await f.get('/music-video/motion');assert.equal(motion.status,200);assert.equal(typeof motion.data.generationAvailable,'boolean');assert.ok(motion.data.shots.every(s=>s.holds.length));assert.equal(f.store.state.jobs.length,0);
});
test('private finished-file playback requires its exact completed render and never accepts fabricated upload provenance',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),id=randomUUID(),asset={id,projectId:f.project.id,version:1,name:'Finished film',mime:'video/mp4',bucket:'director-source-media',storageKey:`${f.project.ownerId}/${f.project.id}/${id}`,checksum:'c'.repeat(64),checksumAlgorithm:'sha256-bytes',size:100,durationSeconds:180,decodeVerified:true,technicalValidation:'passed',generated:{kind:'finished_movie',renderId:id,masterChecksum:'a'.repeat(64)}};
 f.storage.sign=async(key,{bucket,download})=>{if(download)assert.equal(download,'music-video.mp4');return `https://song-fixture.supabase.co/storage/v1/object/sign/${bucket}/${key}?token=synthetic-no-network${download?'&download='+download:''}`;};
 await f.store.add('assets',asset);f.store.state.renderJobs=[{id,ownerId:f.project.ownerId,projectId:f.project.id,status:'completed',result:asset}];
 const playback=await f.get('/assets/'+id+'/content');assert.equal(playback.status,302,JSON.stringify(playback.data));assert.ok(playback.headers.Location.includes('director-source-media'));
 const download=await f.get('/assets/'+id+'/download');assert.equal(download.status,302);assert.ok(download.headers.Location.includes('download=music-video.mp4'));
 f.store.state.renderJobs[0].status='unknown';assert.equal((await f.get('/assets/'+id+'/content')).status,409);
});

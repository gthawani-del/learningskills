import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newProject} from '../domain.mjs';
import {MUSIC_VIDEO_KIND,saveMusicVideo,musicVideoContext,currentMusicVideo} from '../public/music-video-core.js';
import {applyProductionRecord} from '../public/production-records-core.js';
import {productionState} from '../production-state.mjs';
import {animaticContext,saveAnimatic} from '../public/animatic-core.js';
function setup(){
 const project={...newProject({title:'Original song',format:'music_video'},'owner'),shots:[{id:'singer',version:1,title:'Singer',description:'Sings',productionBindings:[]},{id:'insert',version:1,title:'Insert',description:'Landscape',productionBindings:[]}],production:{records:[]}};
 const audio={id:randomUUID(),projectId:project.id,version:1,mime:'audio/wav',role:'master_song',scope:'project',checksum:'a'.repeat(64)},other={...audio,id:randomUUID(),checksum:'b'.repeat(64)};
 const images=project.shots.map(()=>({id:randomUUID(),projectId:project.id,version:1,mime:'image/png'})),assets=[audio,other,...images];
 let p=applyProductionRecord(project,{expectedVersion:project.version,type:'character',name:'Artist',content:{description:'Original identity'}},assets);const character=p.production.records[0];
 const document={kind:MUSIC_VIDEO_KIND,master:{assetId:audio.id,assetVersion:1,checksum:audio.checksum,durationMs:3000,timingBasis:'user_reviewed'},range:{startMs:0,endMs:3000},fps:24,sections:[{id:'whole',label:'Complete song',startMs:0,endMs:3000,timingBasis:'user_reviewed'}],shots:p.shots.map((s,i)=>({shotId:s.id,shotVersion:1,contractVersion:null,startMs:i?1000:0,endMs:i?3000:1000,role:i?'broll':'singing',syncClass:i?'no_sync':'sync_required',performers:i?[]:[{recordId:character.id,version:1}],timingBasis:'user_reviewed'}))};
 p=saveMusicVideo(p,{expectedVersion:p.version,document,acknowledgePlanning:true},assets);p.storyboardHandoff={sequences:[{version:1,shots:p.shots.map(s=>({shotId:s.id}))}]};
 const frames={holds:[],shots:p.shots.map((s,i)=>({shotId:s.id,selectionApproved:true,selection:{version:1,specVersion:1,assetId:images[i].id,assetVersion:1},contract:{document:{durationSeconds:5}},output:{aspectRatio:'16:9'}}))};
 return {p,assets,audio,other,character,document,frames};
}
test('red team: a changed singer does not contaminate an unrelated B-roll shot with song review holds',()=>{
 const f=setup();f.p.storyboardHandoff=undefined;const p=applyProductionRecord(f.p,{expectedVersion:f.p.version,id:f.character.id,content:{description:'Changed identity'}},f.assets),state=productionState(p,f.assets,[]);
 assert(state.nodes.find(n=>n.id==='singer').holds.some(h=>/performer/.test(h)));
 assert(!state.nodes.find(n=>n.id==='insert').holds.some(h=>/song|performer|shot-specific/.test(h)));
});
test('red team: a subframe shot cannot be declared ready for a frame-based editor',()=>{
 const f=setup(),d=structuredClone(f.document);d.shots[0].endMs=1;d.shots[1].startMs=1;
 assert.throws(()=>saveMusicVideo(f.p,{expectedVersion:f.p.version,document:d,acknowledgePlanning:true},f.assets),/frame/i);
});
test('red team: missing dependency pins cannot pass singer readiness after generic record edits',()=>{
 const f=setup();currentMusicVideo(f.p).snapshot.dependencies=[];assert.equal(musicVideoContext(f.p,f.assets).readyForStoryboardReview,false);
});
test('red team: shared animatic uses song intervals rather than five-second contract estimates',()=>{
 const f=setup(),c=animaticContext(f.p,f.frames,f.assets);assert.deepEqual(c.sourceFrames.map(s=>s.frameCount),[24,48]);
});
test('red team: shared animatic rejects a different owned song and detached timing',()=>{
 const f=setup(),command={expectedVersion:f.p.version,fps:24,frameCounts:[24,48],acknowledgeTiming:true};
 assert.throws(()=>saveAnimatic(f.p,{...command,audio:{assetId:f.other.id,assetVersion:1},acknowledgeAudio:true},f.frames,f.assets),/song|master/i);
 assert.throws(()=>saveAnimatic(f.p,{...command,frameCounts:[48,24]},f.frames,f.assets),/song|timing/i);
});
test('red team: changing the song plan holds an existing saved preview until explicit refresh',()=>{
 const f=setup(),p=saveAnimatic(f.p,{expectedVersion:f.p.version,fps:24,frameCounts:[24,48],acknowledgeTiming:true},f.frames,f.assets),d=structuredClone(f.document);d.shots[0].endMs=1500;d.shots[1].startMs=1500;
 const next=saveMusicVideo(p,{expectedVersion:p.version,document:d,acknowledgePlanning:true},f.assets);assert.equal(animaticContext(next,f.frames,f.assets).canPlay,false);
});

test('red team: shared project settings must not silently ignore a format change',async()=>{
 const {patchProject}=await import('../domain.mjs');const p=newProject({title:'Format switch'},'owner');
 assert.equal(patchProject(p,{expectedVersion:p.version,format:'music_video'}).format,'music_video');
 assert.throws(()=>patchProject(p,{expectedVersion:p.version,format:'unrecognised'}));
});

test('red team: unchanged historical performer bindings remain explicit held drafts, never silently upgraded',()=>{
 const f=setup(),p=applyProductionRecord(f.p,{expectedVersion:f.p.version,id:f.character.id,content:{description:'Revised identity'}},f.assets),before=structuredClone(p);
 const next=saveMusicVideo(p,{expectedVersion:p.version,document:f.document,acknowledgePlanning:true},f.assets);assert.equal(currentMusicVideo(next).snapshot.content.shots[0].performers[0].version,1);assert(!musicVideoContext(next,f.assets).readyForStoryboardReview);assert.deepEqual(p,before);
});
test('red team: excerpt handoff conserves rounded frame totals at all supported frame rates',()=>{
 for(const fps of [24,25,30]){const f=setup(),d=structuredClone(f.document);d.fps=fps;d.range={startMs:1000,endMs:2500};d.sections=[{id:'excerpt',label:'Excerpt',startMs:1000,endMs:2500,timingBasis:'user_reviewed'}];Object.assign(d.shots[0],{startMs:1000,endMs:1750});Object.assign(d.shots[1],{startMs:1750,endMs:2500});const p=saveMusicVideo(f.p,{expectedVersion:f.p.version,document:d,acknowledgePlanning:true},f.assets),c=animaticContext(p,f.frames,f.assets);assert.equal(c.fps,fps);assert.equal(c.sourceFrames.reduce((n,s)=>n+s.frameCount,0),Math.round(1.5*fps));assert.equal(c.audioStartSeconds,1);assert.equal(c.audioEndSeconds,2.5);}
});
test('red team: malformed generic preview data and missing dependency links fail closed without throwing',()=>{
 const f=setup(),p=saveAnimatic(f.p,{expectedVersion:f.p.version,fps:24,frameCounts:[24,48],acknowledgeTiming:true},f.frames,f.assets),record=p.production.records.find(r=>r.versions.at(-1).content.kind==='storyboard_animatic_draft');
 for(const mutate of [q=>q.versions.at(-1).content.frames={some:4},q=>q.versions.at(-1).dependencies=[]]){const q=structuredClone(p);mutate(q.production.records.find(r=>r.id===record.id));assert.equal(animaticContext(q,f.frames,f.assets).canPlay,false);}
});

test('red team: song runtime cannot escape shared project/import and storyboard limits',()=>{
 const f=setup(),short=structuredClone(f.document);short.range.endMs=500;short.sections[0].endMs=500;short.shots=[];
 assert.throws(()=>saveMusicVideo(f.p,{expectedVersion:f.p.version,document:short,acknowledgePlanning:true},f.assets),/one second/);
 const long=structuredClone(f.document);long.master.durationMs=1000000;long.range.endMs=1000000;long.sections[0].endMs=1000000;long.shots=[{...long.shots[0],endMs:1000000}];
 assert.throws(()=>saveMusicVideo(f.p,{expectedVersion:f.p.version,document:long,acknowledgePlanning:true},f.assets),/900 seconds/);
});

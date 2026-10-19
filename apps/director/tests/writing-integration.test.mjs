import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newProject,patchProject} from '../domain.mjs';
import {LocalStore} from '../store.mjs';
import {applyScreenplayProjectCommand} from '../public/screenplay-project.js';
import {screenplayContext,screenplayInputSignature,currentScreenplay} from '../public/screenplay-core.js';
import {productionState} from '../production-state.mjs';
import {createImportController} from '../imports.mjs';
import {screenplayDocument} from './writing-fixture-server.mjs';
const cmd=(p,action,fields={})=>applyScreenplayProjectCommand(p,{expectedVersion:p.version,action,...fields});
function film(){let p=newProject({premise:'A station attendant receives a spare ticket.'},'owner');return cmd(p,'apply_proposal',{proposal:{inputSignature:screenplayInputSignature(p),document:screenplayDocument,modelCallId:'saved_test_call'}});}
function withShots(p){return patchProject(p,{shots:screenplayDocument.scenes.map((scene,i)=>({id:'shot_'+i,sceneId:scene.id,title:scene.heading,description:'Reviewed coverage for this scene.',duration:5,clipAssetId:'accepted_clip_'+i,referenceAssetId:'reference_'+i}))});}

test('screenplay bridge invalidates only changed-scene shot specifications and preserves media and history',()=>{
 const p=withShots(film()),document=structuredClone(currentScreenplay(p).document);document.scenes[0].dialogue[0].text='A new line for the first scene.';
 const next=cmd(p,'save',{document});assert.equal(next.story.version,p.story.version+1);assert.deepEqual(next.story.scenes,document.scenes.map(s=>({id:s.id,description:s.heading})));
 assert.equal(next.shots[0].version,p.shots[0].version+1);assert.equal(next.shots[1].version,p.shots[1].version);assert.equal(next.shots[0].clipAssetId,p.shots[0].clipAssetId);assert.equal(next.shots[1].referenceAssetId,p.shots[1].referenceAssetId);assert.deepEqual(next.screenplay.versions[0],p.screenplay.versions[0]);
 assert.throws(()=>patchProject(next,{story:{treatment:'Bypass',scenes:[]}}),{status:409});
});
test('global character changes conservatively require renewed shot specifications without deleting accepted media',()=>{
 const p=withShots(film()),document=structuredClone(currentScreenplay(p).document);document.characters[0].description='A new character constraint affects the performance.';
 const next=cmd(p,'save',{document});assert(next.shots.every((s,i)=>s.version===p.shots[i].version+1));assert(next.shots.every((s,i)=>s.clipAssetId===p.shots[i].clipAssetId));assert.equal(next.story.version,p.story.version+1);
});
test('source additions hold approved downstream work without changing existing shot versions or removing uploads',()=>{
 const p=withShots(film()),assets=p.shots.flatMap((s,i)=>[{id:s.clipAssetId,mime:'video/mp4',version:1},{id:s.referenceAssetId,mime:'image/png',version:1}]);const approvals=[{artifactId:'screenplay',version:1,decision:'approved'},{artifactId:'story',version:p.story.version,decision:'approved'},...p.shots.map(s=>({artifactId:s.id,version:s.version,decision:'approved'}))];
 assert(productionState(p,assets,approvals).nodes.filter(n=>n.kind==='shot').every(n=>n.readyForRouteReview));
 const next=cmd(p,'add_source',{source:{title:'Additional reference',text:'A source provided after the earlier script approval.',permittedUse:'reference_only'}}),state=productionState(next,assets,approvals);assert.equal(screenplayContext(next,approvals).approved,false);assert(state.nodes.filter(n=>n.kind==='shot').every(n=>!n.readyForRouteReview));assert.deepEqual(next.shots,p.shots);
 const revoked=productionState(p,assets,[...approvals,{artifactId:'screenplay',version:1,decision:'revoked'}]);assert(revoked.nodes.filter(n=>n.kind==='shot').every(n=>!n.readyForRouteReview));
});
test('a supplied source alone cannot bypass screenplay review through legacy story and shot approvals',()=>{
 let p=newProject({premise:'A project with a supplied source.'},'owner');p=patchProject(p,{story:{treatment:'A legacy manual treatment.',scenes:[]},shots:[{id:'shot',title:'Coverage',description:'A legacy shot.',duration:5}]});p=cmd(p,'add_source',{source:{title:'Supplied script',text:'An original source awaiting a working screenplay decision.',permittedUse:'user_owned'}});const approvals=[{artifactId:'story',version:p.story.version,decision:'approved'},{artifactId:'shot',version:p.shots[0].version,decision:'approved'}];const graph=productionState(p,[],approvals);assert.equal(graph.nodes.find(n=>n.id==='screenplay').version,0);assert.equal(graph.nodes.find(n=>n.id==='shot').readyForRouteReview,false);
});
test('failed durable screenplay save or approval cannot publish an in-memory success and retries preserve exact history',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'director-writing-durable-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'projects.json'),store=await new LocalStore(file).init(),p=film();await store.create(p);
 const changed=cmd(p,'save',{document:{...currentScreenplay(p).document,title:'A revised title'}});await mkdir(file+'.spending.tmp');await assert.rejects(store.save(changed,p.version));assert.deepEqual(await store.get(p.id,p.ownerId),p);assert.deepEqual(await (await new LocalStore(file).init()).get(p.id,p.ownerId),p);
 await assert.rejects(store.approve(p,{artifactId:'screenplay',version:1,expectedVersion:p.version,decision:'approved',acknowledgeLimitedCoverage:true},p.ownerId));assert.deepEqual(await store.records('approvals',p.id),[]);await rm(file+'.spending.tmp',{recursive:true});await store.save(changed,p.version);assert.equal((await store.get(p.id,p.ownerId)).screenplay.versions.length,2);
});
test('device import preserves supplied originals, removes review authority and derives legacy story from the screenplay',async()=>{
 const store=await new LocalStore().init();let p=newProject({premise:'An uploaded script.'},'device-owner');p=cmd(p,'add_source',{source:{title:'My original',text:'A distinctive silver carriage waits beside the silent platform beneath a broken clock.',permittedUse:'user_owned'}});p=cmd(p,'use_source',{sourceId:p.screenplay.sources[0].id});const report=screenplayContext(p).originality;p=cmd(p,'record_review',{dispositions:report.findings.map(f=>({findingKey:f.key,decision:'authorized_use',note:'My supplied source declaration.'}))});
 const sourceId='device-'+p.id,source={...p,id:sourceId,story:{treatment:'An inconsistent legacy treatment',scenes:[{id:'wrong',description:'Wrong'}],version:1}};const controller=createImportController({store,storage:{}}),imported=await controller.start('cloud-owner',{sourceId,project:source,assets:[]});assert.equal(imported.screenplay.sources[0].text,p.screenplay.sources[0].text);assert.equal(imported.screenplay.versions.length,p.screenplay.versions.length);assert.deepEqual(imported.screenplay.reviews,[]);assert.equal(imported.story.treatment,currentScreenplay(p).document.treatment);assert.deepEqual(imported.story.scenes,currentScreenplay(p).document.scenes.map(s=>({id:s.id,description:s.heading})));assert.deepEqual(await store.records('approvals',imported.id),[]);assert.equal(screenplayContext(imported).approved,false);
 const completed=await controller.complete('cloud-owner',imported.id);assert.equal(completed.importState.status,'ready');assert.equal(completed.screenplay.sources[0].text,p.screenplay.sources[0].text);
});

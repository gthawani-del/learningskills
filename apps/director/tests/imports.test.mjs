import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../store.mjs';
import {hash,fail} from '../domain.mjs';
import {createImportController,stableImportId} from '../imports.mjs';
import {migrateDeviceDraft} from '../public/cloud-migration.js';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const assetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const sourceId='device-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bytes=Buffer.from('User-supplied screenplay.');
const body={sourceId,project:{title:'Letter',premise:'A letter arrives.',format:'short_film',stage:'production',duration:30,language:'English',direction:'Restrained',story:{treatment:'A keeper waits.',scenes:[{id:'s1',description:'Station'}]},shots:[{id:'shot-1',title:'Wait',description:'He waits.',duration:5,sceneId:'s1'}],notes:[{role:'You',text:'Keep the coat red.'}],approvals:[{artifactId:'story',decision:'approved'}]},assets:[{id:assetId,name:'script.txt',mime:'text/plain',role:'script',scope:'project',size:bytes.length,checksum:hash(bytes.toString('base64'))}]};
async function setup(){const store=await new LocalStore().init(),files=new Map();let writes=0;const storage={putIfAbsent:async(key,b,m,checksum)=>{if(files.has(key)){assert.equal(hash(files.get(key).toString('base64')),checksum);return;}files.set(key,b);writes++;}};return {store,files,controller:createImportController({store,storage}),get writes(){return writes;}};}
test('concurrent draft imports resolve to one owned project and preserve notes without importing approvals',async()=>{
 const s=await setup();const projects=await Promise.all(Array.from({length:5},()=>s.controller.start(owner,body)));
 assert.equal(new Set(projects.map(p=>p.id)).size,1);assert.equal(s.store.state.projects.length,1);assert.equal(projects[0].version,2);assert.equal(projects[0].notes[0].text,'Keep the coat red.');assert.equal(s.store.state.approvals.length,0);assert.equal(projects[0].approvals,undefined);
 const otherProject=await s.controller.start(other,body);assert.notEqual(otherProject.id,projects[0].id);await assert.rejects(()=>s.controller.upload(other,projects[0].id,assetId,{bytes,mime:'text/plain'}),e=>e.status===404);
});
test('incomplete imports cannot finish; retry uploads and completion do not duplicate references or overwrite edits',async()=>{
 const s=await setup();const p=await s.controller.start(owner,body);
 await assert.rejects(()=>s.controller.complete(owner,p.id),/pending/);
 await Promise.all([s.controller.upload(owner,p.id,assetId,{bytes,mime:'text/plain'}),s.controller.upload(owner,p.id,assetId,{bytes,mime:'text/plain'})]);
 assert.equal(s.store.state.assets.length,1);assert.equal(s.writes,1);
 const completed=await Promise.all([s.controller.complete(owner,p.id),s.controller.complete(owner,p.id)]);assert.ok(completed.every(p=>p.importState.status==='ready'));
 const current=completed[0];await s.store.save({...current,title:'Edited in cloud',version:current.version+1},current.version);
 const replay=await s.controller.start(owner,body);assert.equal(replay.title,'Edited in cloud');assert.equal((await s.controller.complete(owner,p.id)).title,'Edited in cloud');assert.equal(s.store.state.projects.length,1);
});
test('reference bytes, links and owner identity are verified before completion',async()=>{
 const s=await setup();const request=structuredClone(body);request.assets[0].mime='image/png';request.assets[0].role='shot_reference';request.assets[0].scope='shot';request.assets[0].shotId='shot-1';request.project.shots[0].referenceAssetId=assetId;
 const p=await s.controller.start(owner,request);await assert.rejects(()=>s.controller.upload(owner,p.id,assetId,{bytes:Buffer.from('changed'),mime:'image/png'}),/content changed/);assert.equal(s.writes,0);
 await s.controller.upload(owner,p.id,assetId,{bytes,mime:'image/png'});const done=await s.controller.complete(owner,p.id);assert.equal(done.shots[0].referenceAssetId,stableImportId({projectId:p.id,sourceId:assetId}));assert.equal(done.shots[0].clipAssetId,null);
 const missing=structuredClone(request);missing.assets=[];await assert.rejects(()=>s.controller.start(owner,missing),/missing/);
});
test('failed initial snapshot save can resume with the same import identity',async()=>{
 const s=await setup(),save=s.store.save.bind(s.store);let failOnce=true;s.store.save=async(...args)=>{if(failOnce){failOnce=false;fail(502,'Temporary outage');}return save(...args);};
 await assert.rejects(()=>s.controller.start(owner,body),/outage/);assert.equal(s.store.state.projects.length,1);assert.equal(s.store.state.projects[0].version,1);
 const recovered=await s.controller.start(owner,body);assert.equal(recovered.version,2);assert.equal(s.store.state.projects.length,1);
});
test('browser coordinator recovers lost upload responses and preserves its device source',async()=>{
 const s=await setup();const project={...body.project,id:sourceId,isLocal:true};const source=structuredClone(project);const assets=[{...body.assets[0],blob:new Blob([bytes],{type:'text/plain'})}];let loseResponse=true;
 async function api(path,{body:payload}={}){
 if(path==='/api/imports')return {project:await s.controller.start(owner,payload)};
 const [,id,action,sourceAssetId]=path.match(/^\/api\/projects\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/)||[];
 if(action==='assets')return {assets:await s.store.records('assets',id)};
 if(action==='import-assets'){const asset=await s.controller.upload(owner,id,sourceAssetId,{bytes:Buffer.from(payload.base64,'base64'),mime:payload.mime});if(loseResponse){loseResponse=false;throw Error('Connection lost after upload');}return {asset};}
 if(action==='import-complete')return {project:await s.controller.complete(owner,id)};
 throw Error('Unexpected route');
 }
 await assert.rejects(()=>migrateDeviceDraft({api,project,assets}),/Connection lost/);
 const done=await migrateDeviceDraft({api,project,assets});assert.equal(done.importState.status,'ready');assert.equal(s.store.state.projects.length,1);assert.equal(s.store.state.assets.length,1);assert.deepEqual(project,source);assert.equal(await assets[0].blob.text(),bytes.toString());
});
test('edits to device snapshot produce a distinct copy; forged ownership and imported billing records are ignored',async()=>{
 const s=await setup();const a=await s.controller.start(owner,body),edited=structuredClone(body);edited.project.title='A revised idea';edited.project.ownerId=other;edited.project.budget_micro_usd=999999;edited.project.importState={status:'ready'};
 const b=await s.controller.start(owner,edited);assert.notEqual(a.id,b.id);assert.equal(b.ownerId,owner);assert.equal(b.budget_micro_usd,undefined);assert.equal(b.importState.status,'awaiting_media');
});

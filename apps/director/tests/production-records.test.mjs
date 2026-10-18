import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,hash} from '../domain.mjs';
import {applyProductionRecord,recordDependencies,recordArtifacts} from '../production-records.mjs';
const projectId='11111111-1111-4111-8111-111111111111',imageId='22222222-2222-4222-8222-222222222222',audioId='33333333-3333-4333-8333-333333333333';
const assets=[{id:imageId,projectId,version:1,mime:'image/png'},{id:audioId,projectId,version:1,mime:'audio/wav'}];
const film=()=>({...newProject({title:'Records'},'owner'),id:projectId,shots:[{id:'a',version:1,status:'approved',clipAssetId:'accepted-video',productionBindings:[]},{id:'b',version:3,status:'approved',productionBindings:[]}]});
const apply=(p,c)=>applyProductionRecord(p,{expectedVersion:p.version,...c},assets);
const latest=p=>p.production.records.at(-1);
test('production records normalize snapshots, no-op safely and preserve historical names and contents',()=>{
 const source=film(),sourceCopy=structuredClone(source);const p=apply(source,{type:'character',name:'  Mara  ',content:{description:'  Quiet station keeper.  '},references:[{assetId:imageId,version:1}]});assert.deepEqual(source,sourceCopy);assert.equal(p.version,source.version+1);
 const r=latest(p);assert.equal(r.name,'Mara');assert.equal(r.currentVersion,1);assert.equal(r.versions[0].content.description,'Quiet station keeper.');
 const same=apply(p,{id:r.id,name:'Mara',content:{description:'Quiet station keeper.'}});assert.deepEqual(same,p);assert.notEqual(same,p);
 const changed=apply(p,{id:r.id,name:'Mara older',content:{description:'Older keeper.'}});assert.equal(latest(changed).currentVersion,2);assert.equal(latest(changed).versions[0].name,'Mara');assert.deepEqual(latest(changed).versions[0],r.versions[0]);assert.equal(latest(changed).versions[1].content.description,'Older keeper.');assert.equal(r.versions.length,1);
 const artifact=recordArtifacts(changed)[0];assert.equal(artifact.logical_key,'record:'+r.id);assert.equal(artifact.version,2);assert.equal(artifact.content_hash,hash(artifact.content));assert.equal(recordArtifacts(changed).length,1);
});
test('stale project revisions, changed types and injected authority flags fail without mutation',()=>{
 const p=apply(film(),{type:'voice',name:'Voice',content:{language:'English',performance:'Restrained'}}),r=latest(p),before=structuredClone(p);
 assert.throws(()=>applyProductionRecord(p,{id:r.id,expectedVersion:p.version-1,name:'Changed'},assets),e=>e.status===409);
 assert.throws(()=>apply(p,{id:r.id,type:'character'}),/record type/);
 for(const bad of [{ownerId:'intruder'},{accepted:true},{modelId:'paid'}])assert.throws(()=>apply(p,{id:r.id,...bad}),/Unsupported/);
 assert.throws(()=>apply(p,{id:r.id,content:{qualityValidated:true}}),/cannot grant/);assert.deepEqual(p,before);
});
test('character revision invalidates only bound shots while retaining accepted media',()=>{
 const p=apply(film(),{type:'character',name:'Mara',content:{description:'Keeper'}}),r=latest(p);p.shots[0].productionBindings=[{recordId:r.id,version:1}];const untouched=structuredClone(p.shots[1]);
 const next=apply(p,{id:r.id,content:{description:'Keeper with revised hairline'}});assert.equal(next.shots[0].version,2);assert.equal(next.shots[0].status,'draft');assert.equal(next.shots[0].clipAssetId,'accepted-video');assert.deepEqual(next.shots[1],untouched);assert.equal(p.shots[0].version,1);
 const graph=recordDependencies(next);assert.equal(graph.generationAuthorized,false);assert.equal(graph.shots[0].staleBindings.length,1);assert.equal(graph.shots[1].holds.length,0);
});
test('voice revision propagates through audio and take dependency holds without changing their historical versions',()=>{
 let p=apply(film(),{type:'voice',name:'Mara voice',content:{language:'Hindi',performance:'Understated'}});const voice=latest(p);
 p=apply(p,{type:'audio',name:'Approved words draft',content:{script:'The train has gone.',timing:{seconds:3}},references:[{assetId:audioId,version:1}],dependencies:[{recordId:voice.id,version:1}]});const audio=latest(p);
 p=apply(p,{type:'take',name:'Station dialogue',content:{description:'Keeper speaks.'},dependencies:[{recordId:audio.id,version:1}]});const take=latest(p);p.shots[0].productionBindings=[{recordId:take.id,version:1}];
 const next=apply(p,{id:voice.id,content:{language:'Hindi',performance:'Urgent but quiet'}}),graph=recordDependencies(next);
 assert.equal(next.shots[0].version,2);assert.equal(next.shots[1].version,3);assert.equal(graph.records.find(r=>r.recordId===audio.id).staleDependencies.length,1);assert.equal(graph.records.find(r=>r.recordId===take.id).staleDependencies.length,0);assert.equal(graph.records.find(r=>r.recordId===take.id).holds.length,1);assert.equal(graph.shots[0].holds.length,1);assert.equal(next.production.records.find(r=>r.id===take.id).currentVersion,1);
});
test('references require project ownership, matching asset version and appropriate MIME',()=>{
 const p=film(),cmd={expectedVersion:p.version,type:'character',name:'Person',content:{description:'Keeper'},references:[{assetId:imageId,version:1}]};
 assert.throws(()=>applyProductionRecord(p,cmd,[{...assets[0],projectId:'foreign'}]),/project asset/);
 assert.throws(()=>applyProductionRecord(p,{...cmd,references:[{assetId:imageId,version:2}]},assets),/project asset/);
 assert.throws(()=>applyProductionRecord(p,{...cmd,references:[{assetId:audioId,version:1}]},assets),/media type/);
 assert.throws(()=>applyProductionRecord(p,{...cmd,references:[...cmd.references,...cmd.references]},assets),/unique/);
 assert.throws(()=>apply(p,{type:'voice',name:'Voice',content:{description:'Warm'},references:[{assetId:imageId,version:1}]}),/media type/);
});
test('missing, self and transitive cyclic dependencies are rejected; explicit historical versions remain inspectable',()=>{
 let p=apply(film(),{type:'location',name:'Station',content:{description:'Dawn'}});const a=latest(p);
 p=apply(p,{type:'prop',name:'Letter',content:{description:'Folded paper'},dependencies:[{recordId:a.id,version:1}]});const b=latest(p);
 assert.throws(()=>apply(p,{id:a.id,dependencies:[{recordId:a.id,version:1}]}),/another existing/);
 assert.throws(()=>apply(p,{id:a.id,dependencies:[{recordId:b.id,version:1}]}),/cycle/);
 assert.throws(()=>apply(p,{id:a.id,dependencies:[{recordId:b.id,version:2}]}),/existing project/);
 assert.throws(()=>apply(p,{id:a.id,dependencies:[{recordId:audioId,version:1}]}),/existing project/);
 p=apply(p,{id:a.id,content:{description:'Rainy dawn'}});assert.equal(recordDependencies(p).records.find(r=>r.recordId===b.id).staleDependencies[0].version,1);assert.equal(p.production.records.find(r=>r.id===a.id).versions[0].content.description,'Dawn');
});
test('content bounds reject excessive or nonfinite input and preserve expressive filmmaking directions',()=>{
 const p=film();assert.throws(()=>apply(p,{type:'character',name:'X',content:{description:'x'.repeat(12001)}}),/too long/);assert.throws(()=>apply(p,{type:'audio',name:'X',content:{seconds:Infinity}}),/finite/);
 const next=apply(p,{type:'edit',name:'Experimental montage',content:{description:'Surreal saturated reflections; intentional jump cuts.',timing:[{start:0,end:2}],performance:'Unreliable dream perspective'}});assert.equal(latest(next).versions[0].content.description,'Surreal saturated reflections; intentional jump cuts.');
});

test('browser-safe core matches Node operations and artifact snapshots without importing server code',async()=>{
 const {readFile}=await import('node:fs/promises'),vm=await import('node:vm');
 const source=await readFile(new URL('../public/production-records-core.js',import.meta.url),'utf8');assert.ok(!/^import\s/m.test(source));assert.ok(!source.includes('node:'));
 const context={crypto:globalThis.crypto,structuredClone,Date};vm.runInNewContext(source.replace(/^export /gm,'')+'\nglobalThis.api={applyProductionRecord,recordDependencies,recordSnapshots,normalizeProductionArchive};',context);
 const p=apply(film(),{type:'voice',name:'Voice',content:{language:'Hindi',performance:'Quiet'}}),r=latest(p);const command={id:r.id,expectedVersion:p.version,name:'Voice'};
 const json=x=>JSON.parse(JSON.stringify(x));assert.deepEqual(json(context.api.applyProductionRecord(p,command,assets)),applyProductionRecord(p,command,assets));
 assert.deepEqual(json(context.api.recordDependencies(p)),recordDependencies(p));
 const withoutHash=recordArtifacts(p).map(({content_hash,...a})=>a);assert.deepEqual(json(context.api.recordSnapshots(p)),withoutHash);
 assert.deepEqual(json(context.api.normalizeProductionArchive(p.production,p.id,assets)),p.production);
});
test('archive preserves historical descriptions, names and exact reference versions while discarding authority metadata',async()=>{
 const {normalizeProductionArchive}=await import('../production-records.mjs');let p=apply(film(),{type:'character',name:'Mara',content:{description:'Keeper'},references:[{assetId:imageId,version:1}]});const r=latest(p),expanded=[...assets,{...assets[0],version:2}];
 p=applyProductionRecord(p,{expectedVersion:p.version,id:r.id,name:'Mara raincoat',references:[{assetId:imageId,version:2}]},expanded);
 const dirty=structuredClone(p.production);dirty.ownerId='intruder';dirty.accepted=true;dirty.records[0].approved=true;dirty.records[0].versions[0].budget=999;const before=structuredClone(dirty);
 const clean=normalizeProductionArchive(dirty,projectId,expanded);assert.deepEqual(dirty,before);assert.deepEqual(clean,p.production);assert.equal(clean.records[0].versions[0].references[0].version,1);assert.equal(clean.records[0].versions[1].references[0].version,2);
 assert.throws(()=>normalizeProductionArchive(dirty,projectId,[expanded.at(-1)]),/project asset/);
 dirty.records[0].versions[0].content.accepted=true;assert.throws(()=>normalizeProductionArchive(dirty,projectId,expanded),/cannot grant/);
});
test('archive rejects malformed, oversized or mismatched histories, invalid timestamps and foreign references',async()=>{
 const {normalizeProductionArchive}=await import('../production-records.mjs');const p=apply(film(),{type:'character',name:'Mara',content:{description:'Keeper'},references:[{assetId:imageId,version:1}]});const clean=p.production;
 const mutate=fn=>{const x=structuredClone(clean);fn(x);assert.throws(()=>normalizeProductionArchive(x,projectId,assets),e=>e.status===400);};
 mutate(x=>x.records.push(structuredClone(x.records[0])));mutate(x=>x.records[0].type='approved_model');mutate(x=>x.records[0].currentVersion=2);mutate(x=>x.records[0].versions[0].version=2);mutate(x=>x.records[0].versions[0].name='');mutate(x=>x.records[0].name='Different current name');mutate(x=>x.records[0].versions[0].createdAt='yesterday');mutate(x=>x.records[0].versions[0].references[0].version=2);mutate(x=>x.records[0].versions[0].content={description:'x'.repeat(12001)});
 mutate(x=>{x.records[0].versions=Array.from({length:101},(_,i)=>({...x.records[0].versions[0],version:i+1}));x.records[0].currentVersion=101;});
 assert.throws(()=>normalizeProductionArchive(clean,'foreign',assets),/project asset/);assert.throws(()=>normalizeProductionArchive({records:Array(201).fill(clean.records[0])},projectId,assets),/archive/);
 assert.deepEqual(normalizeProductionArchive(undefined,projectId,assets),{records:[]});
});
test('archive validates historical dependency targets and rejects self-links and current dependency cycles',async()=>{
 const {normalizeProductionArchive}=await import('../production-records.mjs');let p=apply(film(),{type:'voice',name:'Voice',content:{language:'English'}});const a=latest(p);p=apply(p,{type:'audio',name:'Line',content:{script:'Wait.'},dependencies:[{recordId:a.id,version:1}]});const b=latest(p);p=apply(p,{id:a.id,content:{language:'Hindi'}});
 const normalized=normalizeProductionArchive(p.production,projectId,assets);assert.equal(normalized.records[1].versions[0].dependencies[0].version,1);
 const invalid=structuredClone(p.production);invalid.records[1].versions[0].dependencies[0].version=3;assert.throws(()=>normalizeProductionArchive(invalid,projectId,assets),/dependency/);
 const self=structuredClone(p.production);self.records[0].versions[0].dependencies=[{recordId:a.id,version:1}];assert.throws(()=>normalizeProductionArchive(self,projectId,assets),/dependency/);
 const cycle=structuredClone(p.production);cycle.records[0].versions[1].dependencies=[{recordId:b.id,version:1}];assert.throws(()=>normalizeProductionArchive(cycle,projectId,assets),/cycle/);
});
test('queued local approvals reread current owned records and reject stale snapshots',async()=>{
 const {LocalStore}=await import('../store.mjs');const store=await new LocalStore().init();
 const first=apply(film(),{type:'character',name:'Keeper',content:{description:'First look'}});await store.create(first);
 const record=latest(first),next=apply(first,{id:record.id,content:{description:'Revised look'}});
 const save=store.save(next,first.version),approval=store.approve(first,{artifactId:'record:'+record.id,version:1,decision:'approved'},first.ownerId);
 await save;await assert.rejects(()=>approval,e=>e.status===409);assert.equal(store.state.approvals.length,0);
 await assert.rejects(()=>store.approve(next,{artifactId:'record:'+record.id,version:2,decision:'approved'},'another-owner'),e=>e.status===404);
 assert.equal((await store.approve(next,{artifactId:'record:'+record.id,version:2,decision:'approved'},first.ownerId)).version,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,patchProject} from '../domain.mjs';
import {productionState} from '../production-state.mjs';
function film(){const p=newProject({title:'Two scenes'},'owner');return patchProject(p,{story:{treatment:'Two connected moments.',scenes:[{id:'s1',description:'The letter arrives.'},{id:'s2',description:'The train departs.'}]},shots:[{id:'a',title:'Letter',description:'A hand opens the letter.',sceneId:'s1',duration:5},{id:'b',title:'Train',description:'A train leaves.',sceneId:'s2',duration:5}]});}
const approvals=p=>[{artifactId:'story',version:p.story.version,decision:'approved'},...p.shots.map(s=>({artifactId:s.id,version:s.version,decision:'approved'}))];
test('scene revisions invalidate only linked shot specifications and preserve media/neighboring versions',()=>{
 const p=film();p.shots[0].clipAssetId='existing-clip';const next=patchProject(p,{story:{...p.story,scenes:[{id:'s1',description:'The keeper tears the letter.'},p.story.scenes[1]]}});
 assert.equal(next.shots[0].version,p.shots[0].version+1);assert.equal(next.shots[0].clipAssetId,'existing-clip');assert.deepEqual(next.shots[1],p.shots[1]);
 const graph=productionState(next,[],approvals(p));assert.equal(graph.nodes.find(n=>n.id==='a').specificationApproved,false);assert.equal(graph.nodes.find(n=>n.id==='b').specificationApproved,true);assert.equal(graph.nodes[0].approved,false);
});
test('simultaneous scene and shot edit advances each affected shot once; deleting a scene yields an explicit hold',()=>{
 const p=film();const next=patchProject(p,{story:{...p.story,scenes:[{id:'s1',description:'Changed scene'},p.story.scenes[1]]},shots:p.shots.map(s=>s.id==='a'?{...s,dialogue:'Do not leave.'}:s)});
 assert.equal(next.shots[0].version,p.shots[0].version+1);assert.equal(next.shots[1].version,p.shots[1].version);
 const removed=patchProject(p,{story:{...p.story,scenes:[p.story.scenes[1]]}});assert.ok(productionState(removed,[],approvals(removed)).nodes.find(n=>n.id==='a').holds.includes('Linked scene is missing.'));
});
test('brief changes require renewed story review; cosmetic project renaming does not',()=>{
 const p=film();assert.equal(patchProject(p,{language:'Hindi'}).story.version,p.story.version+1);assert.equal(patchProject(p,{title:'New title'}).story.version,p.story.version);
 assert.throws(()=>patchProject(p,{story:{treatment:'x',scenes:[{id:'s',description:'a'},{id:'s',description:'b'}]}}),/unique/);
});
test('review graph distinguishes specification approval, reference validity and generation authorization',()=>{
 const p=film();let g=productionState(p,[],approvals(p));assert.ok(g.nodes.filter(n=>n.kind==='shot').every(n=>n.readyForRouteReview));assert.equal(g.generationAuthorized,false);assert.deepEqual(g.adjacency,[{shotId:'a',previous:null,next:'b'},{shotId:'b',previous:'a',next:null}]);
 p.shots[0].referenceAssetId='foreign';g=productionState(p,[],approvals(p));assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,false);
 const revoked=[...approvals(p),{artifactId:'b',version:p.shots[1].version,decision:'revoked'}];assert.equal(productionState(p,[],revoked).nodes.find(n=>n.id==='b').specificationApproved,false);
});
test('device draft and server revision rules invalidate the same dependent versions',async()=>{
 const {draftRevision}=await import('../public/device-drafts.js');const p=film();const changes={story:{...p.story,scenes:[{id:'s1',description:'A revised scene'},p.story.scenes[1]]},language:'Hindi'};
 const device=draftRevision(p,changes),server=patchProject(p,changes);assert.equal(device.story.version,server.story.version);assert.deepEqual(device.shots.map(s=>s.version),server.shots.map(s=>s.version));assert.deepEqual(device.shots[1],p.shots[1]);
});
test('normalizing legacy shot fields advances immutable artifact version before its content changes',()=>{
 const p=film();delete p.shots[0].referenceAssetId;const next=patchProject(p,{shots:p.shots});assert.equal(next.shots[0].version,p.shots[0].version+1);assert.equal(next.shots[0].referenceAssetId,null);assert.equal(next.shots[1].version,p.shots[1].version);
});
test('malformed scenes are rejected as client errors rather than unclassified server failures',()=>{
 for(const scene of [null,[],1])assert.throws(()=>patchProject(film(),{story:{treatment:'Valid treatment',scenes:[scene]}}),e=>e.status===400);
});

test('bound library records require current creative approval; revocation holds shots without changing versions or media',async()=>{
 const {applyProductionRecord}=await import('../production-records.mjs');let p=applyProductionRecord(film(),{expectedVersion:2,type:'character',name:'Mara',content:{description:'Station keeper.'}},[]);const record=p.production.records[0];
 p.shots[0].productionBindings=[{recordId:record.id,version:1}];p.shots[0].clipAssetId='retained-clip';const assets=[{id:'retained-clip',mime:'video/mp4',version:1}],before=structuredClone(p),base=approvals(p),approval={artifactId:'record:'+record.id,version:1,decision:'approved'};
 let g=productionState(p,assets,base);assert.equal(g.nodes.find(n=>n.id==='a').specificationApproved,true);assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,false);assert.ok(g.nodes.find(n=>n.id==='record:'+record.id).holds.some(h=>h.includes('approval required')));assert.equal(g.nodes.find(n=>n.id==='b').readyForRouteReview,true);
 g=productionState(p,assets,[...base,approval]);assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,true);assert.deepEqual(g.nodes.find(n=>n.id==='record:'+record.id).holds,[]);assert.equal(g.generationAuthorized,false);
 g=productionState(p,assets,[...base,approval,{...approval,decision:'revoked'}]);assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,false);assert.equal(g.nodes.find(n=>n.id==='record:'+record.id).specificationApproved,false);assert.equal(g.nodes.find(n=>n.id==='b').readyForRouteReview,true);assert.deepEqual(p,before);
});

test('unapproved transitive voice dependencies hold an otherwise approved take and its bound shot',async()=>{
 const {applyProductionRecord}=await import('../production-records.mjs');let p=film();const add=command=>{p=applyProductionRecord(p,{expectedVersion:p.version,...command},[]);return p.production.records.at(-1);};
 const voice=add({type:'voice',name:'Mara voice',content:{performance:'Restrained'}}),audio=add({type:'audio',name:'Dialogue',content:{script:'Wait.'},dependencies:[{recordId:voice.id,version:1}]}),take=add({type:'take',name:'Waiting take',content:{description:'Mara speaks.'},dependencies:[{recordId:audio.id,version:1}]});
 p.shots[0].productionBindings=[{recordId:take.id,version:1}];const before=structuredClone(p),recordApproval=r=>({artifactId:'record:'+r.id,version:1,decision:'approved'}),base=[...approvals(p),recordApproval(audio),recordApproval(take)];
 let g=productionState(p,[],base);assert.equal(g.nodes.find(n=>n.id==='record:'+take.id).specificationApproved,true);assert.ok(g.nodes.find(n=>n.id==='record:'+take.id).holds.some(h=>h.includes(voice.id)));assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,false);assert.equal(g.nodes.find(n=>n.id==='b').readyForRouteReview,true);
 g=productionState(p,[],[...base,recordApproval(voice)]);assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,true);assert.deepEqual(g.nodes.find(n=>n.id==='record:'+take.id).holds,[]);assert.equal(g.generationAuthorized,false);
 g=productionState(p,[],[...base,recordApproval(voice),{...recordApproval(voice),decision:'revoked'}]);assert.equal(g.nodes.find(n=>n.id==='a').readyForRouteReview,false);assert.deepEqual(p,before);
});

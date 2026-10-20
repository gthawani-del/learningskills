import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server.mjs';
import {LocalStore} from '../store.mjs';
const call=async(handler,path,body,extra={})=>{const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost','content-type':'application/json',...extra.headers},socket:{remoteAddress:'127.0.0.1'},...extra});let status,headers={},data;const res={setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);this.headersSent=true;},end(v){data=v;}};await handler(req,res);let json;try{json=JSON.parse(String(data));}catch{}return {status,headers,json,data};};
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'director-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const env={DIRECTOR_DEMO:'1',DIRECTOR_DATA_FILE:join(dir,'projects.json'),DIRECTOR_ASSET_DIR:join(dir,'assets')};return {env,handler:await createHandler({env})};}
test('manual film workflow persists versions, scoped approvals and honest production holds',async t=>{
 const {handler,env}=await setup(t);let r=await call(handler,'/api/projects',{title:'Quiet station',premise:'A parent waits at dawn.'});assert.equal(r.status,201);const p=r.json.project;
 r=await call(handler,`/api/projects/${p.id}`,{expectedVersion:1,story:{treatment:'He finds the letter.',scenes:[{id:'scene-1',description:'Station at dawn'}]},shots:[{id:'shot-1',title:'Waiting',description:'He holds a letter.',duration:5}]},{method:'PATCH'});assert.equal(r.status,200);assert.equal(r.json.project.story.version,2);
 r=await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'story',version:2,decision:'approved'});assert.equal(r.status,201);
 r=await call(handler,`/api/projects/${p.id}`,{expectedVersion:1,title:'Stale overwrite'},{method:'PATCH'});assert.equal(r.status,409);
 r=await call(handler,`/api/projects/${p.id}/proposals`,{shotId:'shot-1',instruction:'Keep the performance restrained.',referenceIds:[]});assert.equal(r.status,201);assert.equal(r.json.proposal.canAuthorize,false);
 assert.equal((await call(handler,`/api/projects/${p.id}/generate`,{})).status,409);
 assert.equal((await call(handler,`/api/projects/${p.id}/export`,{})).status,503);
 const restored=await createHandler({env});assert.equal((await call(restored,`/api/projects/${p.id}`)).json.project.title,'Quiet station');
});
test('uploads validate file content, preserve ownership and expose only scoped retrieval',async t=>{
 const {handler}=await setup(t);const p=(await call(handler,'/api/projects',{title:'References'})).json.project;
 const body={name:'notes.md',mime:'text/markdown',scope:'project',role:'script',base64:Buffer.from('A quiet scene.').toString('base64')};
 const r=await call(handler,`/api/projects/${p.id}/assets`,body);assert.equal(r.status,201);assert.equal(r.json.asset.storageKey,undefined);
 const id=r.json.asset.id;assert.equal((await call(handler,`/api/projects/${p.id}/assets/${id}/content`)).status,200);
 assert.equal((await call(handler,`/api/projects/${p.id}/assets`,{...body,mime:'image/png'})).status,415);
 assert.equal((await call(handler,`/api/projects/${p.id}/assets`,{...body,scope:'shot',shotId:'missing'})).status,400);
 const other=(await call(handler,'/api/projects',{title:'Other'})).json.project;
 assert.equal((await call(handler,`/api/projects/${other.id}/assets/${id}/content`)).status,404);
 assert.equal((await call(handler,`/api/projects/${other.id}/proposals`,{instruction:'Use it',referenceIds:[id]})).status,400);
});
test('unconfigured production never falls back to anonymous demo or exposes secrets',async()=>{
 const handler=await createHandler({env:{DIRECTOR_DEMO:'1',NODE_ENV:'production',FAL_API_KEY:'secret-sentinel'}});
 const config=await call(handler,'/api/config');assert.equal(config.json.mode,'supabase');assert.equal(config.json.user,null);assert.equal(config.json.capabilities.media,false);assert.ok(!JSON.stringify(config).includes('secret-sentinel'));
 assert.equal((await call(handler,'/api/projects')).status,503);
 assert.equal((await call(handler,'/.env')).status,404);
});
test('cross-site and unapproved requests cannot start planning',async t=>{
 const {handler}=await setup(t);assert.equal((await call(handler,'/api/projects',{title:'Attempt'},{headers:{host:'localhost','content-type':'application/json',origin:'https://evil.example'}})).status,403);
 const p=(await call(handler,'/api/projects',{title:'Draft'})).json.project;
 assert.equal((await call(handler,`/api/projects/${p.id}/plan`,{authorizePlanning:true})).status,503);
 assert.equal((await call(handler,'/api/admin/registry')).status,403);
});
test('local store denies another owner and handles concurrent optimistic saves',async()=>{
 const store=await new LocalStore().init();await store.create({id:'p',ownerId:'one',version:1});
 await assert.rejects(()=>store.get('p','two'),/not found/);
 const writes=await Promise.allSettled([store.save({id:'p',ownerId:'one',version:2},1),store.save({id:'p',ownerId:'one',version:2},1)]);
 assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);
});
test('an environment flag and client confirmation cannot bypass planning reservations',async()=>{
 const store=await new LocalStore().init();store.user=async()=>({id:'owner'});let calls=0;
 const handler=await createHandler({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',OPENAI_API_KEY:'test-only',OPENAI_STORY_MODEL:'configured-model',DIRECTOR_PLANNING_ENABLED:'1'},store,providers:{planFilm:async()=>{calls++;throw new Error('must not run');}}});
 const extra={headers:{host:'localhost','content-type':'application/json',cookie:'director_session=test-token'}};
 assert.equal((await call(handler,'/api/config',undefined,extra)).json.capabilities.planning,false);
 const p=(await call(handler,'/api/projects',{title:'No hidden charges'},extra)).json.project;
 assert.equal((await call(handler,`/api/projects/${p.id}/plan`,{authorizePlanning:true},extra)).status,503);assert.equal(calls,0);
});

test('site icon routes return the actual SVG asset',async()=>{
 const handler=await createHandler({env:{}});for(const path of ['/favicon.ico','/favicon.svg']){const r=await call(handler,path);assert.equal(r.status,200);assert.match(r.headers['Content-Type'],/image\/svg\+xml/);assert.match(String(r.data),/<svg/);}
});
test('production review state reflects current scene dependencies without authorizing generation',async t=>{
 const {handler}=await setup(t);let p=(await call(handler,'/api/projects',{title:'Review graph'})).json.project;
 let r=await call(handler,`/api/projects/${p.id}`,{expectedVersion:p.version,story:{treatment:'A quiet arrival.',scenes:[{id:'s1',description:'A letter arrives.'}]},shots:[{id:'one',title:'Arrival',description:'A keeper opens the letter.',sceneId:'s1',duration:5}]},{method:'PATCH'});p=r.json.project;
 await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'story',version:p.story.version,decision:'approved'});await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'one',version:p.shots[0].version,decision:'approved'});
 r=await call(handler,`/api/projects/${p.id}/production-state`);assert.equal(r.status,200);assert.equal(r.json.production.generationAuthorized,false);assert.equal(r.json.production.nodes.find(n=>n.id==='one').readyForRouteReview,true);
 await call(handler,`/api/projects/${p.id}`,{expectedVersion:p.version,story:{...p.story,scenes:[{id:'s1',description:'The keeper burns the letter.'}]}},{method:'PATCH'});
 r=await call(handler,`/api/projects/${p.id}/production-state`);assert.equal(r.json.production.nodes.find(n=>n.id==='one').specificationApproved,false);
});
test('pending imports reject ordinary edits and approvals while allowing completion',async t=>{
 const {handler}=await setup(t);const started=await call(handler,'/api/imports',{sourceId:'device-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',project:{title:'Pending copy',premise:'Wait for references',story:{treatment:'A letter arrives.',scenes:[]},shots:[]},assets:[]});assert.equal(started.status,200);const p=started.json.project;
 assert.equal((await call(handler,`/api/projects/${p.id}`,{expectedVersion:p.version,stage:'story'},{method:'PATCH'})).status,409);
 assert.equal((await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'story',version:p.story.version,decision:'approved'})).status,409);
 assert.equal((await call(handler,`/api/projects/${p.id}/import-complete`,{})).status,200);
});

test('production library API persists record histories and invalidates only bound shot specifications',async t=>{
 const {handler,env}=await setup(t);let p=(await call(handler,'/api/projects',{title:'Mara at the station'})).json.project;
 let r=await call(handler,`/api/projects/${p.id}`,{expectedVersion:p.version,story:{treatment:'Mara waits while the train leaves.',scenes:[{id:'station',description:'Dawn at a railway station.'}]},shots:[{id:'mara',description:'Mara waits.',sceneId:'station',duration:5},{id:'train',description:'The train leaves.',sceneId:'station',duration:5}]},{method:'PATCH'});assert.equal(r.status,200);p=r.json.project;
 const uploaded=await call(handler,`/api/projects/${p.id}/assets`,{name:'portrait.png',mime:'image/png',role:'character_identity',scope:'project',base64:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')});assert.equal(uploaded.status,201);const reference=uploaded.json.asset;
 const clip=await call(handler,`/api/projects/${p.id}/assets`,{name:'fixture.mp4',mime:'video/mp4',role:'shot_reference',scope:'shot',shotId:'mara',base64:Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(12)]).toString('base64')});assert.equal(clip.status,201);
 r=await call(handler,`/api/projects/${p.id}/production-records`,{expectedVersion:p.version,type:'character',name:'Mara',content:{description:'Station keeper, practical raincoat.'},references:[{assetId:reference.id,version:1}]});assert.equal(r.status,200);p=r.json.project;const record=p.production.records[0],versionBeforeBinding=p.version;
 const staleWrite=await call(handler,`/api/projects/${p.id}/production-records`,{expectedVersion:versionBeforeBinding-1,id:record.id,name:'Stale overwrite'});assert.equal(staleWrite.status,409);
 r=await call(handler,`/api/projects/${p.id}`,{expectedVersion:p.version,shots:p.shots.map(s=>s.id==='mara'?{...s,productionBindings:[{recordId:record.id,version:1}],referenceAssetId:reference.id,clipAssetId:clip.json.asset.id}:s)},{method:'PATCH'});assert.equal(r.status,200);p=r.json.project;
 for(const [artifactId,version]of [['story',p.story.version],['record:'+record.id,1],...p.shots.map(s=>[s.id,s.version])])assert.equal((await call(handler,`/api/projects/${p.id}/approvals`,{artifactId,version,decision:'approved'})).status,201);
 const previous=structuredClone(p),neighbor=structuredClone(p.shots[1]);
 r=await call(handler,`/api/projects/${p.id}/production-records`,{expectedVersion:p.version,id:record.id,content:{description:'Station keeper, revised hairline and practical raincoat.'}});assert.equal(r.status,200);p=r.json.project;
 assert.equal(p.production.records[0].currentVersion,2);assert.equal(p.production.records[0].versions.length,2);assert.deepEqual(p.production.records[0].versions[0],previous.production.records[0].versions[0]);
 assert.equal(p.shots[0].version,previous.shots[0].version+1);assert.equal(p.shots[0].status,'draft');assert.equal(p.shots[0].clipAssetId,clip.json.asset.id);assert.equal(p.shots[0].referenceAssetId,reference.id);assert.deepEqual(p.shots[1],neighbor);
 assert.equal((await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'mara',version:previous.shots[0].version,decision:'approved'})).status,409);
 assert.equal((await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'record:'+record.id,version:1,decision:'approved'})).status,409);
 assert.equal((await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'mara',version:p.shots[0].version,decision:'approved'})).status,409);
 const state=await call(handler,`/api/projects/${p.id}/production-state`);assert.equal(state.status,200);assert.equal(state.json.production.generationAuthorized,false);assert.equal(state.json.production.nodes.find(n=>n.id==='mara').readyForRouteReview,false);assert.equal(state.json.production.nodes.find(n=>n.id==='train').specificationApproved,true);
 const restored=await createHandler({env}),reopened=await call(restored,`/api/projects/${p.id}/production-records`);assert.equal(reopened.status,200);assert.deepEqual(reopened.json.production,p.production);assert.equal(reopened.json.dependencies.shots.find(s=>s.shotId==='mara').staleBindings.length,1);
 r=await call(restored,`/api/projects/${p.id}`,{expectedVersion:p.version,shots:p.shots.map(s=>s.id==='mara'?{...s,productionBindings:[{recordId:record.id,version:2}]}:s)},{method:'PATCH'});assert.equal(r.status,200);p=r.json.project;
 assert.equal((await call(restored,`/api/projects/${p.id}/approvals`,{artifactId:'mara',version:p.shots[0].version,decision:'approved'})).status,201);assert.deepEqual(p.shots[1],neighbor);
});

test('production library API rejects foreign references and bindings, wrong media and authority injections without changing state',async t=>{
 const {handler}=await setup(t);const p=(await call(handler,'/api/projects',{title:'One project'})).json.project,other=(await call(handler,'/api/projects',{title:'Another project'})).json.project;
 const file={name:'portrait.png',mime:'image/png',role:'character_identity',scope:'project',base64:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')};const uploaded=await call(handler,`/api/projects/${other.id}/assets`,file);assert.equal(uploaded.status,201);
 const command={expectedVersion:p.version,type:'character',name:'Mara',content:{description:'Keeper'},references:[{assetId:uploaded.json.asset.id,version:1}]};assert.equal((await call(handler,`/api/projects/${p.id}/production-records`,command)).status,400);
 assert.equal((await call(handler,`/api/projects/${p.id}/production-records`,{...command,references:[],accepted:true})).status,400);
 const foreign=await call(handler,`/api/projects/${other.id}/production-records`,{...command,expectedVersion:other.version});assert.equal(foreign.status,200);const foreignId=foreign.json.project.production.records[0].id;
 assert.equal((await call(handler,`/api/projects/${p.id}`,{expectedVersion:p.version,shots:[{id:'one',description:'Wait.',duration:5,productionBindings:[{recordId:foreignId,version:1}]}]},{method:'PATCH'})).status,400);
 const own=await call(handler,`/api/projects/${p.id}/assets`,file);assert.equal(own.status,201);assert.equal((await call(handler,`/api/projects/${p.id}/production-records`,{...command,type:'voice',references:[{assetId:own.json.asset.id,version:1}]})).status,400);
 const unchanged=(await call(handler,`/api/projects/${p.id}`)).json.project;assert.equal(unchanged.version,p.version);assert.equal(unchanged.production?.records?.length||0,0);assert.deepEqual(unchanged.shots,[]);
});

test('a current dependent record can be revoked while stale dependency holds still prevent approval',async t=>{
 const {handler}=await setup(t);let p=(await call(handler,'/api/projects',{title:'Revoke held dialogue'})).json.project;
 const record=async body=>{const r=await call(handler,`/api/projects/${p.id}/production-records`,{expectedVersion:p.version,...body});assert.equal(r.status,200);p=r.json.project;return p.production.records.at(-1);};
 const mediaBytes=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVE'),Buffer.alloc(12)]),uploaded=await call(handler,`/api/projects/${p.id}/assets`,{name:'line.wav',mime:'audio/wav',role:'dialogue',scope:'project',base64:mediaBytes.toString('base64')});assert.equal(uploaded.status,201);
 const voice=await record({type:'voice',name:'Keeper voice',content:{language:'English',performance:'Quiet'}});
 const audio=await record({type:'audio',name:'Keeper line',content:{script:'Wait for the train.'},references:[{assetId:uploaded.json.asset.id,version:1}],dependencies:[{recordId:voice.id,version:1}]});
 assert.equal((await call(handler,`/api/projects/${p.id}/approvals`,{artifactId:'record:'+audio.id,version:1,decision:'approved'})).status,201);
 await record({id:voice.id,content:{language:'English',performance:'Urgent'}});
 const before=structuredClone((await call(handler,`/api/projects/${p.id}`)).json.project),approvalPath=`/api/projects/${p.id}/approvals`,decision={artifactId:'record:'+audio.id,version:1};
 assert.equal((await call(handler,approvalPath,{...decision,decision:'approved'})).status,409);
 assert.equal((await call(handler,approvalPath,{...decision,decision:'revoked'})).status,201);
 assert.deepEqual((await call(handler,`/api/projects/${p.id}/assets`)).json.assets[0],uploaded.json.asset);assert.deepEqual((await call(handler,`/api/projects/${p.id}/assets/${uploaded.json.asset.id}/content`)).data,mediaBytes);
 const events=(await call(handler,approvalPath)).json.approvals.filter(a=>a.artifactId===decision.artifactId&&a.version===1);assert.equal(events.at(-1).decision,'revoked');assert.equal(events.at(-2).decision,'approved');
 const after=(await call(handler,`/api/projects/${p.id}`)).json.project;assert.deepEqual(after,before);assert.equal(after.production.records.find(r=>r.id===audio.id).currentVersion,1);
 const graph=(await call(handler,`/api/projects/${p.id}/production-state`)).json.production;assert.equal(graph.nodes.find(n=>n.id===decision.artifactId).specificationApproved,false);assert.ok(graph.nodes.find(n=>n.id===decision.artifactId).holds.length);assert.equal(graph.generationAuthorized,false);
});

// New production types remain normal persisted projects, not implicit paid permissions.
test('all studio formats persist through HTTP creation, reload and explicit edits',async t=>{
 const {PROJECT_FORMATS}=await import('../public/studio-catalog.js');const {handler}=await setup(t);
 for(const format of PROJECT_FORMATS){
  const created=await call(handler,'/api/projects',{title:'Studio '+format,format,premise:'Source material.'});
  assert.equal(created.status,201,format);const project=created.json.project;
  assert.equal((await call(handler,'/api/projects/'+project.id)).json.project.format,format);
  const edited=await call(handler,'/api/projects/'+project.id,{expectedVersion:project.version,format:'documentary'},{method:'PATCH'});
  assert.equal(edited.status,200);assert.equal(edited.json.project.format,'documentary');
 }
 assert.equal((await call(handler,'/api/projects',{title:'Invalid',format:'invented'})).status,400);
 for(const path of ['/studio-shell.css','/studio-shell.js','/studio-catalog.js'])assert.equal((await call(handler,path)).status,200,path);
});

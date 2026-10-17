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

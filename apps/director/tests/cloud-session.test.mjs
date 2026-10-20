import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHandler} from '../server.mjs';
import {SupabaseStore} from '../store.mjs';
import {createAPIClient} from '../public/api-client.js';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',NODE_ENV:'production'};
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const session={access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,user:{id:owner,email:'owner@example.test'}};
async function call(handler,path,body,cookie='',origin){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost','content-type':'application/json',cookie,...(origin?{origin}:{})},socket:{remoteAddress:'127.0.0.1'}});
 let status,headers={},value;const res={setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);this.headersSent=true;},end(v){value=v;}};await handler(req,res);let json;try{json=JSON.parse(String(value));}catch{}return {status,headers,json};
}
function fakeStore(overrides={}){return {user:async token=>token==='valid'?session.user:null,login:async()=>session,refresh:async()=>session,request:async()=>null,...overrides};}
test('login sets separate HttpOnly secure access and refresh cookies without returning tokens',async()=>{
 const h=await createHandler({env,store:fakeStore()});const r=await call(h,'/api/auth/login',{email:'owner@example.test',password:'fixture'});
 assert.equal(r.status,200);assert.equal(r.headers['Set-Cookie'].length,2);assert.match(r.headers['Set-Cookie'][0],/director_session=new-access; Path=\/; HttpOnly; SameSite=Strict; Max-Age=3600; Secure/);assert.match(r.headers['Set-Cookie'][1],/director_refresh=new-refresh; Path=\/api; HttpOnly/);assert.ok(!JSON.stringify(r.json).includes('new-access'));
});
test('refresh rotates both cookies and rejects cross-origin requests before transport',async()=>{
 let calls=0;const h=await createHandler({env,store:fakeStore({refresh:async token=>{calls++;assert.equal(token,'old-refresh');return session;}})});
 const r=await call(h,'/api/auth/refresh',{},'director_refresh=old-refresh');assert.equal(r.status,200);assert.match(r.headers['Set-Cookie'][1],/new-refresh/);
 assert.equal((await call(h,'/api/auth/refresh',{},'director_refresh=old-refresh','https://other.example')).status,403);assert.equal(calls,1);
});
test('invalid refresh clears both cookies; provider outages preserve them for recovery',async()=>{
 for(const status of [401,502]){
 const h=await createHandler({env,store:fakeStore({refresh:async()=>{throw Object.assign(Error('upstream'),{status});}})});
 const r=await call(h,'/api/auth/refresh',{},'director_refresh=expired');assert.equal(r.status,status);
 if(status===401){assert.equal(r.headers['Set-Cookie'].length,2);assert.ok(r.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));}else assert.equal(r.headers['Set-Cookie'],undefined);
 }
});
test('logout revokes only current session and clears refresh cookie even after access expiry',async()=>{
 const calls=[];const h=await createHandler({env,store:fakeStore({request:async(path,options)=>calls.push({path,token:options.token})})});
 const r=await call(h,'/api/auth/logout',{},'director_session=expired; director_refresh=old-refresh');assert.equal(r.status,200);assert.deepEqual(calls,[{path:'/auth/v1/logout?scope=local',token:'new-access'}]);assert.ok(r.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));
});
test('refresh transport uses Supabase Auth and maps rejected refresh to reauthentication',async()=>{
 const requests=[];const store=new SupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,fetcher:async(url,options)=>{requests.push({url,options});return {ok:false,status:400,json:async()=>({message:'Invalid refresh token'})};}});
 await assert.rejects(()=>store.refresh('old-refresh'),e=>e.status===401);assert.equal(requests[0].url,'https://fixture.supabase.co/auth/v1/token?grant_type=refresh_token');assert.deepEqual(JSON.parse(requests[0].options.body),{refresh_token:'old-refresh'});
});
test('concurrent client 401 responses share one refresh and retry only once',async()=>{
 let refreshes=0,ready=false;const attempts={};const api=createAPIClient({fetcher:async path=>{
 if(path==='/api/auth/refresh'){refreshes++;await new Promise(resolve=>setTimeout(resolve,10));ready=true;return {ok:true,status:200,json:async()=>({})};}
 attempts[path]=(attempts[path]||0)+1;return {ok:ready,status:ready?200:401,json:async()=>ready?{ok:true}:{error:'expired'}};
 }});await Promise.all([api('/api/projects'),api('/api/skills')]);assert.equal(refreshes,1);assert.deepEqual(attempts,{'/api/projects':2,'/api/skills':2});
});
test('unknown network or provider outcomes never replay application mutations',async()=>{
 for(const mode of ['network','upstream']){let calls=0;const api=createAPIClient({fetcher:async()=>{calls++;if(mode==='network')throw Error('Network lost');return {ok:false,status:502,json:async()=>({error:'Submission unknown'})};}});await assert.rejects(()=>api('/api/projects/p/jobs',{method:'POST',body:{}}));assert.equal(calls,1);}
 let calls=0;const api=createAPIClient({fetcher:async path=>{calls++;return {ok:path==='/api/auth/refresh',status:path==='/api/auth/refresh'?200:401,json:async()=>({error:'expired'})};}});await assert.rejects(()=>api('/api/projects'),e=>e.status===401);assert.equal(calls,3);
});
test('cloud adapter scopes project requests by the verified account and omits foreign projects',async()=>{
 const project={id:'33333333-3333-4333-8333-333333333333',owner_id:owner,title:'Private',stage:'brief',brief:{version:1}};const urls=[];
 const store=new SupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,fetcher:async url=>{urls.push(url);return {ok:true,status:200,json:async()=>url.includes('owner_id=eq.'+owner)?[project]:[]};}});
 assert.equal((await store.list(owner)).length,1);assert.equal((await store.list(other)).length,0);await assert.rejects(()=>store.get(project.id,other),e=>e.status===404);assert.ok(urls.every(url=>url.includes('owner_id=eq.')));
});
test('authenticated API selects verified owner and rejects cross-account project access',async()=>{
 const {LocalStore}=await import('../store.mjs');const store=await new LocalStore().init();
 store.user=async token=>token==='owner-token'?{id:owner,user_metadata:{isAdmin:true}}:token==='other-token'?{id:other}:null;
 const h=await createHandler({env,store});const created=await call(h,'/api/projects',{title:'Private cloud-path fixture'},'director_session=owner-token');assert.equal(created.status,201);const id=created.json.project.id;
 assert.equal((await call(h,`/api/projects/${id}`,undefined,'director_session=other-token')).status,404);
 assert.equal((await call(h,'/api/projects',undefined,'director_session=other-token')).json.projects.length,0);
 assert.equal((await call(h,'/api/admin/overview',undefined,'director_session=owner-token')).status,403);
 const config=await call(h,'/api/config',undefined,'director_session=expired; director_refresh=fixture-private-refresh');assert.equal(config.json.session.refreshAvailable,true);assert.equal(config.json.user,null);assert.ok(!JSON.stringify(config.json).includes('fixture-private-refresh'));
});
test('Supabase approval history resolves immutable artifact versions in explicit event order',async()=>{
 const urls=[];const store=new SupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,fetcher:async url=>{urls.push(url);return {ok:true,status:200,json:async()=>Number(new URL(url).searchParams.get('offset'))>0?[]:url.includes('director_artifacts')?[{id:'artifact',logical_key:'story',version:3}]:[{artifact_id:'artifact',project_id:'project',actor_id:owner,decision:'revoked',ordinal:2}]};}});
 const rows=await store.records('approvals','project');assert.equal(rows[0].artifactId,'story');assert.equal(rows[0].version,3);assert.equal(rows[0].decision,'revoked');assert.ok(urls[0].includes('order=ordinal.asc'));assert.ok(urls[0].includes('offset=0'));
});
test('approval pagination retains later revocations even when provider row cap is below requested page size',async()=>{
 const calls=[];const events=[{artifact_id:'a',project_id:'p',decision:'approved',ordinal:1},{artifact_id:'a',project_id:'p',decision:'revoked',ordinal:2}];
 const store=new SupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,fetcher:async url=>{calls.push(url);const offset=Number(new URL(url).searchParams.get('offset'));const list=url.includes('director_artifacts')?[{id:'a',logical_key:'story',version:1}]:events;return {ok:true,status:200,json:async()=>list.slice(offset,offset+1)};}});
 const rows=await store.records('approvals','p');assert.equal(rows.length,2);assert.equal(rows.at(-1).decision,'revoked');assert.ok(calls.some(url=>url.includes('director_approvals')&&url.includes('offset=2')));
});

test('signup preserves confirmation requirements without returning credentials or granting a session',async()=>{
 let requests=0;const h=await createHandler({env,store:fakeStore({signup:async()=>{requests++;return {id:owner,email:'new@example.test'};}})});
 const r=await call(h,'/api/auth/signup',{email:'new@example.test',password:'fixture-password'});
 assert.equal(r.status,200);assert.equal(r.json.confirmationRequired,true);assert.equal(r.headers['Set-Cookie'],undefined);assert.equal(requests,1);assert.ok(!JSON.stringify(r.json).includes(owner));
});
test('signup uses secure session cookies only when Auth returns a complete confirmed session',async()=>{
 const h=await createHandler({env,store:fakeStore({signup:async()=>session})});
 const r=await call(h,'/api/auth/signup',{email:'new@example.test',password:'fixture-password'});
 assert.equal(r.status,200);assert.equal(r.json.confirmationRequired,false);assert.equal(r.headers['Set-Cookie'].length,2);assert.ok(r.headers['Set-Cookie'].every(c=>c.includes('HttpOnly')&&c.includes('Secure')));assert.ok(!JSON.stringify(r.json).includes(session.access_token));
});
test('signup rejects bad inputs, cross-origin requests and repeated submissions before calling Auth',async()=>{
 let calls=0;const h=await createHandler({env,store:fakeStore({signup:async()=>{calls++;return {id:owner};}})});
 assert.equal((await call(h,'/api/auth/signup',{email:'bad',password:'short'})).status,400);
 assert.equal((await call(h,'/api/auth/signup',{email:'new@example.test',password:'fixture-password'},'', 'https://other.example')).status,403);assert.equal(calls,0);
 for(let i=0;i<8;i++)assert.equal((await call(h,'/api/auth/signup',{email:'new@example.test',password:'fixture-password'})).status,200);
 assert.equal((await call(h,'/api/auth/signup',{email:'other@example.test',password:'fixture-password'})).status,429);assert.equal(calls,8);
});
test('signup transport uses normal Auth signup without administrative confirmation or user metadata',async()=>{
 let request;const store=new SupabaseStore({url:env.SUPABASE_URL,key:'fixture-key',fetcher:async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({id:owner})};}});
 await store.signup('new@example.test','fixture-password');assert.equal(request.url,'https://fixture.supabase.co/auth/v1/signup');assert.deepEqual(JSON.parse(request.options.body),{email:'new@example.test',password:'fixture-password'});
});

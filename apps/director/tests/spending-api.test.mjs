import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createHandler} from '../server.mjs';
import {LocalStore} from '../store.mjs';
import {hash} from '../domain.mjs';
import {reviewedFalInputSchema} from '../providers.mjs';
import {candidateEndpointManifest} from '../routing-task-catalog.mjs';

async function call(handler,path,body,method=body===undefined?'GET':'POST'){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 Object.assign(req,{url:path,method,headers:{host:'localhost','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
 let status,data;const res={setHeader(){},writeHead(value){status=value;this.headersSent=true;},end(value){data=value;}};
 await handler(req,res);return {status,json:JSON.parse(String(data))};
}
function model(){const endpoint=candidateEndpointManifest.M09;return {id:'M09',provider:'fal',endpoint,model_version:'test-v1',active:true,execution_tested:true,quality_validated:true,capabilities:{tasks:['image_edit'],outputModalities:['image'],inputModes:['image','text'],aspectRatios:['1:1'],resolutions:['1024x1024'],languages:['English'],priority:1,identityReferences:true},schema_evidence:{verified:true,version:'schema-1',sourceUrl:'https://example.com/schema',expiresAt:'2099-01-01T00:00:00Z',endpoint,modelVersion:'test-v1',inputSchemaHash:hash(reviewedFalInputSchema(endpoint))},price_version:'price-1',price_evidence:{verified:true,version:'price-1',currency:'USD',unit:'image',unitMicroUsd:25000,rounding:'ceil',expiresAt:'2099-01-01T00:00:00Z',sourceUrl:'https://example.com/pricing',configurationVerified:true,configuration:{num_images:1}}};}
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'director-spending-api-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'state.json');const store=await new LocalStore(file).init();store.state.models=[model()];let calls=0;const providers={planFilm:async()=>{calls++;throw Error('Unexpected provider execution.');}};const create=store=>createHandler({env:{DIRECTOR_DEMO:'1'},store,providers});const handler=await create(store);const p=(await call(handler,'/api/projects',{title:'Spending boundaries',premise:'An empty station.'})).json.project;return {store,file,handler,p,create,calls:()=>calls};}
function quote(p,requestId){return {task:'image_edit',requirements:{modality:'image',inputModes:['image','text'],aspectRatio:'1:1'},expectedVersion:p.version,modelId:'M09',artifactId:'story',artifactVersion:p.story.version,input:{prompt:'PRIVATE SCRIPT TEXT',image_urls:['https://cdn.example/private-reference.png'],num_images:1,image_size:{width:1024,height:1024}},...(requestId?{requestId}:{})};}
function authorization(p,quoteId,extra={}){return {requestId:randomUUID(),expectedVersion:p.version,quoteId,maxMicroUsd:30000,finishReserveMicroUsd:5000,...extra};}
async function persist(f){const body=quote(f.p,randomUUID()),r=await call(f.handler,`/api/projects/${f.p.id}/quotes`,body);assert.equal(r.status,201,JSON.stringify(r.json));return {body,q:r.json.quote};}
function noPrivateData(value){const text=JSON.stringify(value);for(const secret of ['PRIVATE SCRIPT TEXT','private-reference.png','priceConfiguration','unitMicroUsd','schemaEvidence','priceEvidence'])assert.ok(!text.includes(secret),secret);}

test('persistent quotes, cost authorization and revocation survive real LocalStore restarts without generation',async t=>{
 const f=await fixture(t),base=`/api/projects/${f.p.id}`;const preview=await call(f.handler,`${base}/quotes`,quote(f.p));assert.equal(preview.status,200);assert.equal((await call(f.handler,`${base}/spending`)).json.quotes.length,0);
 const {q}=await persist(f);assert.ok(q.id);const body=authorization(f.p,q.id);const response=await call(f.handler,`${base}/spending-authorizations`,body);assert.equal(response.status,200,JSON.stringify(response.json));assert.equal(response.json.authorization.status,'authorized');assert.equal(response.json.authorization.generationAuthorized,false);
 const restored=await new LocalStore(f.file).init(),handler=await f.create(restored);assert.deepEqual(await call(handler,`${base}/spending-authorizations`,body),response);const spending=await call(handler,`${base}/spending`);assert.equal(spending.status,200);assert.equal(spending.json.quotes.length,1);assert.equal(spending.json.authorizations.length,1);assert.deepEqual(spending.json.reservations,[]);noPrivateData(spending.json);
 const revoke={requestId:randomUUID(),expectedVersion:f.p.version,reason:'Changed creative direction.'};const revoked=await call(handler,`${base}/spending-authorizations/${response.json.authorization.id}/revoke`,revoke);assert.equal(revoked.status,200);assert.equal(revoked.json.authorization.status,'revoked');
 restored.state.projects[0].version++;assert.deepEqual(await call(handler,`${base}/spending-authorizations/${response.json.authorization.id}/revoke`,revoke),revoked);const restarted=await new LocalStore(f.file).init();assert.equal((await call(await f.create(restarted),`${base}/spending`)).json.authorizations[0].status,'revoked');assert.deepEqual(restarted.state.jobs,[]);assert.equal(f.calls(),0);
});

test('spending commands reject tenant access, forged fields and insufficient cap plus finishing reserve',async t=>{
 const f=await fixture(t),base=`/api/projects/${f.p.id}`,{q}=await persist(f);const foreign={...structuredClone(f.p),id:randomUUID(),ownerId:'different-owner'};await f.store.create(foreign);
 for(const [path,body] of [[`/api/projects/${foreign.id}/spending`,undefined],[`/api/projects/${foreign.id}/quotes`,quote(f.p,randomUUID())],[`/api/projects/${foreign.id}/spending-authorizations`,authorization(f.p,q.id)],[`/api/projects/${foreign.id}/spending-authorizations/${randomUUID()}/revoke`,{requestId:randomUUID(),expectedVersion:f.p.version,reason:'Do not authorize.'}]])assert.equal((await call(f.handler,path,body)).status,404);
 for(const extra of [{maxMicroUsd:29999},{finishReserveMicroUsd:-1},{maxMicroUsd:0},{maxMicroUsd:Number.MAX_SAFE_INTEGER+1},{actorId:'forged'},{generationAuthorized:true},{input:{prompt:'forged'}},{quote:{totalMicroUsd:1}}])assert.equal((await call(f.handler,`${base}/spending-authorizations`,authorization(f.p,q.id,extra))).status,400);
 assert.equal((await call(f.handler,`${base}/spending-authorizations`,authorization(f.p,q.id,{expectedVersion:f.p.version+1}))).status,409);assert.equal(f.calls(),0);assert.deepEqual(f.store.state.jobs,[]);
});

test('authorizations reject changed creative content, stored payload and trusted model evidence',async t=>{
 for(const mutate of [f=>{f.store.state.projects[0].story.treatment='Changed after quote.';},f=>{f.store.state.quotes[0].input.prompt='Tampered payload';},f=>{f.store.state.models[0].price_evidence.unitMicroUsd=1;},f=>{f.store.state.models[0].schema_evidence.inputSchemaHash='changed';},f=>{f.store.state.models[0].quality_validated=false;},f=>{f.store.state.quotes[0].quote.expiresAt='2000-01-01T00:00:00Z';}]){
 const f=await fixture(t),{q}=await persist(f);mutate(f);const r=await call(f.handler,`/api/projects/${f.p.id}/spending-authorizations`,authorization(f.p,q.id));assert.equal(r.status,409,JSON.stringify(r.json));assert.equal(f.calls(),0);assert.deepEqual(f.store.state.jobs,[]);
 }
});

test('persisted quote and authorization retries remain idempotent after expiry and project version changes',async t=>{
 const f=await fixture(t),base=`/api/projects/${f.p.id}`,{q,body}=await persist(f);const command=authorization(f.p,q.id);const first=await call(f.handler,`${base}/spending-authorizations`,command);assert.equal(first.status,200);
 f.store.state.projects[0].version++;f.store.state.quotes[0].quote.expiresAt='2000-01-01T00:00:00Z';f.store.state.models[0].active=false;
 const replay=await call(f.handler,`${base}/quotes`,body);assert.equal(replay.status,200);assert.deepEqual(replay.json.quote,q);assert.deepEqual(await call(f.handler,`${base}/spending-authorizations`,command),first);
 assert.equal((await call(f.handler,`${base}/spending-authorizations`,{...command,maxMicroUsd:40000})).status,409);
 assert.equal((await call(f.handler,`${base}/quotes`,{...body,input:{...body.input,prompt:'Different payload'}})).status,409);
 assert.equal((await call(f.handler,`${base}/spending`)).json.authorizations.length,1);assert.equal(f.calls(),0);
});

test('quote API accepts an explicit intent without authorizing media work',async t=>{
 const f=await fixture(t);f.store.state.models[0].routing_profiles=[{verified:true,task:'image_edit',modelId:'M09',modelVersion:'test-v1',endpoint:candidateEndpointManifest.M09,evidenceVersion:'eval-1',sourceUrl:'https://example.com/evaluation',evaluatedAt:'2026-10-17T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z',sampleCount:20,purposes:['narrative film'],scores:{}}];const request={...quote(f.p),intent:{purpose:'narrative film'}};const r=await call(f.handler,`/api/projects/${f.p.id}/quotes`,request);assert.equal(r.status,200,JSON.stringify(r.json));assert.deepEqual(r.json.quote.intent,request.intent);assert.equal(r.json.quote.generationAuthorized,false);assert.equal(f.calls(),0);
});


test('failed durable write cannot leave an authorization committed only in memory',async t=>{
 const f=await fixture(t),{q}=await persist(f);const before=structuredClone(f.store.state);f.store.file=join(f.file,'impossible-child.json');
 const r=await call(f.handler,`/api/projects/${f.p.id}/spending-authorizations`,authorization(f.p,q.id));assert.equal(r.status,500);assert.deepEqual(f.store.state,before);assert.equal(f.calls(),0);
});

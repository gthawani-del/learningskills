import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
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
function fixtureModel(){const endpoint=candidateEndpointManifest.M09;return {id:'M09',provider:'fal',endpoint,model_version:'test-v1',active:true,execution_tested:true,quality_validated:true,capabilities:{tasks:['image_edit'],outputModalities:['image'],inputModes:['image','text'],aspectRatios:['1:1'],resolutions:['1024x1024'],languages:['English'],priority:1,identityReferences:true},schema_evidence:{verified:true,version:'schema-1',sourceUrl:'https://example.com/schema',expiresAt:'2099-01-01T00:00:00Z',endpoint,modelVersion:'test-v1',inputSchemaHash:hash(reviewedFalInputSchema(endpoint))},price_version:'price-1',price_evidence:{verified:true,version:'price-1',currency:'USD',unit:'image',unitMicroUsd:25000,rounding:'ceil',expiresAt:'2099-01-01T00:00:00Z',sourceUrl:'https://example.com/pricing',configurationVerified:true,configuration:{num_images:1}}};}
async function setup(){const store=await new LocalStore().init();store.state.models=[fixtureModel()];let providerCalls=0;const handler=await createHandler({env:{DIRECTOR_DEMO:'1'},store,providers:{planFilm:async()=>{providerCalls++;throw Error('Provider execution is forbidden in quote tests.');}}});const p=(await call(handler,'/api/projects',{title:'Quote test',premise:'A quiet station.'})).json.project;return {store,handler,p,providerCalls:()=>providerCalls};}
const routeRequest={task:'image_edit',requirements:{modality:'image',inputModes:['image','text'],aspectRatio:'1:1'}};
function quoteRequest(p){return {...routeRequest,expectedVersion:p.version,modelId:'M09',artifactId:'story',artifactVersion:p.story.version,input:{prompt:'An empty station at dawn.',image_urls:['https://cdn.example/ref.png'],num_images:1,image_size:{width:1024,height:1024}}};}

test('routing lists tasks and filters trusted registry candidates without provider work',async()=>{
 const {handler,p,providerCalls}=await setup();const path=`/api/projects/${p.id}/routes`;
 const listing=await call(handler,path);assert.equal(listing.status,200);assert.ok(Array.isArray(listing.json.tasks));assert.ok(listing.json.tasks.length>0);
 const selected=await call(handler,path,routeRequest);assert.equal(selected.status,200);assert.equal(selected.json.task,'image_edit');assert.ok(selected.json.eligibleForQuote.includes('M09'));assert.deepEqual(selected.json.candidates.find(c=>c.modelId==='M09').holds,[]);
 assert.equal(providerCalls(),0);
});

test('quote binds current artifact and trusted price while never authorizing generation',async()=>{
 const {handler,store,p,providerCalls}=await setup();const before=structuredClone(store.state);const r=await call(handler,`/api/projects/${p.id}/quotes`,quoteRequest(p));
 assert.equal(r.status,200);assert.equal(r.json.quote.estimateOnly,true);assert.equal(r.json.quote.generationAuthorized,false);assert.equal(r.json.quote.projectId,p.id);assert.equal(r.json.quote.artifactVersion,p.story.version);assert.equal(r.json.quote.units,1);assert.equal(r.json.quote.totalMicroUsd,25000);assert.ok(r.json.quote.artifactContentHash);assert.ok(r.json.quote.payloadHash);assert.equal(providerCalls(),0);assert.deepEqual(store.state.jobs,before.jobs);assert.deepEqual(store.state.projects,before.projects);
});

test('routing and quote boundaries reject authority injection and stale or unavailable candidates',async()=>{
 const {handler,store,p}=await setup();const routes=`/api/projects/${p.id}/routes`,quotes=`/api/projects/${p.id}/quotes`,valid=quoteRequest(p);
 for(const extra of [{price:1},{actorId:'attacker'},{unknown:true}])assert.equal((await call(handler,quotes,{...valid,...extra})).status,400);
 assert.equal((await call(handler,routes,{...routeRequest,actorId:'attacker'})).status,400);
 assert.equal((await call(handler,routes,{task:'image_edit',requirements:{...routeRequest.requirements,price:1}})).status,400);
 assert.equal((await call(handler,quotes,{...valid,input:{...valid.input,price:1}})).status,400);
 assert.equal((await call(handler,quotes,{...valid,expectedVersion:p.version+1})).status,409);
 assert.equal((await call(handler,quotes,{...valid,artifactVersion:p.story.version+1})).status,409);
 assert.equal((await call(handler,quotes,{...valid,modelId:'missing'})).status,409);
 store.state.models[0].quality_validated=false;
 const held=await call(handler,routes,routeRequest);assert.equal(held.status,200);assert.deepEqual(held.json.eligibleForQuote,[]);assert.ok(held.json.candidates[0].holds.includes('quality_validated_required'));
 assert.equal((await call(handler,quotes,valid)).status,409);
});

test('routing and quotes cannot cross owners or mutate a pending import',async()=>{
 const {handler,store,p}=await setup();await store.create({...structuredClone(p),id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ownerId:'another-owner'});
 for(const action of ['routes','quotes'])assert.equal((await call(handler,`/api/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/${action}`,action==='routes'?routeRequest:quoteRequest(p))).status,404);
 const started=await call(handler,'/api/imports',{sourceId:'device-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',project:{title:'Pending',premise:'A wait.',story:{treatment:'Waiting.',scenes:[]},shots:[]},assets:[]});assert.equal(started.status,200);const pending=started.json.project;
 for(const action of ['routes','quotes'])assert.equal((await call(handler,`/api/projects/${pending.id}/${action}`,action==='routes'?routeRequest:quoteRequest(pending))).status,409);
});


test('quote rejects contradictory payload requirements and untrusted adapter or configuration evidence',async()=>{
 const {handler,store,p,providerCalls}=await setup();const path=`/api/projects/${p.id}/quotes`,valid=quoteRequest(p);const before=structuredClone(store.state);store.state.models[0].capabilities.aspectRatios.push('16:9');store.state.models[0].capabilities.minDurationSeconds=1;store.state.models[0].capabilities.maxDurationSeconds=10;
 for(const requirements of [{...routeRequest.requirements,aspectRatio:'16:9'},{...routeRequest.requirements,durationSeconds:5}])assert.equal((await call(handler,path,{...valid,requirements})).status,400);
 store.state.models[0].schema_evidence.inputSchemaHash='unreviewed-hash';assert.equal((await call(handler,path,valid)).status,409);
 store.state.models[0]=fixtureModel();store.state.models[0].endpoint='unreviewed/image/adapter';store.state.models[0].schema_evidence.endpoint='unreviewed/image/adapter';assert.equal((await call(handler,path,valid)).status,409);
 store.state.models[0]=fixtureModel();store.state.models[0].price_evidence.configuration={num_images:2};assert.equal((await call(handler,path,valid)).status,409);
 assert.equal(providerCalls(),0);assert.deepEqual(store.state.projects,before.projects);assert.deepEqual(store.state.jobs,before.jobs);
});

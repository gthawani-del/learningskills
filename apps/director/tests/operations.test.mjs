import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server.mjs';
import {LocalStore} from '../store.mjs';
import {staffRole} from '../operations.mjs';
const ids={owner:'11111111-1111-4111-8111-111111111111',operator:'22222222-2222-4222-8222-222222222222',reviewer:'33333333-3333-4333-8333-333333333333',support:'44444444-4444-4444-8444-444444444444',customer:'55555555-5555-4555-8555-555555555555'};
async function call(handler,path,actor,body){const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost','content-type':'application/json',...(actor?{cookie:'director_session='+actor}:{})},socket:{remoteAddress:'127.0.0.1'}});let status,data;const res={setHeader(){},writeHead(s){status=s;this.headersSent=true;},end(b){data=b;}};await handler(req,res);return {status,json:JSON.parse(String(data))};}
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'director-ops-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=await new LocalStore(join(dir,'projects.json')).init();store.state.models=[{id:'M17',provider:'fal',endpoint:'example/endpoint',active:true,execution_tested:true,quality_validated:true,price_version:'v1',capabilities:{purpose:'Reference video'}}];store.user=async id=>({id,email:'staff@example.invalid',user_metadata:{isAdmin:true,role:'owner'}});const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'not-a-real-key',DIRECTOR_ADMIN_IDS:ids.owner,DIRECTOR_OPERATOR_IDS:ids.operator,DIRECTOR_REVIEWER_IDS:ids.reviewer,DIRECTOR_SUPPORT_IDS:ids.support};return {store,env,handler:await createHandler({env,store})};}
const pause=(revision=1)=>({requestId:randomUUID(),expectedRevision:revision,command:'pause_generation',reason:'Investigate provider reliability.'});
test('staff permissions are server-derived; customers and user metadata cannot grant access',async t=>{
 const {handler,env}=await setup(t);assert.equal(staffRole(ids.customer,env),null);
 assert.equal((await call(handler,'/api/admin/control')).status,401);assert.equal((await call(handler,'/api/admin/control',ids.customer)).status,403);
 for(const role of ['owner','operator','reviewer','support']){const r=await call(handler,'/api/admin/control',ids[role]);assert.equal(r.status,200);assert.equal(r.json.role,role);assert.equal(r.json.generationEnabled,false);assert.equal(r.json.control.generationPaused,true);}
 assert.equal((await call(handler,'/api/admin/audit',ids.reviewer)).status,403);assert.equal((await call(handler,'/api/admin/registry',ids.support)).status,403);assert.equal((await call(handler,'/api/admin/commands',ids.support,pause())).status,403);
 assert.equal((await call(handler,'/api/config',ids.customer)).json.user.isAdmin,false);
});
test('lost-response replay and concurrent retries produce one durable command and one revision',async t=>{
 const {handler,store}=await setup(t),body=pause();const results=await Promise.all(Array.from({length:5},()=>call(handler,'/api/admin/commands',ids.operator,body)));
 assert.ok(results.every(r=>r.status===200));assert.equal(results.filter(r=>!r.json.replayed).length,1);assert.equal(store.state.adminCommands.length,1);assert.equal((await store.generationControl()).revision,2);
 assert.equal((await call(handler,'/api/admin/commands',ids.operator,{...body,reason:'Different reason for same identity.'})).status,409);assert.equal((await call(handler,'/api/admin/commands',ids.owner,body)).status,409);
 assert.equal((await call(handler,'/api/admin/commands',ids.owner,pause(1))).status,409);assert.equal(store.state.adminCommands.length,1);
 const restored=await new LocalStore(store.file).init();assert.equal((await restored.generationControl()).revision,2);assert.equal((await restored.operationalAudit()).length,1);
});
test('two distinct commands with the same revision cannot overwrite each other',async t=>{
 const {handler,store}=await setup(t);const results=await Promise.all([call(handler,'/api/admin/commands',ids.owner,pause()),call(handler,'/api/admin/commands',ids.operator,pause())]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(store.state.adminCommands.length,1);
});
test('registry commands disable routes or edit notes without granting execution or changing endpoints',async t=>{
 const {handler,store}=await setup(t),original=structuredClone(store.state.models[0]);
 const notes={requestId:randomUUID(),expectedRevision:1,command:'update_model_notes',reason:'Document intended reference workflow.',modelId:'M17',notes:'Use approved identity references.'};
 assert.equal((await call(handler,'/api/admin/commands',ids.operator,notes)).status,403);assert.equal((await call(handler,'/api/admin/commands',ids.owner,{...notes,active:true})).status,400);
 assert.equal((await call(handler,'/api/admin/commands',ids.owner,notes)).status,200);const model=store.state.models[0];assert.deepEqual(model,{...original,capabilities:{...original.capabilities,admin_notes:notes.notes}});
 const disable={requestId:randomUUID(),expectedRevision:2,command:'disable_model',reason:'Route failed a review check.',modelId:'M17'};assert.equal((await call(handler,'/api/admin/commands',ids.operator,disable)).status,200);assert.equal(model.active,false);assert.equal(model.endpoint,original.endpoint);assert.equal(model.execution_tested,true);assert.equal((await store.generationControl()).generationPaused,true);
 const audit=(await call(handler,'/api/admin/audit',ids.owner)).json.commands;assert.equal(audit.length,2);assert.equal(audit[0].before.active,true);assert.equal(audit[0].after.active,false);assert.equal(audit[1].after.notes,notes.notes);assert.equal(audit[0].request,undefined);assert.equal(audit[0].after.endpoint,undefined);
});
test('resume, activation, role injection and malformed commands cannot mutate controls',async t=>{
 const {handler,store}=await setup(t),before=structuredClone(store.state);
 for(const command of ['resume_generation','activate_model','grant_role'])assert.equal((await call(handler,'/api/admin/commands',ids.owner,{...pause(),command})).status,403);
 for(const body of [{...pause(),actorRole:'owner'},{...pause(),requestId:'bad'},{...pause(),expectedRevision:0},{...pause(),reason:'x'},{...pause(),modelId:'M17'}])assert.equal((await call(handler,'/api/admin/commands',ids.owner,body)).status,400);
 assert.deepEqual(store.state,before);
});

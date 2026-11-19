import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {createHandler} from '../server.mjs';
import {LocalStore} from '../store.mjs';
import {newProject} from '../domain.mjs';

async function fixture(){const store=await new LocalStore().init();store.user=async token=>({id:token,email:'fixture@example.test'});const p=newProject({format:'music_video',title:'Song'},'owner');await store.create(p);let calls=0;const deny=async()=>{calls++;throw Error('No paid calls allowed');};const handler=await createHandler({env:{NODE_ENV:'test'},store,planningProvider:{submit:deny,poll:deny}});return {store,p,handler,calls:()=>calls};}
async function call(f,path,body,token='owner',method=body===undefined?'GET':'POST'){const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method,headers:{host:'localhost','content-type':'application/json',...(token?{cookie:'director_session='+token}:{})},socket:{remoteAddress:'127.0.0.1'}});let status,data;const res={setHeader(){},writeHead(s){status=s;this.headersSent=true;},end(v){data=v;}};await f.handler(req,res);return {status,json:JSON.parse(String(data))};}

test('owned session endpoints persist messages and replay without generation or approvals',async()=>{
 const f=await fixture(),path=`/api/projects/${f.p.id}/director-session`;assert.equal((await call(f,path)).status,200);
 const c={requestId:randomUUID(),expectedVersion:1,action:'append_user_message',text:'Make the chorus hopeful.'};
 const saved=await call(f,path,c);assert.equal(saved.status,200);assert.equal(saved.json.project.directorSession.messages.length,1);
 assert.deepEqual(await call(f,path,c),saved);assert.equal((await call(f,path)).json.session.messages[0].text,c.text);
 assert.equal(f.calls(),0);assert.equal(f.store.state.approvals.length,0);assert.equal(f.store.state.jobs.length,0);
});
test('sessions enforce account isolation, stale writes and PATCH protection',async()=>{
 const f=await fixture(),path=`/api/projects/${f.p.id}/director-session`;
 assert.equal((await call(f,path,undefined,null)).status,401);assert.equal((await call(f,path,undefined,'other')).status,404);
 const c={requestId:randomUUID(),expectedVersion:1,action:'set_mode',mode:'create_with_me'};assert.equal((await call(f,path,c)).status,200);
 assert.equal((await call(f,path,{...c,requestId:randomUUID()})).status,409);
 assert.equal((await call(f,`/api/projects/${f.p.id}`,{directorSession:{}},'owner','PATCH')).status,400);
});

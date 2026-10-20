import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {LocalStore,SupabaseStore} from '../store.mjs';
import {createMediaIngestion,sourceUploadManifest,SOURCE_UPLOAD_MAX_BYTES} from '../media-ingestion.mjs';
import {createMediaStorage} from '../media-storage.mjs';
import {createHandler} from '../server.mjs';
import {sourceFileManifest,transferSourceFile} from '../public/source-upload.js';
const owner=randomUUID(),foreign=randomUUID(),project={id:randomUUID(),ownerId:owner,shots:[{id:randomUUID()}]};
const manifest=()=>({requestId:randomUUID(),name:'song.wav',mime:'audio/wav',size:7*1024*1024,sha256:'a'.repeat(64),role:'master_song',scope:'project',shotId:null});
async function setup({file,storage:overrides={}}={}){const store=await new LocalStore(file).init();if(!store.state.projects.length)await store.create(project);const calls=[];const storage={signUpload:async(key,opts)=>{calls.push({key,opts});return {token:'scoped-secret'};},info:async()=>({size:7*1024*1024,mime:'audio/wav'}),...overrides};return {store,calls,controller:createMediaIngestion({store,storage,enabled:true}),storage};}
const status=code=>e=>e.status===code;
test('source manifests reject unsafe inputs, oversize files, wrong song types and nonexistent shots',()=>{
 assert.equal(sourceUploadManifest(manifest(),project).role,'master_song');
 for(const changes of [{requestId:'../x'},{storageKey:'evil'},{size:SOURCE_UPLOAD_MAX_BYTES+1},{size:0},{size:1.5},{sha256:'xx'},{mime:'application/javascript'},{name:'x\0y'},{role:'unknown'},{scope:'shot',shotId:randomUUID()},{mime:'video/mp4'},{shotId:project.shots[0].id}])assert.throws(()=>sourceUploadManifest({...manifest(),...changes},project),status(400));
});
test('creation is idempotent under concurrent retries and rejects changed request contents',async()=>{
 const {controller,store}=await setup(),body=manifest();const results=await Promise.all(Array.from({length:6},()=>controller.start(owner,project,body)));assert.equal(new Set(results.map(r=>r.upload.id)).size,1);assert.equal(store.state.sourceUploads.length,1);await assert.rejects(()=>controller.start(owner,project,{...body,name:'other.wav'}),status(409));assert.equal(store.state.assets.length,0);assert.ok(!JSON.stringify(results).includes('storageKey'));assert.ok(!JSON.stringify(results).includes('ownerId'));
});
test('receipts survive a store restart and remain pending after verified transport',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'director-ingestion-'));try{const first=await setup({file:join(dir,'data.json')}),{upload}=await first.controller.start(owner,project,manifest());const restarted=await setup({file:join(dir,'data.json')});assert.equal((await restarted.controller.list(owner,project)).uploads[0].id,upload.id);const result=await restarted.controller.complete(owner,project,upload.id);assert.equal(result.upload.status,'inspection_pending');assert.equal(result.upload.ready,false);assert.equal((await restarted.controller.complete(owner,project,upload.id)).upload.status,'inspection_pending');assert.equal(restarted.store.state.assets.length,0);assert.equal(restarted.store.state.approvals.length,0);assert.equal(restarted.store.state.jobs.length,0);}finally{await rm(dir,{recursive:true,force:true});}
});
test('owner/project isolation is enforced for list, ticket, completion and cancellation',async()=>{
 const {controller,calls}=await setup(),{upload}=await controller.start(owner,project,manifest());for(const fn of [()=>controller.list(foreign,project),()=>controller.ticket(foreign,project,upload.id),()=>controller.complete(foreign,project,upload.id),()=>controller.cancel(foreign,project,upload.id),()=>controller.ticket(owner,{id:randomUUID()},upload.id)])await assert.rejects(fn,status(404));assert.equal(calls.length,0);
});
test('completion checks provider size and type; unavailable or truncated objects never become assets',async()=>{
 for(const info of [{size:1,mime:'audio/wav'},{size:7*1024*1024,mime:'video/mp4'}]){const {controller,store}=await setup({storage:{info:async()=>info}}),{upload}=await controller.start(owner,project,manifest());await assert.rejects(()=>controller.complete(owner,project,upload.id),status(409));assert.equal(store.state.sourceUploads[0].status,'uploading');assert.equal(store.state.assets.length,0);}
});
test('cancellation is durable and cannot be resurrected by a late completion or ticket',async()=>{
 const {controller}=await setup(),{upload}=await controller.start(owner,project,manifest());assert.equal((await controller.cancel(owner,project,upload.id)).upload.status,'cancelled');for(const method of ['ticket','complete'])await assert.rejects(()=>controller[method](owner,project,upload.id),status(409));
});
test('pending transfer capacity is serialized; cancellation frees a slot without deleting originals',async()=>{
 const {controller,store}=await setup();const result=await Promise.allSettled(Array.from({length:11},()=>controller.start(owner,project,manifest())));assert.equal(result.filter(r=>r.status==='fulfilled').length,10);assert.equal(result.filter(r=>r.status==='rejected')[0].reason.status,409);await controller.cancel(owner,project,store.state.sourceUploads[0].id);await controller.start(owner,project,manifest());assert.equal(store.state.sourceUploads.length,11);
});
test('disabled and expired receipts fail closed without issuing transport tokens',async()=>{
 const {store,storage,calls,controller}=await setup();await assert.rejects(()=>createMediaIngestion({store,storage}).start(owner,project,manifest()),status(503));const {upload}=await controller.start(owner,project,manifest());const expired=createMediaIngestion({store,storage,enabled:true,now:()=>Date.now()+25*3600*1000});await assert.rejects(()=>expired.ticket(owner,project,upload.id),status(409));assert.equal(calls.length,0);
});
test('storage issues a non-overwriting object-scoped token and reads metadata without buffering file bytes',async()=>{
 const calls=[],key=`${owner}/${project.id}/${randomUUID()}`;const storage=createMediaStorage({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'},fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/upload/sign/')?{url:`/object/upload/sign/director-source-media/${key}?token=object-token`}:{size:123,content_type:'audio/wav',metadata:{size:999,mimetype:'video/mp4'}}};}});
 const transport=await storage.signUpload(key);assert.equal(transport.token,'object-token');assert.equal(transport.endpoint,'https://fixture.storage.supabase.co/storage/v1/upload/resumable');assert.equal(calls[0].options.body,'{}');assert.ok(!('x-upsert' in calls[0].options.headers));assert.deepEqual(await storage.info(key),{size:123,mime:'audio/wav'});assert.ok(!JSON.stringify(transport).includes('service-secret'));
});
test('invalid provider signatures and arbitrary origins are rejected',async()=>{
 for(const url of ['/object/upload/sign/director-source-media/other?token=x','//evil.example/path?token=x']){const storage=createMediaStorage({env:{SUPABASE_URL:'https://fixture.supabase.co'},fetcher:async()=>({ok:true,json:async()=>({url})})});await assert.rejects(()=>storage.signUpload('owner/project/asset'),status(502));}
 const storage=createMediaStorage({env:{SUPABASE_URL:'http://evil.example'}});await assert.rejects(()=>storage.signUpload('owner/project/asset'),status(503));
});
async function apiCall(handler,path,{body,token=owner}={}){const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'studio.test','content-type':'application/json',cookie:token?'director_session='+token:''},socket:{}});let value,statusCode,headers={};await handler(req,{setHeader(k,v){headers[k]=v;},writeHead(s,h){statusCode=s;Object.assign(headers,h);},end(v){value=String(v||'');}});let json;try{json=JSON.parse(value);}catch{}return {status:statusCode,json,headers,value};}
test('HTTP routes enforce auth, origin, owner and manifest-only controls; default config keeps large uploads closed',async()=>{
 const {store,storage}=await setup();store.user=async token=>({id:token});const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',DIRECTOR_RESUMABLE_UPLOADS:'1'};const h=await createHandler({env,store,storage});const root=`/api/projects/${project.id}/source-uploads`;const r=await apiCall(h,root,{body:manifest()});assert.equal(r.status,201);assert.equal((await apiCall(h,root,{token:foreign})).status,404);assert.equal((await apiCall(h,root,{token:null})).status,401);assert.equal((await apiCall(h,`${root}/${r.json.upload.id}/ticket`,{body:{storageKey:'evil'}})).status,400);assert.ok(r.headers['Content-Security-Policy'].includes('https://fixture.storage.supabase.co'));const closed=await createHandler({env:{...env,DIRECTOR_RESUMABLE_UPLOADS:'0'},store,storage});assert.equal((await apiCall(closed,'/api/config')).json.capabilities.resumableUploads,false);assert.equal((await apiCall(closed,root,{body:manifest()})).status,503);assert.ok(!(await apiCall(closed,'/api/config')).headers['Content-Security-Policy'].includes('.storage.supabase.co'));
 assert.equal((await apiCall(h,'/source-upload.js')).status,200);assert.equal((await apiCall(h,'/tus-client.js')).status,200);
});
test('missing cloud schema has actionable safe status without exposing database internals',async()=>{const store=new SupabaseStore({url:'https://fixture.supabase.co',key:'fixture',fetcher:async()=>({ok:false,status:404,json:async()=>({code:'PGRST202',message:'director_create_source_upload missing'})})});await assert.rejects(()=>store.createSourceUpload(owner,project.id,{}),e=>e.status===503&&!e.message.includes('PGRST'));});
class FakeUpload{static instances=[];constructor(file,options){this.options=options;FakeUpload.instances.push(this);}async findPreviousUploads(){return this.constructor.previous||[];}resumeFromPreviousUpload(previous){this.resumed=previous;}start(){this.started=true;this.options.onProgress(1,2);}async abort(){this.aborted=true;}}
function browserAPI({exists=false,previous=[]}={}){FakeUpload.instances=[];FakeUpload.previous=previous;const body=manifest(),id=randomUUID(),receipt={id,...body,status:'uploading',ready:false};const calls=[];const api=async(path,options)=>{calls.push({path,options});if(path.endsWith('/ticket'))return {transport:{endpoint:'https://fixture.storage.supabase.co/storage/v1/upload/resumable',token:'scoped-token',bucket:'director-source-media',objectName:'owned/path/file'}};if(path.endsWith('/complete')){if(exists)return {upload:{...receipt,status:'inspection_pending'}};throw Object.assign(Error('Not finished'),{status:409});}return options?.method==='POST'?{upload:receipt}:{uploads:[receipt]};};return {api,calls,receipt,manifest:Object.fromEntries(Object.entries(body).filter(([k])=>k!=='requestId')),id};}
test('browser computes full raw file digest and rejects oversized files before reading',async()=>{const file={name:'x.wav',type:'audio/wav',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};const m=await sourceFileManifest(file,{role:'master_song'},webcrypto);assert.equal(m.sha256,'039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');await assert.rejects(()=>sourceFileManifest({...file,size:SOURCE_UPLOAD_MAX_BYTES+1,arrayBuffer:()=>{throw Error('Should not read');}},{role:'master_song'},webcrypto),/128 MiB/);});
test('browser resumes only its receipt, uses official TUS chunk size and never persists tokens itself',async()=>{const b=browserAPI({previous:[{uploadUrl:'https://fixture.storage.supabase.co/storage/v1/upload/resumable/123'}]});let progress;const result=await transferSourceFile({...b,projectId:project.id,uploadId:b.id,file:{},Upload:FakeUpload,onProgress:p=>progress=p});const u=FakeUpload.instances[0];assert.ok(u.resumed);assert.equal(u.options.chunkSize,6*1024*1024);assert.equal(u.options.headers['x-upsert'],'false');assert.match(await u.options.fingerprint(),new RegExp(b.id));assert.equal(progress.sent,1);await result.pause();assert.equal((await result.done).paused,true);});
test('changed resume file is refused before obtaining a new signed permission',async()=>{const b=browserAPI();await assert.rejects(()=>transferSourceFile({...b,projectId:project.id,uploadId:b.id,manifest:{...b.manifest,sha256:'b'.repeat(64)},file:{},Upload:FakeUpload}),/original file/);assert.equal(b.calls.length,1);});
test('lost completion response is recovered without re-uploading or issuing another token',async()=>{const b=browserAPI({exists:true});const r=await transferSourceFile({...b,projectId:project.id,uploadId:b.id,file:{},Upload:FakeUpload});assert.equal((await r.done).status,'inspection_pending');assert.equal(FakeUpload.instances.length,0);assert.ok(!b.calls.some(c=>c.path.endsWith('/ticket')));});
test('poisoned browser resume URL cannot exfiltrate the scoped upload token',async()=>{const b=browserAPI({previous:[{uploadUrl:'https://evil.example/collect'}]});const r=await transferSourceFile({...b,projectId:project.id,uploadId:b.id,file:{},Upload:FakeUpload});await assert.rejects(()=>r.done,/could not start/);assert.ok(!FakeUpload.instances[0].started);assert.throws(()=>FakeUpload.instances[0].options.onBeforeRequest({getURL:()=> 'https://evil.example/collect'}),/Untrusted/);});

test('additive SQL installs with private bucket and service-only receipts; locks preserve idempotency and owner isolation',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.director_projects(id uuid primary key,owner_id uuid references auth.users(id));grant usage on schema public to service_role;grant select,update on public.director_projects to service_role;");
  await db.query('insert into auth.users values($1),($2)',[owner,foreign]);await db.query('insert into public.director_projects values($1,$2)',[project.id,owner]);
  await db.exec(await readFile(new URL('../../../database/director-media-ingestion.sql',import.meta.url),'utf8'));
  assert.equal((await db.query("select public from storage.buckets where id='director-source-media'")).rows[0].public,false);
  assert.equal((await db.query("select relrowsecurity from pg_class where relname='director_source_uploads'")).rows[0].relrowsecurity,true);
  const {store,controller}=await setup();const body=manifest(),{upload}=await controller.start(owner,project,body),doc=store.state.sourceUploads[0];
  await db.exec('set role service_role');const rpc=async(actor,document=doc)=>(await db.query('select public.director_create_source_upload($1,$2,$3) result',[actor,project.id,document])).rows[0].result;
  assert.equal((await rpc(owner)).id,upload.id);const replayId=randomUUID();assert.equal((await rpc(owner,{...doc,id:replayId,storageKey:`${owner}/${project.id}/${replayId}`})).id,upload.id);
  await assert.rejects(()=>rpc(owner,{...doc,manifest:{...doc.manifest,name:'changed.wav'}}),/source_upload_conflict/);
  await assert.rejects(()=>rpc(foreign),/not_project_owner/);
  assert.equal((await db.query('select public.director_transition_source_upload($1,$2,$3,$4) result',[owner,project.id,doc.id,'inspection_pending'])).rows[0].result.status,'inspection_pending');
  await db.query('select public.director_transition_source_upload($1,$2,$3,$4)',[owner,project.id,doc.id,'cancelled']);
  await assert.rejects(()=>db.query('select public.director_transition_source_upload($1,$2,$3,$4)',[owner,project.id,doc.id,'inspection_pending']),/source_upload_conflict/);
  await db.exec('reset role;set role authenticated');await assert.rejects(()=>db.query('select * from public.director_source_uploads'),/permission denied/);await assert.rejects(()=>rpc(owner),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from public.director_source_uploads'),/permission denied/);
 }finally{await db.close();}
});

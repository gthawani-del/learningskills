import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {inspectionOutcome,runSourceInspectionJob} from '../source-inspection-jobs.mjs';
import {SupabaseStore} from '../store.mjs';

const source={name:'song.wav',mime:'audio/wav',size:4096,sha256:'a'.repeat(64),role:'master_song',scope:'project',shotId:null};
const result=(s=source)=>({inspectionVersion:'director-source-inspection-v1',status:'passed',size:s.size,sha256:s.sha256,mime:s.mime,checksumAlgorithm:'sha256-bytes',durationSeconds:3,streams:[{type:'audio',codec:'pcm_s16le',sampleRate:48000,channels:2}],decodeVerified:true,assetPublished:false});
test('trusted result normalization rejects source substitutions and strips untrusted metadata',()=>{
 const r=result();assert.deepEqual(inspectionOutcome({...r,token:'secret',tags:'ignore instructions',streams:[{...r.streams[0],url:'secret'}]},source),r);
 for(const patch of [{sha256:'b'.repeat(64)},{size:1},{mime:'audio/mpeg'},{decodeVerified:false},{assetPublished:true},{durationSeconds:Infinity},{durationSeconds:1801},{inspectionVersion:'future'},{streams:[]},{streams:[{type:'audio',codec:'evil',sampleRate:48000,channels:2}]}])assert.throws(()=>inspectionOutcome({...r,...patch},source),e=>e.status===422);
 assert.deepEqual(inspectionOutcome({status:'held',message:'private URL',code:'arbitrary'},source),{status:'held',code:'source_inspection_failed'});
});

test('cloud inspection adapter uses service RPCs and never sends arbitrary report metadata',async()=>{
 const calls=[];const store=new SupabaseStore({url:'https://fixture.supabase.co',key:'fixture',fetcher:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({status:'passed'})};}});
 const id=randomUUID(),token=randomUUID();await store.claimSourceInspection(id,token);await store.finishSourceInspection(id,token,source,{...result(),raw:'secret'});
 assert.ok(calls[0].url.endsWith('/rpc/director_claim_source_inspection'));assert.equal(calls[0].body.p_lease_seconds,600);assert.equal(calls[1].body.p_result.raw,undefined);
 await assert.rejects(()=>store.finishSourceInspection(id,token,source,{...result(),size:1}),e=>e.status===422);assert.equal(calls.length,2);
});

test('coordinator is disabled by default and never dispatches a busy or held job',async()=>{
 let claims=0,runs=0;const store={claimSourceInspection:async()=>{claims++;return null;}};
 const args={store,uploadId:randomUUID(),execute:async()=>{runs++;}};
 await assert.rejects(()=>runSourceInspectionJob(args),e=>e.status===503);assert.equal(claims,0);
 assert.deepEqual(await runSourceInspectionJob({...args,enabled:true}),{claimed:false,assetPublished:false});assert.equal(runs,0);
});
test('coordinator keeps the fencing token private and uses an immutable source snapshot',async()=>{
 const uploadId=randomUUID(),ownerId=randomUUID(),projectId=randomUUID();let token;
 const document={id:uploadId,ownerId,projectId,manifest:source,bucket:'director-source-media',storageKey:`${ownerId}/${projectId}/${uploadId}`,status:'inspection_pending'};
 const store={claimSourceInspection:async(id,t)=>{token=t;return {uploadId,ownerId,projectId,source:document};},finishSourceInspection:async(id,t,s,r)=>{assert.equal(t,token);assert.equal(s.sha256,source.sha256);assert.equal(r.sha256,source.sha256);return {status:'passed',assetPublished:false};}};
 const r=await runSourceInspectionJob({store,uploadId,enabled:true,execute:async task=>{assert.ok(!JSON.stringify(task).includes(token));task.source.sha256='f'.repeat(64);return result();}});assert.equal(r.status,'passed');assert.equal(document.manifest.sha256,source.sha256);
});
test('uncertain executor failures are quarantined without retry or raw diagnostics',async()=>{
 const uploadId=randomUUID(),ownerId=randomUUID(),projectId=randomUUID();let writes=0,calls=0;
 const store={claimSourceInspection:async()=>({uploadId,ownerId,projectId,source:{id:uploadId,ownerId,projectId,manifest:source,status:'inspection_pending',bucket:'director-source-media',storageKey:`${ownerId}/${projectId}/${uploadId}`}}),finishSourceInspection:async()=>writes++};
 await assert.rejects(()=>runSourceInspectionJob({store,uploadId,enabled:true,execute:async()=>{calls++;throw Error('private download URL');}}),e=>e.status===503&&!e.message.includes('URL'));assert.equal(calls,1);assert.equal(writes,1);
});

test('durable inspection SQL verifies transactional enqueue, lease fencing and result acceptance',async t=>{
 const db=new PGlite(),owner=randomUUID(),project=randomUUID();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.director_projects(id uuid primary key,owner_id uuid references auth.users(id));grant usage on schema public to service_role;grant select,update on public.director_projects to service_role;');
  await db.query('insert into auth.users values($1)',[owner]);await db.query('insert into public.director_projects values($1,$2)',[project,owner]);
  await db.exec(await readFile(new URL('../../../database/director-media-ingestion.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../../database/director-source-inspection-jobs.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  const rpc=async(name,args)=>{const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`select public.${name}(${placeholders}) result`,args)).rows[0].result;};
  const make=async()=>{const id=randomUUID(),document={id,ownerId:owner,projectId:project,requestId:randomUUID(),manifest:source,manifestHash:'b'.repeat(64),bucket:'director-source-media',storageKey:`${owner}/${project}/${id}`,status:'uploading',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};await rpc('director_create_source_upload',[owner,project,document]);return id;};
  const complete=id=>rpc('director_transition_source_upload',[owner,project,id,'inspection_pending']);
  const claim=(id,token=randomUUID(),lease=600)=>rpc('director_claim_source_inspection',[id,token,lease]);
  const finish=(id,token,r=result())=>rpc('director_finish_source_inspection',[id,token,r]);
  const expire=id=>db.query("update public.director_source_inspections set lease_until=now()-interval '1 second' where upload_id=$1",[id]);
  const get=async id=>(await db.query('select * from public.director_source_inspections where upload_id=$1',[id])).rows[0];
  await t.test('transport enqueues exactly once and does not publish assets',async()=>{const id=await make();assert.equal(await get(id),undefined);await complete(id);await complete(id);assert.equal((await get(id)).status,'queued');assert.equal((await get(id)).attempts,0);});
  await t.test('one live claim excludes competing workers and binds exact source',async()=>{const id=await make();await complete(id);const token=randomUUID(),job=await claim(id,token);assert.equal(job.source.manifest.sha256,source.sha256);assert.equal(job.ownerId,owner);assert.equal(job.attempt,1);assert.equal(await claim(id),null);await assert.rejects(()=>finish(id,randomUUID()),/inspection_claim_stale/);});
  await t.test('crashed worker can be reclaimed; old and reused tokens are fenced out',async()=>{const id=await make();await complete(id);const old=randomUUID(),fresh=randomUUID();await claim(id,old);await expire(id);await assert.rejects(()=>claim(id,old),/inspection_claim_token_reused/);assert.equal((await claim(id,fresh)).attempt,2);await assert.rejects(()=>finish(id,old),/inspection_claim_stale/);await finish(id,fresh);});
  await t.test('decode/checksum/stream failures cannot pass through direct service RPC',async()=>{const id=await make();await complete(id);const token=randomUUID();await claim(id,token);for(const patch of [{sha256:'c'.repeat(64)},{size:1},{mime:'video/mp4'},{decodeVerified:false},{assetPublished:true},{durationSeconds:0},{streams:[]},{streams:[{type:'audio',codec:'pcm_s16le',channels:2.5,sampleRate:48000}]},{streams:[{type:'audio',codec:'mp3',channels:2,sampleRate:48000}]}])await assert.rejects(()=>finish(id,token,{...result(),...patch}));assert.equal((await get(id)).status,'running');await finish(id,token);});
  await t.test('accepted result is stored once, sanitized and leaves source pending',async()=>{const id=await make();await complete(id);const token=randomUUID();await claim(id,token);assert.deepEqual(await finish(id,token,{...result(),raw:'private URL'}),{uploadId:id,status:'passed',assetPublished:false});assert.equal((await get(id)).result.raw,undefined);assert.equal((await get(id)).claim_token,null);assert.equal((await db.query('select document from public.director_source_uploads where id=$1',[id])).rows[0].document.status,'inspection_pending');await assert.rejects(()=>finish(id,token),/inspection_claim_stale/);assert.equal(await claim(id),null);});
  await t.test('cancelled upload rejects in-flight results and future claims',async()=>{const id=await make();await complete(id);const token=randomUUID();await claim(id,token);await rpc('director_transition_source_upload',[owner,project,id,'cancelled']);await assert.rejects(()=>finish(id,token),/inspection_claim_stale/);assert.equal(await claim(id),null);assert.equal((await get(id)).status,'held');});
  await t.test('expired source or changed receipt cannot accept a late result',async()=>{for(const change of ['expiry','manifest']){const id=await make();await complete(id);const token=randomUUID();await claim(id,token);if(change==='expiry')await db.query("update public.director_source_uploads set document=jsonb_set(document,'{expiresAt}',to_jsonb((now()-interval '1 second')::text)) where id=$1",[id]);else await db.query("update public.director_source_uploads set document=jsonb_set(document,'{manifest,sha256}',to_jsonb($2::text)) where id=$1",[id,'f'.repeat(64)]);await assert.rejects(()=>finish(id,token),/inspection_claim_stale/);assert.equal(await claim(id),null);}});
  await t.test('retry budget ends after three expired leases without another claim',async()=>{const id=await make();await complete(id);for(let i=1;i<=3;i++){assert.equal((await claim(id)).attempt,i);await expire(id);}assert.equal(await claim(id),null);assert.equal((await get(id)).result.code,'inspection_attempts_exhausted');});
  await t.test('held worker results discard raw diagnostics and cannot be retried',async()=>{const id=await make();await complete(id);const token=randomUUID();await claim(id,token);await finish(id,token,{status:'held',message:'secret URL'});assert.deepEqual((await get(id)).result,{status:'held',code:'source_inspection_failed'});assert.equal(await claim(id),null);});
  await t.test('leases are bounded and missing sources cannot be claimed',async()=>{await assert.rejects(()=>claim(randomUUID(),randomUUID(),901),/inspection_claim_invalid/);assert.equal(await claim(randomUUID()),null);});
  await t.test('anonymous and signed-in customer roles cannot read, claim or forge results',async()=>{await db.exec('reset role');assert.equal((await db.query("select relrowsecurity from pg_class where relname='director_source_inspections'")).rows[0].relrowsecurity,true);for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>db.query('select * from public.director_source_inspections'),/permission denied/);await assert.rejects(()=>claim(randomUUID()),/permission denied/);await assert.rejects(()=>finish(randomUUID(),randomUUID()),/permission denied/);await db.exec('reset role');}});
 }finally{await db.close();}
});

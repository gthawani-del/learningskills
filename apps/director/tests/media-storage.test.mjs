import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaStorage} from '../media-storage.mjs';
import {hash} from '../domain.mjs';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret'};
const bytes=Buffer.from('original private file'),checksum=hash(bytes.toString('base64'));
test('storage retry verifies an existing object instead of overwriting it',async()=>{
 const calls=[];const storage=createMediaStorage({env,demo:false,fetcher:async(url,options)=>{calls.push({url,options});return options.method==='POST'?{ok:false,status:409}:{ok:true,arrayBuffer:async()=>bytes};}});
 await storage.putIfAbsent('owner/project/asset',bytes,'text/plain',checksum);assert.equal(calls.length,2);assert.equal(calls[0].options.headers['x-upsert'],'false');assert.ok(calls[1].url.includes('/object/authenticated/'));assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
});
test('conflicting existing storage content is held without overwriting the original',async()=>{
 let writes=0;const storage=createMediaStorage({env,demo:false,fetcher:async(url,options)=>options.method==='POST'?(writes++,{ok:false,status:400}):{ok:true,arrayBuffer:async()=>Buffer.from('different file')}});
 await assert.rejects(()=>storage.putIfAbsent('owner/project/asset',bytes,'text/plain',checksum),e=>e.status===409);assert.equal(writes,1);
});
test('unknown upload failures are not replayed inside storage transport',async()=>{
 let calls=0;const storage=createMediaStorage({env,demo:false,fetcher:async()=>{calls++;throw Error('Connection lost');}});
 await assert.rejects(()=>storage.putIfAbsent('owner/project/asset',bytes,'text/plain',checksum),/Connection lost/);assert.equal(calls,1);
});

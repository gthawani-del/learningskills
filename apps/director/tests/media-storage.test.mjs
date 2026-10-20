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

test('private original byte ranges are bounded, authenticated and verified before browser analysis',async()=>{
 const calls=[],storage=createMediaStorage({env,demo:false,fetcher:async(url,options)=>{calls.push({url,options});return new Response(bytes.subarray(2,7),{status:206,headers:{'content-range':`bytes 2-6/${bytes.length}`,'content-length':'5'}});}});
 assert.deepEqual(await storage.getRange('owner/project/asset',{start:2,end:6,total:bytes.length}),bytes.subarray(2,7));assert.equal(calls[0].options.headers.Range,'bytes=2-6');assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-secret');assert.equal(calls[0].options.redirect,'error');assert(calls[0].url.includes('/object/authenticated/director-source-media/'));
 for(const args of [{start:-1,end:1,total:10},{start:0,end:2097152,total:2097153},{start:0,end:5,total:5}])await assert.rejects(()=>storage.getRange('owner/project/asset',args),{status:400});
 assert.equal(calls.length,1);
});
test('private range transport rejects full, short, oversized and mismatched upstream responses',async()=>{
 const replies=[()=>new Response(bytes,{status:200}),()=>new Response(bytes.subarray(0,3),{status:206,headers:{'content-range':`bytes 0-4/${bytes.length}`,'content-length':'5'}}),()=>new Response(bytes.subarray(0,6),{status:206,headers:{'content-range':`bytes 0-4/${bytes.length}`,'content-length':'5'}}),()=>new Response(bytes.subarray(0,5),{status:206,headers:{'content-range':`bytes 1-5/${bytes.length}`,'content-length':'5'}})];
 for(const reply of replies){const storage=createMediaStorage({env,demo:false,fetcher:async()=>reply()});await assert.rejects(()=>storage.getRange('owner/project/asset',{start:0,end:4,total:bytes.length}),{status:502});}
});

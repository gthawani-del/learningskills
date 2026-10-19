import test from 'node:test';
import assert from 'node:assert/strict';
import {referencePng} from './reference-fixture-server.mjs';
import {inspectReferencePNG,downloadReferencePNG,referenceOutputURL,REFERENCE_IMAGE_MAX_BYTES} from '../reference-images.mjs';
import {createMediaStorage} from '../media-storage.mjs';

test('generated image inspection decodes a complete 1024 PNG and rejects changed CRC, truncation and wrong dimensions',()=>{
 const bytes=referencePng();assert.deepEqual(inspectReferencePNG(bytes),{mime:'image/png',width:1024,height:1024,size:bytes.length});
 const changed=Buffer.from(bytes);changed[changed.length-1]^=1;
 for(const value of [changed,bytes.subarray(0,bytes.length-5),referencePng(512,512),Buffer.from('<svg>not a generated PNG</svg>')])assert.throws(()=>inspectReferencePNG(value),e=>e.status===415);
});
test('reference import accepts only the reviewed fal HTTPS host and never contacts a client-selected host',async()=>{
 let requests=0;
 for(const url of ['http://fal.media/a.png','https://fal.media.example.com/a.png','https://127.0.0.1/a.png','https://fal.media:444/a.png','https://u:p@fal.media/a.png','https://[::1]/a.png','https://fal.media/a.png#extra'])await assert.rejects(downloadReferencePNG(url,{fetcher:async()=>{requests++;}}),e=>e.status===502);
 assert.equal(requests,0);assert.equal(referenceOutputURL('https://v3.fal.media/files/a.png'),'https://v3.fal.media/files/a.png');
});
test('streamed reference image import bounds bytes and checks actual pixels rather than response MIME',async()=>{
 const bytes=referencePng();let observed;
 const image=await downloadReferencePNG('https://fal.media/a.png',{fetcher:async(url,options)=>{observed=options;return new Response(bytes,{headers:{'content-type':'application/octet-stream'}});}});
 assert.equal(image.width,1024);assert.equal(image.mime,'image/png');assert.deepEqual(image.bytes,bytes);assert.equal(observed.redirect,'error');
 await assert.rejects(downloadReferencePNG('https://fal.media/a.png',{fetcher:async()=>new Response('bad',{headers:{'content-type':'image/png'}})}),e=>e.status===415);
 await assert.rejects(downloadReferencePNG('https://fal.media/a.png',{fetcher:async()=>new Response('x',{headers:{'content-length':String(REFERENCE_IMAGE_MAX_BYTES+1)}})}),e=>e.status===413);
 let cancelled=false;await assert.rejects(downloadReferencePNG('https://fal.media/a.png',{fetcher:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(REFERENCE_IMAGE_MAX_BYTES+1));},cancel(){cancelled=true;}}))}),e=>e.status===413);assert(cancelled);
});
test('private model reference signing binds the owned bucket/key and short expiry without exposing service credentials',async()=>{
 const requests=[],env={SUPABASE_URL:'https://reference-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-only'};
 const storage=createMediaStorage({env,demo:false,fetcher:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({signedURL:'/object/sign/director-reference-media/owner/project/asset?token=synthetic-token'})};}});
 const signed=await storage.sign('owner/project/asset',{bucket:'director-reference-media',expiresIn:3600});
 assert.equal(signed,'https://reference-fixture.supabase.co/storage/v1/object/sign/director-reference-media/owner/project/asset?token=synthetic-token');assert(!signed.includes(env.SUPABASE_SERVICE_ROLE_KEY));assert.equal(JSON.parse(requests[0].options.body).expiresIn,3600);assert.equal(requests[0].options.headers['Content-Type'],'application/json');
 await assert.rejects(storage.sign('owner/../asset'),e=>e.status===400);await assert.rejects(storage.sign('owner/project/asset',{expiresIn:3601}),e=>e.status===400);await assert.rejects(storage.sign('owner/project/asset',{bucket:'public'}),e=>e.status===400);assert.equal(requests.length,1);
});
test('private model signing rejects a storage response for a different object or external host',async()=>{
 for(const signedURL of ['https://example.test/token','/object/sign/director-reference-media/other/project/asset?token=x']){
  const storage=createMediaStorage({env:{SUPABASE_URL:'https://reference-fixture.supabase.co'},demo:false,fetcher:async()=>({ok:true,json:async()=>({signedURL})})});
  await assert.rejects(storage.sign('owner/project/asset',{bucket:'director-reference-media'}),e=>e.status===502);
 }
});

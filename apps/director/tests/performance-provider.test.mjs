import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFalInput,reviewedFalInputSchema,createProviderClients} from '../providers.mjs';
const endpoint='bytedance/omnihuman/v2',input={image_url:'https://project.supabase.co/storage/v1/object/sign/director-reference-media/owner/project/frame?token=x',audio_url:'https://project.supabase.co/storage/v1/object/sign/director-source-media/owner/project/excerpt?token=x',prompt:'Preserve the approved identity and exact supplied performance.'};
test('observed performance schema is allowlisted without adding imaginary duration or resolution controls',()=>{
 assert.deepEqual(validateFalInput(endpoint,input),input);assert.deepEqual(reviewedFalInputSchema(endpoint).required,['image_url','audio_url']);for(const change of [{duration:5},{resolution:'4K'},{audio_url:'file:///private/song.wav'}])assert.throws(()=>validateFalInput(endpoint,{...input,...change}));
});
test('performance submission uses the exact namespace and preserves classified HTTP failure without retry',async()=>{
 const calls=[],p=createProviderClients({env:{FAL_API_KEY:'synthetic-only'},fetcher:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({request_id:'performance_fixture',status:'IN_QUEUE'}),{headers:{'content-type':'application/json'}});}});const r=await p.submitFalJob({endpoint,input,authorized:true});assert.equal(calls.length,1);assert.equal(calls[0].url,'https://queue.fal.run/'+endpoint);assert.ok(r.statusUrl.includes('/bytedance/omnihuman/requests/performance_fixture/status'));
 const failed=createProviderClients({env:{FAL_API_KEY:'synthetic-only'},fetcher:async()=>new Response('',{status:503})});await assert.rejects(()=>failed.submitFalJob({endpoint,input,authorized:true}),e=>e.providerHttpStatus===503);
});

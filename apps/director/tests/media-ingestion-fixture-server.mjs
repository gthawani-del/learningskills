// Local API/store with a synthetic signed-storage transport; no cloud/provider call.
import http from 'node:http';
import {referenceFixture,referenceSession} from './reference-fixture-server.mjs';
import {createHandler} from '../server.mjs';
const f=await referenceFixture();f.env.DIRECTOR_RESUMABLE_UPLOADS='1';f.env.SUPABASE_URL='https://fixture.supabase.co';
let complete=false,size=0;
f.storage.signUpload=async(key,{bucket})=>({endpoint:'https://fixture.storage.supabase.co/storage/v1/upload/resumable',bucket,objectName:key,token:'fixture-object-token',chunkSize:6*1024*1024});
f.storage.info=async()=>{if(!complete)throw Object.assign(Error('Transfer incomplete'),{status:409});return {size,mime:'audio/wav'};};
const h=await createHandler(f);
const server=http.createServer(async(req,res)=>{
 if(req.url==='/__ingestion-fixture'){
  if(req.method==='POST'){let body='';for await(const c of req)body+=c;const v=JSON.parse(body);complete=v.complete;size=v.size;}
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({uploads:f.store.state.sourceUploads||[],assets:f.store.state.assets.length,paidCalls:f.counters().submits}));
 }
 await h(req,res);
});
server.listen(0,'127.0.0.1',()=>{f.env.APP_ORIGIN='http://127.0.0.1:'+server.address().port;console.log(JSON.stringify({port:server.address().port,projectId:f.project.id,session:referenceSession}));});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));

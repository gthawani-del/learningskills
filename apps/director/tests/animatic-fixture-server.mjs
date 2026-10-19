import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createHandler,createServer} from '../server.mjs';
import {storyboardProductionFixture} from './storyboard-production-fixture-server.mjs';
import {referenceSession} from './reference-fixture-server.mjs';
export async function call(handler,path,body,token=referenceSession){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost','content-type':'application/json',...(token?{cookie:'director_session='+token}:{})},socket:{remoteAddress:'127.0.0.1'}});let status,data;const res={setHeader(){},writeHead(s){status=s;this.headersSent=true;},end(value){data=value;}};await handler(req,res);return {status,data:JSON.parse(String(data))};
}
export async function animaticFixture(options={}){
 const f=await storyboardProductionFixture({...options,approveSpec:true}),handler=await createHandler(f),base='/api/projects/'+f.project.id;let p=f.project;
 const post=async(path,body)=>{const r=await call(handler,base+path,body);if(r.status>=400)throw Error(JSON.stringify(r));if(r.data.project)p=r.data.project;return r.data;};
 await post('/spending-budget',{requestId:randomUUID(),expectedVersion:p.version,budgetMicroUsd:1000000,finishReserveMicroUsd:0});
 for(const shot of p.shots){
  const {quote}=await post('/storyboard-production/quotes',{expectedVersion:p.version,requestId:randomUUID(),shotId:shot.id,modelId:'F-storyboard-frame-local',shareReferences:true});
  const {authorization}=await post('/spending-authorizations',{expectedVersion:p.version,requestId:randomUUID(),quoteId:quote.id,maxMicroUsd:quote.totalMicroUsd,finishReserveMicroUsd:0});
  const {job}=await post('/storyboard-production/jobs',{expectedVersion:p.version,requestId:randomUUID(),quoteId:quote.id,authorizationId:authorization.id});
  await post('/jobs/'+job.id+'/poll',{});const {candidate}=await post('/storyboard-production/import',{jobId:job.id});
  await post('/storyboard-production',{expectedVersion:p.version,action:'select',shotId:shot.id,candidateId:candidate.id,acknowledgeReview:true});
  const summary=await call(handler,base+'/storyboard-production'),frame=summary.data.storyboardProductionContext.shots.find(s=>s.shotId===shot.id);
  await post('/approvals',{expectedVersion:p.version,artifactId:'storyboard_frame:'+shot.id,version:frame.selection.version,decision:'approved',acknowledgeFrameReview:true});
 }
 return {...f,project:p,handler,base,post};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const f=await animaticFixture(),server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:f.project.id,port:server.address().port,session:referenceSession})));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}

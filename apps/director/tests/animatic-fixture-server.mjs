import {Readable} from 'node:stream';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createHandler,createServer} from '../server.mjs';
import {storyboardProductionFixture} from './storyboard-production-fixture-server.mjs';
import {referenceSession} from './reference-fixture-server.mjs';
export function originalWav(seconds=3){const rate=8000,length=rate*seconds*2,b=Buffer.alloc(44+length);b.write('RIFF',0);b.writeUInt32LE(36+length,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(length,40);for(let i=0;i<length/2;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*880)*5000),44+i*2);return b;}
export async function call(handler,path,body,token=referenceSession,headers={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost','content-type':'application/json',...(token?{cookie:'director_session='+token}:{}),...headers},socket:{remoteAddress:'127.0.0.1'}});let status,data,responseHeaders;const res={setHeader(){},writeHead(s,h){status=s;responseHeaders=h;this.headersSent=true;},end(value){data=value;}};await handler(req,res);return {status,headers:responseHeaders,data:responseHeaders?.['Content-Type']==='application/json'?JSON.parse(String(data)):data};
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
 const mp3=options.audioFormat==='mp3',audioBytes=options.audio?(mp3?execFileSync('ffmpeg',['-v','error','-i','pipe:0','-f','mp3','pipe:1'],{input:originalWav()}):originalWav()):null;
 const audio=options.audio?(await post('/assets',{name:'Original master.'+(mp3?'mp3':'wav'),mime:mp3?'audio/mpeg':'audio/wav',role:'master_song',scope:'project',base64:audioBytes.toString('base64')})).asset:null;
 return {...f,project:p,handler,base,post,audio};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const f=await animaticFixture({audio:process.env.DIRECTOR_ANIMATIC_AUDIO_FIXTURE==='1',audioFormat:process.env.DIRECTOR_ANIMATIC_AUDIO_FORMAT}),server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:f.project.id,port:server.address().port,session:referenceSession})));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}

// Trusted worker entry point over the existing durable render job, private store
// and FFmpeg renderer. No VM/session creation, provider calls or automatic retry.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runRenderJob} from './render-jobs.mjs';import {renderSongTimeline} from './song-render.mjs';import {fail} from './domain.mjs';
export function createPrivateSongRenderWorker({store,storage,executorId,reportActual,render=renderSongTimeline,maxStagedBytes=2*1024*1024*1024}){
 if(typeof executorId!=='string'||!executorId||typeof reportActual!=='function'||!Number.isSafeInteger(maxStagedBytes)||maxStagedBytes<1||maxStagedBytes>2*1024*1024*1024)fail(503,'Configure a trusted executor identity, truthful compute accounting and bounded staging before dispatch.');
 return {async run({actorId,projectId,renderId,signal}){
  const saved=await store.readRenderJob(actorId,projectId,renderId);if(saved.quote.executorId!==executorId)fail(409,'The worker differs from the authorized compute executor.');
  const executor={id:executorId,async execute({scope,renderId,signal}){
   const root=await mkdtemp(join(tmpdir(),'director-render-worker-')),started=Date.now();let total=0;
   try{
    for(const source of scope.sources){if(Date.now()-started>120000)fail(503,'Private render staging exceeded its processing bound.');if(signal?.aborted)fail(409,'Render worker was cancelled.');if(!source.storageKey?.startsWith(actorId+'/'+projectId+'/'))fail(409,'Render sources must remain in owned private storage.');const bytes=await storage.get(source.storageKey,{bucket:source.bucket||'director-media',maxBytes:128*1024*1024});total+=bytes.length;if(bytes.length>128*1024*1024||total>maxStagedBytes||source.size!==undefined&&source.size!==bytes.length)fail(422,'Render sources exceed their exact inspected byte or staging bound.');await writeFile(join(root,source.id),bytes,{mode:0o600,flag:'wx'});}
    const output=await render({project:{id:projectId,ownerId:actorId,...scope.projectSnapshot.configuration},songPlan:scope.content.songPlan,selections:scope.content.selections,finishing:scope.content.finishing,output:scope.content.output,assets:scope.sources,assetDir:root,signal});
    const actualMicroUsd=await reportActual({renderId,elapsedMs:Date.now()-started,outputBytes:output.bytes.length});return {...output,actualMicroUsd};
   }finally{await rm(root,{recursive:true,force:true});}
  }};
  return runRenderJob({store,renderId,executor,signal,publish:async({bytes,...receipt})=>{await storage.putIfAbsent(receipt.storageKey,bytes,'video/mp4',receipt.sha256,{bucket:receipt.bucket});return receipt;}});
 }};
}

// Explicit local unbilled worker; does not provision or call cloud compute.
import {access} from 'node:fs/promises';import {LocalStore} from '../apps/director/store.mjs';import {createMediaStorage} from '../apps/director/media-storage.mjs';import {createPrivateSongRenderWorker} from '../apps/director/render-worker.mjs';
const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1],required=['--job','--project','--owner','--executor','--data-file','--asset-dir'];
if(args.includes('--help'))console.log('Run an already quoted, authorized local render: node scripts/run-director-render.mjs --local-unbilled --job UUID --project UUID --owner UUID --executor EXACT_QUOTED_ID --data-file PATH --asset-dir PATH');
else try{
 if(!args.includes('--local-unbilled')||required.some(k=>!args.includes(k)||!value(k)||value(k).startsWith('--')))throw Error('Explicit --local-unbilled and all source/job configuration are required. Use --help.');
 await access(value('--data-file'));await access(value('--asset-dir'));const store=await new LocalStore(value('--data-file')).init(),storage=createMediaStorage({env:{DIRECTOR_ASSET_DIR:value('--asset-dir')},demo:true}),worker=createPrivateSongRenderWorker({store,storage,executorId:value('--executor'),reportActual:async()=>0});
 const result=await worker.run({actorId:value('--owner'),projectId:value('--project'),renderId:value('--job')});console.log(JSON.stringify({renderId:value('--job'),status:result.status??'not_claimed',actualMicroUsd:result.actualMicroUsd??null,scope:'Local unbilled processing only; no hosted compute or creative-quality qualification.'}));
}catch(error){console.error(error.message);process.exitCode=1;}

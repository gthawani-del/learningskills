// Consumes a dedicated, already authorized Sandbox-compatible session. It never
// creates/resumes a VM or installs packages. Real cloud provenance/cost is separate.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SOURCE_INSPECTION_VERSION,privateSourceURL,INSPECTION_LIMITS} from './workers/source-inspection.mjs';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
function wav(){const data=Buffer.alloc(16000*2),head=Buffer.alloc(44);for(let i=0;i<16000;i++)data.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/16000)*8000),i*2);head.write('RIFF');head.writeUInt32LE(36+data.length,4);head.write('WAVEfmt ',8);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(1,22);head.writeUInt32LE(16000,24);head.writeUInt32LE(32000,28);head.writeUInt16LE(2,32);head.writeUInt16LE(16,34);head.write('data',36);head.writeUInt32LE(data.length,40);return Buffer.concat([head,data]);}
export async function sandboxInspectionProof({sandbox,enabled=false,privateSource}={}){
 if(!enabled)fail('sandbox_proof_disabled','Hosted inspection proof is disabled pending scoped access and execution authorization.');
 if(!sandbox||!['runCommand','writeFiles','stop'].every(name=>typeof sandbox[name]==='function'))fail('sandbox_interface_invalid','A dedicated inspection sandbox is required.');
 let result,error;
 try{
  if(privateSource){privateSourceURL(privateSource.storage);if(privateSource.source?.size>INSPECTION_LIMITS.maxBytes)fail('sandbox_source_invalid','The private source exceeds the bounded inspection limit.');}
  const versions={};for(const [name,args]of [['node',['--version']],['ffmpeg',['-version']],['ffprobe',['-version']]]){
   let command;try{command=await sandbox.runCommand({cmd:name,args,cwd:'/vercel/sandbox'});}catch{fail('sandbox_runtime_unavailable','Inspection runtime could not execute. No retry or package install was started.');}
   if(command.exitCode!==0)fail('sandbox_tools_missing','Node.js, FFmpeg and FFprobe must be installed in the reviewed sandbox image.');const output=await command.stdout();if(typeof output!=='string'||output.length>65536)fail('sandbox_runtime_invalid','Invalid runtime version response.');versions[name]=output.split('\n')[0];
  }
  const bytes=wav(),sha256=createHash('sha256').update(bytes).digest('hex'),source={mime:'audio/wav',size:bytes.length,sha256};
  const config={mode:'file',root:'/vercel/sandbox',path:'/vercel/sandbox/proof.wav',source};
  const worker=(await readFile(new URL('workers/source-inspection.mjs',import.meta.url),'utf8')).replace("'../public/song-analysis-core.js'","'./song-analysis-core.mjs'");
  const files=[{path:'source-inspection.mjs',content:Buffer.from(worker)},{path:'song-analysis-core.mjs',content:await readFile(new URL('public/song-analysis-core.js',import.meta.url))},{path:'proof.wav',content:bytes},{path:'proof.json',content:Buffer.from(JSON.stringify(config))},{path:'mismatch.json',content:Buffer.from(JSON.stringify({...config,source:{...source,sha256:'0'.repeat(64)}}))}];
  if(privateSource)files.push({path:'private-source.json',content:Buffer.from(JSON.stringify({mode:'private-download',root:'/vercel/sandbox',source:privateSource.source,storage:privateSource.storage}))});
  await sandbox.writeFiles(files);
  async function inspect(file,expectedExit){
   const command=await sandbox.runCommand({cmd:'node',args:['/vercel/sandbox/source-inspection.mjs','/vercel/sandbox/'+file],cwd:'/vercel/sandbox'});const output=await command.stdout();if(command.exitCode!==expectedExit||typeof output!=='string'||output.length>65536)fail('sandbox_inspection_failed','The inspection command did not return the expected result.');let report;try{report=JSON.parse(output);}catch{fail('sandbox_inspection_failed','Inspection returned invalid evidence.');}if(report.inspectionVersion!==SOURCE_INSPECTION_VERSION||report.assetPublished!==false)fail('sandbox_inspection_failed','Inspection evidence has an unexpected contract.');return report;
  }
  const positive=await inspect('proof.json',0),negative=await inspect('mismatch.json',1);
  if(positive.status!=='passed'||positive.sha256!==sha256||positive.size!==bytes.length||positive.decodeVerified!==true||Math.abs(positive.durationSeconds-1)>.01||negative.status!=='held'||negative.code!=='source_checksum_mismatch')fail('sandbox_inspection_failed','Positive and negative inspection evidence did not match the source.');
  let privateInspection=null;if(privateSource){privateInspection=await inspect('private-source.json',0);if(privateInspection.status!=='passed'||privateInspection.sha256!==privateSource.source.sha256||privateInspection.size!==privateSource.source.size||privateInspection.decodeVerified!==true)fail('sandbox_private_transfer_failed','Private source inspection did not match its manifest.');}
  result={proofVersion:'director-sandbox-inspection-proof-v1',runtime:versions,syntheticSource:positive,mismatchRejected:negative.code,privateInspection,cloudProvenanceVerified:false,costVerified:false,assetPublished:false};
 }catch(caught){error=caught.code?.startsWith('sandbox_')?caught:Object.assign(new Error('Inspection proof could not finish. No automatic retry was started.'),{code:'sandbox_proof_failed'});}
 finally{try{await sandbox.stop();}catch{error=Object.assign(new Error('Sandbox cleanup is unconfirmed. Inspect and stop the original session before retrying.'),{code:'sandbox_cleanup_unconfirmed'});}}
 if(error)throw error;return {...result,stopConfirmed:true};
}

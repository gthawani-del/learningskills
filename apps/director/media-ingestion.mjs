import {randomUUID} from 'node:crypto';
import {fail,hash} from './domain.mjs';

export const SOURCE_UPLOAD_MAX_BYTES=128*1024*1024;
export const SOURCE_UPLOAD_BUCKET='director-source-media';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles=new Set(['master_song','dialogue','voice_reference','ambience','shot_reference']);
export function sourceUploadManifest(body,project){
 if(!body||Object.keys(body).some(k=>!['requestId','name','mime','size','sha256','role','scope','shotId'].includes(k)))fail(400,'Supply only the source file manifest.');
 if(!uuid.test(body.requestId||'')||typeof body.name!=='string'||body.name.length<1||body.name.length>240||/[\x00-\x1f]/.test(body.name)||!['audio/wav','audio/mpeg','video/mp4'].includes(body.mime)||!Number.isSafeInteger(body.size)||body.size<1||body.size>SOURCE_UPLOAD_MAX_BYTES||!/^[a-f0-9]{64}$/.test(body.sha256||'')||!roles.has(body.role)||!['project','shot'].includes(body.scope))fail(400,'Choose WAV, MP3 or MP4 up to 128 MiB and a valid source role.');
 if(body.scope==='shot'&&!project.shots?.some(s=>s.id===body.shotId)||body.scope==='project'&&body.shotId!=null)fail(400,'Choose an existing shot or project scope.');
 if(body.role==='master_song'&&(!body.mime.startsWith('audio/')||body.scope!=='project'))fail(400,'The master song must be project-scoped audio.');
 return {name:body.name,mime:body.mime,size:body.size,sha256:body.sha256,role:body.role,scope:body.scope,shotId:body.scope==='shot'?body.shotId:null};
}
export function visibleSourceUpload(row){
 const {id,projectId,manifest,status,createdAt,expiresAt}=row;
 return {id,projectId,...manifest,status,createdAt,expiresAt,ready:false};
}
export function createMediaIngestion({store,storage,enabled=false,now=()=>Date.now()}){
 const held=()=>{if(!enabled)fail(503,'Resumable source uploads await private-storage and inspection setup. Existing references are unchanged.');};
 const current=async(owner,project,id)=>{if(!uuid.test(id||''))fail(400,'Invalid upload ID.');const row=await store.sourceUpload(owner,project.id,id);if(Date.parse(row.expiresAt)<=now())fail(409,'This transfer expired. Start a new upload; your original file is unchanged.');return row;};
 return {
  async list(owner,project){held();return {uploads:(await store.sourceUploads(owner,project.id)).map(visibleSourceUpload)};},
  async start(owner,project,body){
   held();const manifest=sourceUploadManifest(body,project),id=randomUUID();
   const row=await store.createSourceUpload(owner,project.id,{id,projectId:project.id,ownerId:owner,requestId:body.requestId,manifest,manifestHash:hash(manifest),bucket:SOURCE_UPLOAD_BUCKET,storageKey:`${owner}/${project.id}/${id}`,status:'uploading',createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+24*3600*1000).toISOString()});
   return {upload:visibleSourceUpload(row)};
  },
  async ticket(owner,project,id){
   held();const row=await current(owner,project,id);if(row.status!=='uploading')fail(409,'This transfer is no longer accepting bytes.');
   return {upload:visibleSourceUpload(row),transport:await storage.signUpload(row.storageKey,{bucket:row.bucket})};
  },
  async complete(owner,project,id){
   held();const row=await current(owner,project,id);if(row.status==='inspection_pending')return {upload:visibleSourceUpload(row)};
   if(row.status!=='uploading')fail(409,'This transfer was cancelled.');
   const info=await storage.info(row.storageKey,{bucket:row.bucket});
   if(info.size!==row.manifest.size||info.mime!==row.manifest.mime)fail(409,'Stored file size or declared type differs. It has not entered the production library.');
   // Storage metadata proves transport completion only. A trusted worker must decode,
   // hash and inspect the source before any normal director_assets row can exist.
   return {upload:visibleSourceUpload(await store.transitionSourceUpload(owner,project.id,id,'inspection_pending'))};
  },
  async cancel(owner,project,id){held();await current(owner,project,id);return {upload:visibleSourceUpload(await store.transitionSourceUpload(owner,project.id,id,'cancelled'))};}
 };
}

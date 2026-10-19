import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {hash,fail} from './domain.mjs';
export function createMediaStorage({env,fetcher=fetch,demo}){
 const dir=env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets';
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
 const bucketName=value=>{if(!['director-media','director-reference-media'].includes(value))fail(400,'Unsupported private media bucket.');return value;};
 const objectKey=value=>{if(typeof value!=='string'||!value||value.split('/').some(part=>!part||part==='.'||part==='..'||!/^[A-Za-z0-9_-]+$/.test(part)))fail(400,'Invalid private media key.');return value;};
 async function get(key,{bucket='director-media'}={}){bucketName(bucket);objectKey(key);if(demo)return readFile(join(dir,key.split('/').at(-1)));const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${key}`,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)fail(502,'Private reference retrieval failed.');return Buffer.from(await r.arrayBuffer());}
 async function putIfAbsent(key,bytes,mime,checksum,{bucket='director-media'}={}){
 bucketName(bucket);objectKey(key);
 if(demo){await mkdir(dir,{recursive:true});try{await writeFile(join(dir,key.split('/').at(-1)),bytes,{mode:0o600,flag:'wx'});return;}catch(error){if(error.code!=='EEXIST')throw error;}}
 else {const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${key}`,{method:'POST',headers:{...headers,'Content-Type':mime,'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});if(r.ok)return;if(![400,409].includes(r.status))fail(502,'Private upload failed. Resume saving without deleting your device draft.');}
 // A prior upload may have succeeded before its response/metadata was lost. Never overwrite it.
 const previous=await get(key,{bucket});if(hash(previous.toString('base64'))!==checksum)fail(409,'Stored reference content conflicts. The original has not been overwritten.');
 }
 async function sign(key,{bucket='director-media',expiresIn=3600}={}){
  bucketName(bucket);objectKey(key);if(demo)fail(409,'Sharing a private reference with a model requires a connected workspace.');
  if(!Number.isSafeInteger(expiresIn)||expiresIn<60||expiresIn>3600)fail(400,'Private reference sharing requires a bounded expiry.');
  const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${key}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expiresIn}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)fail(502,'Private identity sharing is unavailable. No generation was started.');const data=await r.json(),path=data.signedURL??data.signedUrl;
  if(typeof path!=='string'||!path.startsWith(`/object/sign/${bucket}/${key}?`)&&!path.startsWith(`/storage/v1/object/sign/${bucket}/${key}?`))fail(502,'The private storage service returned an invalid reference link.');
  return new URL(path.startsWith('/storage/v1/')?path:'/storage/v1'+path,env.SUPABASE_URL).href;
 }
 return {get,putIfAbsent,sign};
}

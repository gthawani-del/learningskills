import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {hash,fail} from './domain.mjs';
export function createMediaStorage({env,fetcher=fetch,demo}){
 const dir=env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets';
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
 async function get(key){if(demo)return readFile(join(dir,key.split('/').at(-1)));const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/authenticated/director-media/${key}`,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)fail(502,'Private reference retrieval failed.');return Buffer.from(await r.arrayBuffer());}
 async function putIfAbsent(key,bytes,mime,checksum){
 if(demo){await mkdir(dir,{recursive:true});try{await writeFile(join(dir,key.split('/').at(-1)),bytes,{mode:0o600,flag:'wx'});return;}catch(error){if(error.code!=='EEXIST')throw error;}}
 else {const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/director-media/${key}`,{method:'POST',headers:{...headers,'Content-Type':mime,'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});if(r.ok)return;if(![400,409].includes(r.status))fail(502,'Private upload failed. Resume saving without deleting your device draft.');}
 // A prior upload may have succeeded before its response/metadata was lost. Never overwrite it.
 const previous=await get(key);if(hash(previous.toString('base64'))!==checksum)fail(409,'Stored reference content conflicts. The original has not been overwritten.');
 }
 return {get,putIfAbsent};
}

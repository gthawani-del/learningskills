import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {hash,fail} from './domain.mjs';
export function createMediaStorage({env,fetcher=fetch,demo}){
 const dir=env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets';
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
 const bucketName=value=>{if(!['director-media','director-reference-media','director-source-media'].includes(value))fail(400,'Unsupported private media bucket.');return value;};
 const objectKey=value=>{if(typeof value!=='string'||!value||value.split('/').some(part=>!part||part==='.'||part==='..'||!/^[A-Za-z0-9_-]+$/.test(part)))fail(400,'Invalid private media key.');return value;};
 async function get(key,{bucket='director-media'}={}){bucketName(bucket);objectKey(key);if(demo)return readFile(join(dir,key.split('/').at(-1)));const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${key}`,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)fail(502,'Private reference retrieval failed.');return Buffer.from(await r.arrayBuffer());}
 async function getRange(key,{bucket='director-source-media',start,end,total}={}){
  bucketName(bucket);objectKey(key);if(bucket!=='director-source-media'||![start,end,total].every(Number.isSafeInteger)||start<0||end<start||end>=total||end-start+1>2*1024*1024)fail(400,'Choose one bounded private source range.');
  if(demo){const bytes=await get(key,{bucket});if(bytes.length!==total)fail(409,'Original source size changed.');return bytes.subarray(start,end+1);}
  const response=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${key}`,{headers:{...headers,Range:`bytes=${start}-${end}`},redirect:'error',signal:AbortSignal.timeout(30000)});
  const expected=end-start+1;if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${total}`||response.headers.get('content-length')!==String(expected)||!response.body?.getReader)fail(502,'Private storage did not confirm the exact original byte range.');
  const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>expected)fail(502,'Private source range exceeds its bound.');chunks.push(Buffer.from(value));}if(size!==expected)fail(502,'Private source range was incomplete.');return Buffer.concat(chunks,size);}finally{try{await reader.cancel();}catch{}reader.releaseLock();}
 }
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
 async function signUpload(key,{bucket='director-source-media'}={}){
  bucketName(bucket);objectKey(key);if(demo)fail(409,'Resumable uploads require a connected private workspace.');
  const base=new URL(env.SUPABASE_URL);
  if(base.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(base.hostname)||base.port||base.pathname!=='/'||base.username||base.password)fail(503,'A verified Supabase storage origin is required.');
  const r=await fetcher(`${base.origin}/storage/v1/object/upload/sign/${bucket}/${key}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
  if(!r.ok)fail(502,'The private upload permission could not be issued. Your file is unchanged.');
  const data=await r.json();let url;try{url=new URL('/storage/v1'+data.url,base.origin);}catch{fail(502,'Invalid upload permission.');}
  if(typeof data.url!=='string'||url.origin!==base.origin||url.pathname!==`/storage/v1/object/upload/sign/${bucket}/${key}`||!url.searchParams.get('token'))fail(502,'Invalid upload permission.');
  return {endpoint:`https://${base.hostname.replace('.supabase.co','.storage.supabase.co')}/storage/v1/upload/resumable`,bucket,objectName:key,token:url.searchParams.get('token'),chunkSize:6*1024*1024};
 }
 async function info(key,{bucket='director-source-media'}={}){
  bucketName(bucket);objectKey(key);if(demo)fail(409,'Source inspection requires a connected workspace.');
  const r=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/info/${bucket}/${key}`,{headers,signal:AbortSignal.timeout(20000)});
  if(r.status===404)fail(409,'This upload is not finished. Resume transferring the original file.');if(!r.ok)fail(502,'Could not confirm upload completion. Retry the check without uploading again.');
  // Current object/info returns FileObjectV2 fields; older deployments may
  // return system metadata. Neither shape is content-inspection evidence.
  const data=await r.json();const size=Number(data.size??data.metadata?.size),mime=data.content_type??data.metadata?.mimetype;
  if(!Number.isSafeInteger(size)||size<1||typeof mime!=='string')fail(502,'Storage returned incomplete source metadata.');return {size,mime};
 }
 return {get,getRange,putIfAbsent,sign,signUpload,info};
}

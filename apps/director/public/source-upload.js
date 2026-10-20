// The server owns the destination and receipt. No account/service credentials or
// signed upload tokens are persisted. TUS stores only scoped transport URLs.
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
export async function sourceFileManifest(file,{role,scope='project',shotId=null},cryptoProvider=globalThis.crypto){
 if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>128*1024*1024||!['audio/wav','audio/mpeg','video/mp4'].includes(file.type))throw Error('Choose WAV, MP3 or MP4 up to 128 MiB.');
 // Bounded pilot implementation. This is a client identity claim, never trusted
 // inspection evidence; the worker will independently stream-hash and decode.
 const sha256=hex(await cryptoProvider.subtle.digest('SHA-256',await file.arrayBuffer()));
 return {name:file.name,mime:file.type,size:file.size,sha256,role,scope,shotId};
}
export async function transferSourceFile({api,projectId,file,manifest,requestId,uploadId,Upload,signal,onProgress=()=>{}}){
 const checkActive=()=>{if(signal?.aborted)throw Error('Transfer paused. Your original file is unchanged.');};checkActive();
 const root=`/api/projects/${encodeURIComponent(projectId)}/source-uploads`;
 let receipt;
 if(uploadId){receipt=(await api(root)).uploads.find(u=>u.id===uploadId);if(!receipt)throw Error('Upload not found.');for(const key of ['name','mime','size','sha256','role','scope','shotId'])if(receipt[key]!==manifest[key])throw Error('Reselect the original file and reference role before resuming.');}
 else receipt=(await api(root,{method:'POST',body:{requestId,...manifest}})).upload;
 if(receipt.status==='inspection_pending')return {upload:receipt,pause:async()=>{},done:Promise.resolve(receipt)};
 // A successful TUS response can be lost. Probe the owned object before starting
 // another transport, including when the SDK already removed its fingerprint.
 try{const result=await api(`${root}/${receipt.id}/complete`,{method:'POST',body:{}});return {upload:result.upload,pause:async()=>{},done:Promise.resolve(result.upload)};}catch(error){if(error.status!==409)throw error;}
 const {transport}=await api(`${root}/${receipt.id}/ticket`,{method:'POST',body:{}});
 checkActive();
 const endpoint=new URL(transport.endpoint);
 if(endpoint.protocol!=='https:'||!/^[-a-z0-9]+\.storage\.supabase\.co$/.test(endpoint.hostname)||endpoint.port||endpoint.pathname!=='/storage/v1/upload/resumable'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('Upload destination is not a verified private storage endpoint.');
 const trustedURL=value=>{const url=new URL(value);if(url.origin!==endpoint.origin||url.pathname!==endpoint.pathname&&!url.pathname.startsWith(endpoint.pathname+'/'))throw Error('Untrusted upload destination.');};
 if(!Upload){await import('./tus-client.js');Upload=globalThis.tus.Upload;}
 checkActive();
 // Scope the fingerprint to project + immutable receipt, not merely file name.
 let resolve,reject;const done=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const upload=new Upload(file,{
  endpoint:transport.endpoint,chunkSize:6*1024*1024,
  headers:{'x-signature':transport.token,'x-upsert':'false'},
  onBeforeRequest:request=>trustedURL(request.getURL()),
  retryDelays:[0,1000,3000,5000,10000],uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
  fingerprint:async()=>`director-source-v1:${projectId}:${receipt.id}:${manifest.sha256}`,
  metadata:{bucketName:transport.bucket,objectName:transport.objectName,contentType:manifest.mime,cacheControl:'3600'},
  onProgress:(sent,total)=>onProgress({sent,total,uploadId:receipt.id}),
  onError:()=>reject(Error('Transfer interrupted. Reselect the original file and resume this upload.')),
  onSuccess:()=>{api(`${root}/${receipt.id}/complete`,{method:'POST',body:{}}).then(r=>resolve(r.upload),()=>reject(Error('File transferred; completion check is pending. Resume to check it without replacing your file.')));}
 });
 const pause=async()=>{await upload.abort();resolve({...receipt,paused:true});};
 const abort=()=>{pause().catch(()=>reject(Error('Transfer stopped. Reselect the original file to resume.')));};signal?.addEventListener('abort',abort,{once:true});
 done.then(()=>signal?.removeEventListener('abort',abort),()=>signal?.removeEventListener('abort',abort));
 try{const previous=await upload.findPreviousUploads();checkActive();if(previous.length){trustedURL(previous[0].uploadUrl);upload.resumeFromPreviousUpload(previous[0]);}upload.start();}catch{reject(Error('Transfer could not start. Your original file is unchanged.'));}
 return {upload:receipt,done,pause};
}

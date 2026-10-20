import {sourceFileManifest,transferSourceFile} from './source-upload.js';

export function createSourceUploadUI({api,getContext,host,notify,onPublished=async()=>{}}){
 let active=null,busy=false,abortController=null;
 const message=document.createElement('p'),list=document.createElement('ul'),pause=document.createElement('button'),progress=document.createElement('progress');
 progress.max=100;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','Source upload progress');
 message.setAttribute('role','status');message.setAttribute('aria-live','polite');pause.type='button';pause.textContent='Pause transfer';pause.hidden=true;host.append(message,progress,pause,list);
 const context=()=>{const value=getContext();if(!value?.enabled||!value.ownerId||!value.projectId)throw Error('Save the project to your signed-in workspace before uploading a large source.');return value;};
 const root=id=>`/api/projects/${encodeURIComponent(id)}/source-uploads`;
 async function refresh(){
  host.hidden=true;let captured;try{captured=context();}catch{return;}
  host.hidden=false;message.textContent='Source transfers · files become available after inspection.';
  const {uploads}=await api(root(captured.projectId));const current=getContext();if(current.projectId!==captured.projectId||current.ownerId!==captured.ownerId)return;
  list.replaceChildren();for(const receipt of uploads.filter(u=>u.status!=='cancelled')){
   const row=document.createElement('li'),label=document.createElement('span');label.textContent=receipt.name+' — '+(receipt.ready?'Available in your asset library.':receipt.status==='inspection_pending'?'Uploaded; inspection pending. Not available for production.':'Transfer incomplete. Reselect the original file, then resume.');row.append(label);
   if(receipt.ready){list.append(row);continue;}
   if(receipt.status==='inspection_pending'){const check=document.createElement('button');check.type='button';check.textContent='Check inspection';check.onclick=async()=>{check.disabled=true;try{const current=context();if(current.ownerId!==captured.ownerId||current.projectId!==captured.projectId)throw Error('The project changed. Reopen attachments.');const result=await api(`${root(captured.projectId)}/${receipt.id}/publish`,{method:'POST',body:{}});const after=getContext();if(after.ownerId!==captured.ownerId||after.projectId!==captured.projectId)return;await onPublished(result.asset,captured);notify('Inspected source added to your asset library. No generation started.');await refresh();}catch(e){notify(e.message);}finally{check.disabled=false;}};row.append(check);}
   if(receipt.status==='uploading'){const resume=document.createElement('button');resume.type='button';resume.textContent='Resume';resume.onclick=()=>{const file=document.querySelector('#upload-file')?.files[0];if(!file)return notify('Select the original file in the file picker first.');start(file,receipt,receipt.id).catch(e=>notify(e.message));};row.append(resume);}
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel upload';cancel.onclick=async()=>{try{if(busy)throw Error('Pause the active transfer before cancelling.');const current=context();if(current.ownerId!==captured.ownerId||current.projectId!==captured.projectId)throw Error('The project changed. Reopen attachments.');await api(`${root(captured.projectId)}/${receipt.id}/cancel`,{method:'POST',body:{}});await refresh();}catch(e){notify(e.message);}};row.append(cancel);list.append(row);
  }
  host.hidden=!busy&&!list.childElementCount;
 }
 async function start(file,metadata,uploadId){
  if(busy)throw Error('Pause or finish the active transfer first.');const captured=context();busy=true;host.hidden=false;abortController=new AbortController();const signal=abortController.signal;
  try{
   message.textContent='Checking file identity before transfer…';const manifest=await sourceFileManifest(file,metadata);
   if(signal.aborted)throw Error('Transfer paused. Your original file is unchanged.');
   if(context().ownerId!==captured.ownerId||context().projectId!==captured.projectId)throw Error('The active workspace changed. Select your project again.');
   // Recover an unknown create response using the server's durable receipts.
   if(!uploadId){const {uploads}=await api(root(captured.projectId));uploadId=uploads.find(u=>u.status==='uploading'&&['name','mime','size','sha256','role','scope','shotId'].every(k=>u[k]===manifest[k]))?.id;}
   active=await transferSourceFile({api,projectId:captured.projectId,file,manifest,uploadId,signal,requestId:crypto.randomUUID(),onProgress:({sent,total})=>{progress.hidden=false;progress.value=Math.floor(sent/total*100);message.textContent=`Uploading ${progress.value}% · your original file is unchanged.`;}});
   pause.hidden=false;const result=await active.done;
   notify(result.paused?'Transfer paused. Reselect the original file to resume.':'Upload finished. Inspection is pending; the file is not ready for production.');
  }finally{busy=false;active=null;abortController=null;pause.hidden=true;progress.hidden=true;await refresh();}
 }
 async function stop(){abortController?.abort();if(active)await active.pause();}
 pause.onclick=()=>stop().catch(e=>notify(e.message));
 return {show:refresh,start,pause:stop};
}

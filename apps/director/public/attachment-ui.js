// Attachment presentation reuses existing upload, project assets and message bindings.
const supported=['image/jpeg','image/png','image/webp','video/mp4','audio/wav','audio/mpeg','application/pdf','text/plain','text/markdown'];
export const attachmentMime=file=>file?.type||(file?.name?.toLowerCase().endsWith('.md')?'text/markdown':'');
const readableSize=size=>size>=1024*1024?`${(size/1024/1024).toFixed(1)} MiB`:size>=1024?`${Math.ceil(size/1024)} KiB`:`${size} bytes`;
export function suggestedAttachmentRole(mime,{format,requestedRole,hasShot=false}={}){
 if(mime.startsWith('audio/'))return format==='music_video'?'master_song':'voice_reference';
 if(mime.startsWith('video/'))return 'shot_reference';
 if(mime.startsWith('image/'))return ['character_identity','wardrobe','location','visual_style','prop','shot_reference'].includes(requestedRole)?requestedRole:hasShot?'shot_reference':'visual_style';
 return 'script';
}
export function attachmentFileLimit(mime,context){return context.resumableUploads&&['audio/wav','audio/mpeg','video/mp4'].includes(mime)?context.sourceUploadMaxBytes:context.uploadMaxBytes;}
export function mountAttachmentUI({dialog,getContext,onUseAsset}){
 const find=id=>dialog.querySelector('#'+id),fileInput=find('upload-file'),form=find('upload-form'),role=find('upload-role'),scope=find('upload-scope');
 let selected=null,objectURL=null,projectId=null,roleEdited=false;
 const sourceTabs=[find('attachment-upload-tab'),find('attachment-library-tab')];
 const pauseMedia=()=>dialog.querySelectorAll('audio,video').forEach(media=>media.pause());
 const error=text=>find('attachment-error').textContent=text;
 function releasePreview(){pauseMedia();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;find('attachment-media').replaceChildren();}
 function tab(name){const library=name==='library';sourceTabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===(library?1:0)));t.tabIndex=i===(library?1:0)?0:-1;});find('attachment-upload-panel').hidden=library;find('attachment-library-panel').hidden=!library;fileInput.required=!library;if(library)renderLibrary();}
 function renderLibrary(){
  const context=getContext(),assets=context.assets||[],query=find('attachment-library-search').value.trim().toLowerCase(),rows=assets.filter(a=>`${a.name||a.filename||''} ${a.role||''}`.toLowerCase().includes(query)),box=find('attachment-library-results');box.replaceChildren();find('attachment-library-count').textContent=assets.length;
  if(!rows.length){const empty=document.createElement('p');empty.className='attachment-empty';empty.textContent=assets.length?'No matching references. Try another name or role.':'No references in this project yet. Upload a file to add one.';box.append(empty);return;}
  for(const asset of rows){const button=document.createElement('button');button.type='button';button.className='attachment-library-item';const thumb=document.createElement('span');thumb.className='attachment-library-thumb';if(asset.mime?.startsWith('image/')&&asset.url){const img=document.createElement('img');img.src=asset.url;img.alt='';img.loading='lazy';thumb.append(img);}else thumb.textContent=asset.mime?.startsWith('audio/')?'Audio':asset.mime?.startsWith('video/')?'Video':'File';const copy=document.createElement('span'),name=document.createElement('strong'),hint=document.createElement('small');name.textContent=asset.name||asset.filename||'Project reference';hint.textContent=(asset.role||'reference').replaceAll('_',' ');copy.append(name,hint);const action=document.createElement('span');action.className='attachment-library-action';action.textContent='Use reference';button.append(thumb,copy,action);button.onclick=()=>{if(getContext().projectId!==context.projectId){error('The project changed. Reopen attachments.');return;}onUseAsset(asset);dialog.close();};box.append(button);}
 }
 function present(file){
  releasePreview();selected=file;const has=!!file;find('attachment-browse').hidden=has;find('attachment-preview').hidden=!has;find('attachment-settings').hidden=!has;find('attachment-submit').disabled=!has;
  if(!file){for(const option of role.options){option.disabled=false;option.hidden=false;}return;}
  const mime=attachmentMime(file),context=getContext();find('attachment-filename').textContent=file.name;find('attachment-filemeta').textContent=`${mime.startsWith('image/')?'Image':mime.startsWith('audio/')?'Audio':mime.startsWith('video/')?'Video':'Document'} · ${readableSize(file.size)} · selected`;
  const roles=mime.startsWith('image/')?['character_identity','wardrobe','location','visual_style','prop','shot_reference']:mime.startsWith('audio/')?['master_song','dialogue','voice_reference','ambience']:mime.startsWith('video/')?['shot_reference']:['script'];
  if(!roleEdited||!roles.includes(role.value)){role.value=suggestedAttachmentRole(mime,{format:context.format,requestedRole:role.value,hasShot:!!context.shotId});roleEdited=false;}
  for(const option of role.options){option.disabled=!roles.includes(option.value);option.hidden=option.disabled;}
  const target=find('attachment-media');if(/^(image|video|audio)\//.test(mime)){objectURL=URL.createObjectURL(file);const media=document.createElement(mime.startsWith('image/')?'img':mime.startsWith('video/')?'video':'audio');media.src=objectURL;if(media.tagName==='IMG')media.alt='Selected reference preview';else{media.controls=true;media.preload='metadata';if(media.tagName==='VIDEO')media.playsInline=true;media.setAttribute('aria-label','Selected reference preview');}target.append(media);}else{const icon=document.createElement('span');icon.className='attachment-document';icon.textContent=mime==='application/pdf'?'PDF':'TEXT';target.append(icon);}
 }
 function choose(files){
  if(!files.length)return;if(files.length!==1){error('Add one reference at a time. Your current selection is unchanged.');restore();return;}
  const file=files[0],mime=attachmentMime(file),limit=attachmentFileLimit(mime,getContext());if(!supported.includes(mime)||file.size<1||file.size>limit){error(!supported.includes(mime)?'Use JPEG, PNG, WEBP, MP4, WAV, MP3, PDF, TXT or MD.':`This file exceeds the ${(limit/1024/1024).toFixed(0)} MiB limit or is empty. Your previous selection is unchanged.`);restore();return;}
  error('');const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;present(file);tab('upload');
 }
 function restore(){const transfer=new DataTransfer();if(selected)transfer.items.add(selected);fileInput.files=transfer.files;}
 find('attachment-browse').onclick=()=>fileInput.click();find('attachment-replace').onclick=()=>fileInput.click();find('attachment-remove').onclick=()=>{fileInput.value='';roleEdited=false;error('');present(null);find('attachment-browse').focus();};fileInput.addEventListener('change',()=>choose(Array.from(fileInput.files)));
 role.addEventListener('change',()=>roleEdited=true);
 sourceTabs.forEach((button,i)=>{button.onclick=()=>tab(i?'library':'upload');button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-i;tab(next?'library':'upload');sourceTabs[next].focus();});});
 find('attachment-library-search').oninput=renderLibrary;
 dialog.addEventListener('dragover',event=>{event.preventDefault();dialog.classList.add('attachment-dragging');});dialog.addEventListener('dragleave',event=>{if(!dialog.contains(event.relatedTarget))dialog.classList.remove('attachment-dragging');});dialog.addEventListener('drop',event=>{event.preventDefault();dialog.classList.remove('attachment-dragging');choose(Array.from(event.dataTransfer.files));});dialog.addEventListener('paste',event=>{const files=Array.from(event.clipboardData?.files||[]);if(files.length){event.preventDefault();choose(files);}});
 dialog.addEventListener('close',pauseMedia);
 form.addEventListener('reset',()=>{queueMicrotask(()=>{roleEdited=false;present(null);error('');});});
 return {open(){const context=getContext();if(projectId!==context.projectId){fileInput.value='';roleEdited=false;present(null);find('attachment-library-search').value='';}projectId=context.projectId;error('');if(!selected)role.value=context.format==='music_video'?'master_song':context.shotId?'shot_reference':'visual_style';scope.value=context.shotId&&['storyboard','production','edit'].includes(context.stage)?'shot':'project';scope.querySelector('[value=shot]').disabled=!context.shotId;find('attachment-library-count').textContent=(context.assets||[]).length;tab('upload');if(!dialog.open)dialog.showModal();find(selected?'attachment-replace':'attachment-browse').focus();}};
}

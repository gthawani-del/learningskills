import {frameAt,fitFrameCounts} from './animatic-core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dirty=false,disposeCurrent=()=>{};
export const animaticHasUnsaved=()=>dirty;
export const disposeAnimatic=()=>disposeCurrent();
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
export function mountAnimatic(host,{project,api,onSaved,canStart}){
 disposeCurrent();if(!host)return;
 let disposed=false,playing=false,starting=false,tickId,origin=0,playhead=0,context=null,edit=null,busy=false,loaded=-1,lastCheck=0,checking=false,masterDuration=null,epoch=0,imageLoad=null,imageIndex=-1,imageToken=0;
 const master=()=>host.querySelector('[data-animatic-audio]');
 const aligned=()=>!context?.audioLinked||Number.isFinite(masterDuration)&&masterDuration>0&&masterDuration<=3600&&Math.abs(masterDuration-context.durationSeconds)<=1/context.fps+0.01;
 const stop=()=>{epoch++;playing=false;cancelAnimationFrame(tickId);master()?.pause();host.querySelector('[data-animatic-play]')?.setAttribute('aria-pressed','false');const b=host.querySelector('[data-animatic-play]');if(b)b.textContent='Play';};
 const cleanup=()=>{disposed=true;stop();dirty=false;document.removeEventListener('visibilitychange',visibility);};disposeCurrent=cleanup;
 const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
 const finish=()=>{busy=false;if(!disposed)host.querySelectorAll('[data-animatic-edit],[data-animatic-refresh]').forEach(button=>button.disabled=false);};
 const status=text=>{const p=host.querySelector('[data-animatic-status]');if(p)p.textContent=text;};
 const endpoint=`/api/projects/${encodeURIComponent(project.id)}/animatic`;
 async function read(){const data=await api(endpoint);if(disposed)return null;return data.animatic;}
 async function showFrame(frame){
  if(!context?.canPlay||disposed)return false;
  const slot=frameAt(context.frames,frame),img=host.querySelector('[data-animatic-image]');
  if(slot.index!==loaded){
   if(imageIndex!==slot.index||!imageLoad){const pin=context.frames[slot.index],token=++imageToken;imageIndex=slot.index;img.src=`/api/projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(pin.assetId)}/content`;img.alt=`Storyboard still ${slot.index+1}: ${pin.label||pin.shotId}`;imageLoad=img.decode().then(()=>{if(disposed||token!==imageToken)return false;loaded=slot.index;return true;}).catch(()=>{if(disposed||token!==imageToken)return false;imageLoad=null;imageIndex=-1;stop();status('The private storyboard image could not load. Retry the original preview; no generation was started.');return false;});}
   if(!await imageLoad)return false;
  }
  if(disposed)return false;
  const slider=host.querySelector('[data-animatic-seek]');slider.value=frame;
  host.querySelector('[data-animatic-position]').textContent=`${(frame/context.fps).toFixed(2)} / ${context.durationSeconds.toFixed(2)} seconds · Shot ${slot.index+1} of ${context.frames.length}`;
  return true;
 }
 async function tick(time){
  if(!playing||disposed)return;
  const position=context.audio?master().currentTime:(time-origin)/1000,next=Math.min(context.totalFrames-1,Math.floor(position*context.fps));
  if(next!==playhead){const crossing=frameAt(context.frames,next).index!==loaded;if(crossing){stop();const resumeEpoch=epoch;playhead=next;if(await showFrame(playhead)&&epoch===resumeEpoch&&!disposed&&!document.hidden){try{if(context.audio)await master().play();if(epoch!==resumeEpoch||disposed||document.hidden){master()?.pause();return;}origin=performance.now()-playhead/context.fps*1000;playing=true;host.querySelector('[data-animatic-play]').textContent='Pause';host.querySelector('[data-animatic-play]').setAttribute('aria-pressed','true');tickId=requestAnimationFrame(tick);}catch{status('Press Play to resume the original audio.');}}return;}playhead=next;await showFrame(playhead);}
  if(context.audio?master().ended:position>=context.durationSeconds){stop();return;}
  if(time-lastCheck>5000&&!checking){checking=true;lastCheck=time;const checkedEpoch=epoch;read().then(fresh=>{if(epoch!==checkedEpoch||disposed)return;if(fresh&&(!fresh.canPlay||JSON.stringify(fresh.audio)!==JSON.stringify(context.audio)||JSON.stringify(fresh.frames)!==JSON.stringify(context.frames)||fresh.sequenceVersion!==context.sequenceVersion)){stop();context=fresh;draw();status('Inputs changed. Review current frames/audio and explicitly refresh the timing draft.');}}).catch(()=>{if(epoch!==checkedEpoch||disposed)return;stop();status('Source review could not be checked. Reload the preview before continuing.');}).finally(()=>checking=false);}
  if(playing)tickId=requestAnimationFrame(tick);
 }
 function draw(){
  if(disposed)return;stop();playhead=Math.max(0,Math.min(playhead,(context?.totalFrames||1)-1));loaded=-1;imageIndex=-1;imageLoad=null;imageToken++;
  host.innerHTML=`<h2>Timed storyboard</h2><p class="small muted">${context?.audioLinked?'Original-audio':'Silent'} draft preview · ${context?.saved?'Saved timing v'+context.version:'Shot-duration estimates'} · No automatic beat/lyric alignment, moving footage or final production approval.</p>${context?.holds?.length?`<p class="small" role="status">${context.holds.map(esc).join(' ')}</p>`:''}${context?.canPlay?`<figure class="animatic-screen"><img data-animatic-image alt="Storyboard preview"><figcaption data-animatic-position></figcaption></figure><div class="actions"><button data-animatic-play aria-pressed="false">Play</button><button data-animatic-edit ${busy?'disabled':''}>Edit timing</button></div><label>Preview position<input data-animatic-seek type="range" min="0" max="${context.totalFrames-1}" value="0" step="1"></label><p class="small">${context.durationSeconds.toFixed(2)} seconds at ${context.fps} fps. Playback pauses while the next private image loads.</p>`:''}<div data-animatic-editor></div>${audioHTML()}<button data-animatic-refresh ${busy?'disabled':''}>${context?.saved?'Refresh from current approved frames':'Prepare from approved frames'}</button><p data-animatic-status class="small" role="status" aria-live="polite"></p>`;
  host.querySelector('[data-animatic-refresh]').onclick=async()=>{if(busy||dirty||!canStart())return;try{busy=true;stop();const fresh=await read();if(!fresh)return;context=fresh;const source=fresh.sourceFrames;if(source.some(f=>!f.assetId))throw Error('Approve every current frame before preparing timing.');if(!confirm('Use the current approved frame sequence and its duration estimates? Earlier saved timing remains in history. '+(fresh.audioLinked?'The original audio remains linked.':'This is a silent draft.')))return;const data=await api(endpoint,{method:'POST',body:{expectedVersion:fresh.projectVersion,fps:24,frameCounts:source.map(f=>f.frameCount),refresh:true,acknowledgeTiming:true}});if(disposed)return;onSaved(data.project);context=data.animatic;playhead=0;draw();status((context.audioLinked?'Original-audio':'Silent')+' draft saved. Timing remains estimated until you review and edit it.');}catch(error){status(error.message);}finally{finish();}};
  bindAudio();
  if(!context?.canPlay)return;
  showFrame(playhead);
  host.querySelector('[data-animatic-play]').onclick=async()=>{if(playing){stop();return;}if(starting||dirty||busy||!canStart())return;starting=true;const playEpoch=epoch;try{const fresh=await read();if(!fresh||epoch!==playEpoch||disposed)return;if(!fresh.canPlay||JSON.stringify(fresh.audio)!==JSON.stringify(context.audio)||JSON.stringify(fresh.frames)!==JSON.stringify(context.frames)||fresh.fps!==context.fps){context=fresh;draw();status('Reloaded current timing and frame review. Press Play again after reviewing it.');return;}if(playhead>=context.totalFrames-1)playhead=0;if(!await showFrame(playhead)||epoch!==playEpoch||disposed)return;if(context.audioLinked){if(!aligned())throw Error('Match the complete original audio duration before playback.');master().currentTime=playhead/context.fps;master().playbackRate=1;await master().play();}if(epoch!==playEpoch||disposed||document.hidden){master()?.pause();return;}origin=performance.now()-playhead/context.fps*1000;lastCheck=performance.now();playing=true;host.querySelector('[data-animatic-play]').textContent='Pause';host.querySelector('[data-animatic-play]').setAttribute('aria-pressed','true');tickId=requestAnimationFrame(tick);}catch(error){if(!disposed)status(error.message);}finally{starting=false;}};
  host.querySelector('[data-animatic-seek]').oninput=event=>{stop();playhead=Number(event.target.value);if(context.audio&&Number.isFinite(masterDuration))master().currentTime=Math.min(playhead/context.fps,masterDuration);showFrame(playhead);};
  host.querySelector('[data-animatic-edit]').onclick=()=>{if(busy||!canStart())return;stop();edit={...context,counts:context.frames.map(f=>f.frameCount),selected:0};dirty=true;editor();};
 }
 function audioHTML(){
  const audio=context?.audio,options=context?.audioOptions||[];
  return `${audio&&context.canPlay?`<audio data-animatic-audio preload="metadata" hidden src="/api/projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(audio.assetId)}/content"></audio><p class="small" data-animatic-audio-duration>Reading original audio duration…</p><button data-animatic-fit disabled>Fit shot timing to complete audio</button>`:''}<details class="animatic-audio-options"><summary>Original audio${audio?' · '+esc(audio.name):''}</summary><p class="small">Choose an existing project song or dialogue file. The original stays unchanged. Browser metadata measures preview duration; this is not song analysis or audiovisual approval.</p><select data-animatic-audio-choice aria-label="Original audio source"><option value="">Choose an uploaded song or dialogue</option>${options.map(a=>`<option value="${esc(a.assetId)}">${esc(a.name)}</option>`).join('')}</select><div class="actions"><button data-animatic-link ${!context?.frameSourcesCurrent?'disabled':''}>Link original audio</button>${context?.audioLinked?'<button data-animatic-unlink>Return to silent draft</button>':''}</div>${!options.length?'<p class="small">Use Add reference to upload a project song or dialogue WAV/MP3 first. Existing upload limits apply.</p>':''}</details>`;
 }
 async function saveAudioChange(audio){
  if(busy||dirty||!canStart())return;
  if(!confirm(audio?'Link this exact original audio to the current timing draft? Playback will require complete-audio duration coverage. No voice, music or images are generated.':'Unlink audio from a new timing version? The original file and older timing versions stay saved.'))return;
  busy=true;stop();try{
   const fresh=await read();if(!fresh)return;
   if(!fresh.frameSourcesCurrent||JSON.stringify(fresh.frames)!==JSON.stringify(context.frames)||fresh.fps!==context.fps)throw Error('Review and refresh changed frame timing before changing audio.');
   const data=await api(endpoint,{method:'POST',body:{expectedVersion:fresh.projectVersion,fps:fresh.fps,frameCounts:fresh.frames.map(f=>f.frameCount),audio,acknowledgeAudio:true,acknowledgeTiming:true,refresh:!fresh.canPlay}});
   if(disposed)return;onSaved(data.project);context=data.animatic;playhead=0;draw();status(audio?'Original audio linked. Check its complete duration before playback.':'Silent draft saved. The original audio remains in your library.');
  }catch(error){status(error.message);}finally{finish();}
 }
 function bindAudio(){
  masterDuration=null;const audio=master(),play=host.querySelector('[data-animatic-play]'),fit=host.querySelector('[data-animatic-fit]');
  host.querySelector('[data-animatic-link]').onclick=()=>{const id=host.querySelector('[data-animatic-audio-choice]').value,option=context.audioOptions.find(a=>a.assetId===id);if(!option)return status('Choose an uploaded original song or dialogue first.');saveAudioChange({assetId:option.assetId,assetVersion:option.assetVersion});};
  host.querySelector('[data-animatic-unlink]')?.addEventListener('click',()=>saveAudioChange(null));
  if(!audio)return;
  if(play)play.disabled=true;
  audio.onloadedmetadata=()=>{if(disposed)return;masterDuration=audio.duration;const valid=Number.isFinite(masterDuration)&&masterDuration>0&&masterDuration<=3600;host.querySelector('[data-animatic-audio-duration]').textContent=valid?`Original audio: ${masterDuration.toFixed(2)} seconds (browser decoded). Storyboard: ${context.durationSeconds.toFixed(2)} seconds.`:'This audio cannot provide a bounded complete preview duration.';if(play)play.disabled=!aligned();if(fit)fit.disabled=!valid;if(valid&&!aligned())status('Shot timing must cover the complete original audio. Fit proportionally or edit timing; no trimming, looping or stretching is automatic.');};
  audio.onerror=()=>{stop();if(play)play.disabled=true;status('The linked original audio could not decode. Choose another source or return to a silent draft; no replacement was generated.');};
  audio.onended=()=>{stop();playhead=context.totalFrames-1;showFrame(playhead);};
  fit.onclick=async()=>{if(busy||dirty||!canStart()||!Number.isFinite(masterDuration))return;if(!confirm('Fit every shot proportionally to the complete original audio? This creates a new timing version. It does not find beats or align lyrics.'))return;busy=true;stop();try{const fresh=await read();if(!fresh)return;if(!fresh.canPlay||JSON.stringify(fresh.audio)!==JSON.stringify(context.audio)||JSON.stringify(fresh.frames)!==JSON.stringify(context.frames))throw Error('The saved inputs changed. Reopen and review the draft.');const counts=fitFrameCounts(fresh.frames.map(f=>f.frameCount),Math.round(masterDuration*fresh.fps));const data=await api(endpoint,{method:'POST',body:{expectedVersion:fresh.projectVersion,fps:fresh.fps,frameCounts:counts,acknowledgeTiming:true}});if(disposed)return;onSaved(data.project);context=data.animatic;playhead=0;draw();status('Proportional audio timing saved. Review pacing; no beat or lyric analysis was performed.');}catch(error){status(error.message);}finally{finish();}};
 }
 function editor(){
  const el=host.querySelector('[data-animatic-editor]');
  el.innerHTML=`<form class="animatic-editor"><label>Shot<select name="shot">${context.frames.map((f,i)=>`<option value="${i}" ${i===edit.selected?'selected':''}>${i+1}. ${esc(f.label||f.shotId)}</option>`).join('')}</select></label><label>Frames at ${edit.fps} fps<input name="frameCount" type="number" min="1" max="${edit.fps*900}" step="1" value="${edit.counts[edit.selected]}" required></label><p class="small">Edit one shot at a time. These are user timing choices, not measured song or dialogue alignment.</p><label><input name="ack" type="checkbox" required> I reviewed this timing draft.</label><div class="actions"><button type="submit" class="primary">Save timing</button><button type="button" data-animatic-cancel>Cancel</button></div></form>`;
  const form=el.querySelector('form');form.elements.frameCount.oninput=()=>edit.counts[edit.selected]=Number(form.elements.frameCount.value);form.elements.shot.onchange=()=>{edit.selected=Number(form.elements.shot.value);editor();};
  form.querySelector('[data-animatic-cancel]').onclick=()=>{dirty=false;edit=null;el.innerHTML='';};
  form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;busy=true;form.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);try{const data=await api(endpoint,{method:'POST',body:{expectedVersion:edit.projectVersion,fps:edit.fps,frameCounts:edit.counts,acknowledgeTiming:true}});if(disposed)return;onSaved(data.project);context=data.animatic;dirty=false;edit=null;playhead=0;draw();status('Timing version saved. Previous timing and frame decisions are preserved.');}catch(error){status(error.message);form.querySelectorAll('button,input,select').forEach(e=>e.disabled=false);}finally{finish();}};
 }
 host.innerHTML='<h2>Timed storyboard</h2><button data-load-animatic>Open timing preview</button><p class="small">Uses approved frames. Link original audio optionally. No generation, audio replacement or spending.</p><p data-animatic-status role="status"></p>';
 host.querySelector('[data-load-animatic]').onclick=async()=>{if(!canStart())return;try{context=await read();if(context)draw();}catch(error){status(error.message);}};
}

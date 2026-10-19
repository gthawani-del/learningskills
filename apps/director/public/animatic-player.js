import {frameAt} from './animatic-core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dirty=false,disposeCurrent=()=>{};
export const animaticHasUnsaved=()=>dirty;
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
export function mountAnimatic(host,{project,api,onSaved,canStart}){
 disposeCurrent();if(!host)return;
 let disposed=false,playing=false,tickId,origin=0,playhead=0,context=null,edit=null,busy=false,loaded=-1,lastCheck=0,checking=false;
 const stop=()=>{playing=false;cancelAnimationFrame(tickId);host.querySelector('[data-animatic-play]')?.setAttribute('aria-pressed','false');const b=host.querySelector('[data-animatic-play]');if(b)b.textContent='Play';};
 const cleanup=()=>{disposed=true;stop();dirty=false;document.removeEventListener('visibilitychange',visibility);};disposeCurrent=cleanup;
 const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
 const status=text=>{const p=host.querySelector('[data-animatic-status]');if(p)p.textContent=text;};
 const endpoint=`/api/projects/${encodeURIComponent(project.id)}/animatic`;
 async function read(){const data=await api(endpoint);if(disposed)return null;return data.animatic;}
 async function showFrame(frame){
  if(!context?.canPlay||disposed)return false;
  const slot=frameAt(context.frames,frame),img=host.querySelector('[data-animatic-image]');
  if(slot.index!==loaded){const pin=context.frames[slot.index];img.src=`/api/projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(pin.assetId)}/content`;img.alt=`Storyboard still ${slot.index+1}: ${pin.label||pin.shotId}`;try{await img.decode();if(disposed)return false;loaded=slot.index;}catch{stop();status('The private storyboard image could not load. Retry the original preview; no generation was started.');return false;}}
  const slider=host.querySelector('[data-animatic-seek]');slider.value=frame;
  host.querySelector('[data-animatic-position]').textContent=`${(frame/context.fps).toFixed(2)} / ${context.durationSeconds.toFixed(2)} seconds · Shot ${slot.index+1} of ${context.frames.length}`;
  return true;
 }
 async function tick(time){
  if(!playing||disposed)return;
  const next=Math.min(context.totalFrames-1,Math.floor((time-origin)/1000*context.fps));
  if(next!==playhead){const crossing=frameAt(context.frames,next).index!==loaded;if(crossing){stop();playhead=next;if(await showFrame(playhead)){origin=performance.now()-playhead/context.fps*1000;playing=true;host.querySelector('[data-animatic-play]').textContent='Pause';host.querySelector('[data-animatic-play]').setAttribute('aria-pressed','true');tickId=requestAnimationFrame(tick);}return;}playhead=next;await showFrame(playhead);}
  if(next>=context.totalFrames-1){stop();return;}
  if(time-lastCheck>5000&&!checking){checking=true;lastCheck=time;read().then(fresh=>{if(fresh&&(!fresh.canPlay||JSON.stringify(fresh.frames)!==JSON.stringify(context.frames)||fresh.sequenceVersion!==context.sequenceVersion)){stop();context=fresh;draw();status('Inputs changed. Review current frames and explicitly refresh the timing draft.');}}).catch(()=>{stop();status('Source review could not be checked. Reload the preview before continuing.');}).finally(()=>checking=false);}
  if(playing)tickId=requestAnimationFrame(tick);
 }
 function draw(){
  if(disposed)return;stop();playhead=Math.max(0,Math.min(playhead,(context?.totalFrames||1)-1));loaded=-1;
  host.innerHTML=`<h2>Timed storyboard</h2><p class="small muted">Silent draft preview · ${context?.saved?'Saved timing v'+context.version:'Shot-duration estimates'} · No audio alignment, moving footage or final production approval.</p>${context?.holds?.length?`<p class="small" role="status">${context.holds.map(esc).join(' ')}</p>`:''}${context?.canPlay?`<figure class="animatic-screen"><img data-animatic-image alt="Storyboard preview"><figcaption data-animatic-position></figcaption></figure><div class="actions"><button data-animatic-play aria-pressed="false">Play</button><button data-animatic-edit ${busy?'disabled':''}>Edit timing</button></div><label>Preview position<input data-animatic-seek type="range" min="0" max="${context.totalFrames-1}" value="0" step="1"></label><p class="small">${context.durationSeconds.toFixed(2)} seconds at ${context.fps} fps. Playback pauses while the next private image loads.</p>`:''}<div data-animatic-editor></div><button data-animatic-refresh ${busy?'disabled':''}>${context?.saved?'Refresh from current approved frames':'Prepare from approved frames'}</button><p data-animatic-status class="small" role="status" aria-live="polite"></p>`;
  host.querySelector('[data-animatic-refresh]').onclick=async()=>{if(busy||dirty||!canStart())return;try{busy=true;stop();const fresh=await read();if(!fresh)return;context=fresh;const source=fresh.sourceFrames;if(source.some(f=>!f.assetId))throw Error('Approve every current frame before preparing timing.');if(!confirm('Use the current approved frame sequence and its duration estimates? Earlier saved timing remains in history. This is a silent draft.'))return;const data=await api(endpoint,{method:'POST',body:{expectedVersion:fresh.projectVersion,fps:24,frameCounts:source.map(f=>f.frameCount),refresh:true,acknowledgeTiming:true}});if(disposed)return;onSaved(data.project);context=data.animatic;playhead=0;draw();status('Silent draft saved. Timing remains estimated until you review and edit it.');}catch(error){status(error.message);}finally{busy=false;}};
  if(!context?.canPlay)return;
  showFrame(playhead);
  host.querySelector('[data-animatic-play]').onclick=async()=>{if(playing){stop();return;}if(dirty||busy||!canStart())return;try{const fresh=await read();if(!fresh)return;if(!fresh.canPlay||JSON.stringify(fresh.frames)!==JSON.stringify(context.frames)||fresh.fps!==context.fps){context=fresh;draw();status('Reloaded current timing and frame review. Press Play again after reviewing it.');return;}if(playhead>=context.totalFrames-1)playhead=0;if(!await showFrame(playhead))return;origin=performance.now()-playhead/context.fps*1000;lastCheck=performance.now();playing=true;host.querySelector('[data-animatic-play]').textContent='Pause';host.querySelector('[data-animatic-play]').setAttribute('aria-pressed','true');tickId=requestAnimationFrame(tick);}catch(error){status(error.message);}};
  host.querySelector('[data-animatic-seek]').oninput=event=>{stop();playhead=Number(event.target.value);showFrame(playhead);};
  host.querySelector('[data-animatic-edit]').onclick=()=>{if(busy||!canStart())return;stop();edit={...context,counts:context.frames.map(f=>f.frameCount),selected:0};dirty=true;editor();};
 }
 function editor(){
  const el=host.querySelector('[data-animatic-editor]');
  el.innerHTML=`<form class="animatic-editor"><label>Shot<select name="shot">${context.frames.map((f,i)=>`<option value="${i}" ${i===edit.selected?'selected':''}>${i+1}. ${esc(f.label||f.shotId)}</option>`).join('')}</select></label><label>Frames at ${edit.fps} fps<input name="frameCount" type="number" min="1" max="${edit.fps*900}" step="1" value="${edit.counts[edit.selected]}" required></label><p class="small">Edit one shot at a time. These are user timing choices, not measured song or dialogue alignment.</p><label><input name="ack" type="checkbox" required> I reviewed this silent timing draft.</label><div class="actions"><button type="submit" class="primary">Save timing</button><button type="button" data-animatic-cancel>Cancel</button></div></form>`;
  const form=el.querySelector('form');form.elements.frameCount.oninput=()=>edit.counts[edit.selected]=Number(form.elements.frameCount.value);form.elements.shot.onchange=()=>{edit.selected=Number(form.elements.shot.value);editor();};
  form.querySelector('[data-animatic-cancel]').onclick=()=>{dirty=false;edit=null;el.innerHTML='';};
  form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;busy=true;form.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);try{const data=await api(endpoint,{method:'POST',body:{expectedVersion:edit.projectVersion,fps:edit.fps,frameCounts:edit.counts,acknowledgeTiming:true}});if(disposed)return;onSaved(data.project);context=data.animatic;dirty=false;edit=null;playhead=0;draw();status('Timing version saved. Previous timing and frame decisions are preserved.');}catch(error){status(error.message);form.querySelectorAll('button,input,select').forEach(e=>e.disabled=false);}finally{busy=false;}};
 }
 host.innerHTML='<h2>Timed storyboard</h2><button data-load-animatic>Open silent timing preview</button><p class="small">Uses approved frames. No generation, audio replacement or spending.</p><p data-animatic-status role="status"></p>';
 host.querySelector('[data-load-animatic]').onclick=async()=>{if(!canStart())return;try{context=await read();if(context)draw();}catch(error){status(error.message);}};
}

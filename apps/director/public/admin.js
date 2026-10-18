import {createAPIClient} from './api-client.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const request=createAPIClient();
const $=selector=>document.querySelector(selector);
let tab='jobs', access=null, models=[], pending=null, busy=false, failed=false, loading=0;
const can=permission=>access?.permissions?.includes(permission);
const status=message=>{$('#admin-status').textContent=message;};
const modelId=model=>model.id||model.endpoint||model.endpoint_id;
const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const titles={pause_generation:'Pause generation',disable_model:'Disable model',update_model_notes:'Update model notes'};
const permissionFor={pause_generation:'controls.pause',disable_model:'registry.disable',update_model_notes:'registry.notes'};
function openCommand(command,id=''){
 if(pending){showCommand(pending);status('An earlier command is awaiting a confirmed response. Retry that same request before starting another.');return;}
 if(!can(permissionFor[command]))return;
 showCommand({command,modelId:id,notes:models.find(m=>String(modelId(m))===id)?.notes||'',reason:''});
}
function showCommand(draft){
 const host=$('#admin-command');host.hidden=false;
 host.innerHTML=`<h2>${esc(titles[draft.command])}</h2>${draft.modelId?`<p>Model: <code>${esc(draft.modelId)}</code></p>`:''}<p class="muted small">This changes operational metadata only. Give an operational reason; do not enter private customer content.</p><form id="admin-command-form"><label>Reason<textarea name="reason" required minlength="5" maxlength="1000"${pending?' readonly':''}>${esc(draft.reason)}</textarea></label>${draft.command==='update_model_notes'?`<label>Purpose and use notes<textarea name="notes" maxlength="2000"${pending?' readonly':''}>${esc(draft.notes)}</textarea></label>`:''}<p class="muted small">${pending?`Request ${esc(pending.requestId)} is retained. Retry sends the same command; no automatic retry occurs.`:`Uses control revision ${esc(access.control.revision)}. This action cannot activate a model or resume generation.`}</p><div class="actions"><button type="submit" class="primary"${busy?' disabled':''}>${pending?'Retry same command':esc(titles[draft.command])}</button>${pending?(failed?'<button type="button" id="new-command">Start a different command</button>':''):'<button type="button" id="cancel-command">Cancel</button>'}</div>${pending&&failed?'<p class="muted small">If the outcome is unknown, check Audit before starting a different command. The earlier request may already have succeeded. A different command gets a new request ID only when submitted.</p>':''}<p id="command-status" role="status" aria-live="polite"></p></form>`;
 const form=$('#admin-command-form');
 if($('#new-command'))$('#new-command').onclick=async()=>{const draft={...pending};pending=null;failed=false;await refresh();showCommand(draft);};
 if($('#cancel-command'))$('#cancel-command').onclick=()=>{host.hidden=true;host.replaceChildren();};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  if(!pending){const reason=form.elements.namedItem('reason').value.trim();if(!reason){$('#command-status').textContent='Enter a reason before submitting.';return;}pending={requestId:crypto.randomUUID(),expectedRevision:access.control.revision,command:draft.command,reason,...(draft.modelId?{modelId:draft.modelId}:{}),...(draft.command==='update_model_notes'?{notes:form.elements.namedItem('notes').value}:{})};}
  busy=true;failed=false;showCommand(pending);$('#command-status').textContent='Submitting operational command…';
  try{
   // Commands deliberately bypass the API client's authentication retry: unknown outcomes require an explicit retry of the same request ID.
   const response=await fetch('/api/admin/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});
   let data;try{data=await response.json();}catch{throw new Error('The command response could not be read. Retry the same request to reconcile its outcome.');}
   if(!response.ok)throw new Error(data.error?.message||data.error||data.message||`Command failed (${response.status}).`);
   pending=null;host.hidden=true;host.replaceChildren();status('Operational command confirmed.');await refresh(true);
  }catch(error){failed=true;showCommand(pending);$('#command-status').textContent=error.message||'The command was not confirmed. Retry the same request.';}
  finally{busy=false;const button=$('#admin-command-form [type="submit"]');if(button)button.disabled=false;}
 };
 host.querySelector('textarea')?.focus();
}
function renderControls(){
 const c=access.control;
 return `<h2>Generation controls</h2><p>Role: ${esc(access.role)}</p><p>Generation ${c.generationPaused?'paused':'not paused'} · Revision ${esc(c.revision)}</p><p class="small">${esc(c.reason||'No operational reason recorded.')}</p><p class="muted small">Updated: ${esc(c.updatedAt||'Not recorded')}. Generation enabled: ${access.generationEnabled===true?'Yes':'No'}. A control status alone does not authorize production.</p>${can('controls.pause')?'<button type="button" data-command="pause_generation">Pause generation</button>':'<p class="muted small">Your role cannot change generation controls.</p>'}`;
}
async function refresh(afterCommand=false){
 const ticket=++loading;$('#refresh').disabled=true;const content=$('#admin-content');content.textContent='Loading operational data…';
 try{
  access=await request('/api/admin/control');if(ticket!==loading)return;
  $('#admin-mode').textContent=`${access.role} · operations`;
  const permissions={jobs:'jobs.read',registry:'registry.read',controls:'controls.read',audit:'audit.read'};
  document.querySelectorAll('[data-tab]').forEach(button=>{button.disabled=!can(permissions[button.dataset.tab]);});
  if(!can(permissions[tab])){content.innerHTML='<h2>Access restricted</h2><p>Your current role cannot view this section. Select an available section.</p>';return;}
  let html;
  if(tab==='controls')html=renderControls();
  else if(tab==='jobs'){
   const data=await request('/api/admin/overview');const jobs=data.jobs||[];
   html=`<h2>Production jobs</h2>${jobs.length?table(['Job','Project','Status','Route','Review'],jobs.map(j=>`<tr><td><code>${esc(j.id)}</code></td><td>${esc(j.projectId||j.project_id)}</td><td>${esc(j.status)}</td><td><code>${esc(j.endpoint||j.modelId||'Not assigned')}</code></td><td>${esc(j.reviewStatus||'Not reviewed')}</td></tr>`)):'<p class="muted">No production jobs recorded. Nothing has been submitted for generation.</p>'}`;
  }else if(tab==='registry'){
   const data=await request('/api/admin/registry');models=Array.isArray(data)?data:data.models||data.endpoints||data.registry||[];
   html=`<h2>Model &amp; tool registry</h2><p class="muted small">Purpose and use notes describe intended work. Execution and quality evidence are separate. Prices require a current configuration-specific quote.</p>${models.length?table(['Route','Purpose & use','Execution tested','Quality validated','Status','Actions'],models.map(m=>`<tr><td><code>${esc(m.endpoint||m.endpoint_id||m.id)}</code></td><td>${esc(m.purpose||m.category||m.modality||'Purpose not recorded')}<p class="small muted">${esc(m.notes||'No use notes recorded.')}</p></td><td>${m.execution_tested||m.executionTested?'Yes':'No'}</td><td>${m.quality_validated||m.qualityValidated?'Yes':'No'}</td><td>${esc(m.status||(m.active?'Active (validation required)':'Blocked pending validation'))}</td><td>${can('registry.disable')?`<button type="button" data-command="disable_model" data-model="${esc(modelId(m))}">Disable model</button>`:''}${can('registry.notes')?`<button type="button" data-command="update_model_notes" data-model="${esc(modelId(m))}">Edit use notes</button>`:''}${!can('registry.disable')&&!can('registry.notes')?'View only':''}</td></tr>`)):'<p class="muted">No registry records returned.</p>'}`;
  }else{
   const data=await request('/api/admin/audit');const commands=(data.commands||[]).slice(0,100);
   html=`<h2>Operational audit</h2><p class="muted small">Scope: operational commands. Showing up to 100 newest entries. Only control revision, pause state and model metadata changes are shown here.</p>${commands.length?table(['When','Actor / role','Command / request','Model','Reason','Change'],commands.map(c=>`<tr><td>${esc(c.createdAt||'Not recorded')}</td><td>${esc(c.actorId)}<br>${esc(c.actorRole)}</td><td>${esc(titles[c.command]||c.command)}<br><code>${esc(c.requestId)}</code></td><td>${esc(c.modelId||'—')}</td><td>${esc(c.reason)}</td><td>${auditChange(c.before,c.after)}</td></tr>`)):'<p class="muted">No operational commands recorded.</p>'}`;
  }
  if(ticket!==loading)return;content.innerHTML=html;
  content.querySelectorAll('[data-command]').forEach(button=>{button.onclick=()=>openCommand(button.dataset.command,button.dataset.model||'');});
  if(!afterCommand)status('Operational status refreshed.');
 }catch(error){if(ticket===loading){content.innerHTML=`<h2>Unable to load ${esc(tab)}</h2><p class="error-text">${esc(error.message)}</p><p class="muted small">Use Refresh status to retry. An unconfirmed command retains its request ID.</p>`;}}
 finally{if(ticket===loading)$('#refresh').disabled=false;}
}
function auditChange(before,after){
 const keys=['revision','generationPaused','reason','status','active','notes','purpose'];
 return keys.filter(key=>before?.[key]!==after?.[key]&&(before?.[key]!==undefined||after?.[key]!==undefined)).map(key=>`${esc(({generationPaused:'Generation paused',active:'Active',revision:'Revision',reason:'Reason',status:'Status',notes:'Use notes',purpose:'Purpose'})[key])}: ${esc(before?.[key]??'Not set')} → ${esc(after?.[key]??'Not set')}`).join('<br>')||'No displayed metadata change';
}
document.querySelectorAll('[data-tab]').forEach(button=>{button.onclick=()=>{tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t===button)));refresh();};});
$('#refresh').onclick=()=>refresh();
refresh();

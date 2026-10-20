// Recovery credentials stay in HttpOnly cookies; the browser only submits a new password.
export function mountAccountRecovery({api,openLogin}){
 const dialog=document.createElement('dialog');dialog.id='recovery-dialog';dialog.setAttribute('aria-labelledby','recovery-title');
 dialog.innerHTML='<form id="recovery-form"><div class="dialog-head"><h2 id="recovery-title">Reset your password</h2><button type="button" id="recovery-close" aria-label="Close password recovery">✕</button></div><p id="recovery-description" class="muted small"></p><label id="recovery-email-label">Email<input id="recovery-email" type="email" autocomplete="username" required></label><label id="recovery-password-label" hidden>New password<input id="recovery-password" type="password" autocomplete="new-password" minlength="8"></label><label id="recovery-confirm-label" hidden>Confirm password<input id="recovery-confirm" type="password" autocomplete="new-password" minlength="8"></label><p id="recovery-error" class="error-text small" role="alert"></p><p id="recovery-status" class="small" role="status"></p><button id="recovery-submit" type="submit" class="primary">Send recovery link</button><button id="recovery-signin" type="button">Back to sign in</button></form>';
 document.body.append(dialog);const find=id=>dialog.querySelector('#'+id);let mode='start',busy=false;
 function show(next='start',message=''){
  mode=next;find('recovery-form').reset();find('recovery-error').textContent='';find('recovery-status').textContent=message;
  find('recovery-title').textContent=next==='reset'?'Choose a new password':'Reset your password';
  find('recovery-description').textContent=next==='reset'?'Your draft and files will be preserved. Sign in again after changing your password.':'We will send a recovery link if this email has an account. Open the link in this browser. Your draft and files stay on this device.';
  find('recovery-email-label').hidden=next==='reset';find('recovery-email').required=next!=='reset';
  for(const id of ['password','confirm']){find('recovery-'+id+'-label').hidden=next!=='reset';find('recovery-'+id).required=next==='reset';}
  find('recovery-submit').textContent=next==='reset'?'Update password':'Send recovery link';find('recovery-submit').disabled=false;
  if(!dialog.open)dialog.showModal();find(next==='reset'?'recovery-password':'recovery-email').focus();
 }
 async function close(signin=false){if(busy)return;if(mode==='reset')try{await api('/api/auth/recovery/cancel',{method:'POST',body:{}});}catch{find('recovery-error').textContent='Could not clear recovery. Try closing again.';return;}dialog.close();if(signin)openLogin();}
 find('recovery-close').onclick=()=>close();find('recovery-signin').onclick=()=>close(true);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 find('recovery-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const reset=mode==='reset';find('recovery-error').textContent='';find('recovery-status').textContent='';if(reset&&find('recovery-password').value!==find('recovery-confirm').value){find('recovery-error').textContent='The passwords do not match.';return;}busy=true;find('recovery-submit').disabled=true;try{
  const result=await api('/api/auth/recovery/'+(reset?'complete':'start'),{method:'POST',body:reset?{password:find('recovery-password').value}:{email:find('recovery-email').value}});
  find('recovery-password').value='';find('recovery-confirm').value='';
  if(reset){location.replace('/?account_recovery=done#home');return;}
  find('recovery-status').textContent=result.message;
 }catch(error){find('recovery-error').textContent=error.message;}finally{busy=false;find('recovery-submit').disabled=false;}};
 const button=document.querySelector('#forgot-password');if(button)button.onclick=()=>{const email=document.querySelector('#login-email').value;document.querySelector('#login-dialog').close();show();find('recovery-email').value=email;};
 const url=new URL(location.href),status=url.searchParams.get('account_recovery');if(status){url.searchParams.delete('account_recovery');history.replaceState(null,'',url.pathname+url.search+url.hash);if(status==='done'){show('start','Password updated. Choose Back to sign in to continue.');find('recovery-submit').disabled=true;}else if(status==='ready'){api('/api/auth/recovery/status').then(r=>show(r.ready?'reset':'start',r.ready?'':'This recovery link expired. Request a new link.')).catch(()=>show('start','Recovery is unavailable. Your draft is preserved.'));}else show('start',status==='unavailable'?'The recovery service is unavailable. Try again later; your draft is preserved.':'This link expired or was opened in another browser. Request a new link here.');}
 return {show};
}

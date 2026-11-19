"""Existing Chromium/real app APIs, synthetic provider. No paid or physical-device proof."""
import os,json,subprocess,base64
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results'/'music-director';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/director-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline()
 if not line:raise AssertionError(server.stderr.read())
 info=json.loads(line);url='http://127.0.0.1:'+str(info['port']);api=url+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':url,'httpOnly':True,'sameSite':'Strict'}]);context.route('https://song-fixture.supabase.co/**',lambda r:r.fulfill(status=200,body=base64.b64decode(info['originalBase64']),content_type='audio/wav'));page=context.new_page();page.set_default_timeout(15000);page.on('dialog',lambda d:d.accept());errors=[];http=[];console=[];expected_failure=[False];page.on('console',lambda m:console.append(m.text) if m.type=='error' and not expected_failure[0] else None);page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+')');page.goto(url);expect(page.locator('#music-director-workspace')).to_be_visible();assert page.locator('#composer-input').count()==1
  original=context.request.get(api).json()['project'];song=context.request.get(api+'/music-video/intelligence').json()['songIntelligence']['document']
  page.locator('[data-director-mode=create_with_me]').click();expect(page.locator('[data-director-mode=create_with_me]')).to_have_attribute('aria-pressed','true');page.reload();expect(page.locator('[data-director-mode=create_with_me]')).to_have_attribute('aria-pressed','true')
  page.locator('#composer-input').fill('Make the second passage more emotional.');page.locator('#composer-form button[type=submit]').click();form=page.locator('#planning-consent-form');expect(form).to_be_visible();assert len(context.request.get(api+'/planning/director_turn').json()['calls'])==0
  form.locator('[name=max]').fill('0.1');form.locator('[name=finish]').fill('0');form.locator('[name=calls]').fill('2');form.locator('button[type=submit]').click();page.locator('[data-planning-call][data-operation=director_turn]').last.click()
  expect(page.locator('#planning-dialog')).not_to_be_visible();expect(page.locator('#music-director-workspace')).to_contain_text('Preserve the approved cast');page.reload();expect(page.locator('#music-director-workspace')).to_contain_text('Preserve the approved cast')
  assert len(context.request.get(api+'/director-session').json()['session']['messages'])==2
  page.screenshot(path=str(out/'desktop-director.png'))
  # Commit the action but lose its HTTP response, then recover the exact request after reload.
  def lose_committed_response(route):
   response=route.fetch();assert response.status==200,(route.request.url,response.status,response.text());route.abort()
  expected_failure[0]=True;context.route('**/director-session/actions',lose_committed_response);page.locator('[data-director-action]').last.click();expect(page.locator('#toast')).to_be_visible();context.unroute('**/director-session/actions');page.reload();expected_failure[0]=False;page.locator('[data-director-action]').last.click();expect(page.locator('#planning-operation')).to_have_value('revise_script');page.locator('#close-planning').click()
  changed=context.request.get(api).json()['project'];assert changed['screenplay']['versions']==original['screenplay']['versions'];assert changed['shots']==original['shots'];assert len(changed['screenplay']['revisionRequest']['sceneIds'])==1
  page.locator('[data-director-mode=plan_for_me]').click();expect(page.locator('[data-director-mode=plan_for_me]')).to_have_attribute('aria-pressed','true');assert len(context.request.get(api+'/director-session').json()['session']['messages'])==2
  # Deliberate transport failure: keep the user's exact draft and avoid any planning call.
  expected_failure[0]=True;context.route('**/director-session',lambda r:r.abort());page.locator('#composer-input').fill('Retain this unsent correction.');page.locator('#composer-form button[type=submit]').click();expect(page.locator('#toast')).to_be_visible();expect(page.locator('#composer-input')).to_have_value('Retain this unsent correction.');context.unroute('**/director-session')
  expected_failure[0]=False;page.set_viewport_size({'width':390,'height':844});page.reload();page.locator('#mobile-create-tab').click();expect(page.locator('#music-director-workspace')).to_be_visible();assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth');expect(page.locator('#composer-input')).to_have_value('Retain this unsent correction.');page.screenshot(path=str(out/'mobile-director.png'))
  # The prior unsent draft now commits, but the response is lost. Reload/retry must not duplicate it.
  expected_failure[0]=True;context.route('**/director-session',lose_committed_response);page.locator('#composer-form button[type=submit]').click();expect(page.locator('#toast')).to_be_visible();context.unroute('**/director-session');page.reload();page.locator('#mobile-create-tab').click();expected_failure[0]=False;expect(page.locator('#composer-input')).to_have_value('Retain this unsent correction.');assert len(context.request.get(api+'/director-session').json()['session']['messages'])==3;page.locator('#composer-form button[type=submit]').click();expect(page.locator('#planning-dialog')).to_be_visible();page.locator('#close-planning').click();assert len(context.request.get(api+'/director-session').json()['session']['messages'])==3
  page.locator('[data-director-mode=create_with_me]').focus();page.keyboard.press('Enter');expect(page.locator('[data-director-mode=create_with_me]')).to_have_attribute('aria-pressed','true');assert context.request.get(api+'/music-video/intelligence').json()['songIntelligence']['document']==song;assert context.request.get(api+'/jobs').json()['jobs']==[];assert not errors,errors;assert not http,http;assert not console,console
  (out/'results.json').write_text(json.dumps({'passed':True,'provider':'simulated','paidCalls':0,'modeAndTranscriptReload':True,'scopedRevisionOnly':True,'sourceAndMediaPreserved':True,'keyboard':True,'draftRecovery':True,'committedResponseLossReplay':True,'desktopAndMobileViewport':True,'physicalDevice':False,'pageErrors':errors,'httpErrors':http,'unexpectedConsoleErrors':console},indent=2)+'\n');browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
print('Music Director saved discussion, scoped handoff and frozen desktop/mobile viewport flow passed; provider simulated.')

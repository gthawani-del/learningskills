"""Actual local HTTP/cookies/UI; simulated email/Auth only. No external accounts or mail."""
import os,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results/account-recovery';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node',str(Path(__file__).with_name('account-recovery-fixture-server.mjs'))],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port'])
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);checks=[];errors=[]
  for width,height in [(1440,1000),(390,844)]:
   c=browser.new_context(viewport={'width':width,'height':height});page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(12000)
   page.goto(base);page.locator('#premise').fill('Preserve my music-video idea during recovery.');page.locator('#auth-button').click();page.locator('#login-email').fill('creator@example.test');page.locator('#forgot-password').click();expect(page.locator('#recovery-dialog')).to_be_visible();expect(page.locator('#recovery-email')).to_have_value('creator@example.test');page.locator('#recovery-submit').click();expect(page.locator('#recovery-status')).to_contain_text('If that address')
   link=page.request.get(base+'/__recovery-fixture').json()['link'];assert link.startswith(base+'/api/auth/recovery/callback?')
   other=browser.new_context(viewport={'width':width,'height':height});wrong=other.new_page();wrong.goto(link);expect(wrong.locator('#recovery-status')).to_contain_text('expired');assert not any(x['name']=='director_recovery' and x['value'] for x in other.cookies());other.close()
   page.goto(link);expect(page.locator('#recovery-password')).to_be_visible();assert 'code=' not in page.url and 'account_recovery=' not in page.url
   assert all(x not in page.evaluate('JSON.stringify(localStorage)') for x in ['fixture-recovery-access','fixture-recovery-code'])
   page.locator('#recovery-password').fill('new-fixture-password');page.locator('#recovery-confirm').fill('different-password');page.locator('#recovery-submit').click();expect(page.locator('#recovery-error')).to_contain_text('do not match')
   page.locator('#recovery-confirm').fill('new-fixture-password');page.locator('#recovery-submit').click();expect(page.locator('#recovery-status')).to_contain_text('Password updated');assert page.request.get(base+'/__recovery-fixture').json()['passwordChanged'];assert not any(x['name'] in ['director_recovery','director_session','director_refresh'] and x['value'] for x in c.cookies());page.locator('#recovery-signin').click();expect(page.locator('#login-dialog')).to_be_visible();page.locator('#login-dialog [data-close]').click();expect(page.locator('#premise')).to_have_value('Preserve my music-video idea during recovery.')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/f'recovery-{width}.png'),full_page=True);checks.append({'width':width,'sameBrowserRecovery':True,'otherBrowserRejected':True,'draftPreserved':True,'passwordConfirmation':True,'noLocalStorageCredentials':True});c.close()
  assert not errors,errors
  result={'scope':'Actual local app/API/cookies; simulated identity and email, no live account proof','checks':checks,'pageErrors':errors,'paidCalls':0,'physicalMobileTested':False};(out/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

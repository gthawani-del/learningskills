"""First use through real local API/auth cookies/imports; simulated identity provider only."""
import os,json,base64,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results';out.mkdir(exist_ok=True)
server=subprocess.Popen(['node',str(Path(__file__).with_name('ftue-fixture-server.mjs'))],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port'])
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  checks=[];errors=[]
  for width,height in [(1440,1000),(390,844)]:
   c=b.new_context(viewport={'width':width,'height':height});page=c.new_page();page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base);expect(page.get_by_role('heading',name='What do you want to create?')).to_be_visible()
   page.locator('#start-form button[type=submit]').click();expect(page.locator('#welcome-error')).to_contain_text('Describe your idea')
   page.locator('#premise').fill('Create a product advertisement from my reference.')
   with page.expect_file_chooser() as chooser:page.get_by_role('button',name='Upload files',exact=True).click()
   chooser.value.set_files({'name':'product.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')})
   page.get_by_role('button',name='Advertisement',exact=True).click();expect(page.locator('#welcome-attachments')).to_contain_text('product.png')
   page.screenshot(path=str(out/f'ftue-entry-{width}.png'),full_page=True)
   page.locator('#start-form button[type=submit]').click();expect(page.locator('#login-dialog')).to_be_visible();expect(page.locator('#login-title')).to_have_text('Create your studio account')
   # Creation/uploads remain private browser drafts until authentication.
   assert page.request.get(base+'/api/projects').status==401
   page.locator('#login-email').fill('creator@example.test');page.locator('#login-password').fill('fixture-password');page.locator('#login-submit').click()
   expect(page.locator('#login-status')).to_contain_text('Check your email');assert not any(x['name']=='director_session' for x in c.cookies())
   if width==390:
    page.reload();page.locator('#auth-button').click();expect(page.locator('#login-dialog')).to_be_visible();page.locator('#login-email').fill('creator@example.test')
   page.locator('#login-password').fill('wrong-password');page.locator('#login-submit').click();expect(page.locator('#login-error')).to_contain_text('Check your email')
   page.locator('#login-password').fill('fixture-password');page.locator('#login-submit').click();expect(page.locator('#login-dialog')).not_to_be_visible();expect(page.locator('#mode')).to_have_text('Workspace')
   expect(page.locator('#rail')).to_contain_text('product.png');page.reload();expect(page.locator('#mode')).to_have_text('Workspace');expect(page.locator('#rail')).to_contain_text('product.png')
   projects=page.request.get(base+'/api/projects').json()['projects'];cloud=[x for x in projects if x.get('importState',{}).get('sourceId')]
   assert cloud and cloud[-1]['importState']['status']=='ready'
   assets=page.request.get(base+'/api/projects/'+cloud[-1]['id']+'/assets').json()['assets'];assert len(assets)==1 and assets[0]['name']=='product.png'
   page.locator('#brief-project-settings').click();expect(page.locator('#close-director')).to_be_visible();page.locator('#close-director').click();expect(page.locator('#brief-project-settings')).to_be_focused()
   if width<1000:page.locator('#mobile-project').click()
   page.locator('[data-stage=production]').click()
   if width<1000:page.locator('#mobile-project').click()
   expect(page.locator('[data-stage=edit]')).to_be_visible();page.locator('[data-stage=edit]').click()
   if width<1000:page.locator('#mobile-project').click()
   page.locator('[data-stage=export]').click()
   page.screenshot(path=str(out/f'ftue-workspace-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   checks.append({'width':width,'authGate':True,'confirmationRequired':True,'failedLoginRecovery':True,'cloudImport':True,'reload':True,'settingsClose':True,'productionNavigation':True});c.close()
  assert not errors,errors
  result={'scope':'Real local app/API/cookies/storage/imports with simulated Supabase identity responses; not real email delivery or live account verification','checks':checks,'pageErrors':errors,'paidCalls':0,'physicalMobileTested':False};(out/'ftue-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

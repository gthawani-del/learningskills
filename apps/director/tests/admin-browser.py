"""Real local backoffice UI/API checks with synthetic model metadata; no provider calls."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3451')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(12000);errors=[];console=[];http=[];fault={'used':False,'bodies':[]}
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append({'text':m.text,'url':m.location.get('url','')}) if m.type in ['error','warning'] else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
 page.goto(base+'/admin');expect(page.locator('#admin-mode')).to_contain_text('owner');page.locator('[data-tab=controls]').click();expect(page.locator('#admin-content')).to_contain_text('Generation paused')
 baseline=page.evaluate("async()=> (await(await fetch('/api/admin/audit')).json()).commands.length")
 def interrupt(route):
  fault['bodies'].append(route.request.post_data_json)
  if not fault['used']:fault['used']=True;route.fetch();route.abort('failed')
  else:route.continue_()
 page.route('**/api/admin/commands',interrupt)
 page.locator('[data-command=pause_generation]').click();page.locator('#admin-command-form [name=reason]').fill('Browser QA: inspect a provider incident.');page.locator('#admin-command-form [type=submit]').click();expect(page.locator('#command-status')).to_contain_text('fetch')
 assert page.evaluate("async()=> (await(await fetch('/api/admin/audit')).json()).commands.length")==baseline+1
 expect(page.get_by_role('button',name='Retry same command')).to_be_enabled();page.get_by_role('button',name='Retry same command').click();expect(page.locator('#admin-command')).to_be_hidden();assert fault['bodies'][0]==fault['bodies'][1]
 assert page.evaluate("async()=> (await(await fetch('/api/admin/audit')).json()).commands.length")==baseline+1
 page.unroute('**/api/admin/commands',interrupt)
 page.locator('[data-tab=registry]').click();page.locator('[data-command=update_model_notes]').click();form=page.locator('#admin-command-form');form.locator('[name=reason]').fill('Record the synthetic model use.');note='<img src=x onerror=alert(1)> Approved reference workflow.';form.locator('[name=notes]').fill(note);form.locator('[type=submit]').click();expect(page.locator('#admin-command')).to_be_hidden();expect(page.locator('#admin-content')).to_contain_text(note);assert page.locator('#admin-content img').count()==0
 page.locator('[data-command=disable_model]').click();page.locator('#admin-command-form [name=reason]').fill('Disable this synthetic test route.');page.locator('#admin-command-form [type=submit]').click();expect(page.locator('#admin-command')).to_be_hidden();expect(page.locator('#admin-content')).to_contain_text('Blocked pending validation')
 page.locator('[data-tab=audit]').click();expect(page.locator('#admin-content')).to_contain_text('Record the synthetic model use.');expect(page.locator('#admin-content')).to_contain_text('Use notes');page.screenshot(path='test-results/admin-audit-desktop.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.locator('[data-tab=controls]').click();expect(page.locator('#admin-content')).to_contain_text('Generation paused');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'admin horizontal overflow';page.screenshot(path='test-results/admin-controls-mobile-viewport.png',full_page=True)
 assert not errors,errors;unexpected=[m for m in console if not ('net::ERR_FAILED' in m['text'] and '/api/admin/commands' in m['url'])];assert not unexpected,unexpected;assert len(console)<=1,console;assert not http,http
 Path('test-results/admin-browser.json').write_text(json.dumps({'base':base,'lostResponseSameRequestReplay':True,'notesEscaped':True,'disableModel':True,'auditVisible':True,'viewport390':True,'physicalMobileTested':False,'liveSupabaseAppTested':False,'pageErrors':errors,'expectedConsole':console,'httpErrors':http},indent=2));print('PASS: backoffice command recovery, registry notes/disable, audit and 390px layout; synthetic local API only.');b.close()

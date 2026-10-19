"""Actual local device-draft browser checks. No paid or cloud requests.
390px is Chromium viewport emulation, not physical mobile-device verification.
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(12000)
 errors=[];http=[];console_errors=[];mutations=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda message:console_errors.append(message.text) if message.type=='error' else None)
 page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
 page.on('request',lambda r:mutations.append({'method':r.method,'url':r.url}) if r.method=='POST' else None)
 page.goto(os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3432'))
 premise='A station keeper finds a letter from tomorrow.'
 page.locator('#premise').fill(premise);page.locator('#start-form button[type=submit]').click()
 card=page.locator('#compact-brief');expect(card).to_be_visible();expect(card.locator('.compact-premise')).to_have_text(premise)
 expect(card.locator('.compact-purpose')).not_to_be_empty();expect(card.locator('.brief-chips')).to_contain_text('60 seconds');expect(card.locator('.brief-chips')).to_contain_text('English')
 assert not page.locator('#director').evaluate('(e)=>e.classList.contains("open")'),'project settings should start in a closed drawer'
 assert not page.locator('.brief-details').evaluate('(e)=>e.open'),'original project settings should start collapsed'
 assert page.locator('textarea:visible').count()<=1,'compact first use must show only the composer, not sixteen fields'
 expect(page.locator('#creative-brief-dialog')).not_to_be_visible()
 page.screenshot(path=str(out/'creative-brief-compact-desktop.png'),full_page=True)
 # A disclosure reveals readable choices, not a second editor or an empty-field wall.
 page.locator('.brief-context-details>summary').click();assert card.locator('.compact-choice').count()>=4
 assert page.locator('textarea:visible').count()<=1
 page.locator('.brief-context-details>summary').click()
 edit=card.locator('[data-edit-brief-field=purpose]').first
 original=card.locator('.compact-purpose').inner_text();edit.click();field=page.locator('#compact-field-editor [name=value]')
 expect(field).to_have_value(original);expect(field).to_be_focused();expect(page.locator('#approve-direction')).to_be_disabled();expect(card.locator('[data-edit-brief-field=tone]').first).to_be_disabled();assert page.locator('#compact-field-editor textarea:visible').count()==1
 field.fill('An unsaved idea');page.locator('[data-stage=story]').click();expect(page.locator('#screenplay-workspace')).to_be_visible();page.locator('[data-stage=brief]').click();expect(page.locator('#compact-field-editor [name=value]')).to_have_value('An unsaved idea');expect(page.locator('#approve-direction')).to_be_disabled();page.locator('#new-button').click();page.locator('#premise').fill('A baker closes the shop.');page.locator('#start-form button[type=submit]').click();expect(page.locator('#compact-brief')).to_be_visible();expect(page.locator('#compact-field-editor')).to_have_count(0);page.locator('#projects-button').click();page.locator('.resume-row').filter(has_text='A station keeper finds').locator('[data-project]').click();expect(page.locator('#compact-field-editor [name=value]')).to_have_value('An unsaved idea');page.locator('#cancel-brief-field').click();expect(page.locator('#compact-field-editor')).to_have_count(0);expect(card.locator('.compact-purpose')).to_have_text(original)
 expect(card.locator('[data-edit-brief-field=purpose]').first).to_be_focused()
 # Controlled local storage failure: this is a fixture, not a real infrastructure outage.
 card.locator('[data-edit-brief-field=purpose]').first.click();field=page.locator('#compact-field-editor [name=value]');field.fill('A restrained story about choosing whether to trust tomorrow.')
 page.evaluate('''()=>{const original=IDBDatabase.prototype.transaction;window.__qaRestoreTransaction=()=>{IDBDatabase.prototype.transaction=original;};let fail=true;IDBDatabase.prototype.transaction=function(...args){if(fail&&args[1]==='readwrite'){fail=false;throw new DOMException('Controlled QA save failure','QuotaExceededError');}return original.apply(this,args);};}''')
 page.locator('#compact-field-editor button[type=submit]').click();expect(page.locator('#compact-brief-status')).not_to_be_empty();expect(field).to_have_value('A restrained story about choosing whether to trust tomorrow.')
 page.evaluate('window.__qaRestoreTransaction()')
 page.evaluate('''()=>{const original=IDBDatabase.prototype.transaction;let slow=true;IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(!slow||args[1]!=='readwrite')return tx;slow=false;IDBDatabase.prototype.transaction=original;return new Proxy(tx,{get(t,k){const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;},set(t,k,v){return Reflect.set(t,k,k==='oncomplete'?(event)=>setTimeout(()=>v.call(t,event),700):v,t);}});};}''')
 page.locator('#compact-field-editor button[type=submit]').click();expect(field).to_be_disabled();expect(page.locator('#compact-field-editor button[type=submit]')).to_be_disabled();expect(page.locator('#projects-button')).to_be_disabled();expect(page.locator('#compact-field-editor')).to_have_count(0);expect(card.locator('.compact-purpose')).to_have_text('A restrained story about choosing whether to trust tomorrow.')
 expect(card.locator('.brief-chips')).to_contain_text('60 seconds');expect(card.locator('.brief-chips')).to_contain_text('English')
 page.locator('#approve-direction').click();expect(page.locator('#continue-direction')).to_be_visible()
 saved=page.evaluate('''async()=>{const {getDevice}=await import('/device-drafts.js');return await getDevice(localStorage.getItem('director:lastProject'));}''')
 assert saved['creativeBrief'];assert any(a['artifactId']=='brief' and a['acknowledgeAssumptions'] for a in saved['approvals'])
 page.screenshot(path=str(out/'creative-brief-approved-desktop.png'),full_page=True)
 # Editing the original source requires a fresh review, while deliberate direction survives.
 page.locator('#brief-project-settings').click();page.locator('.brief-details>summary').click();page.locator('#brief-form [name=premise]').fill('A station keeper burns tomorrow’s letter.');page.locator('#brief-form button[type=submit]').click()
 expect(page.locator('#approve-direction')).to_be_visible();expect(page.locator('#continue-direction')).to_have_count(0)
 page.locator('#approve-direction').click();expect(page.locator('#continue-direction')).to_be_visible();page.locator('#continue-direction').click();expect(page.locator('#screenplay-workspace')).to_be_visible()
 page.reload();expect(page.locator('#screenplay-workspace')).to_be_visible();page.set_viewport_size({'width':390,'height':844})
 page.locator('#mobile-project').click();page.locator('[data-stage=brief]').click();expect(card).to_be_visible()
 assert page.locator('textarea:visible').count()<=1;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 card.locator('[data-edit-brief-field=purpose]').first.click();expect(page.locator('#compact-field-editor [name=value]')).to_be_focused();expect(page.locator('#compact-field-editor [name=value]')).not_to_have_value('');page.locator('#cancel-brief-field').click()
 page.screenshot(path=str(out/'creative-brief-mobile-viewport.png'),full_page=True)
 assert not errors,errors;assert not http,http;assert not console_errors,console_errors;assert not mutations,mutations
 result={'scope':'actual local device draft UI, not live Supabase or paid model output','passed':['compact inline proposal','prefilled purpose premise runtime language','original settings collapsed','one default composer textarea','choices disclosure without empty-field wall','one prefilled field editor','cancel restores content and focus','unsaved edit survives stage navigation and stays scoped when switching projects','approval and field switching blocked during edits','pending write controls disabled','targeted correction preserves unrelated settings','controlled IndexedDB failure preserves input','explicit approve and continue','source edit requires renewed approval','device persistence','390px viewport review'],'fixtureChecks':['Controlled one-time IndexedDB write failure; not an observed infrastructure outage','Controlled IndexedDB completion delay for pending-control checks'],'pageErrors':errors,'consoleErrors':console_errors,'httpErrors':http,'postRequests':mutations,'physicalMobileTested':False}
 (out/'creative-brief-browser-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()

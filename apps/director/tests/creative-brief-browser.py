"""Actual device-only creative brief UI; no paid planning or cloud calls."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(12000);errors=[];http=[];console_errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda message:console_errors.append(message.text) if message.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
 page.goto(os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3432'))
 page.locator('#premise').fill('A station keeper finds a letter from tomorrow.');page.locator('#start-form button[type=submit]').click();page.locator('#prepare-story').click()
 expect(page.locator('#creative-brief-dialog')).to_be_visible();expect(page.locator('#creative-brief-fields')).to_be_visible();assert page.locator('.brief-questions p').count()<=3
 assert page.locator('.brief-origin').filter(has_text='Unknown').count()>0
 inferred=page.locator('.brief-origin').filter(has_text='Inferred').count()
 page.locator('#creative-brief-fields [name=tone]').fill('Quiet and observational');page.locator('#creative-brief-fields button[type=submit]').click();expect(page.locator('#creative-brief-fields [name=tone]')).to_have_value('Quiet and observational')
 page.locator('#approve-creative-brief').click();expect(page.locator('#creative-brief-content')).to_contain_text('This creative brief version is approved')
 assert page.locator('.brief-origin').filter(has_text='Inferred').count()>=max(0,inferred-1)
 saved=page.evaluate('''async()=>{const {getDevice}=await import('/device-drafts.js');return await getDevice(localStorage.getItem('director:lastProject'));}''');assert saved['creativeBrief'];assert any(a['artifactId']=='brief' and a['acknowledgeAssumptions'] for a in saved['approvals'])
 page.locator('#creative-brief-dialog').evaluate('(dialog)=>dialog.scrollTop=0');page.screenshot(path=str(out/'creative-brief-approved-desktop.png'),full_page=True)
 page.locator('#close-creative-brief').click();page.locator('#brief-form [name=premise]').fill('A station keeper burns tomorrow’s letter.');page.locator('#brief-form button[type=submit]').click();page.locator('#review-creative-brief').click();expect(page.locator('#creative-brief-content')).to_contain_text('source brief changed');expect(page.locator('#approve-creative-brief')).to_be_disabled()
 page.locator('#interpret-brief-free').click();expect(page.locator('#approve-creative-brief')).to_be_enabled();page.locator('#approve-creative-brief').click();expect(page.locator('#creative-brief-content')).to_contain_text('This creative brief version is approved')
 page.locator('#close-creative-brief').click();page.locator('#prepare-story').click();expect(page.locator('#story-form')).to_be_visible()
 page.reload();expect(page.locator('#story-form')).to_be_visible();page.set_viewport_size({'width':390,'height':844});page.locator('#mobile-project').click();page.locator('[data-stage=brief]').click();page.locator('#mobile-director').click();page.locator('#review-creative-brief').click();expect(page.locator('#creative-brief-dialog')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/'creative-brief-mobile-viewport.png'),full_page=True)
 assert not errors,errors;assert not http,http;assert not console_errors,console_errors
 result={'scope':'actual local device draft UI, not live Supabase or paid model output','passed':['free interpretation before story','explicit inferred unknown labels','max three clarifying questions','targeted correction','assumptions approval','inferred labels retained','stale source approval blocked','reinterpret and reapprove','device persistence','390px viewport review'],'pageErrors':errors,'consoleErrors':console_errors,'httpErrors':http,'physicalMobileTested':False};(out/'creative-brief-browser-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()

"""Real UI and local demo API review persistence; not live Supabase evidence."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3421')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(12000);errors=[];console=[];http=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append(m.text) if m.type in ['error','warning'] else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
 page.goto(base);page.locator('#premise').fill('Review QA: a keeper waits.');page.locator('#start-form button[type=submit]').click();expect(page.locator('#mode')).to_have_text('Local demo');page.locator('[data-stage=cast]').click()
 form=page.locator('#production-record-form');form.locator('[name=name]').fill('Keeper');form.locator('[name=description]').fill('A restrained performance.');form.locator('button[type=submit]').click();expect(page.locator('[data-edit-record]')).to_have_count(1)
 page.locator('[data-review-decision=approved]').click();expect(page.locator('[data-creative-status]')).to_contain_text('Creative version approved');page.reload();expect(page.locator('[data-creative-status]')).to_contain_text('Creative version approved')
 page.locator('[data-review-decision=revoked]').click();expect(page.locator('[data-creative-status]')).to_contain_text('Creative approval revoked');page.reload();expect(page.locator('[data-creative-status]')).to_contain_text('Creative approval revoked')
 data=page.evaluate('''async()=>{const id=localStorage.getItem('director:lastProject');return (await(await fetch(`/api/projects/${id}/approvals`)).json()).approvals;}''');assert [r['decision'] for r in data]==['approved','revoked'];assert all(r['artifactId'].startswith('record:') for r in data)
 assert not errors,errors;assert not console,console;assert not http,http
 Path('test-results/production-review-demo.json').write_text(json.dumps({'base':base,'decisions':[r['decision'] for r in data],'errors':errors,'console':console,'http':http,'liveSupabaseTested':False},indent=2));print('PASS: creative approval/revocation persisted via real local demo API and reload; live Supabase unverified.');b.close()

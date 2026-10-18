import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3432')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(12000);errors=[];console=[];http=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append(m.text) if m.type in ['error','warning'] else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
 page.goto(base);page.locator('#premise').fill('Library QA: a station keeper waits.');page.locator('#start-form button[type=submit]').click();page.locator('[data-stage=cast]').click()
 form=page.locator('#production-record-form');form.locator('[name=name]').fill('Mara');form.locator('[name=description]').fill('A station keeper with a red coat.');form.locator('button[type=submit]').click();expect(page.locator('[data-edit-record]')).to_have_count(1)
 page.locator('[data-stage=storyboard]').click();page.locator('#add-shot').click();page.locator('#shot-form [name=productionBindings]').select_option(label='Mara · Character · v1');page.locator('#shot-form button[type=submit]').click()
 page.locator('[data-stage=cast]').click();page.locator('[data-edit-record]').click();form=page.locator('#production-record-form');form.locator('[name=description]').fill('The same keeper with a blue coat.');form.locator('button[type=submit]').click();expect(page.locator('#main')).to_contain_text('Version 2')
 page.reload();expect(page.locator('#main')).to_contain_text('Version 2');page.screenshot(path='test-results/library-desktop.png',full_page=True)
 result=page.evaluate('''async()=>{const {getDevice}=await import('/device-drafts.js');return await getDevice(localStorage.getItem('director:lastProject'));}''');record=result['production']['records'][0];assert len(record['versions'])==2;assert record['versions'][0]['content']['description']=='A station keeper with a red coat.';assert result['shots'][0]['productionBindings']==[{'recordId':record['id'],'version':1}]
 page.locator('[data-stage=storyboard]').click();expect(page.locator('#shot-form [name=productionBindings]')).to_have_values([record['id']+'@1']);page.locator('#shot-form [name=productionBindings]').select_option(record['id']+'@2');page.locator('#shot-form button[type=submit]').click();expect(page.locator('#toast')).to_contain_text('New shot version saved');page.reload();expect(page.locator('#shot-form [name=productionBindings]')).to_have_values([record['id']+'@2'])
 assert not errors,errors;assert not console,console;assert not http,http
 Path('test-results/library-smoke.json').write_text(json.dumps({'base':base,'historyVersions':2,'bindingRevised':True,'pageErrors':errors,'console':console,'http':http},indent=2));print('PASS: real library create/edit/history persistence and historical/current shot bindings; clean console and HTTP.');b.close()

"""Real local demo API/browser migration, including lost upload response. Not live Supabase evidence."""
from pathlib import Path
import json,base64,os
from playwright.sync_api import sync_playwright,expect
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3401'))
 baseline=page.evaluate('async()=> (await (await fetch("/api/projects")).json()).projects.length')
 source=page.evaluate('''async()=>{const {createDevice,patchDevice}=await import('/device-drafts.js');let p=await createDevice({premise:'A keeper finds tomorrow’s letter.',format:'short_film'});p=await patchDevice(p,{stage:'production',story:{treatment:'A letter changes the keeper’s choice.',scenes:[{id:'s1',description:'A station at dawn.'}]},shots:[{id:'shot-a',title:'The keeper',description:'The keeper reads the letter.',sceneId:'s1',duration:5}],notes:[{role:'You',text:'Use restrained dawn light.'}],approvals:[{artifactId:'story',version:2,decision:'approved'}]});localStorage.setItem('director:lastProject',p.id);return p.id;}''')
 page.reload();expect(page.locator('#mode')).to_have_text('On this device')
 page.locator('#viewer-add').click();page.locator('#upload-file').set_input_files({'name':'keeper.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')});page.locator('#upload-form button[type=submit]').click()
 expect(page.locator('#studio-still')).to_be_visible()
 page.locator('.stage-switch summary').click();page.locator('[data-stage=cast]').click();page.locator('[data-use-media]').click();page.locator('[data-stage=production]').click()
 fault={'used':False}
 def interrupt(route):
  if not fault['used']:
   fault['used']=True;route.fetch();route.abort('failed')
  else:route.continue_()
 page.route('**/import-assets/**',interrupt)
 page.locator('#cloud-save').click();expect(page.locator('#toast')).to_contain_text('device copy is safe')
 assert page.evaluate('async()=> (await (await fetch("/api/projects")).json()).projects.length')==baseline+1
 page.locator('#cloud-save').click();expect(page.locator('#cloud-save')).to_be_hidden();expect(page.locator('#mode')).to_have_text('Local demo')
 expect(page.locator('#studio-still')).to_be_visible();expect(page.locator('#messages')).to_contain_text('Use restrained dawn light.')
 result=page.evaluate('''async(source)=>{const projects=(await (await fetch('/api/projects')).json()).projects.filter(p=>p.importState?.sourceId===source);const project=projects[0];const assets=(await (await fetch(`/api/projects/${project.id}/assets`)).json()).assets;const approvals=(await (await fetch(`/api/projects/${project.id}/approvals`)).json()).approvals;const {getDevice,deviceAssets}=await import('/device-drafts.js');return {projects,assets,approvals,device:await getDevice(source),deviceFiles:(await deviceAssets(source)).length};}''',source)
 cloud=result['projects'][0];assert cloud['importState']['status']=='ready';assert len(result['assets'])==1;assert cloud['shots'][0]['referenceAssetId']==result['assets'][0]['id'];assert not result['approvals'];assert result['device']['id']==source;assert result['deviceFiles']==1
 page.reload();expect(page.locator('#studio-still')).to_be_visible();expect(page.locator('#messages')).to_contain_text('Use restrained dawn light.')
 page.screenshot(path=str(out/'migration-local-demo-success.png'),full_page=True)
 assert not errors,errors
 (out/'migration-browser-results.json').write_text(json.dumps({'scope':'actual local demo API and browser; not live Supabase','passed':['device source preserved','lost upload response recovery','one project and one asset','reference ID rebinding','notes after reload','device approvals not imported'],'pageErrors':errors,'injectedNetworkFailure':True,'physicalMobileTested':False},indent=2))
 print('PASS: browser migration and interrupted-upload recovery against local demo API. Live Supabase unverified.')
 b.close()

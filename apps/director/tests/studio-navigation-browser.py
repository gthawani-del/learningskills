"""Studio navigation and media library through Chromium; device drafts, no paid calls."""
import os,json,base64,io,wave,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

base=os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:33495')
out=Path('test-results/studio-navigation');out.mkdir(parents=True,exist_ok=True)
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
sound=io.BytesIO()
with wave.open(sound,'wb') as f:
 f.setnchannels(1);f.setsampwidth(2);f.setframerate(8000);f.writeframes(b'\0\0'*8000)
clip=out/'library-reference.mp4'
subprocess.run(['ffmpeg','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24','-t','1','-c:v','libx264','-pix_fmt','yuv420p',str(clip)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
formats=['short_film','advertisement','documentary','docuseries','micro_series','music_video','talking_avatar','image','video','audio']

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 errors=[];console=[];failed=[];checks=[]
 for width,height in [(1440,1000),(390,844)]:
  context=browser.new_context(viewport={'width':width,'height':height});page=context.new_page();page.set_default_timeout(12000)
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('console',lambda msg:console.append(msg.text) if msg.type=='error' else None)
  page.on('response',lambda response:failed.append({'status':response.status,'url':response.url}) if response.status>=400 else None)
  def menu():
   if width<1000:page.locator('#studio-menu-button').click()
  def route(target):
   menu();nav=page.locator('nav[aria-label=Studio]')
   if target.startswith('create/') and not nav.locator('.studio-create-menu').get_attribute('open'):
    # Boolean open="" is false-like as a string; clicking only when actually closed.
    if not nav.locator('.studio-create-menu').evaluate('(e)=>e.open'):nav.locator('summary').click()
   nav.locator('[data-studio-route="'+target+'"]').click()
  page.goto(base+'#home');expect(page.locator('#premise')).to_be_visible()
  page.locator('#premise').fill('Keep my starting idea while I explore the studio.')
  route('assets/images');expect(page.get_by_role('heading',name='Assets',exact=True)).to_be_visible();expect(page.locator('#studio-asset-results')).to_contain_text('No images yet')
  route('home');expect(page.locator('#premise')).to_have_value('Keep my starting idea while I explore the studio.')
  for format in formats:
   route('create/'+format)
   expect(page.locator('[data-format="'+format+'"][aria-pressed=true]')).to_be_visible()
   page.locator('#premise').fill('A '+format+' creation for navigation QA.')
   page.locator('#start-device').click();expect(page.locator('.workspace')).to_be_visible()
   actual=page.evaluate('''async()=>{const id=localStorage.getItem('director:lastProject');return await new Promise((resolve,reject)=>{const r=indexedDB.open('director-device-drafts',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('projects').objectStore('projects').get(id);q.onsuccess=()=>{resolve(q.result.format);db.close()};q.onerror=reject;};r.onerror=reject;});}''')
   assert actual==format,(format,actual)
  # Start one project with real image, MP4 and WAV attachments.
  route('create/advertisement');page.locator('#premise').fill('Library production '+str(width))
  page.locator('#welcome-file').set_input_files([
   {'name':'product.png','mimeType':'image/png','buffer':png},
   {'name':'voice.wav','mimeType':'audio/wav','buffer':sound.getvalue()},{'name':'library-reference.mp4','mimeType':'video/mp4','buffer':clip.read_bytes()}])
  page.locator('#start-device').click();expect(page.locator('.workspace')).to_be_visible()
  project=page.evaluate('localStorage.getItem("director:lastProject")')
  route('assets/images');expect(page.locator('.studio-asset-card')).to_have_count(1);expect(page.locator('#studio-asset-results')).to_contain_text('product.png')
  page.locator('#studio-asset-search').fill('absent file');expect(page.locator('#studio-asset-results')).to_contain_text('No matching assets');page.locator('#studio-clear-filters').click();expect(page.locator('.studio-asset-card')).to_have_count(1)
  page.locator('#asset-tab-videos').click();expect(page.locator('.studio-asset-card video')).to_have_count(1)
  page.locator('.studio-asset-card video').evaluate('(video)=>video.play()');page.wait_for_function('()=>document.querySelector(".studio-asset-card video").currentTime>0.1')
  page.locator('#asset-tab-audio').click();expect(page.locator('.studio-asset-card audio')).to_have_count(1);expect(page.locator('#studio-asset-results')).to_contain_text('voice reference')
  page.locator('#asset-tab-characters').click();expect(page.locator('#studio-asset-results')).to_contain_text('No character references yet')
  page.locator('#studio-asset-upload').click();expect(page.locator('#upload-dialog')).to_be_visible();expect(page.locator('#upload-role')).to_have_value('character_identity')
  page.locator('#upload-file').set_input_files({'name':'performer.png','mimeType':'image/png','buffer':png});page.locator('#upload-form button[type=submit]').click()
  expect(page.locator('#studio-asset-results')).to_contain_text('performer.png');expect(page.locator('[data-asset-count=characters]')).to_have_text('1')
  route('brand');page.locator('[data-open-cast="'+project+'"]').click();form=page.locator('#production-record-form');form.locator('[name=type]').select_option('character');form.locator('[name=name]').fill('Mira');form.locator('[name=description]').fill('A distinct performer with an approved project identity.');form.locator('button[type=submit]').click();expect(page.locator('[data-edit-record]')).to_have_count(1)
  route('assets/images');page.locator('#asset-tab-characters').click();expect(page.locator('#studio-asset-results')).to_contain_text('Mira');expect(page.locator('[data-asset-count=characters]')).to_have_text('2');expect(page.get_by_role('button',name='Open character',exact=True)).to_be_visible()

  # Arrow navigation and project filtering work without losing the search.
  page.locator('#asset-tab-characters').focus();page.keyboard.press('ArrowRight');expect(page.locator('#asset-tab-audio')).to_be_focused();expect(page.locator('#asset-tab-audio')).to_have_attribute('aria-selected','true')
  page.locator('#studio-asset-project').select_option(project);expect(page.locator('.studio-asset-card')).to_have_count(1)
  other=page.locator('#studio-asset-project option').evaluate_all('(options,current)=>options.find(o=>o.value&&o.value!==current).value',project);page.locator('#studio-asset-project').select_option(other);expect(page.locator('#studio-asset-results')).to_contain_text('No matching assets')
  page.locator('#asset-tab-images').click();page.locator('#studio-asset-upload').click();expect(page.locator('#upload-context')).not_to_contain_text('Library production '+str(width))
  page.locator('#upload-file').set_input_files({'name':'other-project.png','mimeType':'image/png','buffer':png});page.locator('#upload-form button[type=submit]').click();expect(page.locator('#studio-asset-results')).to_contain_text('other-project.png')
  page.locator('#studio-asset-project').select_option(project);expect(page.locator('#studio-asset-results')).to_contain_text('product.png');expect(page.locator('#studio-asset-results')).not_to_contain_text('other-project.png')
  page.locator('#studio-asset-project').select_option('');page.screenshot(path=str(out/f'assets-{width}.png'),full_page=True)
  page.reload();expect(page.locator('#studio-asset-results')).to_contain_text('product.png')
  page.locator('[data-asset-project="'+project+'"]').click();expect(page.locator('.workspace')).to_be_visible();expect(page.locator('#project-name')).to_have_text('Library production '+str(width))
  if width<1000:page.locator('#mobile-project').click()
  page.locator('[data-stage=production]').click();expect(page.locator('.workspace.production')).to_be_visible()
  if width>=1000:
   rail=page.locator('#rail').bounding_box();controls=page.locator('#director').bounding_box();viewer=page.locator('.workspace>.canvas').bounding_box()
   assert rail['x']<controls['x']<viewer['x'];assert viewer['width']>controls['width']
  page.screenshot(path=str(out/f'production-{width}.png'),full_page=True)
  route('brand');expect(page.get_by_role('heading',name='Brand & characters')).to_be_visible()
  route('usage');page.locator('#studio-open-costs').click();expect(page.locator('#spending-dialog')).to_contain_text('Nothing has been generated or charged');page.locator('#close-costs').click()
  route('help');expect(page.get_by_role('heading',name='Help',exact=True)).to_be_visible()
  route('account');page.locator('#studio-account-auth').click();expect(page.locator('#login-dialog')).to_be_visible();page.locator('#login-dialog [data-close]').click()
  page.go_back();expect(page.get_by_role('heading',name='Help',exact=True)).to_be_visible();page.go_forward();expect(page.get_by_role('heading',name='Account / workspace',exact=True)).to_be_visible()
  page.get_by_role('link',name='Director Studio home').click();expect(page.locator('#premise')).to_be_visible();page.screenshot(path=str(out/f'home-{width}.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow'
  if width<1000:
   menu();expect(page.locator('#studio-sidebar.open')).to_be_visible();expect(page.get_by_role('button',name='Close studio menu',exact=True)).to_be_focused();page.keyboard.press('Shift+Tab');expect(page.locator('#studio-sidebar [data-studio-route=account]')).to_be_focused();page.keyboard.press('Tab');expect(page.get_by_role('button',name='Close studio menu',exact=True)).to_be_focused();page.keyboard.press('Escape');expect(page.locator('#studio-sidebar.open')).to_have_count(0);expect(page.locator('#studio-menu-button')).to_be_focused()
  checks.append({'width':width,'formatsCreated':len(formats),'assetCategories':4,'searchAndProjectFilter':True,'selectedProjectUpload':True,'videoPlayback':True,'keyboardTabs':True,'deviceReload':True,'rightHandPreview':width>=1000,'navigationLinks':True})
  context.close()
 individual_checks=[]
 for width,height in [(1440,1000),(390,844)]:
  for kind in ['image','video','audio']:
   c=browser.new_context(viewport={'width':width,'height':height});standalone=c.new_page();standalone.set_default_timeout(12000);standalone.on('pageerror',lambda error:errors.append(str(error)))
   standalone.goto(base+'#create/'+kind);standalone.locator('#premise').fill('A standalone '+kind+' reference.');standalone.locator('#start-device').click();standalone.locator('#approve-direction').click();standalone.locator('#continue-direction').click()
   expected='storyboard' if kind=='video' else 'cast';expect(standalone.locator('[data-stage='+expected+']')).to_have_attribute('aria-current','step')
   if width<1000:standalone.locator('#mobile-project').click()
   standalone.locator('[data-stage=production]').click();standalone.locator('#viewer-add').click();expect(standalone.locator('#upload-scope')).to_have_value('project')
   payload={'name':'image.png','mimeType':'image/png','buffer':png} if kind=='image' else {'name':'sound.wav','mimeType':'audio/wav','buffer':sound.getvalue()} if kind=='audio' else {'name':'clip.mp4','mimeType':'video/mp4','buffer':clip.read_bytes()}
   standalone.locator('#upload-file').set_input_files(payload);standalone.locator('#upload-form button[type=submit]').click();expect(standalone.locator('#individual-'+kind)).to_be_visible()
   if kind=='image':
    standalone.locator('#viewer-add').click();standalone.locator('#upload-file').set_input_files({'name':'alternate.png','mimeType':'image/png','buffer':png});standalone.locator('#upload-form button[type=submit]').click();expect(standalone.locator('[data-preview-asset]')).to_have_count(2)
    standalone.locator('[data-preview-asset]').first.click();first=standalone.locator('#individual-image').get_attribute('src');standalone.locator('[data-preview-asset]').last.click();assert first!=standalone.locator('#individual-image').get_attribute('src')
   else:
    standalone.locator('#individual-'+kind).evaluate('(media)=>media.play()');standalone.wait_for_function('(kind)=>document.querySelector("#individual-"+kind).currentTime>0.1',arg=kind)
   if kind=='audio':assert standalone.locator('.individual-viewer').bounding_box()['height']<=300
   label_box=standalone.locator('.composer>label.skip').bounding_box()
   assert label_box is None or label_box['width']<=1
   assert standalone.evaluate('document.documentElement.scrollWidth<=innerWidth')
   standalone.screenshot(path=str(out/f'individual-{kind}-{width}.png'),full_page=True)
   individual_checks.append({'width':width,'format':kind,'taskSpecificHandoff':True,'projectScopedUpload':True,'actualPreview':True});c.close()
 assert not errors,errors
 assert not console,console
 assert not failed,failed
 result={'checks':checks,'individualMediaPreviews':individual_checks,'pageErrors':errors,'consoleErrors':console,'httpErrors':failed,'paidProviderCalls':0,'deployedSiteTested':False,'physicalMobileTested':False}
 (out/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));browser.close()

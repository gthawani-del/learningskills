"""Approved Studio attachment flow via Chromium; simulated identity/storage only."""
import os,json,subprocess,base64,io,wave,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results/attachments';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/media-ingestion-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
# Illustrative photo preserved in the user's existing frontend design package.
photo=base64.b64decode(re.search(r'data:image/jpeg;base64,([A-Za-z0-9+/=]+)',(root/'docs/frontend-v2/DIRECTOR_STUDIO_FRONTEND_UX_V2_PROTOTYPE.html').read_text()).group(1))
sound=io.BytesIO()
with wave.open(sound,'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(8000);f.writeframes(b'\0\0'*8000)
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port']);checks=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in [(1440,1000),(390,844)]:
   c=browser.new_context(viewport={'width':width,'height':height});c.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}]);page=c.new_page();page.set_default_timeout(15000);errors=[];http=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append(r.status) if r.status>=400 else None)
   page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+');');page.goto(base)
   def open_attachment():
    if width<1000 and page.locator('#director').evaluate('(e)=>e.classList.contains("open")'):page.locator('#attach').click()
    else:page.locator('#cast-upload').click()
   open_attachment();dialog=page.locator('#upload-dialog');expect(dialog).to_be_visible();expect(page.locator('#attachment-submit')).to_be_disabled();expect(page.locator('#attachment-settings')).not_to_be_visible()
   page.locator('#attachment-library-tab').focus();page.keyboard.press('Enter')
   if width==1440:expect(page.locator('#attachment-library-results')).to_contain_text('No references')
   else:expect(page.locator('.attachment-library-item')).to_have_count(1)
   page.keyboard.press('ArrowLeft');expect(page.locator('#attachment-upload-tab')).to_be_focused();expect(page.locator('#attachment-upload-panel')).to_be_visible()
   page.locator('#upload-file').set_input_files({'name':'performer-'+str(width)+'.jpg','mimeType':'image/jpeg','buffer':photo});expect(page.locator('#attachment-media img')).to_be_visible();page.wait_for_function('document.querySelector("#attachment-media img").naturalWidth>0');expect(page.locator('#attachment-submit')).to_be_enabled();expect(page.locator('#upload-role')).to_have_value('visual_style')
   page.screenshot(path=str(out/f'selected-image-{width}.png'),full_page=True)
   page.locator('#upload-file').set_input_files({'name':'unsupported.exe','mimeType':'application/octet-stream','buffer':b'x'});expect(page.locator('#attachment-error')).to_contain_text('Use JPEG');expect(page.locator('#attachment-filename')).to_have_text('performer-'+str(width)+'.jpg');assert page.locator('#upload-file').evaluate('(e)=>e.files[0].name')=='performer-'+str(width)+'.jpg'
   before_assets=page.request.get(base+'/api/projects/'+info['projectId']+'/assets').json()['assets'];page.locator('#attachment-library-tab').click();page.locator('#attachment-library-search').fill('no-match');page.locator('#attachment-library-search').press('Enter');expect(dialog).to_be_visible();assert page.request.get(base+'/api/projects/'+info['projectId']+'/assets').json()['assets']==before_assets;page.locator('#attachment-upload-tab').click()
   page.keyboard.press('Escape');expect(dialog).not_to_be_visible();expect(page.locator('#cast-upload')).to_be_focused();open_attachment();expect(page.locator('#attachment-filename')).to_have_text('performer-'+str(width)+'.jpg')
   page.locator('#attachment-submit').click();expect(dialog).not_to_be_visible()
   open_attachment();page.locator('#attachment-library-tab').click();page.locator('#attachment-library-search').fill('not-in-project');expect(page.locator('#attachment-library-results')).to_contain_text('No matching')
   page.locator('#attachment-library-search').fill('performer-'+str(width));expect(page.locator('.attachment-library-item')).to_have_count(1);page.screenshot(path=str(out/f'library-{width}.png'),full_page=True)
   page.locator('.attachment-library-item').click();expect(dialog).not_to_be_visible();expect(page.locator('#chips')).to_contain_text('performer-'+str(width))
   open_attachment();page.locator('#upload-file').set_input_files({'name':'voice.wav','mimeType':'audio/wav','buffer':sound.getvalue()});expect(page.locator('#upload-role')).to_have_value('voice_reference');expect(page.locator('#attachment-media audio')).to_be_visible();page.screenshot(path=str(out/f'selected-audio-{width}.png'),full_page=True)
   page.locator('#attachment-remove').click();expect(page.locator('#attachment-submit')).to_be_disabled();expect(page.locator('#attachment-browse')).to_be_visible()
   geometry=dialog.evaluate('(e)=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:innerHeight,overflow:e.scrollWidth>e.clientWidth};}')
   assert geometry['left']>=-1 and geometry['right']<=width+1 and geometry['top']>=0 and geometry['bottom']<=height+1 and not geometry['overflow'],geometry
   if width<600:assert abs(geometry['bottom']-height)<=1,geometry
   assert not errors,errors;assert not http,http
   checks.append({'width':width,'filePreview':True,'roleSuggestion':True,'invalidReplacementPreservedFile':True,'cancelPreservedSelection':True,'librarySearchAndDraftReference':True,'keyboardTabsAndEscape':True,'geometry':geometry,'pageConsoleErrors':errors,'httpErrors':http});c.close()
  browser.close();result={'scope':'Chromium app/API with fixture accounts/storage, no live account or provider proof','checks':checks,'physicalMobileTested':False,'paidCalls':0};(out/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

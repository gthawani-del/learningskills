"""Local Chromium footer geometry and interactions; not physical-device verification."""
import json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results';out.mkdir(exist_ok=True)
code="import {createServer} from './apps/director/server.mjs';const s=await createServer({env:{NODE_ENV:'test'}});s.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:s.address().port})));"
server=subprocess.Popen(['node','--input-type=module','-e',code],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
 info=json.loads(server.stdout.readline());url='http://127.0.0.1:'+str(info['port'])
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':390,'height':880});page.set_default_timeout(12000);errors=[];http=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.goto(url);page.locator('#premise').fill('A station keeper finds a letter from tomorrow.');page.locator('#start-form button[type=submit]').click();page.locator('[data-edit-brief-field=purpose]').first.click();page.locator('#compact-field-editor [name=value]').fill('A restrained story about choosing whether to trust tomorrow.');page.locator('#compact-field-editor button[type=submit]').click();page.locator('#approve-direction').click();expect(page.locator('#continue-direction')).to_be_visible()
  sizes=[(390,880),(390,844),(375,812),(360,640),(390,520)]
  geometry=[];clean=None
  for width,height in sizes:
   page.set_viewport_size({'width':width,'height':height});page.locator('#composer-input').focus()
   data=page.evaluate('''()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};return {viewport:{width:innerWidth,height:innerHeight},composer:box('.brief-conversation>.composer'),note:box('.brief-conversation>.composer-note'),footer:box('.briefing>.mobile-tools'),transcript:box('.brief-transcript'),overflow:document.documentElement.scrollWidth>innerWidth};}''')
   geometry.append(data)
   if os.environ.get('DIRECTOR_FOOTER_CAPTURE_ONLY')!='1':
    assert data['composer']['bottom']<=data['note']['top']+.5,data
    assert data['note']['bottom']<=data['footer']['top']+.5,data
    assert data['transcript']['bottom']<=data['composer']['top']+.5,data
    assert data['footer']['bottom']<=height+.5 and data['footer']['top']>=0,data
    assert data['composer']['top']>=0 and data['composer']['height']>0,data
    assert not data['overflow'],data
   if (width,height)==(390,880):page.screenshot(path=str(out/('mobile-footer-before.png' if os.environ.get('DIRECTOR_FOOTER_CAPTURE_ONLY')=='1' else 'mobile-footer-fixed.png')),full_page=True)
  if os.environ.get('DIRECTOR_FOOTER_CAPTURE_ONLY')!='1':
   page.set_viewport_size({'width':390,'height':880});expect(page.locator('#toast')).to_be_empty(timeout=10000);page.locator('#composer-input').evaluate('(e)=>e.blur()');page.screenshot(path=str(out/'mobile-footer-fixed.png'),full_page=True)
   clean=page.evaluate("()=>{const f=document.querySelector('.mobile-tools').getBoundingClientRect(),n=document.querySelector('.brief-conversation>.composer-note').getBoundingClientRect();return {noteBottom:n.bottom,footerTop:f.top,footerBottom:f.bottom,viewportHeight:innerHeight};}");assert clean['noteBottom']<=clean['footerTop'] and clean['footerBottom']<=clean['viewportHeight'],clean
   page.set_viewport_size({'width':390,'height':880});page.locator('#composer-input').fill('Keep the final shot quiet.');page.locator('#composer-form button[type=submit]').click();expect(page.locator('.brief-transcript')).to_contain_text('Keep the final shot quiet.')
   page.locator('#mobile-project').click();expect(page.locator('#rail.open')).to_be_visible();page.locator('#rail [data-stage=brief]').click();expect(page.locator('#rail.open')).not_to_be_visible();page.locator('#mobile-director').click();expect(page.locator('#director.open')).to_be_visible();page.locator('#close-director').click();expect(page.locator('#director.open')).not_to_be_visible();page.locator('#continue-direction').click();expect(page.locator('#screenplay-workspace')).to_be_visible()
   page.locator('#mobile-project').click();page.locator('#rail [data-stage=brief]').click()
   page.set_viewport_size({'width':1440,'height':1000});page.reload();expect(page.locator('.workspace')).to_be_visible();assert not page.locator('.mobile-tools').is_visible()
   assert not errors,errors;assert not http,http
  result={'scope':'actual local Chromium viewport geometry and controls','geometry':geometry,'noFeedbackGeometry':clean,'consoleErrors':errors,'httpErrors':http,'physicalMobileTested':False,'captureOnly':os.environ.get('DIRECTOR_FOOTER_CAPTURE_ONLY')=='1'}
  (out/('mobile-footer-before.json' if result['captureOnly'] else 'mobile-footer-results.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result));browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

"""Actual local APIs and private PNG playback; synthetic provider fixtures, no paid calls."""
import os,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3]
out=root/'test-results';out.mkdir(exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/animatic-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port'])
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}])
  page=context.new_page();page.set_default_timeout(15000);errors=[];http=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  url=base+'/api/projects/'+info['projectId'];project=page.request.get(url).json()['project'];summary=page.request.get(url+'/animatic').json()['animatic']
  r=page.request.post(url+'/animatic',data={'expectedVersion':project['version'],'fps':24,'frameCounts':[24 for f in summary['frames']],'acknowledgeTiming':True});assert r.ok,r.text()
  # The first animation callback can carry a timestamp preceding Play's origin.
  page.add_init_script("const raf=window.requestAnimationFrame.bind(window);let firstFrame=true;window.requestAnimationFrame=callback=>raf(t=>{const stale=firstFrame;firstFrame=false;callback(stale?performance.now()-100:t);});")
  page.add_init_script("localStorage.setItem('director:lastProject',"+json.dumps(info['projectId'])+")");page.goto(base)
  page.locator('[data-load-animatic]').click();expect(page.locator('[data-animatic-play]')).to_be_visible();page.wait_for_function('()=>document.querySelector("[data-animatic-image]").naturalWidth>0')
  page.locator('[data-animatic-play]').click();expect(page.locator('[data-animatic-image]')).to_have_attribute('alt',__import__('re').compile('Storyboard still 2:'))
  expect(page.locator('[data-animatic-play]')).to_have_text('Play');assert page.locator('[data-animatic-seek]').input_value()=='47'
  page.locator('[data-animatic-seek]').fill('0');expect(page.locator('[data-animatic-image]')).to_have_attribute('alt',__import__('re').compile('Storyboard still 1:'))
  page.locator('#animatic-workspace').screenshot(path=str(out/'animatic-desktop.png'))
  page.locator('[data-animatic-edit]').click();page.locator('.animatic-editor [name=frameCount]').fill('12');page.locator('#project-costs').click();expect(page.locator('.animatic-editor [name=frameCount]')).to_have_value('12')
  page.locator('.animatic-editor [name=ack]').check();page.locator('.animatic-editor button[type=submit]').click();expect(page.locator('[data-animatic-status]')).to_contain_text('Timing version saved')
  saved=page.request.get(url+'/animatic').json()['animatic'];assert saved['version']==2 and saved['totalFrames']==36
  page.reload();page.locator('[data-load-animatic]').click();expect(page.locator('#animatic-workspace')).to_contain_text('Saved timing v2')
  page.set_viewport_size({'width':390,'height':844});page.locator('[data-animatic-edit]').click();page.locator('.animatic-editor [name=frameCount]').fill('18')
  actions=page.locator('.animatic-editor .actions');actions.scroll_into_view_if_needed();geometry=page.evaluate("""()=>{const f=document.querySelector('.mobile-tools')?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,footerTop:f?.top??innerHeight,buttons:[...document.querySelectorAll('.animatic-editor .actions button')].map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,bottom:r.bottom,hit:b===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}})}}""")
  assert not geometry['overflow'],geometry
  assert all(b['hit'] and b['bottom']<=geometry['footerTop'] for b in geometry['buttons']),geometry
  page.screenshot(path=str(out/'animatic-mobile-timing.png'));page.locator('[data-animatic-cancel]').click()
  project=page.request.get(url).json()['project'];selection=project['storyboardProduction']['selections'][0]
  response=page.request.post(url+'/approvals',data={'expectedVersion':project['version'],'artifactId':'storyboard_frame:'+selection['shotId'],'version':selection['version'],'decision':'revoked'});assert response.ok,response.text()
  page.reload();page.locator('[data-load-animatic]').click();expect(page.locator('#animatic-workspace')).to_contain_text('Select and approve');expect(page.locator('[data-animatic-play]')).to_have_count(0)
  assert not errors,errors;assert not http,http
  report={'scope':'Actual local HTTP APIs/private stored PNGs and Chromium, with synthetic server-side fal fixtures','passed':['saved frame-accurate silent playback advances to the second actual private image and stops at the last frame','seeking, explicit timing versions, unsaved-edit guard, reload and preserved source decisions','390px editor controls clear footer and pass hit checks; no horizontal overflow','revoked exact frame review holds saved preview without deleting history'],'consoleErrors':errors,'httpErrors':http,'mobileGeometry':geometry,'realPaidCalls':0,'physicalMobileTested':False,'deployedWebsiteTested':False,'audioAligned':False,'finishedMovieExportTested':False}
  (out/'animatic-browser-results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));browser.close()
except Exception:
 print(json.dumps({'consoleErrors':errors,'httpErrors':http}))
 raise
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

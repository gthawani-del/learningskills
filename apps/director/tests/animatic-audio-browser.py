"""Actual local APIs, private PNG/WAV/MP3 playback; synthetic provider fixtures, no paid calls."""
import os,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3]
out=root/'test-results';out.mkdir(exist_ok=True)
format=os.environ.get('DIRECTOR_ANIMATIC_AUDIO_FORMAT','wav')
suffix='-mp3' if format=='mp3' else ''
server=subprocess.Popen(['node','apps/director/tests/animatic-fixture-server.mjs'],cwd=root,env=dict(os.environ,DIRECTOR_ANIMATIC_AUDIO_FIXTURE='1'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port'])
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}])
  page=context.new_page();page.set_default_timeout(15000);errors=[];http=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  url=base+'/api/projects/'+info['projectId'];project=page.request.get(url).json()['project'];summary=page.request.get(url+'/animatic').json()['animatic']
  r=page.request.post(url+'/animatic',data={'expectedVersion':project['version'],'fps':24,'frameCounts':[24 for f in summary['frames']],'acknowledgeTiming':True});assert r.ok,r.text()
  page.add_init_script("localStorage.setItem('director:lastProject',"+json.dumps(info['projectId'])+")");page.goto(base)
  page.on('dialog',lambda dialog:dialog.accept())
  page.locator('[data-load-animatic]').click();expect(page.locator('[data-animatic-play]')).to_be_visible()
  page.locator('.animatic-audio-options summary').click();page.locator('[data-animatic-audio-choice]').select_option(index=1);page.locator('[data-animatic-link]').click()
  expect(page.locator('[data-animatic-audio-duration]')).to_contain_text('browser decoded')
  expect(page.locator('[data-animatic-play]')).to_be_disabled();expect(page.locator('[data-animatic-fit]')).to_be_enabled()
  page.locator('[data-animatic-fit]').click();expect(page.locator('[data-animatic-status]')).to_contain_text('Proportional audio timing saved')
  expect(page.locator('[data-animatic-play]')).to_be_enabled();expect(page.locator('[data-animatic-edit]')).to_be_enabled()
  duration=page.locator('[data-animatic-audio]').evaluate('(a)=>a.duration');assert 2.9<=duration<=3.4,duration
  saved=page.request.get(url+'/animatic').json()['animatic'];assert saved['version']==3 and saved['totalFrames']==round(duration*24) and saved['audioLinked']
  source=saved['audio'];before=page.request.get(url+'/assets/'+source['assetId']+'/content').body()
  page.locator('[data-animatic-play]').click();page.wait_for_function('()=>document.querySelector("[data-animatic-audio]").currentTime>0.25')
  clock=page.evaluate("""()=>({audio:document.querySelector('[data-animatic-audio]').currentTime,frame:Number(document.querySelector('[data-animatic-seek]').value)})""")
  assert abs(clock['frame']/24-clock['audio'])<0.15,clock
  page.locator('[data-animatic-seek]').fill('40');page.wait_for_function('()=>document.querySelector("[data-animatic-audio]").paused')
  page.wait_for_function('()=>Math.abs(document.querySelector("[data-animatic-audio]").currentTime-40/24)<0.06')
  expect(page.locator('[data-animatic-image]')).to_have_attribute('alt',__import__('re').compile('Storyboard still 2:'))
  page.locator('[data-animatic-play]').click();page.wait_for_function('()=>document.querySelector("[data-animatic-audio]").ended')
  expect(page.locator('[data-animatic-play]')).to_have_text('Play')
  page.locator('[data-animatic-edit]').click();page.locator('.animatic-editor [name=frameCount]').fill('40');page.locator('[data-animatic-cancel]').click()
  page.locator('#animatic-workspace').screenshot(path=str(out/('animatic-audio'+suffix+'-desktop.png')))
  page.reload();page.locator('[data-load-animatic]').click();expect(page.locator('[data-animatic-audio-duration]')).to_contain_text('browser decoded');expect(page.locator('[data-animatic-play]')).to_be_enabled()
  page.locator('[data-animatic-play]').click();page.wait_for_function('()=>document.querySelector("[data-animatic-audio]").currentTime>0.1')
  page.evaluate('window.previousAnimaticAudio=document.querySelector("[data-animatic-audio]")');page.locator('[data-stage=story]').click()
  page.wait_for_function('()=>window.previousAnimaticAudio.paused&&!window.previousAnimaticAudio.isConnected')
  page.locator('[data-stage=storyboard]').click();page.locator('[data-load-animatic]').click();expect(page.locator('[data-animatic-play]')).to_be_enabled()
  page.set_viewport_size({'width':390,'height':844});page.locator('.animatic-audio-options summary').click();page.locator('[data-animatic-unlink]').scroll_into_view_if_needed()
  geometry=page.evaluate("""()=>{const footer=document.querySelector('.mobile-tools').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,footerTop:footer.top,buttons:[...document.querySelectorAll('[data-animatic-link],[data-animatic-unlink]')].map(b=>{const r=b.getBoundingClientRect();return {bottom:r.bottom,hit:b===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}})}}""")
  assert not geometry['overflow'] and all(b['hit'] and b['bottom']<=geometry['footerTop'] for b in geometry['buttons']),geometry
  page.screenshot(path=str(out/('animatic-audio'+suffix+'-mobile.png')));page.locator('[data-animatic-unlink]').click();expect(page.locator('[data-animatic-status]')).to_contain_text('Silent draft saved')
  unlinked=page.request.get(url+'/animatic').json()['animatic'];assert unlinked['silent'] and unlinked['version']==4
  assert page.request.get(url+'/assets/'+source['assetId']+'/content').body()==before
  assert not errors,errors;assert not http,http
  report={'scope':'Actual local APIs/private original '+format.upper()+', Chromium audio decoding and playback clock; synthetic image-generation fixtures','passed':['explicit original-audio binding and decoded-duration mismatch hold','proportional integer timing fit, audio-clock playback, seeking and complete natural audio end','immediate edit controls, saved source pins and timing survive reload; stage navigation stops detached audio','390px source controls clear footer; explicit unlink retains original audio bytes and prior versions'],'consoleErrors':errors,'httpErrors':http,'audioFormat':format,'decodedDurationSeconds':duration,'audioClockSample':clock,'mobileGeometry':geometry,'realPaidCalls':0,'physicalMobileTested':False,'deployedWebsiteTested':False,'automaticBeatOrLyricAnalysis':False,'serverDurationVerified':False}
  (out/('animatic-audio'+suffix+'-browser-results.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

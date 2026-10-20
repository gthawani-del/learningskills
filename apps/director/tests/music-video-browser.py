"""Song planning through real local APIs; synthetic audio, no paid generations."""
import os,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3]
def choose_stage(page,stage):
 advanced=page.locator('details').filter(has=page.locator('#creation-stage')).last
 if advanced.get_attribute('open') is None: advanced.locator('summary').first.click()
 page.locator('#creation-stage').select_option(stage)
out=root/'test-results';out.mkdir(exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/music-video-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline()
 if not line: raise AssertionError(server.stderr.read())
 info=json.loads(line);base='http://127.0.0.1:'+str(info['port'])
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}])
  page=context.new_page();page.set_default_timeout(15000);errors=[];http=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.add_init_script("localStorage.setItem('director:lastProject',"+json.dumps(info['projectId'])+")");page.goto(base)
  panel=page.locator('#music-video-workspace');expect(panel).to_be_visible();panel.locator('[data-song-choice]').select_option(index=1)
  expect(panel.locator('[data-song-duration]')).to_contain_text('Browser decoded 3.000 seconds')
  source_pattern=base+'/api/projects/'+info['projectId']+'/assets/*/content'
  def truncated(route):
   if route.request.resource_type=='fetch':route.fulfill(status=200,body=b'bad')
   else:route.continue_()
  page.route(source_pattern,truncated);panel.locator('[data-song-analyze]').click();expect(panel.locator('[data-song-status]')).to_contain_text('incomplete');expect(panel.locator('[data-song-bind]')).to_be_enabled();page.unroute(source_pattern,truncated)
  delayed=[]
  def hold_analysis(route):
   if route.request.resource_type=='fetch':delayed.append(route)
   else:route.continue_()
  page.route(source_pattern,hold_analysis)
  with page.expect_request(lambda r:r.resource_type=='fetch' and '/assets/' in r.url):panel.locator('[data-song-analyze]').click()
  panel.locator('[data-song-source-cancel]').click();expect(panel.locator('[data-song-status]')).to_contain_text('Pending song choice cancelled');expect(panel.locator('[data-song-bind]')).to_be_disabled();expect(panel.locator('[data-song-analysis]')).to_be_empty()
  for route in delayed:
   try:route.abort()
   except Exception:pass
  page.unroute(source_pattern,hold_analysis);panel.locator('[data-song-choice]').select_option(index=1);expect(panel.locator('[data-song-bind]')).to_be_enabled()
  panel.locator('[data-song-analyze]').click();expect(panel.locator('[data-song-analysis]')).to_contain_text('provisional energy section');expect(panel.locator('[data-song-analysis]')).to_contain_text('Tempo unknown.');expect(panel.locator('[data-song-bind]')).to_be_enabled()
  panel.screenshot(path=str(out/'music-video-analysis-desktop.png'))
  panel.locator('[data-song-bind]').click();expect(panel).to_contain_text('plan v1');expect(panel).to_contain_text('provisional song sections')
  url=base+'/api/projects/'+info['projectId'];saved=page.request.get(url+'/music-video').json()['musicVideo'];source=saved['document']['master'];before=page.request.get(url+'/assets/'+source['assetId']+'/content').body();assert saved['document']['sections'][0]['id']=='energy-1' and saved['document']['sections'][0]['timingBasis']=='provisional'
  panel.screenshot(path=str(out/'music-video-song-desktop.png'))
  panel.locator('summary').filter(has_text='Edit song coverage').click();form=panel.locator('[data-song-shots]')
  rows=form.locator('[data-song-shot]');assert rows.count()==2
  rows.nth(0).locator('[name=role]').select_option('singing');rows.nth(0).locator('[name=sync]').select_option('sync_required')
  form.locator('[name=reviewed]').check();form.get_by_role('button',name='Save timing & roles').click()
  expect(panel).to_contain_text('plan v2');expect(panel).to_contain_text('Assign one performer')
  page.reload();expect(panel).to_contain_text('plan v2');state=page.request.get(url+'/music-video').json()['musicVideo'];assert state['shotChecks'][0]['requiresSingingProof'] and not state['lipSyncValidated'] and not state['generationAuthorized']
  panel.locator('summary').filter(has_text='Edit song coverage').click();panel.locator('[name=start]').first.fill('0.2')
  choose_stage(page,'storyboard');expect(page.locator('#toast')).to_contain_text('Save or cancel your song timing edits');expect(panel).to_be_visible()
  panel.get_by_role('button',name='Cancel edits').click();choose_stage(page,'storyboard');expect(page.locator('#storyboard-handoff-workspace')).to_be_visible();expect(panel).to_be_visible()
  page.set_viewport_size({'width':390,'height':844});page.locator('#mobile-results-tab').click();panel.scroll_into_view_if_needed();panel.screenshot(path=str(out/'music-video-song-mobile.png'))
  panel.locator('summary').filter(has_text='Edit song coverage').click()
  actions=panel.locator('[data-song-shots] .actions');actions.scroll_into_view_if_needed()
  geometry=page.evaluate("""()=>{const footer=document.querySelector('.mobile-tools')?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,footerTop:footer&&footer.height>0?footer.top:innerHeight,buttons:[...document.querySelectorAll('[data-song-shots] .actions button')].map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,bottom:r.bottom,hit:b===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}})}}""")
  assert not geometry['overflow'],geometry
  assert all(b['hit'] and b['bottom']<=geometry['footerTop'] for b in geometry['buttons']),geometry
  page.screenshot(path=str(out/'music-video-song-mobile-editor.png'))

  assert page.request.get(url+'/assets/'+source['assetId']+'/content').body()==before,'Original audio changed'
  device_context=browser.new_context(viewport={'width':390,'height':844});device=device_context.new_page()
  device.on('pageerror',lambda e:errors.append(str(e)));device.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  device.goto(base);device.locator('#home-format').select_option('music_video');device.locator('#premise').fill('A performance music video for my uploaded song.');device.locator('#start-device').click()
  device.locator('#mobile-results-tab').click();expect(device.locator('#music-video-workspace')).to_be_visible();device.locator('#mobile-create-tab').click();device.locator('#frozen-upload').click()
  device.locator('#upload-file').set_input_files({'name':'Device song.wav','mimeType':'audio/wav','buffer':before});device.locator('#upload-role').select_option('master_song');device.locator('#upload-scope').select_option('project');device.locator('#upload-form button[type=submit]').click()
  expect(device.locator('#upload-dialog')).not_to_be_visible();device.locator('#mobile-results-tab').click();device.locator('[data-song-choice]').select_option(index=1);expect(device.locator('[data-song-bind]')).to_be_enabled();device.locator('[data-song-analyze]').click();expect(device.locator('[data-song-analysis]')).to_contain_text('provisional energy section');device.locator('#music-video-workspace').screenshot(path=str(out/'music-video-analysis-mobile.png'));device.locator('[data-song-bind]').click()
  expect(device.locator('#music-video-workspace')).to_contain_text('plan v1');device.reload();device.locator('#mobile-results-tab').click();expect(device.locator('#music-video-workspace')).to_contain_text('Device song.wav');expect(device.locator('#music-video-workspace')).to_contain_text('plan v1');device_context.close()
  assert not errors,errors;assert not http,http
  (out/'music-video-browser.json').write_text(json.dumps({'passed':True,'deterministicSongAnalysis':True,'analysisFailureAndCancellationPreserveSource':True,'desktopViewport':True,'mobileViewport':True,'physicalMobileDevice':False,'deviceDraftSongSaveAndReload':True,'savedAcrossReload':True,'sourceUnchanged':True,'missingSingerHeld':True,'mobileEditorGeometry':geometry,'consoleErrors':errors,'httpErrors':http,'paidGenerations':0},indent=2)+'\n')
  browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
print('Music-video song selection, exact source, timing roles, missing-singer hold, reload and viewport checks passed.')

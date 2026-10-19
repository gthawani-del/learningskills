"""Adversarial real local HTTP/UI tests. Reuses existing image/audio fixtures, no paid generation."""
import os,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results';out.mkdir(exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/music-video-fixture-server.mjs'],cwd=root,env=dict(os.environ,DIRECTOR_MUSIC_TIMING_FIXTURE='1'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline()
 if not line:raise AssertionError(server.stderr.read())
 info=json.loads(line);base='http://127.0.0.1:'+str(info['port']);url=base+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':1440,'height':1000});ctx.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}]);page=ctx.new_page();page.set_default_timeout(12000);errors=[];http=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.on('dialog',lambda d:d.accept());page.add_init_script("localStorage.setItem('director:lastProject',"+json.dumps(info['projectId'])+")");page.goto(base)
  panel=page.locator('#music-video-workspace');expect(panel).to_be_visible()
  page.locator('[data-load-animatic]').click();expect(page.locator('[data-animatic-play]')).to_have_count(0)
  page.locator('[data-animatic-refresh]').click();expect(page.locator('[data-animatic-play]')).to_be_enabled()
  saved=page.request.get(url+'/animatic').json()['animatic'];assert saved['audioStartSeconds']==1 and saved['audioEndSeconds']==2.5 and saved['totalFrames']==36,saved
  expect(page.locator('[data-animatic-edit]')).to_be_disabled();expect(page.locator('[data-animatic-fit]')).to_be_disabled()
  page.locator('[data-animatic-play]').click();page.wait_for_function('()=>document.querySelector("[data-animatic-audio]").currentTime>1.05')
  clock=page.evaluate("()=>({time:document.querySelector('[data-animatic-audio]').currentTime,frame:Number(document.querySelector('[data-animatic-seek]').value)})");assert abs(clock['frame']/24-(clock['time']-1))<0.18,clock
  page.locator('[data-animatic-seek]').fill('12');page.wait_for_function('()=>Math.abs(document.querySelector("[data-animatic-audio]").currentTime-1.5)<0.06')
  page.locator('[data-animatic-play]').click();expect(page.locator('[data-animatic-play]')).to_have_text('Play');page.wait_for_function('()=>Number(document.querySelector("[data-animatic-seek]").value)===35')
  page.wait_for_function('()=>{const a=document.querySelector("[data-animatic-audio]");return a.paused&&a.currentTime>=2.5}')
  end=page.locator('[data-animatic-audio]').evaluate('(a)=>({time:a.currentTime,paused:a.paused,ended:a.ended})');assert end['paused'] and 2.5<=end['time']<2.95 and not end['ended'],end
  # A preview save increments the project. Unchanged song inputs remain editable without a reload.
  panel.locator('summary').filter(has_text='Edit song coverage').click();form=panel.locator('[data-song-shots]');form.locator('[name=role]').first.select_option('narrative');form.locator('[name=reviewed]').check();form.get_by_role('button',name='Save timing & roles').click();expect(panel).to_contain_text('plan v2')
  # Put an unresolved section and multiple performers through the actual API, then edit an unrelated shot.
  def project():return page.request.get(url).json()['project']
  def post(path,data):
   r=page.request.post(url+path,data=data);assert r.ok,r.text();return r.json()
  ids=[]
  for name in ['Artist A','Artist B']:
   q=post('/production-records',{'expectedVersion':project()['version'],'type':'character','name':name,'content':{'description':'Identity reference'}})['project'];ids.append(q['production']['records'][-1]['id'])
  q=project();doc=page.request.get(url+'/music-video').json()['musicVideo']['document'];doc['sections'][0]['timingBasis']='provisional';doc['shots'][0]['performers']=[{'recordId':i,'version':1} for i in ids]
  post('/music-video',{'expectedVersion':q['version'],'document':doc,'acknowledgePlanning':True});page.reload();expect(panel).to_contain_text('provisional song sections')
  panel.locator('summary').filter(has_text='Edit song coverage').click();form=panel.locator('[data-song-shots]');form.locator('[name=role]').last.select_option('dance');form.locator('[name=reviewed]').check();form.get_by_role('button',name='Save timing & roles').click();expect(panel).to_contain_text('plan v4')
  doc=page.request.get(url+'/music-video').json()['musicVideo']['document'];assert doc['sections'][0]['timingBasis']=='provisional';assert len(doc['shots'][0]['performers'])==2,doc
  # Updating a character must not silently upgrade that saved identity on another timing save.
  post('/production-records',{'expectedVersion':project()['version'],'id':ids[0],'content':{'description':'Changed identity'}});page.reload()
  panel.locator('summary').filter(has_text='Edit song coverage').click();form=panel.locator('[data-song-shots]');form.locator('[name=role]').last.select_option('broll');form.locator('[name=reviewed]').check();form.get_by_role('button',name='Save timing & roles').click();expect(panel).to_contain_text('plan v5')
  doc=page.request.get(url+'/music-video').json()['musicVideo']['document'];assert next(x for x in doc['shots'][0]['performers'] if x['recordId']==ids[0])['version']==1
  # Changed shot contracts require explicit rebinding; unrelated fields cannot approve them.
  q=project();shot_id=doc['shots'][0]['shotId'];contract=next(x for x in q['storyboardHandoff']['shots'] if x['id']==shot_id)['versions'][-1]['document'];contract['title']+=' revised'
  post('/storyboard-handoff',{'expectedVersion':q['version'],'action':'update','shotId':shot_id,'document':contract});page.reload();panel.locator('summary').filter(has_text='Edit song coverage').click();form=panel.locator('[data-song-shots]')
  expect(form.locator('[name=rebind]')).to_be_visible();form.locator('[name=reviewed]').check();form.get_by_role('button',name='Save timing & roles').click()
  assert page.request.get(url+'/music-video').json()['musicVideo']['version']==5
  form.locator('[name=rebind]').check();form.get_by_role('button',name='Save timing & roles').click();expect(panel).to_contain_text('plan v6')
  assert page.request.get(url+'/music-video').json()['musicVideo']['document']['shots'][0]['contractVersion']==2
  # A pending source selection is a real unsaved edit, and clearing it must invalidate pending decoding.
  panel.locator('summary').filter(has_text='Change original song').click();panel.locator('[data-song-choice]').select_option(index=1);expect(panel.locator('[data-song-bind]')).to_be_enabled();page.locator('[data-stage=story]').click();expect(page.locator('#toast')).to_contain_text('Save or cancel your song timing edits')
  panel.locator('[data-song-source-cancel]').click();expect(panel.locator('[data-song-bind]')).to_be_disabled();page.wait_for_timeout(250);expect(panel.locator('[data-song-bind]')).to_be_disabled()
  page.set_viewport_size({'width':390,'height':844});panel.screenshot(path=str(out/'music-video-redteam-mobile.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert not errors,errors;assert not http,http
  result={'passed':True,'excerptStartSeconds':saved['audioStartSeconds'],'excerptEndSeconds':saved['audioEndSeconds'],'audioClock':clock,'excerptStop':end,'unreviewedSectionsPreserved':True,'multiplePerformersPreserved':True,'stalePerformerNotUpgraded':True,'crossComponentSaveSucceeded':True,'explicitShotRebindRequired':True,'pendingSourceGuard':True,'physicalMobileDevice':False,'consoleErrors':errors,'httpErrors':http,'paidCalls':0}
  (out/'music-video-redteam-browser.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()

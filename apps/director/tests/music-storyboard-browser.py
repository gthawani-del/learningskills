"""Complete-song application flow with simulated fal and real private PNG import.
Synthetic master playback is supplied locally. No paid models or phone claims.
"""
import os,json,subprocess,base64,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results'/'music-storyboard';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/music-treatment-fixture-server.mjs','--storyboard'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline();assert line,server.stderr.read();info=json.loads(line);url='http://127.0.0.1:'+str(info['port']);api=url+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':url,'httpOnly':True,'sameSite':'Strict'}]);
  original=base64.b64decode(info['originalBase64'])
  def original_audio(route):
   match=re.fullmatch(r'bytes=(\d+)-(\d*)',route.request.headers.get('range',''))
   if match:
    start=int(match.group(1));end=min(len(original)-1,int(match.group(2)) if match.group(2) else len(original)-1)
    route.fulfill(status=206,body=original[start:end+1],content_type='audio/wav',headers={'Accept-Ranges':'bytes','Content-Range':f'bytes {start}-{end}/{len(original)}'})
   else:route.fulfill(status=200,body=original,content_type='audio/wav',headers={'Accept-Ranges':'bytes'})
  context.route(api+'/assets/'+info['sourceAssetId']+'/content',original_audio);page=context.new_page();page.set_default_timeout(15000);page.on('dialog',lambda d:d.accept());errors=[];http=[];animatic_commands=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None);page.on('request',lambda r:animatic_commands.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/animatic/from-song') else None)
  def read(suffix):
   r=context.request.get(api+suffix);assert r.ok,r.text();return r.json()
  def summary():return read('/storyboard-production')
  def shot(sid):return next(s for s in summary()['storyboardProductionContext']['shots'] if s['shotId']==sid)
  page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+')');page.goto(url);page.wait_for_load_state('networkidle');expect(page.locator('#storyboard-production-toolbar')).to_be_visible();ids=[s['shotId'] for s in summary()['storyboardProductionContext']['shots']]
  for index,sid in enumerate(ids):
   if index==2:page.set_viewport_size({'width':390,'height':844});page.locator('#mobile-results-tab').click()
   row=page.locator('[data-shot-contract="'+sid+'"]');
   if not row.evaluate('(n)=>n.open'):row.locator(':scope>summary').click()
   expect(row).to_have_attribute('open','');page.locator('[data-review-frame-cost="'+sid+'"]').click();expect(page.locator('#storyboard-generation-dialog')).to_be_visible();page.locator('#share-storyboard-references').check();page.locator('#quote-storyboard-generation').click();expect(page.locator('#authorize-storyboard-generation')).to_be_visible();assert len(summary()['jobs'])==index
   page.locator('#authorize-storyboard-generation').click();expect(page.locator('#run-storyboard-generation')).to_be_enabled();assert len(summary()['jobs'])==index;page.locator('#run-storyboard-generation').click();expect(page.locator('#storyboard-generation-dialog')).not_to_be_visible();job=next(j for j in summary()['jobs'] if j['shotId']==sid)
   page.locator('[data-poll-frame-job="'+job['id']+'"]').click();expect(page.locator('[data-import-frame-job="'+job['id']+'"]').first).to_be_visible();page.locator('[data-import-frame-job="'+job['id']+'"]').click();page.wait_for_function('''async a=>{const d=await(await fetch(a.api+'/storyboard-production')).json();return d.storyboardProductionContext.shots.find(s=>s.shotId===a.id).candidates.length>0;}''',arg={'api':api,'id':sid})
   candidate=shot(sid)['candidates'][0];article=page.locator('[data-storyboard-candidate="'+candidate['id']+'"]');article.scroll_into_view_if_needed();expect(article.locator('img')).to_have_js_property('naturalWidth',1536);assert not shot(sid)['selectionApproved'];article.locator('[data-frame-candidate-review]').check();article.locator('[data-select-frame-candidate]').click();page.locator('[data-frame-visual-ack="'+sid+'"]').check();page.locator('[data-approve-storyboard-frame="'+sid+'"]').click();page.wait_for_function('''async a=>{const d=await(await fetch(a.api+'/storyboard-production')).json();return d.storyboardProductionContext.shots.find(s=>s.shotId===a.id).selectionApproved;}''',arg={'api':api,'id':sid})
  expect(page.locator('#storyboard-production-toolbar')).to_contain_text('3 frames approved');page.locator('[data-load-animatic]').click();expect(page.locator('[data-animatic-refresh]')).to_have_text('Build full-song animatic');page.locator('[data-animatic-refresh]').click();expect(page.locator('[data-animatic-status]')).to_contain_text('Song-plan timing saved');expect(page.locator('[data-animatic-play]')).to_be_enabled()
  saved=read('/animatic')['animatic'];assert saved['durationSeconds']==180 and saved['totalFrames']==4320 and len(saved['frames'])==3;assert saved['audio']['assetId']==info['sourceAssetId'];assert len(animatic_commands)==1;assert set(animatic_commands[0])=={'expectedVersion','acknowledgeOriginalSong','refresh'}
  for seconds,index in [(0,1),(60,2),(120,3),(179,3)]:
   page.locator('[data-animatic-seek]').fill(str(seconds*24));expect(page.locator('[data-animatic-image]')).to_have_attribute('alt',re.compile('Storyboard still '+str(index)+':'));page.wait_for_function('(s)=>Math.abs(document.querySelector("[data-animatic-audio]").currentTime-s)<0.1',arg=seconds)
  page.locator('[data-animatic-play]').click();expect(page.locator('[data-animatic-play]')).to_have_text('Pause');expect(page.locator('[data-animatic-play]')).to_have_text('Play',timeout=7000);assert page.locator('[data-animatic-seek]').input_value()=='4319';assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth');page.locator('#animatic-workspace').screenshot(path=str(out/'mobile-full-song-animatic.png'))
  page.set_viewport_size({'width':1440,'height':1000});page.reload();page.locator('[data-load-animatic]').click();expect(page.locator('#animatic-workspace')).to_contain_text('Saved timing v1');expect(page.locator('[data-animatic-play]')).to_be_enabled();page.locator('#animatic-workspace').screenshot(path=str(out/'desktop-full-song-animatic.png'));assert len(summary()['jobs'])==3;assert not errors,errors;assert not http,http
  (out/'results.json').write_text(json.dumps({'passed':True,'simulatedFalOnly':True,'realPaidCalls':0,'syntheticMasterPlaybackStub':True,'actualPrivatePNGsImported':3,'explicitFrameCostAndAuthorization':True,'humanFrameApprovalControls':True,'songDurationSeconds':180,'totalFrames':4320,'fps':24,'originalAudioBound':True,'boundarySeekAndAudioClock':True,'playToEnd':True,'reload':True,'desktopAndMobileViewports':True,'physicalMobile':False,'consoleErrors':errors,'httpErrors':http},indent=2)+'\n');browser.close();print('Music storyboard generation/import/review and complete 180-second animatic passed locally; fal simulated.')
except Exception:
 if 'errors' in locals():print(json.dumps({'errors':errors,'http':http}))
 raise
finally:
 server.terminate();server.wait(timeout=10)

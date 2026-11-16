"""Existing Chromium infrastructure; real local supplied-image/reference APIs.
Synthetic account/song/treatment; only master playback is stubbed to supplied WAV.
Private image/reference APIs are exercised without interception. Zero paid requests; no physical phone claim.
"""
import os,json,subprocess,base64
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results'/'music-references';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/music-treatment-fixture-server.mjs','--references'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 info=json.loads(server.stdout.readline());url='http://127.0.0.1:'+str(info['port']);api=url+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':url,'httpOnly':True,'sameSite':'Strict'}]);context.route(api+'/assets/'+info['sourceAssetId']+'/content',lambda r:r.fulfill(status=200,body=base64.b64decode(info['originalBase64']),content_type='audio/wav'));page=context.new_page();page.set_default_timeout(15000);errors=[];http=[];paid=[];failed=[]
  page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}));page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None);page.on('request',lambda r:paid.append(r.url) if r.method=='POST' and any(x in r.url for x in ['/quotes','/jobs','/planning-calls']) else None)
  page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+')');page.goto(url)
  expect(page.locator('#reference-production-workspace')).to_contain_text('5 of 5 reference images approved')
  subject='location:music_sequence_1';row=page.locator('[data-reference-target="'+subject+'"]');row.locator(':scope>summary').click();expect(row).to_contain_text('treatment passage 0–60s');expect(row).to_contain_text('Reuse first:')
  reuse=row.locator('details').filter(has=page.locator('[data-uploaded-reference="'+subject+'"]'));reuse.locator(':scope>summary').click();select=row.locator('[data-uploaded-reference]');select.select_option(info['spareAssetId']);row.locator('[data-register-uploaded-reference]').click()
  def references():return context.request.get(api+'/reference-production').json()['referenceContext']
  page.wait_for_function('''async a=>{const d=await(await fetch(a.api+'/reference-production')).json();return d.referenceContext.subjects.find(s=>s.id===a.id).candidates.length===2;}''',arg={'api':api,'id':subject})
  candidate=next(c for s in references()['subjects'] if s['id']==subject for c in s['candidates'] if c['assetId']==info['spareAssetId']);cid=candidate['id'];article=page.locator('[data-reference-candidate="'+cid+'"]');article.scroll_into_view_if_needed();expect(article.locator('img')).to_be_visible();page.wait_for_function('(id)=>{const i=document.querySelector(`[data-reference-candidate="${id}"] img`);return i?.complete&&i.naturalWidth>0;}',arg=cid)
  article.locator('[data-candidate-review]').check();article.locator('[data-select-reference-candidate]').click();expect(page.locator('[data-reference-visual-ack="'+subject+'"]')).to_be_visible();page.locator('[data-reference-visual-ack="'+subject+'"]').check();page.locator('[data-approve-reference="'+subject+'"]').click();expect(page.locator('#reference-production-workspace')).to_contain_text('5 of 5 reference images approved')
  changed=context.request.get(api+'/storyboard-production').json()['storyboardProductionContext'];first=changed['shots'][0]['shotId'];other=[s['current'] for s in changed['shots'][1:]];assert changed['shots'][0]['referenceStale']
  # Navigate with the existing stage control; no project creation or generation.
  page.get_by_text('Project stages',exact=True).click();page.locator('#rail [data-stage=storyboard]').click();expect(page.locator('#bind-approved-references')).to_be_visible();page.locator('#bind-approved-references-ack').check();page.locator('#bind-approved-references').click();expect(page.locator('#toast')).to_contain_text('affected shot directions')
  after=context.request.get(api+'/storyboard-production').json()['storyboardProductionContext'];assert not after['shots'][0]['referenceStale'];assert not after['shots'][0]['directionApproved'];assert [s['current'] for s in after['shots'][1:]]==other
  page.screenshot(path=str(out/'desktop-reference-bindings.png'));page.set_viewport_size({'width':390,'height':844});page.reload();page.locator('#mobile-results-tab').click();expect(page.locator('#storyboard-production-toolbar')).to_be_visible();assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth');page.screenshot(path=str(out/'mobile-reference-bindings.png'))
  reloaded=context.request.get(api+'/storyboard-production').json()['storyboardProductionContext'];assert reloaded['shots'][0]['current']==after['shots'][0]['current'];assert context.request.get(api+'/jobs').json()['jobs']==[];assert not errors,errors;assert not http,http;assert not paid,paid
  (out/'results.json').write_text(json.dumps({'passed':True,'suppliedImagesOnly':True,'syntheticMasterPlaybackStub':True,'paidRequests':paid,'durationSeconds':180,'referenceSubjects':5,'timedShotUsage':True,'actualPrivateImagePreview':True,'selectionAndApproval':True,'targetedReferenceBinding':True,'unselectedShotsPreserved':True,'reload':True,'desktopAndMobileViewports':True,'physicalMobile':False,'consoleErrors':errors,'httpErrors':http},indent=2)+'\n');browser.close();print('Music reference reuse, exact selection, scoped binding and reload passed; no paid calls.')
except Exception:
 if 'errors' in locals():print(json.dumps({'errors':errors,'http':http,'failed':failed}))
 raise
finally:
 server.terminate();server.wait(timeout=10)

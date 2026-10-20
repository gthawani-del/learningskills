"""Existing browser infrastructure; synthetic providers, real app/financial/job UI."""
import os,json,subprocess,base64
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results'/'song-provider';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/song-provider-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline()
 if not line:raise AssertionError(server.stderr.read())
 fixture=json.loads(line);url='http://127.0.0.1:'+str(fixture['port']);api=url+'/api/projects/'+fixture['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':fixture['session'],'url':url,'httpOnly':True,'sameSite':'Strict'}]);context.route('https://song-fixture.supabase.co/**',lambda route:route.fulfill(status=200,body=base64.b64decode(fixture['originalBase64']),content_type='audio/wav'));page=context.new_page();page.set_default_timeout(12000);page.on('dialog',lambda d:d.accept());errors=[];http=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(fixture['projectId'])+')');page.goto(url)
  song=page.locator('#song-intelligence-workspace');song.locator('summary').first.click();ai=song.locator('[data-song-ai]');ai.locator('summary').click();ai.locator('[data-load-song-routes]').click();expect(ai.locator('[data-song-model]')).to_have_value('M05');ai.locator('[data-share-song]').check();ai.locator('[data-quote-song]').click();expect(ai.locator('[data-song-quote]')).to_contain_text('$0.010');assert context.request.get(api+'/jobs').json()['jobs']==[]
  ai.locator('[data-song-costs]').click();cost=page.locator('#costs-dialog')
  if cost.count()==0:cost=page.locator('dialog').filter(has=page.locator('#spending-heading'))
  expect(cost).to_be_visible();form=cost.locator('[data-cost-quote]');form.locator('[name=max]').fill('0.01');form.locator('[name=finish]').fill('0');form.locator('button').click();expect(page.locator('#toast')).to_contain_text('Spending limit recorded');assert len(context.request.get(api+'/spending').json()['authorizations'])==1;assert context.request.get(api+'/jobs').json()['jobs']==[];cost.locator('#close-costs').click()
  ai.locator('[data-start-song]').click();expect(ai.locator('[data-song-jobs]')).to_contain_text('submitted');assert len(context.request.get(api+'/jobs').json()['jobs'])==1;ai.locator('[data-song-job] > summary').click();ai.locator('[data-poll-song]').click();expect(ai.locator('[data-song-jobs]')).to_contain_text('completed');ai.locator('[data-propose-song]').click();expect(ai.locator('[data-song-result]')).to_contain_text('Review proposed interpret');assert context.request.get(api+'/music-video/intelligence').json()['songIntelligence']['version']==1
  ai.screenshot(path=str(out/'desktop-provider-review.png'));page.screenshot(path=str(out/'desktop-provider-viewport.png'));page.set_viewport_size({'width':390,'height':844});page.locator('#mobile-results-tab').click();ai.scroll_into_view_if_needed();assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth');ai.screenshot(path=str(out/'mobile-provider-review.png'));page.screenshot(path=str(out/'mobile-provider-viewport.png'))
  ai.locator('[data-listened-proposal]').check();ai.locator('[data-accept-song-proposal]').click();expect(song.locator('summary').first).to_contain_text('v2 needs review');saved=context.request.get(api+'/music-video/intelligence').json()['songIntelligence'];assert saved['version']==2 and not saved['approved'];assert saved['document']['observations'][0]['basis']=='user_reviewed';assert saved['document']['lyrics']['canonicalText']=='';assert len(context.request.get(api+'/jobs').json()['jobs'])==1
  song.locator('summary').first.click();song.locator('[data-analyze-bound]').click();expect(song.locator('[data-intelligence-status]')).to_contain_text('Measured signal evidence');expect(song.locator('svg')).to_be_visible();song.locator('[data-cancel-evidence]').click()
  assert not errors,errors;assert not http,http;(out/'results.json').write_text(json.dumps({'passed':True,'syntheticProvider':True,'realPaidCalls':0,'sharedSpendingUI':True,'quoteAndAuthorizationDoNotSubmit':True,'singleSavedJob':True,'reviewBeforeApply':True,'newVersionNotAutomaticallyApproved':True,'desktopAndMobileViewport':True,'physicalMobile':False,'consoleErrors':errors,'httpErrors':http},indent=2)+'\n');browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
print('Song-provider cost review, explicit shared spending, saved request, proposal review and mobile viewport checks passed (synthetic providers).')

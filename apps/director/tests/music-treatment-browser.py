"""Existing Chromium infrastructure, real app/API/approval paths, simulated OpenAI.
Viewport checks are not physical mobile-device verification.
"""
import os,json,subprocess,base64
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results'/'music-treatment';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/music-treatment-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline()
 if not line:raise AssertionError(server.stderr.read())
 info=json.loads(line);url='http://127.0.0.1:'+str(info['port']);api=url+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':url,'httpOnly':True,'sameSite':'Strict'}]);context.route('https://song-fixture.supabase.co/**',lambda route:route.fulfill(status=200,body=base64.b64decode(info['originalBase64']),content_type='audio/wav'));page=context.new_page();page.set_default_timeout(15000);page.on('dialog',lambda d:d.accept());errors=[];http=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+')');page.goto(url);expect(page.locator('#screenplay-workspace')).to_contain_text('Direct your music video')
  original=context.request.get(api+'/music-video/intelligence').json()['songIntelligence']['document'];page.locator('#write-script').click();form=page.locator('#planning-consent-form');expect(form).to_be_visible();form.locator('[name=max]').fill('0.1');form.locator('[name=finish]').fill('0');form.locator('[name=calls]').fill('2');form.locator('button[type=submit]').click();assert context.request.get(api+'/planning').json()['calls']==[]
  page.locator('[data-planning-call][data-operation=write_script]').last.click();review=page.locator('[data-review-screenplay-proposal]').last;expect(review).to_be_visible();review.click();expect(page.locator('#screenplay-proposal-dialog')).to_be_visible();page.locator('#apply-screenplay-proposal').click();expect(page.locator('#screenplay-proposal-dialog')).not_to_be_visible();expect(page.locator('#music-treatment-timing')).to_contain_text('0–180 seconds');expect(page.locator('#music-treatment-timing [data-edit-music-sequence]')).to_have_count(3)
  saved=context.request.get(api+'/screenplay').json()['screenplayContext'];assert not saved['approved'];assert saved['screenplay']['document']['musicTiming']['range']=={'startMs':0,'endMs':180000}
  page.locator('#screenplay-coverage-ack').check();page.locator('#approve-screenplay').click();expect(page.locator('#approve-screenplay')).to_have_text('Script approved')
  def open_departments():
   outer=page.locator('details').filter(has=page.locator('#department-workspace'))
   if not page.locator('#department-workspace').is_visible():outer.locator('summary').first.click()
  open_departments();page.locator('#prepare-departments').click();expect(page.locator('#department-workspace')).to_contain_text('0 of 17 plans approved');expect(page.locator('#department-workspace [data-department-card]')).to_have_count(17);open_departments();assert page.locator('[data-approve-department]').count()==0;assert page.locator('[data-department-ack]').count()==0;page.locator('#music-department-package-ack').check();page.locator('#approve-music-department-package').click();expect(page.locator('#department-workspace')).to_contain_text('17 of 17 plans approved')
  ledger=context.request.get(api+'/approvals').json()['approvals'];assert len([a for a in ledger if a['artifactId'].startswith('department:')])==17
  page.locator('#music-treatment-timing').scroll_into_view_if_needed();page.screenshot(path=str(out/'desktop-timed-treatment.png'));page.locator('[data-edit-music-sequence]').first.click();form=page.locator('[data-music-sequence-form]');form.locator('[name=action]').fill('The traveller checks the rain, waits, then deliberately opens the door.');form.locator('[name=emotion]').fill('Hesitation becomes a deliberate first step.');form.locator('[name=cutAfterMs]').fill('65000');form.get_by_role('button',name='Save sequence correction').click();expect(page.locator('#music-treatment-timing [data-edit-music-sequence]')).to_have_count(3);expect(page.locator('#screenplay-workspace')).to_contain_text('Version 2')
  after=context.request.get(api+'/screenplay').json()['screenplayContext'];assert not after['approved'];document=after['screenplay']['document'];assert document['musicTiming']['sequences'][1]['startMs']==65000;assert document['musicTiming']['sequences'][2]==saved['screenplay']['document']['musicTiming']['sequences'][2]
  page.locator('[data-edit-music-sequence]').first.click();page.locator('[data-music-sequence-form] [name=action]').fill('Unsaved deliberate correction');page.get_by_text('Project stages',exact=True).click();page.locator('#rail [data-stage=cast]').click();expect(page.locator('#toast')).to_contain_text('Save or cancel your music-treatment correction');expect(page.locator('[data-music-sequence-form]')).to_be_visible();page.locator('[data-cancel-music-sequence]').click()
  page.set_viewport_size({'width':390,'height':844});page.reload();page.locator('#mobile-results-tab').click();expect(page.locator('#music-treatment-timing')).to_contain_text('0–180 seconds');page.locator('#music-treatment-timing').scroll_into_view_if_needed();assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth');page.screenshot(path=str(out/'mobile-timed-treatment.png'))
  assert context.request.get(api+'/music-video/intelligence').json()['songIntelligence']['document']==original;assert len(context.request.get(api+'/planning').json()['calls'])==1;assert context.request.get(api+'/jobs').json()['jobs']==[];assert not errors,errors;assert not http,http
  (out/'results.json').write_text(json.dumps({'passed':True,'syntheticOpenAIOnly':True,'realPaidCalls':0,'fullSongSeconds':180,'reviewedTreatment':True,'singleDepartmentApprovalAction':True,'departmentArtifacts':17,'targetedSequenceAndNeighbourCutEdit':True,'unselectedSequencePreserved':True,'originalSongEvidencePreserved':True,'unsavedNavigationGuard':True,'desktopAndMobileViewports':True,'physicalMobile':False,'consoleErrors':errors,'httpErrors':http},indent=2)+'\n');browser.close()
except Exception:
 if 'errors' in locals():print(json.dumps({'pageErrors':errors,'httpErrors':http}))
 raise
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
print('Timed music treatment, one-action department package, focused edits and desktop/mobile viewport checks passed; OpenAI simulated, no creative quality claim.')

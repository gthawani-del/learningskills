"""Existing local app/fixture, real browser audio decoder; no model/production writes."""
import os,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3]
out=root/'test-results'/'song-intelligence';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/music-video-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=server.stdout.readline()
 if not line:raise AssertionError(server.stderr.read())
 info=json.loads(line);base='http://127.0.0.1:'+str(info['port']);api=base+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}]);page=context.new_page();page.set_default_timeout(15000)
  errors=[];http=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  page.add_init_script("localStorage.setItem('director:lastProject',"+json.dumps(info['projectId'])+")");page.goto(base)
  panel=page.locator('#music-video-workspace');panel.locator('[data-song-choice]').select_option(index=1);expect(panel.locator('[data-song-analyze]')).to_be_enabled();panel.locator('[data-song-analyze]').click();expect(panel.locator('[data-song-analysis]')).to_contain_text('provisional energy section');panel.locator('[data-song-bind]').click()
  widget=page.locator('#song-intelligence-workspace');expect(widget.locator('[data-save-evidence]')).to_be_visible();expect(widget.locator('svg')).to_be_visible();widget.locator('[data-evidence-reviewed]').check();widget.locator('[data-save-evidence]').click();expect(widget.locator('summary').first).to_contain_text('v1')
  widget.locator('summary').first.click();widget.locator('summary').filter(has_text='Canonical lyrics, language & singers').click();canonical='  नमस्ते\n你好 🎵\nمرحبا  ';widget.locator('[data-canonical-lyrics]').fill(canonical);widget.locator('[data-lyric-languages]').fill('Hindi, Chinese, Arabic');widget.locator('[data-vocal-mode]').select_option('mixed');widget.locator('[data-singers]').fill('original | Original performer');widget.locator('[data-evidence-reviewed]').check();widget.locator('[data-save-evidence]').click();expect(widget.locator('summary').first).to_contain_text('v2')
  source=context.request.get(api+'/music-video').json()['musicVideo']['document']['master'];original=context.request.get(api+'/assets/'+source['assetId']+'/content').body();saved=context.request.get(api+'/music-video/intelligence').json()['songIntelligence'];assert saved['document']['lyrics']['canonicalText']==canonical;assert not saved['approved'];assert saved['document']['technical']['provenance']=='browser_decoded'
  widget.locator('summary').first.click();widget.locator('[data-evidence-reviewed]').check();widget.locator('[data-approve-evidence]').click();expect(widget.locator('summary').first).to_contain_text('approved');widget.locator('summary').first.click();expect(widget.locator('[data-director-song]')).to_be_enabled();widget.screenshot(path=str(out/'desktop-evidence.png'))
  widget.locator('[data-director-song]').click();expect(page.locator('#screenplay-workspace')).to_be_visible();result=context.request.get(api+'/music-video/director-context');assert result.status==200;assert result.json()['songContext']['lyrics']['canonicalText']==canonical
  page.set_viewport_size({'width':390,'height':844});page.reload();page.locator('#mobile-results-tab').click();widget=page.locator('#song-intelligence-workspace');expect(widget.locator('summary').first).to_contain_text('approved');widget.locator('summary').first.click();widget.scroll_into_view_if_needed();assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth');widget.screenshot(path=str(out/'mobile-evidence.png'))
  assert context.request.get(api+'/assets/'+source['assetId']+'/content').body()==original;assert not errors,errors;assert not http,http
  (out/'results.json').write_text(json.dumps({'passed':True,'actualBrowserDecode':True,'canonicalTextPreserved':True,'savedAndApprovedAcrossReload':True,'directorHandoff':True,'sourceUnchanged':True,'desktopAndMobileViewport':True,'physicalMobile':False,'paidCalls':0,'consoleErrors':errors,'httpErrors':http},indent=2)+'\n');browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
print('Song intelligence persistence, canonical corrections, approval, Director handoff and responsive checks passed.')

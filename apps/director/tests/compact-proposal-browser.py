"""Real local API + browser; simulated provider, no paid calls or cloud writes."""
import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results';out.mkdir(exist_ok=True)
server=subprocess.Popen(['node',str(Path(__file__).with_name('compact-proposal-server.mjs'))],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port']);url=base+'/api/projects/'+info['projectId']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(15000);errors=[];http=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('response',lambda r:http.append({'status':r.status,'url':r.url}) if r.status>=400 else None);page.on('dialog',lambda d:d.accept())
  page.add_init_script("localStorage.setItem('director:lastProject',"+json.dumps(info['projectId'])+")");page.goto(base);expect(page.locator('#compact-brief')).to_be_visible()
  page.locator('[data-edit-brief-field=tone]').first.click();page.locator('#compact-field-editor [name=value]').fill('Quiet and restrained');page.locator('#compact-field-editor button[type=submit]').click();page.locator('#approve-direction').click();expect(page.locator('#continue-direction')).to_be_visible()
  before=page.request.get(url).json()['project'];approved=before['creativeBrief'];tone='Quiet and restrained'
  page.locator('#project-costs').click();page.locator('#open-planning-limits').click();form=page.locator('#planning-consent-form');expect(form).to_be_visible();form.locator('[name=max]').fill('0.003');form.locator('[name=finish]').fill('0.0005');form.locator('[name=calls]').fill('2');form.locator('button').click();summary=page.request.get(url+'/planning').json();assert len(summary['consents'])==1 and not summary['calls']
  page.locator('[data-planning-call][data-operation=interpret_brief]').click();expect(page.locator('[data-poll-planning]')).to_be_visible();page.reload();page.locator('#project-costs').click();page.locator('#open-planning-limits').click();page.locator('[data-poll-planning]').click();expect(page.locator('[data-review-brief-proposal]')).to_be_visible()
  assert page.request.get(url).json()['project']['creativeBrief']==approved
  page.locator('[data-review-brief-proposal]').click();dialog=page.locator('#creative-brief-dialog');expect(dialog).to_be_visible();assert dialog.locator('textarea,input,select').count()==0;expect(dialog).to_contain_text('Natural light and restrained camera movement');assert 'Unknown' not in dialog.inner_text();assert 'A conflicting proposed purpose' not in dialog.inner_text();assert 'Loud and exaggerated' not in dialog.inner_text()
  page.screenshot(path=str(out/'compact-ai-proposal-desktop.png'),full_page=True);page.locator('#apply-brief-proposal').click();expect(dialog).not_to_be_visible();expect(page.locator('#approve-direction')).to_be_visible();expect(page.locator('#compact-brief')).to_contain_text('Natural light and restrained camera movement')
  after=page.request.get(url).json()['project'];fields=after['creativeBrief']['versions'][-1]['fields'];assert fields['tone']['value']==tone;assert fields['purpose']['value']==approved['versions'][-1]['fields']['purpose']['value'];assert fields['visualStyle']['value']=='Natural light and restrained camera movement';assert page.request.get(url+'/brief').json()['briefContext']['approved'] is False;assert after['story']['treatment']==''
  summary=page.request.get(url+'/planning').json();assert len(summary['calls'])==1;assert summary['calls'][0]['actualMicroUsd']==20
  assert not errors,errors;assert not http,http
  result={'scope':'Real local browser/API with in-memory store and server-side simulated planning provider; no browser request interception','passed':['explicit allowance without automatic submission','one saved interpretation call survives reload','read-only compact delta review','unknown fields omitted','protected purpose and tone omitted from proposed changes','explicit apply returns to inline review','new known look visible in main proposal','applied result remains unapproved','story and approved choices preserved','single simulated call with usage accounting'],'realPaidCalls':0,'consoleErrors':errors,'httpErrors':http,'physicalMobileTested':False};(out/'compact-proposal-browser-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

"""Hybrid planning consent checks using explicit API fixtures; no real billing or provider calls."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3432')
PROJECT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));posts=[];revokes=[];authorizations=[];consents=[];calls=[];planning_enabled={'value':False}
 project={'id':PROJECT,'title':'Cost review fixture','premise':'A station at dawn.','format':'short_film','stage':'story','version':1,'duration':5,'language':'English','direction':'','story':{'version':1,'treatment':'A letter arrives.','scenes':[]},'shots':[]}
 quote={'id':'quote-fixture','task':'image_edit','totalMicroUsd':1000000,'expiresAt':'2099-01-01T00:00:00Z','modelId':'M09','artifactId':'story','artifactVersion':1}
 def api(route):
  path=route.request.url.split('/api',1)[1];method=route.request.method
  if path=='/config':data={'mode':'supabase','user':{'id':'user','isAdmin':False},'capabilities':{'planning':False,'media':False,'uploads':False}}
  elif path=='/projects':data={'projects':[project]}
  elif path=='/skills':data={'skills':[]}
  elif path==f'/projects/{PROJECT}':data={'project':project}
  elif path.endswith('/assets'):data={'assets':[]}
  elif path.endswith('/approvals'):data={'approvals':[]}
  elif path.endswith('/spending'):data={'quotes':[quote],'authorizations':authorizations,'reservations':[],'generationEnabled':False,'currency':'USD'}
  elif path.endswith('/planning') or '/planning/' in path:
   operation=path.rsplit('/',1)[-1] if '/planning/' in path else 'interpret_brief';data={'operation':operation,'route':{'selectedModelId':'O-fixture'},'policy':{'path':'llm','reason':'Planning requires consent'},'availability':{'enabled':planning_enabled['value'],'reason':'Verified test route' if planning_enabled['value'] else 'No verified planning route'},'scope':{'briefScopeHash':'brief','approvedDecisionDigest':'decisions'},'quote':{'operation':operation,'modelId':'O-fixture','profileFingerprint':'a'*64,'maxCallMicroUsd':1000000,'currency':'USD','expiresAt':'2099-01-01T00:00:00Z'} if planning_enabled['value'] else None,'consents':consents,'calls':calls}
  elif path.endswith('/planning-consents'):
   body=route.request.post_data_json;posts.append(body);consent={'id':'consent-fixture','operation':body['operation'],'modelId':body['expectedModelId'],'profileFingerprint':body['expectedProfileFingerprint'],'maxMicroUsd':body['maxMicroUsd'],'finishReserveMicroUsd':body['finishReserveMicroUsd'],'maxCalls':body['maxCalls'],'expiresAt':'2099-01-01T00:00:00Z','briefScopeHash':'brief','approvedDecisionDigest':'decisions'}
   if len(posts)==1:consents.append(consent);route.abort('failed');return
   data={'consent':consent}
  elif path.endswith('/planning-calls'):
   calls.append({'id':'call-fixture-'+str(len(calls)+1),'status':'reserved','operation':route.request.post_data_json['operation']});data={'call':calls[-1]}
  elif path.endswith('/resume'):
   calls[-1]['status']='unknown';calls[-1]['chargeState']='unknown';data={'call':calls[-1]}
  elif path.endswith('/release'):
   calls[-1]['status']='cancelled';calls[-1]['chargeState']='released';data={'call':calls[-1]}
  elif path.endswith('/poll'):
   calls[-1]['status']='completed';calls[-1]['chargeState']='settled';data={'call':calls[-1]}
  elif path.endswith('/revoke'):
   revokes.append(route.request.post_data_json);consents[0]['revokedAt']='2026-10-18T00:00:00Z';data={'consent':consents[0]}
  else:raise AssertionError('Unexpected API operation '+method+' '+path)
  route.fulfill(json=data)
 page.route('**/api/**',api);page.add_init_script(f"localStorage.setItem('director:lastProject','{PROJECT}')");page.on('dialog',lambda d:d.accept());page.goto(BASE)
 page.locator('#project-costs').click();page.locator('#open-planning-limits').click();expect(page.locator('#planning-content')).to_contain_text('No verified planning route');assert page.locator('#planning-consent-form').count()==0;assert not posts;assert not calls
 planning_enabled['value']=True;page.locator('#planning-operation').select_option('initial_plan');form=page.locator('#planning-consent-form');form.locator('[name=max]').fill('1.00');form.locator('[name=finish]').fill('0.10');form.locator('[name=calls]').fill('10');form.locator('button').click();expect(page.locator('#planning-status')).to_contain_text('must cover');assert not posts
 form.locator('[name=max]').fill('1.100001');form.locator('button').click();expect(page.locator('#planning-status')).to_contain_text('original request');assert len(posts)==1;assert not calls
 form.locator('button').click();expect(page.locator('#planning-content')).to_contain_text('$1.100001 total');assert posts[0]['requestId']==posts[1]['requestId'];assert posts[1]['maxMicroUsd']==1100001;assert posts[1]['finishReserveMicroUsd']==100000;assert posts[1]['maxCalls']==10;assert not calls
 page.locator('[data-planning-call][data-operation=initial_plan]').click();expect(page.locator('[data-resume-planning]')).to_be_visible();expect(page.locator('[data-release-planning]')).to_be_visible();page.locator('[data-resume-planning]').click();expect(page.locator('#planning-content')).to_contain_text('Checking outcome');assert page.locator('[data-resume-planning]').count()==0;assert page.locator('[data-release-planning]').count()==0;assert len(calls)==1;assert page.locator('[data-planning-call]').count()==0
 page.locator('[data-poll-planning]').click();expect(page.locator('#planning-content')).to_contain_text('Ready for review');assert len(calls)==1
 page.locator('[data-planning-call][data-operation=initial_plan]').click();expect(page.locator('[data-release-planning]')).to_be_visible();page.locator('[data-release-planning]').click();expect(page.locator('#planning-content')).to_contain_text('Cancelled');assert len(calls)==2
 revoke=page.locator('[data-revoke-planning]');revoke.locator('[name=reason]').fill('Creative direction changed');revoke.locator('button').click();expect(page.locator('#planning-content')).to_contain_text('Revoked');assert len(revokes)==1
 page.screenshot(path=str(out/'planning-fixture-desktop.png'),full_page=True);page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'planning-fixture-mobile.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
 result={'scope':'browser UI with intercepted planning API fixtures; no paid models or live consent backend','passed':['unavailable route gate','one-call minimum plus protected finish','maxCalls is upper limit','ambiguous response UUID reuse','consent never auto starts call','unknown call blocks replacement','explicit polling','reserved resume reuses hold','reserved cancellation','unknown cannot resume or cancel','explicit revoke','390px viewport overflow check'],'pageErrors':errors,'injectedNetworkFailure':True,'physicalMobileTested':False};(out/'planning-ui-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()

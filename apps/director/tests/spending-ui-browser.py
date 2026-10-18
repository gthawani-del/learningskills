"""Costs interaction checks using explicit API fixtures; no real billing or provider calls."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('DIRECTOR_TEST_URL','http://127.0.0.1:3432')
PROJECT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
out=Path('test-results');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));posts=[];revokes=[];authorizations=[]
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
  elif path.endswith('/spending-authorizations'):
   body=route.request.post_data_json;posts.append(body)
   authorization={'id':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','quoteId':quote['id'],'maxMicroUsd':body['maxMicroUsd'],'finishReserveMicroUsd':body['finishReserveMicroUsd'],'expiresAt':'2099-01-01T00:00:00Z'}
   if len(posts)==1:authorizations.append(authorization);route.abort('failed');return
   data={'authorization':authorization}
  elif path.endswith('/revoke'):
   revokes.append(route.request.post_data_json);authorizations[0]['revokedAt']='2026-10-18T00:00:00Z';data={'authorization':authorizations[0]}
  else:raise AssertionError('Unexpected API operation '+method+' '+path)
  route.fulfill(json=data)
 page.route('**/api/**',api);page.add_init_script(f"localStorage.setItem('director:lastProject','{PROJECT}')");page.on('dialog',lambda d:d.accept());page.goto(BASE)
 page.locator('#project-costs').click();expect(page.locator('#spending-content')).to_contain_text('Generation is not enabled')
 form=page.locator('[data-cost-quote]');form.locator('[name=max]').fill('1.00');form.locator('[name=finish]').fill('0.10');form.locator('button').click();expect(page.locator('#spending-status')).to_contain_text('must cover');assert not posts
 form.locator('[name=max]').fill('2.000001');form.locator('button').click();expect(page.locator('#spending-status')).to_contain_text('Refresh costs');assert len(posts)==1
 form.locator('button').click();expect(page.locator('#spending-content')).to_contain_text('$2.000001 total limit');assert len(posts)==2;assert posts[0]['requestId']==posts[1]['requestId'];assert posts[1]['maxMicroUsd']==2000001;assert posts[1]['finishReserveMicroUsd']==100000
 revoke=page.locator('[data-revoke-authorization]');revoke.locator('[name=reason]').fill('Creative direction changed');revoke.locator('button').click();expect(page.locator('#spending-content')).to_contain_text('Revoked');assert len(revokes)==1
 page.screenshot(path=str(out/'spending-fixture-desktop.png'),full_page=True);page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'spending-fixture-mobile.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Horizontal viewport overflow';assert not errors,errors
 result={'scope':'browser UI with intercepted API fixtures; not live backend or billing','passed':['exact microUSD conversion','estimate plus finishing cap check','ambiguous response UUID reuse','explicit revoke','390px viewport overflow check'],'pageErrors':errors,'injectedNetworkFailure':True,'physicalMobileTested':False};(out/'spending-ui-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()

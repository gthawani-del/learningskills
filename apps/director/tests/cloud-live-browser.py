"""Opt-in live QA using existing Playwright infrastructure. No provider calls or real customer accounts.
Creates two labelled QA projects with synthetic PNG references; retains those records for inspection.
Credentials come from secure runtime bindings and are never written to reports/screenshots.
"""
import os,json,base64,datetime
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect

required=['DIRECTOR_QA_USER1_EMAIL','DIRECTOR_QA_USER1_PASSWORD','DIRECTOR_QA_USER2_EMAIL','DIRECTOR_QA_USER2_PASSWORD']
if os.environ.get('DIRECTOR_LIVE_QA')!='1':raise SystemExit('Live QA is opt-in. Set DIRECTOR_LIVE_QA=1 with designated test-account bindings.')
if any(not os.environ.get(k) for k in required):raise SystemExit('Live QA blocked: configure both designated test accounts through secure runtime bindings. Do not paste credentials in chat or source.')
if os.environ[required[0]].casefold()==os.environ[required[2]].casefold():raise SystemExit('Live QA needs two different designated accounts.')
site=os.environ.get('DIRECTOR_TEST_URL','https://learningskills.vercel.app').rstrip('/')
u=urlparse(site)
if u.scheme!='https' or u.username or u.password or u.query or u.fragment or u.path:raise SystemExit('Use an explicit HTTPS application origin.')
root=Path(__file__).resolve().parents[3];out=root/'test-results/cloud-live';out.mkdir(parents=True,exist_ok=True)
run=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
report={'site':site,'run':run,'passed':False,'paidCalls':0,'physicalMobileTested':False,'tlsValidation':'enabled','retainedQAProjects':[],'scope':'Real designated-account login, owner isolation, private media, logout and fresh-browser persistence. No password-recovery email, expiry or creative-output acceptance.'}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 contexts=[]
 def context():
  c=browser.new_context(base_url=site,viewport={'width':1440,'height':1000});contexts.append(c);return c
 def api(c,path,body=None,method=None):
  options={'headers':{'Origin':site}}
  if body is not None:options['data']=body
  return c.request.fetch(site+path,method=method or ('POST' if body is not None else 'GET'),**options)
 def login(c,index):
  r=api(c,'/api/auth/login',{'email':os.environ[f'DIRECTOR_QA_USER{index}_EMAIL'],'password':os.environ[f'DIRECTOR_QA_USER{index}_PASSWORD']})
  assert r.status==200,'Designated test-account login failed (HTTP '+str(r.status)+').'
  assert any(k['name']=='director_session' and k['httpOnly'] and k['secure'] for k in c.cookies()),'Expected secure HttpOnly session.'
 def new_project(c,label):
  r=api(c,'/api/projects',{'title':'[Director QA '+run+'] '+label,'premise':'Synthetic private-cloud persistence and isolation check.','format':'music_video'})
  assert r.status==201,'Could not create labelled QA project.'
  project=r.json()['project'];report['retainedQAProjects'].append(project['id'])
  r=api(c,f'/api/projects/{project["id"]}/assets',{'name':'qa-private-reference.png','mime':'image/png','role':'shot_reference','scope':'project','base64':base64.b64encode(png).decode()})
  assert r.status==201,'Could not save synthetic private reference.'
  return project,r.json()['asset']
 try:
  a=context();b=context();login(a,1);login(b,2)
  pa,aa=new_project(a,'Account A');pb,ab=new_project(b,'Account B')
  for c,own,foreign,foreign_asset in [(a,pa,pb,ab),(b,pb,pa,aa)]:
   r=api(c,'/api/projects');assert r.status==200
   ids=[x['id'] for x in r.json()['projects']];assert own['id'] in ids and foreign['id'] not in ids,'Account project listing isolation failed.'
   assert api(c,f'/api/projects/{foreign["id"]}').status==404,'Foreign project was readable.'
   assert api(c,f'/api/projects/{foreign["id"]}/assets/{foreign_asset["id"]}/content').status==404,'Foreign media was readable.'
   assert api(c,f'/api/projects/{foreign["id"]}',{'title':'Must not change','expectedVersion':foreign['version']},'PATCH').status==404,'Foreign project was editable.'
  anonymous=context();assert api(anonymous,f'/api/projects/{pa["id"]}/assets/{aa["id"]}/content').status==401,'Signed-out media was readable.'
  r=api(a,f'/api/projects/{pa["id"]}',{'title':pa['title']+' saved','duration':180,'expectedVersion':pa['version']},'PATCH');assert r.status==200
  fresh=context();login(fresh,1);r=api(fresh,f'/api/projects/{pa["id"]}');assert r.status==200
  saved=r.json()['project'];assert saved['title'].endswith(' saved') and saved['duration']==180,'Cloud project edits did not persist.'
  r=api(fresh,f'/api/projects/{pa["id"]}/assets/{aa["id"]}/content');assert r.status==200 and r.body()==png,'Private media did not survive a fresh browser session.'
  page=fresh.new_page();page.goto(site+'/#projects',wait_until='networkidle');expect(page.locator('body')).to_contain_text(saved['title']);page.reload(wait_until='networkidle');expect(page.locator('body')).to_contain_text(saved['title'])
  assert api(a,'/api/auth/logout',{}).status==200
  assert api(a,'/api/projects').status==401,'Logged-out context retained project access.'
  assert api(fresh,f'/api/projects/{pa["id"]}').status==200,'Current-context logout invalidated the separate browser unexpectedly.'
  report.update(passed=True,checks=['real login for two designated accounts','secure HttpOnly cookies','owner-scoped listing/read/edit','private reference isolation','signed-out media denial','saved project and private media in fresh browser','project visible after page reload','current-context logout'])
 except Exception as e:
  report['errorType']=type(e).__name__
  # Exceptions can contain URLs or browser state; report only their type, never credentials.
  if isinstance(e,AssertionError):report['failedCheck']=str(e)
 finally:
  (out/'results.json').write_text(json.dumps(report,indent=2))
  for c in contexts:
   try:c.close()
   except Exception:pass
  browser.close()
if not report['passed']:raise SystemExit('Live QA failed; see the credential-free test-results/cloud-live/results.json report.')
print(json.dumps(report))

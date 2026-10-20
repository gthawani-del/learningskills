"""Real Chromium, app/API and official TUS SDK; simulated Supabase transport, no cloud proof."""
import os,json,subprocess,io,wave,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[3];out=root/'test-results/media-ingestion';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','apps/director/tests/media-ingestion-fixture-server.mjs'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
sound=io.BytesIO()
with wave.open(sound,'wb') as f:
 f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000);f.writeframes(b'\0\0'*(7*1024*1024//2))
file=sound.getvalue();endpoint='https://fixture.storage.supabase.co/storage/v1/upload/resumable'
try:
 info=json.loads(server.stdout.readline());base='http://127.0.0.1:'+str(info['port']);checks=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in [(1440,1000),(390,844)]:
   context=browser.new_context(viewport={'width':width,'height':height});context.add_cookies([{'name':'director_session','value':info['session'],'url':base,'httpOnly':True,'sameSite':'Strict'}]);page=context.new_page();page.set_default_timeout(20000)
   page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+');')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)));transport={'offset':0,'resume':False,'posts':0,'heads':0,'bytes':bytearray()}
   page.request.post(base+'/__ingestion-fixture',data={'complete':False,'size':0})
   def tus(route):
    req=route.request;headers={'Access-Control-Allow-Origin':base,'Access-Control-Expose-Headers':'Location,Upload-Offset,Tus-Resumable,Upload-Length','Tus-Resumable':'1.0.0'}
    assert req.headers.get('x-signature')=='fixture-object-token'
    assert 'authorization' not in req.headers
    if req.method=='POST':
     transport['posts']+=1;data=req.post_data_buffer or b'';assert len(data)==6*1024*1024;transport['bytes'].extend(data);transport['offset']=len(data);headers.update({'Location':endpoint+'/test-'+str(width),'Upload-Offset':str(transport['offset'])});route.fulfill(status=201,headers=headers)
    elif req.method=='HEAD':
     transport['heads']+=1;headers.update({'Upload-Offset':str(transport['offset']),'Upload-Length':str(len(file))});route.fulfill(status=200,headers=headers)
    elif req.method=='PATCH':
     if not transport['resume']:route.fulfill(status=503,headers=headers);return
     assert int(req.headers['upload-offset'])==transport['offset'];data=req.post_data_buffer or b'';transport['bytes'].extend(data);transport['offset']+=len(data);headers['Upload-Offset']=str(transport['offset'])
     if transport['offset']==len(file):page.request.post(base+'/__ingestion-fixture',data={'complete':True,'size':len(file)})
     route.fulfill(status=204,headers=headers)
    else:raise AssertionError(req.method)
   page.route(endpoint+'**',tus)
   def open_upload():
    page.locator('#cast-upload').click();expect(page.locator('#upload-dialog')).to_be_visible()
   page.goto(base);open_upload();page.locator('#upload-file').set_input_files({'name':f'song-{width}.wav','mimeType':'audio/wav','buffer':file});page.locator('#upload-form button[type=submit]').click()
   page.wait_for_function('()=>Object.keys(localStorage).some(k=>k.startsWith("tus::"))');assert transport['offset']==6*1024*1024
   page.reload();open_upload();expect(page.locator('#source-upload-status')).to_contain_text('Transfer incomplete')
   assert 'fixture-object-token' not in page.evaluate('JSON.stringify(localStorage)')
   page.locator('#upload-file').set_input_files({'name':f'song-{width}.wav','mimeType':'audio/wav','buffer':file});transport['resume']=True
   page.locator('#source-upload-status').get_by_role('button',name='Resume',exact=True).last.click();expect(page.locator('#source-upload-status')).to_contain_text('Uploaded; inspection pending.')
   assert transport['posts']==1 and transport['heads']>=1,transport
   assert hashlib.sha256(transport['bytes']).hexdigest()==hashlib.sha256(file).hexdigest()
   fixture=page.request.get(base+'/__ingestion-fixture').json();assert fixture['assets']==0 and fixture['paidCalls']==0
   assert fixture['uploads'][-1]['status']=='inspection_pending'
   assert page.request.get(base+'/api/projects/'+info['projectId']+'/assets').json()['assets']==[]
   assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(out/f'pending-{width}.png'),full_page=True)
   # Cancel pending receipts before the next viewport; retain original source bytes.
   for r in fixture['uploads']:
    page.request.post(base+'/api/projects/'+info['projectId']+'/source-uploads/'+r['id']+'/cancel',data={})
   checks.append({'width':width,'reloadResumedWithHEAD':True,'creationRequests':transport['posts'],'byteIdentityVerified':True,'pendingNotAsset':True,'noStoredToken':True,'pageErrors':errors});context.close()
  # Simulated trusted inspection tests the real UI/API publication handoff.
  context=browser.new_context(viewport={'width':390,'height':844});context.add_cookies([{'name':'director_session','value':info['session'],'url':base}]);page=context.new_page();page.add_init_script('localStorage.setItem("director:lastProject",'+json.dumps(info['projectId'])+');');publication_errors=[];page.on('pageerror',lambda e:publication_errors.append(str(e)));page.goto(base)
  root=base+'/api/projects/'+info['projectId']+'/source-uploads'
  import uuid
  created=page.request.post(root,data={'requestId':str(uuid.uuid4()),'name':'inspected-master.wav','mime':'audio/wav','size':len(file),'sha256':hashlib.sha256(file).hexdigest(),'role':'master_song','scope':'project','shotId':None}).json()['upload']
  assert page.request.post(root+'/'+created['id']+'/complete',data={}).status==200
  page.request.post(base+'/__ingestion-fixture',data={'inspected':created['id']})
  page.locator('#cast-upload').click();page.locator('#source-upload-status').get_by_role('button',name='Check inspection',exact=True).click();expect(page.locator('#upload-dialog')).not_to_be_visible()
  assets=page.request.get(base+'/api/projects/'+info['projectId']+'/assets').json()['assets'];assert len(assets)==1 and assets[0]['name']=='inspected-master.wav' and assets[0]['sourceUploadId']==created['id']
  assert any(u['id']==created['id'] and u['ready'] for u in page.request.get(root).json()['uploads']);assert not publication_errors,publication_errors
  page.locator('#cast-upload').click();expect(page.locator('#source-upload-status')).to_contain_text('Available in your asset library.');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/'published-390.png'),full_page=True);context.close()
  browser.close();result={'scope':'Real Chromium/TUS SDK with local API and simulated storage/inspection; not live Supabase','checks':checks,'publicationUI':True,'paidCalls':0,'physicalMobileTested':False};(out/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
except Exception:
 if 'page' in globals():
  try: page.screenshot(path=str(out/'failure.png'),full_page=True);print(page.locator('body').inner_text()[:5000],flush=True)
  except Exception: pass
 raise
finally:
 server.terminate()
 try:server.wait(timeout=4)
 except subprocess.TimeoutExpired:server.kill();server.wait()

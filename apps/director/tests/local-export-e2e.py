"""Local-only HTTP proof using synthetic footage, never provider generation."""
import base64,json,os,socket,subprocess,tempfile,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[3]
with tempfile.TemporaryDirectory(prefix='director-http-proof-') as tmp:
 d=Path(tmp)
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 env={'PATH':os.environ['PATH'],'PORT':str(port),'DIRECTOR_DEMO':'1','DIRECTOR_LOCAL_RENDER':'1','DIRECTOR_DATA_FILE':str(d/'projects.json'),'DIRECTOR_ASSET_DIR':str(d/'assets')}
 proc=subprocess.Popen(['node','apps/director/server.mjs'],cwd=root,env=env,stdout=subprocess.DEVNULL)
 base=f'http://127.0.0.1:{port}'
 def request(path,body=None,method=None):
  req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=90) as r:
   raw=r.read();return json.loads(raw) if 'application/json' in r.headers.get('Content-Type','') else raw
 try:
  for _ in range(50):
   try:request('/api/config');break
   except OSError:time.sleep(.1)
  project=request('/api/projects',{'title':'Synthetic sound-preserving proof','premise':'Two colored shots with distinct tones.'})['project'];pid=project['id']
  clips=[]
  for i,hz in enumerate([440,880]):
   clip=d/f'clip{i}.mp4'
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',f'color=c={"green" if i==0 else "blue"}:s=160x90:r=24','-f','lavfi','-i',f'sine=frequency={hz}:sample_rate=48000','-t','2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',str(clip)],check=True)
   asset=request(f'/api/projects/{pid}/assets',{'name':clip.name,'mime':'video/mp4','role':'shot_reference','scope':'project','base64':base64.b64encode(clip.read_bytes()).decode()})['asset']
   clips.append({'id':f'shot-{i+1}','title':f'Sound {hz}','description':f'Synthetic {hz}Hz test clip','duration':2,'clipAssetId':asset['id']})
  project=request(f'/api/projects/{pid}',{'expectedVersion':project['version'],'duration':4,'shots':clips},'PATCH')['project']
  for shot in project['shots']:request(f'/api/projects/{pid}/approvals',{'artifactId':shot['id'],'version':shot['version'],'decision':'approved'})
  movie=d/'film.mp4';movie.write_bytes(request(f'/api/projects/{pid}/export',{}))
  info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',str(movie)]))
  assert abs(float(info['format']['duration'])-4)<.15
  assert {s['codec_type'] for s in info['streams']}=={'video','audio'}
  assert next(s for s in info['streams'] if s['codec_type']=='video')['width']==1280
  print('PASS: HTTP create → upload two real clips → save version → approve → export playable 4-second MP4 with audio.')
 finally:
  proc.terminate();proc.wait(timeout=10)

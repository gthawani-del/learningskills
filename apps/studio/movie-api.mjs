import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export function validateShots(shots){if(!Array.isArray(shots)||shots.length<1||shots.length>8)throw Object.assign(new Error('Use 1–8 scenes.'),{status:400});if(shots.some(s=>!s.prompt?.trim()||![4,8,12].includes(s.seconds)))throw Object.assign(new Error('Each scene needs a prompt and a duration of 4, 8 or 12 seconds.'),{status:400});if(shots.reduce((n,s)=>n+s.seconds,0)>60)throw Object.assign(new Error('Keep your short movie to 60 seconds or less.'),{status:400});return shots;}
export function createAPI({key=process.env.OPENAI_API_KEY,fetcher=fetch}={}){
 const creations=new Map();
 async function upstream(path,options={}){if(!key)throw Object.assign(new Error('Configure OPENAI_API_KEY on the server to enable generation.'),{status:503});const r=await fetcher(`https://api.openai.com/v1${path}`,{...options,headers:{Authorization:`Bearer ${key}`,...options.headers},signal:AbortSignal.timeout(120000)});if(!r.ok){let message='The media provider rejected the request.';try{message=(await r.json()).error?.message||message;}catch{}throw Object.assign(new Error(message),{status:502});}return r;}
 return async function api(req,res,path,body){const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(path==='/api/config'&&req.method==='GET')return json(200,{generation:!!key,model:'sora-2',storyboard:!!key});
 if(path==='/api/storyboard'&&req.method==='POST'){
 if(typeof body.premise!=='string'||body.premise.trim().length<10||body.premise.length>5000)throw Object.assign(new Error('Write a story premise between 10 and 5000 characters.'),{status:400});
 const schema={type:'object',additionalProperties:false,properties:{title:{type:'string'},continuity:{type:'string'},shots:{type:'array',minItems:3,maxItems:5,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},prompt:{type:'string'},seconds:{type:'integer',enum:[4,8,12]}},required:['title','prompt','seconds']}}},required:['title','continuity','shots']};
 const r=await upstream('/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_STORY_MODEL||'gpt-4.1-mini',input:[{role:'system',content:'Plan a coherent short movie of 12–60 seconds with a beginning, development and ending. Use 3–5 filmable scenes. Write detailed video prompts with subject, action, framing, camera motion and lighting. Keep the same characters, wardrobe and setting coherent. Include continuity notes. Do not include known copyrighted characters or real people.'},{role:'user',content:body.premise}],text:{format:{type:'json_schema',name:'short_movie',strict:true,schema}}})});
 const output=await r.json();const text=output.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');if(!text)throw new Error('No storyboard returned. Your existing scenes were kept.');const plan=JSON.parse(text);validateShots(plan.shots);return json(200,plan);}
 if(path==='/api/videos'&&req.method==='POST'){
 if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Object.assign(new Error('A unique scene request ID is required.'),{status:400});
 validateShots([{prompt:body.prompt,seconds:body.seconds}]);if(body.prompt.length>12000)throw Object.assign(new Error('Scene prompt is too long.'),{status:400});
 if(creations.has(body.requestId))return json(200,await creations.get(body.requestId));
 if(creations.size>=500)throw Object.assign(new Error('Local generation request limit reached. Restart the server after saving your work.'),{status:429});
 const form=new FormData();form.set('model','sora-2');form.set('prompt',body.prompt);form.set('seconds',String(body.seconds));form.set('size',body.ratio==='9:16'?'720x1280':'1280x720');
 const promise=upstream('/videos',{method:'POST',body:form}).then(r=>r.json());creations.set(body.requestId,promise);try{return json(200,await promise);}catch(e){creations.delete(body.requestId);throw e;}}
 const match=path.match(/^\/api\/videos\/(video_[a-zA-Z0-9_-]+)(\/content)?$/);
 if(match&&req.method==='GET'){const r=await upstream(`/videos/${match[1]}${match[2]||''}`);if(match[2]){res.writeHead(200,{'Content-Type':'video/mp4','Cache-Control':'no-store'});return res.end(Buffer.from(await r.arrayBuffer()));}return json(200,await r.json());}
 if(path==='/api/render'&&req.method==='POST'){
 const scenes=validateShots(body.scenes);if(scenes.some(s=>typeof s.base64!=='string'||s.base64.length>28_000_000||!/^[A-Za-z0-9+/=]+$/.test(s.base64)))throw Object.assign(new Error('Each scene must contain an uploaded video under 20 MB.'),{status:400});
 const dir=await mkdtemp(join(tmpdir(),'frame-movie-'));try{const size=body.ratio==='9:16'?'720:1280':'1280:720';for(let i=0;i<scenes.length;i++){await writeFile(join(dir,`source${i}`),Buffer.from(scenes[i].base64,'base64'));await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',join(dir,`source${i}`),'-map','0:v:0','-an','-vf',`scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=${scenes[i].seconds}`,'-t',String(scenes[i].seconds),'-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',join(dir,`scene${i}.mp4`)],{timeout:120000,maxBuffer:1024*1024});}
 await writeFile(join(dir,'list.txt'),scenes.map((_,i)=>`file 'scene${i}.mp4'`).join('\n'));
 await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','1','-i',join(dir,'list.txt'),'-c','copy','-movflags','+faststart',join(dir,'movie.mp4')],{timeout:120000});res.writeHead(200,{'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="short-movie.mp4"','Cache-Control':'no-store'});res.end(await readFile(join(dir,'movie.mp4')));}catch(e){throw Object.assign(new Error(e.code==='ENOENT'?'Install FFmpeg on the rendering server to assemble a movie.':'Could not assemble the clips. Check that every uploaded file is a playable video.'),{status:422});}finally{await rm(dir,{recursive:true,force:true});}return;}
 json(404,{error:'API route not found'});
 };}

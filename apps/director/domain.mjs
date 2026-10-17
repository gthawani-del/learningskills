import {randomUUID,createHash} from 'node:crypto';
export const stages=['brief','story','cast','storyboard','production','edit','export'];
export const skills=[
 ['storyboard','Plan a readable sequence of shots'],['character','Define identity and reference requirements'],['camera','Choose framing and motivated movement'],['lighting','Define coherent light and materials'],['continuity','Inspect scene state and dependencies'],['lip-sync','Plan approved audio and visible performance'],['fix-shot','Diagnose a scoped correction']
].map(([id,description])=>({id,name:id,description,version:'1',active:true,execution:false}));
export function fail(status,message){throw Object.assign(new Error(message),{status});}
export function canonicalJson(value){if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';return JSON.stringify(value);}
export const hash=value=>createHash('sha256').update(canonicalJson(value)).digest('hex');
export function text(value,name,max=10000){if(typeof value!=='string'||value.length>max)fail(400,`Invalid ${name}.`);return value;}
export function newProject(body,owner){
 const title=text(body.title||'Untitled film','title',200).trim();if(!title)fail(400,'A title is required.');
 if(!['short_film','music_video','advertisement'].includes(body.format||'short_film'))fail(400,'Invalid project format.');
 return {id:randomUUID(),ownerId:owner,title,premise:text(body.premise||'','premise'),format:body.format||'short_film',stage:'brief',duration:60,language:'English',direction:'',version:1,story:{treatment:'',scenes:[],version:1},shots:[],createdAt:new Date().toISOString()};
}
export function patchProject(previous,body){
 if(body.expectedVersion!==undefined&&body.expectedVersion!==previous.version)fail(409,'This project changed. Reopen it before saving your edit.');
 const next=structuredClone(previous);
 for(const key of ['title','premise','direction','language'])if(body[key]!==undefined)next[key]=text(body[key],key,key==='title'?200:10000);
 if(!next.title.trim())fail(400,'A title is required.');
 if(body.stage!==undefined){if(!stages.includes(body.stage))fail(400,'Invalid film stage.');next.stage=body.stage;}
 if(body.duration!==undefined){if(!Number.isFinite(body.duration)||body.duration<1||body.duration>3600)fail(400,'Runtime must be between 1 and 3600 seconds.');next.duration=body.duration;}
 if(body.story!==undefined){const s=body.story;if(!s||!Array.isArray(s.scenes)||s.scenes.length>200)fail(400,'Invalid scene list.');
 const content={treatment:text(s.treatment||'','treatment',40000),scenes:s.scenes.map(x=>({id:text(x.id,'scene ID',100),description:text(x.description||'','scene description',5000)}))};
 const old={treatment:previous.story.treatment,scenes:previous.story.scenes};next.story={...content,version:hash(old)===hash(content)?previous.story.version:previous.story.version+1};}
 if(body.shots!==undefined){if(!Array.isArray(body.shots)||body.shots.length>200)fail(400,'Invalid shot list.');const ids=new Set();
 next.shots=body.shots.map(s=>{if(!s||typeof s!=='object')fail(400,'Invalid shot.');const id=text(s.id,'shot ID',100);if(!id||ids.has(id))fail(400,'Shot IDs must be unique.');ids.add(id);
 const duration=Number(s.duration);if(!Number.isFinite(duration)||duration<=0||duration>900)fail(400,'Invalid shot duration.');
 const current=previous.shots.find(x=>x.id===id);const data={id,title:text(s.title||'Untitled shot','shot title',200),description:text(s.description||'','shot direction',12000),duration,framing:text(s.framing||'medium','framing',100),camera:text(s.camera||'static','camera',200),constraints:text(s.constraints||'','constraints',12000),clipAssetId:s.clipAssetId||null,sceneId:text(s.sceneId||'','scene ID',100),dialogue:text(s.dialogue||'','dialogue',5000),continuity:text(s.continuity||'','continuity',12000)};
 const comparable=x=>({id:x.id,title:x.title,description:x.description,duration:x.duration,framing:x.framing,camera:x.camera,constraints:x.constraints||'',clipAssetId:x.clipAssetId||null,sceneId:x.sceneId||'',dialogue:x.dialogue||'',continuity:x.continuity||''});
 const changed=!current||hash(comparable(current))!==hash(data);return {...data,version:current?current.version+(changed?1:0):1,status:changed?'draft':current.status||'draft'};});}
 next.version=previous.version+1;return next;
}
export function artifacts(project){return [
 {logical_key:'story',kind:'story',version:project.story.version,content:project.story},
 ...project.shots.map(s=>({logical_key:s.id,kind:'shot',version:s.version,content:s}))
].map(a=>({...a,content_hash:hash(a.content)}));}
export function proposalFor(project,body,assets){
 const instruction=text(body.instruction,'instruction',6000).trim();if(!instruction)fail(400,'Describe the requested change.');
 const shot=body.shotId?project.shots.find(s=>s.id===body.shotId):null;if(body.shotId&&!shot)fail(404,'Selected shot not found.');
 if(body.skillId&&!skills.some(s=>s.id===body.skillId))fail(400,'Unknown skill version.');
 const refs=body.referenceIds||[];if(!Array.isArray(refs)||refs.length>12||refs.some(id=>!assets.some(a=>a.id===id)))fail(400,'A reference is unavailable or too many were selected.');
 return {id:randomUUID(),shotId:shot?.id||null,artifactVersion:shot?.version||project.version,instruction,skillId:body.skillId||null,referenceIds:refs,summary:`Requested direction: ${instruction}\nScope: ${shot?shot.title+' · v'+shot.version:'whole project'}. No media has been generated. Approve the relevant references and storyboard; a validated route and current quote are required before generation.`,status:'needs_route_and_quote',estimate:null,canAuthorize:false};
}

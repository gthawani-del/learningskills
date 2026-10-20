import {isProjectFormat} from './public/studio-catalog.js';
import {sceneChanged,briefChanged} from './public/revision-impact.js';
import {briefArtifact} from './public/creative-brief-core.js';
import {screenplayArtifact} from './public/screenplay-core.js';
import {departmentPlanArtifacts} from './public/department-plan-core.js';
import {storyboardHandoffArtifacts,assertStoryboardShotProjection} from './public/storyboard-handoff-core.js';
import {referenceProductionArtifacts} from './public/reference-production-core.js';
import {storyboardProductionArtifacts} from './public/storyboard-production-core.js';
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
 if(!isProjectFormat(body.format||'short_film'))fail(400,'Invalid project format.');
 return {id:randomUUID(),ownerId:owner,title,premise:text(body.premise||'','premise'),format:body.format||'short_film',briefExplicitFields:['premise',...(body.format?['format']:[])],stage:'brief',duration:60,language:'English',direction:'',version:1,story:{treatment:'',scenes:[],version:1},shots:[],production:{records:[]},createdAt:new Date().toISOString()};
}
export function patchProject(previous,body){
 if(Object.hasOwn(body,'screenplay'))fail(400,'Use the screenplay editor to change scripts, sources or review records.');
 if(Object.hasOwn(body,'departmentPlanning'))fail(400,'Use the department planner to change plans and their version history.');
 if(Object.hasOwn(body,'storyboardHandoff'))fail(400,'Use the shot-plan editor to change storyboard contracts and their version history.');
 if(Object.hasOwn(body,'referenceProduction'))fail(400,'Use the reference workspace to change reference directions, candidates and selections.');
 if(Object.hasOwn(body,'storyboardProduction'))fail(400,'Use storyboard production to change frame directions, reference bindings and selected images.');
 if(previous.screenplay?.currentVersion&&body.story!==undefined)fail(409,'Edit the current screenplay to update its treatment and scenes.');
 if(body.expectedVersion!==undefined&&body.expectedVersion!==previous.version)fail(409,'This project changed. Reopen it before saving your edit.');
 const next=structuredClone(previous);
 for(const key of ['title','premise','direction','language'])if(body[key]!==undefined)next[key]=text(body[key],key,key==='title'?200:10000);
 if(!next.title.trim())fail(400,'A title is required.');
 if(body.format!==undefined){if(!isProjectFormat(body.format))fail(400,'Invalid project format.');next.format=body.format;}
 if(body.stage!==undefined){if(!stages.includes(body.stage))fail(400,'Invalid film stage.');next.stage=body.stage;}
 if(body.duration!==undefined){if(!Number.isFinite(body.duration)||body.duration<1||body.duration>3600)fail(400,'Runtime must be between 1 and 3600 seconds.');next.duration=body.duration;}
 if(body.story!==undefined){const s=body.story;if(!s||!Array.isArray(s.scenes)||s.scenes.length>200)fail(400,'Invalid scene list.');
 const content={treatment:text(s.treatment||'','treatment',40000),scenes:s.scenes.map(x=>{if(!x||typeof x!=='object'||Array.isArray(x))fail(400,'Invalid scene.');return {id:text(x.id,'scene ID',100),description:text(x.description||'','scene description',5000)};})};
 const sceneIds=content.scenes.map(s=>s.id);if(sceneIds.some(id=>!id.trim())||new Set(sceneIds).size!==sceneIds.length)fail(400,'Scene IDs must be nonempty and unique.');
 const old={treatment:previous.story.treatment,scenes:previous.story.scenes};next.story={...content,version:hash(old)===hash(content)?previous.story.version:previous.story.version+1};}
 if(body.shots!==undefined){if(!Array.isArray(body.shots)||body.shots.length>200)fail(400,'Invalid shot list.');const ids=new Set();
 next.shots=body.shots.map(s=>{if(!s||typeof s!=='object')fail(400,'Invalid shot.');const id=text(s.id,'shot ID',100);if(!id||ids.has(id))fail(400,'Shot IDs must be unique.');ids.add(id);
 const duration=Number(s.duration);if(!Number.isFinite(duration)||duration<=0||duration>900)fail(400,'Invalid shot duration.');
 const current=previous.shots.find(x=>x.id===id);const bindings=s.productionBindings??current?.productionBindings??[];
 if(!Array.isArray(bindings)||bindings.length>100||new Set(bindings.map(b=>b?.recordId)).size!==bindings.length)fail(400,'Invalid production bindings.');
 const productionBindings=bindings.map(b=>{const record=next.production?.records?.find(r=>r.id===b?.recordId);if(!record||!Number.isSafeInteger(b.version)||!record.versions.some(v=>v.version===b.version))fail(400,'A production binding is unavailable.');return {recordId:b.recordId,version:b.version};}).sort((a,b)=>a.recordId.localeCompare(b.recordId));
 const data={productionBindings,id,title:text(s.title||'Untitled shot','shot title',200),description:text(s.description||'','shot direction',12000),duration,framing:text(s.framing||'medium','framing',previous.storyboardHandoff?200:100),camera:text(s.camera||'static','camera',previous.storyboardHandoff?2000:200),constraints:text(s.constraints||'','constraints',previous.storyboardHandoff?60000:12000),clipAssetId:s.clipAssetId||null,referenceAssetId:s.referenceAssetId||null,sceneId:text(s.sceneId||'','scene ID',100),dialogue:text(s.dialogue||'','dialogue',previous.storyboardHandoff?100000:5000),continuity:text(s.continuity||'','continuity',12000)};
 const comparable=x=>{const {version,status,...content}=x;return content;};
 const dependencyChanged=current&&sceneChanged(previous,next,current.sceneId,data.sceneId);
 const changed=!current||hash(comparable(current))!==hash(data)||dependencyChanged;return {...data,version:current?current.version+(changed?1:0):1,status:changed?'draft':current.status||'draft'};});}
 // A scene edit invalidates only shots explicitly linked to that scene. Existing media stays intact.
 if(body.shots===undefined&&body.story!==undefined)next.shots=next.shots.map(s=>sceneChanged(previous,next,s.sceneId)?{...s,version:s.version+1,status:'draft'}:s);
 if(briefChanged(previous,next)&&next.story.version===previous.story.version)next.story={...next.story,version:previous.story.version+1};
 const explicit=new Set(previous.briefExplicitFields||[]);for(const key of ['premise','direction','language','duration','format'])if(body[key]!==undefined&&body[key]!==previous[key])explicit.add(key);next.briefExplicitFields=[...explicit].sort();
 if(next.storyboardHandoff)assertStoryboardShotProjection(next);
 next.version=previous.version+1;return next;
}
export function artifacts(project){return [
 ...(briefArtifact(project)?[briefArtifact(project)]:[]),
 ...(screenplayArtifact(project)?[screenplayArtifact(project)]:[]),
 ...departmentPlanArtifacts(project),
 ...storyboardHandoffArtifacts(project),
 ...referenceProductionArtifacts(project),
 ...storyboardProductionArtifacts(project),
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

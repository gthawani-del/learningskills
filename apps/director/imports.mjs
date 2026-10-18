import {normalizeProductionArchive} from './production-records.mjs';
import {newProject,patchProject,hash,text,fail} from './domain.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles=new Set(['character_identity','wardrobe','location','visual_style','prop','shot_reference','master_song','dialogue','script','voice_reference','ambience']);
export function stableImportId(value){const h=hash(value).slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20)}`;}
function normalize(body,owner){
 if(!body||typeof body.sourceId!=='string'||!body.sourceId.startsWith('device-')||!uuid.test(body.sourceId.slice(7))||!Array.isArray(body.assets)||body.assets.length>100)fail(400,'Choose a valid device draft with up to 100 references.');
 const source=body.project;if(!source||typeof source!=='object'||Array.isArray(source))fail(400,'Invalid draft document.');
 const base=newProject({title:source.title,premise:source.premise,format:source.format},owner);
 if(!Array.isArray(source.shots||[])||(source.shots||[]).some(s=>!s||typeof s!=='object'))fail(400,'Invalid shot list.');
 const shots=(source.shots||[]).map(({clipAssetId,referenceAssetId,productionBindings,...s})=>s);
 const project=patchProject(base,{title:source.title,premise:source.premise,duration:source.duration,language:source.language,direction:source.direction,stage:source.stage,story:source.story,shots});
 if(!Array.isArray(source.notes||[])||(source.notes||[]).length>200)fail(400,'Invalid direction notes.');
 project.notes=(source.notes||[]).map(n=>{if(!n||typeof n!=='object')fail(400,'Invalid direction note.');return {role:'You',text:text(n.text,'direction note',6000)};});
 const seen=new Set();const assets=body.assets.map(a=>{
 if(!a||!uuid.test(a.id)||seen.has(a.id)||!roles.has(a.role)||!['project','shot'].includes(a.scope)||!Number.isSafeInteger(a.size)||a.size<1||a.size>2097152||!/^[a-f0-9]{64}$/.test(a.checksum||''))fail(400,'Invalid reference manifest.');
 seen.add(a.id);if(a.scope==='shot'&&!project.shots.some(s=>s.id===a.shotId))fail(400,'A reference points to a missing shot.');
 return {sourceId:a.id,name:text(a.name,'reference name',240),mime:text(a.mime,'reference type',100),role:a.role,scope:a.scope,shotId:a.scope==='shot'?a.shotId:null,size:a.size,checksum:a.checksum};
 }).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 const productionArchive=normalizeProductionArchive(source.production,body.sourceId,assets.map(a=>({...a,id:a.sourceId,projectId:body.sourceId,version:1})));
 const links=(source.shots||[]).map(s=>{const bindings=s.productionBindings||[];if(!Array.isArray(bindings)||bindings.length>100||new Set(bindings.map(b=>b?.recordId)).size!==bindings.length||bindings.some(b=>!productionArchive.records.some(r=>r.id===b?.recordId&&r.versions.some(v=>v.version===b.version))))fail(400,'A library binding is missing from this draft.');return {shotId:s.id,clip:s.clipAssetId||null,image:s.referenceAssetId||null,bindings};});
 for(const l of links)for(const [key,mime]of [['clip','video/'],['image','image/']])if(l[key]&&!assets.some(a=>a.sourceId===l[key]&&a.mime.startsWith(mime)))fail(400,'A selected reference is missing from this draft.');
 const content={title:project.title,premise:project.premise,format:project.format,duration:project.duration,language:project.language,direction:project.direction,stage:project.stage,story:project.story,shots:project.shots.map(({productionBindings,...s})=>productionBindings?.length?{...s,productionBindings}:s),notes:project.notes,assets,links:links.map(({bindings,...l})=>bindings?.length?{...l,bindings}:l),...(productionArchive.records.length?{productionArchive}:{})};
 const fingerprint=hash(content);project.id=stableImportId({owner,sourceId:body.sourceId,fingerprint});project.version=1;
 project.importState={sourceId:body.sourceId,fingerprint,status:'awaiting_media',assets,links,productionArchive};
 return project;
}
const same=(a,b)=>a?.importState?.fingerprint===b?.importState?.fingerprint;
export function createImportController({store,storage}){
 async function existing(id,owner){try{return await store.get(id,owner);}catch(error){if(error.status!==404)throw error;return null;}}
 async function start(owner,body){
 const candidate=normalize(body,owner);let current=await existing(candidate.id,owner);
 if(!current)try{current=await store.create(candidate);}catch(error){if(error.status!==409)throw error;current=await existing(candidate.id,owner);if(!current)throw error;}
 if(!same(current,candidate))fail(409,'This import identity conflicts with a different document.');
 // Snapshot the initial artifacts using the existing atomic project-save transaction.
 if(current.version===1){const next={...current,version:2};try{current=await store.save(next,1);}catch(error){if(error.status!==409)throw error;current=await store.get(current.id,owner);if(!same(current,candidate)||current.version<2)throw error;}}
 return current;
 }
 async function upload(owner,projectId,sourceId,{bytes,mime}){
 const project=await store.get(projectId,owner);const manifest=project.importState?.assets?.find(a=>a.sourceId===sourceId);if(!manifest)fail(404,'Reference is not part of this import.');
 const checksum=hash(bytes.toString('base64'));if(checksum!==manifest.checksum||bytes.length!==manifest.size||mime!==manifest.mime)fail(409,'Reference content changed. Start a new draft copy instead of overwriting this import.');
 const id=stableImportId({projectId,sourceId}),key=`${owner}/${projectId}/${id}`;
 const previous=(await store.records('assets',projectId)).find(a=>a.id===id);
 if(previous){if(previous.checksum!==checksum)fail(409,'Imported reference content conflicts.');return previous;}
 if(project.importState.status!=='awaiting_media')fail(409,'This import is already complete.');
 await storage.putIfAbsent(key,bytes,mime,checksum);
 const asset={id,projectId,sourceAssetId:sourceId,name:manifest.name,mime,role:manifest.role,scope:manifest.scope,shotId:manifest.shotId,version:1,storageKey:key,size:bytes.length,checksum};
 try{return await store.add('assets',asset);}catch(error){if(error.status!==409)throw error;const recovered=(await store.records('assets',projectId)).find(a=>a.id===id&&a.checksum===checksum);if(!recovered)throw error;return recovered;}
 }
 async function complete(owner,id){
 const project=await store.get(id,owner),state=project.importState;if(!state)fail(409,'This project is not an imported draft.');if(state.status==='ready')return project;
 if(project.version!==2)fail(409,'The cloud copy was edited before its import finished. Keep this device draft and review the cloud copy.');
 const assets=await store.records('assets',id),mapping=new Map();
 for(const a of state.assets){const expectedId=stableImportId({projectId:id,sourceId:a.sourceId});if(!assets.some(x=>x.id===expectedId&&x.sourceAssetId===a.sourceId&&x.checksum===a.checksum))fail(409,'Some references are still pending. Resume saving this device draft.');mapping.set(a.sourceId,expectedId);}
 const archive=structuredClone(state.productionArchive||{records:[]});for(const record of archive.records)for(const version of record.versions)version.references=version.references.map(r=>({...r,assetId:mapping.get(r.assetId)}));
 const production=normalizeProductionArchive(archive,id,assets);
 const shots=project.shots.map(s=>{const link=state.links.find(l=>l.shotId===s.id);return {...s,clipAssetId:mapping.get(link?.clip)||null,referenceAssetId:mapping.get(link?.image)||null,productionBindings:link?.bindings||[]};});
 const next={...patchProject({...project,production},{expectedVersion:2,shots}),importState:{...state,status:'ready',completedAt:new Date().toISOString()}};
 try{return await store.save(next,2);}catch(error){if(error.status!==409)throw error;const recovered=await store.get(id,owner);if(recovered.importState?.status!=='ready'||!same(recovered,project))throw error;return recovered;}
 }
 return {start,upload,complete};
}

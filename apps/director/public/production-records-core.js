const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const types=new Set(['character','voice','location','wardrobe','prop','audio','take','edit']);
const forbidden=new Set(['ownerId','owner_id','projectId','project_id','approved','accepted','acceptance','quality','qualityValidated','quality_validated','generationAuthorized','model','modelId','budget','spend','authorization','status','executionTested','execution_tested','rightsVerified','rights_verified','routeActive','price','cost','billing']);
const textLimits={character:12000,voice:12000,location:10000,wardrobe:8000,prop:8000,audio:24000,take:16000,edit:32000};
function contentValue(value,type,depth=0,preserveText=false){
 if(depth>6)fail(400,'Production content is too deeply nested.');
 if(typeof value==='string'){if(value.length>textLimits[type])fail(400,'Production content is too long.');return preserveText?value:value.trim();}
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))fail(400,'Production numbers must be finite.');return value;}
 if(Array.isArray(value)){if(value.length>200)fail(400,'Production content list is too long.');return value.map(x=>contentValue(x,type,depth+1,preserveText));}
 if(value&&typeof value==='object'){const entries=Object.entries(value);if(entries.length>60)fail(400,'Too many production content fields.');return Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>{if(!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(k)||forbidden.has(k))fail(400,'Production content cannot grant ownership, acceptance or spending permissions.');return [k,contentValue(v,type,depth+1,preserveText||depth===0&&type==='edit'&&value.kind==='song_intelligence_v1')];}));}
 fail(400,'Invalid production content value.');
}
const current=r=>r.versions.find(v=>v.version===r.currentVersion);
function recordsOf(p){return p.production?.records||[];}
function dependentClosure(records,ids){const closure=new Set(ids);let changed=true;while(changed){changed=false;for(const r of records)if(!closure.has(r.id)&&current(r).dependencies.some(d=>closure.has(d.recordId))){closure.add(r.id);changed=true;}}return closure;}
function compatible(type,mime){if(['character','location','wardrobe','prop'].includes(type))return mime.startsWith('image/');if(['voice','audio'].includes(type))return mime.startsWith('audio/');if(type==='take')return mime.startsWith('video/')||mime.startsWith('audio/');return mime.startsWith('video/')||mime.startsWith('audio/')||mime.startsWith('image/');}
function links(value,key){if(!Array.isArray(value)||value.length>100)fail(400,'Invalid production references or dependencies.');const seen=new Set();return value.map(x=>{if(!x||typeof x!=='object'||!uuid.test(x[key])||!Number.isSafeInteger(x.version)||x.version<1||seen.has(x[key]))fail(400,'Production links require unique IDs and positive versions.');seen.add(x[key]);return {[key]:x[key],version:x.version};}).sort((a,b)=>a[key].localeCompare(b[key]));}
function checkCycles(records){const visiting=new Set(),done=new Set(),byId=new Map(records.map(r=>[r.id,r]));function visit(id){if(visiting.has(id))fail(400,'Production dependencies cannot contain a cycle.');if(done.has(id))return;visiting.add(id);for(const d of current(byId.get(id)).dependencies)visit(d.recordId);visiting.delete(id);done.add(id);}for(const r of records)visit(r.id);}
export function applyProductionRecord(project,command,assets){
 if(!command||typeof command!=='object'||Array.isArray(command))fail(400,'Invalid production record command.');
 if(command.expectedVersion!==project.version)fail(409,'This project changed. Reopen it before saving the production record.');
 const allowed=new Set(['expectedVersion','id','type','name','content','references','dependencies']);if(Object.keys(command).some(k=>!allowed.has(k)))fail(400,'Unsupported production record command field.');
 const records=recordsOf(project);if(records.length>=200&&!command.id)fail(400,'Production record limit reached.');
 if(command.id!==undefined&&!uuid.test(command.id))fail(400,'Invalid production record ID.');
 const existing=command.id?records.find(r=>r.id===command.id):null;
 if(command.id&&(!uuid.test(command.id)||!existing))fail(404,'Production record not found in this project.');
 const type=command.type??existing?.type;if(!types.has(type)||existing&&existing.type!==type)fail(400,'Invalid or changed production record type.');
 const name=command.name??existing?.name;if(typeof name!=='string'||!name.trim()||name.length>200)fail(400,'A production record name is required.');
 const previous=existing&&current(existing);const content=contentValue(command.content===undefined?(previous?.content??{}):command.content,type);if(!content||Array.isArray(content)||typeof content!=='object'||JSON.stringify(content).length>textLimits[type])fail(400,'Production content must be a bounded object.');
 const references=links(command.references??previous?.references??[],'assetId');
 for(const ref of references){const a=assets.find(a=>a.id===ref.assetId&&a.projectId===project.id&&a.version===ref.version);if(!a||typeof a.mime!=='string'||!compatible(type,a.mime))fail(400,'Reference must match a project asset version and the production record media type.');}
 const dependencies=links(command.dependencies??previous?.dependencies??[],'recordId');
 for(const dep of dependencies){const r=records.find(r=>r.id===dep.recordId);if(dep.recordId===existing?.id||!r||!r.versions.some(v=>v.version===dep.version))fail(400,'Dependency must reference another existing project record version.');}
 const normalized={name:name.trim(),content,references,dependencies};
 if(existing&&canonical(normalized)===canonical({name:previous.name??existing.name,content:previous.content,references:previous.references,dependencies:previous.dependencies}))return structuredClone(project);
 const next=structuredClone(project),list=recordsOf(next);next.production={...next.production,records:list};
 const id=existing?.id||globalThis.crypto.randomUUID(),version=(existing?.currentVersion||0)+1;
 if(version>100)fail(400,'Production record version limit reached.');
 const snapshot={version,name:normalized.name,content,references,dependencies,createdAt:new Date().toISOString()};
 if(existing){const target=list.find(r=>r.id===id);target.name=normalized.name;target.currentVersion=version;target.versions.push(snapshot);}else list.push({id,type,name:normalized.name,currentVersion:version,versions:[snapshot]});
 checkCycles(list);
 if(existing){const affected=dependentClosure(list,[id]);next.shots=(next.shots||[]).map(s=>(s.productionBindings||[]).some(b=>affected.has(b.recordId))?{...s,version:s.version+1,status:'draft'}:s);}
 next.version=project.version+1;return next;
}
export function recordDependencies(project){
 const records=recordsOf(project),byId=new Map(records.map(r=>[r.id,r]));
 const stale=d=>!byId.has(d.recordId)||byId.get(d.recordId).currentVersion!==d.version;
 const direct=records.filter(r=>current(r).dependencies.some(stale)).map(r=>r.id),held=dependentClosure(records,direct);
 return {projectId:project.id,generationAuthorized:false,records:records.map(r=>({recordId:r.id,version:r.currentVersion,dependencies:structuredClone(current(r).dependencies),staleDependencies:structuredClone(current(r).dependencies.filter(stale)),holds:held.has(r.id)?['Dependency versions require review.']:[]})),shots:(project.shots||[]).map(s=>({shotId:s.id,staleBindings:structuredClone((s.productionBindings||[]).filter(stale)),holds:(s.productionBindings||[]).some(b=>stale(b)||held.has(b.recordId))?['Production bindings require review.']:[]}))};
}
export function recordSnapshots(project){return recordsOf(project).map(r=>{const snapshot=current(r),content={recordId:r.id,type:r.type,name:snapshot.name??r.name,...structuredClone(snapshot)};return {logical_key:'record:'+r.id,kind:r.type,version:r.currentVersion,content};});}

// Device archives carry creative data only. Project ownership, approvals, route eligibility
// and spending authority must be established separately by the receiving application.
export function normalizeProductionArchive(production,projectId,assets){
 if(production===undefined||production===null)return {records:[]};
 if(!production||typeof production!=='object'||Array.isArray(production)||!Array.isArray(production.records)||production.records.length>200)fail(400,'Invalid production archive.');
 if(!Array.isArray(assets)||typeof projectId!=='string'||!projectId)fail(400,'Production archive requires scoped reference metadata.');
 const ids=new Set();
 const records=production.records.map(r=>{
 if(!r||typeof r!=='object'||Array.isArray(r)||!uuid.test(r.id)||ids.has(r.id)||!types.has(r.type))fail(400,'Archive records require unique IDs and allowed types.');ids.add(r.id);
 if(typeof r.name!=='string'||!r.name.trim()||r.name.length>200||!Array.isArray(r.versions)||r.versions.length<1||r.versions.length>100||r.currentVersion!==r.versions.length)fail(400,'Invalid production archive history.');
 const versions=r.versions.map((v,i)=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==i+1||typeof v.name!=='string'||!v.name.trim()||v.name.length>200)fail(400,'Archive versions must be contiguous and named.');
 if(typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||new Date(v.createdAt).toISOString()!==v.createdAt)fail(400,'Archive timestamps must be canonical ISO dates.');
 const content=contentValue(v.content,r.type);if(!content||Array.isArray(content)||typeof content!=='object'||JSON.stringify(content).length>textLimits[r.type])fail(400,'Production content must be a bounded object.');
 const references=links(v.references,'assetId'),dependencies=links(v.dependencies,'recordId');
 for(const ref of references){const a=assets.find(a=>a.id===ref.assetId&&a.projectId===projectId&&a.version===ref.version);if(!a||typeof a.mime!=='string'||!compatible(r.type,a.mime))fail(400,'Reference must match a project asset version and the production record media type.');}
 return {version:i+1,name:v.name.trim(),content,references,dependencies,createdAt:v.createdAt};
 });
 if(r.name.trim()!==versions.at(-1).name)fail(400,'Archive current name does not match its latest version.');
 return {id:r.id,type:r.type,name:r.name.trim(),currentVersion:versions.length,versions};
 });
 const byId=new Map(records.map(r=>[r.id,r]));
 for(const r of records)for(const v of r.versions)for(const d of v.dependencies){const target=byId.get(d.recordId);if(d.recordId===r.id||!target||!target.versions.some(v=>v.version===d.version))fail(400,'Archive dependency must match another record version.');}
 checkCycles(records);
 return {records};
}

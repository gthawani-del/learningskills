import {recordArtifacts,recordDependencies} from './production-records.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail,artifacts} from './domain.mjs';
const snapshots=project=>[...artifacts(project),...recordArtifacts(project)];

export class LocalStore {
 constructor(file){this.file=file;this.state={projects:[],assets:[],approvals:[],proposals:[],jobs:[],audit:[]};this.tail=Promise.resolve();}
 async init(){if(this.file)try{this.state=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 async serial(fn){const run=this.tail.then(async()=>{const result=await fn();if(this.file){await mkdir(dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(this.state),{mode:0o600});await rename(temp,this.file);}return structuredClone(result);});this.tail=run.catch(()=>{});return run;}
 async list(owner){return structuredClone(this.state.projects.filter(p=>p.ownerId===owner));}
 async get(id,owner){const p=this.state.projects.find(p=>p.id===id&&p.ownerId===owner);if(!p)fail(404,'Project not found.');return structuredClone(p);}
 async create(p){return this.serial(()=>{if(this.state.projects.some(x=>x.id===p.id))fail(409,'Project already exists.');this.state.projects.push(p);return p;});}
 async save(p,expected){return this.serial(()=>{const n=this.state.projects.findIndex(x=>x.id===p.id&&x.ownerId===p.ownerId);if(n<0)fail(404,'Project not found.');if(this.state.projects[n].version!==expected)fail(409,'Project changed. Reopen it before saving.');this.state.projects[n]=p;return p;});}
 async records(kind,projectId){return structuredClone(this.state[kind].filter(x=>x.projectId===projectId));}
 async add(kind,value){return this.serial(()=>{if(value.id&&this.state[kind].some(x=>x.id===value.id))fail(409,'Record already exists.');this.state[kind].push(value);return value;});}
 async approve(project,body,owner){return this.serial(()=>{
 const current=this.state.projects.find(p=>p.id===project.id&&p.ownerId===owner);if(!current)fail(404,'Project not found.');
 const a=snapshots(current).find(a=>a.logical_key===body.artifactId&&a.version===body.version);if(!a)fail(409,'That artifact version is no longer current.');
 const graph=recordDependencies(current);const holds=a.logical_key.startsWith('record:')?graph.records.find(r=>'record:'+r.recordId===a.logical_key)?.holds:graph.shots.find(s=>s.shotId===a.logical_key)?.holds;if(body.decision==='approved'&&holds?.length)fail(409,'Update the linked production versions before approval.');
 if(body.decision==='approved'&&a.kind==='story'&&!a.content.treatment.trim())fail(400,'Write a treatment before approving it.');if(body.decision==='approved'&&a.kind==='shot'&&!a.content.description.trim())fail(400,'Write the shot direction before approval.');
 const approval={id:randomUUID(),projectId:current.id,artifactId:body.artifactId,version:body.version,decision:body.decision,actorId:owner,createdAt:new Date().toISOString()};this.state.approvals.push(approval);return approval;
 });}

}

export class SupabaseStore {
 constructor({url,key,fetcher=fetch}){this.url=url.replace(/\/$/,'');this.key=key;this.fetcher=fetcher;}
 async request(path,{method='GET',body,token,headers={}}={}){
 const r=await this.fetcher(this.url+path,{method,headers:{apikey:this.key,Authorization:`Bearer ${token||this.key}`,'Content-Type':'application/json',Prefer:'return=representation',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!r.ok){if(r.status===401)fail(401,'Sign in again to continue.');let detail;try{detail=await r.json();}catch{}if(/project_version_conflict|immutable_artifact_conflict/.test(detail?.message||''))fail(409,'This version changed. Reopen the project before saving.');if(/authorization_invalid|artifact_superseded|artifact_not_approved|route_not_eligible|attempt_limit|work_unit_in_flight|idempotency_conflict|budget_exceeded|project_budget_exceeded/.test(detail?.message||''))fail(409,'Production is held: review the current approval, quote, budget and attempt status before retrying.');if(path.includes('grant_type=refresh_token')&&(r.status===400||r.status===403))fail(401,'Your session ended. Sign in again; your draft is preserved.');if(path.startsWith('/auth/v1/token')&&(r.status===400||r.status===401))fail(401,'Sign-in failed. Check your email and password.');fail(r.status===409?409:502,'The workspace service could not finish this operation. Your draft is preserved.');}
 return r.status===204?null:r.json();}
 async user(token){if(!token)return null;try{return await this.request('/auth/v1/user',{token});}catch(e){if(e.status===401)return null;throw e;}}
 async allRows(path){const rows=[];let offset=0;while(offset<50000){const page=await this.request(`${path}&limit=200&offset=${offset}`);if(!Array.isArray(page))fail(502,'Invalid workspace history response.');if(!page.length)return rows;rows.push(...page);offset+=page.length;}fail(503,'Workspace history is too large to review safely. No approval decision was inferred.');}
 async refresh(refreshToken){return this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}});}
 async login(email,password){return this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});}
 project(row){return {...row.brief,id:row.id,ownerId:row.owner_id,title:row.title,stage:row.stage};}
 async list(owner){return (await this.request(`/rest/v1/director_projects?owner_id=eq.${owner}&order=created_at.desc`)).map(r=>this.project(r));}
 async get(id,owner){const rows=await this.request(`/rest/v1/director_projects?id=eq.${id}&owner_id=eq.${owner}`);if(!rows.length)fail(404,'Project not found.');return this.project(rows[0]);}
 async create(p){const rows=await this.request('/rest/v1/director_projects',{method:'POST',body:{id:p.id,owner_id:p.ownerId,title:p.title,stage:p.stage,brief:p}});return this.project(rows[0]);}
 async save(p,expected){await this.request('/rest/v1/rpc/director_save_project',{method:'POST',body:{p_actor_id:p.ownerId,p_project_id:p.id,p_expected_version:expected,p_document:p,p_artifacts:snapshots(p)}});return p;}
 async records(kind,projectId){const tables={assets:'director_assets',approvals:'director_approvals',jobs:'director_jobs',proposals:'director_proposals',audit:'director_audit_events'};if(!tables[kind])fail(400,'Unknown record type.');const path=`/rest/v1/${tables[kind]}?project_id=eq.${projectId}`;const rows=kind==='approvals'?await this.allRows(path+'&order=ordinal.asc'):await this.request(path);
 if(kind==='approvals'){const artifacts=await this.allRows(`/rest/v1/director_artifacts?project_id=eq.${projectId}&select=id,logical_key,version&order=id.asc`);return rows.map(r=>{const a=artifacts.find(a=>a.id===r.artifact_id);return {...r,projectId:r.project_id,artifactId:a?.logical_key||null,version:a?.version,actorId:r.actor_id,createdAt:r.created_at};});}
 return rows.map(r=>kind==='assets'?{...r.metadata,id:r.id,projectId:r.project_id}:r);}
 async add(kind,value){if(kind==='assets'){const r=await this.request('/rest/v1/director_assets',{method:'POST',body:{id:value.id,project_id:value.projectId,kind:value.mime,storage_key:value.storageKey,metadata:value,rights_evidence:{status:'user-supplied-unverified'}}});return {...r[0].metadata,id:r[0].id};}
 if(kind==='audit'){return this.request('/rest/v1/director_audit_events',{method:'POST',body:{project_id:value.projectId,actor_id:value.actorId,event_type:value.type,details:value.details}});}
 fail(503,'This record requires a verified route and quote.');}
 async approve(project,body,owner){const a=snapshots(project).find(a=>a.logical_key===body.artifactId&&a.version===body.version);if(!a)fail(409,'That artifact version is no longer current.');
 const graph=recordDependencies(project);const holds=a.logical_key.startsWith('record:')?graph.records.find(r=>'record:'+r.recordId===a.logical_key)?.holds:graph.shots.find(s=>s.shotId===a.logical_key)?.holds;if(body.decision==='approved'&&holds?.length)fail(409,'Update the linked production versions before approval.');
 if(body.decision==='approved'&&(a.kind==='story'&&!a.content.treatment.trim()||a.kind==='shot'&&!a.content.description.trim()))fail(400,'Complete the artifact before approving it.');
 const rows=await this.request(`/rest/v1/director_artifacts?project_id=eq.${project.id}&logical_key=eq.${encodeURIComponent(a.logical_key)}&version=eq.${a.version}`);if(!rows.length)fail(409,'Save this version before approval.');
 return this.request('/rest/v1/director_approvals',{method:'POST',body:{project_id:project.id,artifact_id:rows[0].id,actor_id:owner,decision:body.decision}});}
 async registry(){return (await this.request('/rest/v1/director_models?order=id')).map(m=>({...m,purpose:m.capabilities.purpose,description:m.capabilities.description}));}
 async readJob(actorId,projectId,jobId){await this.get(projectId,actorId);const rows=await this.request(`/rest/v1/director_jobs?id=eq.${jobId}&project_id=eq.${projectId}`);if(!rows.length)fail(404,'Job not found.');return rows[0];}
 async readProposal(projectId,proposalId){return (await this.request(`/rest/v1/director_proposals?id=eq.${proposalId}&project_id=eq.${projectId}`))[0];}
 async readModel(id){return (await this.request(`/rest/v1/director_models?id=eq.${encodeURIComponent(id)}`))[0];}
 async claimJob(id){const row=await this.request('/rest/v1/rpc/director_claim_job',{method:'POST',body:{p_job_id:id}});return Array.isArray(row)?row[0]||null:row;}
 async markJob(id,fields,{expectedStatuses}){return (await this.request(`/rest/v1/director_jobs?id=eq.${id}&status=in.(${expectedStatuses.join(',')})`,{method:'PATCH',body:{...fields,updated_at:new Date().toISOString()}}))[0]||null;}
 async addAudit(projectId,actorId,type,details){return this.add('audit',{projectId,actorId,type,details});}

 async reserve(body){return this.request('/rest/v1/rpc/director_reserve_job',{method:'POST',body});}
}

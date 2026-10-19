import {localPlanningMethods,cloudPlanningMethods} from './planning-store.mjs';
import {localRegistryMethods,cloudRegistryMethods} from './registry-store.mjs';
import {assertBriefApproval} from './public/creative-brief-core.js';
import {assertScreenplayApproval,screenplayContext} from './public/screenplay-core.js';
import {assertDepartmentApproval,departmentPlanningContext} from './public/department-plan-core.js';
import {assertStoryboardHandoffApproval,storyboardHandoffContext,assertStoryboardShotProjection} from './public/storyboard-handoff-core.js';
import {localSpendingMethods,cloudSpendingMethods} from './spending-store.mjs';
import {defaultControl,applyAdminCommand,normalizedControl,visibleCommand} from './operations.mjs';
import {recordArtifacts,recordDependencies} from './production-records.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail,artifacts,hash} from './domain.mjs';
const snapshots=project=>[...artifacts(project),...recordArtifacts(project)];

export class LocalStore {
 constructor(file){this.file=file;this.state={projects:[],assets:[],approvals:[],proposals:[],jobs:[],audit:[],models:[],operationalControl:defaultControl(),adminCommands:[]};this.tail=Promise.resolve();}
 async init(){if(this.file)try{this.state={...this.state,...JSON.parse(await readFile(this.file,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 async serial(fn){const run=this.tail.then(async()=>{const result=await fn();if(this.file){await mkdir(dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(this.state),{mode:0o600});await rename(temp,this.file);}return structuredClone(result);});this.tail=run.catch(()=>{});return run;}
 async list(owner){return structuredClone(this.state.projects.filter(p=>p.ownerId===owner));}
 async get(id,owner){const p=this.state.projects.find(p=>p.id===id&&p.ownerId===owner);if(!p)fail(404,'Project not found.');return structuredClone(p);}
 async create(p){return this.serial(()=>{if(this.state.projects.some(x=>x.id===p.id))fail(409,'Project already exists.');this.state.projects.push(p);return p;});}
 async save(p,expected){return this.spendingTransaction(state=>{const n=state.projects.findIndex(x=>x.id===p.id&&x.ownerId===p.ownerId);if(n<0)fail(404,'Project not found.');if(state.projects[n].version!==expected)fail(409,'Project changed. Reopen it before saving.');state.projects[n]=structuredClone(p);return p;});}
 async saveDepartmentPlans(p,expected,{expectedApprovalId}={}){return this.spendingTransaction(state=>{
  const index=state.projects.findIndex(current=>current.id===p.id&&current.ownerId===p.ownerId);if(index<0)fail(404,'Project not found.');const current=state.projects[index];
  if(current.version!==expected||p.version!==expected+1)fail(409,'The project changed. Reopen it before saving department plans.');
  if(expectedApprovalId!==null&&typeof expectedApprovalId!=='string')fail(400,'A captured approval state is required.');
  const approvals=state.approvals.filter(a=>a.projectId===p.id);if((approvals.at(-1)?.id??null)!==expectedApprovalId)fail(409,'Review decisions changed while saving. Refresh the department plans before retrying.');
  const scope=value=>{const {departmentPlanning,version,...other}=value;return other;};if(hash(scope(current))!==hash(scope(p)))fail(400,'A department edit cannot replace other project fields.');
  const context=departmentPlanningContext(current,approvals);if(!context.prerequisites.briefApproved||!context.prerequisites.screenplayApproved)fail(409,'Approve the current brief and script before saving department plans.');
  state.projects[index]=structuredClone(p);return p;
 });}
 async records(kind,projectId){return structuredClone(this.state[kind].filter(x=>x.projectId===projectId));}
 async saveStoryboardHandoff(p,expected,{expectedApprovalId}={}){return this.spendingTransaction(state=>{
  const index=state.projects.findIndex(current=>current.id===p.id&&current.ownerId===p.ownerId);if(index<0)fail(404,'Project not found.');const current=state.projects[index];
  if(current.version!==expected||p.version!==expected+1)fail(409,'The project changed. Reopen its shot plan before saving.');
  if(expectedApprovalId!==null&&typeof expectedApprovalId!=='string')fail(400,'A captured approval state is required.');
  const approvals=state.approvals.filter(a=>a.projectId===p.id);if((approvals.at(-1)?.id??null)!==expectedApprovalId)fail(409,'Review decisions changed while saving. Reopen the shot plan before retrying.');
  const scope=value=>{const {storyboardHandoff,shots,version,...other}=value;return other;};if(hash(scope(current))!==hash(scope(p)))fail(400,'A shot-plan edit cannot replace other project fields.');
  const departments=departmentPlanningContext(current,approvals);if(!departments.prerequisites.briefApproved||!departments.prerequisites.screenplayApproved||departments.departments.some(unit=>!unit.approved))fail(409,'Approve the current script and department plans before saving the shot plan.');
  for(const old of current.shots||[]){const shot=p.shots.find(s=>s.id===old.id);if(!shot||['referenceAssetId','clipAssetId','productionBindings'].some(key=>hash(shot[key]??(key==='productionBindings'?[]:null))!==hash(old[key]??(key==='productionBindings'?[]:null))))fail(409,'A shot-plan edit must preserve existing shot identities and selected media.');}
  if(p.shots.some(shot=>!current.shots.some(old=>old.id===shot.id)&&(shot.referenceAssetId||shot.clipAssetId||shot.productionBindings?.length)))fail(400,'A new shot contract cannot select media or production records.');
  assertStoryboardShotProjection(p);state.projects[index]=structuredClone(p);return p;
 });}
 async add(kind,value){return this.serial(()=>{if(value.id&&this.state[kind].some(x=>x.id===value.id))fail(409,'Record already exists.');this.state[kind].push(value);return value;});}
 async registry(){return structuredClone((this.state.models||[]).map(m=>({...m,purpose:m.capabilities?.purpose||m.purpose,notes:m.capabilities?.admin_notes||'',description:m.capabilities?.description||m.description})));}
 async generationControl(){return structuredClone(this.state.operationalControl);}
 async operationalAudit(){return structuredClone((this.state.adminCommands||[]).slice(-100).reverse().map(visibleCommand));}
 async operationalCommand(request){return this.serial(()=>applyAdminCommand(this.state,request));}
 async approve(project,body,owner){return this.spendingTransaction(state=>{
 const current=state.projects.find(p=>p.id===project.id&&p.ownerId===owner);if(!current)fail(404,'Project not found.');
 const storyboardApproval=assertStoryboardHandoffApproval(current,body,state.approvals.filter(a=>a.projectId===current.id));
 if(storyboardApproval){
  const context=storyboardHandoffContext(current,state.approvals.filter(a=>a.projectId===current.id));
  const createdAt=new Date().toISOString(),make=(artifactId,version)=>({id:randomUUID(),projectId:current.id,artifactId,version,decision:body.decision,actorId:owner,createdAt,storyboard:{planningOnlyAcknowledged:body.decision==='approved',sequenceVersion:body.version}});
  const contracts=body.decision==='approved'?context.shots.map(unit=>make('shot_contract:'+unit.id,unit.current.version)):[];
  const approval=make('storyboard_sequence',body.version);state.approvals.push(...contracts,approval);
  state.audit.push({id:randomUUID(),projectId:current.id,actorId:owner,type:'storyboard_approval',details:{sequenceVersion:body.version,decision:body.decision,approvedContractCount:contracts.length},createdAt});
  return {...approval,approvedContractCount:contracts.length,planningOnlyAcknowledged:body.decision==='approved'};
 }
 assertBriefApproval(current,body);
 assertScreenplayApproval(current,body,state.approvals.filter(a=>a.projectId===current.id));
 assertDepartmentApproval(current,body,state.approvals.filter(a=>a.projectId===current.id));
 const a=snapshots(current).find(a=>a.logical_key===body.artifactId&&a.version===body.version);if(!a)fail(409,'That artifact version is no longer current.');
 const graph=recordDependencies(current);const holds=a.logical_key.startsWith('record:')?graph.records.find(r=>'record:'+r.recordId===a.logical_key)?.holds:graph.shots.find(s=>s.shotId===a.logical_key)?.holds;if(body.decision==='approved'&&holds?.length)fail(409,'Update the linked production versions before approval.');
 if(body.decision==='approved'&&a.kind==='story'&&!a.content.treatment.trim())fail(400,'Write a treatment before approving it.');if(body.decision==='approved'&&a.kind==='shot'&&!a.content.description.trim())fail(400,'Write the shot direction before approval.');
 const approval={id:randomUUID(),projectId:current.id,artifactId:body.artifactId,version:body.version,decision:body.decision,actorId:owner,createdAt:new Date().toISOString()};
 if(body.artifactId==='screenplay'&&body.decision==='approved'){const context=screenplayContext(current,state.approvals.filter(a=>a.projectId===current.id));approval.originality={limitedCoverageAcknowledged:true,reportHash:hash(context.originality.inputSignature),policyVersion:context.originality.policyVersion,coverage:context.originality.coverage,reviewedFindings:context.originality.findings.length,legalClearance:false};}
 if(body.artifactId.startsWith('department:')&&body.decision==='approved')approval.department={id:body.artifactId.slice('department:'.length),planningOnlyAcknowledged:true};
 state.approvals.push(approval);return approval;
 });}

}

export class SupabaseStore {
 constructor({url,key,fetcher=fetch}){this.url=url.replace(/\/$/,'');this.key=key;this.fetcher=fetcher;}
 async request(path,{method='GET',body,token,headers={}}={}){
 const r=await this.fetcher(this.url+path,{method,headers:{apikey:this.key,Authorization:`Bearer ${token||this.key}`,'Content-Type':'application/json',Prefer:'return=representation',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!r.ok){if(r.status===401)fail(401,'Sign in again to continue.');let detail;try{detail=await r.json();}catch{}if(/storyboard|director_approve_storyboard_handoff/.test(detail?.message||'')&&['PGRST202','PGRST205','42P01','42883'].includes(detail?.code))fail(503,'Shot planning requires the verified database update. Your existing plan remains saved.');if(/storyboard_.*invalid/.test(detail?.message||''))fail(400,'Supply valid shot contracts, sequence versions and a planning-only acknowledgement.');if(/storyboard_/.test(detail?.message||''))fail(409,'Shot planning is held: refresh the current script, department reviews, sequence and shot contracts.');if(/department|director_approve_department/.test(detail?.message||'')&&['PGRST202','PGRST205','42P01','42883'].includes(detail?.code))fail(503,'Department planning requires the verified database update. Saved creative work remains intact.');if(/department_.*invalid/.test(detail?.message||''))fail(400,'Supply valid department plans, source versions and a planning-only acknowledgement.');if(/department_/.test(detail?.message||''))fail(409,'Department planning is held: refresh the approved brief, script, plan version and current source review.');if(/screenplay|director_approve_screenplay/.test(detail?.message||'')&&['PGRST202','PGRST205','42P01','42883'].includes(detail?.code))fail(503,'Screenplay approval requires the verified database update. Your script remains saved.');if(/screenplay_.*invalid/.test(detail?.message||''))fail(400,'Review the screenplay version, source matches and coverage acknowledgement.');if(/screenplay_/.test(detail?.message||''))fail(409,'Screenplay approval is held: refresh the current script, sources and review before retrying.');if((detail?.message||'').includes('planning_')&&['PGRST202','PGRST205','42P01','42883'].includes(detail?.code))fail(503,'Planning controls require the verified database update. Paid planning remains held.');if(/planning_.*invalid|planning_reason_invalid/.test(detail?.message||''))fail(400,'Supply valid planning limits, identities and reviewed evidence.');if(/planning_.*conflict|planning_.*stale|planning_.*unresolved|planning_.*unavailable|planning_.*reached|planning_.*paused|planning_.*must_remain|planning_.*exceeded/.test(detail?.message||''))fail(409,'Planning is held: check the saved scope, budget, model and existing request before retrying.');if(/quote_records|spending_commands|director_persist_quote|director_spending_replay|director_authorize_quote|director_revoke_authorization/.test(detail?.message||'')&&['PGRST202','PGRST205','42P01','42883'].includes(detail?.code))fail(503,'Saved quotes and spending limits require the verified database update. Generation remains held.');if(/not_project_owner/.test(detail?.message||''))fail(404,'Project not found.');if(/spending_request_invalid|project_budget_invalid/.test(detail?.message||''))fail(400,'Supply valid spending identities and limits.');if(/spending_idempotency_conflict|quote_contract_invalid|creative_dependencies_not_approved|project_budget_below_existing_exposure/.test(detail?.message||''))fail(409,'The spending decision conflicts with a saved request, changed quote or existing costs. Refresh before continuing.');if(/director_registry|registry_/.test(detail?.message||'')&&['PGRST202','PGRST205','42P01','42883'].includes(detail?.code))fail(503,'Reviewed model management requires the verified database update. Serving profiles remain unchanged.');if(/registry_command_forbidden/.test(detail?.message||''))fail(403,'Only an authorized owner can manage model drafts and publications.');if(/registry_.*invalid/.test(detail?.message||''))fail(400,'Supply a valid credential-free model profile and registry command.');if(/registry_/.test(detail?.message||''))fail(409,'Model publication is held: refresh the draft and control revision, review current evidence and reconcile outstanding work.');if(/operational_model_missing/.test(detail?.message||''))fail(404,'Registry model not found.');if(/operational_command_forbidden/.test(detail?.message||''))fail(403,'Your staff role cannot perform this command.');if(/operational_command_invalid/.test(detail?.message||''))fail(400,'Invalid operational command.');if(/operational_model_busy|operational_revision_conflict|operational_idempotency_conflict/.test(detail?.message||''))fail(409,'Operational settings changed or the route is busy. Refresh before issuing a new command.');if(/generation_operationally_paused|operational_control_missing|generation_paused|operational_control_unavailable/.test(detail?.message||''))fail(409,'New generation is paused. Existing requests can still be inspected.');if(/project_version_conflict|immutable_artifact_conflict/.test(detail?.message||''))fail(409,'This version changed. Reopen the project before saving.');if(/authorization_invalid|artifact_superseded|artifact_not_approved|route_not_eligible|attempt_limit|work_unit_in_flight|idempotency_conflict|budget_exceeded|project_budget_exceeded/.test(detail?.message||''))fail(409,'Production is held: review the current approval, quote, budget and attempt status before retrying.');if(path.includes('grant_type=refresh_token')&&(r.status===400||r.status===403))fail(401,'Your session ended. Sign in again; your draft is preserved.');if(path.startsWith('/auth/v1/token')&&(r.status===400||r.status===401))fail(401,'Sign-in failed. Check your email and password.');fail(r.status===409?409:502,'The workspace service could not finish this operation. Your draft is preserved.');}
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
 async saveDepartmentPlans(p,expected,{expectedApprovalId}={}){if(expectedApprovalId!==null&&typeof expectedApprovalId!=='string')fail(400,'A captured approval state is required.');await this.request('/rest/v1/rpc/director_save_departments',{method:'POST',body:{p_actor_id:p.ownerId,p_project_id:p.id,p_expected_version:expected,p_expected_approval_id:expectedApprovalId,p_document:p,p_artifacts:snapshots(p)}});return p;}
 async saveStoryboardHandoff(p,expected,{expectedApprovalId}={}){if(expectedApprovalId!==null&&typeof expectedApprovalId!=='string')fail(400,'A captured approval state is required.');await this.request('/rest/v1/rpc/director_save_storyboard_handoff',{method:'POST',body:{p_actor_id:p.ownerId,p_project_id:p.id,p_expected_version:expected,p_expected_approval_id:expectedApprovalId,p_document:p,p_artifacts:snapshots(p)}});return p;}
 async records(kind,projectId){const tables={assets:'director_assets',approvals:'director_approvals',jobs:'director_jobs',proposals:'director_proposals',audit:'director_audit_events'};if(!tables[kind])fail(400,'Unknown record type.');const path=`/rest/v1/${tables[kind]}?project_id=eq.${projectId}`;const rows=kind==='approvals'?await this.allRows(path+'&order=ordinal.asc'):await this.request(path);
 if(kind==='approvals'){const artifacts=await this.allRows(`/rest/v1/director_artifacts?project_id=eq.${projectId}&select=id,logical_key,version&order=id.asc`);return rows.map(r=>{const a=artifacts.find(a=>a.id===r.artifact_id);const {screenplay_evidence,department_evidence,storyboard_evidence,...visible}=r;return {...visible,projectId:r.project_id,artifactId:a?.logical_key||null,version:a?.version,actorId:r.actor_id,createdAt:r.created_at,...(storyboard_evidence?.acknowledgePlanningOnly===true?{storyboard:{planningOnlyAcknowledged:true,sequenceVersion:storyboard_evidence.sequenceVersion}}:{}),...(department_evidence?.acknowledgePlanningOnly===true?{department:{id:a?.logical_key?.slice('department:'.length),planningOnlyAcknowledged:true}}:{}),...(screenplay_evidence?.report?{originality:{policyVersion:screenplay_evidence.report.policyVersion,status:screenplay_evidence.report.status,coverage:screenplay_evidence.report.coverage,legalClearance:false,limitedCoverageAcknowledged:screenplay_evidence.acknowledgeLimitedCoverage===true}}:{})};});}
 return rows.map(r=>kind==='assets'?{...r.metadata,id:r.id,projectId:r.project_id}:r);}
 async add(kind,value){if(kind==='assets'){const r=await this.request('/rest/v1/director_assets',{method:'POST',body:{id:value.id,project_id:value.projectId,kind:value.mime,storage_key:value.storageKey,metadata:value,rights_evidence:{status:'user-supplied-unverified'}}});return {...r[0].metadata,id:r[0].id};}
 if(kind==='audit'){return this.request('/rest/v1/director_audit_events',{method:'POST',body:{project_id:value.projectId,actor_id:value.actorId,event_type:value.type,details:value.details}});}
 fail(503,'This record requires a verified route and quote.');}
 async approve(project,body,owner){project=await this.get(project.id,owner);assertBriefApproval(project,body);if(body.artifactId?.startsWith('department:'))assertDepartmentApproval(project,body,await this.records('approvals',project.id));if(body.artifactId==='screenplay')assertScreenplayApproval(project,body,await this.records('approvals',project.id));const a=snapshots(project).find(a=>a.logical_key===body.artifactId&&a.version===body.version);if(!a)fail(409,'That artifact version is no longer current.');
 const storyboardApproval=assertStoryboardHandoffApproval(project,body,body.artifactId==='storyboard_sequence'?await this.records('approvals',project.id):[]);
 if(storyboardApproval)return this.request('/rest/v1/rpc/director_approve_storyboard_handoff',{method:'POST',body:{p_actor_id:owner,p_project_id:project.id,p_expected_version:body.expectedVersion,p_archive:project.storyboardHandoff,p_sequence_version:body.version,p_ack_planning_only:body.ackPlanningOnly===true,p_decision:body.decision}});
 const graph=recordDependencies(project);const holds=a.logical_key.startsWith('record:')?graph.records.find(r=>'record:'+r.recordId===a.logical_key)?.holds:graph.shots.find(s=>s.shotId===a.logical_key)?.holds;if(body.decision==='approved'&&holds?.length)fail(409,'Update the linked production versions before approval.');
 if(body.decision==='approved'&&(a.kind==='story'&&!a.content.treatment.trim()||a.kind==='shot'&&!a.content.description.trim()))fail(400,'Complete the artifact before approving it.');
 if(a.kind==='department_plan')return this.request('/rest/v1/rpc/director_approve_department',{method:'POST',body:{p_actor_id:owner,p_project_id:project.id,p_expected_version:body.expectedVersion,p_department_id:body.artifactId.slice('department:'.length),p_department_version:body.version,p_archive:project.departmentPlanning,p_ack_planning_only:body.ackPlanningOnly===true,p_decision:body.decision}});
 if(a.kind==='screenplay'){const context=screenplayContext(project,await this.records('approvals',project.id));return this.request('/rest/v1/rpc/director_approve_screenplay',{method:'POST',body:{p_actor_id:owner,p_project_id:project.id,p_expected_version:project.version,p_screenplay_version:body.version,p_archive:project.screenplay,p_report:context.originality,p_ack_limited:body.acknowledgeLimitedCoverage===true,p_decision:body.decision}});}
 const rows=await this.request(`/rest/v1/director_artifacts?project_id=eq.${project.id}&logical_key=eq.${encodeURIComponent(a.logical_key)}&version=eq.${a.version}`);if(!rows.length)fail(409,'Save this version before approval.');
 return this.request('/rest/v1/director_approvals',{method:'POST',body:{project_id:project.id,artifact_id:rows[0].id,actor_id:owner,decision:body.decision}});}
 async registry(){return (await this.request('/rest/v1/director_models?order=id')).map(m=>({...m,purpose:m.capabilities.purpose,description:m.capabilities.description,notes:m.capabilities.admin_notes||''}));}
 async generationControl(){const rows=await this.request('/rest/v1/director_operational_controls?id=eq.1');if(rows.length!==1)fail(503,'Operational controls are unavailable. Generation remains held.');return normalizedControl(rows[0]);}
 async operationalAudit(){return (await this.request('/rest/v1/director_admin_commands?order=created_at.desc,request_id.desc&limit=100')).map(visibleCommand);}
 async operationalCommand(r){const result=await this.request('/rest/v1/rpc/director_admin_command',{method:'POST',body:{p_actor_id:r.actorId,p_actor_role:r.actorRole,p_request_id:r.requestId,p_expected_revision:r.expectedRevision,p_command:r.command,p_reason:r.reason,p_model_id:r.modelId,p_notes:r.notes}});return {...result,control:normalizedControl(result.control)};}
 async readJob(actorId,projectId,jobId){await this.get(projectId,actorId);const rows=await this.request(`/rest/v1/director_jobs?id=eq.${jobId}&project_id=eq.${projectId}`);if(!rows.length)fail(404,'Job not found.');return rows[0];}
 async readProposal(projectId,proposalId){return (await this.request(`/rest/v1/director_proposals?id=eq.${proposalId}&project_id=eq.${projectId}`))[0];}
 async readModel(id){return (await this.request(`/rest/v1/director_models?id=eq.${encodeURIComponent(id)}`))[0];}
 async claimJob(id){const row=await this.request('/rest/v1/rpc/director_claim_job',{method:'POST',body:{p_job_id:id}});return Array.isArray(row)?row[0]||null:row;}
 async markJob(id,fields,{expectedStatuses}){return (await this.request(`/rest/v1/director_jobs?id=eq.${id}&status=in.(${expectedStatuses.join(',')})`,{method:'PATCH',body:{...fields,updated_at:new Date().toISOString()}}))[0]||null;}
 async addAudit(projectId,actorId,type,details){return this.add('audit',{projectId,actorId,type,details});}

 async reserve(body){return this.request('/rest/v1/rpc/director_reserve_job',{method:'POST',body});}
}

Object.assign(LocalStore.prototype,localSpendingMethods);
Object.assign(SupabaseStore.prototype,cloudSpendingMethods);

Object.assign(LocalStore.prototype,localPlanningMethods);
Object.assign(SupabaseStore.prototype,cloudPlanningMethods);

Object.assign(LocalStore.prototype,localRegistryMethods);
Object.assign(SupabaseStore.prototype,cloudRegistryMethods);

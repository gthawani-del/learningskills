import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../domain.mjs';
import {SupabaseStore} from '../store.mjs';
import {applyBriefCommand,currentBrief} from '../public/creative-brief-core.js';
import {applyScreenplayCommand,currentScreenplay} from '../public/screenplay-core.js';
import {applyDepartmentCommand,currentDepartmentPlan} from '../public/department-plan-core.js';
const owner='11111111-1111-4111-8111-111111111111';
function project(){
 let p=newProject({title:'Cloud departments',premise:'A potter repairs a cup.'},owner);p=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:{title:'The Cup',logline:'A potter repairs a cup.',treatment:'A quiet repair.',characters:[{id:'potter',name:'Asha',description:'An adult Indian potter.'}],scenes:[{id:'repair',heading:'INT. WORKSHOP — MORNING',action:'Asha slowly joins two broken pieces.',dialogue:[],durationSeconds:30}]}});
 const approvals=[{artifactId:'brief',version:currentBrief(p).version,decision:'approved'},{artifactId:'screenplay',version:currentScreenplay(p).version,decision:'approved'}];
 p=applyDepartmentCommand(p,{expectedVersion:p.version,action:'prepare'},approvals);
 p=applyDepartmentCommand(p,{expectedVersion:p.version,action:'update',departmentId:'casting',document:{applicability:'required',rationale:'The script has one named character.',summary:'Asha needs an approved identity and performance direction before reference generation.',requirements:[{id:'identity',label:'Asha identity',direction:'An adult Indian potter with natural facial asymmetry and lived-in hands; approve references first.',sceneIds:['repair'],characterIds:['potter']}],choices:[{id:'asha-look',label:'Asha look',value:'Natural daylight, working clothes, no beauty retouching.',status:'proposed',sceneIds:['repair'],characterIds:['potter']}],handoffs:[{toDepartmentId:'look',deliverable:'Approved Asha identity and costume references.'}],checks:['Do not claim actor consent or verified generated realism.']}},approvals);return p;
}
const records=p=>[
 {id:'brief-approval',project_id:p.id,artifact_id:'artifact-brief',actor_id:owner,decision:'approved',ordinal:1},
 {id:'script-approval',project_id:p.id,artifact_id:'artifact-screenplay',actor_id:owner,decision:'approved',ordinal:2}
];
function fixture(p,{error=null,foreign=false,rows=records(p)}={}){
 const calls=[];const store=new SupabaseStore({url:'https://workspace.example',key:'server-only-secret',fetcher:async(url,options)=>{
  const path=url.replace('https://workspace.example',''),body=options.body?JSON.parse(options.body):undefined;calls.push({path,method:options.method,body});let value;
  if(path.startsWith('/rest/v1/director_projects?'))value=foreign?[]:[{id:p.id,owner_id:owner,title:p.title,stage:p.stage,brief:p}];
  else if(path.startsWith('/rest/v1/director_approvals?'))value=path.includes('offset=0')?rows:[];
  else if(path.startsWith('/rest/v1/director_artifacts?'))value=path.includes('offset=0')?[{id:'artifact-brief',logical_key:'brief',version:p.creativeBrief.currentVersion},{id:'artifact-screenplay',logical_key:'screenplay',version:p.screenplay.currentVersion},{id:'artifact-casting',logical_key:'department:casting',version:currentDepartmentPlan(p,'casting').version}]:[];
  else if(path==='/rest/v1/rpc/director_approve_department'){if(error)return new Response(JSON.stringify(error),{status:400});value={id:'approval',projectId:p.id,artifactId:'department:casting',version:currentDepartmentPlan(p,'casting').version,decision:body.p_decision,department:body.p_decision==='approved'?{id:'casting',planningOnlyAcknowledged:true}:null};}
  else if(['/rest/v1/rpc/director_save_project','/rest/v1/rpc/director_save_departments'].includes(path)){if(error)return new Response(JSON.stringify(error),{status:400});value={saved:true};}
  else assert.fail('Unexpected cloud read/write: '+path);
  return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 }});return {store,calls};
}
const decision=p=>({artifactId:'department:casting',version:currentDepartmentPlan(p,'casting').version,expectedVersion:p.version,decision:'approved',ackPlanningOnly:true});

test('cloud department approval uses only owner-bound atomic RPC and exact saved archive',async()=>{
 const p=project(),{store,calls}=fixture(p),result=await store.approve(p,{...decision(p),archive:{forged:true}},owner);assert.equal(result.artifactId,'department:casting');assert.equal(result.department.planningOnlyAcknowledged,true);
 const writes=calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.equal(writes[0].path,'/rest/v1/rpc/director_approve_department');assert.deepEqual(writes[0].body,{p_actor_id:owner,p_project_id:p.id,p_expected_version:p.version,p_department_id:'casting',p_department_version:currentDepartmentPlan(p,'casting').version,p_archive:p.departmentPlanning,p_ack_planning_only:true,p_decision:'approved'});
});
test('cloud department approval fails closed on missing migration without plain approval insertion',async()=>{
 const p=project(),{store,calls}=fixture(p,{error:{code:'PGRST202',message:'Could not find public.director_approve_department'}});await assert.rejects(store.approve(p,decision(p),owner),e=>e.status===503);assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.ok(!calls.some(c=>c.path==='/rest/v1/director_approvals'));
});
test('cloud department concurrent source/archive conflict becomes a recoverable hold',async()=>{
 const p=project(),{store,calls}=fixture(p,{error:{code:'P0001',message:'department_approval_stale'}});await assert.rejects(store.approve(p,decision(p),owner),e=>e.status===409);assert.equal(calls.filter(c=>c.method==='POST').length,1);
});
test('cloud department foreign owner, stale revision, missing prerequisite and missing acknowledgement stop before write',async()=>{
 const p=project(),foreign=fixture(p,{foreign:true});await assert.rejects(foreign.store.approve(p,decision(p),'foreign-owner'),e=>e.status===404);assert.equal(foreign.calls.filter(c=>c.method==='POST').length,0);
 const stale=fixture(p);await assert.rejects(stale.store.approve(p,{...decision(p),expectedVersion:p.version-1},owner),e=>e.status===409);assert.equal(stale.calls.filter(c=>c.method==='POST').length,0);
 const unapproved=fixture(p,{rows:[]});await assert.rejects(unapproved.store.approve(p,decision(p),owner),e=>e.status===409);assert.equal(unapproved.calls.filter(c=>c.method==='POST').length,0);
 const acknowledgement=fixture(p);await assert.rejects(acknowledgement.store.approve(p,{...decision(p),ackPlanningOnly:false},owner),e=>e.status===400);assert.equal(acknowledgement.calls.filter(c=>c.method==='POST').length,0);
});
test('cloud department rejection and revocation retain guarded RPC rather than an unbound evidence write',async()=>{
 const p=project();for(const value of ['rejected','revoked']){const {store,calls}=fixture(p,{rows:[]}),result=await store.approve(p,{...decision(p),decision:value,ackPlanningOnly:false},owner);assert.equal(result.decision,value);assert.equal(result.department,null);const writes=calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.equal(writes[0].path,'/rest/v1/rpc/director_approve_department');assert.equal(writes[0].body.p_ack_planning_only,false);}
});
test('cloud history strips private department archive and exposes bounded planning-only summary',async()=>{
 const p=project(),rows=[...records(p),{id:'department-approval',project_id:p.id,artifact_id:'artifact-casting',actor_id:owner,decision:'approved',ordinal:3,department_evidence:{archive:p.departmentPlanning,departmentId:'casting',departmentVersion:1,acknowledgePlanningOnly:true,expectedVersion:p.version}}],{store}=fixture(p,{rows}),history=await store.records('approvals',p.id),row=history.at(-1);assert.equal(row.artifactId,'department:casting');assert.deepEqual(row.department,{id:'casting',planningOnlyAcknowledged:true});assert.equal(row.department_evidence,undefined);assert.ok(!JSON.stringify(history).includes('Natural daylight'));
});
test('cloud project save writes versioned department artifacts through existing atomic save RPC',async()=>{
 const p=project(),{store,calls}=fixture(p),expected=p.version-1;assert.deepEqual(await store.save(p,expected),p);const writes=calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);const saved=writes[0];assert.equal(saved.path,'/rest/v1/rpc/director_save_project');assert.equal(saved.body.p_expected_version,expected);assert.deepEqual(saved.body.p_document.departmentPlanning,p.departmentPlanning);const department=saved.body.p_artifacts.find(a=>a.logical_key==='department:casting');assert.equal(department.kind,'department_plan');assert.equal(department.version,currentDepartmentPlan(p,'casting').version);assert.deepEqual(department.content,{departmentId:'casting',...currentDepartmentPlan(p,'casting')});assert.match(department.content_hash,/^[a-f0-9]{64}$/);
});
test('cloud department mutation uses specialized save RPC with the captured latest approval identity',async()=>{
 const p=project(),{store,calls}=fixture(p),expectedApprovalId='22222222-2222-4222-8222-222222222222';assert.deepEqual(await store.saveDepartmentPlans(p,p.version-1,{expectedApprovalId}),p);const writes=calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.equal(writes[0].path,'/rest/v1/rpc/director_save_departments');assert.equal(writes[0].body.p_expected_approval_id,expectedApprovalId);assert.equal(writes[0].body.p_actor_id,owner);assert.equal(writes[0].body.p_expected_version,p.version-1);assert.deepEqual(writes[0].body.p_document,p);assert.ok(writes[0].body.p_artifacts.some(a=>a.logical_key==='department:casting'));assert.ok(!writes.some(c=>c.path==='/rest/v1/rpc/director_save_project'));
});
test('cloud department save fails closed on missing migration or approval-after-read conflict',async()=>{
 const p=project(),expectedApprovalId='22222222-2222-4222-8222-222222222222';for(const [error,status] of [[{code:'PGRST202',message:'Could not find public.director_save_departments'},503],[{code:'P0001',message:'department_approval_changed'},409],[{code:'P0001',message:'department_source_approval_required'},409]]){const {store,calls}=fixture(p,{error});await assert.rejects(store.saveDepartmentPlans(p,p.version-1,{expectedApprovalId}),e=>e.status===status);assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.ok(!calls.some(c=>c.path==='/rest/v1/rpc/director_save_project'));}
});
test('cloud department save requires an explicitly captured nullable approval identity',async()=>{
 const p=project(),{store,calls}=fixture(p);await assert.rejects(store.saveDepartmentPlans(p,p.version-1),e=>e.status===400);assert.equal(calls.filter(c=>c.method==='POST').length,0);await store.saveDepartmentPlans(p,p.version-1,{expectedApprovalId:null});assert.equal(calls.at(-1).body.p_expected_approval_id,null);
});
test('cloud targeted revision saves exact request history and dependency pins through the guarded mutation RPC',async()=>{
 let p=project();p=applyDepartmentCommand(p,{expectedVersion:p.version,action:'request_revision',departmentIds:['camera'],instruction:'Make the camera treatment more intimate; preserve approved dialogue and voice choices.'},[{artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved'},{artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved'}]);const {store,calls}=fixture(p),expectedApprovalId='22222222-2222-4222-8222-222222222222';await store.saveDepartmentPlans(p,p.version-1,{expectedApprovalId});const write=calls.find(c=>c.method==='POST');assert.equal(write.path,'/rest/v1/rpc/director_save_departments');assert.equal(write.body.p_expected_approval_id,expectedApprovalId);assert.deepEqual(write.body.p_document.departmentPlanning.revisionRequests,p.departmentPlanning.revisionRequests);assert.equal(write.body.p_document.departmentPlanning.revisionRequests.at(-1).departmentVersions.length,17);const camera=write.body.p_artifacts.find(a=>a.logical_key==='department:camera');assert.deepEqual(camera.content.dependencyContext,currentDepartmentPlan(p,'camera').dependencyContext);assert.equal(camera.content.dependencyContext.policyVersion,'director-department-dependencies-v1');
});

import {fail,hash} from './domain.mjs';
import {DEPARTMENT_IDS,departmentPlanningContext,assertDepartmentApproval} from './public/department-plan-core.js';
import {currentScreenplay} from './public/screenplay-core.js';
import {songDirectorContext} from './public/song-intelligence-core.js';
import {validateMusicTreatment} from './public/music-treatment-timing.js';
// One customer action, existing per-artifact approvals. Deliberately not advertised
// as a new atomic database transaction: interrupted sign-offs remain recoverable.
export async function approveMusicDepartmentPackage({project,body,actorId,store}){
 if(project.format!=='music_video')fail(400,'This department package belongs to a music video.');
 const keys=['expectedVersion','expectedApprovalId','departmentVersions','ackPlanningOnly'];
 if(!body||Object.keys(body).length!==keys.length||keys.some(k=>!Object.hasOwn(body,k))||body.expectedVersion!==project.version||body.ackPlanningOnly!==true)fail(409,'Review the current department package and acknowledge planning-only approval.');
 const approvals=await store.records('approvals',project.id);if(body.expectedApprovalId!==(approvals.at(-1)?.id??null))fail(409,'Review decisions changed. Refresh this package before signing off.');
 const song=songDirectorContext(project,approvals);validateMusicTreatment(currentScreenplay(project)?.document||{},song,{complete:true});
 const context=departmentPlanningContext(project,approvals),versions=context.departments.map(u=>({id:u.id,version:u.current?.version??null}));
 if(hash(body.departmentVersions)!==hash(versions)||versions.some(v=>v.version===null))fail(409,'Prepare and review the complete current department package.');
 const commands=DEPARTMENT_IDS.map((id,i)=>({artifactId:'department:'+id,version:versions[i].version,expectedVersion:project.version,decision:'approved',ackPlanningOnly:true}));
 for(const command of commands)assertDepartmentApproval(project,command,approvals);
 let tail=body.expectedApprovalId;
 for(const command of commands){
  const current=await store.get(project.id,actorId),ledger=await store.records('approvals',project.id);
  if(current.version!==project.version||(ledger.at(-1)?.id??null)!==tail)fail(409,'The package or its decisions changed during sign-off. Earlier valid approvals remain; refresh to review the remaining plans.');
  const unit=departmentPlanningContext(current,ledger).departments.find(u=>'department:'+u.id===command.artifactId);
  if(!unit.approved){await store.approve(current,command,actorId);const updated=await store.records('approvals',project.id);tail=updated.at(-1)?.id??null;}
 }
 const current=await store.get(project.id,actorId),ledger=await store.records('approvals',project.id),result=departmentPlanningContext(current,ledger);
 if(current.version!==project.version||result.departments.some(u=>!u.approved||u.stale))fail(409,'Some department approvals need review. Refresh the saved package; no media or paid call was started.');
 return {project:current,departmentContext:result,approvals:ledger};
}

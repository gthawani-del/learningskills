import {randomUUID} from 'node:crypto';
import {hash,fail} from './domain.mjs';
import {buildDirectorContext,validateDirectorProposal,directorAssetSources} from './director-context.mjs';
import {validatePlanningResult} from './planning-provider.mjs';
import {directorSession,DIRECTOR_SESSION_MAX_BYTES} from './public/director-session-core.js';
import {applyScreenplayProjectCommand} from './public/screenplay-project.js';
import {applyDepartmentCommand} from './public/department-plan-core.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const destinations={none:null,review_song:'brief',interpret_brief:'brief',write_script:'story',prepare_script_revision:'story',plan_departments:'story',prepare_department_revision:'story',plan_storyboard:'storyboard',review_references:'cast',review_animatic:'edit'};
const operations={interpret_brief:'interpret_brief',write_script:'write_script',prepare_script_revision:'revise_script',plan_departments:'plan_departments',prepare_department_revision:'revise_departments',plan_storyboard:'plan_storyboard'};
export function prepareDirectorAction({project,approvals,assets=[],proposal,planningCallId}){
 const current=validateDirectorProposal(proposal,buildDirectorContext({project,approvals,assets})),nextAction=current.nextAction;
 return {actionId:hash({planningCallId,sourceDigest:current.sourceDigest,nextAction}),kind:nextAction.kind,destination:destinations[nextAction.kind],planningOperation:operations[nextAction.kind]??null,requiresPlanningConsent:!!operations[nextAction.kind],generationAuthorized:false};
}
function commandBody(body,action){
 const keys=action?['requestId','expectedVersion','planningCallId','actionId']:['requestId','expectedVersion','planningCallId'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==keys.length||keys.some(k=>!Object.hasOwn(body,k))||!uuid.test(body.requestId||'')||!uuid.test(body.planningCallId||'')||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||action&&!/^[a-f0-9]{64}$/.test(body.actionId||''))fail(400,'Supply a current project version and saved Director response identity.');
}
function receipt(project,body,kind){const previous=directorSession(project).commands.find(c=>c.requestId===body.requestId);if(previous&&previous.fingerprint!==hash({kind,...body}))fail(409,'This request identity belongs to another Director decision.');return previous;}
async function source({project,actorId,store,body,retainHistory=false}){
 const saved=await store.readPlanningCall(actorId,project.id,body.planningCallId);
 if(saved.reservation?.operation!=='director_turn'||saved.reservation?.status!=='completed'||saved.result?.providerStatus!=='completed'||saved.result?.planError||!saved.result?.directorProposal)fail(409,'This planning call has no settled, completed Director proposal.');
 const proposal=validatePlanningResult(saved.result.directorProposal,saved.request),approvals=await store.records('approvals',project.id),assets=await store.records('assets',project.id);
 let preview;try{preview=prepareDirectorAction({project,approvals,assets,proposal,planningCallId:body.planningCallId});}catch(error){if(!retainHistory||error.status!==409)throw error;preview={kind:proposal.nextAction.kind,destination:null,planningOperation:null,requiresPlanningConsent:false,generationAuthorized:false,sourceCurrent:false,holdReason:'Creative sources changed. This reply is history; request a current recommendation before taking action.'};}
 return {proposal,approvals,assets,preview};
}
function withReceipt(project,body,kind,session,result){
 session.commands.push({requestId:body.requestId,fingerprint:hash({kind,...body}),action:kind,result});
 if(Buffer.byteLength(JSON.stringify(session),'utf8')>DIRECTOR_SESSION_MAX_BYTES)fail(409,'This conversation reached its saved size limit. No production action was applied.');
 return {...project,directorSession:session};
}
export async function recordDirectorReply({project,actorId,store,body}){
 commandBody(body,false);await store.get(project.id,actorId);
 const prior=receipt(project,body,'record_director_reply');if(prior)return {project,action:prior.result};
 if(project.version!==body.expectedVersion)fail(409,'The project changed. Refresh before saving this Director reply.');
 const {proposal,approvals,assets,preview}=await source({project,actorId,store,body,retainHistory:true}),session=directorSession(project);
 if(session.messages.some(m=>m.planningCallId===body.planningCallId))return {project,action:preview};
 session.messages.push({id:randomUUID(),role:'assistant',text:proposal.message,createdAt:new Date().toISOString(),planningCallId:body.planningCallId,sourceDigest:proposal.sourceDigest,limitations:proposal.limitations,nextAction:proposal.nextAction,action:preview});
 const next=withReceipt({...structuredClone(project),version:project.version+1},body,'record_director_reply',session,preview);
 return {project:await store.saveDirectorDecision(next,project.version,{actorId,expectedApprovalId:approvals.at(-1)?.id??null,expectedAssets:directorAssetSources(assets)}),action:preview};
}
export async function applyDirectorAction({project,actorId,store,body}){
 commandBody(body,true);await store.get(project.id,actorId);
 const prior=receipt(project,body,'apply_director_action');if(prior)return {project,action:prior.result};
 if(project.version!==body.expectedVersion)fail(409,'The project changed. Review the current proposal before applying it.');
 const {proposal,approvals,assets,preview}=await source({project,actorId,store,body});if(preview.actionId!==body.actionId)fail(409,'The selected Director action does not match this saved response.');
 let next=structuredClone(project);const a=proposal.nextAction;
 if(a.kind==='prepare_script_revision')next=applyScreenplayProjectCommand(project,{expectedVersion:project.version,action:'set_revision',revisionRequest:{sceneIds:a.sceneIds,instruction:a.instruction}},approvals);
 if(a.kind==='prepare_department_revision')next=applyDepartmentCommand(project,{expectedVersion:project.version,action:'request_revision',departmentIds:a.departmentIds,instruction:a.instruction},approvals);
 if(next.version===project.version)next.version++;
 next=withReceipt(next,body,'apply_director_action',directorSession(project),preview);
 return {project:await store.saveDirectorDecision(next,project.version,{actorId,expectedApprovalId:approvals.at(-1)?.id??null,expectedAssets:directorAssetSources(assets)}),action:preview};
}

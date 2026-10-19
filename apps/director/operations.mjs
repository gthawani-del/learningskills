import {randomUUID} from 'node:crypto';
import {fail} from './domain.mjs';
const permissions={owner:['controls.read','audit.read','registry.read','registry.manage','registry.publish','jobs.read','controls.pause','registry.disable','registry.notes'],operator:['controls.read','audit.read','registry.read','jobs.read','controls.pause','registry.disable'],reviewer:['controls.read','registry.read','jobs.read'],support:['controls.read','jobs.read']};
export function staffRole(userId,env){if(!userId)return null;for(const [key,role]of [['DIRECTOR_ADMIN_IDS','owner'],['DIRECTOR_OPERATOR_IDS','operator'],['DIRECTOR_REVIEWER_IDS','reviewer'],['DIRECTOR_SUPPORT_IDS','support']])if((env[key]||'').split(',').map(x=>x.trim()).filter(Boolean).includes(userId))return role;return null;}
export const staffPermissions=role=>[...(permissions[role]||[])];
export function adminCommand(body,actorId,role){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['requestId','expectedRevision','command','reason','modelId','notes'].includes(k)))fail(400,'Invalid operational command fields.');
 const permission={pause_generation:'controls.pause',disable_model:'registry.disable',update_model_notes:'registry.notes'}[body.command];
 if(!permission||!staffPermissions(role).includes(permission))fail(403,'Your staff role cannot perform this command.');
 if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)fail(400,'A request identity and current control revision are required.');
 if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000)fail(400,'Give an operational reason of 5–1000 characters.');
 const needsModel=body.command!=='pause_generation';
 if(needsModel&&(typeof body.modelId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(body.modelId)))fail(400,'Choose a valid registry model.');
 if(!needsModel&&(body.modelId!==undefined||body.notes!==undefined)||body.command==='disable_model'&&body.notes!==undefined)fail(400,'This command does not accept those model fields.');
 if(body.command==='update_model_notes'&&(typeof body.notes!=='string'||body.notes.length>2000))fail(400,'Registry notes must be at most 2000 characters.');
 return {actorId,actorRole:role,requestId:body.requestId.toLowerCase(),expectedRevision:body.expectedRevision,command:body.command,reason:body.reason.trim(),modelId:needsModel?body.modelId:null,notes:body.command==='update_model_notes'?body.notes.trim():null};
}
export const defaultControl=()=>({revision:1,generationPaused:true,reason:'Production generation is disabled pending validation.',updatedAt:new Date().toISOString()});
export function applyAdminCommand(state,request){
 const control=state.operationalControl;if(!control||!Number.isSafeInteger(control.revision))fail(503,'Operational controls are unavailable. Generation remains held.');
 if((state.registryCommands||[]).some(c=>c.requestId===request.requestId))fail(409,'This request identity belongs to a registry command.');
 const previous=(state.adminCommands||[]).find(c=>c.requestId===request.requestId);
 if(previous){if(JSON.stringify(previous.request)!==JSON.stringify(request))fail(409,'This request identity belongs to a different command.');return {control:structuredClone(previous.after.control),command:structuredClone(previous),replayed:true};}
 if(request.expectedRevision!==control.revision)fail(409,'Operational settings changed. Refresh before issuing a new command.');
 const model=request.modelId?(state.models||[]).find(m=>m.id===request.modelId):null;if(request.modelId&&!model)fail(404,'Registry model not found.');
 const before={control:structuredClone(control),...(model?{model:structuredClone(model)}:{})};
 if(request.command==='pause_generation'){control.generationPaused=true;control.reason=request.reason;}
 else if(request.command==='disable_model')model.active=false;
 else if(request.command==='update_model_notes')model.capabilities={...model.capabilities,admin_notes:request.notes};
 else fail(400,'Unsupported operational command.');
 control.revision++;control.updatedAt=new Date().toISOString();
 const after={control:structuredClone(control),...(model?{model:structuredClone(model)}:{})};
 const command={id:randomUUID(),requestId:request.requestId,actorId:request.actorId,actorRole:request.actorRole,command:request.command,reason:request.reason,modelId:request.modelId,request:structuredClone(request),before,after,createdAt:control.updatedAt};
 state.adminCommands??=[];state.adminCommands.push(command);return {control:structuredClone(control),command:structuredClone(command),replayed:false};
}
export function normalizedControl(row){if(!row)return null;return {revision:Number(row.revision),generationPaused:row.generationPaused??row.generation_paused,reason:row.reason,updatedAt:row.updatedAt??row.updated_at};}
const auditState=s=>{const c=s?.control||s||{},m=s?.model||{};return {revision:c.revision,generationPaused:c.generationPaused??c.generation_paused,reason:c.reason,active:m.active,notes:m.capabilities?.admin_notes,purpose:m.capabilities?.purpose};};
export function visibleCommand(c){return {requestId:c.requestId??c.request_id,actorId:c.actorId??c.actor_id,actorRole:c.actorRole??c.actor_role,command:c.command,reason:c.reason??c.request?.reason,modelId:c.modelId??c.request?.modelId??c.request?.model_id??null,before:auditState(c.before??c.before_state),after:auditState(c.after??c.after_state),createdAt:c.createdAt??c.created_at};}

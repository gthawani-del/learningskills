import {fail} from './domain.mjs';
const owned=(state,owner,project)=>{if(!state.projects.some(p=>p.id===project&&p.ownerId===owner))fail(404,'Project not found.');};
export const localMediaIngestionMethods={
 async sourceUploads(owner,project){owned(this.state,owner,project);return structuredClone((this.state.sourceUploads||[]).filter(r=>r.projectId===project&&r.ownerId===owner));},
 async sourceUpload(owner,project,id){const row=(await this.sourceUploads(owner,project)).find(r=>r.id===id);if(!row)fail(404,'Upload not found.');return row;},
 async createSourceUpload(owner,project,row){return this.serial(()=>{
  owned(this.state,owner,project);const rows=this.state.sourceUploads||=[];
  const previous=rows.find(r=>r.projectId===project&&r.requestId===row.requestId);
  if(previous){if(previous.manifestHash!==row.manifestHash)fail(409,'Upload request conflicts with the saved file.');return previous;}
  const pending=rows.filter(r=>r.projectId===project&&r.status!=='cancelled'&&Date.parse(r.expiresAt)>Date.now());
  if(pending.length>=10||pending.reduce((n,r)=>n+r.manifest.size,0)+row.manifest.size>512*1024*1024)fail(409,'Finish or cancel existing source uploads before adding more.');
  rows.push(row);return row;
 });},
 async transitionSourceUpload(owner,project,id,status){return this.serial(()=>{
  owned(this.state,owner,project);const row=(this.state.sourceUploads||[]).find(r=>r.id===id&&r.projectId===project&&r.ownerId===owner);if(!row)fail(404,'Upload not found.');
  if(!['inspection_pending','cancelled'].includes(status)||row.status!==status&&row.status!=='uploading'&&status!=='cancelled')fail(409,'The upload state changed. Refresh before continuing.');
  row.status=status;return row;
 });}
};
export const cloudMediaIngestionMethods={
 async sourceUploads(owner,project){await this.get(project,owner);const rows=await this.request(`/rest/v1/director_source_uploads?project_id=eq.${project}&owner_id=eq.${owner}&order=created_at.desc&limit=100`);return rows.map(r=>r.document);},
 async sourceUpload(owner,project,id){await this.get(project,owner);const rows=await this.request(`/rest/v1/director_source_uploads?id=eq.${id}&project_id=eq.${project}&owner_id=eq.${owner}`);if(!rows.length)fail(404,'Upload not found.');return rows[0].document;},
 async createSourceUpload(owner,project,row){return this.request('/rest/v1/rpc/director_create_source_upload',{method:'POST',body:{p_actor:owner,p_project:project,p_document:row}});},
 async transitionSourceUpload(owner,project,id,status){return this.request('/rest/v1/rpc/director_transition_source_upload',{method:'POST',body:{p_actor:owner,p_project:project,p_upload:id,p_status:status}});}
};

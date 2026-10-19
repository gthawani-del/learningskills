import {recordDependencies} from './production-records.mjs';
import {hash} from './domain.mjs';
import {briefPlanningContext} from './public/creative-brief-core.js';
import {screenplayContext} from './public/screenplay-core.js';
// A deterministic review graph, not a generation authorization or a claim of media quality.
export function productionState(project,assets,approvals){
 const approved=(key,version)=>approvals.filter(a=>a.artifactId===key&&a.version===version).at(-1)?.decision==='approved';
 const creative=briefPlanningContext(project,approvals),briefReady=!creative.brief||creative.approved;
 const script=screenplayContext(project,approvals),scriptReady=!project.screenplay||script.approved;
 const storyReady=briefReady&&scriptReady&&!!project.story.treatment.trim()&&approved('story',project.story.version);
 const nodes=[{id:'story',kind:'story',version:project.story.version,contentHash:hash(project.story),approved:storyReady,dependencies:[],holds:storyReady?[]:['Review and approve the current story version.']}];
 if(creative.brief){nodes.unshift({id:'brief',kind:'brief',version:creative.brief.version,contentHash:hash(creative.brief),approved:creative.approved,dependencies:[],holds:creative.approved?[]:[creative.stale?'The source brief changed. Update and approve the interpretation.':'Review and approve the current creative brief and assumptions.']});nodes.find(n=>n.id==='story').dependencies.push('brief');if(!briefReady)nodes.find(n=>n.id==='story').holds.push('Current creative brief approval required.');}
 if(project.screenplay){nodes.push({id:'screenplay',kind:'screenplay',version:script.screenplay?.version||0,contentHash:hash(script.screenplay),approved:script.approved,dependencies:creative.brief?['brief']:[],holds:script.approved?[]:[!script.screenplay?'Create and review a working screenplay from the brief or supplied source.':script.stale?'The script source context changed. Review a current screenplay version.':'Review the script and its limited originality coverage before approval.']});nodes.find(n=>n.id==='story').dependencies.push('screenplay');if(!scriptReady)nodes.find(n=>n.id==='story').holds.push('Current screenplay approval and source review required.');}
 for(const asset of assets)nodes.push({id:'asset:'+asset.id,kind:'reference',version:asset.version,role:asset.role,contentHash:asset.checksum||null,dependencies:[],holds:[],approved:false});
 for(const scene of project.story.scenes)nodes.push({id:'scene:'+scene.id,kind:'scene',contentHash:hash(scene),dependencies:['story'],holds:[]});
 for(const shot of project.shots){
 const dependencies=['story'];const holds=[];if(!storyReady)holds.push('Current story approval required.');
 if(shot.sceneId){dependencies.push('scene:'+shot.sceneId);if(!project.story.scenes.some(s=>s.id===shot.sceneId))holds.push('Linked scene is missing.');}
 for(const [field,prefix]of [['referenceAssetId','image/'],['clipAssetId','video/']])if(shot[field]){dependencies.push('asset:'+shot[field]);if(!assets.some(a=>a.id===shot[field]&&a.mime.startsWith(prefix)))holds.push('Selected '+field+' is unavailable.');}
 const specificationApproved=approved(shot.id,shot.version);if(!specificationApproved)holds.push('Review and approve this shot specification version.');if(!shot.description.trim())holds.push('Shot direction is missing.');
 nodes.push({id:shot.id,kind:'shot',version:shot.version,contentHash:hash(shot),dependencies,specificationApproved,readyForRouteReview:holds.length===0,holds,mediaAcceptance:'not_established'});
 }
 const library=recordDependencies(project),records=project.production?.records||[],byId=new Map(records.map(r=>[r.id,r])),approvalCache=new Map();
 const approvalHolds=(id,path=new Set())=>{
  if(approvalCache.has(id))return approvalCache.get(id);
  const record=byId.get(id);if(!record)return ['A linked production record is missing.'];
  if(path.has(id))return ['Production dependency cycle requires review.'];
  const nextPath=new Set(path);nextPath.add(id);
  const holds=approved('record:'+id,record.currentVersion)?[]:[`Current production record approval required: ${id} v${record.currentVersion}.`];
  const snapshot=record.versions.find(v=>v.version===record.currentVersion);
  for(const dependency of snapshot?.dependencies||[])holds.push(...approvalHolds(dependency.recordId,nextPath));
  const result=[...new Set(holds)];approvalCache.set(id,result);return result;
 };
 for(const record of records){const review=library.records.find(r=>r.recordId===record.id);nodes.push({id:'record:'+record.id,kind:record.type,version:record.currentVersion,specificationApproved:approved('record:'+record.id,record.currentVersion),dependencies:review.dependencies.map(d=>'record:'+d.recordId),holds:[...new Set([...review.holds,...approvalHolds(record.id)])],mediaAcceptance:'not_established'});}
 for(const shot of project.shots){const node=nodes.find(n=>n.id===shot.id),review=library.shots.find(s=>s.shotId===shot.id);node.dependencies.push(...(shot.productionBindings||[]).map(b=>'record:'+b.recordId));node.holds.push(...(review?.holds||[]));for(const binding of shot.productionBindings||[])node.holds.push(...approvalHolds(binding.recordId));node.holds=[...new Set(node.holds)];node.readyForRouteReview=node.holds.length===0;}
 const order=project.shots.map(s=>s.id);
 return {projectId:project.id,projectVersion:project.version,nodes,shotOrder:order,adjacency:order.map((id,i)=>({shotId:id,previous:order[i-1]||null,next:order[i+1]||null})),generationAuthorized:false,scope:'Story, shot and production-library specification review only; route, budget, reference rights and generated-media review remain separate.'};
}

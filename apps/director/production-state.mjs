import {recordDependencies} from './production-records.mjs';
import {hash} from './domain.mjs';
// A deterministic review graph, not a generation authorization or a claim of media quality.
export function productionState(project,assets,approvals){
 const approved=(key,version)=>approvals.filter(a=>a.artifactId===key&&a.version===version).at(-1)?.decision==='approved';
 const storyReady=!!project.story.treatment.trim()&&approved('story',project.story.version);
 const nodes=[{id:'story',kind:'story',version:project.story.version,contentHash:hash(project.story),approved:storyReady,dependencies:[],holds:storyReady?[]:['Review and approve the current story version.']}];
 for(const asset of assets)nodes.push({id:'asset:'+asset.id,kind:'reference',version:asset.version,role:asset.role,contentHash:asset.checksum||null,dependencies:[],holds:[],approved:false});
 for(const scene of project.story.scenes)nodes.push({id:'scene:'+scene.id,kind:'scene',contentHash:hash(scene),dependencies:['story'],holds:[]});
 for(const shot of project.shots){
 const dependencies=['story'];const holds=[];if(!storyReady)holds.push('Current story approval required.');
 if(shot.sceneId){dependencies.push('scene:'+shot.sceneId);if(!project.story.scenes.some(s=>s.id===shot.sceneId))holds.push('Linked scene is missing.');}
 for(const [field,prefix]of [['referenceAssetId','image/'],['clipAssetId','video/']])if(shot[field]){dependencies.push('asset:'+shot[field]);if(!assets.some(a=>a.id===shot[field]&&a.mime.startsWith(prefix)))holds.push('Selected '+field+' is unavailable.');}
 const specificationApproved=approved(shot.id,shot.version);if(!specificationApproved)holds.push('Review and approve this shot specification version.');if(!shot.description.trim())holds.push('Shot direction is missing.');
 nodes.push({id:shot.id,kind:'shot',version:shot.version,contentHash:hash(shot),dependencies,specificationApproved,readyForRouteReview:holds.length===0,holds,mediaAcceptance:'not_established'});
 }
 const library=recordDependencies(project);for(const record of project.production?.records||[]){const review=library.records.find(r=>r.recordId===record.id);nodes.push({id:'record:'+record.id,kind:record.type,version:record.currentVersion,specificationApproved:approved('record:'+record.id,record.currentVersion),dependencies:review.dependencies.map(d=>'record:'+d.recordId),holds:review.holds,mediaAcceptance:'not_established'});}
 for(const shot of project.shots){const node=nodes.find(n=>n.id===shot.id),review=library.shots.find(s=>s.shotId===shot.id);node.dependencies.push(...(shot.productionBindings||[]).map(b=>'record:'+b.recordId));node.holds.push(...(review?.holds||[]));node.holds=[...new Set(node.holds)];node.readyForRouteReview=node.holds.length===0;}
 const order=project.shots.map(s=>s.id);
 return {projectId:project.id,projectVersion:project.version,nodes,shotOrder:order,adjacency:order.map((id,i)=>({shotId:id,previous:order[i-1]||null,next:order[i+1]||null})),generationAuthorized:false,scope:'Story and shot specification review only; route, budget, reference rights and generated-media review remain separate.'};
}

// Shared, deterministic revision rules for browser drafts and server-owned projects.
export function sceneChanged(previous,next,oldId,newId=oldId){
 const value=(project,id)=>{const s=project.story.scenes.find(s=>s.id===id);return s?JSON.stringify({id:s.id,description:s.description}):null;};
 return !!newId&&value(previous,oldId)!==value(next,newId);
}
export const briefChanged=(previous,next)=>['premise','direction','language','duration'].some(k=>next[k]!==previous[k]);

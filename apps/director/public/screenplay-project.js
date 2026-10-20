import {applyScreenplayCommand,currentScreenplay} from './screenplay-core.js';
import {songDirectorContext} from './song-intelligence-core.js';
import {validateMusicTreatment} from './music-treatment-timing.js';

// Shared browser/server bridge. The screenplay is authoritative; the legacy story
// is a treatment/scene summary for existing production views, not a second script.
export function applyScreenplayProjectCommand(project,command,approvals=[]){
 const previous=currentScreenplay(project),next=applyScreenplayCommand(project,command,approvals),current=currentScreenplay(next);
 if(!current||current.version===previous?.version)return next;
 const document=current.document;
 if(project.format==='music_video'&&document.musicTiming)validateMusicTreatment(document,songDirectorContext(project,approvals));
 next.story={treatment:document.treatment,scenes:document.scenes.map(scene=>({id:scene.id,description:scene.heading})),version:(project.story?.version??0)+1};
 const oldScenes=new Map((previous?.document.scenes??[]).map(scene=>[scene.id,JSON.stringify(scene)]));
 const newScenes=new Map(document.scenes.map(scene=>[scene.id,JSON.stringify(scene)]));
 const oldTiming=new Map((previous?.document.musicTiming?.sequences||[]).map(sequence=>[sequence.sceneId,JSON.stringify(sequence)])),newTiming=new Map((document.musicTiming?.sequences||[]).map(sequence=>[sequence.sceneId,JSON.stringify(sequence)]));
 // Without explicit character-to-shot contracts, a changed character/world story
 // can affect every shot. Keep the media, but require renewed specifications.
 const globalChange=!!previous&&(['characters','logline','treatment'].some(key=>JSON.stringify(previous.document[key])!==JSON.stringify(document[key]))||JSON.stringify(previous.document.musicTiming?.source)!==JSON.stringify(document.musicTiming?.source)||JSON.stringify(previous.document.musicTiming?.range)!==JSON.stringify(document.musicTiming?.range));
 next.shots=(project.shots??[]).map(shot=>globalChange||shot.sceneId&&(oldScenes.get(shot.sceneId)!==newScenes.get(shot.sceneId)||oldTiming.get(shot.sceneId)!==newTiming.get(shot.sceneId))?{...shot,version:shot.version+1,status:'draft'}:structuredClone(shot));
 return next;
}

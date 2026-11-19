import {randomUUID} from 'node:crypto';
import {applyProductionRecord} from '../public/production-records-core.js';
import {newSongIntelligence} from '../public/song-intelligence-core.js';
export function musicVideoEditingFixture(){
 const master=randomUUID(),video=randomUUID(),projectId=randomUUID();let project={id:projectId,ownerId:randomUUID(),format:'music_video',version:1,duration:4,shots:[{id:'s',version:1}],production:{records:[]}};
 const assets=[{id:master,projectId,version:1,role:'master_song',scope:'project',mime:'audio/wav',checksum:'a'.repeat(64),checksumAlgorithm:'sha256-bytes',decodeVerified:true,durationSeconds:4,streams:[{type:'audio',sampleRate:8000,channels:1}]},{id:video,projectId,version:1,mime:'video/mp4',checksum:'b'.repeat(64),decodeVerified:true,durationSeconds:6,streams:[{type:'video',width:320,height:180}]}];
 const plan={kind:'music_video_plan_v1',master:{assetId:master,assetVersion:1,checksum:assets[0].checksum,durationMs:4000,timingBasis:'user_reviewed'},range:{startMs:0,endMs:4000},fps:24,sections:[{id:'song',label:'Song',startMs:0,endMs:4000,timingBasis:'user_reviewed'}],shots:[{shotId:'s',shotVersion:1,contractVersion:null,startMs:0,endMs:4000,role:'broll',syncClass:'no_sync',performers:[],timingBasis:'user_reviewed'}]};
 project=applyProductionRecord(project,{expectedVersion:project.version,type:'edit',name:'Song plan',content:plan,references:[{assetId:master,version:1}],dependencies:[]},assets);const planId=project.production.records[0].id;
 const intelligence=newSongIntelligence(plan.master);intelligence.lyrics={canonicalText:'  Literal lyrics  ',languages:[],singers:[],vocalMode:'sung',basis:'user_supplied'};
 project=applyProductionRecord(project,{expectedVersion:project.version,type:'edit',name:'Song intelligence',content:intelligence,references:[{assetId:master,version:1}],dependencies:[{recordId:planId,version:1}]},assets);
 const approvals=project.production.records.map(r=>({id:randomUUID(),projectId,artifactId:'record:'+r.id,version:1,decision:'approved'}));
 const outcomes=[{id:randomUUID(),projectId,type:'production_outcome',details:{kind:'media_outcome_v1',decision:'accepted',defects:[],supersedesReviewIds:[],asset:{id:video,version:1,checksum:assets[1].checksum,mime:'video/mp4',durationSeconds:6,decodeVerified:true,generated:null}}}];
 const body={expectedVersion:project.version,selections:[{shotId:'s',assetId:video,assetVersion:1,sourceInMs:1000,fit:'cover'}],finishing:{captions:[{text:'  Literal lyrics  ',startMs:0,endMs:4000}]},output:{width:160,height:90},acknowledgeTimeline:true};
 return {project,assets,approvals,outcomes,body,planId};
}
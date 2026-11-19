import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {applyProductionRecord} from '../public/production-records-core.js';
import {newSongIntelligence} from '../public/song-intelligence-core.js';
import * as edit from '../music-video-editing.mjs';
function fixture(){
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
test('timeline save derives exact full-song and canonical text as an ordinary unapproved production edit',()=>{
 assert.equal(typeof edit.saveMusicVideoTimeline,'function');const f=fixture(),p=edit.saveMusicVideoTimeline(f.project,f.body,f.assets,f.approvals,f.outcomes),context=edit.timelineContext(p,f.assets,f.approvals,f.outcomes);
 assert.equal(context.document.kind,'music_video_timeline_v1');assert.equal(context.document.finishing.canonicalLyrics,'  Literal lyrics  ');assert.equal(context.document.finishing.captions[0].text,'  Literal lyrics  ');assert.equal(context.readyForApproval,true);assert.equal(context.approved,false);assert.equal(context.ready,false);assert.ok(p.production.records.at(-1).versions[0].dependencies.some(d=>d.recordId===f.planId));
 f.approvals.push({id:randomUUID(),projectId:p.id,artifactId:'record:'+context.recordId,version:context.version,decision:'approved'});assert.equal(edit.timelineContext(p,f.assets,f.approvals,f.outcomes).ready,true);assert.equal(p.version,f.project.version+1);
});
test('source acceptance, inspected duration and canonical lyrics are enforced before save',()=>{
 for(const mutate of [f=>f.outcomes=[],f=>f.outcomes[0].details.decision='rejected',f=>f.outcomes[0].details.asset.checksum='c'.repeat(64),f=>f.assets[1].durationSeconds=4,f=>f.assets[1].decodeVerified=false,f=>f.body.finishing.canonicalLyrics='rewritten',f=>f.approvals[0].decision='revoked',f=>f.project.production.records[0].versions[0].content.range.startMs=1000,f=>f.body.songPlan={},f=>f.body.finishing='invalid']){const f=fixture();mutate(f);assert.throws(()=>edit.saveMusicVideoTimeline(f.project,f.body,f.assets,f.approvals,f.outcomes),e=>[400,409,422].includes(e.status));}
});
test('saved timeline is held after song-plan, intelligence, source approval or accepted outcome changes',()=>{
 for(const mutate of [f=>f.approvals[0].decision='revoked',f=>f.project.production.records[0].versions[0].content.shots[0].endMs=3000,f=>f.project.production.records[1].versions[0].content.lyrics.canonicalText='Changed words',f=>f.assets[1].version++,f=>f.outcomes.push({...f.outcomes[0],id:randomUUID(),details:{...f.outcomes[0].details,decision:'needs_correction',supersedesReviewIds:[f.outcomes[0].id]}})]){const f=fixture();f.project=edit.saveMusicVideoTimeline(f.project,f.body,f.assets,f.approvals,f.outcomes);mutate(f);const c=edit.timelineContext(f.project,f.assets,f.approvals,f.outcomes);assert.equal(c.readyForApproval,false);assert.ok(c.holds.length);}
});
test('unapproved stills and conflicted outcomes cannot masquerade as accepted media',()=>{
 const f=fixture();f.outcomes.push({...f.outcomes[0],id:randomUUID(),details:{...f.outcomes[0].details,decision:'rejected'}});assert.throws(()=>edit.saveMusicVideoTimeline(f.project,f.body,f.assets,f.approvals,f.outcomes),/accept|conflict/);
 const still=fixture();still.assets[1].mime='image/png';assert.throws(()=>edit.saveMusicVideoTimeline(still.project,still.body,still.assets,still.approvals,still.outcomes),/still|storyboard/);
});
test('motion timeline requires the explicitly selected reviewed take and current motion approval',()=>{
 const project={"shots": [{"id": "s", "clipAssetId": "clip"}], "production": {"records": [{"id": "spec", "type": "edit", "currentVersion": 1, "versions": [{"version": 1, "content": {"kind": "music_video_motion_spec_v1", "shotId": "s"}}]}, {"id": "take", "type": "take", "currentVersion": 1, "versions": [{"version": 1, "content": {"kind": "music_video_motion_selection_v1", "shotId": "s", "jobId": "job", "review": {"motion": true, "singing": true, "originalMaster": true}}, "references": [{"assetId": "clip", "version": 1}], "dependencies": [{"recordId": "spec", "version": 1}]}]}]}},asset={id:'clip',version:1,generated:{kind:'music_video_motion',jobId:'job',performanceBinding:{recordId:'spec',version:1,sourcePins:{assignment:{role:'singing'}}}}},approvals=[{artifactId:'record:spec',version:1,decision:'approved'}];
 assert.equal(typeof edit.reviewedMotionTake,'function');assert.equal(edit.reviewedMotionTake(project,asset,'s',approvals).id,'take');
 for(const change of [p=>p.shots[0].clipAssetId='other',p=>p.production.records[1].versions[0].content.review.singing=false,p=>p.production.records[1].versions[0].dependencies=[]]){const p=structuredClone(project);change(p);assert.throws(()=>edit.reviewedMotionTake(p,asset,'s',approvals),/review|selected|take/);}
 assert.throws(()=>edit.reviewedMotionTake(project,asset,'s',[...approvals,{artifactId:'record:spec',version:1,decision:'revoked'}]),/approval|review/i);
});

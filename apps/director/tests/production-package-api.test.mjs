import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {musicTreatmentFixture} from './music-treatment-fixture-server.mjs';
test('existing authenticated app exposes one source-bound complete treatment package and safe navigation',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),p=(await f.get('/director-production')).data.productionPackage;assert.equal(p.departments.length,17);assert.equal(p.coverage.selectedIntervalComplete,true);assert.equal(p.recommendation.sequences.at(-1).endMs,180000);assert.equal(p.costs.wholePlanTotalMicroUsd,null);
 const a=p.actions.find(a=>a.operation==='review_references'),body={requestId:randomUUID(),expectedVersion:p.projectVersion,sourceDigest:p.sourceDigest,actionId:a.id},result=await f.post('/director-production/actions',body);assert.equal(result.destination,'cast');assert.equal(result.generationAuthorized,false);assert.equal(f.store.state.jobs.length,0);
 await assert.rejects(()=>f.post('/director-production/actions',{...body,sourceDigest:'0'.repeat(64)}),{status:409});
});
test('production action cannot bypass import hold or manufacture financial permission',async()=>{
 const f=await musicTreatmentFixture({prepared:true}),p=(await f.get('/director-production')).data.productionPackage,a=p.actions.find(a=>a.operation==='review_references'),body={requestId:randomUUID(),expectedVersion:p.projectVersion,sourceDigest:p.sourceDigest,actionId:a.id};
 await assert.rejects(()=>f.post('/director-production/actions',{...body,generationAuthorized:true}),{status:400});
 const held={...f.project,version:f.project.version+1,importState:{status:'awaiting_media'}};await f.store.save(held,f.project.version);await assert.rejects(()=>f.post('/director-production/actions',body),{status:409});
});

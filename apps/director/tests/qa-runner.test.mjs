import test from 'node:test';
import assert from 'node:assert/strict';
import {selectChecks,browsers} from '../../../scripts/qa-director.mjs';
test('fast QA selects transitive storyboard consumers and its actual browser flow',async()=>{
 const selected=await selectChecks(['apps/director/public/storyboard-production-core.js']);
 assert.ok(selected.tests.includes('apps/director/tests/storyboard-production.test.mjs'));
 assert.ok(selected.tests.includes('apps/director/tests/storyboard-production-api.test.mjs'));
 assert.ok(selected.browsers.includes('storyboard-production-browser'));
});
test('shared interface and QA tooling changes retain broad regression coverage',async()=>{
 for(const path of ['apps/director/public/studio-v2.css','scripts/qa-director.mjs']){
  const selected=await selectChecks([path]);assert.deepEqual([...selected.browsers].sort(),[...browsers].sort());
  if(path.startsWith('scripts/'))assert.ok(selected.tests.length>60);
 }
});
test('unclassified runtime changes fail conservatively while prose avoids behavioral reruns',async()=>{
 const unknown=await selectChecks(['apps/director/new-runtime.mjs']);assert.ok(unknown.tests.length>60);assert.equal(unknown.browsers.length,browsers.length);
 const docs=await selectChecks(['docs/ENGINEERING_RELEASE.md']);assert.equal(docs.tests.length,0);assert.equal(docs.browsers.length,0);
});
test('database and persistence changes retain the existing SQL proof',async()=>{
 assert.equal((await selectChecks(['database/director-storyboard-production.sql'])).sql,true);
 assert.equal((await selectChecks(['apps/director/storyboard-production-store.mjs'])).sql,true);
 await assert.rejects(selectChecks(['../outside.mjs']),/inside this repository/);
});

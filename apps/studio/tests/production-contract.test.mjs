import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProductionContract} from '../intelligence/production-contract.mjs';
const brief = () => ({intent:'A quiet conversation in a vivid flower market.',product:'narrative',style:'photographic',durationSeconds:12,outputCount:1,shots:[{id:'shot-1',purpose:'Reveal a difficult decision',action:'She listens and sets down the cup.',seconds:12,framing:'wide',techniques:['hold']}]});
test('narrative preserves unresolved gaze and wide shot omits macro detail',()=>{
 const c=compileProductionContract(brief());
 assert.equal(c.shots[0].gaze,'unresolved');
 assert.ok(!c.shots[0].modules.includes('scale-appropriate-human-detail'));
 assert.deepEqual(c.unresolved,[{shotId:'shot-1',field:'gaze'}]);
 assert.equal(c.authorization.canSubmitPaidJob,false);
 assert.equal(c.shots[0].reviewStatus,'pending');
});
test('stylized brief retains its style without photographic exclusions',()=>{
 const b=brief();b.style='stylized';b.shots[0].framing='close';
 const c=compileProductionContract(b);
 assert.equal(c.style,'stylized');assert.ok(!c.shots[0].modules.includes('photographic-coherence'));
});
test('required hand interaction cannot be hidden and demands contact evidence',()=>{
 const b=brief();b.shots[0].requiresHandAction=true;b.shots[0].hideHands=true;
 assert.throws(()=>compileProductionContract(b),/cannot be hidden/);
 b.shots[0].hideHands=false;
 assert.ok(compileProductionContract(b).shots[0].requiredEvidence.includes('hand-contact-review'));
});
test('shot timing and quantity are validated without silently changing the brief',()=>{
 const b=brief();b.durationSeconds=15;assert.throws(()=>compileProductionContract(b),/match the target/);
 b.durationSeconds=12;b.outputCount=0;assert.throws(()=>compileProductionContract(b),/output count/);
});
test('duplicate identity and unknown techniques are rejected',()=>{
 const b=brief();b.shots.push({...b.shots[0]});assert.throws(()=>compileProductionContract(b),/unique stable ID/);
 b.shots.pop();b.shots[0].techniques=['magic-camera'];assert.throws(()=>compileProductionContract(b),/Unknown technique/);
});
test('avatar gaze is a default, explicit gaze takes precedence, input stays intact',()=>{
 const b=brief();b.product='avatar';assert.equal(compileProductionContract(b).shots[0].gaze,'toward-viewer');
 b.shots[0].gaze='toward interviewer';const snapshot=structuredClone(b);
 assert.equal(compileProductionContract(b).shots[0].gaze,'toward interviewer');assert.deepEqual(b,snapshot);
});
test('caller cannot grant paid authority or mark outputs accepted through input',()=>{
 const b=brief();b.authorization={canSubmitPaidJob:true};b.shots[0].reviewStatus='accepted';
 const c=compileProductionContract(b);assert.equal(c.authorization.status,'not-authorized');assert.equal(c.shots[0].reviewStatus,'pending');
});

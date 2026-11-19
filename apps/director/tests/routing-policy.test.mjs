import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newProject} from '../domain.mjs';
import {planningScope} from '../planning-policy.mjs';
import {saveRoutingPolicy,routingPolicyContext} from '../routing-policy.mjs';
const intent={qualityGoals:[{goal:'narrativeCoherence',weight:10,minimumScore:80}]};
const project=()=>newProject({format:'music_video'},'owner');
const approve=p=>{const r=p.production.records.at(-1);return [{id:randomUUID(),artifactId:'record:'+r.id,version:r.currentVersion,decision:'approved',ordinal:1}];};
test('optional policy preserves legacy behavior and saved policy needs existing approval',()=>{
 const p=project();assert.equal(routingPolicyContext(p,[],'director_turn').intent,undefined);
 const next=saveRoutingPolicy(p,{expectedVersion:p.version,intent,operations:['director_turn']},[]);assert.equal(p.production.records.length,0);assert.throws(()=>routingPolicyContext(next,[],'director_turn'),{status:409});
 const approved=approve(next),context=routingPolicyContext(next,approved,'director_turn');assert.deepEqual(context.intent,intent);assert.equal(context.policy.version,1);assert.equal(routingPolicyContext(next,approved,'write_script').intent,undefined);
 assert.notEqual(planningScope(p,[]).briefScopeHash,planningScope(next,[]).briefScopeHash);
});
test('revision/revocation/changed source hold policy and preserve prior versions',()=>{
 const p=saveRoutingPolicy(project(),{expectedVersion:1,intent,operations:['director_turn']},[]),a=approve(p);
 const next=saveRoutingPolicy(p,{expectedVersion:p.version,intent:{qualityGoals:[{goal:'narrativeCoherence',weight:5}]},operations:['director_turn']},[]);assert.equal(next.production.records[0].versions.length,2);assert.throws(()=>routingPolicyContext(next,a,'director_turn'),{status:409});
 assert.throws(()=>routingPolicyContext(p,[...a,{...a[0],decision:'revoked',ordinal:2}],'director_turn'),{status:409});
 assert.throws(()=>routingPolicyContext({...p,creativeBrief:{currentVersion:2}},a,'director_turn'),{status:409});
});
test('policy cannot choose providers grant spending or silently admit malformed intent',()=>{
 for(const bad of [{intent:{modelId:'preferred'}},{intent:{budgetMicroUsd:-1}},{intent:{},operations:['invented']},{intent:{},generationAuthorized:true}])assert.throws(()=>saveRoutingPolicy(project(),{expectedVersion:1,intent,operations:['director_turn'],...bad},[]),{status:400});
});

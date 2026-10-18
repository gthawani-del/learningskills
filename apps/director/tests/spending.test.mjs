import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newProject} from '../domain.mjs';
import {createCostQuote} from '../cost-quotes.mjs';
import {persistQuote, authorizeSpending, revokeSpending} from '../spending.mjs';
function fixture() {
 const now='2026-10-18T12:00:00.000Z',project=newProject({title:'Costs'},'owner');
 const model={id:'M17',provider:'fal',endpoint:'test/image',version:'v1',active:true,execution_tested:true,quality_validated:true,capabilities:{tasks:['image_edit']},schema_evidence:{verified:true,version:'s1',sourceUrl:'https://example.test/schema',endpoint:'test/image',modelVersion:'v1',inputSchemaHash:'a'.repeat(64),expiresAt:'2026-10-18T13:00:00.000Z'},price_version:'p1',price_evidence:{verified:true,configurationVerified:true,configuration:{},version:'p1',currency:'USD',unit:'request',unitMicroUsd:100,rounding:'ceil',expiresAt:'2026-10-18T13:00:00.000Z',sourceUrl:'https://example.test/price'}};
 const input={prompt:'Private creative text'};
 const quote=createCostQuote({project,artifactId:'story',artifactVersion:1,task:'image_edit',requirements:{},model,input,now});
 const state={projects:[project]};
 const base={actorId:'owner',projectId:project.id,expectedVersion:1};
 const persist={...base,requestId:randomUUID(),quote,input};
 const auth={...base,requestId:randomUUID(),quoteId:quote.id,maxMicroUsd:250,finishReserveMicroUsd:50};
 return {now,model,project,state,base,persist,auth};
}
test('durable quote and explicit cost authorization do not reserve or generate',()=>{
 const f=fixture(),view=persistQuote(f.state,f.persist,f);
 assert.equal(view.totalMicroUsd,100);assert(!('input'in view));assert(!('priceEvidence'in view));assert.equal(view.generationAuthorized,false);
 const auth=authorizeSpending(f.state,f.auth,f);assert.equal(auth.maxMicroUsd,250);assert.equal(auth.finishReserveMicroUsd,50);assert.equal(auth.generationAuthorized,false);assert.equal(auth.reservationCreated,false);assert.equal(f.state.spendingAuthorizations.length,1);assert.equal(f.state.spendingReservations,undefined);
 view.totalMicroUsd=1;assert.equal(f.state.quotes[0].quote.totalMicroUsd,100);
});
test('same request replays original after expiry/version changes; mutated requests conflict',()=>{
 const f=fixture();const q=persistQuote(f.state,f.persist,f);const a=authorizeSpending(f.state,f.auth,f);
 f.project.version=2;const later={model:f.model,now:'2026-10-18T15:00:00Z'};
 assert.deepEqual(persistQuote(f.state,f.persist,later),q);assert.deepEqual(authorizeSpending(f.state,f.auth,later),a);assert.equal(f.state.spendingAuthorizations.length,1);
 assert.throws(()=>authorizeSpending(f.state,{...f.auth,maxMicroUsd:300},later),{status:409});
 assert.throws(()=>authorizeSpending(f.state,{...f.auth,requestId:randomUUID()},later),{status:409});
});
test('ownership, exact versions, request IDs and strict command fields enforced',()=>{
 const f=fixture();assert.throws(()=>persistQuote(f.state,{...f.persist,actorId:'intruder'},f),{status:404});
 assert.throws(()=>persistQuote(f.state,{...f.persist,expectedVersion:2},f),{status:409});
 assert.throws(()=>persistQuote(f.state,{...f.persist,requestId:'bad'},f),{status:400});
 assert.throws(()=>persistQuote(f.state,{...f.persist,approved:true},f),{status:400});assert.equal(f.state.quotes,undefined);
});
test('caps must cover quote plus finish reserve without overflow',()=>{
 const f=fixture();persistQuote(f.state,f.persist,f);
 for(const [maxMicroUsd,finishReserveMicroUsd]of [[0,0],[100,1],[150,-1],[1.2,0],[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]])assert.throws(()=>authorizeSpending(f.state,{...f.auth,requestId:randomUUID(),maxMicroUsd,finishReserveMicroUsd},f),{status:400});
 assert.equal(f.state.spendingAuthorizations,undefined);
});
test('quote persistence and authorization reject altered inputs/evidence, stale artifacts and expiry',()=>{
 const f=fixture();assert.throws(()=>persistQuote(f.state,{...f.persist,input:{prompt:'Changed'}},f),{status:409});
 persistQuote(f.state,f.persist,f);
 const model=structuredClone(f.model);model.schema_evidence.version='s2';assert.throws(()=>authorizeSpending(f.state,f.auth,{model,now:f.now}),{status:409});
 assert.throws(()=>authorizeSpending(f.state,f.auth,{model:f.model,now:'2026-10-18T12:05:00.000Z'}),{status:409});
 f.project.story.version=2;assert.throws(()=>authorizeSpending(f.state,f.auth,f),{status:409});
});
test('explicit revocation is durable and idempotent; earlier auth replay remains original',()=>{
 const f=fixture();persistQuote(f.state,f.persist,f);const original=authorizeSpending(f.state,f.auth,f);
 const command={...f.base,requestId:randomUUID(),authorizationId:original.id,reason:'Changed creative direction'};
 const revoked=revokeSpending(f.state,command,f.now);assert.equal(revoked.status,'revoked');assert.equal(f.state.spendingAuthorizations[0].status,'revoked');
 assert.deepEqual(revokeSpending(f.state,command,f.now),revoked);assert.deepEqual(authorizeSpending(f.state,f.auth,f),original);
 assert.throws(()=>revokeSpending(f.state,{...command,reason:'Different'},f.now),{status:409});
});
test('intent remains bound and authorization checks current evaluation freshness',()=>{
 const f=fixture();
 f.model.routing_profiles=[{verified:true,task:'image_edit',modelId:f.model.id,endpoint:f.model.endpoint,modelVersion:'v1',evidenceVersion:'evaluation-1',sourceUrl:'https://example.test/evaluation',evaluatedAt:'2026-10-18T11:00:00Z',expiresAt:'2026-10-18T12:01:00Z',sampleCount:5,styles:['natural']}];
 const quote=createCostQuote({project:f.project,artifactId:'story',artifactVersion:1,task:'image_edit',requirements:{},intent:{style:'natural'},model:f.model,input:f.persist.input,now:f.now});
 f.persist.quote=quote;f.auth.quoteId=quote.id;
 const safe=persistQuote(f.state,f.persist,f);assert.deepEqual(safe.intent,{style:'natural'});
 assert.throws(()=>authorizeSpending(f.state,f.auth,{model:f.model,now:'2026-10-18T12:02:00Z'}),{status:409});
 const auth=authorizeSpending(f.state,f.auth,f);assert.equal(auth.quoteId,quote.id);
 assert.throws(()=>revokeSpending(f.state,{...f.base,requestId:randomUUID(),authorizationId:auth.id,reason:'no'},f.now),{status:400});
});
test('composite tariff snapshots remain exact through persistence and authorization',()=>{
 const f=fixture();f.model.price_evidence.tariff={schemaVersion:1,version:'p1',components:[{id:'base',unit:'request',rate:{numeratorMicroUsd:99,denominatorUnits:1},rounding:'ceil'}]};
 f.persist.quote=createCostQuote({project:f.project,artifactId:'story',artifactVersion:1,task:'image_edit',requirements:{},model:f.model,input:f.persist.input,now:f.now});f.auth.quoteId=f.persist.quote.id;
 assert.equal(persistQuote(f.state,f.persist,f).totalMicroUsd,99);assert.equal(authorizeSpending(f.state,f.auth,f).quotedMicroUsd,99);
});
test('profile attestation changes reject authorization even when intent still fits',()=>{
 const f=fixture();
 const profile={verified:true,task:'image_edit',modelId:f.model.id,endpoint:f.model.endpoint,modelVersion:'v1',evidenceVersion:'evaluation-1',sourceUrl:'https://example.test/evaluation',evaluatedAt:'2026-10-18T11:00:00Z',expiresAt:'2026-10-18T12:01:00Z',sampleCount:5,styles:['natural']};
 f.model.routing_profiles=[profile];
 const quote=createCostQuote({project:f.project,artifactId:'story',artifactVersion:1,task:'image_edit',requirements:{},intent:{style:'natural'},model:f.model,input:f.persist.input,now:f.now});
 assert.equal(quote.expiresAt,'2026-10-18T12:01:00.000Z');assert.equal(quote.intentEvidence.evidenceVersion,'evaluation-1');assert.match(quote.intentEvidence.evidenceHash,/^[a-f0-9]{64}$/);assert.equal(quote.intentEvidence.evaluatedAt,profile.evaluatedAt);
 f.persist.quote=quote;f.auth.quoteId=quote.id;
 const saved=persistQuote(f.state,f.persist,f);assert.deepEqual(saved.intentEvidence,quote.intentEvidence);
 profile.sampleCount=6;assert.throws(()=>authorizeSpending(f.state,f.auth,f),{status:409});
});
test('any new project version invalidates earlier quotes while exact replays stay original',()=>{
 const f=fixture();const saved=persistQuote(f.state,f.persist,f);assert.equal(saved.projectVersion,1);
 f.project.title='Renamed';f.project.stage='cast';f.project.version=2;
 assert.equal(f.project.story.version,1);
 assert.throws(()=>authorizeSpending(f.state,{...f.auth,expectedVersion:2},f),{status:409});
 assert.deepEqual(persistQuote(f.state,f.persist,f),saved);
 const freshPersist={...f.persist,requestId:randomUUID(),expectedVersion:2};assert.throws(()=>persistQuote(f.state,freshPersist,f),{status:409});
});

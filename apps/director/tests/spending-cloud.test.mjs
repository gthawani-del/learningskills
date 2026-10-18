import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudSpendingMethods} from '../spending-store.mjs';
import {SupabaseStore} from '../store.mjs';

const quote={id:'a'.repeat(64),projectId:'project',artifactId:'story',artifactVersion:1,modelId:'M19',endpoint:'speech',task:'speech_synthesis',requirements:{},currency:'USD',totalMicroUsd:100,estimateOnly:true,generationAuthorized:false,payload:{text:'private script'},priceEvidence:{private:'pricing details'}};
const authorization={id:'authorization',project_id:'project',actor_id:'owner',proposal_id:'proposal',max_micro_usd:200,finish_reserve_micro_usd:50,revoked_at:null};
const adapter=overrides=>Object.assign({},cloudSpendingMethods,overrides);

test('cloud spending reads reject foreign ownership before querying service-role histories',async()=>{
 let calls=0;
 const store=adapter({async get(){throw Object.assign(new Error('Project not found.'),{status:404});},async request(){calls++;},async allRows(){calls++;}});
 await assert.rejects(store.spendingSummary('foreign','project'),e=>e.status===404);
 await assert.rejects(store.readCostQuote('foreign','project',quote.id),e=>e.status===404);
 await assert.rejects(store.replayCostQuote({actorId:'foreign',projectId:'project',requestId:'request',requestFingerprint:'fingerprint'}),e=>e.status===404);
 assert.equal(calls,0);
});

test('cloud spending summaries expose financial receipts without provider payload or pricing internals',async()=>{
 const paths=[];
 const store=adapter({async get(id,owner){assert.equal(id,'project');assert.equal(owner,'owner');return {};},async allRows(path){paths.push(path);if(path.includes('director_quote_records'))return [{quote,proposal_id:'proposal'}];if(path.includes('director_budget_authorizations'))return [authorization];return [{id:'job',status:'unknown',charge_state:'unknown',reserved_micro_usd:100,provider_request_id:'private-provider-id'}];}});
 const result=await store.spendingSummary('owner','project');
 assert.equal(result.generationEnabled,false);
 assert.equal(result.authorizations[0].quoteId,quote.id);
 assert.equal(result.authorizations[0].quotedMicroUsd,100);
 assert.equal(result.reservations[0].chargeState,'unknown');
 assert.ok(paths.every(path=>path.includes('project_id=eq.project')));
 assert.ok(!JSON.stringify(result).includes('private'));
 assert.equal(result.quotes[0].priceEvidence,undefined);
});

test('cloud quote replay delegates exact identity to RPC and projects its stored quote',async()=>{
 const command={actorId:'owner',projectId:'project',requestId:'request',requestFingerprint:'fingerprint'};
 const store=adapter({async get(){return {};},async spendingRPC(name,body){assert.equal(name,'director_spending_replay');assert.deepEqual(body,{p_actor_id:'owner',p_project_id:'project',p_request_id:'request',p_request_fingerprint:'fingerprint'});return {quote,replayed:true,proposal:{payload:{text:'private'}}};}});
 const result=await store.replayCostQuote(command);
 assert.equal(result.id,quote.id);
 assert.equal(result.payload,undefined);
 assert.equal(result.priceEvidence,undefined);
});

test('existing authorization receipts use transactional replay rather than new model validation',async()=>{
 const command={actorId:'owner',projectId:'project',requestId:'request',expectedVersion:1,quoteId:quote.id,maxMicroUsd:200,finishReserveMicroUsd:50};
 const saved={quote:{...quote,expiresAt:'2026-10-18T00:00:00.000Z'}};
 const store=adapter({async get(){return {id:'project',ownerId:'owner',version:2};},async readCostQuote(){return saved;},async request(path){assert.ok(path.includes('director_spending_commands?project_id=eq.project&request_id=eq.request'));return [{command:'authorize_quote'}];},async readModel(){assert.fail('Replay must be decided by the transactional RPC.');},async spendingRPC(name,body){assert.equal(name,'director_authorize_quote');assert.equal(body.p_expected_version,1);assert.equal(body.p_quote_id,quote.id);assert.equal(body.p_actor_id,'owner');return {authorization,replayed:true};}});
 const result=await store.authorizeCostQuote(command);
 assert.equal(result.id,authorization.id);
 assert.equal(result.generationAuthorized,false);
 assert.equal(result.reservationCreated,false);
});

test('cloud RPC failures do not expose database/provider payload messages',async()=>{
 const store=new SupabaseStore({url:'https://example.test',key:'test-only',fetcher:async()=>new Response(JSON.stringify({message:'secret-provider-payload: private-script'}),{status:500,headers:{'content-type':'application/json'}})});
 await assert.rejects(store.spendingRPC('director_authorize_quote',{}),e=>e.status===502&&!e.message.includes('secret')&&!e.message.includes('private-script'));
});

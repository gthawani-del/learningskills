import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../store.mjs';
import { visiblePlanningCall } from '../planning-store.mjs';
import { hash } from '../domain.mjs';
const owner = 'owner'; const projectId = 'project';
function mockStore(handler, { foreign = false } = {}) {
  const calls = [];
  const store = new SupabaseStore({ url: 'https://workspace.example', key: 'service-secret', fetcher: async (url, options) => {
    const path = url.replace('https://workspace.example', '');
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, method: options.method, body });
    const value = path.startsWith('/rest/v1/director_projects?') ? foreign ? [] : [{ id: projectId, owner_id: owner, brief: {}, title: 'Film', stage: 'brief' }] : await handler(path, body, options);
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  return { store, calls };
}
const reservation = { id: 'call', projectId, status: 'held', submitClaimed: true, quotedMicroUsd: 100 };
const saved = { reservation, request: { body: { input: 'private screenplay' } }, profileSnapshot: { secret: 'private model evidence' }, providerResponseId: 'resp_123', result: { status: 'in_progress' } };
test('cloud planning summary read and replay enforce project ownership before privileged queries', async () => {
  const { store, calls } = mockStore(() => assert.fail('Foreign owner must not reach RPC or command history'), { foreign: true });
  for (const action of [() => store.planningSummary('foreign', projectId), () => store.readPlanningCall('foreign', projectId, 'call'), () => store.replayPlanningCall({actorId:'foreign',projectId,requestId:'request'}), () => store.replayPlanningDecision('grant_planning',{actorId:'foreign',projectId,requestId:'request'})]) await assert.rejects(action(), error => error.status === 404);
  assert.equal(calls.length, 4); assert.ok(calls.every(call => call.path.startsWith('/rest/v1/director_projects?')));
});
test('cloud summary and internal call read use owner-bound typed RPC parameters', async () => {
  const {store,calls}=mockStore((path,body)=>{
    if(path.endsWith('director_planning_summary')){assert.deepEqual(body,{p_actor_id:owner,p_project_id:projectId});return{consents:[],calls:[reservation]};}
    if(path.endsWith('director_planning_read')){assert.deepEqual(body,{p_actor_id:owner,p_project_id:projectId,p_reservation_id:'call'});return saved;}
    assert.fail(path);
  });
  const summary=await store.planningSummary(owner,projectId);assert.equal(summary.calls[0].id,'call');assert.equal(summary.calls[0].status,'submitted');assert.equal(summary.calls[0].chargeState,'held');
  const internal=await store.readPlanningCall(owner,projectId,'call');
  assert.equal(internal.request.body.input,'private screenplay');assert.equal(internal.profileSnapshot.secret,'private model evidence');
  const visible=visiblePlanningCall(internal);
  assert.equal(visible.id,'call');assert.equal(visible.status,'submitted');assert.equal(visible.chargeState,'held');assert.equal(visible.providerResponseId,'resp_123');
  assert.equal(visible.request,undefined);assert.equal(visible.profileSnapshot,undefined);assert.ok(!JSON.stringify(visible).includes('private'));
  assert.equal(calls.filter(call=>call.method==='POST').length,2);
});
test('reserve command binds server-derived actor profile scope and saved request extras',async()=>{
  const command={actorId:owner,projectId,expectedVersion:2,requestId:'command',consentId:'consent',operation:'screenplay',requestHash:'hash',quotedMicroUsd:100};
  const options={scope:{projectVersion:2},profile:{modelId:'O01'},request:{version:'director-planning-v1',body:{input:'private'}},quote:{totalMicroUsd:100},apiRequest:{actorId:owner,projectId,requestId:'api-request',operation:'screenplay'}};
  const {store}=mockStore((path,body)=>{
    assert.equal(path,'/rest/v1/rpc/director_planning_command');
    assert.equal(body.p_command,'reserve_planning');assert.equal(body.p_actor_id,owner);assert.equal(body.p_project_id,projectId);assert.equal(body.p_expected_version,2);assert.equal(body.p_request_id,'command');
    assert.deepEqual(body.p_scope,options.scope);assert.deepEqual(body.p_profile,options.profile);
    assert.deepEqual(body.p_body.request,options.request);assert.deepEqual(body.p_body.boundQuote,options.quote);assert.deepEqual(body.p_body.apiRequest,options.apiRequest);assert.equal(body.p_body.apiRequestFingerprint,hash(options.apiRequest));
    assert.equal(body.p_body.actorId,undefined);assert.equal(body.p_body.projectId,undefined);assert.equal(body.p_body.expectedVersion,undefined);assert.equal(body.p_body.requestId,undefined);
    return{result:reservation};
  });
  assert.deepEqual(await store.planningCommand('reserve_planning',command,options),reservation);
});
test('unknown settlement omits absent usage rather than sending misleading null accounting',async()=>{
  const {store}=mockStore((path,body)=>{
    assert.equal(path,'/rest/v1/rpc/director_planning_command');assert.equal(body.p_command,'settle_planning');assert.equal(body.p_body.outcome,'unknown');
    assert.equal(Object.hasOwn(body.p_body,'usage'),false);assert.equal(body.p_scope,null);assert.equal(body.p_profile,null);
    return{result:{...reservation,status:'unknown'}};
  });
  const result=await store.planningCommand('settle_planning',{actorId:owner,projectId,expectedVersion:2,requestId:'settle',reservationId:'call',outcome:'unknown'});
  assert.equal(result.status,'unknown');
});
test('record status and response identity use durable RPC mutations',async()=>{
  const {store,calls}=mockStore((path,body)=>{
    assert.equal(body.p_actor_id,owner);assert.equal(body.p_project_id,projectId);assert.equal(body.p_reservation_id,'call');
    if(path.endsWith('director_planning_record_response')){assert.equal(body.p_response_id,'resp_123');return{saved:true};}
    if(path.endsWith('director_planning_record_status')){assert.deepEqual(body.p_result,{status:'unknown',normalizationError:'Incomplete provider metadata'});return{saved:true};}
    assert.fail(path);
  });
  assert.equal((await store.recordPlanningResponse(owner,projectId,'call','resp_123')).saved,true);
  assert.equal((await store.savePlanningResult(owner,projectId,'call',{status:'unknown',normalizationError:'Incomplete provider metadata'})).saved,true);
  assert.equal(calls.length,2);assert.ok(calls.every(call=>call.method==='POST'));
});
test('grant receipt replay retains original identity after expiry and rejects changed decisions',async()=>{
  const command={actorId:owner,projectId,requestId:'grant-request',expectedVersion:1,maxMicroUsd:1000,finishReserveMicroUsd:100,maxCalls:2,expiresAt:'2000-01-01T00:00:00Z'};
  const {actorId,expectedVersion,requestId,...rest}=command;delete rest.projectId;
  const receipt={command:'grant_planning',request:{actorId,expectedVersion,body:rest},response:{id:'consent-original',expiresAt:command.expiresAt}};
  const {store}=mockStore((path)=>{assert.ok(path.includes('director_planning_commands?project_id=eq.project&request_id=eq.grant-request'));return[receipt];});
  assert.deepEqual(await store.replayPlanningDecision('grant_planning',command),receipt.response);
  await assert.rejects(store.replayPlanningDecision('grant_planning',{...command,maxMicroUsd:2000}),error=>error.status===409);
  await assert.rejects(store.replayPlanningDecision('revoke_planning',command),error=>error.status===409);
});
test('call replay sends exact server request fingerprint and returns saved internal identity',async()=>{
  const command={actorId:owner,projectId,requestId:'api-request',operation:'screenplay'};
  const {store}=mockStore((path,body)=>{assert.equal(path,'/rest/v1/rpc/director_planning_replay');assert.deepEqual(body,{p_actor_id:owner,p_project_id:projectId,p_request_id:'api-request',p_request_fingerprint:hash(command)});return saved;});
  assert.equal((await store.replayPlanningCall(command)).providerResponseId,'resp_123');
});
test('database errors redact provider keys scripts and raw database messages',async()=>{
  const store=new SupabaseStore({url:'https://workspace.example',key:'service-secret',fetcher:async()=>new Response(JSON.stringify({message:'OPENAI_API_KEY=private-provider-key; screenplay=private-script; SQL details',details:'service-secret'}),{status:500,headers:{'Content-Type':'application/json'}})});
  await assert.rejects(store.planningCommand('settle_planning',{actorId:owner,projectId,expectedVersion:1,requestId:'settle',reservationId:'call',outcome:'unknown'}),error=>error.status===502&&!/private|secret|OPENAI|SQL/.test(error.message));
});

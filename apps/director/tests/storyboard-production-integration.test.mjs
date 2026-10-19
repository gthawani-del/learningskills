import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../server.mjs';
import { LocalStore } from '../store.mjs';
import { createImportController } from '../imports.mjs';
import { artifacts } from '../domain.mjs';
import { currentStoryboardSequence } from '../public/storyboard-handoff-core.js';
import { referenceSession } from './reference-fixture-server.mjs';
import { storyboardProductionFixture } from './storyboard-production-fixture-server.mjs';

async function request(f, suffix, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]); Object.assign(req, { url: '/api/projects/' + f.p.id + suffix, method: body === undefined ? 'GET' : 'POST', headers: { host: 'localhost', 'content-type': 'application/json', cookie: 'director_session=' + referenceSession }, socket: { remoteAddress: '127.0.0.1' } });
  let status, data; await f.handler(req, { setHeader() {}, writeHead(value) { status = value; this.headersSent = true; }, end(value) { data = value; } }); const value = JSON.parse(String(data)); assert.ok([200,201].includes(status), JSON.stringify({ status, ...value })); if (value.project) f.p = value.project; return value;
}
async function setup() { const f = await storyboardProductionFixture({ prepared: true }); return { ...f, p: f.project, handler: await createHandler(f) }; }
async function context(f) { return (await request(f, '/storyboard-production')).storyboardProductionContext; }
async function frame(f, id = f.p.shots[0].id) { return (await context(f)).shots.find(s => s.shotId === id); }
async function command(f, action, fields = {}) { return request(f, '/storyboard-production', { expectedVersion: f.p.version, action, ...fields }); }
async function approvePlan(f) { return request(f, '/approvals', { expectedVersion: f.p.version, artifactId: 'storyboard_sequence', version: currentStoryboardSequence(f.p).version, decision: 'approved', ackPlanningOnly: true }); }
async function selectedFrame(f, id = f.p.shots[0].id) {
  const s = await frame(f,id); await request(f, '/approvals', { expectedVersion: f.p.version, artifactId: 'storyboard_brief:' + id, version: s.current.version, decision: 'approved', acknowledgeFrameDirection: true });
  await request(f, '/spending-budget', { expectedVersion: f.p.version, requestId: randomUUID(), budgetMicroUsd: 1000000, finishReserveMicroUsd: 0 });
  const { quote } = await request(f, '/storyboard-production/quotes', { expectedVersion: f.p.version, requestId: randomUUID(), shotId: id, modelId: 'F-storyboard-frame-local', shareReferences: true });
  const { authorization } = await request(f, '/spending-authorizations', { expectedVersion: f.p.version, requestId: randomUUID(), quoteId: quote.id, maxMicroUsd: quote.totalMicroUsd, finishReserveMicroUsd: 0 });
  const { job } = await request(f, '/storyboard-production/jobs', { expectedVersion: f.p.version, requestId: randomUUID(), quoteId: quote.id, authorizationId: authorization.id }); await request(f, '/jobs/' + job.id + '/poll', {});
  const image = await request(f, '/storyboard-production/import', { jobId: job.id }); await command(f, 'select', { shotId: id, candidateId: image.candidate.id, acknowledgeReview: true });
  const selected = await frame(f,id); await request(f, '/approvals', { expectedVersion: f.p.version, artifactId: 'storyboard_frame:' + id, version: selected.selection.version, decision: 'approved', acknowledgeFrameReview: true }); return image;
}

test('an approved generated still is its own artifact and leaves approved shot plans, reference decisions and movie media unchanged', async () => {
  const f = await setup(), before = structuredClone({ shots: f.p.shots, handoff: f.p.storyboardHandoff, references: f.p.referenceProduction, screenplay: f.p.screenplay });
  const image = await selectedFrame(f); assert.equal((await frame(f)).selectionApproved, true); assert.deepEqual(f.p.shots,before.shots); assert.deepEqual(f.p.storyboardHandoff,before.handoff); assert.deepEqual(f.p.referenceProduction,before.references); assert.deepEqual(f.p.screenplay,before.screenplay);
  const saved = artifacts(f.p); assert.equal(saved.filter(a => a.kind === 'storyboard_brief').length,2); assert.equal(saved.filter(a => a.kind === 'storyboard_frame').length,1); assert.equal((await context(f)).generationAuthorized,false); assert(f.p.shots.every(s => !s.clipAssetId)); assert.equal(image.asset.mime,'image/png');
});

test('changing one frame direction preserves its previous candidates and unrelated frame approval', async () => {
  const f = await setup(), first = f.p.shots[0].id, other = f.p.shots[1].id; await selectedFrame(f, first); await selectedFrame(f,other);
  const prior = await frame(f,first), untouched = await frame(f,other), history = structuredClone(f.p.storyboardProduction.selections);
  await command(f,'update',{shotId:first,document:{...prior.current.document,direction:prior.current.document.direction+' Retain the foreground contact point in this revised frame.'}});
  const changed=await frame(f,first);assert.equal(changed.current.version,prior.current.version+1);assert.equal(changed.selectionApproved,false);assert.equal(changed.candidates.length,1);assert.deepEqual(f.p.storyboardProduction.selections,history);assert.deepEqual((await frame(f,other)).current,untouched.current);assert.equal((await frame(f,other)).selectionApproved,true);assert.equal(f.counters().submits,2);
});

test('reordering and reviewing the whole sequence preserves unchanged approved frames without re-generation', async () => {
  const f = await setup(); await selectedFrame(f); const prior = await frame(f), before = structuredClone(f.p.storyboardProduction);
  await request(f,'/storyboard-handoff',{expectedVersion:f.p.version,action:'reorder',shotIds:currentStoryboardSequence(f.p).shots.map(s=>s.shotId).reverse()});
  assert.equal((await frame(f,prior.shotId)).directionApproved,false);assert.equal((await frame(f,prior.shotId)).selectionApproved,false);
  await approvePlan(f); const restored=await frame(f,prior.shotId);assert.deepEqual(restored.current,prior.current);assert.deepEqual(restored.selection,prior.selection);assert.equal(restored.selectionApproved,true);assert.deepEqual(f.p.storyboardProduction,before);assert.equal(f.counters().submits,1);
});

test('a neighboring shot contract can be revised and the plan reviewed without invalidating this exact frame spec', async () => {
  const f = await setup(); await selectedFrame(f); const prior = await frame(f), neighbor = (await request(f,'/storyboard-handoff')).storyboardContext.shots.find(s=>s.id!==prior.shotId);
  await request(f,'/storyboard-handoff',{expectedVersion:f.p.version,action:'update',shotId:neighbor.id,document:{...neighbor.current.document,title:'The neighboring waiting-room coverage is revised'}});
  assert.equal((await frame(f,prior.shotId)).selectionApproved,false);
  await request(f,'/storyboard-handoff',{expectedVersion:f.p.version,action:'review_sequence',acknowledgeShotChanges:true});await approvePlan(f);
  const restored=await frame(f,prior.shotId);assert.deepEqual(restored.current,prior.current);assert.equal(restored.selectionApproved,true);assert.equal(f.counters().submits,1);
});

test('an own-shot contract change holds its frame and explicit refresh preserves reviewed direction while updating source pins', async () => {
  const f = await setup(); await selectedFrame(f); const prior=await frame(f), contract=(await request(f,'/storyboard-handoff')).storyboardContext.shots.find(s=>s.id===prior.shotId), oldSelections=structuredClone(f.p.storyboardProduction.selections);
  await request(f,'/storyboard-handoff',{expectedVersion:f.p.version,action:'update',shotId:prior.shotId,document:{...contract.current.document,camera:contract.current.document.camera+' Review a slightly lower motivated camera position.'}});await request(f,'/storyboard-handoff',{expectedVersion:f.p.version,action:'review_sequence',acknowledgeShotChanges:true});await approvePlan(f);
  assert.equal((await frame(f,prior.shotId)).sourceStale,true);await command(f,'refresh',{shotId:prior.shotId,acknowledgeSourceChange:true});const refreshed=await frame(f,prior.shotId);assert.equal(refreshed.current.version,prior.current.version+1);assert.equal(refreshed.current.document.direction,prior.current.document.direction);assert.deepEqual(refreshed.current.document.visibleCharacterIds,prior.current.document.visibleCharacterIds);assert.equal(refreshed.current.document.aspectRatio,prior.current.document.aspectRatio);assert.equal(refreshed.directionApproved,false);assert.equal(refreshed.selectionApproved,false);assert.deepEqual(f.p.storyboardProduction.selections,oldSelections);assert.equal(f.counters().submits,1);
});

test('device import preserves storyboard frame histories but cannot import frame receipts, approvals or generation spending', async () => {
  const f=await setup();await selectedFrame(f);const source={...structuredClone(f.p),id:'device-'+f.p.id,approvals:await f.store.records('approvals',f.p.id),storyboardCandidates:await f.store.storyboardCandidates(f.p.ownerId,f.p.id),projectBudgetMicroUsd:999999999};
  const store=await new LocalStore().init(),importer=createImportController({store,storage:{}}),body={sourceId:source.id,project:source,assets:[]},pending=await importer.start('receiving-owner',body),copied=await importer.complete('receiving-owner',pending.id);
  assert.deepEqual(copied.storyboardProduction,f.p.storyboardProduction);assert.equal(copied.approvals,undefined);assert.equal(copied.storyboardCandidates,undefined);assert.equal(copied.projectBudgetMicroUsd,undefined);assert.deepEqual(await store.storyboardCandidates('receiving-owner',copied.id),[]);assert.deepEqual(await store.records('approvals',copied.id),[]);assert.equal(store.state.jobs.length,0);
  const forged=structuredClone(body);forged.project.storyboardProduction.approved=true;await assert.rejects(importer.start('receiving-owner',forged),{status:400});
});

test('guarded frame persistence rejects rewritten or deleted histories and invented historical contract pins', async () => {
  const f=await setup();await selectedFrame(f);const before=structuredClone(f.p),expectedApprovalId=(await f.store.records('approvals',f.p.id)).at(-1).id;
  const mutations=[
    p=>{p.storyboardProduction.shots[0].versions[0].document.direction='A replacement silently overwrites previously reviewed frame direction.';},
    p=>{p.storyboardProduction.shots.pop();},
    p=>{p.storyboardProduction.selections[0].assetId=randomUUID();},
    p=>{const record=p.storyboardProduction.shots[0],prior=record.versions.at(-1);record.versions.push({...structuredClone(prior),version:prior.version+1,contractVersion:99,createdAt:new Date().toISOString()});record.currentVersion++;},
  ];
  for(const mutate of mutations){const candidate=structuredClone(before);candidate.version++;mutate(candidate);await assert.rejects(f.store.saveStoryboardProduction(candidate,before.version,{expectedApprovalId}),{status:409});assert.deepEqual(await f.store.get(before.id,before.ownerId),before);}
  assert.equal(f.counters().submits,1);assert.equal(f.store.state.jobs.length,1);
});

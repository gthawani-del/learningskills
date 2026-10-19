import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../server.mjs';
import { LocalStore } from '../store.mjs';
import { currentStoryboardSequence } from '../public/storyboard-handoff-core.js';
import { currentScreenplay } from '../public/screenplay-core.js';
import { departmentDependencyPolicy } from '../public/department-plan-core.js';
import { syntheticDepartmentModel } from './department-fixture-server.mjs';
import { storyboardFixture } from './storyboard-fixture-server.mjs';

async function call(handler, path, body, method = body === undefined ? 'GET' : 'POST') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { url: path, method, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
  let status, data; const res = { setHeader() {}, writeHead(value) { status = value; this.headersSent = true; }, end(value) { data = value; } };
  await handler(req, res); return { status, json: JSON.parse(String(data)) };
}
const ok = r => assert.ok([200, 201].includes(r.status), JSON.stringify(r));
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'director-storyboard-api-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'store.json'), f = await storyboardFixture({ file, ...options });
  return { ...f, file, p: f.project, handler: await createHandler({ env: f.env, store: f.store, planningProvider: f.planningProvider }) };
}
const base = f => `/api/projects/${f.p.id}`;
async function context(f) { const r = await call(f.handler, base(f) + '/storyboard-handoff'); ok(r); return r.json.storyboardContext; }
async function command(f, action, fields = {}) {
  const r = await call(f.handler, base(f) + '/storyboard-handoff', { expectedVersion: f.p.version, action, ...fields });
  if ([200, 201].includes(r.status)) f.p = r.json.project;
  return r;
}
const approval = (f, extra = {}) => ({ expectedVersion: f.p.version, artifactId: 'storyboard_sequence', version: currentStoryboardSequence(f.p).version, decision: 'approved', ackPlanningOnly: true, ...extra });
async function grant(f, operation = 'plan_storyboard') {
  const q = await call(f.handler, base(f) + '/planning/' + operation); ok(q); assert.equal(q.json.availability.enabled, true, JSON.stringify(q.json));
  const r = await call(f.handler, base(f) + '/planning-consents', { requestId: randomUUID(), expectedVersion: f.p.version, operation, expectedModelId: q.json.quote.modelId, expectedProfileFingerprint: q.json.quote.profileFingerprint, maxMicroUsd: 10000, finishReserveMicroUsd: 500, maxCalls: 3 }); ok(r); return r.json.consent;
}
async function start(f, consent) {
  const body = { requestId: randomUUID(), expectedVersion: f.p.version, operation: 'plan_storyboard', consentId: consent.id };
  return { body, response: await call(f.handler, base(f) + '/planning-calls', body) };
}

test('free storyboard handoff prepares source-linked contracts and a complete sequence without creating images or model calls', async t => {
  const f = await fixture(t), before = await context(f); assert.equal(before.shots.length, 0);
  const prepared = await command(f, 'prepare'); ok(prepared); const c = prepared.json.storyboardContext;
  assert(c.shots.length >= currentScreenplay(f.p).document.scenes.length); assert.equal(c.sequence.coverage.complete, true); assert.equal(c.sequence.approved, false); assert(c.shots.every(s => s.current && !s.approved));
  assert.deepEqual(new Set(f.p.shots.map(s => s.sceneId)), new Set(currentScreenplay(f.p).document.scenes.map(s => s.id)));
  for (const projected of f.p.shots) {
    const contract = c.shots.find(s => s.id === projected.id).current.document, scene = currentScreenplay(f.p).document.scenes.find(s => s.id === contract.sceneId);
    assert.equal(projected.dialogue, contract.dialogueIds.map(id => scene.dialogue.find(line => line.id === id).text).join('\n'));
    assert.equal(contract.timingBasis, 'planning_estimate');
  }
  assert.equal(f.store.state.assets.length, 0); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningConsents?.length || 0, 0);
  const preparedVersion = f.p.version, again = await command(f, 'prepare'); ok(again); assert.equal(again.json.project.version, preparedVersion); assert.deepEqual(again.json.storyboardContext, c);
  const restored = await new LocalStore(f.file).init(), handler = await createHandler({ env: f.env, store: restored, planningProvider: f.planningProvider });
  const reloaded = await call(handler, base(f) + '/storyboard-handoff'); ok(reloaded); assert.deepEqual(reloaded.json.storyboardContext, c);
});

test('whole storyboard approval is planning-only and atomically reviews every current contract and sequence', async t => {
  const f = await fixture(t, { prepared: true }), before = await f.store.records('approvals', f.p.id);
  assert.equal((await call(f.handler, base(f) + '/approvals', approval(f, { ackPlanningOnly: false }))).status, 400);
  assert.equal((await call(f.handler, base(f) + '/approvals', approval(f, { expectedVersion: f.p.version - 1 }))).status, 409);
  assert.deepEqual(await f.store.records('approvals', f.p.id), before);
  ok(await call(f.handler, base(f) + '/approvals', approval(f)));
  const c = await context(f); assert.equal(c.sequence.approved, true); assert(c.shots.every(s => s.approved));
  const decisions = (await f.store.records('approvals', f.p.id)).slice(before.length); assert.equal(decisions.length, c.shots.length + 1); assert(decisions.some(a => a.artifactId === 'storyboard_sequence'));
  for (const shot of c.shots) assert(decisions.some(a => a.artifactId === 'shot_contract:' + shot.id && a.version === shot.current.version));
  assert.equal(f.store.state.assets.length, 0); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.counters().submits, 0);
});

test('one contract edit preserves neighboring versions and approvals while sequence pins require explicit review', async t => {
  const f = await fixture(t, { approveHandoff: true }), before = await context(f), first = before.shots[0];
  const changed = await command(f, 'update', { shotId: first.id, document: { ...structuredClone(first.current.document), title: 'A revised view of the ticket exchange' } }); ok(changed);
  const after = changed.json.storyboardContext; assert.equal(after.shots.find(s => s.id === first.id).current.version, first.current.version + 1); assert.equal(after.shots.find(s => s.id === first.id).approved, false); assert.equal(after.sequence.stale, true); assert.equal(after.sequence.approved, false);
  for (const other of before.shots.filter(s => s.id !== first.id)) { const next = after.shots.find(s => s.id === other.id); assert.deepEqual(next.current, other.current); assert.equal(next.approved, true); }
  assert.equal((await call(f.handler, base(f) + '/approvals', approval(f))).status, 409);
  assert.equal((await command(f, 'review_sequence', { acknowledgeShotChanges: false })).status, 400);
  const reviewed = await command(f, 'review_sequence', { acknowledgeShotChanges: true }); ok(reviewed); assert.equal(reviewed.json.storyboardContext.sequence.stale, false); assert.equal(reviewed.json.storyboardContext.sequence.approved, false);
  ok(await call(f.handler, base(f) + '/approvals', approval(f))); assert.equal((await context(f)).sequence.approved, true); assert.equal(f.counters().submits, 0);
});

test('sequence reordering preserves exact contract documents, prior order and individual approvals', async t => {
  const f = await fixture(t, { approveHandoff: true }), before = await context(f), sequence = structuredClone(currentStoryboardSequence(f.p)), reversed = sequence.shots.map(s => s.shotId).reverse();
  const reordered = await command(f, 'reorder', { shotIds: reversed }); ok(reordered);
  assert.deepEqual(currentStoryboardSequence(f.p).shots.map(s => s.shotId), reversed); assert.equal(currentStoryboardSequence(f.p).version, sequence.version + 1); assert.equal(reordered.json.storyboardContext.sequence.approved, false);
  assert.deepEqual(f.p.storyboardHandoff.sequences[0], sequence);
  for (const shot of before.shots) { const next = reordered.json.storyboardContext.shots.find(s => s.id === shot.id); assert.deepEqual(next.current, shot.current); assert.equal(next.approved, true); }
  for (const shotIds of [reversed.slice(1), [...reversed, reversed[0]], ['foreign-shot', ...reversed.slice(1)]]) assert.equal((await command(f, 'reorder', { shotIds })).status, 400);
  assert.equal(f.counters().submits, 0);
});

test('storyboard planning holds when department or script sources change and retains all existing contracts and media', async t => {
  const f = await fixture(t, { approveHandoff: true }), before = structuredClone(f.p.storyboardHandoff);
  const departments = (await call(f.handler, base(f) + '/department-plans')).json.departmentContext, camera = departments.departments.find(d => d.id === 'camera');
  const change = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'camera', document: { ...camera.current.document, summary: 'Review a new motivated move before producing its shots.' } }); ok(change); f.p = change.json.project;
  const held = await context(f); assert.equal(held.prerequisites.departmentsApproved, false); assert(held.shots.every(s => s.sourceStale && !s.approved)); assert.equal(held.sequence.approved, false);
  assert.equal((await command(f, 'prepare')).status, 409); assert.equal((await call(f.handler, base(f) + '/approvals', approval(f))).status, 409);
  const quote = await call(f.handler, base(f) + '/planning/plan_storyboard'); ok(quote); assert.equal(quote.json.availability.enabled, false);
  assert.deepEqual(f.p.storyboardHandoff, before); assert.equal(f.counters().submits, 0);
});

test('storyboard commands cannot forge model provenance, media assets, verified controls or foreign source identities', async t => {
  const f = await fixture(t, { prepared: true }), c = await context(f), shot = c.shots[0];
  for (const body of [
    { action: 'prepare', approved: true },
    { action: 'apply_proposal', proposal: { shots: [] } },
    { action: 'update', shotId: shot.id, document: shot.current.document, modelCallId: randomUUID() },
    { action: 'update', shotId: shot.id, document: { ...shot.current.document, frameAssetId: randomUUID() } },
    { action: 'update', shotId: shot.id, document: { ...shot.current.document, verifiedControls: true } },
    { action: 'update', shotId: shot.id, document: { ...shot.current.document, sceneId: 'foreign-scene' } },
  ]) assert.equal((await call(f.handler, base(f) + '/storyboard-handoff', { expectedVersion: f.p.version, ...body })).status, 400);
  const foreign = { ...structuredClone(f.p), id: randomUUID(), ownerId: 'another-owner' }; await f.store.create(foreign);
  assert.equal((await call(f.handler, `/api/projects/${foreign.id}/storyboard-handoff`)).status, 404); assert.equal((await call(f.handler, `/api/projects/${foreign.id}/storyboard-handoff`, { expectedVersion: foreign.version, action: 'prepare' })).status, 404);
  assert.equal(f.counters().submits, 0);
});

test('shot contracts bind exact scene dialogue and speakers and cannot certify controls or measured media timing', async t => {
  const f = await fixture(t, { prepared: true }), c = await context(f), first = c.shots.find(s => s.current.document.sceneId === 'platform'), source = first.current.document;
  assert.deepEqual(new Set(source.dialogueIds), new Set(['line-one','line-two'])); assert(source.characterIds.includes('mira')); assert(source.characterIds.includes('rafi')); assert.equal(source.timingBasis, 'planning_estimate');
  for (const mutate of [d => d.dialogueIds = ['foreign-line'], d => d.dialogueIds = ['line-three'], d => d.dialogueIds = ['line-one','line-one'], d => d.characterIds = [], d => d.spokenText = 'A paraphrased replacement line.', d => d.timingBasis = 'measured', d => d.controls = [{ id: 'camera-check', direction: 'A motivated move.', classification: 'verified' }], d => d.controls = [{ id: 'camera-check', direction: 'A motivated move.', classification: 'prompt_only', observed: true }]]) {
    const document = structuredClone(source); mutate(document);
    assert.equal((await command(f, 'update', { shotId: first.id, document })).status, 400);
  }
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.assets.length, 0);
});

test('removing a dialogue binding creates an explicit coverage hold rather than silently omitting approved words', async t => {
  const f = await fixture(t, { prepared: true }), c = await context(f), first = c.shots.find(s => s.current.document.dialogueIds.length), document = structuredClone(first.current.document);
  document.dialogueIds = document.dialogueIds.slice(1);
  const changed = await command(f, 'update', { shotId: first.id, document }); ok(changed); assert.equal(changed.json.storyboardContext.sequence.coverage.complete, false);
  const reviewed = await command(f, 'review_sequence', { acknowledgeShotChanges: true }); ok(reviewed); assert.equal(reviewed.json.storyboardContext.sequence.coverage.complete, false); assert.equal(reviewed.json.storyboardContext.sequence.approved, false);
  assert.equal((await call(f.handler, base(f) + '/approvals', approval(f))).status, 409);
  assert.equal(f.counters().submits, 0);
});

test('paid storyboard planning uses its own reviewed model and consent and saves a proposal without automatic application', async t => {
  const f = await fixture(t); f.store.state.models.push(syntheticDepartmentModel());
  const wrong = await grant(f, 'plan_departments'); assert.equal((await start(f, wrong)).response.status, 409);
  const consent = await grant(f); assert.equal(consent.modelId, 'O-storyboard-local'); assert.equal(consent.operation, 'plan_storyboard'); assert.equal(f.counters().submits, 0);
  const { response, body } = await start(f, consent); ok(response); const saved = response.json.call;
  assert.equal(saved.actualMicroUsd, 20); assert.equal(saved.chargeState, 'settled'); assert(saved.result.storyboard.shots.length > 0); assert.equal((await context(f)).shots.length, 0);
  const input = JSON.parse(f.requests[0].body.input); assert.equal(input.operation, 'plan_storyboard'); assert.equal(input.context.departmentPlanning.departments.length, 17);
  ok(await call(f.handler, base(f) + '/planning-calls', body)); assert.equal(f.counters().submits, 1);
  const applied = await call(f.handler, base(f) + '/storyboard-handoff/apply-proposal', { expectedVersion: f.p.version, callId: saved.id }); ok(applied); f.p = applied.json.project;
  assert.equal(applied.json.storyboardContext.sequence.coverage.complete, true); assert.equal(applied.json.storyboardContext.sequence.approved, false); assert(applied.json.storyboardContext.shots.every(s => !s.approved)); assert.equal(f.store.state.assets.length, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('incomplete storyboard output records known usage and cannot partially apply or create an automatic paid repair', async t => {
  const f = await fixture(t, { malformed: true }), consent = await grant(f), { response, body } = await start(f, consent); ok(response); const saved = response.json.call;
  assert.equal(saved.actualMicroUsd, 20); assert.equal(saved.chargeState, 'settled'); assert.ok(saved.result.planError); assert.equal(saved.result.storyboard, undefined);
  assert.equal((await call(f.handler, base(f) + '/storyboard-handoff/apply-proposal', { expectedVersion: f.p.version, callId: saved.id })).status, 409);
  ok(await call(f.handler, base(f) + '/planning-calls', body)); assert.equal(f.counters().submits, 1); assert.equal((await context(f)).shots.length, 0);
});

test('known storyboard calls settle after restart, pause and model retirement while changed sources prevent stale application', async t => {
  const f = await fixture(t, { queued: true }), consent = await grant(f), { response } = await start(f, consent); ok(response); const id = response.json.call.id;
  const changed = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: { ...currentScreenplay(f.p).document, title: 'A changed script after the saved request.' } }); ok(changed); f.p = changed.json.project;
  const restored = await new LocalStore(f.file).init(); restored.state.models = []; restored.state.operationalControl.generationPaused = true;
  const handler = await createHandler({ env: { DIRECTOR_DEMO: '1' }, store: restored, planningProvider: f.planningProvider });
  const polled = await call(handler, base(f) + `/planning-calls/${id}/poll`, { requestId: randomUUID() }); ok(polled); assert.equal(polled.json.call.actualMicroUsd, 20); assert.ok(polled.json.call.result.storyboard);
  assert.equal((await call(handler, base(f) + '/storyboard-handoff/apply-proposal', { expectedVersion: f.p.version, callId: id })).status, 409); assert.equal(f.counters().submits, 1); assert.equal(f.counters().polls, 1);
});

test('same-version review changes atomically hold storyboard saves, bulk approvals and proposal application', async t => {
  for (const mode of ['prepare','proposal']) {
    const f = await fixture(t); let callId;
    if (mode === 'proposal') { const consent = await grant(f), { response } = await start(f, consent); ok(response); callId = response.json.call.id; }
    const before = structuredClone(f.p), save = f.store.saveStoryboardHandoff.bind(f.store); let raced = false;
    f.store.saveStoryboardHandoff = async (next, version, evidence) => {
      if (!raced) { raced = true; const departments = (await call(f.handler, base(f) + '/department-plans')).json.departmentContext, rights = departments.departments.find(d => d.id === 'rights'); await f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: 'department:rights', version: rights.current.version, decision: 'revoked' }, f.p.ownerId); }
      return save(next, version, evidence);
    };
    const r = mode === 'prepare' ? await command(f, 'prepare') : await call(f.handler, base(f) + '/storyboard-handoff/apply-proposal', { expectedVersion: f.p.version, callId });
    assert.equal(r.status, 409); assert.equal(raced, true); assert.deepEqual((await call(f.handler, base(f))).json.project, before); assert.equal(f.counters().submits, mode === 'proposal' ? 1 : 0);
  }
});

test('failed durable storyboard writes and bulk approvals publish no partial history and retry once', async t => {
  const f = await fixture(t), before = structuredClone(f.p); await mkdir(f.file + '.spending.tmp');
  assert.equal((await command(f, 'prepare')).status, 500); assert.deepEqual((await call(f.handler, base(f))).json.project, before);
  await rm(f.file + '.spending.tmp', { recursive: true }); ok(await command(f, 'prepare')); const approvals = await f.store.records('approvals', f.p.id);
  await mkdir(f.file + '.spending.tmp'); assert.equal((await call(f.handler, base(f) + '/approvals', approval(f))).status, 500); assert.deepEqual(await f.store.records('approvals', f.p.id), approvals);
  await rm(f.file + '.spending.tmp', { recursive: true }); ok(await call(f.handler, base(f) + '/approvals', approval(f))); assert.equal((await context(f)).sequence.approved, true); assert.equal(f.counters().submits, 0);
});

test('generic project edits cannot bypass managed shot direction while image and clip selections remain editable', async t => {
  const f = await fixture(t, { prepared: true }), before = structuredClone(f.p.storyboardHandoff), first = f.p.shots[0], referenceAssetId = randomUUID(), clipAssetId = randomUUID();
  assert.equal((await call(f.handler, base(f), { expectedVersion: f.p.version, storyboardHandoff: before }, 'PATCH')).status, 400);
  assert.equal((await call(f.handler, base(f), { expectedVersion: f.p.version, shots: f.p.shots.map(s => s.id === first.id ? { ...s, description: 'An unreviewed bypass.' } : s) }, 'PATCH')).status, 409);
  for (const [id, mime] of [[referenceAssetId, 'image/png'], [clipAssetId, 'video/mp4']]) await f.store.add('assets', { id, projectId: f.p.id, name: 'Owned metadata-only fixture', mime, role: 'shot_reference', scope: 'shot', shotId: first.id, version: 1 });
  const selected = await call(f.handler, base(f), { expectedVersion: f.p.version, shots: f.p.shots.map(s => s.id === first.id ? { ...s, referenceAssetId, clipAssetId } : s) }, 'PATCH'); ok(selected); f.p = selected.json.project;
  assert.deepEqual(f.p.storyboardHandoff, before); assert.equal(f.p.shots[0].referenceAssetId, referenceAssetId); assert.equal(f.p.shots[0].clipAssetId, clipAssetId); assert.equal(f.counters().submits, 0);
});

test('concurrent bulk review and contract edits have atomic outcomes without partial or stale approvals', async t => {
  const f = await fixture(t, { prepared: true }), c = await context(f), first = c.shots[0], before = await f.store.records('approvals', f.p.id), expected = f.p.version;
  const [reviewed, edited] = await Promise.all([
    call(f.handler, base(f) + '/approvals', approval(f)),
    call(f.handler, base(f) + '/storyboard-handoff', { expectedVersion: expected, action: 'update', shotId: first.id, document: { ...first.current.document, title: 'A concurrently edited contract' } }),
  ]);
  assert([200, 201, 409].includes(reviewed.status), JSON.stringify(reviewed)); assert([200, 409].includes(edited.status), JSON.stringify(edited)); f.p = (await call(f.handler, base(f))).json.project;
  const after = await context(f), decisions = (await f.store.records('approvals', f.p.id)).slice(before.length);
  if (edited.status === 200) { assert.equal(after.sequence.approved, false); assert.equal(after.shots.find(s => s.id === first.id).approved, false); assert.equal(after.shots.find(s => s.id === first.id).current.version, 2); }
  else { ok(reviewed); assert.equal(after.sequence.approved, true); assert.equal(after.shots.find(s => s.id === first.id).current.version, 1); }
  assert([0, c.shots.length + 1].includes(decisions.length), 'No partial bulk approval may persist.');
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('legacy untyped shots must be explicitly adopted before any storyboard planning allowance can be granted', async t => {
  const f = await fixture(t), legacyId = 'legacy-platform', source = currentScreenplay(f.p).document.scenes[0];
  const legacy = await call(f.handler, base(f), { expectedVersion: f.p.version, shots: [{ id: legacyId, sceneId: source.id, title: 'Preserved earlier coverage', description: source.action, duration: 5, dialogue: '' }] }, 'PATCH'); ok(legacy); f.p = legacy.json.project;
  const before = structuredClone(f.p.shots), quote = await call(f.handler, base(f) + '/planning/plan_storyboard'); ok(quote); assert.equal(quote.json.availability.enabled, false);
  const denied = await call(f.handler, base(f) + '/planning-consents', { requestId: randomUUID(), expectedVersion: f.p.version, operation: 'plan_storyboard', maxMicroUsd: 10000, finishReserveMicroUsd: 500, maxCalls: 1 }); assert.equal(denied.status, 409);
  assert.deepEqual((await call(f.handler, base(f))).json.project.shots, before); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningConsents?.length || 0, 0);
  const adopted = await command(f, 'prepare'); ok(adopted); assert(adopted.json.storyboardContext.shots.some(s => s.id === legacyId)); assert.equal(f.p.shots.find(s => s.id === legacyId).description, source.action); assert.equal(adopted.json.storyboardContext.sequence.coverage.complete, true);
});

test('approving an unchanged handoff blocks a new paid planning call and invalidates its earlier unstarted allowance', async t => {
  const f = await fixture(t, { prepared: true }), consent = await grant(f); assert.equal(f.counters().submits, 0);
  ok(await call(f.handler, base(f) + '/approvals', approval(f)));
  const quote = await call(f.handler, base(f) + '/planning/plan_storyboard'); ok(quote); assert.equal(quote.json.availability.enabled, false);
  assert.equal((await start(f, consent)).response.status, 409); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningReservations?.length || 0, 0);
  assert.equal((await context(f)).sequence.approved, true);
});

test('free preparation appends newly approved scene coverage without rewriting older contracts, media or source holds', async t => {
  const f = await fixture(t, { prepared: true }), firstId = f.p.shots[0].id, referenceAssetId = randomUUID(), clipAssetId = randomUUID();
  for (const [id, mime] of [[referenceAssetId, 'image/png'], [clipAssetId, 'video/mp4']]) await f.store.add('assets', { id, projectId: f.p.id, name: 'Owned metadata-only fixture', mime, role: 'shot_reference', scope: 'shot', shotId: firstId, version: 1 });
  const selected = await call(f.handler, base(f), { expectedVersion: f.p.version, shots: f.p.shots.map(s => s.id === firstId ? { ...s, referenceAssetId, clipAssetId } : s) }, 'PATCH'); ok(selected); f.p = selected.json.project;
  const oldContracts = structuredClone(f.p.storyboardHandoff.shots), oldSequence = structuredClone(currentStoryboardSequence(f.p)), oldProjected = structuredClone(f.p.shots);
  const document = structuredClone(currentScreenplay(f.p).document);
  document.scenes.push({ id: 'station-office', heading: 'INT. STATION OFFICE - DAWN', action: 'Mira places the unused ticket beside an open ledger.', dialogue: [{ id: 'line-four', characterId: 'mira', text: 'We can begin again.', direction: 'Quietly, after noticing the open ledger.' }], durationSeconds: 10 });
  const saved = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document }); ok(saved); f.p = saved.json.project;
  ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'brief', version: f.p.creativeBrief.currentVersion, decision: 'approved', acknowledgeAssumptions: true }));
  ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: currentScreenplay(f.p).version, decision: 'approved', acknowledgeLimitedCoverage: true }));
  const refreshedIds = new Set();
  while (refreshedIds.size < departmentDependencyPolicy.length) {
    const entry = departmentDependencyPolicy.find(unit => !refreshedIds.has(unit.departmentId) && unit.dependsOn.every(id => refreshedIds.has(id)));
    assert(entry, 'The department dependency policy must have a topological review order.');
    const refreshed = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'refresh', departmentId: entry.departmentId, acknowledgeSourceChange: true }); ok(refreshed); f.p = refreshed.json.project;
    const current = refreshed.json.departmentContext.departments.find(unit => unit.id === entry.departmentId).current;
    ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'department:' + entry.departmentId, version: current.version, decision: 'approved', ackPlanningOnly: true }));
    refreshedIds.add(entry.departmentId);
  }
  const before = await context(f); assert.equal(before.prerequisites.departmentsApproved, true); assert.equal(before.sequence.coverage.complete, false);
  assert.deepEqual(f.p.storyboardHandoff.shots, oldContracts);
  const prepared = await command(f, 'prepare'); ok(prepared); const after = prepared.json.storyboardContext;
  assert.equal(after.shots.length, oldContracts.length + 1); assert.equal(after.sequence.coverage.complete, true); assert.equal(after.sequence.approved, false);
  assert.deepEqual(f.p.storyboardHandoff.shots.slice(0, oldContracts.length), oldContracts);
  assert.deepEqual(f.p.storyboardHandoff.sequences[0], oldSequence);
  assert.deepEqual(currentStoryboardSequence(f.p).shots.slice(0, oldSequence.shots.length), oldSequence.shots);
  assert.deepEqual(f.p.shots.slice(0, oldProjected.length), oldProjected);
  const added = after.shots.find(shot => !oldContracts.some(old => old.id === shot.id));
  assert.equal(added.current.document.sceneId, 'station-office'); assert.deepEqual(added.current.document.dialogueIds, ['line-four']); assert.equal(added.sourceStale, false); assert.equal(added.approved, false);
  assert.equal(f.p.shots.at(-1).id, added.id); assert.equal(f.p.shots.at(-1).dialogue, 'We can begin again.');
  assert(after.shots.filter(shot => shot.id !== added.id).every(shot => shot.sourceStale && !shot.approved));
  assert.equal((await call(f.handler, base(f) + '/approvals', approval(f))).status, 409);
  const preparedVersion = f.p.version, preparedArchive = structuredClone(f.p.storyboardHandoff); ok(await command(f, 'prepare')); assert.equal(f.p.version, preparedVersion); assert.deepEqual(f.p.storyboardHandoff, preparedArchive);
  assert.equal(f.counters().submits, 0); assert.equal(f.requests.length, 0); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.store.state.assets.length, 2);
  assert.equal(f.store.state.planningConsents?.length || 0, 0); assert.equal(f.store.state.planningReservations?.length || 0, 0);
});

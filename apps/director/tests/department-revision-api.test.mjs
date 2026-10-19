import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../server.mjs';
import { LocalStore } from '../store.mjs';
import { currentScreenplay } from '../public/screenplay-core.js';
import { productionState } from '../production-state.mjs';
import { createImportController } from '../imports.mjs';
import { departmentFixture } from './department-fixture-server.mjs';

async function call(handler, path, body, method = body === undefined ? 'GET' : 'POST') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { url: path, method, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
  let status, data;
  const res = { setHeader() {}, writeHead(value) { status = value; this.headersSent = true; }, end(value) { data = value; } };
  await handler(req, res); return { status, json: JSON.parse(String(data)) };
}
const ok = response => assert.ok([200, 201].includes(response.status), JSON.stringify(response));
const ids = ['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights'];
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'director-department-revisions-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'store.json'), f = await departmentFixture({ file, revisionEnabled: true, approveDepartments: true, ...options });
  return { ...f, file, p: f.project, handler: await createHandler({ env: f.env, store: f.store, planningProvider: f.planningProvider }) };
}
const base = f => `/api/projects/${f.p.id}`;
const unit = (context, id) => context.departments.find(item => item.id === id);
async function context(f) { const read = await call(f.handler, base(f) + '/department-plans'); ok(read); return read.json.departmentContext; }
async function command(f, action, fields = {}) {
  const result = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action, ...fields });
  if ([200, 201].includes(result.status)) f.p = result.json.project;
  return result;
}
async function edit(f, id, summary) {
  const before = await context(f), document = { ...structuredClone(unit(before, id).current.document), summary };
  const changed = await command(f, 'update', { departmentId: id, document }); ok(changed); return changed.json.departmentContext;
}
const request = (f, fields = {}) => command(f, 'request_revision', { departmentIds: ['camera'], instruction: 'Use a slower motivated move while preserving the established action axis.', ...fields });
async function grant(f, operation = 'revise_departments') {
  const quote = await call(f.handler, base(f) + '/planning/' + operation); ok(quote); assert.equal(quote.json.availability.enabled, true, JSON.stringify(quote.json));
  const granted = await call(f.handler, base(f) + '/planning-consents', { requestId: randomUUID(), expectedVersion: f.p.version, operation, expectedModelId: quote.json.quote.modelId, expectedProfileFingerprint: quote.json.quote.profileFingerprint, maxMicroUsd: 10000, finishReserveMicroUsd: 500, maxCalls: 3 }); ok(granted); return granted.json.consent;
}
async function start(f, consent, operation = 'revise_departments') {
  const body = { requestId: randomUUID(), expectedVersion: f.p.version, operation, consentId: consent.id };
  return { body, response: await call(f.handler, base(f) + '/planning-calls', body) };
}
const approval = (f, c, id, extra = {}) => ({ expectedVersion: f.p.version, artifactId: 'department:' + id, version: unit(c, id).current.version, decision: 'approved', ackPlanningOnly: true, ...extra });

test('camera revision changes one snapshot and holds only its dependent department branches without rewriting their history', async t => {
  const f = await fixture(t), before = await context(f); assert(before.departments.every(d => d.approved));
  const changed = await edit(f, 'camera', 'Use a quiet lateral move to reveal the ticket while keeping the geography readable.');
  assert.equal(unit(changed, 'camera').current.version, 2); assert.equal(unit(changed, 'camera').approved, false);
  const affected = ['lighting','continuity','storyboard','animatic','vfx','editorial'];
  assert.deepEqual(changed.departments.filter(d => d.dependencyStale).map(d => d.id).sort(), affected.slice().sort());
  for (const id of ids.filter(id => id !== 'camera')) assert.deepEqual(unit(changed, id).current, unit(before, id).current);
  for (const id of ['rights','voice','music','casting','look','locations','direction','sound']) assert.equal(unit(changed, id).approved, true, id);
  for (const id of affected) { assert.equal(unit(changed, id).sourceStale, false); assert.equal(unit(changed, id).approved, false); assert.equal(unit(changed, id).approvalDecision, 'approved'); assert.ok(unit(changed, id).dependencyChanges.length); }
  const graph = productionState(f.p, [], await f.store.records('approvals', f.p.id)), lighting = graph.nodes.find(n => n.id === 'department:lighting');
  assert.equal(lighting.dependencyStale, true); assert.equal(lighting.sourceStale, false); assert(lighting.dependencies.includes('department:camera')); assert.deepEqual(lighting.dependencyChanges, unit(changed, 'lighting').dependencyChanges);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('dependency acknowledgement preserves the exact saved document and choices in a new unapproved version without approving upstream work', async t => {
  const f = await fixture(t); await edit(f, 'camera', 'A restrained move follows the actual prop exchange.'); const before = await context(f), document = structuredClone(unit(before, 'lighting').current.document);
  assert.equal((await command(f, 'review_dependencies', { departmentId: 'lighting', acknowledgeDependencies: false })).status, 400);
  const held = await call(f.handler, base(f) + '/approvals', approval(f, before, 'lighting')); assert.equal(held.status, 409);
  const reviewed = await command(f, 'review_dependencies', { departmentId: 'lighting', acknowledgeDependencies: true }); ok(reviewed); const after = reviewed.json.departmentContext;
  assert.equal(unit(after, 'lighting').current.version, 2); assert.deepEqual(unit(after, 'lighting').current.document, document); assert.equal(unit(after, 'lighting').dependencyStale, false); assert.equal(unit(after, 'lighting').approved, false); assert.equal(unit(after, 'camera').approved, false);
  for (const id of ids.filter(id => id !== 'lighting')) assert.deepEqual(unit(after, id).current, unit(before, id).current);
  ok(await call(f.handler, base(f) + '/approvals', approval(f, after, 'lighting'))); assert.equal(unit(await context(f), 'lighting').approved, true);
  assert.equal((await command(f, 'review_dependencies', { departmentId: 'animatic', acknowledgeDependencies: true })).status, 409);
  assert.equal(f.counters().submits, 0);
});

test('legacy plans without dependency snapshots remain exact but held until an explicit upstream-first review', async t => {
  const f = await fixture(t), legacy = f.store.state.projects.find(p => p.id === f.p.id);
  for (const d of legacy.departmentPlanning.departments) for (const v of d.versions) delete v.dependencyContext;
  f.p = structuredClone(legacy); const archive = structuredClone(f.p.departmentPlanning), c = await context(f);
  assert(c.departments.every(d => d.dependencyStale && !d.approved)); assert.deepEqual(f.p.departmentPlanning, archive);
  assert.equal((await command(f, 'review_dependencies', { departmentId: 'camera', acknowledgeDependencies: true })).status, 409);
  const reviewed = await command(f, 'review_dependencies', { departmentId: 'rights', acknowledgeDependencies: true }); ok(reviewed);
  assert.equal(unit(reviewed.json.departmentContext, 'rights').dependencyStale, false); assert.equal(unit(reviewed.json.departmentContext, 'rights').current.version, 2); assert.equal(unit(reviewed.json.departmentContext, 'rights').approved, false);
  assert.deepEqual(unit(reviewed.json.departmentContext, 'rights').current.document, archive.departments.find(d => d.id === 'rights').versions[0].document);
  for (const id of ids.filter(id => id !== 'rights')) assert.deepEqual(f.p.departmentPlanning.departments.find(d => d.id === id), archive.departments.find(d => d.id === id));
  assert.equal(f.counters().submits, 0);
});

test('dependency review cannot conceal a changed or revoked screenplay and leaves all plan history intact', async t => {
  const f = await fixture(t); await edit(f, 'camera', 'Use an eye-level move.'); const before = structuredClone(f.p.departmentPlanning);
  const changed = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: { ...currentScreenplay(f.p).document, title: 'The story has changed since the department plan.' } }); ok(changed); f.p = changed.json.project;
  assert.equal((await command(f, 'review_dependencies', { departmentId: 'lighting', acknowledgeDependencies: true })).status, 409);
  ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: f.p.screenplay.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true }));
  assert.equal((await command(f, 'review_dependencies', { departmentId: 'lighting', acknowledgeDependencies: true })).status, 409);
  assert.deepEqual(f.p.departmentPlanning, before); assert.equal(f.counters().submits, 0);
});

test('selected revision requests are free, immutable, source-bound records and never supply approval or model provenance', async t => {
  const f = await fixture(t), before = await context(f), saved = await request(f, { departmentIds: ['camera','lighting'] }); ok(saved); const c = saved.json.departmentContext;
  assert.equal(c.revision.status, 'current'); assert.equal(c.revision.valid, true); assert.deepEqual(c.revision.request.departmentIds, ['camera','lighting']); assert.equal(c.revision.request.departmentVersions.length, 17);
  for (const id of ids) assert.deepEqual(unit(c, id).current, unit(before, id).current);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningConsents?.length || 0, 0);
  for (const fields of [{ departmentIds: [] }, { departmentIds: ['camera','camera'] }, { departmentIds: ['lighting','camera'] }, { departmentIds: ['forged'] }, { instruction: '' }, { instruction: 'x'.repeat(4001) }, { approved: true }, { modelCallId: randomUUID() }]) assert.equal((await request(f, fields)).status, 400);
  const initial = structuredClone(c.revision.request), replaced = await request(f, { instruction: 'Keep the frame locked and express the beat through actor movement.' }); ok(replaced);
  assert.equal(f.p.departmentPlanning.revisionRequests.length, 2); assert.deepEqual(f.p.departmentPlanning.revisionRequests[0], initial); assert.equal(replaced.json.departmentContext.revision.request.version, 2);
  assert.equal(f.counters().submits, 0);
});

test('revision operation requires an explicit current request and a separately reviewed registry profile and consent', async t => {
  const f = await fixture(t), empty = await call(f.handler, base(f) + '/planning/revise_departments'); ok(empty); assert.equal(empty.json.availability.enabled, false);
  ok(await request(f)); const quote = await call(f.handler, base(f) + '/planning/revise_departments'); ok(quote); assert.equal(quote.json.quote.modelId, 'O-department-revisions-local'); assert.equal(quote.json.quote.task, 'department_revision');
  const broad = await grant(f, 'plan_departments'), wrong = await start(f, broad); assert.equal(wrong.response.status, 409); assert.equal(f.counters().submits, 0);
  const grantOnly = await grant(f); assert.equal(grantOnly.operation, 'revise_departments'); assert.equal(grantOnly.modelId, 'O-department-revisions-local'); assert.equal(f.counters().submits, 0);
  f.store.state.models = f.store.state.models.filter(m => m.id !== 'O-department-revisions-local');
  const blocked = await call(f.handler, base(f) + '/planning/revise_departments'); ok(blocked); assert.equal(blocked.json.availability.enabled, false); assert.equal((await start(f, grantOnly)).response.status, 409); assert.equal(f.counters().submits, 0);
});

test('targeted AI revision returns only selected units and applies only after review without rewriting approved neighboring snapshots', async t => {
  const f = await fixture(t), before = await context(f); ok(await request(f)); const consent = await grant(f), { response, body } = await start(f, consent); ok(response); const saved = response.json.call;
  assert.deepEqual(saved.result.departments.departments.map(d => d.id), ['camera']); assert.equal(saved.actualMicroUsd, 20); assert.equal(saved.chargeState, 'settled');
  assert.equal(unit(await context(f), 'camera').current.version, 1); assert.equal(unit(await context(f), 'camera').approved, true);
  const input = JSON.parse(f.requests[0].body.input); assert.equal(input.operation, 'revise_departments'); assert.deepEqual(input.context.departmentPlanning.revision.request.departmentIds, ['camera']); assert.equal(input.context.departmentPlanning.departments.length, 17);
  const replay = await call(f.handler, base(f) + '/planning-calls', body); ok(replay); assert.equal(replay.json.call.id, saved.id); assert.equal(f.counters().submits, 1);
  const applied = await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: saved.id }); ok(applied); f.p = applied.json.project;
  const after = applied.json.departmentContext; assert.equal(unit(after, 'camera').current.version, 2); assert.equal(unit(after, 'camera').approved, false); assert.match(unit(after, 'camera').current.document.summary, /Simulated scoped revision/);
  for (const id of ids.filter(id => id !== 'camera')) assert.deepEqual(unit(after, id).current, unit(before, id).current);
  for (const id of ['rights','voice','music']) assert.equal(unit(after, id).approved, true);
  assert.equal(unit(after, 'lighting').dependencyStale, true); assert.equal(f.counters().submits, 1); assert.equal(f.store.state.jobs.length, 0);
});

test('changing even an unselected plan or replacing the request holds an old allowance before any paid revision submission', async t => {
  for (const change of ['plan','request']) {
    const f = await fixture(t); ok(await request(f)); const consent = await grant(f);
    if (change === 'plan') await edit(f, 'music', 'Retain silence under the final line, then resolve the cue.'); else ok(await request(f, { instruction: 'Use a different camera motivation after reconsidering the scene.' }));
    assert.equal((await start(f, consent)).response.status, 409); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningReservations?.length || 0, 0);
  }
});

test('an incomplete targeted response settles its known usage and cannot trigger a paid repair or partial application', async t => {
  const f = await fixture(t, { malformed: true }); ok(await request(f)); const consent = await grant(f), { response, body } = await start(f, consent); ok(response); const saved = response.json.call;
  assert.equal(saved.actualMicroUsd, 20); assert.equal(saved.chargeState, 'settled'); assert.ok(saved.result.planError); assert.equal(saved.result.departments, undefined);
  assert.equal((await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: saved.id })).status, 409);
  ok(await call(f.handler, base(f) + '/planning-calls', body)); assert.equal(f.counters().submits, 1); assert.equal(unit(await context(f), 'camera').current.version, 1);
});

test('known targeted calls recover after restart, pause and model retirement but changed requests cannot apply their old output', async t => {
  const f = await fixture(t, { queued: true }); ok(await request(f)); const consent = await grant(f), { response } = await start(f, consent); ok(response); const id = response.json.call.id;
  ok(await request(f, { instruction: 'An updated request after the original response was submitted.' }));
  const restored = await new LocalStore(f.file).init(); restored.state.models = []; restored.state.operationalControl.generationPaused = true;
  const handler = await createHandler({ env: { DIRECTOR_DEMO: '1' }, store: restored, planningProvider: f.planningProvider });
  const poll = await call(handler, base(f) + `/planning-calls/${id}/poll`, { requestId: randomUUID() }); ok(poll); assert.equal(poll.json.call.actualMicroUsd, 20); assert.equal(poll.json.call.chargeState, 'settled'); assert.deepEqual(poll.json.call.result.departments.departments.map(d => d.id), ['camera']);
  assert.equal((await call(handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: id })).status, 409);
  assert.equal(f.counters().submits, 1); assert.equal(f.counters().polls, 1);
});

test('targeted revision commands and saved proposals remain owner-bound and cannot inject authorization', async t => {
  const f = await fixture(t); ok(await request(f)); const consent = await grant(f), { response } = await start(f, consent); ok(response);
  const foreign = { ...structuredClone(f.p), id: randomUUID(), ownerId: 'another-owner' }; await f.store.create(foreign);
  for (const [suffix, body] of [['department-plans', { expectedVersion: foreign.version, action: 'request_revision', departmentIds: ['camera'], instruction: 'An unauthorized correction.' }], ['department-plans/apply-proposal', { expectedVersion: foreign.version, callId: response.json.call.id }], ['planning/revise_departments', undefined]]) assert.equal((await call(f.handler, `/api/projects/${foreign.id}/${suffix}`, body)).status, 404);
  for (const extra of [{ departments: response.json.call.result.departments }, { approved: true }, { actorId: 'another-owner' }]) assert.equal((await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: response.json.call.id, ...extra })).status, 400);
  assert.equal(f.counters().submits, 1);
});

test('same-version approval races hold both dependency acknowledgement and targeted proposal application atomically', async t => {
  for (const mode of ['dependency','proposal']) {
    const f = await fixture(t); let callId;
    if (mode === 'dependency') await edit(f, 'camera', 'The move begins only when the ticket changes hands.');
    else { ok(await request(f)); const consent = await grant(f), { response } = await start(f, consent); ok(response); callId = response.json.call.id; }
    const before = structuredClone(f.p), save = f.store.saveDepartmentPlans.bind(f.store); let raced = false;
    f.store.saveDepartmentPlans = async (next, version, evidence) => {
      if (!raced) { raced = true; const c = await context(f); await f.store.approve(f.p, approval(f, c, 'rights', { decision: 'revoked', ackPlanningOnly: false }), f.p.ownerId); }
      return save(next, version, evidence);
    };
    const result = mode === 'dependency' ? await command(f, 'review_dependencies', { departmentId: 'lighting', acknowledgeDependencies: true }) : await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId });
    assert.equal(result.status, 409); assert.equal(raced, true); assert.deepEqual((await call(f.handler, base(f))).json.project, before); assert.equal(unit(await context(f), 'rights').approved, false);
    assert.equal(f.counters().submits, mode === 'dependency' ? 0 : 1);
  }
});

test('failed durable revision-request writes cannot publish a request in memory and retry creates one history entry', async t => {
  const f = await fixture(t), before = structuredClone(f.p); await mkdir(f.file + '.spending.tmp');
  assert.equal((await request(f)).status, 500); assert.deepEqual((await call(f.handler, base(f))).json.project, before);
  const restored = await new LocalStore(f.file).init(); assert.deepEqual(await restored.get(f.p.id, f.p.ownerId), before);
  await rm(f.file + '.spending.tmp', { recursive: true }); ok(await request(f)); assert.equal(f.p.departmentPlanning.revisionRequests.length, 1); assert.equal(f.counters().submits, 0);
});

test('import preserves dependency and revision-request history without importing approval or spending authority', async t => {
  const f = await fixture(t); ok(await request(f)); const importedStore = await new LocalStore().init(), importer = createImportController({ store: importedStore, storage: {} });
  const source = { ...structuredClone(f.p), id: 'device-' + f.p.id, approvals: await f.store.records('approvals', f.p.id) };
  const pending = await importer.start('cloud-owner', { sourceId: source.id, project: source, assets: [] }), copied = await importer.complete('cloud-owner', pending.id);
  assert.deepEqual(copied.departmentPlanning, f.p.departmentPlanning); assert.equal(copied.approvals, undefined); assert.deepEqual(await importedStore.records('approvals', copied.id), []); assert.equal(importedStore.state.planningConsents?.length || 0, 0);
  const read = await createHandler({ env: { DIRECTOR_DEMO: '1' }, store: importedStore, planningProvider: f.planningProvider });
  assert.equal((await call(read, `/api/projects/${copied.id}/department-plans`)).status, 404);
  assert.equal(f.counters().submits, 0);
});

test('broad department planning cannot rewrite a previously approved source-fresh document held only by dependency changes', async t => {
  const f = await fixture(t); const c = await edit(f, 'voice', 'Use an unhurried final line with a deliberate breath before the last word.');
  assert.equal(unit(c, 'sound').dependencyStale, true); assert.equal(unit(c, 'sound').sourceStale, false); assert.equal(unit(c, 'sound').approvalDecision, 'approved');
  // The fixture deliberately changes Sound when it is not effectively approved.
  // Its retained source-fresh approval must still protect it from broad replanning.
  const consent = await grant(f, 'plan_departments'), { response } = await start(f, consent, 'plan_departments'); ok(response);
  assert.ok(response.json.call.result.planError); assert.equal(response.json.call.result.departments, undefined); assert.equal(response.json.call.actualMicroUsd, 20);
  assert.equal((await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: response.json.call.id })).status, 409);
  assert.equal(unit(await context(f), 'sound').current.version, 1); assert.equal(f.counters().submits, 1);
});

test('an explicitly selected department can receive an AI revision while its recorded user choice stays exact', async t => {
  const f = await fixture(t), before = await context(f), document = structuredClone(unit(before, 'camera').current.document);
  const choice = { id: 'axis-choice', label: 'Protected screen direction', value: 'Mira remains frame left during the exchange; review actual footage separately.', status: 'user_selected', sceneIds: ['platform'], characterIds: ['mira'] };
  document.choices.push(choice); ok(await command(f, 'update', { departmentId: 'camera', document })); const protectedPlans = await context(f);
  ok(await request(f)); const consent = await grant(f), { response } = await start(f, consent); ok(response);
  const applied = await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: response.json.call.id }); ok(applied);
  const current = unit(applied.json.departmentContext, 'camera'); assert.equal(current.current.version, 3); assert(current.current.document.choices.some(c => JSON.stringify(c) === JSON.stringify(choice))); assert.equal(current.approved, false);
  for (const id of ids.filter(id => id !== 'camera')) assert.deepEqual(unit(applied.json.departmentContext, id).current, unit(protectedPlans, id).current);
  assert.equal(f.counters().submits, 1); assert.equal(f.store.state.jobs.length, 0);
});

test('simultaneous revision instructions at the same project version cannot overwrite one another or create a paid request', async t => {
  const f = await fixture(t), results = await Promise.all([
    request(f, { instruction: 'Use a measured camera reveal tied to the ticket.' }),
    request(f, { instruction: 'Keep the camera locked and let the actors reveal the ticket.' }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const saved = (await call(f.handler, base(f))).json.project; assert.equal(saved.departmentPlanning.revisionRequests.length, 1);
  const requestSaved = saved.departmentPlanning.revisionRequests[0]; assert(['Use a measured camera reveal tied to the ticket.','Keep the camera locked and let the actors reveal the ticket.'].includes(requestSaved.instruction));
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningReservations?.length || 0, 0);
});

test('missing prepared departments or revoked source approval cannot produce a new revision authorization', async t => {
  const missing = await fixture(t, { approveDepartments: false, prepared: false });
  assert.equal((await request(missing)).status, 409);
  const unavailable = await call(missing.handler, base(missing) + '/planning/revise_departments'); ok(unavailable); assert.equal(unavailable.json.availability.enabled, false);
  assert.equal((await call(missing.handler, base(missing) + '/planning-consents', { requestId: randomUUID(), expectedVersion: missing.p.version, operation: 'revise_departments', maxMicroUsd: 10000, finishReserveMicroUsd: 500, maxCalls: 1 })).status, 409);
  const revoked = await fixture(t); ok(await request(revoked));
  ok(await call(revoked.handler, base(revoked) + '/approvals', { expectedVersion: revoked.p.version, artifactId: 'brief', version: revoked.p.creativeBrief.currentVersion, decision: 'revoked' }));
  const held = await call(revoked.handler, base(revoked) + '/planning/revise_departments'); ok(held); assert.equal(held.json.availability.enabled, false);
  assert.equal((await call(revoked.handler, base(revoked) + '/planning-consents', { requestId: randomUUID(), expectedVersion: revoked.p.version, operation: 'revise_departments', maxMicroUsd: 10000, finishReserveMicroUsd: 500, maxCalls: 1 })).status, 409);
  for (const f of [missing, revoked]) { assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningConsents?.length || 0, 0); assert.equal(f.store.state.jobs.length, 0); }
});

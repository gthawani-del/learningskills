import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../server.mjs';
import { LocalStore } from '../store.mjs';
import { currentScreenplay } from '../public/screenplay-core.js';
import { departmentFixture } from './department-fixture-server.mjs';
import { hash } from '../domain.mjs';
import { reviewedFalInputSchema } from '../providers.mjs';
import { candidateEndpointManifest } from '../routing-task-catalog.mjs';

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
  const dir = await mkdtemp(join(tmpdir(), 'director-department-api-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const f = await departmentFixture({ file: join(dir, 'store.json'), ...options });
  f.file = join(dir, 'store.json'); f.p = f.project;
  f.handler = await createHandler({ env: f.env, store: f.store, planningProvider: f.planningProvider });
  return f;
}
const base = f => `/api/projects/${f.p.id}`;
async function prepare(f) { const response = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'prepare' }); if ([200, 201].includes(response.status)) f.p = response.json.project; return response; }
const unit = (context, id) => context.departments.find(item => item.id === id);
async function grant(f) {
  const quote = await call(f.handler, base(f) + '/planning/plan_departments'); ok(quote);
  const response = await call(f.handler, base(f) + '/planning-consents', { requestId: randomUUID(), expectedVersion: f.p.version, operation: 'plan_departments', expectedModelId: quote.json.quote.modelId, expectedProfileFingerprint: quote.json.quote.profileFingerprint, maxMicroUsd: 10000, finishReserveMicroUsd: 500, maxCalls: 3 }); ok(response); return response.json.consent;
}
async function start(f, consent) {
  const body = { requestId: randomUUID(), expectedVersion: f.p.version, consentId: consent.id, operation: 'plan_departments' };
  return { body, response: await call(f.handler, base(f) + '/planning-calls', body) };
}
const approveBody = (f, context, id, extra = {}) => ({ expectedVersion: f.p.version, artifactId: 'department:' + id, version: unit(context, id).current.version, decision: 'approved', ackPlanningOnly: true, ...extra });

test('free department preparation saves all filmmaking units as reviewable plans without model calls or media jobs', async t => {
  const f = await fixture(t), empty = await call(f.handler, base(f) + '/department-plans'); ok(empty);
  assert.equal(empty.json.departmentContext.departments.filter(d => d.current).length, 0);
  const prepared = await prepare(f); ok(prepared); const context = prepared.json.departmentContext;
  assert.deepEqual(context.departments.map(d => d.id), ids);
  assert(context.departments.every(d => d.current && !d.approved));
  for (const id of ['casting','look','voice','storyboard','animatic']) assert.ok(unit(context, id).current.document.summary.trim());
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.store.state.planningReservations?.length || 0, 0);
  const replay = await prepare(f); ok(replay); assert.equal(replay.json.project.version, prepared.json.project.version); assert.deepEqual(replay.json.departmentContext, context);
  const restored = await new LocalStore(f.file).init(), handler = await createHandler({ env: f.env, store: restored, planningProvider: f.planningProvider });
  const read = await call(handler, base(f) + '/department-plans'); ok(read); assert.deepEqual(read.json.departmentContext, context); assert.equal(f.counters().submits, 0);
});

test('department preparation requires the current approved screenplay and approval flags cannot be injected', async t => {
  const f = await fixture(t, { approvedScript: false });
  assert.equal((await prepare(f)).status, 409);
  const quote = await call(f.handler, base(f) + '/planning/plan_departments'); ok(quote); assert.equal(quote.json.availability.enabled, false);
  for (const extra of [{ approved: true }, { approvals: [{ artifactId: 'screenplay', decision: 'approved' }] }, { generationAuthorized: true }, { departments: [] }, { actorId: 'another-user' }]) assert.equal((await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'prepare', ...extra })).status, 400);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('department approval is explicitly planning-only, version-bound and never approves generated assets or paid spending', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); const context = prepared.json.departmentContext;
  assert.equal((await call(f.handler, base(f) + '/approvals', approveBody(f, context, 'casting', { ackPlanningOnly: false }))).status, 400);
  const noVersion = approveBody(f, context, 'casting'); delete noVersion.expectedVersion;
  assert.equal((await call(f.handler, base(f) + '/approvals', noVersion)).status, 409);
  assert.equal((await call(f.handler, base(f) + '/approvals', approveBody(f, context, 'casting', { expectedVersion: f.p.version - 1 }))).status, 409);
  const approved = await call(f.handler, base(f) + '/approvals', approveBody(f, context, 'casting')); ok(approved);
  const read = await call(f.handler, base(f) + '/department-plans'); ok(read); assert.equal(unit(read.json.departmentContext, 'casting').approved, true); assert.equal(unit(read.json.departmentContext, 'look').approved, false); assert.equal(unit(read.json.departmentContext, 'voice').approved, false);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.store.state.planningConsents?.length || 0, 0);
});

test('focused department edits append only their unit version and retain approved neighboring plans and prior history', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); const before = prepared.json.departmentContext;
  for (const id of ['camera','rights']) ok(await call(f.handler, base(f) + '/approvals', approveBody(f, before, id)));
  const document = { ...structuredClone(unit(before, 'camera').current.document), summary: 'Use a restrained handheld observation for the platform and a locked frame in the waiting room.' };
  const changed = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'camera', document }); ok(changed); f.p = changed.json.project;
  const after = changed.json.departmentContext; assert.equal(unit(after, 'camera').current.version, unit(before, 'camera').current.version + 1); assert.equal(unit(after, 'camera').approved, false); assert.equal(unit(after, 'rights').approved, true);
  for (const id of ids.filter(id => id !== 'camera')) assert.deepEqual(unit(after, id).current, unit(before, id).current);
  assert.equal(unit(before, 'camera').current.document.summary, unit(prepared.json.departmentContext, 'camera').current.document.summary);
  const repeated = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'camera', document }); ok(repeated); assert.equal(repeated.json.project.version, f.p.version);
  assert.equal(f.counters().submits, 0);
});

test('malformed or foreign department writes cannot inject provenance, approvals or nonexistent screenplay references', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); const document = unit(prepared.json.departmentContext, 'camera').current.document;
  for (const body of [
    { action: 'apply_proposal', proposal: { departments: [] } },
    { action: 'update', departmentId: 'camera', document, provenance: { kind: 'llm_generated', modelCallId: randomUUID() } },
    { action: 'update', departmentId: 'camera', document: { ...document, approved: true } },
    { action: 'update', departmentId: 'camera', document: { ...document, requirements: [{ id: 'forged', label: 'Unowned scene', direction: 'A fabricated direction.', sceneIds: ['not-in-this-script'], characterIds: [] }] } },
  ]) assert.equal((await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, ...body })).status, 400);
  const foreign = { ...structuredClone(f.p), id: randomUUID(), ownerId: 'another-owner' }; await f.store.create(foreign);
  assert.equal((await call(f.handler, `/api/projects/${foreign.id}/department-plans`)).status, 404);
  assert.equal((await call(f.handler, `/api/projects/${foreign.id}/department-plans`, { expectedVersion: foreign.version, action: 'prepare' })).status, 404);
  assert.equal(f.counters().submits, 0);
});

test('operation-specific paid department proposal is separately authorized, costed and explicitly applied as unapproved plans', async t => {
  const f = await fixture(t), consent = await grant(f); assert.equal(consent.operation, 'plan_departments'); assert.equal(f.counters().submits, 0);
  const { body, response } = await start(f, consent); ok(response); const saved = response.json.call;
  assert.equal(saved.chargeState, 'settled'); assert.equal(saved.actualMicroUsd, 20); assert.equal(saved.result.departments.departments.length, 17);
  assert.equal((await call(f.handler, base(f) + '/department-plans')).json.departmentContext.departments.filter(d => d.current).length, 0);
  const input = JSON.parse(f.requests[0].body.input); assert.equal(input.operation, 'plan_departments'); assert.deepEqual(input.context.screenplay.current.document, currentScreenplay(f.p).document);
  const replay = await call(f.handler, base(f) + '/planning-calls', body); ok(replay); assert.equal(replay.json.call.id, saved.id); assert.equal(f.counters().submits, 1);
  const applied = await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: saved.id }); ok(applied); f.p = applied.json.project;
  assert(applied.json.departmentContext.departments.every(d => d.current && !d.approved)); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.counters().submits, 1);
  const other = await call(f.handler, '/api/projects', { premise: 'A different film.' }); ok(other);
  assert.equal((await call(f.handler, `/api/projects/${other.json.project.id}/department-plans/apply-proposal`, { expectedVersion: other.json.project.version, callId: saved.id })).status, 404);
  for (const extra of [{ departments: saved.result.departments }, { approved: true }, { modelCallId: saved.id }]) assert.equal((await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: saved.id, ...extra })).status, 400);
});

test('incomplete department output preserves known response and actual usage without application or automatic paid retries', async t => {
  const f = await fixture(t, { malformed: true }), consent = await grant(f), { response, body } = await start(f, consent); ok(response);
  const saved = response.json.call; assert.equal(saved.chargeState, 'settled'); assert.equal(saved.actualMicroUsd, 20); assert.match(saved.providerResponseId, /^resp_departments_/); assert.ok(saved.result.planError); assert.equal(saved.result.departments, undefined);
  assert.equal((await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId: saved.id })).status, 409);
  ok(await call(f.handler, base(f) + '/planning-calls', body)); assert.equal(f.counters().submits, 1); assert.equal(f.store.state.jobs.length, 0);
});

test('saved department calls can be polled after restart and pause, while changed screenplay scope prevents stale application', async t => {
  const f = await fixture(t, { queued: true }), consent = await grant(f), { response } = await start(f, consent); ok(response); const id = response.json.call.id;
  const restored = await new LocalStore(f.file).init(); restored.state.operationalControl.generationPaused = true;
  const handler = await createHandler({ env: f.env, store: restored, planningProvider: f.planningProvider });
  const polled = await call(handler, base(f) + `/planning-calls/${id}/poll`, { requestId: randomUUID() }); ok(polled); assert.equal(polled.json.call.result.departments.departments.length, 17); assert.equal(f.counters().submits, 1);
  const changed = await call(handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: { ...currentScreenplay(f.p).document, title: 'The ticket is now a different story.' } }); ok(changed);
  assert.equal((await call(handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: changed.json.project.version, callId: id })).status, 409);
  assert.equal(f.counters().submits, 1); assert.equal(restored.state.jobs.length, 0);
});

test('department source changes hold earlier approvals and simultaneous focused saves cannot overwrite one another', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); const context = prepared.json.departmentContext;
  ok(await call(f.handler, base(f) + '/approvals', approveBody(f, context, 'camera')));
  const document = unit(context, 'camera').current.document;
  const results = await Promise.all(['A locked platform frame.','A slow observational platform move.'].map(summary => call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'camera', document: { ...document, summary } })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); f.p = results.find(r => r.status === 200).json.project;
  const screenplay = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: { ...currentScreenplay(f.p).document, title: 'Changed after departmental review' } }); ok(screenplay); f.p = screenplay.json.project;
  const held = await call(f.handler, base(f) + '/department-plans'); ok(held); assert.equal(unit(held.json.departmentContext, 'camera').approved, false); assert(held.json.departmentContext.departments.every(d => d.stale));
  const staleApproval = approveBody(f, held.json.departmentContext, 'camera'); assert.equal((await call(f.handler, base(f) + '/approvals', staleApproval)).status, 409);
  assert.equal(f.counters().submits, 0);
});

test('global generation pause blocks new department calls while free planning and existing approvals remain usable', async t => {
  const f = await fixture(t), consent = await grant(f); f.store.state.operationalControl.generationPaused = true;
  const quoted = await call(f.handler, base(f) + '/planning/plan_departments'); ok(quoted); assert.equal(quoted.json.availability.enabled, false); assert.ok(quoted.json.quote);
  assert.equal((await start(f, consent)).response.status, 409); ok(await prepare(f));
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.planningReservations?.length || 0, 0);
});

test('refresh explicitly rebuilds one stale department, preserves recorded valid choices and retains earlier source history', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared);
  const document = structuredClone(unit(prepared.json.departmentContext, 'casting').current.document);
  document.summary = 'A manual casting summary kept in the earlier version.';
  const choice = { id: 'reviewed-mira', label: 'Mira performance', value: 'Understated, observant delivery selected as creative direction only.', status: 'user_selected', sceneIds: ['platform'], characterIds: ['mira'] };
  document.choices.push(choice);
  const changed = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'casting', document }); ok(changed); f.p = changed.json.project;
  const before = structuredClone(f.p.departmentPlanning), script = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: { ...currentScreenplay(f.p).document, title: 'A revised promise at the station' } }); ok(script); f.p = script.json.project;
  ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: f.p.screenplay.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true }));
  const preserved = await prepare(f); ok(preserved); assert.deepEqual(f.p.departmentPlanning, before); assert(preserved.json.departmentContext.departments.every(d => d.stale));
  const body = { expectedVersion: f.p.version, action: 'refresh', departmentId: 'casting', acknowledgeSourceChange: false };
  assert.equal((await call(f.handler, base(f) + '/department-plans', body)).status, 400);
  const refreshed = await call(f.handler, base(f) + '/department-plans', { ...body, acknowledgeSourceChange: true }); ok(refreshed); f.p = refreshed.json.project;
  const current = unit(refreshed.json.departmentContext, 'casting'); assert.equal(current.sourceStale, false); assert.equal(current.dependencyStale, true); assert.equal(current.approved, false); assert.equal(current.current.version, 3); assert(current.current.document.choices.some(c => JSON.stringify(c) === JSON.stringify(choice)));
  assert.notEqual(current.current.document.summary, document.summary);
  for (const id of ids.filter(id => id !== 'casting')) assert.equal(unit(refreshed.json.departmentContext, id).stale, true);
  const history = f.p.departmentPlanning.departments.find(d => d.id === 'casting').versions; assert.deepEqual(history[1].document, document); assert.equal(f.p.departmentPlanning.sources.length, 2); assert.equal(f.counters().submits, 0);
});

test('removed screenplay references block silent refresh until a focused user repair explicitly remaps the department', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared);
  const document = structuredClone(unit(prepared.json.departmentContext, 'voice').current.document);
  document.choices.push({ id: 'waiting-performance', label: 'Waiting room delivery', value: 'A quiet final line.', status: 'user_selected', sceneIds: ['waiting-room'], characterIds: ['mira'] });
  const edited = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'voice', document }); ok(edited); f.p = edited.json.project;
  const scriptDocument = structuredClone(currentScreenplay(f.p).document); scriptDocument.scenes = scriptDocument.scenes.filter(s => s.id !== 'waiting-room');
  const script = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: scriptDocument }); ok(script); f.p = script.json.project;
  ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: f.p.screenplay.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true }));
  const before = structuredClone(f.p.departmentPlanning);
  assert.equal((await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'refresh', departmentId: 'voice', acknowledgeSourceChange: true })).status, 409);
  assert.deepEqual((await call(f.handler, base(f))).json.project.departmentPlanning, before);
  const repairedDocument = structuredClone(document);
  for (const item of [...repairedDocument.requirements, ...repairedDocument.choices]) item.sceneIds = item.sceneIds.filter(id => id !== 'waiting-room');
  const repaired = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'voice', document: repairedDocument }); ok(repaired);
  assert.equal(unit(repaired.json.departmentContext, 'voice').sourceStale, false); assert.equal(unit(repaired.json.departmentContext, 'voice').dependencyStale, true); assert.equal(unit(repaired.json.departmentContext, 'voice').approved, false); assert.deepEqual(unit(repaired.json.departmentContext, 'voice').current.document.choices.find(c => c.id === 'waiting-performance').sceneIds, []);
  assert.deepEqual(repaired.json.project.departmentPlanning.departments.find(d => d.id === 'voice').versions[1].document, document); assert.equal(f.counters().submits, 0);
});

test('a same-version approval arriving after department validation atomically holds the save without publishing a new plan', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); const context = prepared.json.departmentContext;
  const before = structuredClone(f.p), lastApprovalId = (await f.store.records('approvals', f.p.id)).at(-1).id;
  const save = f.store.saveDepartmentPlans.bind(f.store); let raced = false;
  f.store.saveDepartmentPlans = async (next, expected, evidence) => {
    assert.equal(evidence.expectedApprovalId, lastApprovalId);
    if (!raced) { raced = true; await f.store.approve(f.p, approveBody(f, context, 'rights'), f.p.ownerId); }
    return save(next, expected, evidence);
  };
  const response = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'camera', document: { ...unit(context, 'camera').current.document, summary: 'A correction prepared before the concurrent review decision.' } });
  assert.equal(response.status, 409); assert.equal(raced, true); assert.deepEqual((await call(f.handler, base(f))).json.project, before);
  const current = (await call(f.handler, base(f) + '/department-plans')).json.departmentContext;
  assert.equal(unit(current, 'rights').approved, true); assert.equal(unit(current, 'camera').current.version, 1);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('same-version script revocation during proposal apply cannot persist approved-source department versions or repeat a paid call', async t => {
  const f = await fixture(t), consent = await grant(f), { response } = await start(f, consent); ok(response);
  const callId = response.json.call.id, before = structuredClone(f.p), save = f.store.saveDepartmentPlans.bind(f.store); let raced = false;
  f.store.saveDepartmentPlans = async (next, expected, evidence) => {
    if (!raced) { raced = true; await f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: 'screenplay', version: f.p.screenplay.currentVersion, decision: 'revoked' }, f.p.ownerId); }
    return save(next, expected, evidence);
  };
  const applied = await call(f.handler, base(f) + '/department-plans/apply-proposal', { expectedVersion: f.p.version, callId });
  assert.equal(applied.status, 409); assert.equal(raced, true); assert.deepEqual((await call(f.handler, base(f))).json.project, before);
  assert.equal((await call(f.handler, base(f) + '/screenplay')).json.screenplayContext.approved, false);
  assert.equal(f.counters().submits, 1); assert.equal(f.store.state.planningReservations.length, 1); assert.equal(f.store.state.jobs.length, 0);
});

function mediaModel() {
  const endpoint = candidateEndpointManifest.M09;
  return { id: 'M09', provider: 'fal', endpoint, model_version: 'synthetic-media-v1', active: true, execution_tested: true, quality_validated: true,
    capabilities: { tasks: ['image_edit'], outputModalities: ['image'], inputModes: ['image','text'], aspectRatios: ['1:1'], resolutions: ['1024x1024'], languages: ['English'], identityReferences: true, priority: 1 },
    schema_evidence: { verified: true, version: 'synthetic-schema', sourceUrl: 'https://example.test/schema', expiresAt: '2099-01-01T00:00:00Z', endpoint, modelVersion: 'synthetic-media-v1', inputSchemaHash: hash(reviewedFalInputSchema(endpoint)) },
    price_version: 'synthetic-price', price_evidence: { verified: true, version: 'synthetic-price', currency: 'USD', unit: 'image', unitMicroUsd: 25000, rounding: 'ceil', expiresAt: '2099-01-01T00:00:00Z', sourceUrl: 'https://example.test/price', configurationVerified: true, configuration: { num_images: 1 } } };
}
const mediaQuote = (f, extra = {}) => ({ task: 'image_edit', requirements: { modality: 'image', inputModes: ['image','text'], aspectRatio: '1:1' }, expectedVersion: f.p.version, modelId: 'M09', artifactId: 'story', artifactVersion: f.p.story.version, input: { prompt: 'A station platform reference.', image_urls: ['https://cdn.example.test/reference.png'], num_images: 1, image_size: { width: 1024, height: 1024 } }, ...extra });

test('department plan text cannot be quoted as a generatable media artifact', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); f.store.state.models.push(mediaModel());
  const target = mediaQuote(f, { artifactId: 'department:camera', artifactVersion: unit(prepared.json.departmentContext, 'camera').current.version });
  assert.equal((await call(f.handler, base(f) + '/quotes', target)).status, 409);
  assert.equal((await call(f.handler, base(f) + '/quotes', { ...target, requestId: randomUUID() })).status, 409);
  assert.equal(f.store.state.quotes?.length || 0, 0); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('media spending needs all seventeen current department reviews and a later revocation blocks a new authorization', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); f.store.state.models.push(mediaModel());
  const quoted = await call(f.handler, base(f) + '/quotes', mediaQuote(f, { requestId: randomUUID() })); ok(quoted);
  const body = { requestId: randomUUID(), expectedVersion: f.p.version, quoteId: quoted.json.quote.id, maxMicroUsd: 30000, finishReserveMicroUsd: 5000 };
  assert.equal((await call(f.handler, base(f) + '/spending-authorizations', body)).status, 409); assert.equal(f.store.state.spendingAuthorizations?.length || 0, 0);
  for (const id of ids) ok(await call(f.handler, base(f) + '/approvals', approveBody(f, prepared.json.departmentContext, id)));
  const authorized = await call(f.handler, base(f) + '/spending-authorizations', body); ok(authorized); assert.equal(authorized.json.authorization.generationAuthorized, false);
  ok(await call(f.handler, base(f) + '/approvals', approveBody(f, prepared.json.departmentContext, 'camera', { decision: 'revoked', ackPlanningOnly: false })));
  assert.equal((await call(f.handler, base(f) + '/spending-authorizations', { ...body, requestId: randomUUID() })).status, 409);
  assert.equal(f.store.state.spendingAuthorizations.length, 1); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('fresh media quotes cannot authorize production through old downstream approvals after an upstream department changes', async t => {
  const f = await fixture(t), prepared = await prepare(f); ok(prepared); f.store.state.models.push(mediaModel());
  for (const id of ids) ok(await call(f.handler, base(f) + '/approvals', approveBody(f, prepared.json.departmentContext, id)));
  const document = { ...structuredClone(unit(prepared.json.departmentContext, 'camera').current.document), summary: 'Use a measured move tied to the ticket exchange.' };
  const changed = await call(f.handler, base(f) + '/department-plans', { expectedVersion: f.p.version, action: 'update', departmentId: 'camera', document }); ok(changed); f.p = changed.json.project;
  ok(await call(f.handler, base(f) + '/approvals', approveBody(f, changed.json.departmentContext, 'camera')));
  const current = (await call(f.handler, base(f) + '/department-plans')).json.departmentContext;
  assert.equal(unit(current, 'camera').approved, true); assert.equal(unit(current, 'lighting').approvalDecision, 'approved'); assert.equal(unit(current, 'lighting').dependencyStale, true); assert.equal(unit(current, 'lighting').approved, false);
  const quoted = await call(f.handler, base(f) + '/quotes', mediaQuote(f, { requestId: randomUUID() })); ok(quoted);
  const denied = await call(f.handler, base(f) + '/spending-authorizations', { requestId: randomUUID(), expectedVersion: f.p.version, quoteId: quoted.json.quote.id, maxMicroUsd: 30000, finishReserveMicroUsd: 5000 });
  assert.equal(denied.status, 409); assert.equal(f.store.state.spendingAuthorizations?.length || 0, 0); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

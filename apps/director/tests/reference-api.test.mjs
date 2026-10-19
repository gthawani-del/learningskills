import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../server.mjs';
import { LocalStore } from '../store.mjs';
import { referenceFixture, referenceSession, referencePng } from './reference-fixture-server.mjs';

async function call(handler, path, body, method = body === undefined ? 'GET' : 'POST', token = referenceSession) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { url: path, method, headers: { host: 'localhost', 'content-type': 'application/json', ...(token ? { cookie: 'director_session=' + token } : {}) }, socket: { remoteAddress: '127.0.0.1' } });
  let status, data, headers; const res = { setHeader() {}, writeHead(value, values) { status = value; headers = values || {}; this.headersSent = true; }, end(value) { data = value; } };
  await handler(req, res);
  return { status, headers, data: Buffer.from(data || ''), ...((headers?.['Content-Type'] || '').startsWith('application/json') ? { json: JSON.parse(String(data)) } : {}) };
}
const ok = r => assert.ok([200,201].includes(r.status), JSON.stringify(r.json || { status: r.status }));
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'director-reference-api-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const f = await referenceFixture({ file: join(dir, 'state.json'), ...options });
  return { ...f, dir, p: f.project, handler: await createHandler(f) };
}
const base = f => '/api/projects/' + f.p.id;
async function summary(f) { const r = await call(f.handler, base(f) + '/reference-production'); ok(r); return r.json; }
async function subject(f, id = 'identity:mira') { return (await summary(f)).referenceContext.subjects.find(s => s.id === id); }
async function command(f, action, fields = {}) {
  const r = await call(f.handler, base(f) + '/reference-production', { expectedVersion: f.p.version, action, ...fields });
  if ([200,201].includes(r.status)) f.p = r.json.project;
  return r;
}
async function direction(f, id = 'identity:mira') {
  const current = await subject(f, id);
  const r = await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'reference_brief:' + id, version: current.current.version, decision: 'approved' }); ok(r); return r;
}
async function budget(f, budgetMicroUsd = 500000) {
  const r = await call(f.handler, base(f) + '/spending-budget', { requestId: randomUUID(), expectedVersion: f.p.version, budgetMicroUsd, finishReserveMicroUsd: 0 }); ok(r); return r;
}
async function quote(f, id = 'identity:mira', extra = {}) {
  return call(f.handler, base(f) + '/reference-production/quotes', { expectedVersion: f.p.version, requestId: randomUUID(), subjectId: id, modelId: id.startsWith('look:') ? 'F-reference-look-local' : 'F-reference-local', ...extra });
}
async function authorize(f, quoteId, extra = {}) {
  return call(f.handler, base(f) + '/spending-authorizations', { requestId: randomUUID(), expectedVersion: f.p.version, quoteId, maxMicroUsd: 100000, finishReserveMicroUsd: 10000, ...extra });
}
async function ready(f, id = 'identity:mira') {
  if (!(await summary(f)).referenceContext.subjects.length) ok(await command(f, 'prepare'));
  await direction(f, id); await budget(f); const q = await quote(f, id); ok(q);
  const a = await authorize(f, q.json.quote.id); ok(a); return { q: q.json.quote, a: a.json.authorization };
}
async function run(f, prepared, requestId = randomUUID()) {
  return call(f.handler, base(f) + '/reference-production/jobs', { expectedVersion: f.p.version, quoteId: prepared.q.id, authorizationId: prepared.a.id, requestId });
}
async function complete(f, prepared) {
  const started = await run(f, prepared); ok(started); const polled = await call(f.handler, base(f) + '/jobs/' + started.json.job.id + '/poll', {}); ok(polled);
  assert.equal(polled.json.job.status, 'completed'); return polled.json.job;
}
async function imported(f, jobId) { const r = await call(f.handler, base(f) + '/reference-production/import', { jobId }); ok(r); return r.json; }
async function select(f, candidate) { const r = await command(f, 'select', { subjectId: candidate.subjectId, candidateId: candidate.id, acknowledgeReview: true }); ok(r); return r; }
async function approveSelection(f, id = 'identity:mira', extra = {}) {
  const current = await subject(f, id);
  return call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'reference_selection:' + id, version: current.selection.version, decision: 'approved', acknowledgeReferenceReview: true, ...extra });
}

test('reference preparation is free, source-prefilled, compact data with no selected or generated image', async t => {
  const f = await fixture(t); assert.equal((await summary(f)).referenceContext.subjects.length, 0);
  const prepared = await command(f, 'prepare'); ok(prepared); const subjects = prepared.json.referenceContext.subjects;
  assert.deepEqual(new Set(subjects.map(s => s.id)), new Set(['identity:mira','look:mira','identity:rafi','look:rafi','location:platform','location:waiting-room']));
  assert(subjects.every(s => s.current.document.direction.trim() && s.current.document.acceptanceCriteria.length && !s.selection && !s.selectionApproved && !s.candidates.length));
  const before = structuredClone(f.p); ok(await command(f, 'prepare')); assert.deepEqual(f.p, before);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.assets.length, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('reference endpoints require the authenticated project owner and reject client generation authority', async t => {
  const f = await fixture(t); ok(await command(f, 'prepare'));
  for (const token of [null,'foreign-fixture-session']) {
    const r = await call(f.handler, base(f) + '/reference-production', undefined, 'GET', token); assert.equal(r.status, token ? 404 : 401);
    const q = await call(f.handler, base(f) + '/reference-production/quotes', { expectedVersion: f.p.version, requestId: randomUUID(), subjectId: 'identity:mira', modelId: 'F-reference-local' }, 'POST', token); assert.equal(q.status, token ? 404 : 401);
  }
  for (const fields of [{ approved: true }, { sources: [] }, { actorId: 'foreign' }, { action: 'select', subjectId: 'identity:mira', candidateId: randomUUID(), acknowledgeReview: true, assetId: randomUUID() }]) assert.equal((await call(f.handler, base(f) + '/reference-production', { expectedVersion: f.p.version, action: 'prepare', ...fields })).status, 400);
  assert.equal((await call(f.handler, base(f), { expectedVersion: f.p.version, referenceProduction: f.p.referenceProduction }, 'PATCH')).status, 400);
  assert.equal(f.counters().submits, 0);
});

test('reference direction approval and a project spending cap precede the first billable submission', async t => {
  const f = await fixture(t); ok(await command(f, 'prepare'));
  assert.equal((await quote(f)).status, 409); await direction(f);
  const quoted = await quote(f); ok(quoted); const allowed = await authorize(f, quoted.json.quote.id); ok(allowed);
  assert.equal((await run(f, { q: quoted.json.quote, a: allowed.json.authorization })).status, 409); assert.equal(f.counters().submits, 0);
  await budget(f); const started = await run(f, { q: quoted.json.quote, a: allowed.json.authorization }); ok(started); assert.equal(f.counters().submits, 1);
});

test('a reference traverses quoted authorization, one job, private PNG import, selection and explicit human approval', async t => {
  const f = await fixture(t), prepared = await ready(f); assert.equal(prepared.q.totalMicroUsd, 25000); assert.equal(f.counters().submits, 0);
  assert.equal(f.store.state.assets.length, 0); const job = await complete(f, prepared); assert.equal(f.counters().submits, 1);
  assert.equal(job.charge_state, 'held'); assert.equal(f.store.state.assets.length, 0);
  const image = await imported(f, job.id); assert.equal(image.asset.mime, 'image/png'); assert.equal(image.candidate.subjectId, 'identity:mira'); assert.equal(image.candidate.origin, 'generated');
  assert.equal(image.asset.storageKey, undefined); assert.equal((await subject(f)).selection, null);
  const content = await call(f.handler, base(f) + '/assets/' + image.asset.id + '/content'); ok(content); assert.equal(content.headers['Content-Type'], 'image/png'); assert.deepEqual(content.data, referencePng()); assert.match(content.headers['Cache-Control'], /private/);
  await select(f, image.candidate); assert.equal((await subject(f)).selectionApproved, false);
  assert.equal((await approveSelection(f, 'identity:mira', { acknowledgeReferenceReview: false })).status, 400);
  ok(await approveSelection(f)); const approved = await subject(f); assert.equal(approved.selectionApproved, true); assert.equal(approved.selection.assetId, image.asset.id);
  assert.equal((await summary(f)).referenceContext.generationAuthorized, false); assert.equal(f.counters().submits, 1);
});

test('quote and run request replays do not regenerate a signed payload or submit duplicate jobs', async t => {
  const f = await fixture(t), prepared = await ready(f), requestId = randomUUID();
  const [first, duplicate] = await Promise.all([run(f, prepared, requestId), run(f, prepared, requestId)]); ok(first); ok(duplicate); assert.equal(first.json.job.id, duplicate.json.job.id); assert.equal(f.counters().submits, 1);
  ok(await call(f.handler, base(f) + '/jobs/' + first.json.job.id + '/poll', {}));
  const image = await imported(f, first.json.job.id), again = await imported(f, first.json.job.id); assert.equal(again.candidate.id, image.candidate.id); assert.equal(again.asset.id, image.asset.id); assert.equal(f.store.state.assets.length, 1); assert.equal(f.counters().puts, 1);
  const retry = await run(f, prepared, requestId); ok(retry); assert.equal(retry.json.job.id, first.json.job.id); assert.equal(f.counters().submits, 1);
});

test('uncertain provider submission retains its hold and never automatically resubmits the reference', async t => {
  const f = await fixture(t, { submitThrows: true }), prepared = await ready(f), requestId = randomUUID(), first = await run(f, prepared, requestId); ok(first);
  assert.equal(first.json.job.status, 'unknown'); assert.equal(first.json.job.charge_state, 'unknown'); assert.equal(f.counters().submits, 1);
  ok(await run(f, prepared, requestId)); ok(await call(f.handler, base(f) + '/jobs/' + first.json.job.id + '/poll', {}));
  assert.equal((await run(f, prepared)).status, 409); assert.equal((await call(f.handler, base(f) + '/reference-production/import', { jobId: first.json.job.id })).status, 409);
  assert.equal(f.counters().submits, 1); assert.equal(f.counters().downloads, 0); assert.equal(f.store.state.assets.length, 0);
});

test('generation pause holds new reference submissions while known requests can still finish and import', async t => {
  const f = await fixture(t), prepared = await ready(f), requestId = randomUUID(); f.store.state.operationalControl.generationPaused = true;
  assert.equal((await run(f, prepared, requestId)).status, 409); assert.equal(f.counters().submits, 0);
  f.store.state.operationalControl.generationPaused = false; const started = await run(f, prepared, requestId); ok(started);
  f.store.state.operationalControl.generationPaused = true; f.store.state.models.forEach(m => m.active = false);
  const polled = await call(f.handler, base(f) + '/jobs/' + started.json.job.id + '/poll', {}); ok(polled); assert.equal(polled.json.job.status, 'completed');
  const image = await imported(f, started.json.job.id); assert.equal(image.candidate.jobId, started.json.job.id); assert.equal(f.counters().submits, 1);
});

test('failed saved-image import recovers the same completed provider request without another generation', async t => {
  const f = await fixture(t, { downloadFailures: 1 }), prepared = await ready(f), job = await complete(f, prepared);
  const failed = await call(f.handler, base(f) + '/reference-production/import', { jobId: job.id }); assert.ok(failed.status >= 400); assert.equal(f.store.state.assets.length, 0);
  const image = await imported(f, job.id); assert.equal(image.candidate.jobId, job.id); assert.equal(f.counters().submits, 1); assert.equal(f.counters().downloads, 2); assert.equal(f.counters().puts, 1);
});

test('corrupt or incorrectly sized output bytes are rejected without making a reference candidate', async t => {
  for (const outputBytes of [Buffer.from('not a PNG'), referencePng(1,1)]) {
    const f = await fixture(t, { outputBytes }), prepared = await ready(f), job = await complete(f, prepared);
    const failed = await call(f.handler, base(f) + '/reference-production/import', { jobId: job.id }); assert.ok(failed.status >= 400); assert.equal(f.store.state.assets.length, 0); assert.equal((await subject(f)).candidates.length, 0); assert.equal(f.counters().submits, 1);
  }
});

test('a direction edit holds its old quote and preserves the earlier reference history', async t => {
  const f = await fixture(t), prepared = await ready(f), before = structuredClone(f.p.referenceProduction), current = await subject(f);
  ok(await command(f, 'update', { subjectId: current.id, document: { ...current.current.document, direction: current.current.document.direction + ' Retain an unhurried, attentive expression.' } }));
  assert.equal((await run(f, prepared)).status, 409); assert.equal(f.counters().submits, 0); assert.deepEqual(f.p.referenceProduction.subjects.find(s => s.id === current.id).versions[0], before.subjects.find(s => s.id === current.id).versions[0]); assert.equal((await subject(f)).directionApproved, false);
});

test('a historical completed image remains saved after revision but cannot be selected for another subject version', async t => {
  const f = await fixture(t), prepared = await ready(f), job = await complete(f, prepared), current = await subject(f);
  ok(await command(f, 'update', { subjectId: current.id, document: { ...current.current.document, direction: current.current.document.direction + ' Review the quieter alternative.' } }));
  const image = await imported(f, job.id); assert.equal(image.candidate.subjectVersion, current.current.version);
  await direction(f); assert.equal((await command(f, 'select', { subjectId: current.id, candidateId: image.candidate.id, acknowledgeReview: true })).status, 409); assert.equal((await subject(f)).selection, null); assert.equal(f.store.state.assets.length, 1); assert.equal(f.counters().submits, 1);
});

test('look generation requires an approved selected identity and explicit permission to share its private reference', async t => {
  const f = await fixture(t); ok(await command(f, 'prepare'));
  assert.equal((await command(f, 'refresh', { subjectId: 'look:mira', acknowledgeSourceChange: true })).status, 409);
  const identity = await imported(f, (await complete(f, await ready(f))).id); await select(f, identity.candidate); ok(await approveSelection(f));
  ok(await command(f, 'refresh', { subjectId: 'look:mira', acknowledgeSourceChange: true })); await direction(f, 'look:mira');
  assert.equal((await quote(f, 'look:mira')).status, 400); assert.equal(f.counters().signs, 0);
  const requestId = randomUUID(), quoted = await quote(f, 'look:mira', { requestId, shareIdentityReference: true }); ok(quoted); const replayed = await quote(f, 'look:mira', { requestId, shareIdentityReference: true }); ok(replayed); assert.equal(replayed.json.quote.id, quoted.json.quote.id); assert.equal(f.counters().signs, 1);
  const allowed = await authorize(f, quoted.json.quote.id); ok(allowed); const lookJob = await complete(f, { q: quoted.json.quote, a: allowed.json.authorization }), look = await imported(f, lookJob.id);
  await select(f, look.candidate); ok(await approveSelection(f, 'look:mira')); assert.equal((await subject(f, 'look:mira')).selectionApproved, true);
  const payload = f.requests.at(-1).input; assert.equal(payload.image_urls.length, 1); assert.match(payload.image_urls[0], /^https:\/\/reference-fixture\.supabase\.co\/storage\/v1\/object\/sign\//); assert.equal(f.counters().submits, 2);
});

test('reference import and candidate selection reject foreign projects, forged output URLs and missing review acknowledgement', async t => {
  const f = await fixture(t), prepared = await ready(f), job = await complete(f, prepared), image = await imported(f, job.id);
  assert.equal((await call(f.handler, base(f) + '/reference-production/import', { jobId: job.id, url: 'https://attacker.example/image.png' })).status, 400);
  assert.equal((await call(f.handler, base(f) + '/reference-production/import', { jobId: randomUUID() })).status, 404);
  assert.equal((await command(f, 'select', { subjectId: 'identity:mira', candidateId: image.candidate.id, acknowledgeReview: false })).status, 400);
  assert.ok([400,409].includes((await command(f, 'select', { subjectId: 'identity:rafi', candidateId: image.candidate.id, acknowledgeReview: true })).status));
  assert.equal((await call(f.handler, base(f) + '/assets/' + image.asset.id + '/content', undefined, 'GET', 'foreign-fixture-session')).status, 404);
  assert.equal(f.counters().submits, 1);
});

test('private reference bytes and approved selection survive a real store restart without copying spending authority into the project', async t => {
  const f = await fixture(t), prepared = await ready(f), image = await imported(f, (await complete(f, prepared)).id); await select(f, image.candidate); ok(await approveSelection(f));
  const restored = await new LocalStore(f.store.file).init(); restored.user = f.store.user;
  const handler = await createHandler({ ...f, store: restored }); const status = await call(handler, base(f) + '/reference-production'); ok(status); const current = status.json.referenceContext.subjects.find(s => s.id === 'identity:mira'); assert.equal(current.selectionApproved, true); assert.equal(current.selection.assetId, image.asset.id);
  const bytes = await call(handler, base(f) + '/assets/' + image.asset.id + '/content'); ok(bytes); assert.deepEqual(bytes.data, referencePng()); assert.equal(f.counters().submits, 1);
  assert.equal(f.p.referenceProduction.generationAuthorized, undefined);
});

test('one reference direction permits at most two explicit attempts without hidden variants', async t => {
  const f = await fixture(t), prepared = await ready(f);
  const first = await complete(f, prepared); await imported(f, first.id);
  assert.equal((await run(f, prepared)).status, 409); assert.equal(f.counters().submits, 1);
  const reviewed = await call(f.handler, base(f) + '/reference-production/reviews', { jobId: first.id, expectedVersion: f.p.version, reason: 'The intended restrained expression needs a more attentive eye line; review that specific correction in the second image.' }); ok(reviewed); assert.equal(f.counters().submits, 1);
  await imported(f, (await complete(f, prepared)).id);
  assert.equal((await run(f, prepared)).status, 409); assert.equal(f.counters().submits, 2); assert.equal(f.store.state.jobs.length, 2); assert.equal((await subject(f)).candidates.length, 2); assert.equal((await subject(f)).selection, null);
});

test('reference quotes cannot accept client prompts, prices, provider URLs or forged approval fields', async t => {
  const f = await fixture(t); ok(await command(f, 'prepare')); await direction(f);
  for (const extra of [{ input: { prompt: 'A client override.' } }, { prompt: 'A client override.' }, { totalMicroUsd: 1 }, { endpoint: 'https://attacker.example' }, { approved: true }, { identityUrl: 'https://attacker.example/private.png' }]) assert.equal((await quote(f, 'identity:mira', extra)).status, 400);
  assert.equal(f.counters().submits, 0); assert.equal(f.counters().downloads, 0);
});

test('a source review revoked between validation and free reference persistence prevents the whole write', async t => {
  const f = await fixture(t), before = structuredClone(f.p), save = f.store.saveReferenceProduction.bind(f.store); let raced = false;
  f.store.saveReferenceProduction = async (next, version, evidence) => {
    if (!raced) { raced = true; const departments = await call(f.handler, base(f) + '/department-plans'), rights = departments.json.departmentContext.departments.find(s => s.id === 'rights'); await f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: 'department:rights', version: rights.current.version, decision: 'revoked' }, f.p.ownerId); }
    return save(next, version, evidence);
  };
  assert.equal((await command(f, 'prepare')).status, 409); assert.equal(raced, true); assert.deepEqual((await call(f.handler, base(f))).json.project, before); assert.equal(f.counters().submits, 0);
});

test('a failed durable reference direction write publishes no partial in-memory archive or provider request', async t => {
  const f = await fixture(t), before = structuredClone(f.p); await mkdir(f.store.file + '.spending.tmp');
  assert.equal((await command(f, 'prepare')).status, 500); assert.deepEqual((await call(f.handler, base(f))).json.project, before); assert.equal(f.counters().submits, 0);
  await rm(f.store.file + '.spending.tmp', { recursive: true }); ok(await command(f, 'prepare')); assert.equal((await summary(f)).referenceContext.subjects.length, 6);
});

test('known reference requests poll and import from their saved model snapshot after registry removal and direction changes', async t => {
  const f = await fixture(t), prepared = await ready(f), started = await run(f, prepared); ok(started); const current = await subject(f), endpoint = f.requests[0].endpoint;
  ok(await command(f, 'update', { subjectId: current.id, document: { ...current.current.document, direction: current.current.document.direction + ' Review the revised purpose separately from the earlier image.' } }));
  f.store.state.models = []; f.store.state.operationalControl.generationPaused = true;
  const polled = await call(f.handler, base(f) + '/jobs/' + started.json.job.id + '/poll', {}); ok(polled); assert.equal(polled.json.job.status, 'completed'); assert.equal(f.queries.length, 2); assert(f.queries.every(query => query.endpoint === endpoint));
  const image = await imported(f, started.json.job.id); assert.equal(image.candidate.subjectVersion, current.current.version); assert.equal(f.counters().submits, 1); assert.equal((await subject(f)).selection, null);
});

test('revoking reference direction between reservation and dispatch prevents a paid submission under the same project version', async t => {
  const f = await fixture(t), prepared = await ready(f), current = await subject(f), claim = f.store.claimJob.bind(f.store); let raced = false;
  f.store.claimJob = async id => {
    if (!raced) { raced = true; await f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: 'reference_brief:' + current.id, version: current.current.version, decision: 'revoked' }, f.p.ownerId); }
    return claim(id);
  };
  assert.equal((await run(f, prepared)).status, 409); assert.equal(raced, true); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 1); assert.equal(f.store.state.jobs[0].status, 'reserved'); assert.equal(f.store.state.jobs[0].charge_state, 'held');
});

test('expired quotes, revoked authorizations and insufficient shared project caps hold new reference work before provider execution', async t => {
  for (const mode of ['expired','revoked','cap']) {
    const f = await fixture(t), prepared = await ready(f);
    if (mode === 'expired') { const saved = f.store.state.quotes.find(q => q.id === prepared.q.id).quote; saved.expiresAt = new Date(Date.parse(saved.createdAt) + 1).toISOString(); }
    if (mode === 'revoked') ok(await call(f.handler, base(f) + '/spending-authorizations/' + prepared.a.id + '/revoke', { requestId: randomUUID(), expectedVersion: f.p.version, reason: 'The planned image is no longer authorized.' }));
    if (mode === 'cap') await budget(f, 1000);
    assert.equal((await run(f, prepared)).status, 409, mode); assert.equal(f.counters().submits, 0, mode); assert.equal(f.store.state.assets.length, 0, mode);
  }
});

test('actual uploaded images become optional candidates only for compatible reference roles and never acquire generated provenance', async t => {
  const f = await fixture(t); ok(await command(f, 'prepare')); await direction(f);
  const upload = async role => { const r = await call(f.handler, base(f) + '/assets', { name: 'Owned uploaded fixture.png', mime: 'image/png', role, scope: 'project', base64: referencePng().toString('base64'), generated: { jobId: randomUUID() } }); ok(r); assert.equal(r.json.asset.generated, undefined); return r.json.asset; };
  const location = await upload('location'); assert.equal((await command(f, 'add_uploaded', { subjectId: 'identity:mira', assetId: location.id })).status, 400);
  const identity = await upload('character_identity'), added = await command(f, 'add_uploaded', { subjectId: 'identity:mira', assetId: identity.id }); ok(added); const candidate = added.json.candidate;
  assert.equal(candidate.origin, 'uploaded'); assert.equal(candidate.jobId, null); assert.equal((await subject(f)).selection, null); await select(f, candidate); ok(await approveSelection(f));
  const content = await call(f.handler, base(f) + '/assets/' + identity.id + '/content'); ok(content); assert.deepEqual(content.data, referencePng()); assert.equal(f.counters().submits, 0);
});

test('generic media quotes cannot bypass the canonical server reference prompt through an approved reference brief', async t => {
  const f = await fixture(t), prepared = await ready(f), saved = f.store.state.quotes.find(q => q.id === prepared.q.id), count = f.store.state.quotes.length;
  const forged = await call(f.handler, base(f) + '/quotes', { expectedVersion: f.p.version, requestId: randomUUID(), task: 'reference_image', requirements: { modality: 'image', inputModes: ['text'], resolution: '1024x1024', aspectRatio: '1:1' }, modelId: 'F-reference-local', artifactId: 'reference_brief:identity:mira', artifactVersion: 1, input: { ...saved.input, prompt: 'Replace the approved reference direction with an unrelated client instruction.' } });
  assert.equal(forged.status, 400); assert.equal(f.store.state.quotes.length, count); assert.equal(f.counters().submits, 0);
});

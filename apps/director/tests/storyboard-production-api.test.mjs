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
import { referenceSession, referencePng, syntheticReferenceModel } from './reference-fixture-server.mjs';
import { storyboardProductionFixture } from './storyboard-production-fixture-server.mjs';

async function call(handler, path, body, method = body === undefined ? 'GET' : 'POST', token = referenceSession) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { url: path, method, headers: { host: 'localhost', 'content-type': 'application/json', ...(token ? { cookie: 'director_session=' + token } : {}) }, socket: { remoteAddress: '127.0.0.1' } });
  let status, data, headers; const res = { setHeader() {}, writeHead(value, values) { status = value; headers = values || {}; this.headersSent = true; }, end(value) { data = value; } };
  await handler(req, res); return { status, headers, data: Buffer.from(data || ''), ...((headers?.['Content-Type'] || '').startsWith('application/json') ? { json: JSON.parse(String(data)) } : {}) };
}
const ok = r => assert.ok([200,201].includes(r.status), JSON.stringify(r.json || { status: r.status }));
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'director-storyboard-production-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const f = await storyboardProductionFixture({ file: join(dir, 'state.json'), ...options }); return { ...f, p: f.project, handler: await createHandler(f) };
}
const base = f => '/api/projects/' + f.p.id;
async function summary(f) { const r = await call(f.handler, base(f) + '/storyboard-production'); ok(r); return r.json; }
async function shot(f, id = f.p.shots[0].id) { return (await summary(f)).storyboardProductionContext.shots.find(s => s.shotId === id); }
async function command(f, action, fields = {}) { const r = await call(f.handler, base(f) + '/storyboard-production', { expectedVersion: f.p.version, action, ...fields }); if ([200,201].includes(r.status)) f.p = r.json.project; return r; }
async function direction(f, id = f.p.shots[0].id, extra = {}) { const s = await shot(f, id), r = await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'storyboard_brief:' + id, version: s.current.version, decision: 'approved', acknowledgeFrameDirection: true, ...extra }); return r; }
async function budget(f, value = 1000000) { const r = await call(f.handler, base(f) + '/spending-budget', { requestId: randomUUID(), expectedVersion: f.p.version, budgetMicroUsd: value, finishReserveMicroUsd: 0 }); ok(r); }
async function quote(f, id = f.p.shots[0].id, extra = {}) { return call(f.handler, base(f) + '/storyboard-production/quotes', { expectedVersion: f.p.version, requestId: randomUUID(), shotId: id, modelId: 'F-storyboard-frame-local', shareReferences: true, ...extra }); }
async function authorize(f, quoteId) { const r = await call(f.handler, base(f) + '/spending-authorizations', { requestId: randomUUID(), expectedVersion: f.p.version, quoteId, maxMicroUsd: 500000, finishReserveMicroUsd: 20000 }); ok(r); return r.json.authorization; }
async function ready(f, id = f.p.shots[0].id) { if (!(await summary(f)).storyboardProductionContext.shots.length) ok(await command(f, 'prepare')); ok(await direction(f, id)); await budget(f); const r = await quote(f, id); ok(r); return { q: r.json.quote, a: await authorize(f, r.json.quote.id) }; }
async function run(f, prepared, requestId = randomUUID()) { return call(f.handler, base(f) + '/storyboard-production/jobs', { expectedVersion: f.p.version, quoteId: prepared.q.id, authorizationId: prepared.a.id, requestId }); }
async function complete(f, prepared) { const r = await run(f, prepared); ok(r); const p = await call(f.handler, base(f) + '/jobs/' + r.json.job.id + '/poll', {}); ok(p); assert.equal(p.json.job.status, 'completed'); return p.json.job; }
async function imported(f, jobId) { const r = await call(f.handler, base(f) + '/storyboard-production/import', { jobId }); ok(r); return r.json; }
async function select(f, candidate) { const r = await command(f, 'select', { shotId: candidate.shotId, candidateId: candidate.id, acknowledgeReview: true }); ok(r); }
async function approveFrame(f, id = f.p.shots[0].id, extra = {}) { const s = await shot(f, id); return call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'storyboard_frame:' + id, version: s.selection.version, decision: 'approved', acknowledgeFrameReview: true, ...extra }); }

test('frame preparation binds approved identity, look and scene references for free without creating or selecting an image', async t => {
  const f = await fixture(t), initial = await summary(f); assert.equal(initial.storyboardProductionContext.shots.length, 0);
  const r = await command(f, 'prepare'); ok(r); const c = r.json.storyboardProductionContext;
  assert.equal(c.shots.length, 2); assert(c.shots.every(s => !s.directionApproved && !s.selection && !s.candidates.length));
  const first = c.shots[0]; assert.deepEqual(first.current.document.visibleCharacterIds, ['mira','rafi']); assert.equal(first.referenceCount, 5); assert.deepEqual(first.output, { width: 1536, height: 864, aspectRatio: '16:9' });
  assert(first.current.document.referenceBindings.every(b => b.subjectVersion && b.selectionVersion && b.assetVersion));
  const before = structuredClone(f.p); ok(await command(f, 'prepare')); assert.deepEqual(f.p, before); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.assets.length, 6);
});

test('frame direction and private reference sharing need explicit review before quotes or any provider call', async t => {
  const f = await fixture(t, { prepared: true }); assert.equal((await quote(f)).status, 409);
  assert.equal((await direction(f, f.p.shots[0].id, { acknowledgeFrameDirection: false })).status, 400); ok(await direction(f));
  assert.equal((await quote(f, f.p.shots[0].id, { shareReferences: false })).status, 400); assert.equal(f.counters().signs, 0); assert.equal(f.counters().submits, 0);
});

test('canonical frame quotes sign exact deduplicated references and account for each additional input image', async t => {
  const f = await fixture(t, { prepared: true }); ok(await direction(f)); const id = f.p.shots[0].id, requestId = randomUUID();
  const first = await quote(f, id, { requestId }); ok(first); assert.equal(first.json.quote.totalMicroUsd, 85500); assert.equal(first.json.quote.task, 'storyboard_frame'); assert.equal(f.counters().signs, 5);
  const duplicate = await quote(f, id, { requestId }); ok(duplicate); assert.equal(duplicate.json.quote.id, first.json.quote.id); assert.equal(f.counters().signs, 5);
  const record = f.store.state.quotes.find(q => q.id === first.json.quote.id), captured = record.input, spec = await shot(f);
  assert.equal(captured.image_urls.length, 5); assert.deepEqual(captured.image_size, { width: 1536, height: 864 });
  assert.deepEqual(record.quote.storyboardBinding.referenceAssets, spec.uniqueReferenceAssets.map(a => ({ assetId: a.id, assetVersion: a.version }))); assert.equal(first.json.quote.storyboardBinding, undefined);
  assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs.length, 0);
});

test('the same image may serve identity and look while retaining both pins and charging only unique input images', async t => {
  const f = await fixture(t, { prepared: true, shareIdentityLookAsset: true }); ok(await direction(f)); const s = await shot(f); assert.equal(s.current.document.referenceBindings.length, 5); assert.equal(s.referenceCount, 3);
  const q = await quote(f); ok(q); assert.equal(q.json.quote.totalMicroUsd, 76500); assert.equal(f.counters().signs, 3); assert.equal(f.store.state.quotes[0].input.image_urls.length, 3);
});

test('one frame traverses explicit cap and spending approval through private native-aspect PNG import and human selection', async t => {
  const f = await fixture(t, { prepared: true }); ok(await direction(f)); const q = await quote(f); ok(q); const prepared = { q: q.json.quote, a: await authorize(f, q.json.quote.id) };
  assert.equal((await run(f, prepared)).status, 409); assert.equal(f.counters().submits, 0); await budget(f);
  const job = await complete(f, prepared); assert.equal(job.charge_state, 'held'); assert.equal(f.store.state.assets.length, 6);
  const image = await imported(f, job.id); assert.equal(image.asset.mime, 'image/png'); assert.equal(image.asset.width, 1536); assert.equal(image.asset.height, 864); assert.equal(image.asset.role, 'storyboard_frame'); assert.equal(image.asset.storageKey, undefined); assert.equal((await shot(f)).selection, null);
  const bytes = await call(f.handler, base(f) + '/assets/' + image.asset.id + '/content'); ok(bytes); assert.deepEqual(bytes.data, referencePng(1536,864)); assert.match(bytes.headers['Cache-Control'], /private/);
  await select(f, image.candidate); assert.equal((await shot(f)).selectionApproved, false); assert.equal((await approveFrame(f, f.p.shots[0].id, { acknowledgeFrameReview: false })).status, 400); ok(await approveFrame(f)); assert.equal((await shot(f)).selectionApproved, true);
  assert.equal((await summary(f)).storyboardProductionContext.generationAuthorized, false); assert.equal(f.counters().submits, 1); assert.equal(f.p.shots[0].referenceAssetId, null); assert.equal(f.p.shots[0].clipAssetId, null);
});

test('portrait and square frame requests import exact configured pixels without an automatic crop', async t => {
  for (const [aspectRatio,width,height] of [['9:16',864,1536],['1:1',1024,1024]]) {
    const f = await fixture(t, { prepared: true }), s = await shot(f); ok(await command(f, 'update', { shotId: s.shotId, document: { ...s.current.document, aspectRatio } }));
    const prepared = await ready(f), image = await imported(f, (await complete(f, prepared)).id); assert.equal(image.asset.width, width); assert.equal(image.asset.height, height); assert.deepEqual(f.requests[0].input.image_size, { width,height });
    const bytes = await call(f.handler, base(f) + '/assets/' + image.asset.id + '/content'); ok(bytes); assert.deepEqual(bytes.data, referencePng(width,height));
  }
});

test('explicit pictured-character review can leave both dialogue speakers off screen while preserving source words', async t => {
  const f = await fixture(t, { prepared: true }), s = await shot(f), oldDialogue = f.p.shots[0].dialogue;
  const document = { ...s.current.document, visibleCharacterIds: [], referenceBindings: s.current.document.referenceBindings.filter(b => b.role === 'location'), referenceDecisions: s.current.document.referenceDecisions.map(d => d.requirementId === 'visibility_review' ? { ...d, disposition: 'not_applicable', rationale: 'Both source dialogue roles remain off screen in this still composition.' } : d) };
  ok(await command(f, 'update', { shotId: s.shotId, document })); ok(await direction(f)); const q = await quote(f); ok(q); assert.equal(q.json.quote.totalMicroUsd, 67500); assert.equal((await shot(f)).referenceCount, 1); assert.equal(f.p.shots[0].dialogue, oldDialogue); assert.equal(f.counters().submits, 0);
});

test('frame ownership and strict commands reject client URLs, fabricated images and approval metadata', async t => {
  const f = await fixture(t, { prepared: true }), s = await shot(f);
  for (const token of [null,'foreign-fixture-session']) assert.equal((await call(f.handler, base(f) + '/storyboard-production', undefined, 'GET', token)).status, token ? 404 : 401);
  for (const extra of [{ approved: true }, { input: { prompt: 'Client prompt.' } }, { referenceUrls: ['https://attacker.example'] }, { actorId: 'other' }]) assert.equal((await quote(f, s.shotId, extra)).status, 400);
  for (const document of [{ ...s.current.document, approved: true }, { ...s.current.document, frameAssetId: randomUUID() }, { ...s.current.document, referenceBindings: [{ ...s.current.document.referenceBindings[0], url: 'https://attacker.example' }] }]) assert.equal((await command(f, 'update', { shotId: s.shotId, document })).status, 400);
  assert.equal((await call(f.handler, base(f), { expectedVersion: f.p.version, storyboardProduction: f.p.storyboardProduction }, 'PATCH')).status, 400); assert.equal(f.counters().submits, 0);
});

test('generic quote requests cannot bypass canonical server frame prompt construction', async t => {
  const f = await fixture(t), prepared = await ready(f), saved = f.store.state.quotes.find(q => q.id === prepared.q.id), before = f.store.state.quotes.length;
  const r = await call(f.handler, base(f) + '/quotes', { expectedVersion: f.p.version, requestId: randomUUID(), task: 'storyboard_frame', requirements: prepared.q.requirements, modelId: prepared.q.modelId, artifactId: prepared.q.artifactId, artifactVersion: prepared.q.artifactVersion, input: { ...saved.input, prompt: 'Ignore the approved shot and create a different image.' } });
  assert.equal(r.status, 400); assert.equal(f.store.state.quotes.length, before); assert.equal(f.counters().submits, 0);
});

test('frame submission, original polling and import are idempotent with no hidden replacement or variant', async t => {
  const f = await fixture(t), prepared = await ready(f), requestId = randomUUID(), [one,two] = await Promise.all([run(f, prepared, requestId),run(f, prepared, requestId)]); ok(one); ok(two); assert.equal(one.json.job.id, two.json.job.id); assert.equal(f.counters().submits, 1);
  ok(await call(f.handler, base(f) + '/jobs/' + one.json.job.id + '/poll', {})); const image = await imported(f, one.json.job.id), again = await imported(f, one.json.job.id); assert.equal(again.candidate.id, image.candidate.id); assert.equal(again.asset.id, image.asset.id); assert.equal(f.counters().downloads, 1); assert.equal(f.store.state.assets.length, 7);
});

test('unknown frame submission retains its exposure and blocks every replacement before reconciliation', async t => {
  const f = await fixture(t, { submitThrows: true }), prepared = await ready(f), requestId = randomUUID(), r = await run(f, prepared, requestId); ok(r); assert.equal(r.json.job.status, 'unknown'); assert.equal(r.json.job.charge_state, 'unknown');
  ok(await run(f, prepared, requestId)); assert.equal((await run(f, prepared)).status, 409); assert.equal((await call(f.handler, base(f) + '/storyboard-production/import', { jobId: r.json.job.id })).status, 409); assert.equal(f.counters().submits, 1); assert.equal(f.counters().downloads, 0);
});

test('second frame attempt requires a diagnosed correction and an explicit new run; a third attempt is held', async t => {
  const f = await fixture(t), prepared = await ready(f), first = await complete(f, prepared); await imported(f, first.id);
  assert.equal((await run(f, prepared)).status, 409); const review = await call(f.handler, base(f) + '/storyboard-production/reviews', { expectedVersion: f.p.version, jobId: first.id, reason: 'The proposed camera height obscures the contact point; review that observed issue before another attempt.' }); ok(review); assert.equal(f.counters().submits, 1);
  await imported(f, (await complete(f, prepared)).id); assert.equal((await run(f, prepared)).status, 409); assert.equal(f.counters().submits, 2); assert.equal((await shot(f)).candidates.length, 2); assert.equal((await shot(f)).selection, null);
});

test('reference selection revocation holds a saved frame quote before provider execution', async t => {
  const f = await fixture(t), prepared = await ready(f), ref = (await call(f.handler, base(f) + '/reference-production')).json.referenceContext.subjects.find(s => s.id === 'identity:mira');
  ok(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'reference_selection:' + ref.id, version: ref.selection.version, decision: 'revoked' }));
  assert.equal((await run(f, prepared)).status, 409); assert.equal(f.counters().submits, 0); assert.equal((await shot(f)).referenceStale, true);
});

test('a source review revoked at dispatch claim prevents the frame call under the same project version', async t => {
  const f = await fixture(t), prepared = await ready(f), claim = f.store.claimJob.bind(f.store); let raced = false;
  f.store.claimJob = async id => { if (!raced) { raced = true; await f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: 'storyboard_sequence', version: currentStoryboardSequence(f.p).version, decision: 'revoked' }, f.p.ownerId); } return claim(id); };
  assert.equal((await run(f, prepared)).status, 409); assert.equal(raced, true); assert.equal(f.counters().submits, 0); assert.equal(f.store.state.jobs[0].status, 'reserved');
});

test('known frame requests finish using frozen model and spec dimensions after registry removal and changed sources', async t => {
  const f = await fixture(t), prepared = await ready(f), started = await run(f, prepared); ok(started); const endpoint = f.requests[0].endpoint, s = await shot(f);
  ok(await command(f, 'update', { shotId: s.shotId, document: { ...s.current.document, direction: s.current.document.direction + ' Review the tighter next composition separately.' } })); f.store.state.models = []; f.store.state.operationalControl.generationPaused = true;
  const poll = await call(f.handler, base(f) + '/jobs/' + started.json.job.id + '/poll', {}); ok(poll); assert.equal(poll.json.job.status, 'completed'); assert(f.queries.every(q => q.endpoint === endpoint));
  const image = await imported(f, started.json.job.id); assert.equal(image.candidate.specVersion, s.current.version); assert.equal(image.asset.width, 1536); assert.equal(image.asset.height, 864); assert.equal(f.counters().submits, 1);
  assert.equal((await command(f, 'select', { shotId: s.shotId, candidateId: image.candidate.id, acknowledgeReview: true })).status, 409);
});

test('frame import retries recover a completed request and reject corrupt or wrong-aspect bytes', async t => {
  const f = await fixture(t, { downloadFailures: 1 }), prepared = await ready(f), job = await complete(f, prepared);
  assert.ok((await call(f.handler, base(f) + '/storyboard-production/import', { jobId: job.id })).status >= 400); await imported(f, job.id); assert.equal(f.counters().submits, 1); assert.equal(f.counters().downloads, 2);
  for (const outputBytes of [Buffer.from('broken PNG'),referencePng(1024,1024)]) { const bad = await fixture(t, { outputBytes }), p = await ready(bad), j = await complete(bad,p); assert.ok((await call(bad.handler, base(bad) + '/storyboard-production/import', { jobId: j.id })).status >= 400); assert.equal(bad.store.state.assets.length, 6); assert.equal((await shot(bad)).candidates.length, 0); }
});

test('selection requires the exact shot candidate and visual acknowledgement and cannot accept uploaded frame claims', async t => {
  const f = await fixture(t), prepared = await ready(f), image = await imported(f, (await complete(f, prepared)).id);
  assert.equal((await command(f, 'select', { shotId: f.p.shots[0].id, candidateId: image.candidate.id, acknowledgeReview: false })).status, 400);
  assert.ok([400,404,409].includes((await command(f, 'select', { shotId: f.p.shots[1].id, candidateId: image.candidate.id, acknowledgeReview: true })).status));
  assert.equal((await command(f, 'add_uploaded', { shotId: f.p.shots[0].id, assetId: image.asset.id })).status, 400);
  assert.equal((await call(f.handler, base(f) + '/storyboard-production/import', { jobId: image.candidate.jobId, url: 'https://attacker.example/frame.png' })).status, 400);
  assert.equal((await call(f.handler, base(f) + '/assets/' + image.asset.id + '/content', undefined, 'GET', 'foreign-fixture-session')).status, 404);
});

test('a failed durable frame-spec save leaves no partial archive, candidate or paid request', async t => {
  const f = await fixture(t), before = structuredClone(f.p); await mkdir(f.store.file + '.spending.tmp'); assert.equal((await command(f, 'prepare')).status, 500); assert.deepEqual((await call(f.handler, base(f))).json.project, before); assert.equal(f.counters().submits, 0);
  await rm(f.store.file + '.spending.tmp', { recursive: true }); ok(await command(f, 'prepare'));
});

test('private selected frames and their approvals survive a store restart without becoming movie footage', async t => {
  const f = await fixture(t), prepared = await ready(f), image = await imported(f, (await complete(f, prepared)).id); await select(f, image.candidate); ok(await approveFrame(f));
  const store = await new LocalStore(f.store.file).init(); store.user = f.store.user; const handler = await createHandler({ ...f, store }), r = await call(handler, base(f) + '/storyboard-production'); ok(r);
  const selected = r.json.storyboardProductionContext.shots.find(s => s.shotId === image.candidate.shotId); assert.equal(selected.selectionApproved, true); assert.equal(selected.selection.assetId, image.asset.id); assert.equal(r.json.storyboardProductionContext.generationAuthorized, false); assert(f.p.shots.every(s => !s.clipAssetId)); assert.equal(f.counters().submits, 1);
});

test('a handoff approval changed between preparation and atomic frame persistence holds the entire free write', async t => {
  const f = await fixture(t), before = structuredClone(f.p), save = f.store.saveStoryboardProduction.bind(f.store); let raced = false;
  f.store.saveStoryboardProduction = async (next, version, evidence) => { if (!raced) { raced = true; await f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: 'storyboard_sequence', version: currentStoryboardSequence(f.p).version, decision: 'revoked' }, f.p.ownerId); } return save(next,version,evidence); };
  assert.equal((await command(f,'prepare')).status,409); assert.equal(raced,true); assert.deepEqual((await call(f.handler,base(f))).json.project,before); assert.equal(f.counters().submits,0);
});

test('a private frame object written before a metadata failure is recovered without downloading or generating it again', async t => {
  const f = await fixture(t), prepared = await ready(f), job = await complete(f,prepared), add = f.store.add.bind(f.store); let failed = false;
  f.store.add = async (kind,value) => { if(kind==='assets'&&value.role==='storyboard_frame'&&!failed){failed=true;throw Error('Simulated interruption after durable image upload.');}return add(kind,value); };
  const first = await call(f.handler,base(f)+'/storyboard-production/import',{jobId:job.id}); assert.equal(first.status,500); assert.equal(failed,true); assert.equal(f.store.state.assets.length,6); assert.equal(f.counters().downloads,1);
  f.state.downloadFailures=10; const recovered=await imported(f,job.id); assert.equal(recovered.candidate.jobId,job.id); assert.equal(f.counters().downloads,1); assert.equal(f.counters().submits,1); assert.equal(f.store.state.assets.length,7);
});

test('reference images and storyboard frames share one project cap and outstanding cost exposure', async t => {
  const f = await fixture(t), prepared = await ready(f); await budget(f,100000); f.store.state.models.push(syntheticReferenceModel());
  const quoted = await call(f.handler,base(f)+'/reference-production/quotes',{expectedVersion:f.p.version,requestId:randomUUID(),subjectId:'identity:mira',modelId:'F-reference-local'});ok(quoted);assert.equal(quoted.json.quote.totalMicroUsd,25000);
  const allowed = await call(f.handler,base(f)+'/spending-authorizations',{expectedVersion:f.p.version,requestId:randomUUID(),quoteId:quoted.json.quote.id,maxMicroUsd:25000,finishReserveMicroUsd:0});ok(allowed);
  const reference = await call(f.handler,base(f)+'/reference-production/jobs',{expectedVersion:f.p.version,requestId:randomUUID(),quoteId:quoted.json.quote.id,authorizationId:allowed.json.authorization.id});ok(reference);
  ok(await call(f.handler,base(f)+'/jobs/'+reference.json.job.id+'/poll',{}));
  assert.equal((await summary(f)).projectBudget.committedMicroUsd,25000);assert.equal((await run(f,prepared)).status,409);assert.equal(f.counters().submits,1);assert.equal(f.store.state.jobs.length,1);assert.equal(f.store.state.assets.length,6);
});

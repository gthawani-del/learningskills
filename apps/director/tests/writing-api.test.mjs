import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../server.mjs';
import { LocalStore } from '../store.mjs';
import { syntheticPlanningModel, screenplayDocument, revisedScreenplayDocument, simulatedWritingResult, suppliedScriptText } from './writing-fixture-server.mjs';

async function call(handler, path, body, method = body === undefined ? 'GET' : 'POST') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { url: path, method, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
  let status, data;
  const res = { setHeader() {}, writeHead(s) { status = s; this.headersSent = true; }, end(value) { data = value; } };
  await handler(req, res); return { status, json: JSON.parse(String(data)) };
}
const success = response => assert.ok([200, 201].includes(response.status), JSON.stringify(response));
async function fixture(t, { malformed = false, queued = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'director-writing-api-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'store.json'), store = await new LocalStore(file).init();
  store.state.models = [syntheticPlanningModel()]; store.state.operationalControl.generationPaused = false;
  let submitted = 0, polled = 0; const requests = [];
  const provider = {
    submit: async ({ request }) => { submitted++; requests.push(structuredClone(request)); const id = `resp_writing_test_${submitted}`; return queued ? { id, status: 'queued', usage: null } : simulatedWritingResult(id, request, { malformed }); },
    poll: async ({ request, responseId }) => { polled++; return simulatedWritingResult(responseId, request, { malformed }); },
  };
  const env = { DIRECTOR_DEMO: '1', DIRECTOR_PLANNING_ENABLED: '1', OPENAI_API_KEY: 'synthetic-no-network', OPENAI_STORY_MODEL: 'synthetic-writing-model' };
  const create = store => createHandler({ env, store, planningProvider: provider });
  const handler = await create(store), created = await call(handler, '/api/projects', { title: 'Writing API proof', premise: 'A station attendant must decide whether to keep a promise to a stranger.' }); success(created);
  const f = { store, file, handler, create, p: created.json.project, requests, submitted: () => submitted, polled: () => polled };
  return f;
}
const base = f => `/api/projects/${f.p.id}`;
async function approveBrief(f) {
  const suggestion = await call(f.handler, base(f) + '/brief', { expectedVersion: f.p.version, action: 'suggest' }); success(suggestion); f.p = suggestion.json.project;
  success(await call(f.handler, base(f) + '/approvals', { artifactId: 'brief', version: f.p.creativeBrief.currentVersion, decision: 'approved', acknowledgeAssumptions: true }));
}
async function grant(f) {
  const response = await call(f.handler, base(f) + '/planning-consents', { requestId: randomUUID(), expectedVersion: f.p.version, maxMicroUsd: 5000, finishReserveMicroUsd: 500, maxCalls: 3 }); success(response); return response.json.consent;
}
async function start(f, consent, operation = 'write_script') {
  const body = { requestId: randomUUID(), expectedVersion: f.p.version, consentId: consent.id, operation };
  const response = await call(f.handler, base(f) + '/planning-calls', body); return { response, body };
}
async function write(f) { await approveBrief(f); const consent = await grant(f), { response, body } = await start(f, consent); success(response); return { consent, saved: response.json.call, body }; }
async function apply(f, callId) { const response = await call(f.handler, base(f) + '/screenplay/apply-proposal', { expectedVersion: f.p.version, callId }); if ([200, 201].includes(response.status)) f.p = response.json.project; return response; }

// A missing upload must never prevent original writing from the approved idea.
test('approved idea writes a saved screenplay proposal without uploaded sources or automatic application', async t => {
  const f = await fixture(t), initial = structuredClone(f.p), before = await call(f.handler, base(f) + '/screenplay'); success(before);
  assert.equal(f.submitted(), 0); assert.equal(f.store.state.planningConsents?.length || 0, 0);
  const { saved, body } = await write(f); assert.equal(f.submitted(), 1); assert.deepEqual(saved.result.screenplay, screenplayDocument);
  const input = JSON.parse(f.requests[0].body.input); assert.equal(input.operation, 'write_script'); assert.equal(input.context.approved, true); assert.deepEqual(input.context.screenplay.sources, []);
  const unchanged = (await call(f.handler, base(f))).json.project; assert.equal(unchanged.story.treatment, initial.story.treatment); assert.equal(unchanged.screenplay?.currentVersion || 0, 0);
  assert.equal(f.store.state.jobs.length, 0); assert.equal(saved.actualMicroUsd, 20); assert.equal(saved.chargeState, 'settled');
  const replay = await call(f.handler, base(f) + '/planning-calls', body); success(replay); assert.equal(replay.json.call.id, saved.id); assert.equal(f.submitted(), 1);
  const applied = await apply(f, saved.id); success(applied); assert.equal(f.submitted(), 1); assert.deepEqual(applied.json.screenplayContext.screenplay.document, screenplayDocument); assert.equal(applied.json.screenplayContext.approved, false);
  assert.equal(f.store.state.approvals.some(a => a.artifactId === 'screenplay'), false);
});

test('screenplay writing requires approved current brief and never obtains authorization from client flags', async t => {
  const f = await fixture(t), consent = await grant(f);
  const blocked = await start(f, consent); assert.equal(blocked.response.status, 409); assert.equal(f.submitted(), 0);
  for (const extra of [{ screenplay: screenplayDocument }, { approved: true }, { originality: { status: 'clear' } }, { actorId: 'forged' }, { providerResponseId: 'resp_forged' }]) {
    const response = await call(f.handler, base(f) + '/screenplay/apply-proposal', { expectedVersion: f.p.version, callId: randomUUID(), ...extra }); assert.equal(response.status, 400);
  }
  assert.equal(f.submitted(), 0); assert.equal(f.store.state.approvals.length, 0);
});

test('only the owner can read or apply its saved screenplay and cross-project proposal reuse is rejected', async t => {
  const f = await fixture(t), { saved } = await write(f), foreign = { ...structuredClone(f.p), id: randomUUID(), ownerId: 'another-owner' }; await f.store.create(foreign);
  for (const [suffix, body] of [['screenplay', undefined], ['screenplay', { expectedVersion: foreign.version, action: 'set_revision', revisionRequest: { instruction: 'Change the opening.', sceneIds: ['platform'] } }], ['screenplay/apply-proposal', { expectedVersion: foreign.version, callId: saved.id }]]) {
    assert.equal((await call(f.handler, `/api/projects/${foreign.id}/${suffix}`, body)).status, 404);
  }
  const other = await call(f.handler, '/api/projects', { title: 'Another project', premise: 'A potter repairs a cup.' }); success(other);
  assert.equal((await call(f.handler, `/api/projects/${other.json.project.id}/screenplay/apply-proposal`, { expectedVersion: other.json.project.version, callId: saved.id })).status, 404);
  assert.equal(f.submitted(), 1); assert.equal(f.store.state.projects.find(p => p.id === foreign.id).screenplay, undefined);
});

test('saved screenplay proposal survives process restart but a changed source scope cannot be applied', async t => {
  const f = await fixture(t, { queued: true }); await approveBrief(f); const consent = await grant(f), { response } = await start(f, consent); success(response); assert.equal(response.json.call.status, 'submitted');
  const id = response.json.call.id, restored = await new LocalStore(f.file).init(), handler = await f.create(restored);
  const polled = await call(handler, base(f) + `/planning-calls/${id}/poll`, { requestId: randomUUID() }); success(polled); assert.deepEqual(polled.json.call.result.screenplay, screenplayDocument); assert.equal(f.submitted(), 1); assert.equal(f.polled(), 1);
  const read = await call(handler, base(f) + `/planning-calls/${id}`); success(read); assert.deepEqual(read.json.result.screenplay, screenplayDocument);
  const changed = await call(handler, base(f), { expectedVersion: f.p.version, premise: 'The station has become an abandoned cinema.' }, 'PATCH'); success(changed);
  assert.equal((await call(handler, base(f) + '/screenplay/apply-proposal', { expectedVersion: changed.json.project.version, callId: id })).status, 409);
  assert.equal(restored.state.projects[0].screenplay, undefined); assert.equal(f.submitted(), 1);
});

test('malformed screenplay keeps known response identity and actual usage without script or paid retry', async t => {
  const f = await fixture(t, { malformed: true }), { saved, body } = await write(f); assert.equal(saved.status, 'completed'); assert.equal(saved.chargeState, 'settled'); assert.equal(saved.actualMicroUsd, 20); assert.match(saved.providerResponseId, /^resp_writing_test_/); assert.ok(saved.result.planError); assert.equal(saved.result.screenplay, undefined);
  assert.equal((await apply(f, saved.id)).status, 409); const replay = await call(f.handler, base(f) + '/planning-calls', body); success(replay); assert.equal(f.submitted(), 1); assert.equal(f.store.state.projects[0].screenplay, undefined); assert.equal(f.store.state.jobs.length, 0);
});

test('optional supplied script preserves exact original text and declared provenance without making any model call', async t => {
  const f = await fixture(t); await approveBrief(f);
  const imported = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'add_source', source: { title: 'Supplied kitchen scene', text: suppliedScriptText, permittedUse: 'user_owned' } }); success(imported); f.p = imported.json.project;
  const source = imported.json.screenplayContext.sources[0]; assert.equal(source.text, suppliedScriptText); assert.equal(source.origin, 'user_supplied'); assert.equal(source.permittedUse, 'user_owned'); assert.equal(imported.json.screenplayContext.screenplay, null); assert.equal(f.submitted(), 0);
  const used = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'use_source', sourceId: source.id }); success(used); f.p = used.json.project;
  const context = used.json.screenplayContext; assert.equal(context.screenplay.document.scenes[0].action, suppliedScriptText); assert.equal(context.screenplay.provenance.kind, 'user_supplied'); assert.deepEqual(context.screenplay.provenance.sourceIds, [source.id]); assert.equal(context.screenplay.provenance.modelCallId, null); assert.equal(context.approved, false); assert.equal(f.submitted(), 0);
  const restored = await new LocalStore(f.file).init(), handler = await f.create(restored), read = await call(handler, base(f) + '/screenplay'); success(read); assert.equal(read.json.screenplayContext.sources[0].text, suppliedScriptText); assert.equal(read.json.screenplayContext.screenplay.document.scenes[0].action, suppliedScriptText);
});

test('deterministic source matches require current use declarations and explicit limited-coverage acknowledgement before approval', async t => {
  const f = await fixture(t); await approveBrief(f);
  const source = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'add_source', source: { title: 'Owned kitchen draft', text: suppliedScriptText, permittedUse: 'user_owned' } }); success(source); f.p = source.json.project;
  const used = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'use_source', sourceId: source.json.screenplayContext.sources[0].id }); success(used); f.p = used.json.project;
  const context = used.json.screenplayContext, report = context.originality; assert.equal(report.status, 'review_required'); assert.equal(report.coverage.status, 'project_sources_only'); assert.equal(report.coverage.externalCorpus, false); assert.equal(report.legalClearance, false); assert.ok(report.findings.length > 0);
  const approval = { expectedVersion: f.p.version, artifactId: 'screenplay', version: context.currentVersion, decision: 'approved' };
  assert.equal((await call(f.handler, base(f) + '/approvals', approval)).status, 400);
  assert.equal((await call(f.handler, base(f) + '/approvals', { ...approval, expectedVersion: f.p.version, acknowledgeLimitedCoverage: true })).status, 409);
  assert.equal((await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'record_review', dispositions: [{ findingKey: 'invented', decision: 'authorized_use', note: 'I own this.' }] })).status, 400);
  const reviewed = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'record_review', dispositions: report.findings.map(finding => ({ findingKey: finding.key, decision: 'authorized_use', note: 'This is my supplied original; I permit this passage to be used.' })) }); success(reviewed); f.p = reviewed.json.project;
  success(await call(f.handler, base(f) + '/approvals', { ...approval, expectedVersion: f.p.version, acknowledgeLimitedCoverage: true })); assert.equal((await call(f.handler, base(f) + '/screenplay')).json.screenplayContext.approved, true);
  const versioned = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: { ...context.screenplay.document, title: 'Revised kitchen draft' } }); success(versioned); f.p = versioned.json.project;
  assert.equal(versioned.json.screenplayContext.review, null); assert.equal(versioned.json.screenplayContext.approved, false); assert.equal((await call(f.handler, base(f) + '/approvals', { ...approval, expectedVersion: f.p.version, version: versioned.json.screenplayContext.currentVersion, acknowledgeLimitedCoverage: true })).status, 409); assert.equal(f.submitted(), 0);
});

test('LLM-generated script is checked against supplied references instead of treating generation as originality clearance', async t => {
  const f = await fixture(t); await approveBrief(f);
  const matchingText = screenplayDocument.scenes[0].action;
  const source = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'add_source', source: { title: 'Reference scene', text: matchingText, permittedUse: 'reference_only' } }); success(source); f.p = source.json.project;
  const consent = await grant(f), { response } = await start(f, consent); success(response);
  const input = JSON.parse(f.requests[0].body.input); assert.equal(input.context.screenplay.sources[0].text, matchingText); assert.equal(f.submitted(), 1);
  const applied = await apply(f, response.json.call.id); success(applied); const report = applied.json.screenplayContext.originality;
  assert.equal(applied.json.screenplayContext.screenplay.provenance.kind, 'llm_generated'); assert.equal(report.status, 'review_required'); assert.ok(report.findings.some(finding => finding.sourceExcerpt === matchingText.slice(finding.sourceStart, finding.sourceEnd))); assert.equal(report.legalClearance, false);
  assert.equal((await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: applied.json.screenplayContext.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true })).status, 409); assert.equal(f.submitted(), 1);
});

test('no-corpus script approval requires honest coverage acknowledgement and project patch cannot forge script history or clearance', async t => {
  const f = await fixture(t), { saved } = await write(f); const applied = await apply(f, saved.id); success(applied);
  const context = applied.json.screenplayContext; assert.equal(context.originality.status, 'coverage_unavailable'); assert.equal(context.originality.coverage.externalCorpus, false); assert.equal(context.originality.legalClearance, false);
  const approval = { expectedVersion: f.p.version, artifactId: 'screenplay', version: context.currentVersion, decision: 'approved' }; assert.equal((await call(f.handler, base(f) + '/approvals', approval)).status, 400);
  const originalArchive = structuredClone(f.p.screenplay);
  const forged = await call(f.handler, base(f), { expectedVersion: f.p.version, screenplay: { currentVersion: 99, versions: [], reviews: [{ decision: 'clear' }] }, originality: { status: 'clear' }, approvals: [{ expectedVersion: f.p.version, artifactId: 'screenplay', decision: 'approved' }] }, 'PATCH');
  assert.ok([200, 400].includes(forged.status), JSON.stringify(forged)); if (forged.status === 200) f.p = forged.json.project;
  assert.deepEqual((await call(f.handler, base(f))).json.project.screenplay, originalArchive); assert.equal(f.store.state.approvals.filter(a => a.artifactId === 'screenplay').length, 0);
  success(await call(f.handler, base(f) + '/approvals', { ...approval, expectedVersion: f.p.version, acknowledgeLimitedCoverage: true })); assert.equal((await call(f.handler, base(f) + '/screenplay')).json.screenplayContext.approved, true); assert.equal(f.submitted(), 1);
});

test('saved scene revision scope preserves unrelated screenplay and approved decision history on explicit apply', async t => {
  const f = await fixture(t), { saved } = await write(f); const first = await apply(f, saved.id); success(first);
  const initialArchive = structuredClone(f.p.screenplay), initialContext = first.json.screenplayContext;
  success(await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: initialContext.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true }));
  const revision = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'set_revision', revisionRequest: { instruction: 'Have Rafi help with the noticeboard in the opening scene.', sceneIds: ['platform'] } }); success(revision); f.p = revision.json.project;
  assert.deepEqual(revision.json.screenplayContext.revisionRequest.sceneIds, ['platform']); assert.equal(f.submitted(), 1);
  const consent = await grant(f), { response } = await start(f, consent, 'revise_script'); success(response); assert.deepEqual(response.json.call.result.screenplay, revisedScreenplayDocument); assert.equal(f.submitted(), 2);
  const beforeApply = (await call(f.handler, base(f) + '/screenplay')).json.screenplayContext; assert.equal(beforeApply.currentVersion, 1); assert.equal(beforeApply.approved, true);
  const applied = await apply(f, response.json.call.id); success(applied); const context = applied.json.screenplayContext;
  assert.equal(context.currentVersion, 2); assert.equal(context.approved, false); assert.equal(context.revisionRequest, null); assert.deepEqual(context.screenplay.document.scenes[1], screenplayDocument.scenes[1]); assert.deepEqual(context.screenplay.document.characters, screenplayDocument.characters); assert.deepEqual(f.p.screenplay.versions.slice(0, 1), initialArchive.versions); assert.notEqual(context.screenplay.document.scenes[0].action, screenplayDocument.scenes[0].action);
  assert.equal(f.store.state.approvals.filter(a => a.artifactId === 'screenplay').length, 1); assert.equal(f.store.state.jobs.length, 0);
});

test('screenplay command allowlist rejects prototype names and raw legacy story patches cannot replace the authoritative script', async t => {
  const f = await fixture(t), { saved } = await write(f); success(await apply(f, saved.id));
  for (const action of ['__proto__', 'constructor', 'prototype', 'apply_proposal', 'approve']) {
    const response = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action }); assert.equal(response.status, 400, JSON.stringify(response));
  }
  const before = structuredClone(f.p), patched = await call(f.handler, base(f), { expectedVersion: f.p.version, story: { treatment: 'Forged legacy screenplay replacement', scenes: [{ id: 'platform', description: 'A different story.' }] } }, 'PATCH');
  assert.equal(patched.status, 409, JSON.stringify(patched)); const after = (await call(f.handler, base(f))).json.project;
  assert.deepEqual(after.screenplay, before.screenplay); assert.deepEqual(after.story, before.story); assert.equal(f.submitted(), 1);
});

test('accepted large source collections remain readable and incomplete comparisons block approval without losing the source', async t => {
  for (const text of ['a '.repeat(40000), 'A patient keeper places the blue envelope beside the old station lamp. '.repeat(700)]) {
    const f = await fixture(t), { saved } = await write(f); success(await apply(f, saved.id));
    const added = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'add_source', source: { title: 'Large bounded source', text, permittedUse: 'reference_only' } }); success(added); f.p = added.json.project;
    const read = await call(f.handler, base(f) + '/screenplay'); success(read); assert.equal(read.json.screenplayContext.sources[0].text, text); assert.ok(read.json.screenplayContext.originality);
    // Saving the existing script explicitly rebinds it to the new source collection.
    const savedAgain = await call(f.handler, base(f) + '/screenplay', { expectedVersion: f.p.version, action: 'save', document: screenplayDocument }); success(savedAgain); f.p = savedAgain.json.project;
    const report = savedAgain.json.screenplayContext.originality;
    assert.equal(report.truncated, true); assert.equal(report.status, 'review_required');
    assert.equal(report.coverage.completeWithinPolicy, false);
    assert.equal((await call(f.handler, base(f) + '/approvals', { expectedVersion: f.p.version, artifactId: 'screenplay', version: savedAgain.json.screenplayContext.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true })).status, 409);
    const reopened = await call(f.handler, base(f) + '/screenplay'); success(reopened); assert.equal(reopened.json.screenplayContext.sources[0].text, text); assert.equal(f.submitted(), 1);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { artifacts, hash, patchProject } from '../domain.mjs';
import { LocalStore } from '../store.mjs';
import { createImportController } from '../imports.mjs';
import { applyReferenceProductionCommand, referenceProductionContext } from '../public/reference-production-core.js';
import { storyboardFixture } from './storyboard-fixture-server.mjs';
import { referencePng } from './reference-fixture-server.mjs';

async function facts(f) { return { assets: await f.store.records('assets', f.p.id), candidates: await f.store.referenceCandidates(f.p.ownerId, f.p.id) }; }
async function context(f) { return referenceProductionContext(f.p, await f.store.records('approvals', f.p.id), await facts(f)); }
async function change(f, action, fields = {}) {
  const approvals = await f.store.records('approvals', f.p.id), next = applyReferenceProductionCommand(f.p, { expectedVersion: f.p.version, action, ...fields }, approvals, await facts(f));
  if (next.version !== f.p.version) f.p = await f.store.saveReferenceProduction(next, f.p.version, { expectedApprovalId: approvals.at(-1)?.id ?? null });
  return context(f);
}
async function fixture() { const f = await storyboardFixture(); f.p = f.project; await change(f, 'prepare'); return f; }
async function current(f, id) { return (await context(f)).subjects.find(s => s.id === id); }
async function approve(f, id, selection = false) {
  const c = await current(f, id);
  return f.store.approve(f.p, { expectedVersion: f.p.version, artifactId: (selection ? 'reference_selection:' : 'reference_brief:') + id, version: selection ? c.selection.version : c.current.version, decision: 'approved', acknowledgeReferenceReview: true }, f.p.ownerId);
}
async function uploaded(f, subjectId) {
  const c = await current(f, subjectId), bytes = referencePng(), asset = { id: randomUUID(), projectId: f.p.id, name: 'Owned uploaded fixture metadata.png', mime: 'image/png', role: subjectId.startsWith('location:') ? 'location' : 'character_identity', scope: 'project', shotId: null, version: 1, storageKey: f.p.ownerId + '/' + f.p.id + '/' + randomUUID(), size: bytes.length, checksum: hash(bytes.toString('base64')) };
  await f.store.add('assets', asset);
  return f.store.registerReferenceCandidate({ actorId: f.p.ownerId, projectId: f.p.id, candidate: { id: randomUUID(), projectId: f.p.id, subjectId, subjectVersion: c.current.version, assetId: asset.id, assetVersion: 1, origin: 'uploaded', jobId: null, createdAt: new Date().toISOString() } });
}

test('reference snapshots and creative selections remain distinct from shot media, voice casting and production records', async () => {
  const f = await fixture(), before = structuredClone({ shots: f.p.shots, production: f.p.production });
  await approve(f, 'identity:mira'); const candidate = await uploaded(f, 'identity:mira');
  await change(f, 'select', { subjectId: 'identity:mira', candidateId: candidate.id, acknowledgeReview: true });
  assert.equal((await current(f, 'identity:mira')).selectionApproved, false); await approve(f, 'identity:mira', true);
  assert.equal((await current(f, 'identity:mira')).selectionApproved, true); assert.deepEqual(f.p.shots, before.shots); assert.deepEqual(f.p.production, before.production);
  const snapshots = artifacts(f.p); assert.equal(snapshots.filter(a => a.kind === 'reference_brief').length, 6); assert.equal(snapshots.filter(a => a.kind === 'reference_selection').length, 1);
  assert.equal((await context(f)).generationAuthorized, false); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.p.storyboardHandoff, undefined);
});

test('changing one reference direction retains old selection history and preserves unrelated approved references', async () => {
  const f = await fixture();
  for (const id of ['identity:mira','location:platform']) { await approve(f, id); const c = await uploaded(f, id); await change(f, 'select', { subjectId: id, candidateId: c.id, acknowledgeReview: true }); await approve(f, id, true); }
  const before = structuredClone(f.p.referenceProduction), location = await current(f, 'location:platform'), identity = await current(f, 'identity:mira');
  await change(f, 'update', { subjectId: identity.id, document: { ...identity.current.document, direction: identity.current.document.direction + ' Keep the gaze attentive during the identity review.' } });
  const revised = await current(f, identity.id); assert.equal(revised.current.version, identity.current.version + 1); assert.equal(revised.directionApproved, false); assert.equal(revised.selectionApproved, false);
  assert.deepEqual(f.p.referenceProduction.selections, before.selections); assert.deepEqual(f.p.referenceProduction.subjects.find(s => s.id === identity.id).versions[0], before.subjects.find(s => s.id === identity.id).versions[0]);
  const untouched = await current(f, location.id); assert.deepEqual(untouched.current, location.current); assert.deepEqual(untouched.selection, location.selection); assert.equal(untouched.selectionApproved, true);
});

test('look snapshots pin an approved identity selection and are held when that identity changes', async () => {
  const f = await fixture(); await approve(f, 'identity:mira'); const first = await uploaded(f, 'identity:mira'); await change(f, 'select', { subjectId: 'identity:mira', candidateId: first.id, acknowledgeReview: true }); await approve(f, 'identity:mira', true);
  await change(f, 'refresh', { subjectId: 'look:mira', acknowledgeSourceChange: true }); const look = await current(f, 'look:mira');
  assert.equal(look.current.identityBinding.assetId, first.assetId); assert.equal(look.identityStale, false); await approve(f, 'look:mira');
  const second = await uploaded(f, 'identity:mira'); await change(f, 'select', { subjectId: 'identity:mira', candidateId: second.id, acknowledgeReview: true }); await approve(f, 'identity:mira', true);
  const held = await current(f, 'look:mira'); assert.equal(held.identityStale, true); assert.equal(held.directionApproved, false); assert.deepEqual(held.current, look.current); assert.equal(held.current.identityBinding.assetId, first.assetId);
  await change(f, 'refresh', { subjectId: 'look:mira', acknowledgeSourceChange: true }); const rebound = await current(f, 'look:mira'); assert.equal(rebound.current.identityBinding.assetId, second.assetId); assert.equal(rebound.current.version, look.current.version + 1); assert.equal(rebound.directionApproved, false);
});

test('generic project patches cannot mutate reference histories or create selected image authority', async () => {
  const f = await fixture(), before = structuredClone(f.p.referenceProduction);
  assert.throws(() => patchProject(f.p, { expectedVersion: f.p.version, referenceProduction: { ...before, selections: [{ approved: true }] } }), { status: 400 });
  assert.deepEqual(f.p.referenceProduction, before); assert.equal((await context(f)).subjects.every(s => !s.selectionApproved), true);
});

test('device import retains reference direction histories while dropping imported approvals, candidates and spending permissions', async () => {
  const f = await fixture(); await approve(f, 'identity:mira');
  const source = { ...structuredClone(f.p), id: 'device-' + f.p.id, approvals: await f.store.records('approvals', f.p.id), referenceCandidates: [{ id: randomUUID(), origin: 'generated', jobId: randomUUID(), approved: true }], projectBudgetMicroUsd: 999999999, spendingAuthorizations: [{ approved: true }] };
  const store = await new LocalStore().init(), importer = createImportController({ store, storage: {} }), body = { sourceId: source.id, project: source, assets: [] };
  const pending = await importer.start('cloud-owner', body), copied = await importer.complete('cloud-owner', pending.id);
  assert.deepEqual(copied.referenceProduction, f.p.referenceProduction); assert.equal(copied.approvals, undefined); assert.equal(copied.referenceCandidates, undefined); assert.equal(copied.projectBudgetMicroUsd, undefined); assert.equal(copied.spendingAuthorizations, undefined);
  assert.deepEqual(await store.records('approvals', copied.id), []); assert.deepEqual(await store.referenceCandidates('cloud-owner', copied.id), []);
  const c = referenceProductionContext(copied, [], { assets: [], candidates: [] }); assert(c.subjects.every(s => !s.directionApproved && !s.selectionApproved));
  const forged = structuredClone(body); forged.project.referenceProduction.approved = true; await assert.rejects(importer.start('cloud-owner', forged), { status: 400 });
});

test('imported selected-image history remains historical until the receiving account establishes its own candidate and reviews', async () => {
  const f = await fixture(); await approve(f, 'identity:mira'); const candidate = await uploaded(f, 'identity:mira'); await change(f, 'select', { subjectId: 'identity:mira', candidateId: candidate.id, acknowledgeReview: true }); await approve(f, 'identity:mira', true);
  const source = { ...structuredClone(f.p), id: 'device-' + f.p.id, approvals: await f.store.records('approvals', f.p.id) }, sourceAsset = (await f.store.records('assets', f.p.id))[0];
  const store = await new LocalStore().init(), writes = [], importer = createImportController({ store, storage: { async putIfAbsent(...args) { writes.push(args); } } });
  const pending = await importer.start('receiving-owner', { sourceId: source.id, project: source, assets: [sourceAsset] });
  await importer.upload('receiving-owner', pending.id, sourceAsset.id, { bytes: referencePng(), mime: 'image/png' });
  const copied = await importer.complete('receiving-owner', pending.id), candidates = await store.referenceCandidates('receiving-owner', copied.id), assets = await store.records('assets', copied.id), c = referenceProductionContext(copied, [], { assets, candidates });
  assert.equal(writes.length, 1); assert.equal(assets.length, 1); assert.equal(assets[0].projectId, copied.id); assert.notEqual(assets[0].id, sourceAsset.id); assert.equal(assets[0].generated, undefined);
  assert.deepEqual(copied.referenceProduction.subjects, f.p.referenceProduction.subjects); assert.equal(copied.referenceProduction.selections.length, 1); assert.equal(copied.referenceProduction.selections[0].review.criteriaAcknowledged, true);
  assert.deepEqual(candidates, []); assert.deepEqual(await store.records('approvals', copied.id), []); assert.equal(c.subjects.find(s => s.id === 'identity:mira').selectionApproved, false); assert.equal(store.state.jobs.length, 0);
});

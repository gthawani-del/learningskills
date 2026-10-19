import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { patchProject, artifacts } from '../domain.mjs';
import { LocalStore } from '../store.mjs';
import { createImportController } from '../imports.mjs';
import { applyStoryboardHandoffCommand, storyboardHandoffContext } from '../public/storyboard-handoff-core.js';
import { storyboardFixture } from './storyboard-fixture-server.mjs';

test('managed storyboard contracts project into editing shots while preserving uploaded image and clip selections', async () => {
  const f = await storyboardFixture({ prepared: true }), p = f.project, selected = p.shots[0], referenceAssetId = randomUUID(), clipAssetId = randomUUID();
  const media = patchProject(p, { expectedVersion: p.version, shots: p.shots.map(s => s.id === selected.id ? { ...s, referenceAssetId, clipAssetId } : s) });
  assert.equal(media.shots.find(s => s.id === selected.id).referenceAssetId, referenceAssetId); assert.equal(media.shots.find(s => s.id === selected.id).clipAssetId, clipAssetId);
  assert.deepEqual(media.storyboardHandoff, p.storyboardHandoff);
  for (const change of [{ description: 'Bypass the source-bound contract.' }, { sceneId: 'foreign-scene' }, { title: 'A bypassed title' }]) assert.throws(() => patchProject(media, { shots: media.shots.map(s => s.id === selected.id ? { ...s, ...change } : s) }), { status: 409 });
  const approvals = await f.store.records('approvals', p.id), c = storyboardHandoffContext(media, approvals), contract = c.shots.find(s => s.id === selected.id);
  const next = applyStoryboardHandoffCommand(media, { expectedVersion: media.version, action: 'update', shotId: selected.id, document: { ...contract.current.document, title: 'An explicitly reviewed new contract title' } }, approvals);
  const projected = next.shots.find(s => s.id === selected.id); assert.equal(projected.referenceAssetId, referenceAssetId); assert.equal(projected.clipAssetId, clipAssetId); assert.equal(projected.title, 'An explicitly reviewed new contract title');
  assert.equal(next.storyboardHandoff.shots.find(s => s.id === selected.id).versions.length, 2); assert.deepEqual(next.storyboardHandoff.shots.find(s => s.id === selected.id).versions[0], p.storyboardHandoff.shots.find(s => s.id === selected.id).versions[0]);
});

test('contract snapshots and sequence approvals are separate from generated frames, voice takes and reference rights', async () => {
  const f = await storyboardFixture({ approveHandoff: true }), c = storyboardHandoffContext(f.project, await f.store.records('approvals', f.project.id));
  assert(c.shots.every(s => s.approved)); assert.equal(c.sequence.approved, true);
  assert.equal(c.actualStoryboardCreated, false); assert.equal(c.playableAnimaticCreated, false); assert.equal(c.generationAuthorized, false);
  const snapshots = artifacts(f.project); assert.equal(snapshots.filter(a => a.kind === 'shot_contract').length, c.shots.length); assert.equal(snapshots.filter(a => a.logical_key === 'storyboard_sequence').length, 1);
  assert.equal(f.store.state.assets.length, 0); assert.equal(f.store.state.jobs.length, 0); assert.equal(f.store.state.planningConsents?.length || 0, 0);
  assert(f.project.shots.every(s => !s.referenceAssetId && !s.clipAssetId)); assert.equal(f.counters().submits, 0);
});

test('device import preserves storyboard histories and order while stripping all imported review and spending authority', async () => {
  const f = await storyboardFixture({ approveHandoff: true }), source = { ...structuredClone(f.project), id: 'device-' + f.project.id, approvals: await f.store.records('approvals', f.project.id) };
  const store = await new LocalStore().init(), importer = createImportController({ store, storage: {} }), body = { sourceId: source.id, project: source, assets: [] };
  const pending = await importer.start('cloud-owner', body), copied = await importer.complete('cloud-owner', pending.id);
  assert.deepEqual(copied.storyboardHandoff, f.project.storyboardHandoff); assert.equal(copied.approvals, undefined); assert.deepEqual(await store.records('approvals', copied.id), []);
  const c = storyboardHandoffContext(copied, []); assert.equal(c.sequence.approved, false); assert(c.shots.every(s => !s.approved)); assert.equal(store.state.planningConsents?.length || 0, 0);
  const forged = structuredClone(body); forged.project.storyboardHandoff.approved = true;
  await assert.rejects(importer.start('cloud-owner', forged), { status: 400 }); assert.equal(store.state.projects.length, 1);
});

test('unmapped legacy shots cannot be silently erased during source-linked storyboard preparation', async () => {
  const f = await storyboardFixture(), legacy = patchProject(f.project, { shots: [{ id: 'legacy-unmapped', sceneId: 'removed-scene', title: 'Accepted old coverage', description: 'Retain this uploaded shot until its source mapping is reviewed.', duration: 5, referenceAssetId: randomUUID(), clipAssetId: randomUUID() }] });
  const before = structuredClone(legacy), approvals = await f.store.records('approvals', legacy.id);
  assert.throws(() => applyStoryboardHandoffCommand(legacy, { expectedVersion: legacy.version, action: 'prepare' }, approvals), { status: 409 });
  assert.deepEqual(legacy, before); assert.equal(legacy.storyboardHandoff, undefined); assert.equal(f.counters().submits, 0);
});

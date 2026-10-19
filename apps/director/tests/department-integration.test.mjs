import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyDepartmentCommand, departmentPlanningContext, currentDepartmentPlan, departmentPlanArtifacts } from '../public/department-plan-core.js';
import { applyScreenplayProjectCommand } from '../public/screenplay-project.js';
import { currentScreenplay } from '../public/screenplay-core.js';
import { patchProject, artifacts } from '../domain.mjs';
import { LocalStore } from '../store.mjs';
import { productionState } from '../production-state.mjs';
import { createImportController } from '../imports.mjs';
import { departmentFixture } from './department-fixture-server.mjs';

const cmd = (p, action, fields = {}, approvals = []) => applyDepartmentCommand(p, { expectedVersion: p.version, action, ...fields }, approvals);
async function prepared(options) {
  const f = await departmentFixture(options), approvals = await f.store.records('approvals', f.project.id);
  const project = cmd(f.project, 'prepare', {}, approvals); await f.store.save(project, f.project.version);
  return { ...f, project, approvals };
}

test('department plans snapshot as independent immutable artifacts and never overwrite cast-library records or media', async () => {
  const f = await prepared(), p = f.project, before = structuredClone(p.departmentPlanning);
  const next = cmd(p, 'update', { departmentId: 'voice', document: { ...currentDepartmentPlan(p, 'voice').document, summary: 'Quiet, conversational delivery; review actual voice samples before choosing.' } }, f.approvals);
  assert.deepEqual(p.departmentPlanning, before); assert.equal(next.departmentPlanning.departments.find(d => d.id === 'voice').versions.length, 2);
  for (const unit of p.departmentPlanning.departments) assert.deepEqual(next.departmentPlanning.departments.find(d => d.id === unit.id).versions[0], unit.versions[0]);
  assert.deepEqual(next.production, p.production); assert.deepEqual(next.shots, p.shots); assert.deepEqual(next.screenplay, p.screenplay);
  const snapshots = departmentPlanArtifacts(next); assert.equal(snapshots.length, 17); assert(snapshots.every(a => a.kind === 'department_plan' && a.logical_key.startsWith('department:')));
  assert.equal(artifacts(next).filter(a => a.kind === 'department_plan').length, 17);
});

test('department planning approval cannot release dependent production after screenplay or department review becomes stale', async () => {
  const f = await prepared();
  const p = patchProject(f.project, { expectedVersion: f.project.version, shots: [{ id: 'platform-shot', sceneId: 'platform', title: 'Ticket handoff', description: 'Observe the ticket passed in one continuous gesture.', duration: 5 }] });
  const approvals = [...f.approvals, { artifactId: 'story', version: p.story.version, decision: 'approved' }, ...p.shots.map(s => ({ artifactId: s.id, version: s.version, decision: 'approved' })), ...departmentPlanArtifacts(p).map(a => ({ artifactId: a.logical_key, version: a.version, decision: 'approved' }))];
  assert(departmentPlanningContext(p, approvals).departments.every(d => d.approved));
  const before = productionState(p, [], approvals), shot = before.nodes.find(n => n.id === 'platform-shot'); assert.equal(shot.readyForRouteReview, true);
  const revoked = productionState(p, [], [...approvals, { artifactId: 'department:camera', version: 1, decision: 'revoked' }]); assert.equal(revoked.nodes.find(n => n.id === 'platform-shot').readyForRouteReview, false);
  const document = { ...currentScreenplay(p).document, treatment: 'The same ticket becomes a test of a promise after the station closes.' };
  const changed = applyScreenplayProjectCommand(p, { expectedVersion: p.version, action: 'save', document });
  const graph = productionState(changed, [], approvals); assert.equal(graph.nodes.find(n => n.id === 'platform-shot').readyForRouteReview, false); assert(departmentPlanningContext(changed, approvals).departments.every(d => d.stale && !d.approved));
  assert.deepEqual(changed.departmentPlanning, p.departmentPlanning);
});

test('failed durable department saves and approvals expose no in-memory success and exact retries append once', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'director-department-durable-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'store.json'), f = await prepared({ file }), p = f.project;
  const next = cmd(p, 'update', { departmentId: 'camera', document: { ...currentDepartmentPlan(p, 'camera').document, summary: 'A motivated eye-level viewpoint with gentle settling at the end of the action.' } }, f.approvals);
  const evidence = { expectedApprovalId: f.approvals.at(-1)?.id ?? null };
  await mkdir(file + '.spending.tmp'); await assert.rejects(f.store.saveDepartmentPlans(next, p.version, evidence)); assert.deepEqual(await f.store.get(p.id, p.ownerId), p);
  const body = { expectedVersion: p.version, artifactId: 'department:camera', version: 1, decision: 'approved', ackPlanningOnly: true };
  await assert.rejects(f.store.approve(p, body, p.ownerId)); assert.deepEqual(await f.store.records('approvals', p.id), f.approvals);
  const restored = await new LocalStore(file).init(); assert.deepEqual(await restored.get(p.id, p.ownerId), p);
  await rm(file + '.spending.tmp', { recursive: true }); await f.store.saveDepartmentPlans(next, p.version, evidence); assert.equal(currentDepartmentPlan(await f.store.get(p.id, p.ownerId), 'camera').version, 2);
  await assert.rejects(f.store.saveDepartmentPlans(next, p.version, evidence), { status: 409 }); assert.equal(currentDepartmentPlan(await f.store.get(p.id, p.ownerId), 'camera').version, 2);
});

test('device-to-cloud department migration preserves planning history while stripping all imported approval authority', async () => {
  const f = await prepared(), p = f.project;
  const source = { ...structuredClone(p), id: 'device-' + p.id, approvals: departmentPlanArtifacts(p).map(a => ({ artifactId: a.logical_key, version: a.version, decision: 'approved' })) };
  const store = await new LocalStore().init(), importer = createImportController({ store, storage: {} });
  const pending = await importer.start('cloud-owner', { sourceId: source.id, project: source, assets: [] });
  const copied = await importer.complete('cloud-owner', pending.id);
  assert.deepEqual(copied.departmentPlanning, p.departmentPlanning); assert.equal(copied.approvals, undefined); assert.deepEqual(await store.records('approvals', copied.id), []);
  const context = departmentPlanningContext(copied); assert(context.departments.every(d => d.current && !d.approved)); assert.equal(context.assetsApproved, false); assert.equal(context.generationAuthorized, false);
  const altered = structuredClone(source); altered.departmentPlanning.departments[0].approved = true;
  await assert.rejects(importer.start('cloud-owner', { sourceId: altered.id, project: altered, assets: [] }), { status: 400 });
  assert.equal(store.state.projects.length, 1);
});

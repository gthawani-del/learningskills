import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routingTasks, candidateEndpointManifest, knownRoutingTask, taskCandidates } from '../routing-task-catalog.mjs';
import { selectRoutes } from '../model-router.mjs';
const seed = readFileSync(new URL('../../../database/director-registry-seed.sql', import.meta.url), 'utf8');
const roles = readFileSync(new URL('../../../database/director-registry-roles.sql', import.meta.url), 'utf8');

test('all catalog IDs and exact endpoints match the twenty seeded identities', () => {
  const identities = Object.fromEntries([...seed.matchAll(/values\('(M\d\d)','fal','([^']+)'/g)].map(match => [match[1], match[2]]));
  assert.equal(Object.keys(identities).length, 20);
  assert.deepEqual(candidateEndpointManifest, identities);
  assert.equal(new Set(routingTasks.map(entry => entry.id)).size, routingTasks.length);
  assert.equal(new Set(routingTasks.flatMap(entry => entry.candidateModelIds)).size, 20);
  for (const entry of routingTasks) {
    assert.ok(entry.label && entry.source.includes('FUNCTIONALITY_ENDPOINT_MATRIX.csv'));
    assert.equal(new Set(entry.candidateModelIds).size, entry.candidateModelIds.length);
    for (const id of entry.candidateModelIds) {
      assert.ok(identities[id]);
      assert.ok(roles.includes(`where id='${id}'`));
    }
  }
});

test('discovery retains the exact server record without inventing tasks or evidence', () => {
  const candidate = { id: 'M09', provider: 'fal', endpoint: candidateEndpointManifest.M09, capabilities: { purpose: 'Reference image editing' }, active: false };
  const before = structuredClone(candidate);
  const result = taskCandidates('image_edit', [candidate]);
  assert.equal(result[0], candidate);
  assert.deepEqual(candidate, before);
  assert.equal(result[0].capabilities.tasks, undefined);
  const decision = selectRoutes({ task: 'image_edit', models: result });
  assert.deepEqual(decision.eligibleForQuote, []);
  assert.ok(decision.candidates[0].holds.includes('task_not_declared'));
  assert.ok(decision.candidates[0].holds.includes('active_required'));
});

test('explicit server tasks and verification state survive discovery unchanged', () => {
  const candidate = { id: 'M17', provider: 'fal', endpoint: candidateEndpointManifest.M17, capabilities: { tasks: ['some_other_task'] }, execution_tested: false, quality_validated: false };
  const before = structuredClone(candidate);
  assert.equal(taskCandidates('reference_video', [candidate])[0], candidate);
  assert.deepEqual(candidate, before);
  assert.deepEqual(candidate.capabilities.tasks, ['some_other_task']);
  assert.equal(candidate.active, undefined);
});

test('discovery cannot substitute endpoint guesses, provider changes or unrelated models', () => {
  const make = (id, endpoint = candidateEndpointManifest[id], provider = 'fal') => ({ id, endpoint, provider });
  assert.deepEqual(taskCandidates('image_edit', [make('M18'), make('M09', 'other/edit'), make('M09', candidateEndpointManifest.M09, 'other'), make('unknown', candidateEndpointManifest.M09)]), []);
  const audio = make('M02'), song = make('M05');
  assert.deepEqual(taskCandidates('song_analysis', [audio, song]), [song, audio]);
});

test('unknown tasks fail closed and immutable catalog cannot become a capability switch', () => {
  for (const id of [null, undefined, '', 'constructor', '__proto__', 'unknown', {}, 'export']) {
    assert.equal(knownRoutingTask(id), null);
    assert.deepEqual(taskCandidates(id, []), []);
  }
  assert.deepEqual(taskCandidates('image_edit', null), []);
  assert.throws(() => routingTasks[0].candidateModelIds.push('M20'), TypeError);
  assert.throws(() => { routingTasks[0].id = 'export'; }, TypeError);
});

const dynamicNow = '2026-10-18T12:00:00Z';
function dynamicModel(id = 'WAN_REVIEWED') {
  const endpoint = 'reviewed-provider/' + id;
  return { id, provider: 'fal', endpoint, model_version: 'model-v1', active: false,
    capabilities: { taskBindings: [{ task: 'reference_video', modelId: id, provider: 'fal', endpoint, modelVersion: 'model-v1', version: 'binding-v1', reviewed: true, sourceUrl: 'https://studio.example/reviews/1', expiresAt: '2026-10-19T00:00:00Z' }] },
    schema_evidence: { verified: true, version: 'schema-v1', sourceUrl: 'https://fal.ai/schema', expiresAt: '2026-10-19T00:00:00Z', endpoint, modelVersion: 'model-v1', inputSchemaHash: 'a'.repeat(64) } };
}
test('reviewed dynamic bindings extend historical candidates without activating a model', () => {
  const model = dynamicModel(); const before = structuredClone(model);
  const result = taskCandidates('reference_video', [model], { now: dynamicNow });
  assert.equal(result[0], model); assert.deepEqual(model, before);
  assert.equal(result[0].active, false); assert.equal(result[0].capabilities.tasks, undefined);
  const selection = selectRoutes({ task: 'reference_video', models: result, now: dynamicNow });
  assert.deepEqual(selection.eligibleForQuote, []); assert.ok(selection.candidates[0].holds.includes('task_not_declared'));
});
test('unreviewed mismatched stale and duplicate dynamic task bindings are excluded', () => {
  for (const mutate of [m => { m.capabilities.taskBindings[0].reviewed = false; }, m => { m.capabilities.taskBindings[0].modelId = 'other'; }, m => { m.capabilities.taskBindings[0].endpoint = 'other/endpoint'; }, m => { m.capabilities.taskBindings[0].provider = 'other'; }, m => { m.capabilities.taskBindings[0].modelVersion = 'different'; }, m => { m.capabilities.taskBindings[0].expiresAt = dynamicNow; }, m => { m.capabilities.taskBindings[0].sourceUrl = 'http://insecure.example'; }, m => { m.capabilities.taskBindings.push(structuredClone(m.capabilities.taskBindings[0])); }, m => { m.schema_evidence.verified = false; }, m => { m.schema_evidence.expiresAt = dynamicNow; }, m => { m.schema_evidence.endpoint = 'other'; }, m => { m.schema_evidence.modelVersion = 'different'; }, m => { m.schema_evidence.inputSchemaHash = 'invalid'; }]) {
    const model = dynamicModel(); mutate(model);
    assert.deepEqual(taskCandidates('reference_video', [model], { now: dynamicNow }), []);
  }
  const duplicate = dynamicModel();
  assert.deepEqual(taskCandidates('reference_video', [duplicate, structuredClone(duplicate)], { now: dynamicNow }), []);
});
test('dynamic discovery never infers task from names or repoints historical identities', () => {
  const missing = dynamicModel('WAN_REFERENCE_VIDEO'); delete missing.capabilities.taskBindings;
  assert.deepEqual(taskCandidates('reference_video', [missing], { now: dynamicNow }), []);
  const repointed = dynamicModel('M17');
  assert.deepEqual(taskCandidates('reference_video', [repointed], { now: dynamicNow }), []);
  assert.deepEqual(taskCandidates('unknown_future_task', [dynamicModel()], { now: dynamicNow }), []);
});
test('historical order remains first and dynamic additions have deterministic ID order', () => {
  const historical = { id: 'M17', provider: 'fal', endpoint: candidateEndpointManifest.M17 };
  const a = dynamicModel('A'); const z = dynamicModel('Z');
  const options = { now: dynamicNow };
  assert.deepEqual(taskCandidates('reference_video', [z, historical, a], options).map(m => m.id), ['M17', 'A', 'Z']);
});

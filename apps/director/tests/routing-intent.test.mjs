import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRoutes } from '../model-router.mjs';
import { validateRoutingIntent } from '../routing-intent.mjs';
const now = '2026-10-18T12:00:00Z';
const expiry = '2026-10-19T12:00:00Z';
function candidate(id, scores = { realism: 80, motion: 80 }, priority = 1) {
  const endpoint = 'minimax/h3-max/reference-to-video';
  return { id, provider: 'fal', endpoint, model_version: 'v1', price_version: 'p1', active: true, execution_tested: true, quality_validated: true,
    capabilities: { tasks: ['reference_video'], priority },
    schema_evidence: { verified: true, version: 's1', sourceUrl: 'https://fal.ai/schema', inputSchemaHash: 'a'.repeat(64), endpoint, modelVersion: 'v1', expiresAt: expiry },
    price_evidence: { verified: true, configurationVerified: true, configuration: {}, version: 'p1', currency: 'USD', unit: 'second', unitMicroUsd: 50000, rounding: 'ceil', sourceUrl: 'https://fal.ai/pricing', expiresAt: expiry },
    routing_profiles: [{ verified: true, task: 'reference_video', modelId: id, modelVersion: 'v1', endpoint, evidenceVersion: 'eval-1', sourceUrl: 'https://studio.example/evaluations/1', evaluatedAt: '2026-10-17T12:00:00Z', expiresAt: expiry, sampleCount: 20, purposes: ['narrative film'], styles: ['photographic'], stages: ['final'], audiences: ['general'], platforms: ['cinema'], emotionalEffects: ['unease'], creativeControls: ['directed'], scores, latencyMs: 10000 }],
  };
}
function route(models, intent) { return selectRoutes({ task: 'reference_video', models, now, ...(intent === undefined ? {} : { intent }) }); }
test('user weighted job quality outranks priority and price without demographic inference', () => {
  const photographic = candidate('photographic', { realism: 95, motion: 60 }, 1);
  const kinetic = candidate('kinetic', { realism: 65, motion: 95 }, 100);
  kinetic.price_evidence.unitMicroUsd = 1;
  const intent = { purpose: 'narrative film', style: 'photographic', stage: 'final', qualityGoals: [{ goal: 'realism', weight: 10 }, { goal: 'motion', weight: 1 }] };
  const result = route([kinetic, photographic], intent);
  assert.equal(result.candidates[0].modelId, 'photographic');
  assert.equal(result.candidates[0].intentFit.score, 91.818);
  assert.ok(result.candidates[0].intentFit.explanation.some(text => text.includes('user weight 10')));
  assert.ok(result.candidates[0].intentFit.tradeoffs.some(text => text.includes('motion')));
  const motion = route([kinetic, photographic], { ...intent, qualityGoals: [{ goal: 'motion', weight: 10 }] });
  assert.equal(motion.candidates[0].modelId, 'kinetic');
});
test('explicit job dimensions and minimum quality are hard evidence gates', () => {
  for (const intent of [{ purpose: 'documentary' }, { style: 'stop motion' }, { platform: 'vertical social' }, { qualityGoals: [{ goal: 'singingFidelity', weight: 1 }] }, { qualityGoals: [{ goal: 'realism', weight: 1, minimumScore: 90 }] }]) {
    const result = route([candidate('a')], intent);
    assert.deepEqual(result.eligibleForQuote, []); assert.ok(result.candidates[0].holds.some(h => h.startsWith('intent_')));
  }
});
test('missing expired unverified and incorrectly bound evaluations never imply job fit', () => {
  for (const mutate of [m => { delete m.routing_profiles; }, m => { m.routing_profiles[0].expiresAt = now; }, m => { m.routing_profiles[0].verified = false; }, m => { m.routing_profiles[0].modelVersion = 'v2'; }, m => { m.routing_profiles[0].task = 'image_edit'; }, m => { m.routing_profiles[0].endpoint = 'other'; }, m => { m.routing_profiles[0].evaluatedAt = expiry; }, m => { m.routing_profiles[0].sampleCount = 0; }]) {
    const model = candidate('a'); mutate(model);
    assert.deepEqual(route([model], { purpose: 'narrative film' }).eligibleForQuote, []);
  }
});
test('budget and deadline remain constraints rather than cheapest-route promotion', () => {
  assert.ok(route([candidate('a')], { budgetMicroUsd: 1000000 }).candidates[0].holds.includes('intent_workflow_budget_unverified'));
  assert.ok(route([candidate('a')], { deadlineMs: 5000 }).candidates[0].holds.includes('intent_deadline_exceeded'));
  assert.deepEqual(route([candidate('a')], { deadlineMs: 15000 }).eligibleForQuote, ['a']);
  const noTiming = candidate('a'); delete noTiming.routing_profiles[0].latencyMs;
  assert.ok(route([noTiming], { deadlineMs: 15000 }).candidates[0].holds.includes('intent_latency_unmeasured'));
});
test('intent input rejects demographics unknown fields and malformed preferences', () => {
  for (const intent of [{ age: 18 }, { tier: 'cheap' }, { style: '' }, { qualityGoals: [{ goal: 'realism', weight: 0 }] }, { qualityGoals: [{ goal: 'realism', weight: 1, minimumScore: 101 }] }, { deadlineMs: NaN }, { budgetMicroUsd: -1 }, { qualityGoals: [{ goal: 'realism', weight: 1 }, { goal: 'realism', weight: 2 }] }]) assert.throws(() => validateRoutingIntent(intent), error => error.status === 400);
});
test('without intent legacy eligibility priority and output remain unchanged', () => {
  const a = candidate('a', {}, 1); const b = candidate('b', {}, 2); delete a.routing_profiles; delete b.routing_profiles;
  const result = route([a, b]);
  assert.deepEqual(result.eligibleForQuote, ['b', 'a']);
  assert.equal('intentFit' in result.candidates[0], false);
});
test('evaluated evidence cannot override basic capability validation or mutate registry', () => {
  const a = candidate('a'); a.active = false; const before = structuredClone(a);
  const result = route([a], { purpose: 'narrative film' });
  assert.deepEqual(result.eligibleForQuote, []); assert.ok(result.candidates[0].holds.includes('active_required'));
  assert.deepEqual(a, before);
});

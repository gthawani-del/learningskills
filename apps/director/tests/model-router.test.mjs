import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRoutes } from '../model-router.mjs';
const now = '2026-10-18T12:00:00Z';
function model(id = 'M17', priority = 10) {
  return { id, model_version: 'model1', provider: 'fal', endpoint: 'minimax/h3-max/reference-to-video', active: true, execution_tested: true, quality_validated: true, price_version: 'p1', capabilities: { tasks: ['reference_video'], outputModalities: ['video'], inputModes: ['text', 'image'], aspectRatios: ['16:9', '9:16'], resolutions: ['768P'], minDurationSeconds: 0.92, maxDurationSeconds: 15, languages: ['en'], identityReferences: true, lipSync: false, priority }, schema_evidence: { verified: true, version: 'schema1', sourceUrl: 'https://fal.ai/schema', expiresAt: '2026-10-19T00:00:00Z', endpoint: 'minimax/h3-max/reference-to-video', modelVersion: 'model1', inputSchemaHash: 'a'.repeat(64) }, price_evidence: { verified: true, configurationVerified: true, configuration: { resolution: '768P' }, version: 'p1', currency: 'USD', unit: 'second', unitMicroUsd: 50000, rounding: 'ceil', expiresAt: '2026-10-19T00:00:00Z', sourceUrl: 'https://fal.ai/pricing' } };
}
function route(models, requirements = {}) { return selectRoutes({ task: 'reference_video', models, requirements, now }); }
test('eligible routing requires explicit capability declarations and verified evidence', () => {
  const input = model(); const before = structuredClone(input);
  const result = route([input], { modality: 'video', inputModes: ['text', 'image'], aspectRatio: '16:9', resolution: '768P', durationSeconds: 10, language: 'en', identityReferences: true });
  assert.deepEqual(result.eligibleForQuote, ['M17']);
  assert.deepEqual(result.candidates[0].holds, []);
  assert.equal(result.candidates[0].authorized, undefined);
  assert.deepEqual(input, before);
});
test('language aspect duration input and performance mismatches hold routes', () => {
  for (const [requirements, reason] of [[{ language: 'hi' }, 'language_unsupported'], [{ aspectRatio: '4:3' }, 'aspectRatio_unsupported'], [{ durationSeconds: 16 }, 'durationSeconds_unsupported'], [{ durationSeconds: 0.5 }, 'durationSeconds_unsupported'], [{ inputModes: ['audio'] }, 'inputModes_unsupported'], [{ lipSync: true }, 'lipSync_unsupported'], [{ resolution: '1080P' }, 'resolution_unsupported'], [{ modality: 'image' }, 'modality_unsupported']]) {
    const result = route([model()], requirements);
    assert.deepEqual(result.eligibleForQuote, []);
    assert.ok(result.candidates[0].holds.includes(reason));
  }
});
test('catalog endpoints and names never imply capabilities or activate fallback', () => {
  const candidate = model('premium-reference-video');
  candidate.capabilities.tasks = ['image_edit'];
  candidate.active = false;
  const result = route([candidate]);
  assert.deepEqual(result.eligibleForQuote, []);
  assert.ok(result.candidates[0].holds.includes('task_not_declared'));
  assert.ok(result.candidates[0].holds.includes('active_required'));
  assert.equal(candidate.active, false);
});
test('expired unverified or mismatched schema and price evidence remain blocked', () => {
  const patches = [m => { delete m.model_version; }, m => { m.price_evidence.expiresAt = now; }, m => { m.price_evidence.verified = false; }, m => { m.price_evidence.version = 'stale'; }, m => { m.price_evidence.unitMicroUsd = 0; }, m => { m.price_evidence.minimumUnits = 0.5; }, m => { m.price_evidence.sourceUrl = 'http://fal.ai'; }, m => { m.schema_evidence = { version: 'catalog' }; }, m => { m.quality_validated = false; }, m => { m.execution_tested = false; }];
  for (const patch of patches) { const candidate = model(); patch(candidate); const result = route([candidate]); assert.equal(result.candidates[0].eligibleForQuote, false); assert.ok(result.candidates[0].holds.length); }
});
test('ranking is deterministic by eligibility then explicit priority then registry ID', () => {
  const blocked = model('blocked', 100); blocked.active = false;
  const low = model('low', 1); low.price_evidence.unitMicroUsd = 1;
  const candidates = [blocked, model('b', 10), low, model('a', 10)];
  assert.deepEqual(route(candidates).candidates.map(c => c.modelId), ['a', 'b', 'low', 'blocked']);
  assert.deepEqual(route(candidates.slice().reverse()), route(candidates));
});
test('unknown and malformed requirements fail closed rather than being ignored', () => {
  for (const requirements of [{ unknownControl: true }, { language: null }, { inputModes: 'image' }, { inputModes: ['image', 'image'] }, { durationSeconds: NaN }, { identityReferences: 'yes' }, { lipSync: 1 }]) assert.throws(() => route([model()], requirements), error => error.status === 400);
  assert.throws(() => selectRoutes({ task: '', models: [model()], now }), /task/);
  assert.throws(() => selectRoutes({ task: 'reference_video', models: [model()], now: 'yesterday' }), /time/);
  assert.throws(() => route([model(), model()]), /duplicated/);
});
test('missing capabilities do not inherit general filmmaker or model family knowledge', () => {
  const candidate = model(); delete candidate.capabilities.languages; delete candidate.capabilities.identityReferences;
  const result = route([candidate], { language: 'en', identityReferences: true });
  assert.ok(result.candidates[0].holds.includes('language_unsupported'));
  assert.ok(result.candidates[0].holds.includes('identityReferences_unsupported'));
});

test('schema evidence binds fresh exact model endpoint and input schema hash', () => {
  for (const [patch, expected] of [
    [m => { m.schema_evidence.expiresAt = now; }, 'schema_expired_or_missing'],
    [m => { delete m.schema_evidence.expiresAt; }, 'schema_expired_or_missing'],
    [m => { m.schema_evidence.modelVersion = 'different'; }, 'schema_model_binding_mismatch'],
    [m => { m.schema_evidence.endpoint = 'another/endpoint'; }, 'schema_model_binding_mismatch'],
    [m => { m.schema_evidence.inputSchemaHash = 'not-a-hash'; }, 'schema_evidence_unverified'],
  ]) {
    const candidate = model(); patch(candidate);
    const result = route([candidate]);
    assert.deepEqual(result.eligibleForQuote, []);
    assert.ok(result.candidates[0].holds.includes(expected));
  }
});
test('configuration pricing must be explicitly verified and bounded scalar data', () => {
  const invalid = [undefined, null, [], { resolution: ['768P'] }, { nested: { quality: 'pro' } }, { rate: NaN }, { ['x'.repeat(65)]: true }, Object.fromEntries(Array.from({ length: 31 }, (_, i) => ['key' + i, i]))];
  for (const configuration of invalid) {
    const candidate = model(); candidate.price_evidence.configuration = configuration;
    assert.ok(route([candidate]).candidates[0].holds.includes('price_configuration_unverified'));
  }
  const unverified = model(); unverified.price_evidence.configurationVerified = false;
  assert.ok(route([unverified]).candidates[0].holds.includes('price_configuration_unverified'));
  const fixedRate = model(); fixedRate.price_evidence.configuration = {};
  assert.deepEqual(route([fixedRate]).eligibleForQuote, ['M17']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTariff, validateTariff } from '../tariffs.mjs';
import { hash } from '../domain.mjs';
const now = '2026-10-18T00:00:00Z';
function component(unit, rate = 100, more = {}) { return { id: unit, unit, rate: { numeratorMicroUsd: rate, denominatorUnits: 1 }, rounding: 'ceil', ...more }; }
function price(components) { return { verified: true, configurationVerified: true, configuration: {}, version: 'p1', currency: 'USD', expiresAt: '2026-10-19T00:00:00Z', sourceUrl: 'https://fal.ai/pricing', tariff: { schemaVersion: 1, version: 'p1', components } }; }
function calc(components, input = {}, extra = {}) { return calculateTariff({ price: price(components), input, now, ...extra }); }
const blocked = error => error.status === 409;
test('baseline second image character and request components use exact ceilings', () => {
  assert.equal(calc([component('second')], { duration: 0.92 }).totalMicroUsd, 92);
  assert.equal(calc([component('image')], { num_images: 3 }).totalMicroUsd, 300);
  assert.equal(calc([component('character', 3, { characterCounting: 'unicode_codepoint' })], { text: 'Hi😀' }).totalMicroUsd, 9);
  assert.equal(calc([component('request', 7)]).totalMicroUsd, 7);
  assert.equal(calc([component('second', 1, { rate: { numeratorMicroUsd: 1, denominatorUnits: 3 } })], { duration: 1 }).totalMicroUsd, 1);
});
test('megapixels and thousand characters retain rational quantities without premature unit rounding', () => {
  const mp = calc([component('megapixel', 1000)], { num_images: 2, image_size: { width: 1024, height: 1024 } });
  assert.equal(mp.totalMicroUsd, 2098); assert.equal(mp.components[0].quantityNumerator, '2097152'); assert.equal(mp.components[0].quantityDenominator, '1000000');
  assert.equal(calc([component('thousand_character', 80000, { characterCounting: 'unicode_codepoint' })], { text: 'x'.repeat(1001) }).totalMicroUsd, 80080);
});
test('composite token quote requires server-bound usage bounds and applies allowance once', () => {
  const input = { prompt: 'A shot', image_url: 'https://assets.example/ref.jpg' };
  const components = [component('request', 100), component('reference_token', 3, { includedUnits: 100 }), component('output_token', 5)];
  assert.throws(() => calc(components, input), blocked);
  const usageEvidence = { verified: true, priceVersion: 'p1', inputHash: hash(input), measurementVersion: 'probe-v1', components: { reference_token: { bounded: true, quantity: 150 }, output_token: { bounded: true, quantity: 10 } } };
  const result = calc(components, input, { usageEvidence });
  assert.equal(result.totalMicroUsd, 300);
  assert.equal(result.components[1].billableNumerator, '50');
  for (const evidence of [{ ...usageEvidence, inputHash: 'different' }, { ...usageEvidence, priceVersion: 'old' }, { ...usageEvidence, verified: false }, { ...usageEvidence, components: { ...usageEvidence.components, output_token: { bounded: false, quantity: 10 } } }]) assert.throws(() => calc(components, input, { usageEvidence: evidence }), blocked);
});
test('minimum units are applied after included allowance and char conventions are explicit', () => {
  assert.equal(calc([component('character', 2, { includedUnits: 10, minimumUnits: 3, characterCounting: 'unicode_codepoint' })], { text: 'abc' }).totalMicroUsd, 6);
  assert.equal(calc([component('character', 1, { characterCounting: 'utf16_code_unit' })], { text: '😀' }).totalMicroUsd, 2);
  assert.equal(calc([component('character', 1, { characterCounting: 'utf8_byte' })], { text: '😀' }).totalMicroUsd, 4);
  assert.throws(() => validateTariff(price([component('character')]).tariff), blocked);
});
test('unmeasured defaults and configuration mismatches cannot produce quotes', () => {
  assert.throws(() => calc([component('image')], {}), blocked);
  assert.throws(() => calc([component('megapixel')], { num_images: 1, image_size: 'auto_2K' }), blocked);
  assert.throws(() => calc([component('second')], { text: 'No invented speaking duration' }), blocked);
  const configured = price([component('request')]); configured.configuration = { resolution: '1080P' };
  assert.throws(() => calculateTariff({ price: configured, input: { resolution: '768P' }, now }), blocked);
  assert.equal(calculateTariff({ price: configured, input: { resolution: '1080P' }, now }).totalMicroUsd, 100);
});
test('invalid stale duplicated or unsafe tariffs fail closed', () => {
  for (const change of [p => { p.verified = false; }, p => { p.expiresAt = now; }, p => { p.tariff.version = 'old'; }, p => { p.tariff.schemaVersion = 2; }, p => { p.tariff.components[0].rounding = 'nearest'; }, p => { p.tariff.components[0].rate.denominatorUnits = 0; }, p => { p.tariff.components.push(p.tariff.components[0]); }]) {
    const candidate = price([component('request')]); change(candidate);
    assert.throws(() => calculateTariff({ price: candidate, input: {}, now }), blocked);
  }
  assert.throws(() => calc([component('image', Number.MAX_SAFE_INTEGER)], { num_images: 2 }), blocked);
  assert.throws(() => calc([component('second')], { duration: 1e-10 }), blocked);
});

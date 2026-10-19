import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderClients, validateFalInput } from '../providers.mjs';
const endpoint = 'minimax/h3-max/reference-to-video';
const input = { prompt: 'A person watches the rain. Locked camera, motivated window light.', prompt_expansion_mode: 'disabled', duration: 5 };
const env = { FAL_API_KEY: 'test-secret', OPENAI_API_KEY: 'test-openai' };
function fake(data, calls) { return async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => data }; }; }
test('paid calls are blocked before transport without server authorization', async () => {
  let count = 0;
  const clients = createProviderClients({ env, fetcher: async () => { count++; } });
  await assert.rejects(clients.submitFalJob({ endpoint, input }), /authorization/);
  await assert.rejects(clients.planFilm({ brief: 'Rain' }), /registry route/);
  assert.equal(count, 0);
});
test('fal submission uses canonical server route and rejects malicious response URLs', async () => {
  const calls = [];
  const client = createProviderClients({ env, fetcher: fake({ request_id: 'req-123', status_url: 'http://localhost/secret' }, calls) });
  const result = await client.submitFalJob({ endpoint, input, authorized: true });
  assert.equal(result.statusUrl, 'https://queue.fal.run/minimax/h3-max/requests/req-123/status');
  assert.equal(calls[0].url, `https://queue.fal.run/${endpoint}`);
  assert.equal(calls[0].options.headers.Authorization, 'Key test-secret');
  assert.equal(calls[0].options.headers['x-app-fal-disable-fallback'], 'true');
  assert.equal(calls[0].options.headers['X-Fal-No-Retry'], '1');
  await client.getFalJob({ endpoint, requestId: result.requestId });
  assert.equal(calls[1].url, result.statusUrl);
  await assert.rejects(client.getFalJob({ endpoint, requestId: '../secret' }), /Invalid request ID/);
});
test('schema controls reject unsupported fields and out-of-range media', () => {
  assert.throws(() => validateFalInput(endpoint, { ...input, focal_length: 50 }), /unsupported/);
  assert.throws(() => validateFalInput(endpoint, { ...input, duration: 16 }), /range/);
  assert.throws(() => validateFalInput(endpoint, { ...input, reference_audio_urls: ['https://assets.example/a.mp3'] }), /measured-media/);
  assert.throws(() => validateFalInput(endpoint, { ...input, image_url: 'http://localhost/a.png' }), /HTTPS/);
  assert.throws(() => validateFalInput('bytedance/seedream/v5/pro/edit', { prompt: 'Portrait', image_urls: Array(11).fill('https://assets.example/a.png') }), /1–10/);
  assert.throws(() => validateFalInput('elevenlabs/tts/eleven-v4', { text: 'Hello', speed: 1.2 }), /unsupported/);
  assert.throws(() => validateFalInput('elevenlabs/tts/eleven-v4', { text: 'Hello', stability: 2 }), /range/);
});
test('legacy environment model names cannot bypass reviewed planning routing and reservations', async () => {
  let calls = 0;
  const client = createProviderClients({ env: {...env, OPENAI_STORY_MODEL: 'unreviewed-env-model'}, fetcher: async () => { calls++; } });
  await assert.rejects(client.planFilm({ brief: 'Rain', durationSeconds: 5, authorized: true }), /Legacy planning is retired/);
  assert.equal(calls, 0);
});
test('uncertain HTTP failures tell callers to reconcile rather than silently resubmit', async () => {
  const client = createProviderClients({ env, fetcher: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(client.submitFalJob({ endpoint, input, authorized: true }), /reconcile/);
});

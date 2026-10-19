// Offline, server-side simulation only. HTTP APIs, private asset reads and store
// transactions are real; no OpenAI, fal or Supabase service is contacted.
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { hash, patchProject } from '../domain.mjs';
import { reviewedFalInputSchema } from '../providers.mjs';
import { createServer } from '../server.mjs';
import { storyboardFixture } from './storyboard-fixture-server.mjs';

const expiry = '2099-01-01T00:00:00.000Z';
export const referenceSession = 'reference-fixture-session';

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const label = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([label, bytes])));
  return Buffer.concat([size, label, bytes, crc]);
}
export function referencePng(width = 1024, height = 1024) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const n = y * (width * 3 + 1) + 1 + x * 3;
    pixels[n] = 80 + Math.floor(x * 90 / width); pixels[n + 1] = 100 + Math.floor(y * 70 / height); pixels[n + 2] = 140;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

export function syntheticReferenceModel({ look = false } = {}) {
  const endpoint = look ? 'bytedance/seedream/v5/pro/edit' : 'fal-ai/flux-2-pro';
  const id = look ? 'F-reference-look-local' : 'F-reference-local', task = look ? 'reference_look' : 'reference_image', version = 'synthetic-reference-v1';
  const schema = reviewedFalInputSchema(endpoint);
  if (!schema) throw new Error('The reviewed reference adapter schema is not available: ' + endpoint);
  const bound = { modelId: id, provider: 'fal', endpoint, modelVersion: version, version: 'synthetic-reference-evidence-v1', sourceUrl: 'https://example.test/reference-evidence', evaluatedAt: '2026-10-01T00:00:00.000Z', expiresAt: expiry };
  const review = { ...bound, sampleCount: 1, tasks: [task], operations: [] };
  return { id, provider: 'fal', endpoint, model_version: version, active: true, execution_tested: true, quality_validated: true,
    capabilities: { tasks: [task], taskBindings: [{ ...bound, task, reviewed: true }], outputModalities: ['image'], inputModes: look ? ['text','image'] : ['text'], aspectRatios: ['1:1'], resolutions: ['1024x1024'], languages: ['English','Hindi','Hinglish'], identityReferences: look, priority: 1, reviewEvidence: { execution: structuredClone(review), quality: structuredClone(review) } },
    schema_evidence: { verified: true, version: 'synthetic-reference-schema-v1', endpoint, modelVersion: version, inputSchemaHash: hash(schema), sourceUrl: 'https://example.test/reference-schema', expiresAt: expiry },
    price_version: 'synthetic-reference-price-v1', price_evidence: { verified: true, version: 'synthetic-reference-price-v1', currency: 'USD', unit: look ? 'image' : 'request', unitMicroUsd: 25000, rounding: 'ceil', expiresAt: expiry, sourceUrl: 'https://example.test/reference-pricing', configurationVerified: true, configuration: look ? { num_images: 1, output_format: 'png' } : { output_format: 'png' } },
  };
}

export async function referenceFixture({ file, submitThrows = false, pollThrows = false, downloadFailures = 0, outputBytes, malformedOutput = false, terminalStatus = 'COMPLETED' } = {}) {
  const f = await storyboardFixture({ file }), { store } = f;
  let project = patchProject(f.project, { expectedVersion: f.project.version, stage: 'cast' });
  project = await store.save(project, f.project.version);
  store.state.models = [syntheticReferenceModel(), syntheticReferenceModel({ look: true })];
  // Exercise normal authenticated API scoping without real account/network calls.
  store.user = async token => token === referenceSession ? { id: project.ownerId, email: 'reference-fixture@example.test' } : token === 'foreign-fixture-session' ? { id: 'foreign-fixture-user', email: 'foreign@example.test' } : null;
  const objects = new Map(), requests = [], queries = [], output = outputBytes || referencePng();
  const stats = { submits: 0, polls: 0, results: 0, downloads: 0, puts: 0, gets: 0, signs: 0 };
  const state = { submitThrows, pollThrows, downloadFailures, malformedOutput, terminalStatus, outputBytes: output };
  const objectKey = (key, options = {}) => (options.bucket || 'director-media') + '/' + key;
  const storage = {
    async get(key, options) { stats.gets++; const value = objects.get(objectKey(key, options)); if (!value) throw Object.assign(new Error('Private fixture object unavailable.'), { status: 404 }); return Buffer.from(value); },
    async putIfAbsent(key, bytes, mime, checksum, options) {
      const scoped = objectKey(key, options), previous = objects.get(scoped);
      if (previous && hash(previous.toString('base64')) !== checksum) throw Object.assign(new Error('Private fixture content conflicts.'), { status: 409 });
      if (!previous) { stats.puts++; objects.set(scoped, Buffer.from(bytes)); }
    },
    async sign(key, options) { stats.signs++; if (!objects.has(objectKey(key, options))) throw Error('Cannot sign an unknown private fixture image.'); return 'https://reference-fixture.supabase.co/storage/v1/object/sign/' + (options?.bucket || 'director-media') + '/' + key + '?token=' + randomUUID(); },
  };
  const providers = {
    async submitFalJob(request) { stats.submits++; requests.push(structuredClone(request)); if (state.submitThrows) throw Error('Simulated ambiguous provider transport failure.'); return { requestId: 'reference_request_' + stats.submits, status: 'IN_QUEUE' }; },
    async getFalJob(request) {
      queries.push(structuredClone(request));
      if (request.result) { stats.results++; return state.malformedOutput ? { images: [] } : { images: [{ url: 'https://v3.fal.media/files/reference-fixture/' + request.requestId + '.png', width: 1024, height: 1024, content_type: 'image/png' }], has_nsfw_concepts: [false] }; }
      stats.polls++; if (state.pollThrows) throw Error('Simulated poll connection failure.'); return { status: state.terminalStatus };
    },
  };
  const fetcher = async (url, options = {}) => {
    if (typeof url !== 'string' || !url.startsWith('https://v3.fal.media/files/reference-fixture/')) throw Error('Unexpected external request in offline reference fixture: ' + String(url));
    stats.downloads++; if (state.downloadFailures > 0) { state.downloadFailures--; throw Error('Simulated saved-image download failure.'); }
    return new Response(state.outputBytes, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(state.outputBytes.length) } });
  };
  const env = { NODE_ENV: 'test', SUPABASE_URL: 'https://supabase.fixture.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-no-network', FAL_API_KEY: 'synthetic-no-network' };
  return { store, project, env, providers, storage, fetcher, requests, queries, state, objects, counters: () => ({ ...stats }) };
}

export async function referenceServer(options) {
  const fixture = await referenceFixture(options);
  return { ...fixture, server: await createServer(fixture) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, project } = await referenceServer();
  server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ projectId: project.id, port: server.address().port, session: referenceSession })));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

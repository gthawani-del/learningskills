// Actual authenticated local APIs/private image bytes with a simulated provider.
// Seed references are uploaded PNG fixtures. No paid setup or external request.
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { hash, patchProject } from '../domain.mjs';
import { createServer } from '../server.mjs';
import { applyReferenceProductionCommand, referenceProductionContext } from '../public/reference-production-core.js';
import { applyStoryboardHandoffCommand, currentStoryboardSequence } from '../public/storyboard-handoff-core.js';
import { applyStoryboardProductionCommand, storyboardProductionContext } from '../public/storyboard-production-core.js';
import { referenceFixture, referenceSession, referencePng, syntheticReferenceModel } from './reference-fixture-server.mjs';

export function syntheticStoryboardFrameModel() {
  const model = syntheticReferenceModel({ look: true }), id = 'F-storyboard-frame-local', task = 'storyboard_frame';
  model.id = id; model.capabilities.tasks = [task]; model.capabilities.aspectRatios = ['16:9','9:16','1:1']; model.capabilities.resolutions = ['1536x864','864x1536','1024x1024'];
  model.capabilities.taskBindings = model.capabilities.taskBindings.map(binding => ({ ...binding, modelId: id, task }));
  for (const kind of ['execution','quality']) model.capabilities.reviewEvidence[kind] = { ...model.capabilities.reviewEvidence[kind], modelId: id, tasks: [task] };
  model.price_version = 'synthetic-storyboard-frame-price-v1';
  model.price_evidence = { verified: true, version: model.price_version, currency: 'USD', sourceUrl: 'https://example.test/synthetic-storyboard-pricing', expiresAt: '2099-01-01T00:00:00.000Z', configurationVerified: true, configuration: { num_images: 1, output_format: 'png' }, tariff: { schemaVersion: 1, version: model.price_version, components: [
    { id: 'frame', unit: 'image', rate: { numeratorMicroUsd: 67500, denominatorUnits: 1 }, rounding: 'ceil' },
    { id: 'additional_inputs', unit: 'input_image', includedUnits: 1, rate: { numeratorMicroUsd: 4500, denominatorUnits: 1 }, rounding: 'ceil' },
  ] } };
  return model;
}

export async function storyboardProductionFixture({ projectSettings = {}, file, prepared = false, approveSpec = false, shareIdentityLookAsset = false, submitThrows = false, pollThrows = false, downloadFailures = 0, outputBytes = null, malformedOutput = false, terminalStatus = 'COMPLETED' } = {}) {
  const f = await referenceFixture({ projectSettings, file }), { store, storage } = f; let p = f.project;
  async function referenceFacts() { return { assets: await store.records('assets', p.id), candidates: await store.referenceCandidates(p.ownerId, p.id) }; }
  async function refCommand(action, fields = {}) {
    const approvals = await store.records('approvals', p.id), next = applyReferenceProductionCommand(p, { expectedVersion: p.version, action, ...fields }, approvals, await referenceFacts());
    if (next.version !== p.version) p = await store.saveReferenceProduction(next, p.version, { expectedApprovalId: approvals.at(-1)?.id ?? null });
  }
  async function refSubject(id) { return referenceProductionContext(p, await store.records('approvals', p.id), await referenceFacts()).subjects.find(s => s.id === id); }
  async function seedReference(subjectId, reusedAsset = null) {
    if (subjectId.startsWith('look:')) await refCommand('refresh', { subjectId, acknowledgeSourceChange: true });
    const subject = await refSubject(subjectId);
    await store.approve(p, { expectedVersion: p.version, artifactId: 'reference_brief:' + subjectId, version: subject.current.version, decision: 'approved' }, p.ownerId);
    let asset = reusedAsset;
    if (!asset) {
      const id = randomUUID(), bytes = referencePng(), key = p.ownerId + '/' + p.id + '/' + id;
      asset = { id, projectId: p.id, name: subject.current.document.name + ' — uploaded fixture.png', mime: 'image/png', role: subjectId.startsWith('identity:') ? 'character_identity' : subjectId.startsWith('look:') ? 'wardrobe' : 'location', scope: 'project', shotId: null, version: 1, storageKey: key, size: bytes.length, checksum: hash(bytes.toString('base64')) };
      await storage.putIfAbsent(key, bytes, asset.mime, asset.checksum); await store.add('assets', asset);
    }
    const candidate = await store.registerReferenceCandidate({ actorId: p.ownerId, projectId: p.id, candidate: { id: randomUUID(), projectId: p.id, subjectId, subjectVersion: subject.current.version, assetId: asset.id, assetVersion: asset.version, origin: 'uploaded', jobId: null, createdAt: new Date().toISOString() } });
    await refCommand('select', { subjectId, candidateId: candidate.id, acknowledgeReview: true });
    const selected = await refSubject(subjectId);
    await store.approve(p, { expectedVersion: p.version, artifactId: 'reference_selection:' + subjectId, version: selected.selection.version, decision: 'approved', acknowledgeReferenceReview: true }, p.ownerId);
    return asset;
  }
  await refCommand('prepare');
  for (const id of ['mira','rafi']) { const identity = await seedReference('identity:' + id); await seedReference('look:' + id, shareIdentityLookAsset ? identity : null); }
  for (const id of ['platform','waiting-room']) await seedReference('location:' + id);
  let approvals = await store.records('approvals', p.id), next = applyStoryboardHandoffCommand(p, { expectedVersion: p.version, action: 'prepare' }, approvals);
  p = await store.saveStoryboardHandoff(next, p.version, { expectedApprovalId: approvals.at(-1)?.id ?? null });
  await store.approve(p, { expectedVersion: p.version, artifactId: 'storyboard_sequence', version: currentStoryboardSequence(p).version, decision: 'approved', ackPlanningOnly: true }, p.ownerId);
  next = patchProject(p, { expectedVersion: p.version, stage: 'storyboard' }); p = await store.save(next, p.version);
  store.state.models = [syntheticStoryboardFrameModel()];
  if (prepared || approveSpec) {
    approvals = await store.records('approvals', p.id); next = applyStoryboardProductionCommand(p, { expectedVersion: p.version, action: 'prepare' }, approvals, { assets: await store.records('assets', p.id), referenceCandidates: await store.referenceCandidates(p.ownerId, p.id), candidates: await store.storyboardCandidates(p.ownerId, p.id) });
    p = await store.saveStoryboardProduction(next, p.version, { expectedApprovalId: approvals.at(-1)?.id ?? null });
  }
  if (approveSpec) for (const shot of storyboardProductionContext(p, await store.records('approvals', p.id), { assets: await store.records('assets', p.id), referenceCandidates: await store.referenceCandidates(p.ownerId, p.id), candidates: [] }).shots) await store.approve(p, { expectedVersion: p.version, artifactId: 'storyboard_brief:' + shot.shotId, version: shot.current.version, decision: 'approved', acknowledgeFrameDirection: true }, p.ownerId);
  const requests = [], queries = [], sizes = new Map(), stats = { submits: 0, polls: 0, results: 0, downloads: 0 }, state = { submitThrows, pollThrows, downloadFailures, outputBytes, malformedOutput, terminalStatus };
  const providers = {
    async submitFalJob(request) { stats.submits++; requests.push(structuredClone(request)); if (state.submitThrows) throw Error('Simulated ambiguous frame submission.'); const requestId = 'storyboard_frame_' + stats.submits; sizes.set(requestId, request.input.image_size); return { requestId, status: 'IN_QUEUE' }; },
    async getFalJob(request) { queries.push(structuredClone(request)); if (!request.result) { stats.polls++; if (state.pollThrows) throw Error('Simulated frame poll failure.'); return { status: state.terminalStatus }; } stats.results++; const size = sizes.get(request.requestId); return state.malformedOutput ? { images: [] } : { images: [{ url: 'https://v3.fal.media/files/storyboard-fixture/' + request.requestId + '.png', width: size.width, height: size.height, content_type: 'image/png' }], has_nsfw_concepts: [false] }; },
  };
  const fetcher = async (url, options = {}) => {
    if (typeof url !== 'string' || !url.startsWith('https://v3.fal.media/files/storyboard-fixture/')) throw Error('Unexpected external request in storyboard fixture: ' + String(url));
    stats.downloads++; if (state.downloadFailures > 0) { state.downloadFailures--; throw Error('Simulated original-frame download failure.'); }
    const id = url.split('/').at(-1).replace(/\.png$/, ''), size = sizes.get(id), bytes = state.outputBytes || referencePng(size.width, size.height);
    return new Response(bytes, { headers: { 'content-type': 'image/png', 'content-length': String(bytes.length) } });
  };
  return { ...f, project: p, providers, fetcher, requests, queries, state, counters: () => ({ ...stats, signs: f.counters().signs, puts: f.counters().puts }) };
}

export async function storyboardProductionServer(options) { const f = await storyboardProductionFixture(options); return { ...f, server: await createServer(f) }; }
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, project } = await storyboardProductionServer(); server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ projectId: project.id, port: server.address().port, session: referenceSession })));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

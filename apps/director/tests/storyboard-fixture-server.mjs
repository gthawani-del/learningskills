// Real local HTTP/store with deterministic simulated provider output only.
// Never contacts OpenAI, fal, Supabase or a paid endpoint.
import { fileURLToPath } from 'node:url';
import { patchProject } from '../domain.mjs';
import { createServer } from '../server.mjs';
import { storyboardPlanningSchemaHash } from '../planning-profile.mjs';
import { applyStoryboardHandoffCommand, storyboardHandoffContext, currentStoryboardSequence } from '../public/storyboard-handoff-core.js';
import { departmentFixture, syntheticDepartmentModel } from './department-fixture-server.mjs';
import { reviewedPlanningFixture } from './planning-fixture-profile.mjs';

export function syntheticStoryboardModel() {
  const model = syntheticDepartmentModel();
  model.id = 'O-storyboard-local';
  model.schema_evidence.inputSchemaHash = storyboardPlanningSchemaHash;
  return reviewedPlanningFixture(model, { operations: ['plan_storyboard'] });
}

export async function storyboardFixture({ projectSettings = {}, file, queued = false, malformed = false, prepared = false, approveHandoff = false } = {}) {
  const f = await departmentFixture({ projectSettings, file, approveDepartments: true }), { store } = f;
  store.state.models = [syntheticStoryboardModel()];
  let project = patchProject(f.project, { expectedVersion: f.project.version, stage: 'storyboard' });
  await store.save(project, f.project.version);
  if (prepared || approveHandoff) {
    const approvals = await store.records('approvals', project.id), next = applyStoryboardHandoffCommand(project, { expectedVersion: project.version, action: 'prepare' }, approvals);
    project = await store.saveStoryboardHandoff(next, project.version, { expectedApprovalId: approvals.at(-1)?.id ?? null });
  }
  if (approveHandoff) await store.approve(project, { expectedVersion: project.version, artifactId: 'storyboard_sequence', version: currentStoryboardSequence(project).version, decision: 'approved', ackPlanningOnly: true }, project.ownerId);
  const requests = [], snapshots = new Map(); let submits = 0, polls = 0;
  async function simulated(responseId, request) {
    const current = await store.get(project.id, project.ownerId), approvals = await store.records('approvals', project.id);
    const prepared = applyStoryboardHandoffCommand(current, { expectedVersion: current.version, action: 'prepare' }, approvals);
    const c = storyboardHandoffContext(prepared, approvals), order = c.sequence.current.shots.map(binding => binding.shotId), shots = order.map(id => ({ id, document: structuredClone(c.shots.find(shot => shot.id === id).current.document) }));
    const unapproved = c.shots.find(shot => !shot.approved);
    if (unapproved && current.storyboardHandoff) shots.find(shot => shot.id === unapproved.id).document.title += ' — simulated coverage revision';
    if (malformed) shots.pop();
    return { id: responseId, status: 'completed', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, storyboard: { shots } };
  }
  const planningProvider = {
    submit: async ({ request }) => { requests.push(structuredClone(request)); const id = `resp_storyboard_${++submits}`, result = await simulated(id, request); snapshots.set(id, result); return queued ? { id, status: 'queued', usage: null } : result; },
    poll: async ({ responseId }) => { polls++; return structuredClone(snapshots.get(responseId)); },
  };
  return { store, project, env: f.env, planningProvider, requests, counters: () => ({ submits, polls }) };
}

export async function storyboardServer(options) {
  const f = await storyboardFixture({ queued: true, ...options });
  return { ...f, server: await createServer({ env: f.env, store: f.store, planningProvider: f.planningProvider }) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, project } = await storyboardServer();
  server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ projectId: project.id, port: server.address().port })));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

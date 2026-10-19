// Offline fixture: real HTTP/API/store and deterministic simulated provider output.
// It never contacts OpenAI, fal, Supabase or a paid endpoint.
import { fileURLToPath } from 'node:url';
import { LocalStore } from '../store.mjs';
import { newProject, patchProject } from '../domain.mjs';
import { createServer } from '../server.mjs';
import { applyBriefCommand } from '../public/creative-brief-core.js';
import { applyScreenplayProjectCommand } from '../public/screenplay-project.js';
import { screenplayInputSignature } from '../public/screenplay-core.js';
import { applyDepartmentCommand, departmentPlanningContext } from '../public/department-plan-core.js';
import { departmentPlanningSchemaHash, departmentRevisionSchemaHash } from '../planning-profile.mjs';
import { reviewedPlanningFixture } from './planning-fixture-profile.mjs';
import { syntheticPlanningModel, screenplayDocument } from './writing-fixture-server.mjs';

export function syntheticDepartmentModel() {
  const model = reviewedPlanningFixture(syntheticPlanningModel(), { operations: ['plan_departments'] });
  model.id = 'O-departments-local';
  model.schema_evidence.inputSchemaHash = departmentPlanningSchemaHash;
  model.capabilities.planning.maxRequestBytes = 200000;
  // Rebind the deliberately synthetic review records after assigning the fixture ID.
  return reviewedPlanningFixture(model, { operations: ['plan_departments'] });
}

export function syntheticDepartmentRevisionModel() {
  const model = syntheticDepartmentModel();
  model.id = 'O-department-revisions-local';
  model.schema_evidence.inputSchemaHash = departmentRevisionSchemaHash;
  return reviewedPlanningFixture(model, { operations: ['revise_departments'] });
}

export async function departmentFixture({ file, queued = false, malformed = false, paused = false, approvedScript = true, revisionEnabled = false, prepared = false, approveDepartments = false } = {}) {
  const store = await new LocalStore(file).init();
  store.state.models = [syntheticDepartmentModel(), ...(revisionEnabled ? [syntheticDepartmentRevisionModel()] : [])];
  store.state.operationalControl.generationPaused = paused;
  let project = newProject({ title: 'Department planning proof', premise: 'Mira, a station attendant, keeps a promise to a stranger.', direction: 'Natural skin texture, motivated practical lighting and restrained performance.' }, 'demo-user');
  project = applyBriefCommand(project, { expectedVersion: project.version, action: 'suggest' });
  project = applyScreenplayProjectCommand(project, { expectedVersion: project.version, action: 'apply_proposal', proposal: { inputSignature: screenplayInputSignature(project), document: screenplayDocument, modelCallId: 'saved_fixture_screenplay' } });
  project = patchProject(project, { expectedVersion: project.version, stage: 'cast' });
  await store.create(project);
  await store.approve(project, { expectedVersion: project.version, artifactId: 'brief', version: project.creativeBrief.currentVersion, decision: 'approved', acknowledgeAssumptions: true }, project.ownerId);
  if (approvedScript) await store.approve(project, { expectedVersion: project.version, artifactId: 'screenplay', version: project.screenplay.currentVersion, decision: 'approved', acknowledgeLimitedCoverage: true }, project.ownerId);
  if (prepared || approveDepartments) {
    const next = applyDepartmentCommand(project, { expectedVersion: project.version, action: 'prepare' }, await store.records('approvals', project.id));
    await store.saveDepartmentPlans(next, project.version, { expectedApprovalId: (await store.records('approvals', project.id)).at(-1)?.id ?? null });
    project = next;
  }
  if (approveDepartments) for (const unit of departmentPlanningContext(project, await store.records('approvals', project.id)).departments) await store.approve(project, { expectedVersion: project.version, artifactId: 'department:' + unit.id, version: unit.current.version, decision: 'approved', ackPlanningOnly: true }, project.ownerId);
  const requests = [], snapshots = new Map(); let submits = 0, polls = 0;
  async function simulated(responseId, request) {
    const input = JSON.parse(request.body.input);
    if (input.operation === 'revise_departments') {
      const context = input.context.departmentPlanning, selected = context.revision.request.departmentIds;
      const departments = selected.map(id => {
        const document = structuredClone(context.departments.find(unit => unit.id === id).current.document);
        document.summary += ' Simulated scoped revision: ' + context.revision.request.instruction.slice(0, 300);
        return { id, document };
      });
      if (malformed) departments.pop();
      return { id: responseId, status: 'completed', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, departments: { departments } };
    }
    const current = await store.get(project.id, project.ownerId), approvals = await store.records('approvals', project.id);
    const prepared = applyDepartmentCommand(current, { expectedVersion: current.version, action: 'prepare' }, approvals);
    const departments = departmentPlanningContext(prepared, approvals).departments.map(unit => {
      const document = structuredClone(unit.current.document);
      if (unit.id === 'sound' && !unit.approved) document.summary += ' Simulated proposal: retain a quiet station ambience beneath the last line.';
      return { id: unit.id, document };
    });
    if (malformed) departments.pop();
    return { id: responseId, status: 'completed', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, departments: { departments } };
  }
  const planningProvider = {
    submit: async ({ request }) => { requests.push(structuredClone(request)); const id = `resp_departments_${++submits}`, result = await simulated(id, request); snapshots.set(id, result); return queued ? { id, status: 'queued', usage: null } : result; },
    poll: async ({ responseId }) => { polls++; return structuredClone(snapshots.get(responseId)); },
  };
  const env = { DIRECTOR_DEMO: '1', OPENAI_API_KEY: 'synthetic-no-network' };
  return { store, project, env, planningProvider, requests, counters: () => ({ submits, polls }) };
}

export async function departmentServer(options) {
  const fixture = await departmentFixture({ queued: true, ...options });
  const server = await createServer({ env: fixture.env, store: fixture.store, planningProvider: fixture.planningProvider });
  return { ...fixture, server };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const revision = process.env.DIRECTOR_DEPARTMENT_REVISION_FIXTURE === '1';
  const { server, project } = await departmentServer({ revisionEnabled: revision, prepared: revision, approveDepartments: revision });
  server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ projectId: project.id, port: server.address().port })));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

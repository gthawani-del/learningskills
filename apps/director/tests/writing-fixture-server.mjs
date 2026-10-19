// Real local HTTP/API/store fixture. All model responses are deterministic simulations.
// This module does not contact OpenAI, fal, Supabase or any paid endpoint.
import { fileURLToPath } from 'node:url';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';
import { LocalStore } from '../store.mjs';
import { newProject } from '../domain.mjs';
import { planningSchemaHash } from '../planning-profile.mjs';
import { createServer } from '../server.mjs';

export const screenplayDocument = {
  title: 'The spare ticket',
  logline: 'A station attendant must decide whether to keep a promise to a stranger.',
  treatment: 'Before the last train arrives, Mira discovers an unused ticket left by Rafi. Their brief conversation turns a routine shift into a choice about trust.',
  characters: [
    { id: 'mira', name: 'Mira', description: 'A station attendant finishing a long shift. Careful, observant and quietly funny.' },
    { id: 'rafi', name: 'Rafi', description: 'A commuter carrying a paper bag. Tired but attentive to other people.' },
  ],
  scenes: [
    { id: 'platform', heading: 'EXT. SMALL RAILWAY PLATFORM - EVENING', action: 'Mira straightens a timetable. Rafi holds out an unused ticket; his other hand keeps a paper bag closed against the wind.', dialogue: [
      { id: 'line-one', characterId: 'rafi', text: 'Someone might still need this.', direction: 'Offering the ticket without ceremony.' },
      { id: 'line-two', characterId: 'mira', text: 'Then I will leave the light on.', direction: 'A small nod, without a smile.' },
    ], durationSeconds: 30 },
    { id: 'waiting-room', heading: 'INT. STATION WAITING ROOM - NIGHT', action: 'The last train passes. Mira lays the ticket beside a clean cup and leaves one lamp burning. A hand reaches for the ticket as she closes the outer door.', dialogue: [
      { id: 'line-three', characterId: 'mira', text: 'There is still time.', direction: 'Softly, to the person beyond the door.' },
    ], durationSeconds: 30 },
  ],
};
export const revisedScreenplayDocument = {
  ...structuredClone(screenplayDocument),
  scenes: screenplayDocument.scenes.map(scene => scene.id === 'platform'
    ? { ...structuredClone(scene), action: 'Mira holds a rattling noticeboard steady. Rafi offers his unused ticket, then helps her secure the loose corner.' }
    : structuredClone(scene)),
};
export const suppliedScriptText = 'INT. KITCHEN — MORNING\n\nAsha opens a tin of tea.\n\nASHA\nThe rain has finally stopped.\n\nShe sets two cups beside the window.\n';
export function syntheticPlanningModel() {
  const endpoint = 'https://api.openai.com/v1/responses', version = 'synthetic-writing-model', expiresAt = '2099-01-01T00:00:00Z';
  return reviewedPlanningFixture({ id: 'O-writing-local', provider: 'openai', endpoint, model_version: version, active: true, execution_tested: true, quality_validated: true,
    capabilities: { planning: { enabled: true, version: 'v1', background: true, providerRetentionAcknowledged: true, contextWindowTokens: 1000, maxOutputTokens: 100, maxRequestBytes: 100000,
      tokenBoundEvidence: { verified: true, model: version, contextWindowTokens: 1000, type: 'context-window-upper-bound', tokenizerVersion: 'synthetic-context', sourceUrl: 'https://example.test/tokens', expiresAt } } },
    schema_evidence: { verified: true, version: 's-writing-test', endpoint, modelVersion: version, inputSchemaHash: planningSchemaHash, sourceUrl: 'https://example.test/schema', expiresAt },
    price_version: 'p-writing-test', price_evidence: { verified: true, version: 'p-writing-test', model: version, currency: 'USD', sourceUrl: 'https://example.test/price', expiresAt,
      input: { numeratorMicroUsd: 1, denominatorTokens: 1 }, cachedInput: { numeratorMicroUsd: 0, denominatorTokens: 1 }, output: { numeratorMicroUsd: 2, denominatorTokens: 1 } },
  });
}
export function simulatedWritingResult(responseId, request, { malformed = false } = {}) {
  const input = JSON.parse(request.body.input), operation = request.body.metadata?.operation || input.operation;
  return { id: responseId, status: 'completed', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
    screenplay: malformed ? { ...screenplayDocument, scenes: [] }
      : structuredClone(operation === 'revise_script' ? revisedScreenplayDocument : screenplayDocument),
  };
}
export async function writingServer() {
  const store = await new LocalStore().init(); store.state.models = [syntheticPlanningModel()]; store.state.operationalControl.generationPaused = false;
  const project = newProject({ title: 'Writing browser proof', premise: 'A station attendant chooses whether to keep a promise to a stranger.' }, 'demo-user'); await store.create(project);
  if (process.env.DIRECTOR_WRITING_STAGE_FAILURE === '1') {
    const save = store.save.bind(store); let failOnce = true;
    store.save = async (next, expectedVersion) => {
      const previous = store.state.projects.find(item => item.id === next.id);
      if (failOnce && next.stage === 'story' && previous?.stage !== 'story' && previous?.screenplay?.currentVersion > 0 && next.screenplay?.currentVersion === previous.screenplay.currentVersion) {
        failOnce = false;
        throw Object.assign(new Error('Controlled test interruption after screenplay saved, before opening Story.'), { status: 503 });
      }
      return save(next, expectedVersion);
    };
  }

  let submits = 0, polls = 0;
  const planningProvider = {
    submit: async () => ({ id: `resp_writing_${++submits}`, status: 'queued', usage: null }),
    poll: async ({ responseId, request }) => { polls++; return simulatedWritingResult(responseId, request); },
  };
  const server = await createServer({ env: { DIRECTOR_DEMO: '1', DIRECTOR_PLANNING_ENABLED: '1', OPENAI_API_KEY: 'synthetic-no-network', OPENAI_STORY_MODEL: 'synthetic-writing-model' }, store, planningProvider });
  return { server, store, project, counters: () => ({ submits, polls }) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, project } = await writingServer();
  server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ projectId: project.id, port: server.address().port })));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

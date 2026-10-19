/** Discovery manifest only. This file never enables a provider or verifies its fit. */
export const routingCatalogExplanation = Object.freeze({
  scope: 'Production model tasks only; the twenty seeded candidates are a historical starting set, not a model ceiling. Explicit reviewed server bindings can add registry models to known tasks; deterministic, manual and administration functions are not model calls.',
  evidence: 'Historical associations come from registry seed/roles and the functionality matrix. Dynamic associations require reviewed, fresh model-bound task and catalog-schema evidence; discovery is never production validation.',
  eligibility: 'Server capabilities.tasks, active state, execution/quality evidence, schema, pricing and requirements remain authoritative in model-router.mjs.',
  unknownTask: 'knownRoutingTask returns null and taskCandidates returns []; API callers should reject unknown tasks with HTTP 400.',
});

// Exact endpoint identity comes from database/director-registry-seed.sql.
export const candidateEndpointManifest = Object.freeze({
  M01: 'openrouter/router',
  M02: 'openrouter/router/audio',
  M03: 'openrouter/router/vision',
  M04: 'openrouter/router/video',
  M05: 'fal-ai/audio-understanding',
  M06: 'fal-ai/elevenlabs/speech-to-text/scribe-v2',
  M07: 'fal-ai/elevenlabs/forced-alignment',
  M08: 'fal-ai/demucs',
  M09: 'bytedance/seedream/v5/pro/edit',
  M10: 'veed/fabric-1.0',
  M11: 'elevenlabs/music/v2.5',
  M12: 'fal-ai/elevenlabs/sound-effects/v2',
  M13: 'fal-ai/kling-video/o3/pro/video-to-video/edit',
  M14: 'fal-ai/bytedance-upscaler/upscale/video',
  M15: 'fal-ai/minimax-music/v2.6',
  M16: 'fal-ai/minimax/voice-clone',
  M17: 'minimax/h3-max/reference-to-video',
  M18: 'fal-ai/z-image/turbo',
  M19: 'elevenlabs/tts/eleven-v4',
  M20: 'fal-ai/sync-lipsync/react-1',
});
const source = 'database/director-registry-seed.sql; database/director-registry-roles.sql; docs/FUNCTIONALITY_ENDPOINT_MATRIX.csv';
const task = (id, label, candidateModelIds) => Object.freeze({ id, label, candidateModelIds: Object.freeze(candidateModelIds), source });
export const routingTasks = Object.freeze([
  task('brief_interpretation', 'Interpret a user request into a creative brief', []),
  task('film_planning', 'Prepare a reviewed film and shot plan', []),
  task('film_plan_revision', 'Propose a scoped film-plan revision', []),
  task('screenplay_writing', 'Write a structured screenplay from an approved brief', []),
  task('screenplay_revision', 'Revise the current screenplay within its saved scope', []),
  task('department_planning', 'Coordinate filmmaking departments from an approved brief and screenplay', []),
  task('department_revision', 'Revise only explicitly selected filmmaking departments', []),
  task('storyboard_planning', 'Prepare source-bound storyboard shot contracts and timing estimates', []),
  task('story_reasoning', 'Story, screenplay and filmmaking reasoning', ['M01']),
  task('audio_analysis', 'Audio interpretation', ['M02', 'M05']),
  task('song_analysis', 'Song mood, instrumentation and development analysis', ['M05', 'M02']),
  task('image_analysis', 'Image and reference review', ['M03']),
  task('video_analysis', 'Video performance and continuity review', ['M04']),
  task('transcription', 'Speech transcription; singing remains unverified', ['M06']),
  task('alignment', 'Align approved words to audio', ['M07']),
  task('stem_separation', 'Vocal and accompaniment separation', ['M08']),
  task('image_edit', 'Reference image editing and storyboard frames', ['M09']),
  task('talking_portrait', 'Portrait performance from approved audio; singing unverified', ['M10']),
  task('music_generation', 'Score and music generation', ['M11']),
  task('sound_effects', 'Sound effects, ambience and Foley', ['M12']),
  task('video_edit', 'Targeted video-to-video editing', ['M13']),
  task('video_upscale', 'Video finishing and upscale', ['M14']),
  task('song_generation', 'Original song generation with approved lyrics', ['M15']),
  task('voice_clone', 'Voice cloning; consent and lifecycle blocked', ['M16']),
  task('reference_video', 'Reference-driven cinematic video', ['M17']),
  task('draft_image', 'Draft image concepts; not final locked identities', ['M18']),
  task('speech_synthesis', 'Directed speech with approved voice', ['M19']),
  task('lip_sync_repair', 'Lip-sync correction against approved audio', ['M20']),
]);

// Planning operation identity is a product contract, not a provider/model pin.
export const planningOperationTasks = Object.freeze({
  interpret_brief: 'brief_interpretation', initial_plan: 'film_planning',
  revise_plan: 'film_plan_revision', write_script: 'screenplay_writing', revise_script: 'screenplay_revision',
  plan_departments: 'department_planning',
  revise_departments: 'department_revision',
  plan_storyboard: 'storyboard_planning',
});
export function planningOperationTask(operation) {
  return typeof operation === 'string' && Object.hasOwn(planningOperationTasks, operation) ? planningOperationTasks[operation] : null;
}

export function knownRoutingTask(id) {
  return typeof id === 'string' ? routingTasks.find(entry => entry.id === id) ?? null : null;
}

/** Return catalog candidates unchanged, including missing server capability declarations.
 * The selector must see those missing declarations and hold the route. Catalog membership
 * is discovery, never an inferred capabilities.tasks value or authorization to spend.
 */
const label = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const fresh = (value, now) => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Date.parse(value) > now;
function https(value) { try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; } }
function reviewedTaskBinding(model, taskId, now) {
  if (!model || !label(model.id) || model.provider !== 'fal' || !label(model.endpoint)) return false;
  // Seed identity changes need a new registry identity, not a hidden override.
  if (Object.hasOwn(candidateEndpointManifest, model.id) && model.endpoint !== candidateEndpointManifest[model.id]) return false;
  const version = model.model_version ?? model.version;
  if (!label(version) || !Array.isArray(model.capabilities?.taskBindings)) return false;
  const bindings = model.capabilities.taskBindings.filter(binding => binding && binding.task === taskId);
  if (bindings.length !== 1) return false;
  const binding = bindings[0];
  if (binding.reviewed !== true || binding.modelId !== model.id || binding.provider !== model.provider || binding.endpoint !== model.endpoint || binding.modelVersion !== version || !label(binding.version) || !https(binding.sourceUrl) || !fresh(binding.expiresAt, now)) return false;
  const schema = model.schema_evidence;
  return !!schema && schema.verified === true && label(schema.version) && https(schema.sourceUrl) && fresh(schema.expiresAt, now) && schema.endpoint === model.endpoint && schema.modelVersion === version && /^[a-f0-9]{64}$/.test(schema.inputSchemaHash || '');
}
export function taskCandidates(taskId, models, { now = Date.now() } = {}) {
  const entry = knownRoutingTask(taskId);
  if (!entry || !Array.isArray(models)) return [];
  const historical = entry.candidateModelIds.flatMap(id => models.filter(model =>
    model && model.id === id && model.provider === 'fal' && model.endpoint === candidateEndpointManifest[id]));
  const time = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : typeof now === 'string' ? Date.parse(now) : NaN;
  if (!Number.isFinite(time)) return historical;
  const existing = new Set(historical.map(model => model.id));
  const idCounts = new Map();
  for (const model of models) if (model) idCounts.set(model.id, (idCounts.get(model.id) || 0) + 1);
  const dynamic = models.filter(model => !existing.has(model?.id) && idCounts.get(model?.id) === 1 && reviewedTaskBinding(model, taskId, time));
  dynamic.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...historical, ...dynamic];
}

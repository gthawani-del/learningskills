import { hash } from './domain.mjs';
import { planSchema, instruction, validateFilmPlan } from './providers.mjs';
import { briefProposalSchema, briefProposalInstruction, validateBriefProposal } from './brief-proposal.mjs';
import { screenplayProposalSchema, screenplayPlanningInstruction, validateScreenplayProposal } from './screenplay-proposal.mjs';
import { departmentProposalSchema, departmentPlanningInstruction, validateDepartmentContext, validateDepartmentProposal, departmentRevisionProposalSchema, departmentRevisionInstruction, validateDepartmentRevisionContext, validateDepartmentRevisionProposal } from './department-proposal.mjs';
import {storyboardProposalSchema,storyboardPlanningInstruction,validateStoryboardContext,validateStoryboardProposal} from './storyboard-proposal.mjs';
import {musicTreatmentSchema,musicTreatmentInstruction,MUSIC_TREATMENT_CONTRACT} from './music-treatment-proposal.mjs';
import {SONG_DIRECTOR_INSTRUCTION} from './public/song-intelligence-core.js';
export const PLANNING_VERSION = 'director-planning-v3';
// The first five operation bodies remain byte-for-byte compatible with saved v3
// requests. Department planning is an additive, separately reviewed v4 contract.
export const DEPARTMENT_PLANNING_VERSION = 'director-planning-v4';
export const DEPARTMENT_REVISION_VERSION = 'director-planning-v5';
export const STORYBOARD_PLANNING_VERSION = 'director-planning-v6';
export const filmPlanningInstruction = instruction + ' Approved structured-brief decisions in context are binding creative constraints. Preserve their values; material conflicts require review rather than silently rewriting approved choices.';
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function bound(value) { if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail(409, 'Planning cost exceeds safe integer precision.'); return Number(value); }
export function buildPlanningRequest({ brief, refs = [], duration, model, maxOutputTokens, operation = 'initial_plan', context = {} } = {}) {
  if (typeof brief !== 'string' || !brief.trim() || brief.length > 20000) fail(400, 'Planning brief required (maximum 20000 characters).');
  if (!Array.isArray(refs) || refs.length > 12 || refs.some(ref => typeof ref !== 'string' || ref.length > 4000) || JSON.stringify(refs).length > 20000) fail(400, 'References must be bounded text descriptions; image tokens require a separate reviewed adapter.');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) fail(400, 'Planning duration must be between zero and 600 seconds.');
  if (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(model)) fail(400, 'An explicit trusted planning model is required.');
  if (!integer(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 100000) fail(400, 'An explicit bounded output-token limit is required.');
  const writing = ['write_script', 'revise_script'].includes(operation);
  const departments = ['plan_departments','revise_departments'].includes(operation),departmentRevision=operation==='revise_departments',storyboard=operation==='plan_storyboard';
  if (!['initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments','plan_storyboard'].includes(operation) || !plain(context) || JSON.stringify(context).length > (writing || departments || storyboard || context.songIntelligence ? 180000 : 30000)) fail(400, 'Invalid planning operation or bounded creative context; no source material was truncated.');
  if (operation === 'interpret_brief' && (typeof context.inputSignature !== 'string' || !context.inputSignature)) fail(400, 'Brief interpretation requires its saved input signature.');
  if (writing) {
    if (!plain(context.screenplay) || typeof context.screenplay.inputSignature !== 'string' || !context.screenplay.inputSignature || !Array.isArray(context.screenplay.sources)) fail(400, 'Screenplay writing requires a complete saved source context.');
    if (context.approved !== true || context.status !== 'approved') fail(409, 'Approve the current structured brief before screenplay writing.');
    if (operation === 'write_script' && context.screenplay.current) fail(409, 'An existing screenplay requires an explicit revision request.');
    if (operation === 'revise_script' && (!plain(context.screenplay.current) || typeof context.screenplay.revisionRequest?.instruction !== 'string' || !context.screenplay.revisionRequest.instruction.trim() || !Array.isArray(context.screenplay.revisionRequest.sceneIds))) fail(409, 'Screenplay revision requires an existing script and a saved explicit revision request.');
  }
  if (departments) validateDepartmentContext(context);
  const revision=departmentRevision?validateDepartmentRevisionContext(context):null;
  if(storyboard)validateStoryboardContext(context);
  const interpretation = operation === 'interpret_brief';
  const schema=structuredClone(interpretation ? briefProposalSchema : writing ? context.songIntelligence?.treatmentContract===MUSIC_TREATMENT_CONTRACT ? musicTreatmentSchema : screenplayProposalSchema : departmentRevision ? departmentRevisionProposalSchema : departments ? departmentProposalSchema : storyboard ? storyboardProposalSchema : planSchema);
  if(revision){schema.properties.departments.minItems=revision.selected.length;schema.properties.departments.maxItems=revision.selected.length;schema.properties.departments.items.properties.id.enum=[...revision.selected];}
  const body = { model, instructions: interpretation ? briefProposalInstruction : writing ? screenplayPlanningInstruction : departmentRevision ? departmentRevisionInstruction : departments ? departmentPlanningInstruction : storyboard ? storyboardPlanningInstruction : filmPlanningInstruction, input: JSON.stringify({ brief, references: refs, durationSeconds: duration, operation, context }), max_output_tokens: maxOutputTokens, background: true, store: true, text: { format: { type: 'json_schema', name: interpretation ? 'creative_brief_proposal' : writing ? 'screenplay_proposal' : departmentRevision ? 'department_revision_proposal' : departments ? 'department_proposal' : storyboard ? 'storyboard_handoff_proposal' : 'film_plan', strict: true, schema } } };
  if(context.songIntelligence)body.instructions+=' '+SONG_DIRECTOR_INSTRUCTION;
  if(context.songIntelligence?.treatmentContract===MUSIC_TREATMENT_CONTRACT)body.instructions+=' '+musicTreatmentInstruction;
  const version=storyboard?STORYBOARD_PLANNING_VERSION:departmentRevision?DEPARTMENT_REVISION_VERSION:departments?DEPARTMENT_PLANNING_VERSION:PLANNING_VERSION;
  return { version, model, operation, body, requestHash: hash({ version, body }) };
}
function requestValid(request) {
  if (!plain(request) || ![PLANNING_VERSION, DEPARTMENT_PLANNING_VERSION, DEPARTMENT_REVISION_VERSION, STORYBOARD_PLANNING_VERSION, 'director-planning-v2'].includes(request.version) || !plain(request.body) || request.model !== request.body.model || hash({ version: request.version, body: request.body }) !== request.requestHash) fail(409, 'Planning request hash or version changed.');
  let input;
  try { input = JSON.parse(request.body.input); } catch { fail(409, 'Planning input is invalid.'); }
  const rebuilt = buildPlanningRequest({ brief: input.brief, refs: input.references, duration: input.durationSeconds, model: request.model, maxOutputTokens: request.body.max_output_tokens, operation: input.operation, context: input.context });
  if (request.version === 'director-planning-v2' && !['initial_plan', 'revise_plan', 'interpret_brief'].includes(input.operation)) fail(409, 'This operation was not part of the saved planning version.');
  if ((input.operation==='plan_departments')!==(request.version===DEPARTMENT_PLANNING_VERSION)) fail(409, 'Department planning requires its separately reviewed saved request version.');
  if ((input.operation==='revise_departments')!==(request.version===DEPARTMENT_REVISION_VERSION)) fail(409, 'Targeted department revision requires its separately reviewed saved request version.');
  if ((input.operation==='plan_storyboard')!==(request.version===STORYBOARD_PLANNING_VERSION)) fail(409, 'Storyboard planning requires its separately reviewed saved request version.');
  if (request.operation !== input.operation || hash({ version: request.version, body: rebuilt.body }) !== request.requestHash) fail(409, 'Planning request differs from the reviewed request contract.');
}
function pricingValid(pricing, model, now) {
  if (!plain(pricing) || pricing.verified !== true || pricing.model !== model || typeof pricing.version !== 'string' || !pricing.version || pricing.currency !== 'USD' || !(Date.parse(pricing.expiresAt) > now)) fail(409, 'Fresh model-bound planning pricing required.');
  try { const url = new URL(pricing.sourceUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); } catch { fail(409, 'Official pricing evidence source required.'); }
  for (const name of ['input', 'cachedInput', 'output']) {
    const rate = pricing[name];
    if (!plain(rate) || !integer(rate.numeratorMicroUsd) || !integer(rate.denominatorTokens) || rate.denominatorTokens < 1) fail(409, 'Exact rational planning-token rates required.');
  }
  if (BigInt(pricing.cachedInput.numeratorMicroUsd) * BigInt(pricing.input.denominatorTokens) > BigInt(pricing.input.numeratorMicroUsd) * BigInt(pricing.cachedInput.denominatorTokens)) fail(409, 'Cached token rate exceeds the uncached upper-bound policy.');
}
export function calculatePlanningCost({ pricing, model, inputTokens, outputTokens, cachedInputTokens = 0, now = Date.now() } = {}) {
  const time = now instanceof Date ? now.getTime() : typeof now === 'string' ? Date.parse(now) : now;
  if (!Number.isFinite(time)) fail(400, 'Invalid pricing evaluation time.');
  pricingValid(pricing, model, time);
  if (![inputTokens, outputTokens, cachedInputTokens].every(integer) || cachedInputTokens > inputTokens) fail(409, 'Provider token usage is missing or invalid.');
  const quantities = { input: inputTokens - cachedInputTokens, cachedInput: cachedInputTokens, output: outputTokens };
  let total = 0n;
  const components = Object.entries(quantities).map(([kind, tokens]) => {
    const rate = pricing[kind]; const numerator = BigInt(tokens) * BigInt(rate.numeratorMicroUsd); const denominator = BigInt(rate.denominatorTokens);
    const cost = (numerator + denominator - 1n) / denominator; total += cost;
    return { kind, tokens, numeratorMicroUsd: numerator.toString(), denominatorTokens: denominator.toString(), costMicroUsd: bound(cost), rounding: 'ceil' };
  });
  return { totalMicroUsd: bound(total), components, pricingVersion: pricing.version, accounting: 'conservative_micro_usd_ceiling; reconcile provider billing separately' };
}
export function quotePlanningBound({ request, pricing, tokenEvidence, now = Date.now() } = {}) {
  requestValid(request);
  const time = now instanceof Date ? now.getTime() : typeof now === 'string' ? Date.parse(now) : now;
  if (!Number.isFinite(time)) fail(400, 'Invalid token evidence evaluation time.');
  if (!plain(tokenEvidence) || tokenEvidence.verified !== true || tokenEvidence.requestHash !== request.requestHash || tokenEvidence.model !== request.model || typeof tokenEvidence.tokenizerVersion !== 'string' || !tokenEvidence.tokenizerVersion.trim() || !integer(tokenEvidence.inputTokenUpperBound) || tokenEvidence.inputTokenUpperBound < 1) fail(409, 'Trusted tokenizer or input-token upper-bound evidence must bind the complete planning request.');
  let evidenceSource;
  try { evidenceSource = new URL(tokenEvidence.sourceUrl); } catch { fail(409, 'Token-bound evidence source required.'); }
  if (evidenceSource.protocol !== 'https:' || evidenceSource.username || evidenceSource.password || !(Date.parse(tokenEvidence.expiresAt) > time) || !['trusted-tokenizer-upper-bound', 'context-window-upper-bound'].includes(tokenEvidence.type)) fail(409, 'Fresh verified token-bound provenance is required.');
  if (tokenEvidence.type === 'context-window-upper-bound' && (!integer(tokenEvidence.contextWindowTokens) || tokenEvidence.contextWindowTokens < 1 || tokenEvidence.inputTokenUpperBound !== tokenEvidence.contextWindowTokens)) fail(409, 'Context-window evidence must reserve the complete verified context bound.');
  const cost = calculatePlanningCost({ pricing, model: request.model, inputTokens: tokenEvidence.inputTokenUpperBound, outputTokens: request.body.max_output_tokens, now });
  return { ...cost, quoteKind: 'maximum_reservation_not_expected_cost', requestHash: request.requestHash, inputTokenUpperBound: tokenEvidence.inputTokenUpperBound, outputTokenUpperBound: request.body.max_output_tokens };
}
export function validatePlanningResult(plan, request) {
  requestValid(request);
  const savedInput = JSON.parse(request.body.input);
  if (savedInput.operation === 'interpret_brief') return validateBriefProposal(plan, { inputSignature: savedInput.context.inputSignature, sources: [savedInput.brief,savedInput.references,savedInput.context] });
  if (['write_script', 'revise_script'].includes(savedInput.operation)) return validateScreenplayProposal(plan, { context: savedInput.context, operation: savedInput.operation });
  if (savedInput.operation === 'plan_departments') return validateDepartmentProposal(plan, { context: savedInput.context });
  if (savedInput.operation === 'revise_departments') return validateDepartmentRevisionProposal(plan, { context: savedInput.context });
  if (savedInput.operation === 'plan_storyboard') return validateStoryboardProposal(plan, {context:savedInput.context});
  validateFilmPlan(plan);
  const expected = savedInput.durationSeconds;
  const sceneIds = plan.scenes.map(scene => scene.id);
  const shotIds = plan.shots.map(shot => shot.id);
  if (sceneIds.some(id => typeof id !== 'string' || !id.trim()) || shotIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(sceneIds).size !== sceneIds.length || new Set(shotIds).size !== shotIds.length) fail(409, 'Planning result scene and shot identities must be unique and nonempty.');
  if (plan.shots.some(shot => !sceneIds.includes(shot.sceneId) || !Number.isFinite(shot.durationSeconds) || shot.durationSeconds <= 0 || shot.durationSeconds > 15 || !shot.description.trim())) fail(409, 'Planning result contains invalid scene membership, direction or shot duration.');
  const total = plan.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  if (!Number.isFinite(total) || Math.abs(total - expected) > 0.05) fail(409, 'Planning result duration must match the authorized request.');
  return plan;
}
function validateSnapshotPlan(snapshot, request) {
  if (snapshot.parsedOutput !== undefined) {
    try {
      if (request) {
        const operation = JSON.parse(request.body.input).operation;
        const validated = validatePlanningResult(snapshot.parsedOutput, request);
        snapshot[operation === 'interpret_brief' ? 'briefProposal' : ['write_script', 'revise_script'].includes(operation) ? 'screenplay' : ['plan_departments','revise_departments'].includes(operation) ? 'departments' : operation==='plan_storyboard' ? 'storyboard' : 'plan'] = validated;
      } else snapshot.plan = validateFilmPlan(snapshot.parsedOutput);
    } catch { snapshot.planError = 'Creative result failed the saved request contract; retain response identity and usage for reconciliation.'; }
    delete snapshot.parsedOutput;
  }
  return snapshot;
}
function identity(responseId) { if (typeof responseId !== 'string' || !/^resp_[A-Za-z0-9_-]{1,180}$/.test(responseId)) fail(400, 'Invalid planning response identity.'); return responseId; }
function snapshot(response) {
  identity(response?.id);
  const knownStatus = ['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'incomplete'].includes(response.status);
  const result = { id: response.id, status: knownStatus ? response.status : 'unknown', usage: null };
  if (!knownStatus) result.normalizationError = 'Unrecognized provider status; retain identity and spending hold for inspection.';
  if (response.usage) {
    const cached = response.usage.input_tokens_details?.cached_tokens;
    if (![response.usage.input_tokens, response.usage.output_tokens, cached].every(integer) || cached > response.usage.input_tokens) result.usageError = 'Provider usage evidence is incomplete or invalid; retain the spending hold for reconciliation.';
    else result.usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cachedInputTokens: cached };
  }
  if (response.status === 'completed') {
    try {
      if (!Array.isArray(response.output) || response.output.some(item => !plain(item) || ('content' in item && !Array.isArray(item.content)))) throw new Error('Malformed output');
      const content = response.output.flatMap(item => item.content || []);
      if (content.some(item => !plain(item))) throw new Error('Malformed output content');
      const text = content.filter(item => item.type === 'output_text').map(item => { if (typeof item.text !== 'string') throw new Error('Malformed output text'); return item.text; }).join('');
      result.parsedOutput = JSON.parse(text);
    } catch (error) {
      if (error.message.startsWith('Malformed output')) result.status = 'unknown';
      result.planError = 'Completed planning response contains no valid film plan; retain response identity and usage for reconciliation.';
      result.normalizationError = 'Planning output could not be normalized; response identity and accounting evidence retained.';
    }
  }
  if (response.error) result.error = { code: String(response.error.code || 'provider_failure').slice(0,100), message: 'Planning provider reported an execution failure.' };
  return result;
}
export function createPlanningProvider({ fetcher = globalThis.fetch, env = process.env } = {}) {
  async function request(url, options) {
    if (!env.OPENAI_API_KEY) fail(503, 'OPENAI_API_KEY is not configured.');
    const response = await fetcher(url, { ...options, headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) fail(502, 'Planning provider request failed; reconcile existing work before any resubmission.');
    return snapshot(await response.json());
  }
  return {
    async submit({ request: savedRequest, authorized = false } = {}) {
      if (authorized !== true) fail(409, 'Explicit server-side planning authorization required.');
      requestValid(savedRequest);
      return validateSnapshotPlan(await request('https://api.openai.com/v1/responses', { method: 'POST', body: JSON.stringify(savedRequest.body) }), savedRequest);
    },
    async poll({ responseId, request: savedRequest } = {}) {
      if (savedRequest) requestValid(savedRequest);
      return validateSnapshotPlan(await request(`https://api.openai.com/v1/responses/${identity(responseId)}`, { method: 'GET' }), savedRequest);
    },
  };
}

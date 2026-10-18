import {validateTariff} from './tariffs.mjs';
import { validateRoutingIntent, evaluateRoutingIntent } from './routing-intent.mjs';
// Deterministic registry filtering only. Eligibility is not permission to spend.
const requirementKeys = new Set(['modality', 'inputModes', 'aspectRatio', 'resolution', 'durationSeconds', 'language', 'identityReferences', 'lipSync']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const strings = value => Array.isArray(value) && value.length <= 50 && value.every(nonempty) && new Set(value).size === value.length;
const safePositive = value => Number.isSafeInteger(value) && value > 0;
function https(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function timestamp(value) { return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)); }
function requirementsValid(requirements) {
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) invalid('Requirements must be an object.');
  for (const key of Object.keys(requirements)) if (!requirementKeys.has(key)) invalid(`Unknown routing requirement: ${key}`);
  for (const key of ['modality', 'aspectRatio', 'resolution', 'language']) if (key in requirements && !nonempty(requirements[key])) invalid(`Invalid requirement: ${key}`);
  if ('inputModes' in requirements && !strings(requirements.inputModes)) invalid('Invalid inputModes requirement.');
  if ('durationSeconds' in requirements && (!Number.isFinite(requirements.durationSeconds) || requirements.durationSeconds <= 0)) invalid('Invalid durationSeconds requirement.');
  for (const key of ['identityReferences', 'lipSync']) if (key in requirements && typeof requirements[key] !== 'boolean') invalid(`Invalid requirement: ${key}`);
}
function configurationValid(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const entries = Object.entries(value);
  return entries.length <= 30 && entries.every(([key, item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) && ((typeof item === 'string' && item.length <= 200) || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)) || item === null));
}
function priceHolds(model, now) {
  const price = model.price_evidence;
  if (!price || price.verified !== true) return ['price_not_verified'];
  const holds = [];
  if (price.configurationVerified !== true || !configurationValid(price.configuration)) holds.push('price_configuration_unverified');
  if (!nonempty(price.version) || !nonempty(model.price_version) || price.version !== model.price_version) holds.push('price_version_mismatch');
  if (price.currency !== 'USD') holds.push('price_configuration_invalid');
  if (Object.hasOwn(price, 'tariff')) {
    try { validateTariff(price.tariff); if (price.tariff.version !== price.version) holds.push('tariff_version_mismatch'); if (price.tariff.components.some(c => ['reference_token', 'output_token'].includes(c.unit))) holds.push('tariff_usage_bound_required'); }
    catch { holds.push('tariff_configuration_invalid'); }
  } else if (!['second', 'image', 'character', 'request'].includes(price.unit) || !safePositive(price.unitMicroUsd) || price.rounding !== 'ceil' || ('minimumUnits' in price && !safePositive(price.minimumUnits))) holds.push('price_configuration_invalid');
  if (!https(price.sourceUrl)) holds.push('price_source_invalid');
  if (!timestamp(price.expiresAt) || Date.parse(price.expiresAt) <= now) holds.push('price_expired_or_missing');
  return holds;
}
export function selectRoutes({ task, requirements = {}, models, intent, now = new Date() } = {}) {
  if (!nonempty(task)) invalid('Explicit task required.');
  requirementsValid(requirements);
  validateRoutingIntent(intent);
  if (!Array.isArray(models) || models.length > 10000) invalid('Models must be a server registry array.');
  const time = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : timestamp(now) ? Date.parse(now) : NaN;
  if (!Number.isFinite(time)) invalid('Invalid routing time.');
  const seen = new Set();
  const candidates = models.map(model => {
    if (!model || typeof model !== 'object' || !nonempty(model.id) || !nonempty(model.provider) || !nonempty(model.endpoint) || seen.has(model.id)) invalid('Registry model identity invalid or duplicated.');
    seen.add(model.id);
    const holds = [];
    if (!nonempty(model.model_version ?? model.version)) holds.push('model_version_missing');
    const cap = model.capabilities;
    const capabilities = cap && typeof cap === 'object' && !Array.isArray(cap) ? cap : {};
    const priority = capabilities.priority ?? 0;
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) holds.push('priority_invalid');
    for (const key of ['active', 'execution_tested', 'quality_validated']) if (model[key] !== true) holds.push(`${key}_required`);
    if (!strings(capabilities.tasks) || !capabilities.tasks.includes(task)) holds.push('task_not_declared');
    const schema = model.schema_evidence;
    if (!schema || schema.verified !== true || !nonempty(schema.version) || !https(schema.sourceUrl) || !/^[a-f0-9]{64}$/.test(schema.inputSchemaHash || '')) holds.push('schema_evidence_unverified');
    if (!schema || !timestamp(schema.expiresAt) || Date.parse(schema.expiresAt) <= time) holds.push('schema_expired_or_missing');
    if (!schema || schema.endpoint !== model.endpoint || !nonempty(schema.modelVersion) || schema.modelVersion !== (model.model_version ?? model.version)) holds.push('schema_model_binding_mismatch');
    holds.push(...priceHolds(model, time));
    for (const [requirement, capability] of [['modality', 'outputModalities'], ['aspectRatio', 'aspectRatios'], ['resolution', 'resolutions'], ['language', 'languages']]) {
      if (requirement in requirements && (!strings(capabilities[capability]) || !capabilities[capability].includes(requirements[requirement]))) holds.push(`${requirement}_unsupported`);
    }
    if ('inputModes' in requirements && (!strings(capabilities.inputModes) || requirements.inputModes.some(mode => !capabilities.inputModes.includes(mode)))) holds.push('inputModes_unsupported');
    if ('durationSeconds' in requirements) {
      const minimum = capabilities.minDurationSeconds;
      const maximum = capabilities.maxDurationSeconds;
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum < minimum || requirements.durationSeconds < minimum || requirements.durationSeconds > maximum) holds.push('durationSeconds_unsupported');
    }
    for (const key of ['identityReferences', 'lipSync']) if (requirements[key] === true && capabilities[key] !== true) holds.push(`${key}_unsupported`);
    const fit = evaluateRoutingIntent({ intent, model, task, now: time });
    holds.push(...fit.holds);
    return { ...(intent === undefined ? {} : { intentFit: fit }), modelId: model.id, provider: model.provider, endpoint: model.endpoint, priority: Number.isInteger(priority) && priority >= 0 && priority <= 1000 ? priority : 0, eligibleForQuote: holds.length === 0, holds };
  });
  candidates.sort((a, b) => Number(b.eligibleForQuote) - Number(a.eligibleForQuote) || (b.intentFit?.score ?? 0) - (a.intentFit?.score ?? 0) || b.priority - a.priority || (a.modelId < b.modelId ? -1 : a.modelId > b.modelId ? 1 : 0));
  return { task, candidates, eligibleForQuote: candidates.filter(candidate => candidate.eligibleForQuote).map(candidate => candidate.modelId) };
}

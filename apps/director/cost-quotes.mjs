import {hash, artifacts, fail} from './domain.mjs';
import {calculateTariff} from './tariffs.mjs';
import {selectRoutes} from './model-router.mjs';
import {recordArtifacts} from './production-records.mjs';

const MAX_UNITS = 1_000_000;
const forbidden = new Set(['cost','price','budget','authorization','authorized','generationauthorized','estimate','quote','quoteid','approved','accepted','approval','spend','billing','currency','unitmicrousd','totalmicrousd','priceevidence','priceversion','expectedversion','ownerid','projectid','inputprice','clientbudget','generationauthorization','maxcost','estimatedcost','estimatedcostmicrousd','amountmicrousd','reservedmicrousd','pricing','canexpense','canauthorize','authorizationid','budgetusd','budgetmicrousd','costusd','costmicrousd','priceusd','pricemicrousd','usageevidence','usagebound','usagebounds','tokenusage','actualtokens']);
const positive = value => Number.isSafeInteger(value) && value > 0;
const identifier = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const evidenceVersion = value => identifier(value) || positive(value);
function isoTime(value) {
  if (typeof value !== 'string') return NaN;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!parts) return NaN;
  const [,year,month,day,hour,minute,second] = parts.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year,month,0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return NaN;
  return Date.parse(value);
}
function httpsSource(value) {
  try { const source = new URL(value); return source.protocol === 'https:' && !source.username && !source.password; } catch { return false; }
}
function validatePayload(value, depth = 0, count = {nodes: 0}) {
  if (depth > 12 || ++count.nodes > 20_000) fail(400, 'Quote input is too large or deeply nested.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 2_000_000) fail(400, 'Quote input text is too long.'); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(400, 'Quote input numbers must be finite.'); return; }
  if (Array.isArray(value)) { value.forEach(item => validatePayload(item, depth + 1, count)); return; }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (forbidden.has(key.replace(/[_\s-]/g, '').toLowerCase())) fail(400, 'Model input cannot set price, budget, approval or authorization.');
      validatePayload(item, depth + 1, count);
    }
    return;
  }
  fail(400, 'Quote input must contain ordinary JSON values.');
}

// This is a trusted-server estimate, never a reservation, charge or generation permission.
export function createCostQuote({project, artifactId, artifactVersion, model, task, requirements, intent, input, now, ttlMs = 300_000}) {
  const time = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : typeof now === 'string' ? isoTime(now) : NaN;
  if (!Number.isFinite(time) || !positive(ttlMs) || ttlMs > 3_600_000 || !Number.isSafeInteger(time + ttlMs)) fail(400, 'A valid quote time and bounded lifetime are required.');
  if (!project || !identifier(project.id) || !positive(project.version) || !identifier(artifactId) || !positive(artifactVersion)) fail(400, 'A project and exact artifact version are required.');
  const artifact = [...artifacts(project), ...recordArtifacts(project)].find(a => a.logical_key === artifactId && a.version === artifactVersion);
  if (!artifact) fail(409, 'The requested artifact version is no longer current.');
  if (!requirements || Array.isArray(requirements) || Object.getPrototypeOf(requirements) !== Object.prototype) fail(400, 'Explicit routing requirements are required.');
  const route = selectRoutes({task, requirements, intent, models: [model], now: time}).candidates[0];
  if (!route?.eligibleForQuote) fail(409, 'The selected model does not meet the task and routing requirements.');
  const intentEvidence = route.intentFit?.attestation;
  const intentExpiry = intentEvidence ? isoTime(intentEvidence.expiresAt) : Infinity;
  if (intentEvidence && (!Number.isFinite(intentExpiry) || intentExpiry <= time)) fail(409, 'Routing preference evidence is expired or invalid.');
  const schema = model?.schema_evidence;
  const modelVersion = model?.model_version ?? model?.version;
  if (model?.active !== true || model.execution_tested !== true || model.quality_validated !== true || !identifier(model.id) || !identifier(model.endpoint) || !evidenceVersion(modelVersion) || schema?.verified !== true || !evidenceVersion(schema.version) || !httpsSource(schema.sourceUrl)) fail(409, 'The model route requires current execution, quality and schema evidence.');
  const schemaExpiry = isoTime(schema.expiresAt);
  if (schema.endpoint !== model.endpoint || schema.modelVersion !== modelVersion || typeof schema.inputSchemaHash !== 'string' || !/^[a-f0-9]{64}$/i.test(schema.inputSchemaHash) || !Number.isFinite(schemaExpiry) || schemaExpiry <= time) fail(409, 'Schema evidence must bind the current endpoint, model version and input schema with a valid expiry.');
  const price = model.price_evidence;
  if (price?.verified !== true || !evidenceVersion(price.version) || price.version !== model.price_version || price.currency !== 'USD' || (!price.tariff && (!['second','image','character','request'].includes(price.unit) || !positive(price.unitMicroUsd) || price.rounding !== 'ceil'))) fail(409, 'Verified matching USD pricing evidence is required.');
  if (!httpsSource(price.sourceUrl)) fail(409, 'Pricing evidence requires an HTTPS source.');
  const priceExpiry = isoTime(price.expiresAt);
  if (!Number.isFinite(priceExpiry) || priceExpiry <= time) fail(409, 'Pricing evidence has expired or has no valid expiry.');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail(400, 'Ordinary model input is required.');
  validatePayload(input);
  const configuration = price.configuration;
  if (price.configurationVerified !== true || !configuration || Array.isArray(configuration) || Object.getPrototypeOf(configuration) !== Object.prototype || Object.keys(configuration).length > 30) fail(409, 'Verified price configuration is required.');
  for (const [key, value] of Object.entries(configuration)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(key) || !(value === null || typeof value === 'boolean' || typeof value === 'string' && value.length <= 500 || typeof value === 'number' && Number.isFinite(value))) fail(409, 'Price configuration must contain bounded scalar values.');
    if (!Object.hasOwn(input, key) || hash(input[key]) !== hash(value)) fail(409, 'Model input does not match the verified price configuration.');
  }
  let calculation;
  if (price.tariff) {
    const result = calculateTariff({price, input, now: time});
    if (!positive(result.totalMicroUsd)) fail(409, 'A positive bounded generation estimate is required.');
    calculation = {unit: 'composite', totalMicroUsd: result.totalMicroUsd, components: result.components, priceEvidence: structuredClone(price)};
  } else {
    let units;
    if (price.unit === 'second') {
      if (typeof input.duration !== 'number' || !Number.isFinite(input.duration) || input.duration <= 0) fail(400, 'A positive explicit duration is required for second pricing.');
      units = Math.ceil(input.duration);
    } else if (price.unit === 'image') {
      if (!positive(input.num_images)) fail(400, 'An explicit positive image count is required.');
      units = input.num_images;
    } else if (price.unit === 'character') {
      if (typeof input.text !== 'string' || !input.text.length) fail(400, 'Explicit nonempty text is required for character pricing.');
      units = Array.from(input.text).length;
    } else units = 1;
    const minimum = price.minimumUnits === undefined ? 1 : price.minimumUnits;
    if (!positive(minimum) || minimum > MAX_UNITS || !positive(units) || units > MAX_UNITS) fail(400, 'Billable units exceed the supported positive count limit.');
    units = Math.max(units, minimum);
    const totalMicroUsd = units * price.unitMicroUsd;
    if (!positive(totalMicroUsd)) fail(400, 'The quote total exceeds safe integer USD micro-units.');
    calculation = {unit: price.unit, units, unitMicroUsd: price.unitMicroUsd, totalMicroUsd,
      priceEvidence: {verified: true, configurationVerified: true, configuration: structuredClone(configuration), version: price.version, currency: 'USD', unit: price.unit, unitMicroUsd: price.unitMicroUsd, minimumUnits: minimum, rounding: 'ceil', expiresAt: price.expiresAt, sourceUrl: price.sourceUrl}};
  }
  const quote = {
    projectId: project.id, projectVersion: project.version, ...(intentEvidence ? {intentEvidence: structuredClone(intentEvidence)} : {}), task, ...(intent === undefined ? {} : {intent: structuredClone(intent)}), requirements: structuredClone(requirements), artifactId, artifactVersion, artifactContentHash: artifact.content_hash,
    payloadHash: hash(input), modelId: model.id, endpoint: model.endpoint, modelVersion,
    schemaVersion: schema.version, schemaEvidence: {verified: true, version: schema.version, sourceUrl: schema.sourceUrl, endpoint: schema.endpoint, modelVersion: schema.modelVersion, inputSchemaHash: schema.inputSchemaHash, expiresAt: schema.expiresAt}, priceVersion: price.version, currency: 'USD', priceConfiguration: structuredClone(configuration), ...calculation,
    createdAt: new Date(time).toISOString(), expiresAt: new Date(Math.min(time + ttlMs, priceExpiry, schemaExpiry, intentExpiry)).toISOString(),
    generationAuthorized: false, estimateOnly: true
  };
  return {id: hash(quote), ...quote};
}

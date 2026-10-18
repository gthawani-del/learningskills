import {hash} from './domain.mjs';
// Brief preferences are supplied explicitly; no demographic or price-tier inference.
const dimensions = { purpose: 'purposes', style: 'styles', stage: 'stages', audience: 'audiences', platform: 'platforms', emotionalEffect: 'emotionalEffects', creativeControl: 'creativeControls' };
const allowed = new Set([...Object.keys(dimensions), 'qualityGoals', 'deadlineMs', 'budgetMicroUsd']);
const label = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 200;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const validDate = x => typeof x === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x) && Number.isFinite(Date.parse(x));
const score = x => Number.isInteger(x) && x >= 0 && x <= 100;
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function source(value) { try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; } catch { return false; } }
export function validateRoutingIntent(intent) {
  if (intent === undefined) return undefined;
  if (!object(intent)) invalid('Routing intent must be an explicit preference object.');
  for (const key of Object.keys(intent)) if (!allowed.has(key)) invalid(`Unknown routing intent: ${key}`);
  for (const key of Object.keys(dimensions)) if (key in intent && !label(intent[key])) invalid(`Invalid intent ${key}.`);
  for (const key of ['deadlineMs', 'budgetMicroUsd']) if (key in intent && (!Number.isSafeInteger(intent[key]) || intent[key] <= 0)) invalid(`Invalid intent ${key}.`);
  if ('qualityGoals' in intent) {
    if (!Array.isArray(intent.qualityGoals) || intent.qualityGoals.length > 20) invalid('Invalid qualityGoals.');
    const seen = new Set();
    for (const goal of intent.qualityGoals) {
      if (!object(goal) || Object.keys(goal).some(k => !['goal', 'weight', 'minimumScore'].includes(k)) || !label(goal.goal) || seen.has(goal.goal) || !Number.isInteger(goal.weight) || goal.weight < 1 || goal.weight > 10 || ('minimumScore' in goal && !score(goal.minimumScore))) invalid('Quality goals need unique names, weights 1–10 and optional score limits 0–100.');
      seen.add(goal.goal);
    }
  }
  return intent;
}
function freshProfile(profile, model, task, now) {
  return object(profile) && profile.verified === true && profile.task === task && profile.modelId === model.id && profile.endpoint === model.endpoint && profile.modelVersion === (model.model_version ?? model.version) && label(profile.evidenceVersion) && source(profile.sourceUrl) && validDate(profile.expiresAt) && Date.parse(profile.expiresAt) > now && validDate(profile.evaluatedAt) && Date.parse(profile.evaluatedAt) <= now && Date.parse(profile.evaluatedAt) < Date.parse(profile.expiresAt) && Number.isSafeInteger(profile.sampleCount) && profile.sampleCount > 0;
}
export function evaluateRoutingIntent({ intent, model, task, now }) {
  validateRoutingIntent(intent);
  if (!intent || Object.keys(intent).length === 0 || (Object.keys(intent).length === 1 && Array.isArray(intent.qualityGoals) && intent.qualityGoals.length === 0)) return { holds: [], score: 0, explanation: ['No job-specific preferences supplied; existing capability checks and registry priority apply.'], tradeoffs: [], evidenceVersion: null };
  const profiles = Array.isArray(model.routing_profiles) ? model.routing_profiles : [];
  const fresh = profiles.filter(profile => freshProfile(profile, model, task, now));
  const matches = fresh.filter(profile => Object.entries(dimensions).every(([key, collection]) => !(key in intent) || (Array.isArray(profile[collection]) && profile[collection].every(label) && profile[collection].includes(intent[key]))));
  if (!matches.length) return { holds: ['intent_evidence_missing_or_mismatched'], score: 0, explanation: ['No fresh, model-bound task evaluation covers all explicitly requested job preferences.'], tradeoffs: [], evidenceVersion: null };
  const evaluated = matches.map(profile => {
    const holds = [];
    const explanation = [];
    const tradeoffs = [];
    let sum = 0; let weights = 0;
    for (const goal of intent.qualityGoals || []) {
      const value = object(profile.scores) && Object.hasOwn(profile.scores, goal.goal) ? profile.scores[goal.goal] : undefined;
      if (!score(value)) { holds.push(`intent_goal_unmeasured:${goal.goal}`); continue; }
      if (goal.minimumScore !== undefined && value < goal.minimumScore) holds.push(`intent_goal_below_minimum:${goal.goal}`);
      sum += value * goal.weight; weights += goal.weight;
      explanation.push(`${goal.goal}: evaluated ${value}/100, user weight ${goal.weight}; evidence ${profile.evidenceVersion}, ${profile.sampleCount} samples.`);
      if (value < 100) tradeoffs.push(`${goal.goal} retains measured limitations (${value}/100); this is evaluation evidence, not a guaranteed result.`);
    }
    for (const [key] of Object.entries(dimensions)) if (key in intent) explanation.push(`${key}: ${intent[key]} is explicitly covered by the task evaluation.`);
    if ('deadlineMs' in intent) {
      if (!Number.isSafeInteger(profile.latencyMs) || profile.latencyMs <= 0) holds.push('intent_latency_unmeasured');
      else {
        if (profile.latencyMs > intent.deadlineMs) holds.push('intent_deadline_exceeded');
        explanation.push(`Evaluated workflow latency ${profile.latencyMs} ms versus requested ${intent.deadlineMs} ms; live queue time is not guaranteed.`);
      }
    }
    if ('budgetMicroUsd' in intent) {
      // Per-unit rates cannot prove an entire workflow fits its budget. The quote
      // service must supply a complete, configuration-bound cost assessment.
      holds.push('intent_workflow_budget_unverified');
      explanation.push(`Budget ${intent.budgetMicroUsd} micro USD requires a complete workflow quote; no cheapest-route assumption is made.`);
    }
    return { holds, score: weights ? Math.round(sum * 1000 / weights) / 1000 : 0, explanation, tradeoffs, evidenceVersion: profile.evidenceVersion, attestation: {evidenceVersion: profile.evidenceVersion, evidenceHash: hash(profile), expiresAt: profile.expiresAt, evaluatedAt: profile.evaluatedAt} };
  });
  evaluated.sort((a, b) => Number(a.holds.length > 0) - Number(b.holds.length > 0) || b.score - a.score || (a.evidenceVersion < b.evidenceVersion ? -1 : a.evidenceVersion > b.evidenceVersion ? 1 : 0));
  return evaluated[0];
}

import {randomUUID} from 'node:crypto';
import {hash, fail} from './domain.mjs';
import {selectRoutes} from './model-router.mjs';
import {createCostQuote} from './cost-quotes.mjs';
import {departmentPlanningContext} from './public/department-plan-core.js';
import {storyboardHandoffContext} from './public/storyboard-handoff-core.js';
import {referenceProductionContext} from './public/reference-production-core.js';
import {storyboardProductionContext} from './public/storyboard-production-core.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const positive = n => Number.isSafeInteger(n) && n > 0;
function context(state, command, operation, allowed) {
 if (!command || typeof command !== 'object' || Array.isArray(command) || Object.keys(command).some(k => !allowed.includes(k))) fail(400, 'Unsupported spending operation fields.');
 if (!uuid.test(command.requestId || '') || typeof command.actorId !== 'string' || !command.actorId || !positive(command.expectedVersion)) fail(400, 'An actor, request UUID and exact project version are required.');
 const project = state.projects?.find(p => p.id === command.projectId);
 if (!project || project.ownerId !== command.actorId) fail(404, 'Project not found.');
 const fingerprint = hash({operation, ...command});
 const previous = (state.spendingCommands || []).find(c => c.requestId === command.requestId);
 if (previous && (previous.fingerprint !== fingerprint || previous.actorId !== command.actorId)) fail(409, 'This request ID was used for a different command.');
 return {project, fingerprint, previous};
}
function current(project, expectedVersion) { if (project.version !== expectedVersion) fail(409, 'The project changed. Refresh before authorizing generation costs.'); }
function timestamp(now) {
 const n = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : typeof now === 'string' ? Date.parse(now) : NaN;
 if (!Number.isSafeInteger(n) || Math.abs(n) > 8_640_000_000_000_000) fail(400, 'A valid operation time is required.');
 return n;
}
function checkQuote(project, quote, input, model, now) {
 const time = timestamp(now), created = Date.parse(quote?.createdAt), expiry = Date.parse(quote?.expiresAt);
 if (!quote || quote.projectId !== project.id || quote.projectVersion !== project.version || !Number.isFinite(created) || !Number.isFinite(expiry) || created > time || expiry <= time) fail(409, 'The quote is unavailable, expired or belongs to another project.');
 const selected = selectRoutes({task: quote.task, requirements: quote.requirements, intent: quote.intent, models: [model], now: time}).candidates[0];
 if (!selected?.eligibleForQuote) fail(409, 'The quote route no longer meets current task or preference evidence.');
 const rebuilt = createCostQuote({project, artifactId: quote.artifactId, artifactVersion: quote.artifactVersion, model, task: quote.task, requirements: quote.requirements, intent: quote.intent, input, now: created, ttlMs: expiry - created});
 if (hash(rebuilt) !== hash(quote)) fail(409, 'The quote no longer matches its artifact, payload, model, schema or price evidence.');
 return time;
}
function quoteView(record) {
 const q = record.quote;
 return {id: record.id, projectId: q.projectId, projectVersion: q.projectVersion, ...(q.intentEvidence ? {intentEvidence: structuredClone(q.intentEvidence)} : {}), artifactId: q.artifactId, artifactVersion: q.artifactVersion, modelId: q.modelId, endpoint: q.endpoint, task: q.task, ...(q.intent === undefined ? {} : {intent: structuredClone(q.intent)}), requirements: structuredClone(q.requirements), currency: 'USD', totalMicroUsd: q.totalMicroUsd, createdAt: q.createdAt, expiresAt: q.expiresAt, estimateOnly: true, generationAuthorized: false};
}
function remember(state, command, operation, fingerprint, result) {
 const snapshot = structuredClone(result);
 (state.spendingCommands ||= []).push({requestId: command.requestId, actorId: command.actorId, projectId: command.projectId, operation, fingerprint, result: snapshot});
 return structuredClone(snapshot);
}

// Callers must serialize transitions and durably commit the resulting state atomically.
// Returned values omit stored provider input and internal pricing evidence.
export function persistQuote(state, command, {model, now}) {
 const operation = 'persist_quote';
 const {project, fingerprint, previous} = context(state, command, operation, ['actorId','projectId','requestId','expectedVersion','quote','input']);
 if (previous) return structuredClone(previous.result);
 current(project, command.expectedVersion);
 checkQuote(project, command.quote, command.input, model, now);
 let record = (state.quotes || []).find(q => q.id === command.quote.id);
 if (record && (record.actorId !== command.actorId || hash(record.quote) !== hash(command.quote) || hash(record.input) !== hash(command.input))) fail(409, 'Conflicting persisted quote.');
 if (!record) {
  record = {id: command.quote.id, projectId: project.id, actorId: command.actorId, quote: structuredClone(command.quote), input: structuredClone(command.input)};
  (state.quotes ||= []).push(record);
 }
 return remember(state, command, operation, fingerprint, quoteView(record));
}

export function authorizeSpending(state, command, {model, now}) {
 const operation = 'authorize_spending';
 const {project, fingerprint, previous} = context(state, command, operation, ['actorId','projectId','requestId','expectedVersion','quoteId','maxMicroUsd','finishReserveMicroUsd']);
 if (previous) return structuredClone(previous.result);
 current(project, command.expectedVersion);
 const record = (state.quotes || []).find(q => q.id === command.quoteId && q.projectId === project.id && q.actorId === command.actorId);
 if (!record) fail(404, 'Persisted quote not found.');
 if(project.departmentPlanning&&departmentPlanningContext(project,(state.approvals||[]).filter(a=>a.projectId===project.id)).departments.some(unit=>!unit.approved))fail(409,'Review the current department plans before authorizing media production. Planning approval does not approve generated assets.');
 const reference=record.quote.artifactId?.startsWith('reference_brief:')&&['reference_image','reference_look'].includes(record.quote.task);
 if(record.quote.artifactId?.startsWith('storyboard_brief:')){const frame=storyboardProductionContext(project,(state.approvals||[]).filter(a=>a.projectId===project.id),{assets:state.assets||[],referenceCandidates:state.referenceCandidates||[],candidates:state.storyboardCandidates||[]}).shots.find(s=>'storyboard_brief:'+s.shotId===record.quote.artifactId);if(record.quote.task!=='storyboard_frame'||!frame?.directionApproved||frame.sourceStale||frame.referenceStale)fail(409,'Review the current storyboard frame direction, shot plan and exact reference selections before authorizing generation.');}
 if(reference){const subject=referenceProductionContext(project,(state.approvals||[]).filter(a=>a.projectId===project.id),{assets:state.assets||[],candidates:state.referenceCandidates||[]}).subjects.find(s=>'reference_brief:'+s.id===record.quote.artifactId);if(!subject?.directionApproved||subject.sourceStale||subject.identityStale)fail(409,'Review the current reference direction and approved identity before authorizing this image.');}
 if(!reference&&project.storyboardHandoff&&!storyboardHandoffContext(project,(state.approvals||[]).filter(a=>a.projectId===project.id)).planningApproved)fail(409,'Review the current shot contracts and sequence before authorizing media production. This approval does not approve generated frames, voices or footage.');
 const time = checkQuote(project, record.quote, record.input, model, now);
 const finish = command.finishReserveMicroUsd;
 if (!positive(command.maxMicroUsd) || !Number.isSafeInteger(finish) || finish < 0 || finish > command.maxMicroUsd || !Number.isSafeInteger(record.quote.totalMicroUsd + finish) || command.maxMicroUsd < record.quote.totalMicroUsd + finish) fail(400, 'The generation cost cap must cover the quote and finish reserve in integer USD micro-units.');
 const q = record.quote;
 const authorization = {id: randomUUID(), projectId: project.id, actorId: command.actorId, quoteId: q.id, quoteHash: hash(q), artifactId: q.artifactId, artifactVersion: q.artifactVersion, artifactContentHash: q.artifactContentHash, payloadHash: q.payloadHash, modelId: q.modelId, endpoint: q.endpoint, modelVersion: q.modelVersion, schemaVersion: q.schemaVersion, priceVersion: q.priceVersion, currency: 'USD', maxMicroUsd: command.maxMicroUsd, finishReserveMicroUsd: finish, quotedMicroUsd: q.totalMicroUsd, status: 'authorized', createdAt: new Date(time).toISOString(), expiresAt: q.expiresAt, generationAuthorized: false, reservationCreated: false};
 (state.spendingAuthorizations ||= []).push(authorization);
 return remember(state, command, operation, fingerprint, authorization);
}

export function revokeSpending(state, command, now) {
 const operation = 'revoke_spending';
 const {project, fingerprint, previous} = context(state, command, operation, ['actorId','projectId','requestId','expectedVersion','authorizationId','reason']);
 if (previous) return structuredClone(previous.result);
 current(project, command.expectedVersion);
 const time = timestamp(now);
 if (typeof command.reason !== 'string' || command.reason.trim().length < 5 || command.reason.length > 1000) fail(400, 'A bounded revocation reason is required.');
 const authorization = (state.spendingAuthorizations || []).find(a => a.id === command.authorizationId && a.projectId === project.id && a.actorId === command.actorId);
 if (!authorization) fail(404, 'Generation cost authorization not found.');
 if (authorization.status !== 'revoked') Object.assign(authorization, {status: 'revoked', revokedAt: new Date(time).toISOString(), revocationReason: command.reason.trim()});
 return remember(state, command, operation, fingerprint, authorization);
}

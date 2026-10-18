import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobController } from '../jobs.mjs';
import { hash } from '../domain.mjs';
function setup({ throws = false, eligible = true, claimRejection = null } = {}) {
  const payload = { prompt: 'A static observation.', prompt_expansion_mode: 'disabled', duration: 5 };
  let job = { id: 'j', project_id: 'p', proposal_id: 'q', status: 'reserved', charge_state: 'held', reserved_micro_usd: 100, payload_hash: hash(payload) };
  const proposal = { id: 'q', project_id: 'p', model_id: 'M17', payload_hash: hash(payload), price_version: 'v1', quote_expires_at: new Date(Date.now()+60000).toISOString(), payload };
  const model = { id: 'M17', provider: 'fal', endpoint: 'minimax/h3-max/reference-to-video', price_version: 'v1', active: eligible, execution_tested: eligible, quality_validated: eligible };
  const audits = [];
  let submits = 0;
  const queries = [];
  const store = {
    async generationControl() { return { generationPaused: false, revision: 0 }; },
    async readJob(actor, project, id) { if (actor !== 'owner' || project !== 'p' || id !== 'j') throw new Error('not owner'); return structuredClone(job); },
    async readProposal() { return structuredClone(proposal); }, async readModel() { return structuredClone(model); },
    async claimJob() { if (claimRejection) throw new Error(claimRejection); if (job.status !== 'reserved') return null; job.status = 'submitted'; return structuredClone(job); },
    async markJob(id, fields, guard) { if (!guard.expectedStatuses.includes(job.status)) return null; Object.assign(job, fields); return structuredClone(job); },
    async addAudit(projectId, actorId, type, details) { audits.push({ projectId, actorId, type, details }); },
  };
  const providers = {
    async submitFalJob(arg) { submits++; assert.equal(arg.authorized, true); if (throws) throw new Error('timeout'); return { requestId: 'request-1' }; },
    async getFalJob(arg) { queries.push(arg); return arg.result ? { video: { url: 'https://cdn.example/result.mp4' } } : { status: 'COMPLETED' }; },
  };
  return { controller: createJobController({ store, providers }), store, audits, queries, get submits() { return submits; }, get job() { return job; }, proposal, model, providers };
}
const scope = { actorId: 'owner', projectId: 'p', jobId: 'j' };
test('concurrent dispatch claims one reserved job and submits only once', async () => {
  const state = setup();
  await Promise.all([state.controller.dispatch(scope), state.controller.dispatch(scope), state.controller.dispatch(scope)]);
  assert.equal(state.submits, 1); assert.equal(state.job.provider_request_id, 'request-1');
  assert.equal(state.job.charge_state, 'held');
});
test('timeout creates uncertain charge and subsequent dispatch never resubmits', async () => {
  const state = setup({ throws: true });
  await state.controller.dispatch(scope);
  assert.equal(state.job.status, 'unknown'); assert.equal(state.job.charge_state, 'unknown');
  await state.controller.dispatch(scope); await state.controller.poll(scope);
  assert.equal(state.submits, 1); assert.equal(state.queries.length, 0);
  assert.ok(state.audits.some(a => a.type === 'job_submission_uncertain'));
});
test('ineligible routes, modified contracts and expired quotes fail before submission', async () => {
  const disabled = setup({ eligible: false }); await assert.rejects(disabled.controller.dispatch(scope), /not eligible/); assert.equal(disabled.submits, 0);
  const tampered = setup(); tampered.proposal.payload_hash = 'different'; await assert.rejects(tampered.controller.dispatch(scope), /mismatch/); assert.equal(tampered.submits, 0);
  const expired = setup(); expired.proposal.quote_expires_at = '2000-01-01'; await assert.rejects(expired.controller.dispatch(scope), /expired/); assert.equal(expired.submits, 0);
});
test('modified payload with unchanged asserted hashes never reaches the provider', async () => {
  const state = setup();
  state.proposal.payload.duration = 15;
  assert.equal(state.proposal.payload_hash, state.job.payload_hash);
  await assert.rejects(state.controller.dispatch(scope), /content hash mismatch/);
  assert.equal(state.submits, 0);
  assert.equal(state.job.status, 'reserved');
});
test('atomic claim rejection for revoked approval or expired authorization prevents submission', async () => {
  for (const reason of ['artifact_not_approved', 'authorization_invalid', 'artifact_superseded']) {
    const state = setup({ claimRejection: reason });
    await assert.rejects(state.controller.dispatch(scope), new RegExp(reason));
    assert.equal(state.submits, 0);
    assert.equal(state.job.status, 'reserved');
    assert.equal(state.job.charge_state, 'held');
  }
});
test('completion records output for review without settling unknown actual cost', async () => {
  const state = setup(); await state.controller.dispatch(scope); const completed = await state.controller.poll(scope);
  assert.equal(completed.status, 'completed'); assert.equal(completed.charge_state, 'held'); assert.equal(completed.actual_micro_usd, undefined);
  assert.deepEqual(state.queries.map(q => q.result || false), [false, true]);
  assert.ok(state.audits.some(a => a.type === 'job_provider_output' && a.details.creative_acceptance === 'unreviewed'));
  await state.controller.dispatch(scope); assert.equal(state.submits, 1);
});
test('foreign actor cannot dispatch or inspect jobs', async () => {
  const state = setup(); await assert.rejects(state.controller.dispatch({ ...scope, actorId: 'foreign' }));
  await assert.rejects(state.controller.poll({ ...scope, actorId: 'foreign' })); assert.equal(state.submits, 0);
});
test('poll transport failures preserve spending hold and durable request', async () => {
  const state = setup(); await state.controller.dispatch(scope);
  state.providers.getFalJob = async () => { throw new Error('network'); };
  const job = await state.controller.poll(scope);
  assert.equal(job.status, 'submitted'); assert.equal(job.provider_request_id, 'request-1'); assert.equal(job.charge_state, 'held');
});

test('paused generation blocks dispatch and preserves its reserved spending hold', async () => {
  const state = setup();
  state.store.generationControl = async () => ({ generationPaused: true, revision: 1 });
  await assert.rejects(state.controller.dispatch(scope), error => error.status === 409 && /paused/.test(error.message));
  assert.equal(state.submits, 0);
  assert.equal(state.job.status, 'reserved');
  assert.equal(state.job.charge_state, 'held');
  assert.equal(state.job.reserved_micro_usd, 100);
});
test('missing failed or malformed generation control cannot submit or claim', async () => {
  for (const control of [undefined, async () => { throw new Error('control offline'); }, async () => null, async () => ({ generationPaused: false }), async () => ({ generationPaused: false, revision: 0.5 }), async () => ({ generationPaused: 'false', revision: 1 }), async () => ({ generationPaused: false, revision: Number.MAX_SAFE_INTEGER + 1 })]) {
    const state = setup();
    state.store.generationControl = control;
    let claims = 0;
    const claim = state.store.claimJob;
    state.store.claimJob = (...args) => { claims++; return claim(...args); };
    await assert.rejects(state.controller.dispatch(scope), error => error.status === 503);
    assert.equal(claims, 0); assert.equal(state.submits, 0);
    assert.equal(state.job.status, 'reserved'); assert.equal(state.job.charge_state, 'held');
  }
});
test('pausing new generation still allows polling and observing an existing request', async () => {
  const state = setup();
  await state.controller.dispatch(scope);
  state.store.generationControl = async () => ({ generationPaused: true, revision: 2 });
  const observed = await state.controller.dispatch(scope);
  assert.equal(observed.status, 'submitted');
  const completed = await state.controller.poll(scope);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.charge_state, 'held');
  assert.equal(state.submits, 1); assert.equal(state.queries.length, 2);
});

import { validateFalInput } from './providers.mjs';
import { hash } from './domain.mjs';
import { publishedReviewHolds } from './model-router.mjs';

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
const inFlight = ['submitted', 'running'];

// Only trusted server store methods may implement this interface. The database
// reservation transaction owns authorization, budget and attempt-limit checks.
export function createJobController({ store, providers }) {
  async function contract(actorId, projectId, jobId) {
    if (!actorId || !projectId || !jobId) fail(400, 'Job identity required.');
    const job = await store.readJob(actorId, projectId, jobId);
    if (!job || job.project_id !== projectId) fail(404, 'Job unavailable.');
    const proposal = await store.readProposal(projectId, job.proposal_id);
    if (!proposal || proposal.project_id !== projectId || proposal.payload_hash !== job.payload_hash) fail(409, 'Reserved job contract mismatch.');
    const model = await store.readModel(proposal.model_id);
    if (!model || model.provider !== 'fal') fail(409, 'Unsupported provider route.');
    return { job, proposal, model };
  }
  async function audit(projectId, actorId, type, details) {
    return store.addAudit(projectId, actorId, type, details);
  }
  return {
    async dispatch({ actorId, projectId, jobId }) {
      const { job, proposal, model } = await contract(actorId, projectId, jobId);
      // Repeated dispatch requests are observations, never a new provider call.
      if (job.status !== 'reserved') return job;
      // Missing, unreadable or malformed operational controls must never enable
      // a new billable submission. Existing request inspection stays available.
      if (typeof store.generationControl !== 'function') fail(503, 'Generation control unavailable.');
      let control;
      try { control = await store.generationControl(); }
      catch { fail(503, 'Generation control unavailable.'); }
      if (!control || typeof control.generationPaused !== 'boolean' || !Number.isSafeInteger(control.revision) || control.revision < 0) fail(503, 'Generation control invalid.');
      if (control.generationPaused !== false) fail(409, 'Generation is paused.');
      if (hash(proposal.payload) !== proposal.payload_hash) fail(409, 'Reserved payload content hash mismatch.');
      if (job.charge_state !== 'held' || !(Number(job.reserved_micro_usd) > 0)) fail(409, 'A held spending reservation is required.');
      if (model.active !== true || model.execution_tested !== true || model.quality_validated !== true || model.price_version !== proposal.price_version) fail(409, 'Model route is not eligible.');
      if (!Number.isFinite(Date.parse(proposal.quote_expires_at)) || Date.parse(proposal.quote_expires_at) <= Date.now()) fail(409, 'Quote has expired.');
      if (publishedReviewHolds(model).length) fail(409, 'The published model execution or quality review expired or changed. Reconcile this reservation before any new submission.');
      validateFalInput(model.endpoint, proposal.payload);
      // The database claim revalidates current artifacts, approvals and spending
      // authorization under locks; rejection must happen before any provider call.
      const claimed = await store.claimJob(jobId);
      if (!claimed) return store.readJob(actorId, projectId, jobId);
      try {
        const submission = await providers.submitFalJob({ endpoint: model.endpoint, input: structuredClone(proposal.payload), authorized: true });
        if (!submission?.requestId) throw new Error('Provider returned no durable request identity');
        const updated = await store.markJob(jobId, { provider_request_id: submission.requestId, status: 'submitted', charge_state: 'held' }, { expectedStatuses: ['submitted'] });
        if (!updated) throw new Error('Could not persist provider identity');
        await audit(projectId, actorId, 'job_submitted', { job_id: jobId, provider_request_id: submission.requestId, model_id: model.id, charge_state: 'held' });
        return updated;
      } catch {
        // This includes transport timeout and persistence failure after acceptance.
        // Retain reservation: a failed HTTP request does not prove no billing.
        await store.markJob(jobId, { status: 'unknown', charge_state: 'unknown' }, { expectedStatuses: ['submitted', 'running'] });
        await audit(projectId, actorId, 'job_submission_uncertain', { job_id: jobId, action: 'reconcile_before_any_resubmission' });
        return store.readJob(actorId, projectId, jobId);
      }
    },
    async poll({ actorId, projectId, jobId }) {
      const { job, model } = await contract(actorId, projectId, jobId);
      if (![...inFlight, 'unknown'].includes(job.status) || !job.provider_request_id) return job;
      // Eligibility may be revoked after submission. Existing request inspection
      // remains permitted; it incurs no replacement generation.
      let response;
      try {
        response = await providers.getFalJob({ endpoint: model.endpoint, requestId: job.provider_request_id });
      } catch {
        await audit(projectId, actorId, 'job_poll_unavailable', { job_id: jobId, action: 'inspect_existing_request_only' });
        return job;
      }
      if (response.status === 'COMPLETED') {
        let output;
        try {
          output = await providers.getFalJob({ endpoint: model.endpoint, requestId: job.provider_request_id, result: true });
        } catch {
          await audit(projectId, actorId, 'job_result_pending', { job_id: jobId });
          return job;
        }
        // Output is evidence, not acceptance, a download instruction or an invoice.
        await audit(projectId, actorId, 'job_provider_output', { job_id: jobId, output, creative_acceptance: 'unreviewed', cost_reconciliation: 'pending' });
        return await store.markJob(jobId, { status: 'completed' }, { expectedStatuses: [...inFlight, 'unknown'] }) || await store.readJob(actorId, projectId, jobId);
      }
      if (response.status === 'IN_PROGRESS') {
        return await store.markJob(jobId, { status: 'running' }, { expectedStatuses: [...inFlight, 'unknown'] }) || job;
      }
      if (response.status === 'FAILED' || response.status === 'CANCELLED') {
        await audit(projectId, actorId, 'job_provider_terminal', { job_id: jobId, provider_status: response.status, cost_reconciliation: 'pending' });
        return await store.markJob(jobId, { status: response.status === 'FAILED' ? 'failed' : 'cancelled' }, { expectedStatuses: [...inFlight, 'unknown'] }) || job;
      }
      // IN_QUEUE and unrecognized states retain the current hold and state.
      return job;
    },
  };
}

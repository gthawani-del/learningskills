import {hash, fail} from './domain.mjs';
const operations = new Set(['initial_plan', 'revise_plan']);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function planningScope(project, approvals = []) {
 if (!project || typeof project !== 'object' || !Array.isArray(approvals)) fail(400, 'A project and approved decisions are required.');
 const brief = Object.fromEntries(['premise','direction','language','duration','format'].map(key => [key, project[key] ?? null]));
 const latest = new Map();
 for (const decision of approvals) {
  if (typeof decision?.artifactId !== 'string' || !Number.isSafeInteger(decision.version) || decision.version < 1) continue;
  latest.set(`${decision.artifactId}@${decision.version}`, decision);
 }
 const approved = [...latest.values()].filter(a => a.decision === 'approved').map(a => ({artifactId: a.artifactId, version: a.version})).sort((a,b) => a.artifactId.localeCompare(b.artifactId) || a.version-b.version);
 const approvalOrdinal = approvals.reduce((max, a, index) => Math.max(max, Number.isSafeInteger(a?.ordinal) && a.ordinal > 0 ? a.ordinal : index + 1), 0);
 return {briefScopeHash: hash(brief), approvedDecisionDigest: hash(approved), approvalOrdinal};
}

// No provider calls or charges occur here. Only these explicit creative operations
// may request a language model; deterministic edits stay local.
export function decidePlanningPath({operation, requestHash, scope, cache, policy} = {}) {
 if (operation === 'manual_edit') return {path:'manual',chargeable:false,reason:'Apply the explicit edit without a model.'};
 if (operation === 'rule_edit') return {path:'rule',chargeable:false,reason:'Apply the deterministic rule without a model.'};
 if (!operations.has(operation)) return {path:'blocked',chargeable:false,reason:'This operation is outside the creative planning policy.'};
 if (!digest(requestHash) || !digest(scope?.briefScopeHash) || !digest(scope?.approvedDecisionDigest)) fail(400, 'An exact planning request and scope are required.');
 if (cache?.approved === true && cache.requestHash === requestHash && cache.operation === operation && cache.briefScopeHash === scope.briefScopeHash && cache.approvedDecisionDigest === scope.approvedDecisionDigest && cache.approvalOrdinal === scope.approvalOrdinal && digest(cache.resultHash) && cache.result !== undefined && hash(cache.result) === cache.resultHash) return {path:'cache',chargeable:false,reason:'Reuse the exact already approved planning result.',result:structuredClone(cache.result),resultHash:cache.resultHash};
 if (policy?.creativePlanningEnabled === true && Array.isArray(policy.allowedOperations) && policy.allowedOperations.includes(operation)) return {path:'llm',chargeable:true,requiresConsent:true,reason:'Creative planning requires an active scoped generation cost consent.'};
 return {path:'blocked',chargeable:false,reason:'Creative model planning is not explicitly enabled for this operation.'};
}

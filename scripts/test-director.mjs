// Run all node:test scenarios in one process so the report counts cases, not files.
await import('../apps/director/tests/api.test.mjs');
await import('../apps/director/tests/jobs.test.mjs');
await import('../apps/director/tests/providers.test.mjs');
await import('../apps/director/tests/render.test.mjs');
await import('../apps/studio/tests/production-contract.test.mjs');
await import('../apps/director/tests/cloud-session.test.mjs');
await import('../apps/director/tests/imports.test.mjs');
await import('../apps/director/tests/production-state.test.mjs');
await import('../apps/director/tests/media-storage.test.mjs');

await import('../apps/director/tests/production-records.test.mjs');

await import('../apps/director/tests/operations.test.mjs');

await import('../apps/director/tests/model-router.test.mjs');
await import('../apps/director/tests/cost-quotes.test.mjs');
await import('../apps/director/tests/routing-task-catalog.test.mjs');
await import('../apps/director/tests/routing-api.test.mjs');

await import('../apps/director/tests/quote-input.test.mjs');

await import('../apps/director/tests/routing-intent.test.mjs');
await import('../apps/director/tests/spending.test.mjs');

await import('../apps/director/tests/spending-api.test.mjs');

await import('../apps/director/tests/tariffs.test.mjs');

await import('../apps/director/tests/cost-reconciliation.test.mjs');

await import('../apps/director/tests/spending-cloud.test.mjs');

await import('../apps/director/tests/planning-provider.test.mjs');
await import('../apps/director/tests/planning-policy.test.mjs');
await import('../apps/director/tests/planning-consent.test.mjs');

await import('../apps/director/tests/planning-api.test.mjs');

await import('../apps/director/tests/planning-cloud.test.mjs');

await import('../apps/director/tests/creative-brief.test.mjs');

await import('../apps/director/tests/creative-brief-api.test.mjs');

await import('../apps/director/tests/creative-brief-cloud.test.mjs');

await import('../apps/director/tests/creative-brief-integration.test.mjs');

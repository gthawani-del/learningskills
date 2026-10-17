// Run all node:test scenarios in one process so the report counts cases, not files.
await import('../apps/director/tests/api.test.mjs');
await import('../apps/director/tests/jobs.test.mjs');
await import('../apps/director/tests/providers.test.mjs');
await import('../apps/director/tests/render.test.mjs');
await import('../apps/studio/tests/production-contract.test.mjs');
await import('../apps/director/tests/cloud-session.test.mjs');

# Operational controls — 18 October 2026

This advances Step 4. It is an internal command and pause foundation, not a complete commercial backoffice. Vercel-dependent cloud-account checks are deferred at the user's request.

## Implemented

Server-controlled owner, operator, reviewer and support allowlists derive permissions from authenticated user IDs, never editable user metadata. Owners/operators can pause new generation or disable a model. Only owners can edit registry use notes. Reviewers/support receive narrower read access. Model activation, generation resume, role grants, billing changes and private customer-media access are absent from this command surface.

The backoffice shows controls, registry purpose/evidence/use notes, staff-owned job metadata and the latest 100 operational audit entries. Commands require a reason, current control revision and request UUID. A lost response retains that exact command for explicit retry. Changing to another command requires an explicit reset and a fresh control read. Pending request identity remains in the page's memory; closing/reloading the page is not durable command recovery.

Database commands serialize control revisions, update metadata and append audit evidence atomically. Reusing an ID with different payload/actor conflicts. Replaying an identical request returns its original result. Internal registry notes cannot change endpoints, execution evidence, quality flags, prices or active status. Model disable can only set active=false.

Global pause is checked before new provider submission and atomically when database jobs are inserted or reserved jobs enter submitted state. Polling and reconciliation of existing requests remain allowed. A pause cannot recall a provider request or database claim already committed before the pause. Model updates use NOWAIT after the control lock to avoid the reviewed inverse claim/model lock cycle; busy commands require explicit retry.

## Verified

- 88 automated scenarios pass, including server-derived roles, unauthorized metadata escalation, concurrent commands, exact-request retry, stale revision conflicts, durable local recovery, constrained registry changes and provider dispatch pause/failure guards. Build and syntax checks pass.
- Local Chromium backoffice checks pass: an intentionally lost response after server commit, same-ID retry with one audit event, escaped registry notes, model disable, audit display and 390px viewport without horizontal overflow. One expected ERR_FAILED console message comes from the intentional abort; no unexpected console/page/HTTP errors remain. The first narrow-screen run exposed navigation overflow; scoped wrapping fixed it and the relevant check passed on repeat.
- Supabase migration `20261018002640` (`director_operational_controls`) applied to Director only. Rollback SQL fixtures passed pause, replay, payload conflict, stale revision, operator restriction, notes scope, disable, forbidden resume, paused job insert and audit mutation rejection. Fixtures leave control revision=1, paused=true, zero commands and zero jobs.
- Both operational tables have RLS. Anon/authenticated cannot read either table or execute the command function. Service role cannot update the audit table. Security advisor returned no findings.

The first SQL fixture run had a test-expression operator-precedence error; it was corrected and the complete rollback proof reran successfully. No fixture mutations persisted.

## Limits and next work

Roles currently come from server configuration, not an invitation/expiry/MFA staff-management system. The service-only RPC trusts actor/role supplied by the authenticated server; it is not exposed to customers. Job views remain restricted to staff-owned projects. Support case grants, tenant/render-specific pauses, audit pagination/export/retention, financial reporting, spending policies and real provider concurrency/recovery remain unfinished. Append-only database audit is an application integrity measure, not tamper-proof archival.

Recursive library approvals still need atomic reservation/dispatch enforcement before generation activation. Routes remain inactive. No paid provider operation, real-cloud account isolation, physical mobile test or finished-media quality result is claimed.

## Rollback

Application baseline: `fdd178443c8bb592c10afbf0eefe922e0cdc80a5`. Prefer retaining database pause guards while rolling back application code. Removing those guards would remove a generation barrier; do not drop them while enabling requests. Preserve command audit evidence. This increment includes no destructive rollback and no resume command.

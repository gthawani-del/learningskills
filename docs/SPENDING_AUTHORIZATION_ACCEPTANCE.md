# Job-aware routing and spending controls — acceptance record

18 October 2026 UTC. This advances Step 5 and the customer cost surface; it does not complete every model integration, customer billing or film-generation workflow.

## Implemented behavior

- Routing accepts explicit purpose, audience/platform, style, production stage, creative control, quality goals and deadline preferences. Job-specific recommendations require fresh evaluated profiles bound to the exact task, endpoint and model version. Ranking uses weighted evaluated quality, with explanations and limitations. No age-based tier or cheapest-model default is inferred.
- The historical twenty endpoint candidates remain discoverable. Additional models require explicit reviewed, version-bound task bindings and schema evidence. Discovery never activates a model or supplies an unreviewed provider adapter.
- Quotes bind exact project and artifact versions/hashes, provider input hash, model/schema/price versions, configuration, and selected routing-profile attestation. Expiry is bounded by every applicable evidence expiry. Changed creative versions, prices, schemas or evaluated tradeoffs invalidate new authorization.
- Simple unit pricing remains supported. Composite arithmetic handles explicit seconds, images, exact output megapixels, characters, thousands of characters and per-request components, with rational rates, included/minimum quantities and explicit per-component ceiling. JavaScript uses BigInt; PostgreSQL uses exact numeric arithmetic. Character-count conventions are explicit in composite tariffs. Unknown token usage is held, not guessed.
- Saved quotes and explicit per-quote spending limits are durable. The total limit includes its protected finishing amount and must cover the quoted operation plus that amount. Revocation prevents new spending eligibility but does not release uncertain charges or undo completed provider work.
- Request identities bind exact decisions. A lost response can replay the original result, even after expiry or later project changes; changed requests cannot reuse the same identity. Local file-store money transitions commit an atomic file replacement before publishing the new in-memory state.
- The customer Costs dialog shows saved estimates, limits, revocation and existing reservation/uncertain/actual states. It handles exact decimal USD conversion and preserves pending request identities after interrupted responses. It does not start generation or represent a wallet/customer invoice.
- New database job guards recheck saved quote, project version, immutable registry snapshot and fresh quote evidence before reservation and dispatch. Existing project locks, budget/finishing limits, creative approval guards, attempt limits and global pause remain necessary.
- Fal submissions explicitly request no silent provider fallback or automatic provider retry. Existing uncertain submissions are reconciled through their recorded request; they are not blindly resubmitted.

## Customer/API contracts

| Operation | Contract |
| --- | --- |
| `POST /api/projects/:id/routes` | Existing task/requirements plus optional explicit `intent`; returns candidates, holds and evaluated explanations. |
| `POST /api/projects/:id/quotes` | Existing exact artifact/model/input request plus optional `intent`. Without `requestId`, returns a read-only preview. With a request UUID, persists a verified quote and returns its safe receipt. |
| `GET /api/projects/:id/spending` | Owner-scoped saved quotes, authorizations and recorded job reservation states; no raw provider input or internal pricing evidence. |
| `POST /api/projects/:id/spending-authorizations` | Request UUID, exact expected project version, saved quote ID, integer USD micro-unit total limit and finishing amount. Records consent only. |
| `POST /api/projects/:id/spending-authorizations/:authorizationId/revoke` | Request UUID, expected project version and bounded reason. Records explicit revocation. |

Every operation checks project ownership. Pending imports cannot mutate these records. Server-derived actor, prices, approval and provider fields are never accepted as customer authority. Unavailable database objects fail closed; cloud requests never fall back to local financial storage.

## Verification and evidence limits

Automated module/API/mock-adapter checks cover ranking, dynamic binding, tariff arithmetic, freshness, immutable quote evidence, owner isolation, version conflicts, exact replay, unknown-charge behavior, input tampering, cap/finishing boundaries, restart persistence and failed-write rollback. Final counts are recorded in the current implementation status/evidence.

The isolated PostgreSQL proof runs the actual SQL using PGlite/WASM with mock auth roles. It verifies recursive approvals, persisted quote/authorization RPCs, replay conflicts, scalar/composite tariff parity, missing/null evidence rejection, intent expiry, sequential budget conservation, uncertain holds, registry changes before reservation/claim, privilege denial and rollback. It uses one connection: it is not a cross-session lock-race proof or real Supabase Auth/Storage test.

Browser checks passed against (a) explicit API fixtures for ambiguous-response recovery and (b) the real local browser/server/file-store flow with synthetic model and price evidence. The latter verifies saved-quote display, authorization, reload persistence and revocation, with no console/page/HTTP errors. Desktop and 390px viewport layouts were checked. Physical mobile testing remains outstanding.

No paid model calls, real generated outputs or quality pilots were performed. Production migration/release state is recorded separately; local proof does not imply a deployed customer flow.

## Reconciliation foundation and remaining work

`cost-reconciliation.mjs` supplies a pure, tested normalizer/ledger transition for trusted cost evidence, exact nano-USD deltas, credits, idempotency and separately attested final totals. It does not ingest raw fal billing rows, write production financial records or settle real customer charges. A raw per-request cumulative cost snapshot must not be appended as a new delta on each fetch. Missing finality retains uncertainty.

Still required before paid production: real task/model quality evaluations and approved active profiles; provider-specific schema and current full tariff evidence; complete multi-department/sequence estimates; trusted token/media metering where applicable; a production billing-feed adapter with durable reconciliation and customer pricing/fees/credits; cross-session reservation race tests; actual cloud-account/browser persistence verification; and representative approved-budget media pilots. Direct OpenAI planning stays disabled until its own quote/reservation path is complete.

A project-level budget remains an additional reservation constraint. Recording a per-quote limit is not a payment, top-up, project budget increase or permission to dispatch immediately. No new route is activated by this release. The two-attempt quality target remains unproven.

## Rollback

Keep generation paused. Application rollback may remove the new cost surface and API use while leaving append-only quotes/decisions intact. Do not delete financial evidence or clear customer drafts as a rollback. Additive database quote/approval guards should remain in place unless a separately reviewed replacement preserves their protections. The pre-batch application baseline is `76960d5e594907fd3792ca6df79276bf54f01249`.

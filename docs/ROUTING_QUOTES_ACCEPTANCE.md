> Superseded implementation scope: [Spending authorization acceptance](SPENDING_AUTHORIZATION_ACCEPTANCE.md) records the newer durable quotes, intent evidence, composite tariffs, cost UI and applied guards. The body below describes the earlier read-only quote increment, not the current complete implementation surface.

# Model routing and cost estimates — 18 October 2026

This advances Step 5; it does not complete routing activation, spending authorization or cost reconciliation. Vercel-dependent cloud tests remain deferred by user instruction.

## Team work and integration

Separate agents implemented deterministic route matching, pricing rules, task mapping, recursive database approval guards and API integration tests. A sixth agent independently reviewed boundaries. Root integrated the modules, adapter checks, build and release. Review found schema freshness/model binding, pricing applicability, SQL naming ambiguity and payload-requirement mismatches; these were addressed before release or remain explicitly held pending verification.

## Public project API contracts

All routes require an owned project. Pending imports cannot submit route/quote POSTs.

| Endpoint | Behavior |
| --- | --- |
| GET `/api/projects/:id/routes` | Lists the 20 production task types and their candidate model IDs; this is discovery, not proof of availability. |
| POST `/api/projects/:id/routes` | Accepts only `{task, requirements}`. Returns deterministic candidates, reasons for holds and eligible model IDs. |
| POST `/api/projects/:id/quotes` | Accepts only `{expectedVersion, task, requirements, modelId, artifactId, artifactVersion, input}`. Returns a read-only estimate bound to exact versions and payload. |

Client prices, budgets, ownership, approval or authorization fields cannot change routing or quotes. Estimation makes no provider call and creates no job, reservation, approval, bill or persisted project change.

## Route eligibility

Discovery maps exact candidate IDs/providers/endpoints from the seeded catalog. Explicit server capabilities must declare the task, output/input modalities and requested language, duration, aspect ratio, resolution and reference/performance support. Missing capabilities hold the route; endpoint names are not used to infer them.

Routes require explicit model version, active/execution-tested/quality-validated flags, verified schema evidence, matching endpoint/model identity, a schema hash and future evidence expiry. Prices require verified USD micro-unit rates, exact price version, HTTPS evidence, future expiry and explicit verified configuration coverage. Eligible routes rank by declared priority then ID. No fallback is silently activated.

The API validates payloads against the reviewed adapter and checks its schema hash against registry evidence. Currently only the three existing reviewed adapters can produce API estimates: Seedream reference image editing, H3 Max reference video and Eleven v4 speech synthesis. Other catalog tasks remain discoverable and held until an appropriate adapter and verification evidence exist. This is not complete support for all 105 product functions.

## Quote arithmetic and binding

Supported simple pricing units are seconds (rounded up), explicit image count, Unicode code-point count or one request, with an explicit minimum where verified. Counts and multiplication must remain positive safe integers. Missing units, stale versions, unsupported/mismatching configuration, malformed evidence and injected authority fields fail closed.

Quotes contain task/requirements, exact project artifact version/content hash, input hash, model endpoint/version, schema version/hash, price version/configuration, integer USD micro-unit total, creation and expiry. Quote expiry cannot exceed schema or pricing evidence expiry. `estimateOnly=true` and `generationAuthorized=false` are always present.

The estimate is for one modeled operation, not a complete movie budget, customer invoice or promise about retries. Sequence planning, finish reserves, customer markup, taxes, provider invoice reconciliation, credits and financial ledger conservation remain unfinished. Actual fal price observations in older documents are not promoted into verified executable rates by this update. All enabled-path tests use explicit synthetic pricing, not paid execution evidence.

## Verification status

Integrated automated tests and build are recorded by the release report. Tests cover deterministic ranking, held candidates, expiry/version/configuration checks, Unicode/rounding/overflow, schema/payload validation, stale creative versions, owner isolation, pending imports and absence of provider calls/state changes.

Database recursive-approval SQL remains separately staged until a genuine positive PostgreSQL fixture passes. It must verify current story, target and all transitive production-record approvals and reference versions atomically before new reservations/dispatch. Existing pause, route, quote and budget guards remain necessary. No new generation activation is part of this release.

## Remaining work

Live endpoint/schema/configuration-price verification and quality benchmarks; durable proposals/quote records; user-confirmed bounded spending authorizations; sequence/work-unit scheduling; actual-cost reconciliation; a customer estimate UI; real cloud-account integration and representative paid pilots. The target of acceptable output within two attempts remains unproven.

Application rollback baseline: `76960d5e594907fd3792ca6df79276bf54f01249`. Preserve operational pause guards and all historical records. No paid provider call or destructive data operation is required by this API estimate module.

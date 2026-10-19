# Reviewed provider registry — implementation and acceptance

19 October 2026. Both OpenAI and fal now use server-only deployment credentials, a reviewed admin/database registry and task-specific routing. See [the architecture and coverage contract](MODEL_REGISTRY_ARCHITECTURE.md).

## Implemented

- Removed runtime dependency on `OPENAI_STORY_MODEL` and `DIRECTOR_PLANNING_ENABLED`. OpenAI planning selects reviewed operation-bound registry models; unsupported provider adapters remain held. The obsolete unreserved planning helper cannot submit.
- Added owner-only inactive drafts and explicit reviewed publication, exact profile hashes/revisions, immutable releases and audit receipts, credential-field rejection, stale-baseline protection and safe replay. Publication refuses unresolved media/planning work and leaves global pause unchanged.
- Added readable admin summaries, advanced credential-free profile/evidence editing and retained exact pending registry requests across reload. Published drafts cannot be published again from the interface; editing creates a new version.
- Added operation-specific planning estimates and displayed model/fingerprint expectations. New allowances cover one operation and one model/profile. Existing operation-less grants retain their earlier semantics. Starting/resuming never chooses a replacement model automatically.
- Added language/format constraints, reviewed execution/quality freshness, optional measured preference ranking and explicit reservation-budget filtering. Price alone does not rank models. Fal published-review expiry is checked again before dispatch; existing request polling remains available when a route loses eligibility.

## Verification

**360 automated tests, syntax checks and the production build pass.** Meaningful new checks cover permissions, credential/authority injection, draft and publication disk-failure rollback, exact retry/concurrency, expired evidence, wrong task/model/schema, cost-bound model selection, stale displayed estimates, model retirement, cross-operation grants and known-call recovery. Transport and model output in these tests are simulated.

Actual local Chromium checks pass for registry save/review/publication, reload, reviewer-only access and operation/model-bound allowances. Writing and briefing regressions pass, including saved projects, editing, image selection, video playback/seek, draft JSON export, preserved screenplay sources/revisions and footer separation across five narrow viewport sizes. Desktop screenshots were inspected. Physical phones and actual virtual keyboards were not tested.

The controlled writing navigation-failure fixture recovers a saved script without duplicate application or paid retry; its deliberate 503 is recorded separately. The planning UI fixture checks lost-response retry, call/finish caps, unknown submissions, polling, cancellation and revocation with intercepted API responses. Normal local runs have no console or HTTP errors; this fixture evidence is distinguished from actual local APIs.

**13 isolated PGlite PostgreSQL proof groups pass.** These cover append-only/RLS/service permissions, exact revision/hash/acknowledgement, replay, publication baseline drift, operation guards, legacy grants and actual synthetic media reservation/claim ledger states. Single-connection proofs do not establish true concurrent-session locking behavior.

Migration **`20261019102343_director_registry_management`** is installed on the Director Supabase project. Native metadata checks confirm RLS on all three new tables, a service-only security-invoker command RPC, the operation column, zero drafts/releases, zero active OpenAI/fal models, zero planning reservations and generation paused. The security advisor reports no findings. No synthetic profile was published to the native database.

Evidence: [implementation/browser record](evidence/MODEL_REGISTRY_CHECKS_2026-10-19.json), [native database record](evidence/MODEL_REGISTRY_NATIVE_CHECKS_2026-10-19.json), [isolated SQL proof](../database/checks/registry-management-pglite-results.json).

## Remaining gates

No paid provider call, live model quality/price validation, real account-isolation browser test, deployed-site check or physical-device test was performed. Vercel/account checks remain deferred by the user. Provider keys were not inspected or changed.

Only the five documented OpenAI planning operations and three implemented fal media adapters can currently be published for execution. Draft discovery is broader. Department planning, additional fal/OpenAI tasks, complete commercial billing, sequence-policy publication/rollback and full production pilots remain incomplete. Registry evidence is an owner-reviewed attestation with supporting sources, not an automatically executed benchmark.

F085 advances from missing to partial. The tracker now records **65 partial, 96 missing/unverified and 6 deferred; zero fully production-accepted** requirements.

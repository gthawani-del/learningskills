# Hybrid planning authorization — implementation and acceptance

18 October 2026. Scope: Step 6, point 1, the authorization and reservation boundary for LLM planning. This does not complete the Director's brief interpretation, writing departments, storyboard generation or full-film workflows.

## The hybrid rule

Manual editing and supported deterministic operations use no LLM. Creative planning may use an explicitly approved allowance for the same brief and protected decisions. The allowance sets a total generation-cost ceiling, a protected finishing amount, a maximum call count and an expiry. A limit does not itself submit a call. Explicit calls within that allowance do not require another financial grant. Changed brief/approved decisions, model or pricing evidence require renewed consent.

The maximum call count is an upper limit, not a promise that every possible call is funded. Each reservation checks remaining funds, including settled costs, held/unknown exposure and the finishing amount. Manual edits remain available when paid planning is unavailable.

The pure policy supports an approved-result cache decision. This release wires free replay/retrieval of exact saved calls, not an end-to-end approved-plan cache. Do not claim that separate cache workflow is implemented.

## What is implemented

- Versioned OpenAI Responses requests with exact input hashes, structured output, explicit output-token bounds and background response storage. Provider credentials stay server-side.
- Verified model/schema/pricing/token-bound profiles. Token evidence must bind the actual model and context size; the server cannot replace mismatching evidence with a guessed lower count. No character-divided-by-four estimate is used.
- Conservative maximum-reservation quotes using the verified context-window input ceiling and bounded output tokens. These can be substantially higher than expected usage. The UI identifies them as maximum reservations, not predicted charges. A more precise trusted tokenizer/meter adapter remains a future improvement.
- Initial scoped grants allow 1–10 calls while budget remains. Exact rational input/cached-input/output rates use integer micro-USD ceilings; actual provider billing still requires separate reconciliation.
- Project-serialized durable reservation, scope/approval/model fences and claim-once submission. Unknown or still-submitting work blocks replacement calls and fresh-grant replenishment across that project.
- Provider response IDs survive normalization and creative-validation failures. Polling uses the known response ID; it does not submit again. Missing usage or overrun preserves an uncertain hold and any known exposure.
- Explicit recovery for unclaimed interrupted reservations: resume the same hold after fresh checks, or cancel it without a provider call. Claimed/unknown calls cannot be released on an assumption of no charge.
- Usage recording continues after brief edits, grant revocation or policy changes. Completed plans remain proposals; the existing story and approvals are not overwritten.
- Costs → Planning limits provides availability, maximum per-call reservation, initial approval, explicit plan/revision requests, status checks, revocation and unstarted-call recovery. Interrupted responses retain the request identity.

## API and data contracts

All routes are owner-scoped under `/api/projects/:id`:

| Route | Behavior |
| --- | --- |
| `GET /planning` | Hybrid policy, availability, scope, maximum reservation, grants and call history. |
| `POST /planning-consents` | Request UUID, expected version, total/finishing limits and maximum calls. Records consent only. |
| `POST /planning-consents/:consentId/revoke` | Explicit bounded reason; blocks future use without erasing charges. |
| `POST /planning-calls` | Exact grant and operation; reserve, claim once, submit and retain the response identity. |
| `POST /planning-calls/:callId/poll` | Check existing provider work and record known usage. |
| `POST /planning-calls/:callId/resume` | Revalidate and claim an existing unstarted reservation. |
| `POST /planning-calls/:callId/release` | Release only an unclaimed reservation. |

Clients cannot supply prices, provider inputs, token evidence, response identities, scope hashes or privileged actors as authority. Server-derived context binds the brief, approved decisions/approval ordinal, exact request, schema, model and pricing. Cloud financial work never falls back to a local store.

`director_planning_consents`, `director_planning_reservations` and append-only `director_planning_commands` are service-only with RLS. Native migration `20261018031931_director_hybrid_planning_consent` is applied. Read/replay/status RPCs remain owner-scoped; observational polling cannot overwrite terminal results or release a hold. Operational pause is checked atomically at reservation/claim.

## Activation contract

Live planning remains disabled. Activation requires all of:

1. An explicitly selected `OPENAI_STORY_MODEL` matching exactly one reviewed OpenAI registry row and actual `model_version`.
2. Active, execution-tested and quality-validated profile flags; exact Responses endpoint and adapter/schema hash.
3. Current rational pricing and model-bound context/token evidence, supported background behavior and an approved provider-data policy.
4. Server-only API credentials, `DIRECTOR_PLANNING_ENABLED=1`, and unpaused operational controls.
5. A current scoped customer grant and successful atomic reservation/claim.

No row or flag was activated in this release. The legacy `/plan` route stays disabled; the new scoped path is the only implemented planning-spend boundary. The general generation shutdown remains paused.

The implementation explicitly uses `store:true` for recoverable background responses. Current [background documentation](https://developers.openai.com/api/docs/guides/background) also describes short-lived background polling with `store:false`; this release does not implement that alternative or claim zero data retention. Uploaded media/vision token handling is outside this text-planning adapter.

## Verification

The final [evidence record](evidence/HYBRID_PLANNING_CHECKS_2026-10-18.json) distinguishes:

- Automated policy/provider/API/cloud-adapter scenarios, including multi-call caps, exact grant replay after changes, concurrent duplicate request claim, scope drift, token-bound tampering, known-ID malformed responses, missing usage, overrun and restart recovery.
- Fourteen isolated PostgreSQL/WASM proof groups using actual SQL and synthetic auth roles. These include RLS/execute boundaries, token arithmetic, pause, scope/approval fences, claim replay, retained unknown exposure, safe summary errors and rollback. They are single-connection checks, not true cross-session race verification.
- Browser fixtures for lost-response identities and explicit recovery controls.
- A real local browser/API/file-store flow using a server-side simulated provider, with no browser request interception: consent without auto-submit, explicit call, reload/poll, usage recording, revocation and preserved story.

Production syntax/build and the local tests pass. Desktop and 390px viewport checks do not establish physical mobile verification. No paid OpenAI call, real-account end-to-end test, writing-quality pilot or two-attempt success is claimed. Vercel/account browser tests remain deferred by user instruction.

## Next dependencies and rollback

Next: Step 6 point 2, structured brief interpretation and department-aware planning, followed by writing/proposal review and targeted revision. Keep endpoint quality validation, precise token metering, approved-result caching, provider invoice reconciliation and production-account tests explicit in the tracker.

Application rollback baseline is `0fc3356ea5fbd4b4d92693b64b69ea228c6067a9`. Leave planning disabled and retain grants, requests, holds, IDs and accounting evidence. Removing the UI must not release unknown charges or delete drafts. Additive database guards should remain until a reviewed replacement preserves their protections.

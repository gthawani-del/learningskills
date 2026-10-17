> Historical planning input. Current consolidated model/tool decisions and pricing are in [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md).

# Film Studio Tool Registry and Routing Specification Review Draft

Revision 1, 2026-10-17 UTC. Planning only: no tables, API routes, endpoint jobs or admin screens were created. This specification extends the existing film and backoffice blueprints.

## 1. Decision

Create one authoritative database registry, managed through the admin backoffice and consumed by backend routing. The admin is the management interface; the database is the source of truth. Avoid a hardcoded list that maps each creative task to one permanent model.

Separate three things: a filmmaking task, a provider endpoint and the tested production profile that permits using that endpoint in a sequence. An endpoint may support several tasks, and a task may have several eligible endpoints.

The customer sees task-level choices and a recommended route, with model detail on demand. Staff see capability evidence, adapter/schema versions, pricing, evaluations, restrictions and release controls.

## 2. Task taxonomy

Initial task definitions: treatment/script planning; script breakdown; character master; reference-preserving character edit; location/prop reference; storyboard frame; reference-guided scene video; text-only establishing/background video; video edit/repair; dialogue TTS; audio transcription/alignment; portrait-plus-audio performance; video-plus-audio lip-sync; singing performance/sync; score/music; ambience/SFX; media analysis; timeline assembly; caption/title composition; final encode.

Differentiate speech from singing and native audio generation from verified synchronization. Deterministic render/analysis tools belong in the broader tool registry with a different adapter/credential class; do not pretend every operation is a fal model.

## 3. Data model proposal

| Entity | Essential fields |
| --- | --- |
| task_definitions | Stable task key/version, input/output contract, hard requirements, review obligations and permission class |
| provider_endpoints | Provider, exact endpoint ID, display label, lifecycle, source, last-seen/checked-at, credential reference, execution mode |
| endpoint_schema_versions | Schema hash/version, immutable input/output snapshots, source response, inspection timestamp, dependency constraints and deprecation |
| capabilities | Endpoint/schema, capability name, value/limits/units, evidence source, status: documented/observed/tested/unknown/unsupported |
| task_endpoint_bindings | Task, endpoint/schema/adapter version, intended use, avoid conditions, mandatory validation and QA, eligible tiers |
| adapter_versions | Normalized input mapping, schema validation, output mapping, timing policy, retries, cancellation and provider-idempotency evidence |
| price_observations | Currency, amount/unit, configuration modifiers, minimums/rounding if known, account/source, checked-at, expiry policy |
| evaluation_runs | Dataset/case version, permitted source assets, endpoint/adapter, exact configuration, results, defects, costs and review evidence |
| sequence_profiles | Approved reference set, visual/performance/timing approach, compatible route bindings, neighbor-matching requirements |
| routing_policy_versions | Eligibility rules, ranking, budget/quality preferences, fallback behavior, release scope and effective time |
| registry_releases | Draft, reviewer, change diff, evaluation evidence, approval, canary scope, activation and rollback history |

Provider secrets are references to server secret configuration, never values in catalog records or browser responses. Keep endpoint metadata access separate from permission to invoke billable tools. Customer project/asset records remain tenant-scoped; staff publishing is a separate privileged operation.

## 4. Seed candidates inspected in this planning pass

Read-only catalog/schema/pricing tools were used on 2026-10-17 UTC through the connected fal account. This does not verify the Vercel FAL_API_KEY's permissions or prove generation quality. All rows are candidates, not approved defaults.

| Exact endpoint | Candidate task | Schema-observed inputs and limits | Avoid/required check | Rate returned at inspection |
| --- | --- | --- | --- | --- |
| fal-ai/z-image/turbo | Fast text-only concept/storyboard drafts | prompt required; image count 1–4; image_size; output jpeg/png/webp; prompt expansion toggle | Not a reference-preserving identity editor: inspected schema has no reference-image input. Optional expansion has an extra stated cost | USD 0.005 per megapixel |
| minimax/h3-max/reference-to-video | Reference-guided scene candidate | prompt and prompt_expansion_mode required; start/end images; optional image/video/audio references; duration 0.92–15 s; resolution 480P/768P/1080P | Reference total ≤12; image refs ≤9; video/audio lists ≤3 each with duration limits. Middle-frame controls require start/end and native 480P/768P. Check actual duration; schema notes up to ~0.7 s extra | USD 0.05 per second |
| elevenlabs/tts/eleven-v4 | Spoken dialogue/narration candidate | text required; voice, language_code, delivery tags, stability, similarity, output format and optional timestamps | Not evidence of singing support. Seed is best-effort. Timestamp descriptions differ in granularity; inspect actual output before alignment use | USD 0.08 per 1000 characters |
| fal-ai/sync-lipsync/react-1 | Existing footage plus approved speech audio | video_url, audio_url and emotion required; both sources ≤15 s; lips/face/head modes; constrained emotion values | Default mismatch mode is bounce; do not allow looping/remapping to silently alter approved timing. Emotion/head edits can violate blocking or performance contract. Singing untested | USD 10 per minute |

Rates are provider lookup observations, not quotes or final bills. Billing configuration, rounding, optional features, minimums and future prices require verification. Preserve provider units; do not claim linear per-second or per-character totals where minimum/rounding rules are unknown. Do not copy these snapshot prices into permanent code defaults.

H3 Max was returned by live recommendation as a published-guidance candidate; the tool also warned that semantic routing search was unavailable. Its rank is curated guidance, not our measured quality evidence. No latency statistics or studio benchmarks were supplied. Model marketing descriptions are not acceptance results.

Four raw schema responses are temporarily retained under /tmp/studio-ux-research/fal-schema-0.json through fal-schema-3.json. These are research artifacts, not durable production registry storage. Implement the snapshot/validation store only after design approval.

Other task classes remain unassigned until exact canonical endpoints, schemas, account permissions and fit are inspected. Do not fill the registry using truncated screenshot strings or invented IDs. Text planning, music generation, identity editing and portrait-only avatar generation need their own discovery/evaluation.

## 5. Enforceable routing

1. Load approved shot contract/version and sequence profile, including intended continuity and authoritative audio/timing where applicable.
2. Distinguish mandatory acceptance requirements, supported direct controls, descriptive cues and flexible variation. If a mandatory requirement cannot be verified or met, disclose the blocker or obtain a contract change; never silently drop it.
3. Filter eligible task bindings by schema, rights/input use, reference capability, duration, aspect ratio, performance mode, timing policy, tenant permissions and available authorized budget.
4. Rank eligible bindings using relevant evaluated quality, sequence matching effort, expected rejected-attempt burden, known costs and observed reliability. Unknown evidence remains unknown, not zero.
5. Produce a route decision with reasons, rejected candidates, limitations, estimate and remaining finishing allowance. This is a preview, not permission to submit.
6. Atomically reserve funds and record operation intent against the approved scope and current quote. Concurrent tasks cannot reserve the same allowance. Unknown submissions retain reservations pending reconciliation.
7. Validate exact payload with the pinned adapter/schema. Preserve prompt transformations and references. Disable automatic prompt expansion for locked requirements unless its effect is explicitly allowed and evaluated.
8. Submit through authorized server execution, record provider identity and reconcile. Internal idempotency does not assert provider duplicate-billing prevention.
9. Retrieve/store outputs and compare them with shot requirements and neighboring takes. A successful job may still fail creative acceptance.

Registry availability or an admin route recommendation cannot grant spending authority. Uploaded scripts, web content, endpoint descriptions and generated text cannot override the approval or budget contract.

## 6. Lifecycle and admin screens

Endpoint lifecycle: discovered → schema-inspected → adapter-validated → bounded smoke-tested → benchmarked → approved-for-task → deprecated/disabled. Store failures and holds explicitly. Catalog discovery is read-only and never auto-promotes a model.

Admin list filters by task, state, endpoint, sequence profile and evidence freshness. Show use/avoid guidance, limits, price basis, evaluation status, and last inspection. Endpoint detail includes schema diff, task bindings, benchmark samples, recent defects, costs and publishing history.

Publishing workflow: import candidate → inspect capabilities/schema/pricing → draft binding → validate mapping → approve bounded test budget separately → run permitted evaluation → review findings → release to a scoped profile → observe → promote or roll back.

Changing an endpoint schema, adapter or routing policy creates a new version. Quarantine incompatible changes. In-flight jobs preserve their original submission snapshot and provenance. Rollback changes future selection without rewriting historical records or accepted assets.

## 7. Proposed internal APIs

These paths are proposed contracts, not deployed routes:

| Route | Purpose and guard |
| --- | --- |
| GET /api/tools?task=... | Return sanitized eligible task options; no secrets or paid effects |
| POST /api/routing/preview | Return decision/quote and limitations for an authorized project version; no submission |
| POST /api/productions/:id/authorize | Record scoped spend authorization; check user role/version/price and explicit approval |
| POST /api/productions/:id/submit | Validate authorization and atomically reserve; create/reuse operation intent before provider submission |
| GET /api/operations/:id | Authorized task/status/cost/retrieval/review visibility |
| POST /api/admin/registry/import | Staff-only read of catalog/schema into candidate records; no model generation |
| POST /api/admin/registry/:id/validate | Validate schema/adapter; paid smoke tests require a separate budgeted command |
| POST /api/admin/registry/releases | Publish reviewed task bindings with evaluation evidence and scope |
| POST /api/admin/registry/releases/:id/rollback | Audited future-routing rollback; does not cancel historical jobs |

The production worker handles submission outside a long browser request. Command and webhook replay must not duplicate reservations, billing events or output assets. Apply role and project authorization to every route, not just navigation visibility.

## 8. Timing, continuity and default-policy traps

Do not select audio loops, bounce, remapping, time stretch or speech truncation by convenience. Compare measured source durations and supported behavior; block or request a reviewed trim/timing change when necessary. A provider's default is not our production policy.

Reference-input support does not prove identity retention. Native sound does not prove exact dialogue or lip-sync. A seed does not guarantee reproducibility across model versions. A timestamp flag does not establish word-aligned singing. A schema's cancellation field does not establish refunds. These distinctions must remain visible in capability and QA records.

Sequence profiles constrain route families, not necessarily one endpoint. Evaluate adjacent shots for visual/performance/timing coherence and matching effort. Do not promote individually attractive takes that violate the film's approved shot contract or sequence treatment.

## 9. Acceptance before implementation release

Test that an unsupported reference requirement excludes text-only routes; changing sequence profile re-evaluates compatibility; stale prices cannot silently increase authorization; parallel requests cannot overspend; unknown submission does not create a second job; schema drift cannot bypass validation; untested singing routes are not labeled supported; admin metadata editing cannot invoke models; secret references never serialize into client values; and a wrong framing/prop/dialogue take cannot pass solely on visual appeal.

No production registry or database migration was created. Recommended next decision: approve the data/permission/lifecycle contract, then inspect remaining task endpoints and run only separately budget-authorized capability tests.

Related execution coverage: [Functionality to Endpoint Matrix](FUNCTIONALITY_ENDPOINT_MATRIX.md), [CSV contracts](FUNCTIONALITY_ENDPOINT_MATRIX.csv), [candidate registry](TOOL_REGISTRY_CANDIDATES.json). These supersede any inference that the four initial endpoint examples covered the whole product.

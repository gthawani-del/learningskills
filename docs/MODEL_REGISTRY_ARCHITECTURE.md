# Director Studio — provider credentials, reviewed models and routing

Updated 19 October 2026. Current user instruction: apply the same architecture to OpenAI and fal. This implementation contract supersedes the earlier single-model environment setting. It does not activate a model or certify generated media quality.

## Deployment configuration

Store `OPENAI_API_KEY` and `FAL_API_KEY` as server-only Vercel environment variables. Keep Supabase service credentials server-only too. Never use a `NEXT_PUBLIC_` prefix, put credentials into registry JSON, return them to a browser or save them with a project. Redeploy after changing Vercel secrets so the serving functions receive them.

Model names, versions, task associations, supported languages/formats, request bounds, pricing and evaluation evidence belong in the Supabase-backed model registry. `OPENAI_STORY_MODEL` and `DIRECTOR_PLANNING_ENABLED` are no longer runtime configuration. The retired legacy planning helper cannot submit a request. Operational generation pause, reviewed registry eligibility and project spending authorization govern new submissions.

## Model lifecycle

1. An owner creates or updates a credential-free model draft in Backoffice → Model registry. A draft has its own version and profile hash. Saving it leaves the serving model unchanged.
2. The owner records actual schema, configuration-specific price, execution and quality evidence for the exact provider, endpoint, model version and tasks. OpenAI planning additionally needs operation bindings, language/format coverage, reviewed background-response retention and complete-request token bounds. Merely checking boxes does not run a benchmark.
3. The owner reviews the exact saved draft and submits publication with its version, hash, control revision, reason and evidence acknowledgement. The backend validates supported adapters, fresh evidence and exact bindings. Unknown or unsupported functions remain held.
4. Publication records immutable before/after profiles and review evidence. It increments the operational revision; it does not clear the global generation pause or authorize a customer's spending.
5. Any unresolved job, unknown charge or outstanding planning reservation on that model blocks publication. Current serving-profile changes also invalidate an older draft's publication baseline. Save a fresh draft after resolving the conflict.

Only server-derived owners can save/publish. Operators can retain their existing pause/disable permissions; reviewers can inspect. Customers and browser metadata cannot grant staff access. Drafts, releases and command receipts are service-only database records with RLS and append-only history.

The API uses `GET /api/admin/registry` and `POST /api/admin/registry/commands` (`save_draft` or `publish_draft`). Request IDs bind exact commands; an unconfirmed response is reconciled by explicitly retrying the same payload and ID. There is no automatic publication retry. Registry fields accept bounded plain JSON and reject credential/header fields. Provider hosts are fixed by implemented adapters.

## How the router decides

The request supplies a production task and project constraints. Registry discovery finds candidates; it grants no execution permission. The server checks the exact task/operation binding, active/reviewed state, supported input/output configuration, schema, fresh prices, evidence, project scope and financial limits.

Suitable candidates are ranked by reviewed fit and priority. Explicit quality, language, format, duration and budget constraints can hold a route. Cheapness alone does not determine the choice. Fresh measured routing evaluations support quality and latency preferences; an unsupported preference is held rather than invented. Route previews explain the selected model and candidate holds.

An OpenAI planning estimate is operation-specific:

| Operation | Registry task | Current execution adapter |
|---|---|---|
| `interpret_brief` | `brief_interpretation` | OpenAI Responses, structured brief proposal |
| `initial_plan` | `film_planning` | OpenAI Responses, film/shot plan proposal |
| `revise_plan` | `film_plan_revision` | OpenAI Responses, plan revision proposal |
| `write_script` | `screenplay_writing` | OpenAI Responses, screenplay proposal |
| `revise_script` | `screenplay_revision` | OpenAI Responses, scoped screenplay proposal |
| `plan_departments` | `department_planning` | OpenAI Responses, all-17-department plan proposal; separately reviewed v4 contract |
| `revise_departments` | `department_revision` | OpenAI Responses, exact requested subset of department revisions; separately reviewed v5 contract |

`GET /api/projects/:id/planning/:operation` previews that task. The existing `/planning` route defaults to brief interpretation. Planning allowances record the operation and selected model/profile. The UI sends the displayed model ID and fingerprint as expectations; a changed route requires a refreshed review. New allowances are for one operation; historical operation-less allowances retain their original scope. A future multi-operation or multi-model allowance needs its own explicit authorization contract.

Starting or resuming a call uses its authorized model, not whichever candidate now ranks first. A price/profile/scope change holds new submission. A failed or uncertain request never triggers a hidden model switch or paid retry. Known provider requests remain inspectable and reconcilable using their saved request/profile snapshots.

## Point 4: department planning

The five earlier operations retain their `director-planning-v3` request contracts and schema hash. `plan_departments` is an additive sixth operation using `director-planning-v4`. A registry profile does not inherit eligibility by supporting writing or film planning: it must explicitly declare `plan_departments` and `department_planning`, the separate reviewed schema fingerprint, a fresh operation binding, execution/quality evidence and the existing token/price/retention controls. Its current aggregate fingerprint covers the typed schema, complete versioned craft guidance, dependency policy and request-context digest format. The Backoffice registry response exposes implemented contract hashes; those hashes establish compatibility, not benchmark approval. Earlier saved v3/v4 calls retain their exact requests for recovery.

The current approved structured brief and approved, source-current screenplay are prerequisites. The source-comparison review has its existing limited-coverage boundary; it is not legal or universal originality clearance. The planner reads the whole script and all known reviewed brief fields, including explicit/inferred provenance, supplied product restrictions, original-vocal decisions and casting constraints. It covers these stable responsibilities:

`producing`, `direction`, `script_breakdown`, `casting`, `look`, `locations`, `camera`, `lighting`, `voice`, `sound`, `music`, `continuity`, `storyboard`, `animatic`, `vfx`, `editorial`, `rights`.

Each typed document has applicability and rationale, a summary, source-linked requirements/choices, handoffs and acceptance checks. Source IDs must exist in the bound screenplay. New model choices remain proposed or need a decision; the model cannot select an identity/voice, invent assets/permissions or replace explicit user choices. Casting/look start with conditional visibility review because the script schema does not distinguish an off-screen narrator from an on-screen character through a structured field. All units remain represented, including those requiring an explicit non-applicability reason. See [Department Planning Knowledge](DEPARTMENT_PLANNING_KNOWLEDGE.md).

Two paths remain distinct:

- **Free rules and manual editing:** `GET/POST /api/projects/:id/department-plans` supports `prepare`, `update` and acknowledged `refresh`. Preparation fills missing units from grounded facts and reviewed craft rules; it does not overwrite existing plans. An explicit refresh updates one unit against the new source and retains still-valid user-selected planning choices. No provider call or media generation is started.
- **Paid initial planning proposal:** preview `GET /api/projects/:id/planning/plan_departments`, obtain the operation-specific estimate/allowance, then use the existing planning-call lifecycle. Apply a completed project-owned saved proposal through `POST /api/projects/:id/department-plans/apply-proposal` with the expected project version and call ID. Exact current source/decision context is checked before application; persistence also binds approval ordering. For this initial-plan operation, source-fresh last-approved documents remain protected even when dependency review is held; existing explicit user choices must remain unchanged. An explicit targeted revision follows the separate contract below.

The request retains the complete brief, screenplay, raw supplied sources, current department documents and guidance. Duplicate opaque department source/decision signatures are sent as SHA-256 bindings, rather than repeating their full canonical content. Complete-request byte/token bounds still hold; oversize input is held without silently deleting source material or increasing authorization. A known paid call is recovered against its saved knowledge pack, never silently reinterpreted under a newer one.

Plan approvals bind `department:<id>` and its exact version, require current source/dependency context and an explicit planning-only acknowledgement, and remain separate from media/identity/voice/rights/cost approvals. Source changes preserve earlier plans as stale; they do not regenerate them. A focused department edit changes that unit’s version and leaves neighboring content/history intact while the declared dependency graph derives affected review holds.

## Point 5: targeted department revisions and dependency freshness

The fixed catalog DAG is versioned as `director-department-dependencies-v1`. Each new snapshot records a `dependencyContext` with its policy version and exact direct-upstream department versions, stamped by the server from the final candidate archive. Currentness checks distinguish source holds from dependency holds and propagate upstream staleness transitively. A camera version change holds lighting, continuity, storyboard, animatic, VFX and editorial; it leaves their documents/history and unrelated rights/voice/music records unchanged. This is declared department-graph impact, not semantic inference about which words or scene details changed.

Free `review_dependencies` records the user’s explicit acknowledgement, preserves the current document/choices and creates a new unapproved revision pinned to the current upstream versions. The unit’s own source and upstream chain must be fresh. Upstream creative approval order is not required; graph freshness is checked independently. Legacy snapshots missing pins remain byte-preserved but held until explicit review, including the rights unit whose upstream list is empty. No read or migration silently approves or rewrites them. The existing all-17 current planning-approval production/spending gate remains separate.

Free `request_revision` at `POST /api/projects/:id/department-plans` saves an immutable request with the catalog-ordered target department IDs, instruction, source version and every current department version. Any bound source/department-version change makes it stale. Saving a request starts no paid work. `revise_departments` then uses registry task `department_revision`, its own `GET /api/projects/:id/planning/revise_departments` route preview/allowance, and `director-planning-v5`. The model must return exactly the requested subset. Apply a completed owned saved call through `POST /api/projects/:id/department-plans/apply-proposal` with `expectedVersion` and `callId`: the same endpoint supports both initial plans and revisions, with behavior determined by the saved reservation’s operation rather than a client-supplied operation. An explicitly targeted currently approved document may change; all existing `user_selected` choices remain protected, and every nonselected document/history remains unchanged. Applied target revisions are unapproved; graph holds on descendants do not silently regenerate them.

A profile declaring `revise_departments` requires the highest aggregate revision schema fingerprint, covering the current department-planning aggregate, full dependency policy, v5 schema and instructions. A profile declaring only `plan_departments` needs the current v4 aggregate. Each operation still needs fresh exact task/operation and execution/quality evidence; there is no automatic upgrade from one task or request version to another. Existing saved v3/v4 requests remain recoverable under their exact saved body/schema/instructions; new derived dependency fields are not required to validate a historical v4 request. The v5 operation is not permission to reinterpret old paid requests or reuse a different operation’s allowance.

Whole brief/script changes still conservatively hold all department source plans. Semantic field/scene impact, comprehensive later media-artifact dependency wiring, actual filmmaking quality and production-output acceptance remain separate incomplete work. The graph/revision implementation does not complete those broader requirements.

## Cost and recovery

OpenAI pricing uses reviewed rational input, cached-input and output token rates. The displayed maximum reservation uses the complete reviewed request/context bound and output limit; it is not a promise of typical cost. An explicit task cap can reject unsuitable routes. Actual recorded usage settles the original call; missing usage or overruns retain an unresolved hold.

Fal media quotes use reviewed configuration-specific scalar or composite tariffs, actual requested units and the existing project quote/authorization/reservation lifecycle. Route publication does not authorize variants, retries or fallback generation. User-facing per-creation billing and provider invoice reconciliation remain separate incomplete commercial work.

## Coverage and release limits

This batch manages both providers through one reviewed registry lifecycle. It does not make the entire fal catalog executable. Current reviewed fal execution adapters are:

| Endpoint | Supported task |
|---|---|
| `minimax/h3-max/reference-to-video` | `reference_video` |
| `bytedance/seedream/v5/pro/edit` | `image_edit` |
| `elevenlabs/tts/eleven-v4` | `speech_synthesis` |

Other valid fal endpoint identities can be researched and saved as drafts. Publication for execution requires a reviewed implemented adapter, exact schema hash, supported task/input configuration and actual test/quality evidence. OpenAI functions outside the seven listed planning operations still need their own schemas, adapters and acceptance checks.

Point 4 implements department **planning records, review and proposal handling**. It does not produce selected casting images, look/reference assets, voice auditions, actual storyboard frames, a playable animatic, footage, song analysis or a finished film. The plans identify those tasks and later approval evidence. Real-model department judgement, media quality and the two-attempt target require separate controlled production validation.

No real paid call or model-quality pilot is implied by local synthetic tests. Vercel/deployed account checks remain deferred; physical mobile and real generated-output review remain outstanding. Default generation pause and inactive native model records remain unchanged by installing the migration.

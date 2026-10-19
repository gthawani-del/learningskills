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
| `plan_storyboard` | `storyboard_planning` | OpenAI Responses, ordered typed shot-contract handoff; separately reviewed v6 contract |

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

## Point 6: storyboard shot-contract handoff

The eighth operation, `plan_storyboard`, requires the current approved structured brief, source-current approved screenplay and all 17 current approved department plans with fresh dependencies. A reviewed writing/department model does not inherit this capability: registry task `storyboard_planning`, its exact operation binding, current v6 aggregate schema/guidance fingerprint, fresh execution/quality evidence, prices, complete-request bounds and an operation-specific spending allowance are required. The `director-planning-v6` request returns ordered shot-contract proposals, not storyboard images. The highest aggregate fingerprint covers the earlier request contracts plus the complete handoff guidance and typed schema. Known v3/v4/v5 requests retain their exact saved retrieval/recovery contracts.

The full source context includes the whole approved script, raw supplied text sources, all current approved departments and existing handoff/shot decisions. Duplicate opaque bindings and already represented artifact copies are avoided without deleting actual source material. Complete-request bounds remain enforced. The result must cover every source scene and assign every source dialogue ID exactly once in its actual scene, using the original screenplay wording. Speaker IDs are story associations and do not make an off-screen narrator visible.

Contracts record purpose/action, framing, motivated camera/light intent, estimated duration, intended start/end state and continuity; mandatory/flexible requirements with future evidence/failure conditions; reference requirements; control classifications and audio/performance intent. The only control classes are `prompt_only`, `reference_required` and `route_verification_required`. They do not certify native parameters, selected assets, actual timing or observed media quality. See [Storyboard Handoff Knowledge](STORYBOARD_HANDOFF_KNOWLEDGE.md).

Free `GET/POST /api/projects/:id/storyboard-handoff` supports preparation, focused contract updates, explicit reorder, sequence-version review and acknowledged source refresh. Preparation provides a transparent one-shot-per-scene starting point; scenes beyond the 900-second per-contract estimate limit are held for splitting/replanning rather than silently truncated. That limit is not a provider capability or recommended shot length. Independent contract histories and a separate sequence history preserve earlier work. Managed fields in the legacy flat shot workspace are backed by these contracts; existing media identities and separate editing/reference controls are preserved.

Legacy flat shots require free source-linked adoption before a model proposal can replace the managed workspace. Missing/unassigned source scenes, ambiguous/changed dialogue and duplicate source-line coverage hold adoption without deleting the draft or media. Missing action, continuity or mandatory criteria stay visible and hold approval. For an existing archive, preparation appends only missing current-scene/dialogue coverage and a new draft sequence version; every old contract document/version, media association and relative order remains intact. If coverage is already complete preparation is a no-op, including when sequence pins need explicit review. Stale or removed-source contracts remain held; partial drafts can be saved without bypassing full coverage/source checks for model acceptance or approval. All 17 department versions are source-pinned: changing any one conservatively holds all current shot contracts; this is not selective semantic shot-impact analysis.

Paid planning is previewed at `GET /api/projects/:id/planning/plan_storyboard` and follows the existing explicit allowance/reservation/call lifecycle. Apply a completed project-owned saved proposal at `POST /api/projects/:id/storyboard-handoff/apply-proposal` using the expected project version and call ID. All existing active IDs and their relative order remain protected; source-fresh approved documents must be returned unchanged. Reordering existing shots is a manual decision. An effectively approved sequence holds a new paid call until an explicit edit/order change reopens review; a saved result cannot silently change an approved sequence’s exact quantity/order.

The sequence review binds ordered exact current shot versions. Its single `storyboard_sequence` planning-only approval checkpoint writes the exact current `shot_contract:<id>` approvals and sequence decision together through guarded atomic persistence; individual contract approval cannot bypass it. Changed source, contract versions, order or review context cannot silently inherit earlier sequence approval. A focused shot edit preserves neighboring contract histories/approvals while the sequence’s old pins require explicit review. Approved department/contract/sequence plans do not select cast, references, voices or media, clear rights, authorize spending or render an animatic. Actual frame generation, measured audio/song timing, playable animatics, take review and real-model/filmmaking quality remain subsequent work.

## First Step 7 increment: reference images and selected identities

Reference production is a fal media workflow, not a ninth OpenAI planning operation. `director-reference-production-v1` keeps independent source/subject histories and append-only selections for `character_identity`, `character_look` and scene `location` work. Stable IDs are `identity:<characterId>`, `look:<characterId>` and `location:<sceneId>`. Current approved brief, source-current screenplay and all 17 fresh approved department plans are prerequisites; reference images precede storyboard images, so they do not require storyboard approval. The narrow reference-task exception cannot authorize unrelated footage/audio or treat a selection record as a media-generation target.

Free `GET/POST /api/projects/:id/reference-production` provides source-grounded preparation, focused direction changes/acknowledged refresh, server `add_uploaded` registration and explicit candidate selection. It preserves old subjects, source/selection histories and media. Preparing an identity row does not force a written off-screen role on screen or request a paid portrait. Directions contain anchor/framing/must-preserve details and acceptance criteria with evidence/failure conditions. Photographic versus stylized intent comes from the approved project. A look needs the exact currently approved selected identity and binds its subject, selection and asset versions; a changed identity holds the earlier look until explicit rebinding.

`POST /api/projects/:id/reference-production/quotes` builds canonical input on the server from the exact current approved reference direction, source and reviewed model configuration. Clients cannot inject raw prompts or arbitrary image URLs. `reference_image` is text-origin identity/location work; `reference_look` is an identity-preserving edit with the selected private identity image. Look quoting requires explicit provider-sharing consent. Model choice still requires supported adapters, correct task/schema/configuration, current price and execution/quality evidence, and operational enablement. A skill's premium default or cheap default is not eligibility evidence.

The image prompt contains the complete selected subject document, exact source character or scene heading/action, four direct visual brief fields and six complete relevant department documents. All source versions remain bound, but this is not full-screenplay injection or a new full-film reasoning operation. The 100,000-byte prompt bound fails closed without truncating included facts. The implemented text-to-image adapters are `fal-ai/flux-2-pro` and `fal-ai/flux-2/klein/9b`; identity looks use `bytedance/seedream/v5/pro/edit`. This module fixes one 1024×1024 PNG with asynchronous output and safety checks enabled. Public schema/price observations remain distinct from approved executable profiles; Klein's exact megapixel rounding/quote remains unresolved.

The quote uses the existing project authorization/reservation/job lifecycle. Explicit `POST /api/projects/:id/reference-production/jobs` starts one image per paid attempt; allowance approval alone starts no job. Idempotent requests and the existing work-unit two-attempt, pause, expiry, cost and uncertain-submission gates remain in force. There is no hidden three-option casting batch, automatic paid retry or separate reference wallet.

`POST /api/projects/:id/reference-production/reviews` records the visible correction needed against a saved job and current project version before another attempt on the same work unit. It does not rewrite the approved direction, automatically repair the image or start a job. Changed direction still needs a new exact review/quote/authorization context. The existing `/api/projects/:id/spending-budget` control sets a project cap and protected finishing reserve; it is distinct from a scoped spending authorization and does not start work.

Completed owned output is imported with its job ID through `POST /api/projects/:id/reference-production/import`. The controller uses the saved job/output audit, accepts a single supported fal-CDN PNG with bounded byte/dimension checks and redirects rejected, copies it to private project storage and records checksum/provenance before immutable candidate registration. It accepts no caller output URL. Generated imports have a 10 MiB bound; existing user-upload limits are unchanged. Failed import/download recovery reuses the original job and receipt rather than generating again. Provider URLs are not the permanent reference archive.

Explicit selection binds a current candidate, direction/source and exact stored image; selected and approved remain distinct. Existing `/api/projects/:id/approvals` accepts `reference_selection:<subjectId>` only with the current candidate/source/direction checks and `acknowledgeReferenceReview:true`. This is a human visual decision, not automatic anatomy/identity verification, rights clearance, voice approval or spending permission. Look selection remains bound to the approved selected identity. Direction/identity/source edits preserve old media and hold affected authority. All 17 department versions are conservatively source-bound; semantic field-level impact is not claimed.

No automatic generic production-record projection, storyboard media assignment or copy of trusted candidate/approval authority on device import is added. This increment does not generate storyboard frames, timed animatics, voice auditions, final footage or a finished film. Independent props/SKUs, complete angle/reference-sheet coverage, image-assisted quality calibration, real provider quality/price pilots and later exact storyboard/media binding remain work. See [Reference Production Knowledge](REFERENCE_PRODUCTION_KNOWLEDGE.md) and F033–F036 in the Bible for craft rules and scope.

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
| `fal-ai/flux-2-pro` | `reference_image`, fixed one-image 1024×1024 PNG configuration |
| `fal-ai/flux-2/klein/9b` | `reference_image` adapter; exact price rounding remains held |

The `reference_look` task uses the bounded selected-identity configuration of the existing Seedream edit adapter. Added schemas/adapters do not publish or activate a registry profile; real execution/quality evidence remains required.

Other valid fal endpoint identities can be researched and saved as drafts. Publication for execution requires a reviewed implemented adapter, exact schema hash, supported task/input configuration and actual test/quality evidence. OpenAI functions outside the eight listed planning operations still need their own schemas, adapters and acceptance checks.

Point 4 implements department **planning records, review and proposal handling**. It does not produce selected casting images, look/reference assets, voice auditions, actual storyboard frames, a playable animatic, footage, song analysis or a finished film. The plans identify those tasks and later approval evidence. Real-model department judgement, media quality and the two-attempt target require separate controlled production validation.

No real paid call or model-quality pilot is implied by local synthetic tests. Vercel/deployed account checks remain deferred; physical mobile and real generated-output review remain outstanding. Default generation pause and inactive native model records remain unchanged by installing the migration.

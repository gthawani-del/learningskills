# Director Studio — Development Tracker

Updated 19 October 2026. Baseline before the routing/quote batch: `76960d5`. This is an implementation ledger, not a replacement blueprint.

Tracked: **167 acceptance/function items**: 105 functions, 32 frontend criteria, 18 realism scenarios and 12 admin scenarios. Also indexes 108 numbered sections across the six active specifications.

Status: 67 partial, 94 missing/unverified, 6 explicitly deferred. **Zero items are claimed fully production-accepted.** Partial describes existing implementation, not a completion percentage.

Canonical records: [JSON](DEVELOPMENT_REQUIREMENTS.json) and [CSV](DEVELOPMENT_REQUIREMENTS.csv). Each row includes source, implementation paths, test paths, evidence limits, next gap and dependencies. The CSV is a readable export of the same review.

## User correction: complete filmmaking units — 18 October 2026

Mandatory character/identity selection, look development, voice auditions or explicit original-audio choice, generated storyboard frames and a playable timed animatic are required before their dependent final production. Every department needs applicability, outputs, versioned approvals, cost and recovery evidence. Existing text shot lists/record APIs do not complete these stages. Earlier scenario generation budgets omitted preparation and must be recomputed as full-workflow estimates. See the Bible's mandatory department workflow correction. No implementation status is upgraded by this specification update.

## User requirement: per-creation costs and economical models — 18 October 2026

Every user must see itemized creation costs before authorization, reserved/pending costs during work and reconciled charges/credits afterward. Preparation and repairs count. Compare suitable Wan, FLUX and other budget candidates under the same approved quality constraints; dated rates do not activate routes. Estimate/billing UI and quality-constrained cost optimization remain incomplete.

## Routing/spending implementation — 18 October 2026

[Acceptance record](SPENDING_AUTHORIZATION_ACCEPTANCE.md): evidence-ranked job intent, dynamic reviewed task bindings, scalar/composite quotes, durable receipts/caps/revocation, owner-safe APIs and Costs UI implemented. 168 automated tests and production build pass; real local browser/server flow has no console/HTTP errors. Database migration `20261018025605` applied, service-only grants/RLS/pause verified and security advisor clean. Thirteen isolated PostgreSQL proof groups pass; true cross-session races, deployed account/browser integration, live billing-feed settlement and media pilots remain unverified. A pure cost-reconciliation foundation is not complete customer billing. No requirement is upgraded to full acceptance.

## Hybrid planning authorization — 18 October 2026

[Acceptance record](HYBRID_PLANNING_ACCEPTANCE.md): Step 6 point 1 is implemented with scoped initial limits, multiple bounded calls, deterministic manual paths, token-bound maximum reservations, exact replay, safe resume/cancel and usage recovery. 213 tests/build and local browsers pass; fourteen PostgreSQL proof groups pass; migration `20261018031931` applied and security advisor clean. Live planning stays disabled with zero active OpenAI models. No new requirement is fully production-accepted. Structured brief implementation is covered in the following batch; writing/department workflows and quality pilots remain outstanding.

## Structured brief and creative intent — 18 October 2026

[Implementation and acceptance record](CREATIVE_INTENT_INTELLIGENCE.md): Step 6 brief interpretation now includes versioned explicit/inferred/unknown fields, focused questions, department handoffs, free corrections and a bounded AI proposal path with explicit review/application. Approved choices, current source settings and media history are preserved. Stale proposals and approvals are held. 251 automated tests and production build pass; actual local device/API browsers pass with no console/HTTP errors. A simulated provider proves orchestration, not real creative quality. Seventeen isolated PostgreSQL proof groups pass; migration `20261018035212` applied, service-only grants/RLS verified and security advisor clean. F010 moves from missing to partial. Live paid interpretation, deployed accounts, physical mobile and production quality remain unverified.

[Competitor review](CREATIVE_INTENT_COMPETITOR_REVIEW_2026-10-18.md): fresh official Luma, Hedra and Krea guides inform reference roles and preserved constraints. Fresh REA inventory succeeded but listed Privacy error pages; product UI and bundle checks were blocked. No internal Theory of Mind architecture is asserted.

## Briefing UX correction — 18 October 2026

User feedback supersedes the earlier sixteen-field modal and two-column form. The Brief stage now shows a compact prefilled proposal on the main canvas, with one editor on demand and an optional project-settings drawer. Known look/tone values remain visible; optional unknowns are deferred rather than turned into required fields or generic creative fallbacks. Read-only AI review shows actual changes that survive protected-choice rules. Unsaved edits cannot be approved; scoped drafts and failed-save input are preserved during client navigation.

[Current evidence](evidence/COMPACT_BRIEF_UX_CHECKS_2026-10-18.json): 258 automated tests and production build pass. Actual local device, v2 workspace and simulated-provider browser flows pass without console/HTTP errors. Controlled storage failures/delays are labelled fixtures. No new migration or real paid call; physical mobile, deployed accounts and live creative-quality gates remain outstanding. No requirement is upgraded to full production acceptance.

## Mobile briefing footer fix — 19 October 2026

The fixed bottom navigation covered the composer note by 17–32 pixels at narrow widths. Mobile briefing now reserves its own navigation row, keeps the composer and note in flow, and scrolls the brief independently. Transient status messages also receive space. The fix is limited to mobile briefing; desktop and production layouts retain their existing behavior.

[Evidence](evidence/MOBILE_FOOTER_FIX_2026-10-19.json): actual local Chromium geometry and interactions pass at 390×880, 390×844, 375×812, 360×640 and 390×520, with zero console/HTTP errors; 258 tests and the production build pass. Physical mobile devices and actual on-screen keyboards remain unverified.

## User clarification: LLM writing is the default — 19 October 2026

Most users should describe their idea and have the LLM write the treatment and script from the approved brief. Uploading a script is optional, never a prerequisite. Preserve uploaded originals and distinguish requested use, editing and adaptation. Track LLM-generated, user-supplied and mixed provenance without treating upload as proof of ownership. Both paths require the planned deterministic, version-bound originality/source-use checks; generated output is checked against permitted sources even with no uploaded reference. The LLM cannot approve its own originality. See the Bible's script entry/originality clarification and the blueprint user journey. The subsequent writing batch implements proposals, versions and project-source comparison; wider comparison coverage and real writing quality remain unverified. See the writing acceptance record and current statuses below.

## Screenplay writing and deterministic source review — 19 October 2026

[Acceptance record](WRITING_WORKFLOW_ACCEPTANCE.md) and [checks](evidence/WRITING_WORKFLOW_CHECKS_2026-10-19.json): the default approved-brief-to-screenplay proposal path, optional exact UTF-8 source preservation, versioned review/application, scoped revisions, current-source gates and readable Story UI are implemented. Deterministic originality checks cover only the project's supplied text; no-source scripts show unavailable comparison coverage, not originality clearance. Incomplete reviews hold approval. F006 and F013 move from missing to partial; no requirement becomes fully production-accepted.

318 automated tests, syntax checks and production build pass. Actual local Chromium writing and controlled navigation-failure recovery pass; brief, v2 editing/media playback/draft export, footer and brief-proposal browser regressions pass. Normal runs have zero console/HTTP errors; the recovery fixture records its one deliberate 503 separately. Nine isolated PostgreSQL proof groups pass. Migration `20261019093706` is applied; service-only privileges, RLS, empty-input rejection and a clean security advisor are verified. Live planning remains disabled, generation paused, and no paid call occurred. Physical devices, deployed accounts, real writing/language quality and wider comparison coverage remain unverified.

## Current batch and dependencies

- Audit: complete as an initial baseline; refine each row while implementing. Broad section coverage is not line-by-line certification.
- Cloud sessions: refresh rotation/current-browser logout and adapter/client tests deployed in the previous batch; live Supabase verification still blocked by deployment configuration.
- Device-to-cloud migration: retry-safe checksummed project/media import, note preservation and reference rebinding implemented. Interrupted-upload recovery passes through the real local demo API/browser. Device source remains intact; device approvals are not imported. Real Supabase integration pending.
- Vercel-dependent cloud tests deferred by user instruction. Continue other modules; do not print or recover service keys through SQL.
- Operations: role-scoped audited pause/model-disable/notes controls implemented. Database pause guards and rollback fixtures pass; local backoffice browser checks cover interrupted-response recovery. Staff lifecycle/MFA, tenant controls and commercial operations remain incomplete.
- Media/AI: routes remain inactive; no paid call, quality result or two-attempt success is established.
- Export: local FFmpeg proof only; no hosted worker selected.
- UI: deployed v2 layout and browser-device editing flow; physical mobile tests outstanding.

## Earlier verification baseline

88 automated tests, syntax checks and production build pass locally for the operational-controls update. The prior library release 539b65b passed live public-site library and v2 workspace browser checks. New migration browser recovery test passes against the local demo API. Scene/brief dependency tests cover selective invalidation and preservation of neighboring shot versions/media. Typed library history, scoped references, transitive dependency holds, selective invalidation and import preservation are implemented and tested locally. Twelve SQL currentness fixtures pass on Director Supabase, with service-only execute privileges and no security-advisor findings. Live application/Supabase integration and media-quality acceptance remain incomplete.

Retries resend whole files; byte/chunk-resumable transport is not implemented. Scene edits preserve neighboring shot versions, but global story reapproval still holds their route readiness.

## Execution order

| Step | Deliverable | Exit evidence |
|---|---|---|
| 1 | Requirements reconciliation | Complete initial ledger, precedence and implementation gaps |
| 2 | Cloud identity, project and private-media persistence | Two real accounts; refresh/logout, cross-account isolation, cross-browser restore; retry-safe device migration |
| 3 | Versioned production records and dependency graph | Changed artifacts invalidate only dependent approvals; stable take/reference versions |
| 4 | Pre-generation backoffice | Staff permissions, registry release controls, audit, spending/route kill switches |
| 5 | Routing, costs and ledger | Current schemas/prices, server quotes, atomic authorizations, idempotency, reconciliation |
| 6 | Intelligent Director | Structured brief/script/breakdown and scoped revisions through reviewed skills |
| 7 | Visual production and realism | Character/world references, storyboard, footage and actual continuity/temporal review |
| 8 | Audio, avatar and music video | Song analysis, canonical lyrics, voice/lip sync, singing evidence and sound production |
| 9 | Edit and hosted delivery | Durable render workers, accepted-media assembly, sound mix, captions and verified exports |
| 10 | Full frontend acceptance | C01–C32 with desktop, viewport, keyboard and physical-device evidence |
| 11 | Commercial and operational completion | Billing/support/retention/restore/incident and founder scenarios |
| 12 | Production pilots | Finished short film, music video and avatar; actual cost and acceptance measurements |

## Function coverage

| ID | Function | Step | Status | Next gap |
|---|---|---|---|---|
| F001 | Explore pre-rendered sample | 2 | missing | No complete executable workflow found; implement and verify before activation. |
| F002 | Sign up and sign in | 2 | partial | Password login/session rotation implemented; signup, verification and recovery UX missing; live credentials pending. |
| F003 | Recover account and end session | 2 | partial | Current-session logout implemented; password recovery/reset and live revocation verification missing. |
| F004 | Create or reopen project | 2 | partial | Create/reopen plus retry-safe import implemented; real authenticated Supabase cross-browser verification pending. |
| F005 | Autosave and resolve concurrent edits | 2 | partial | Optimistic saves exist; full autosave UX, conflict merge/recovery and live database concurrency verification missing. |
| F006 | Import script/project | 2 | partial | Optional UTF-8 TXT/Markdown scripts preserve original text, use declarations and immutable working versions; device import preserves sources while stripping approval/review authority. PDF/DOCX, semantic screenplay parsing and deployed-account import remain unverified. |
| F007 | Search project and media library | 2 | missing | No complete executable workflow found; implement and verify before activation. |
| F008 | Upload and finalize source media | 2 | partial | Checksummed retry-safe whole-file migration and metadata recovery implemented for files up to 2 MB; signed/resumable large-media uploads and live storage verification missing. |
| F009 | Preview or download private media | 2 | partial | Owner-scoped proxy retrieval/device preview exist; large-media range streaming and live cross-account access tests missing. |
| F010 | Interpret brief and ask necessary questions | 6 | partial | Compact proposal reuses the actual idea/settings and reviewed choices with optional one-field edits; missing optional details do not require a questionnaire. Bounded AI interpretation supports read-only actual deltas. Real LLM interpretation/question quality, attachment analysis, deadline/control coverage and deployed account checks remain unverified. |
| F011 | Research and source-backed creative context | 6 | missing | No complete executable workflow found; implement and verify before activation. |
| F012 | Develop treatment and story arc | 6 | partial | Bounded film-plan proposals now consume current approved brief/story/shot/character/voice constraints; fresh brief approval required when present. Real model activation, treatment/writing quality and full script/department workflows remain unverified. |
| F013 | Write screenplay and dialogue | 6 | partial | Default LLM screenplay proposals, optional preserved uploads, versioned review/application, scoped revisions and project-source originality gates implemented. Real OpenAI writing/language quality, wider permitted comparison corpus and deployed-account/browser acceptance remain unverified; production profiles disabled. |
| F014 | Script breakdown and production plan | 6 | partial | Seventeen source-bound department plans now have a fixed dependency policy, exact upstream-version pins and explicit scoped revision requests. Free preparation/manual review and separately authorized v4 initial/v5 selected-subset proposals preserve source facts and user choices. Production scheduling, real-model planning quality and production execution remain incomplete. |
| F015 | Direct scene blocking and performance | 6 | partial | Scene-linked direction and performance requirements cover dramatic purpose, observable behavior, blocking, eyelines and character knowledge as reviewable proposals. Actual staged/generated performances, measured timing and real model-output quality remain unverified. |
| F016 | Plan camera, lighting and coverage | 6 | partial | Source-linked camera/lighting/coverage plans support versioned edits and declared dependency holds: a changed camera plan holds lighting, continuity, storyboard, animatic, VFX and editorial while preserving their documents/history. Actual renderer control fidelity, complete shot contracts and generated coverage/lighting quality remain unverified. |
| F017 | Plan continuity and character knowledge | 6 | partial | Versioned continuity plans distinguish intended source state and declared upstream department-version dependencies; stale chains hold current review without deleting approved history. Observed generated-media continuity, complete character-knowledge tracking, semantic scene-level impact and full media-artifact dependency wiring remain unverified. |
| F018 | Create sound/music cue plan | 6 | partial | Source-linked sound and music planning now separates dialogue, ambience, Foley/effects, music sources, provisional cues and actual listening/timing review. Audio generation, song analysis, measured cue timing, final mixing and real quality remain unverified. |
| F019 | Translate/localize approved dialogue | 6 | missing | No complete executable workflow found; implement and verify before activation. |
| F020 | Interpret natural-language revision | 6 | partial | Explicit free saved department revision requests bind selected catalog-ordered targets, instruction, current source and all seventeen versions. Separately authorized revise_departments/v5 proposals may change requested approved targets only, preserve every user_selected choice and leave nonselected content/history unchanged. Real semantic revision quality, actual paid costs and broader natural-language media-edit impact remain unverified. |
| F021 | Approve creative version | 6 | partial | Department approvals require exact current version, approved brief/script, fresh declared dependency context and planning-only acknowledgement. Legacy missing-pin units, including rights, require explicit review; fresh upstream chains do not require upstream approval order. The all-seventeen production/spending approval gate remains separate. Actual media/rights acceptance and deployed-account races remain unverified. |
| F022 | Invalidate dependent approvals on change | 6 | partial | Server-stamped exact upstream-version pins and the fixed department DAG now derive direct/transitive review holds while preserving documents, choices and approval history. Explicit review_dependencies keeps the document in a new unapproved revision; targeted proposals change only requested units. Whole brief/script changes still hold all source plans. Semantic field/scene impact, complete future media dependencies and deployed concurrency remain unverified. |
| F023 | Decode song and inspect metadata | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F024 | Understand song mood, instrumentation and development | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F025 | Secondary audio-question/interpretation benchmark | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F026 | Transcribe speech or attempt sung lyrics | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F027 | Edit and confirm canonical lyrics | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F028 | Align known lyrics/dialogue to recording | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F029 | Separate optional vocal/instrument stems | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F030 | Estimate tempo, beats, onsets and energy | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F031 | Propose musical sections and visual pacing | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F032 | Map song moments to story and shots | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F033 | Generate initial casting/location/prop concepts | 7 | missing | Reviewable casting/location/prop text requirements are implemented. Actual candidate generation, agreed quantities, selection UX, identity-master approval and end-to-end media review remain missing. |
| F034 | Derive reference-preserving looks, angles and frames | 7 | missing | Look-development requirements are planned separately from identity and voice. Actual approved-identity angles/expressions, wardrobe/grooming references, generation and reference-pack approval remain missing. |
| F035 | Review reference identity, wardrobe and composition | 7 | partial | Versioned records exist; actual identity/look/wardrobe/composition approval and quality evidence must precede storyboard/final footage and remain incomplete. |
| F036 | Manage character/world versions and use rights | 7 | partial | Versioned character, voice, location, wardrobe and prop records with scoped references and history implemented; use-rights evidence and generated identity review remain incomplete. |
| F037 | Create storyboard direction and shot contracts | 7 | partial | All seventeen department plans include storyboard handoffs and camera/lighting/performance requirements. Complete scene-to-shot contracts, actual storyboard frames, timed animatics and their production dependency orchestration remain incomplete. Text plans do not constitute a storyboard. |
| F038 | Generate storyboard/keyframes from references | 7 | missing | Department storyboard requirements and handoffs are text plans only. Actual storyboard/keyframe generation from approved identity/look references, stable shot IDs, annotations and sequence approval remain missing. |
| F039 | Approve/order shots and choose takes | 7 | partial | Shot specification approval and uploaded-media selection; take comparison, ordering and generated take review missing. |
| F040 | Assemble timed animatic before motion production | 7 | missing | Mandatory playable timed animatic using approved storyboard frames and song/dialogue timing; pacing/coverage approval before final footage remains missing. |
| F041 | Generate scene from approved references/keyframes | 7 | missing | Final motion generation must consume approved identity/look, applicable voice/audio, storyboard and timed-animatic versions; complete production and gate enforcement remain missing. |
| F042 | Generate text-only establishing/background clip | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F043 | Edit targeted video defects or appearance | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F044 | Generate dialogue/narration voice take | 7 | missing | Mandatory voice casting/auditions with actual-language dialogue, approved accent/pronunciation/performance and measured takes; original-song/silent applicability decisions must be recorded. Production generation/review remains missing. |
| F045 | Clone authorized voice for optional future use | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F046 | Animate portrait with approved voice recording | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F047 | Synchronize existing visible speaking footage | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F048 | Generate and verify singing performance | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F049 | Create reference-guided physical action/VFX shot | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F050 | Create region-specific deterministic overlays/composites | 7 | missing | No complete executable workflow found; implement and verify before activation. |
| F051 | Generate score/instrumental music | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F052 | Generate an original song with lyrics | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F053 | Generate ambience and Foley/effects | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F054 | Check generated dialogue against script | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F055 | Mix dialogue, score, ambience and effects | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F056 | Trim/extract exact song or dialogue segments | 8 | missing | No complete executable workflow found; implement and verify before activation. |
| F057 | Inspect video performance/motion/continuity | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F058 | Compare neighboring shots and intended/observed state | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F059 | Technical media validation | 9 | partial | Local FFmpeg media probing and upload magic-byte checks; hosted ingest/production validation missing. |
| F060 | Timecoded notes, comparisons and approvals | 9 | partial | Direction notes and version approvals only; timecoded notes and take comparisons missing. |
| F061 | Save trim/reorder/transitions and sound edits | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F062 | Preview full sequence with sound | 9 | partial | Single uploaded clip playback and local assembled proof; interactive full-sequence playback/mix absent. |
| F063 | Colour/exposure matching | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F064 | Generate and correct caption timing | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F065 | Compose titles, captions and credits | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F066 | Optional video enhancement/upscale | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F067 | Final MP4 and requested variants | 9 | partial | Sound-preserving local export tested; hosted durable export and output variants unavailable. |
| F068 | Verify exported file and delivery access | 9 | partial | Local decode/duration proof only; hosted private delivery verification missing. |
| F069 | Share/revoke review links and download | 9 | missing | No complete executable workflow found; implement and verify before activation. |
| F070 | Quote route and sequence profile | 5 | partial | Reviewed task/operation routing, exact quotes and pinned allowances include a separately reviewed department-planning operation; existing models do not inherit it. Complete sequence quotes, live prices/billing and real quality benchmarks remain unverified. |
| F071 | Authorize and reserve budget atomically | 5 | partial | Media and hybrid-planning reservations protect finishing amounts, replay and unknown outcomes. Projects with department archives require all current department plans reviewed before new media spending; plan text cannot be a media-generation quote target. True cross-session races, deployed accounts, provider billing settlement and commercial accounting remain incomplete. |
| F072 | Submit approved fal operation | 5 | partial | Mock-tested dispatch; no active profile or paid execution. |
| F073 | Reconcile status and retrieve results | 5 | partial | Mock-tested reconciliation; durable private ingestion of completed outputs incomplete. |
| F074 | Handle provider callback safely | 5 | missing | No complete executable workflow found; implement and verify before activation. |
| F075 | Pause scope or request cancellation | 5 | partial | Global new-generation pause and per-model disable implemented with atomic database guards; tenant scopes, provider cancellation and live paid-request verification remain incomplete. |
| F076 | Durable queue leases and restart recovery | 5 | partial | Atomic claim and uncertain-state hold exist; durable scheduling, leases/restart recovery and worker operations missing. |
| F077 | Checkout and subscription entitlements | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F078 | Payment callbacks, refunds and reconciliation | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F079 | Notify user of review/export/blocker | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F080 | Staff access and case-bound media grants | 4 | partial | Server-configured owner/operator/reviewer/support permissions tested; invitation-based staff lifecycle, MFA/step-up and case-bound private-media grants remain missing. |
| F081 | Production trace and blocker search | 4 | partial | Read-only own-project admin overview only; workspace operational trace/search absent. |
| F082 | Unknown-job and dead-letter triage | 4 | partial | Unknown submission held in job controller; operator reconciliation/dead-letter UI absent. |
| F083 | Restore missing completed output | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F084 | Endpoint/schema import and capability inspection | 4 | partial | Owner-only versioned profile drafts, evidence inspection and reviewed publication implemented; automated catalog/schema import, benchmark execution and additional provider adapters remain incomplete. |
| F085 | Model and sequence policy publishing | 4 | partial | Reviewed model draft publication, immutable releases, stale-baseline and unsettled-work guards implemented; sequence-policy publication, controlled rollback/canary management and live model quality remain incomplete. |
| F086 | Skill/knowledge release management | 4 | missing | No complete executable workflow found; implement and verify before activation. |
| F087 | Benchmark and regression execution | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F088 | Quality triage and defect/repair history | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F089 | Customer support and remediation | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F090 | Cost, credits and provider reconciliation | 11 | missing | Pure exact nano-USD cost-event normalization/idempotent reconciliation foundation tested. No production billing-feed ingestion or durable settlement; full customer charges, fees, credits/refunds and commercial accounting remain missing. |
| F091 | Issue goodwill credits or refunds | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F092 | Tenant/provider kill switches | 4 | partial | Audited global pause and model disable with fail-closed dispatch guards implemented; tenant/render-specific kill switches and live provider concurrency proof remain incomplete. |
| F093 | Incident management and alert triage | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F094 | Backups and restore rehearsal | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F095 | Rights, consent and retention/deletion | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F096 | Audit export and emergency access review | 4 | partial | Atomic operational audit with before/after metadata and idempotent command identities implemented; audit export, retention/archive policy and break-glass review remain incomplete. |
| F097 | Founder completion and unit economics | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F098 | Product experiment governance | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F099 | Voice identity misuse or consent withdrawal | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F100 | Guaranteed identity or celebrity likeness detection | 12 | deferred | BLOCKED: No calibrated identity/likeness detector, licensed reference set or universal threshold verified; M03/M04 assist review only |
| F101 | Automatic arbitrary VFX/physics/face repair | 12 | deferred | BLOCKED: No endpoint guarantees preservation/correction of any defect; M13 is a candidate with shot-specific evaluation |
| F102 | Neural, persuasion or memorability predictions | 12 | deferred | BLOCKED: No validated dataset/model/calibration; must not enter production acceptance or marketing guarantees |
| F103 | Universal broadcast/EXR/depth/alpha delivery | 12 | deferred | BLOCKED: Depends on genuine source layers, compositing/encoding support and track-specific specifications; not established by video generation |
| F104 | Automatic learning or retraining from customer projects | 12 | deferred | BLOCKED: No permissioned training pipeline, holdout evaluation or release protocol; ordinary memory updates remain separate |
| F105 | Legal compliance certification | 12 | deferred | BLOCKED: No qualified sign-off authority or maintained jurisdiction rule corpus; rights records and review do not establish legal certification |

## Acceptance suites

See the JSON/CSV rows C01–C32, R01–R18 and A01–A12. An existing test path identifies relevant evidence only, not a claim that the complete requirement passed.

## Scope and release discipline

No competitor backend parity or realism is inferred from UI references. Follow the approved v2 handoff. Batch deployment changes; repeat affected live checks after release. Keep accepted assets and explicit spending authorization separate from creative approval.

## Reviewed provider registry — 19 October 2026

[Architecture](MODEL_REGISTRY_ARCHITECTURE.md) and [acceptance](MODEL_REGISTRY_ACCEPTANCE.md): both OpenAI and fal now use server credentials plus owner-reviewed registry drafts/publications and task-specific routing. OpenAI environment model selection is removed. Exact operation/model/fingerprint expectations, safe retries, immutable history and unsettled-work publication guards are implemented. Supported execution adapters remain explicit; saving an endpoint draft does not make it runnable.

360 automated tests/build and eight local browser scenarios pass, with actual APIs versus intercepted fixtures distinguished and controlled recovery errors labelled. Thirteen isolated SQL groups pass; migration `20261019102343` is installed with service-only permissions/RLS and a clean security advisor. No paid calls, key changes or native model activation. F085 advances to partial; no full production acceptance. Vercel/account testing stays deferred; physical devices, live quality/billing, additional adapters and sequence-policy management remain outstanding.

## Point 4: filmmaking department planning — 19 October 2026

[Acceptance record](DEPARTMENT_PLANNING_ACCEPTANCE.md): seventeen departments now have source-linked requirements, candidate choices, handoffs, checks, independent version histories and planning-only approvals. The units cover producing, direction/performance, script breakdown/research, casting, look, locations/props, camera, lighting, voice, sound, music, continuity, storyboard, animatic, VFX, editorial and rights. Approved brief and screenplay decisions bind preparation and AI requests. Free preparation uses reviewed rules; AI proposals use a separately reviewed registry operation, visible spending allowance and explicit application. Existing approved models do not automatically gain the new operation.

Focused edits preserve neighboring department versions and approvals. Changed source decisions hold old plans; explicit refresh rebuilds one rule baseline while preserving valid recorded user choices and earlier versions. Removed references require an explicit repair. Approval/save race tests and guarded database contracts prevent a concurrent review change from publishing a stale plan. Planning approval does not approve actors, look images, voice recordings, generated media, factual claims or rights, and does not authorize spending.

427 automated tests, syntax checks and the production build pass. Five compact department-browser scenario groups and seven browser regression scripts pass; eighteen isolated PostgreSQL proof groups cover the database contracts. The revised overview uses seventeen compact collapsed rows with one expanded department and one focused editor; 390px viewport geometry is covered. Native migration `20261019112531_director_department_planning` is applied: ten functions are service-only/security-invoker, six tables have RLS, and the security advisor has no findings. Zero OpenAI/fal models are active and generation remains paused. No real paid call, filmmaking-quality result, deployed-account test or physical-device test is established.

F015 (scene blocking/performance planning) and F018 (sound/music cue planning) advance from missing to partial. The tracker now records **67 partial, 94 missing/unverified and 6 deferred items; zero fully production-accepted**. Actual character/look/voice generation, storyboard frames, playable animatics and later production remain incomplete. At this milestone Point 5—targeted departmental revisions and dependency review—was scheduled next; its subsequent implementation is recorded below. Whole brief/script changes continue to use conservative source holds.

## Point 5: scoped department revisions and dependency review — 19 October 2026

[Acceptance record](DEPARTMENT_REVISIONS_ACCEPTANCE.md): the fixed `director-department-dependencies-v1` graph now binds each new snapshot to exact upstream department versions. Source and dependency staleness are distinct. A camera change holds lighting, continuity, storyboard, animatic, VFX and editorial while preserving all their content, choices and history; unrelated rights/voice/music plans stay intact. Explicit `review_dependencies` records acknowledgement and current pins in a new unapproved revision. It requires a fresh source/upstream chain, rather than an upstream approval sequence. Legacy units missing dependency context remain byte-preserved and held until reviewed, including rights with no upstream departments.

Free saved `request_revision` records the selected departments, instruction, source and all 17 current versions. The separate `revise_departments`/`department_revision` v5 model operation requires a reviewed profile and operation-specific spending allowance. Its exact selected subset may revise explicitly requested approved documents, protects every existing `user_selected` choice and preserves nonselected content/history. The existing saved-proposal application endpoint validates the owned completed call and current context before creating unapproved target revisions. Initial v4 full-plan proposals retain their protections; known v3/v4 requests remain recoverable without adopting a new request contract.

469 automated tests, syntax checks and the production build pass. Four new revision-browser scenario groups, the five Point 4 department-browser groups and seven regression scripts pass locally. The mobile review editor’s Save/Cancel controls were scrolled into view and checked above the fixed footer with actual hit-target tests; this is Chromium viewport evidence, not physical-device or virtual-keyboard verification. Seventeen isolated PostgreSQL proof groups pass. [Native metadata evidence](evidence/DEPARTMENT_REVISIONS_NATIVE_CHECKS_2026-10-19.json) confirms migration `20261019115348_director_department_revisions`, seven reviewed functions with service-only execution, security-invoker mode and empty search paths, six RLS-enabled tables and no security-advisor findings. No active OpenAI/fal model, native department archive or planning reservation exists in that evidence; generation remains paused. No paid call, provider-key inspection/change or customer-account test occurred.

F020–F022 and related existing partial rows now record these controls; no acceptance status is promoted. Declared department graph holds are not semantic field/scene impact analysis or complete future footage/audio/render dependencies. Actual media, real filmmaking/revision quality and costs, production pilots, deployed accounts and physical devices remain unverified. The overall ledger remains **67 partial, 94 missing/unverified, 6 deferred and zero fully production-accepted**.

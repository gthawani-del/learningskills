# Director Studio — Development Tracker

Updated 19 October 2026. Baseline before the routing/quote batch: `76960d5`. This is an implementation ledger, not a replacement blueprint.

Tracked: **167 acceptance/function items**: 105 functions, 32 frontend criteria, 18 realism scenarios and 12 admin scenarios. Also indexes 108 numbered sections across the six active specifications.

Status: 64 partial, 97 missing/unverified, 6 explicitly deferred. **Zero items are claimed fully production-accepted.** Partial describes existing implementation, not a completion percentage.

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
|---|---|---|---|
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
| F012 | Develop treatment and story arc | 6 | partial | Manual story editing and mock-tested planning adapter; no live allowance-backed AI planning workflow. |
| F013 | Write screenplay and dialogue | 6 | partial | Default LLM screenplay proposals, optional preserved uploads, versioned review/application, scoped revisions and project-source originality gates implemented. Real OpenAI writing/language quality, wider permitted comparison corpus and deployed-account/browser acceptance remain unverified; production profiles disabled. |
| F014 | Script breakdown and production plan | 6 | partial | Structured scene/shot planning adapter only; no executed production breakdown or scheduling. |
| F015 | Direct scene blocking and performance | 6 | missing | No complete executable workflow found; implement and verify before activation. |
| F016 | Plan camera, lighting and coverage | 6 | partial | Manual camera/framing controls and isolated craft validator; contextual Director orchestration not connected. |
| F017 | Plan continuity and character knowledge | 6 | partial | Versioned character/world library and explicit shot bindings implemented; observed generated-media continuity and intelligent planning remain missing. |
| F018 | Create sound/music cue plan | 6 | missing | No complete executable workflow found; implement and verify before activation. |
| F019 | Translate/localize approved dialogue | 6 | missing | No complete executable workflow found; implement and verify before activation. |
| F020 | Interpret natural-language revision | 6 | partial | Saved screenplay revision instructions and explicit scene scope bind paid requests; code rejects changes to untargeted scenes/characters, and reviewed application preserves history. Real semantic interpretation/repair quality and complete departmental revision orchestration remain unverified. |
| F021 | Approve creative version | 6 | partial | Creative approval/history UI and APIs enforce current record/shot versions; transitive creative approvals govern review readiness. Atomic dispatch enforcement, media-quality acceptance and live account verification remain incomplete. |
| F022 | Invalidate dependent approvals on change | 6 | partial | Library revision and approval revocation propagate selective review holds; local/API tests pass. Atomic database enforcement of recursive approvals and live media acceptance remain incomplete. |
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
| F033 | Generate initial casting/location/prop concepts | 7 | missing | Mandatory character selection and world/prop concepts with agreed candidate quantity, actual outputs and identity-master approval; generation, selection UX and end-to-end review remain missing. |
| F034 | Derive reference-preserving looks, angles and frames | 7 | missing | Mandatory look development from approved identity: angles/expressions, wardrobe, grooming and world references; actual generation and approved reference-pack workflow remain missing. |
| F035 | Review reference identity, wardrobe and composition | 7 | partial | Versioned records exist; actual identity/look/wardrobe/composition approval and quality evidence must precede storyboard/final footage and remain incomplete. |
| F036 | Manage character/world versions and use rights | 7 | partial | Versioned character, voice, location, wardrobe and prop records with scoped references and history implemented; use-rights evidence and generated identity review remain incomplete. |
| F037 | Create storyboard direction and shot contracts | 7 | partial | Text shot contracts/version records exist; a complete department manifest, explicit camera/lighting/performance plan and dependency orchestration remain incomplete. A shot list is not a storyboard. |
| F038 | Generate storyboard/keyframes from references | 7 | missing | Mandatory actual storyboard/keyframe generation from approved identity/look references, stable shot IDs, annotations and sequence approval; generation and review UX remain missing. |
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
| F070 | Quote route and sequence profile | 5 | partial | Read-only capability routing/estimates exist. Job/user-intent/audience-led workflow selection, verified quality-constrained cost ranking, complete sequence estimates and customer cost UI remain incomplete. Age and cheapest price are not recommendation rules. |
| F071 | Authorize and reserve budget atomically | 5 | partial | Each billable creation needs disclosed scope, quantity, fresh customer price and explicit bounded authorization. Durable quotes/authorizations, shared-budget concurrency, fees/credit rules and ledger conservation remain incomplete. |
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
| F084 | Endpoint/schema import and capability inspection | 4 | partial | Registry purpose/evidence inspection, internal use notes and model disable controls implemented; endpoint/schema import, diff, evaluation and publishing remain incomplete. |
| F085 | Model and sequence policy publishing | 4 | missing | No complete executable workflow found; implement and verify before activation. |
| F086 | Skill/knowledge release management | 4 | missing | No complete executable workflow found; implement and verify before activation. |
| F087 | Benchmark and regression execution | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F088 | Quality triage and defect/repair history | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F089 | Customer support and remediation | 11 | missing | No complete executable workflow found; implement and verify before activation. |
| F090 | Cost, credits and provider reconciliation | 11 | missing | Mandatory owner-scoped creation receipts/history, actual customer charges, provider reconciliation, unknown-charge states and refunds/credits. Complete customer billing and commercial ledger remain missing. |
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

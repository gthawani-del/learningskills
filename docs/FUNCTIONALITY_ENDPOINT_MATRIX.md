> Historical planning input. Current consolidated model/tool decisions and pricing are in [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md).

# Film Studio Functionality to Endpoint Matrix Review Draft

Revision 1, 2026-10-17 UTC. The linked CSV is the complete requirement inventory for the current planning documents, including customer, production, infrastructure, admin and deferred research functions. Every row has a concrete candidate execution path or an explicit blocker. A proposed API path is not deployed functionality.

## Read this first

No application code, database schema, deployments, account settings, paid generation or billing operations were changed. Twenty live fal endpoint schemas were inspected and their input/output snapshots preserved. Price observations were retrieved for those endpoints. No endpoint was execution-tested or quality-validated, and the Vercel FAL_API_KEY was not tested.

Evidence levels: **S** = live endpoint schema inspected; **D** = provider documentation/dependency identified; **P** = proposed application/worker implementation. None means implemented, reliable or commercially approved. Hard-blocked items remain listed rather than hidden. Service bindings such as Supabase and payment integrations require implementation even when documented.

The endpoint candidates support concrete proposed routes, not permanent best-model claims. For OpenRouter routes, google/gemini-2.5-flash is a specific baseline candidate appearing in each inspected schema's examples. Its availability, account access, limits and task quality must be tested. The schema exposes a string selector, not a verified immutable model version. Preserve the submitted selector and any provider version information; do not claim reproducibility from it alone.

## Files and traceability

- [Full functionality matrix CSV](FUNCTIONALITY_ENDPOINT_MATRIX.csv): feature, proposed application operation, external endpoint/tool, evidence, inputs, outputs, limits, prerequisites, billing, recovery and release blocker.
- [Machine-readable candidate registry](TOOL_REGISTRY_CANDIDATES.json): exact endpoint IDs, required inputs, outputs, observed prices and verification flags.
- [Live schema snapshots](evidence/FAL_ENDPOINT_SCHEMAS.json): supporting input/output specifications, including nested constraints and descriptions.
- [Price observations](evidence/FAL_PRICE_OBSERVATIONS.json): source billing units and rates, not executable quotes or charges.
- [Tool Registry contract](TOOL_REGISTRY_SPEC.md): publication, authorization, adapters and sequence-aware routing rules.

## Critical distinctions

Audio understanding is routed explicitly: use openrouter/router/audio with the stated Gemini baseline candidate for interpretation, and fal-ai/audio-understanding as a benchmark candidate. It is separate from transcription, forced alignment, signal processing and story-to-song interpretation. None is presumed accurate on singing until tested.

Structured screenplays, shot contracts and findings are application schemas that wrap model text. Inspected router schemas return text and do not by themselves enforce our structured output contracts. Parse/validate, preserve the previous accepted artifact on failure and use bounded correction policies. Do not invent unsupported request fields.

Speech TTS, singing synthesis, portrait animation and syncing existing footage are four separate capabilities. Original-song generation does not prove that the same singer identity can be retained in later dialogue or that an uploaded song can be re-performed unchanged. Voice-clone IDs are not automatically portable across providers/models.

The source music endpoint permits conditional modes beyond simple required-field lists. Enforce prompt/composition compatibility and nested constraints in the adapter; generation of a score is not a guarantee of sample-accurate length. Measure the result before using it as a clock.

A still-image reviewer cannot prove temporal motion/lip-sync quality. Video review remains assisted and must be calibrated. Framing, props, dialogue and other mandatory shot requirements override an attractive image or aggregate score.

## Common execution contracts

**R1 Version and authority:** use authenticated project scope, current approved artifact/shot/profile versions and permitted input assets. Uploaded content cannot authorize a tool call or override policy.

**R2 Spend:** obtain explicit authorization, atomically reserve budget across concurrent tasks, protect finishing allowance and record submission intent. Unknown submissions retain their reservation. Estimates with unresolved units/configuration are blocked from ordinary quoting until a bounded test or verified estimate is approved.

**R3 External request:** queue long work, persist request IDs and immutable input snapshots, validate schemas and output types, verify callbacks and make all state/ledger writes replay-safe. Provider COMPLETED can carry an error; inspect the result, not just the status label. Internal deduplication is not a provider billing guarantee.

**R4 Recovery:** reconcile unknown submissions; retry retrieval of the same completed result; resume deterministic task checkpoints. Separate creative correction attempts, service recovery and billable operations. Never restart successful neighboring shots by default.

**R5 Acceptance:** capture actual media metadata, store durable permitted outputs, review mandatory contract criteria and neighboring-shot continuity, record pass/fail/review/unverified separately from technical generation success.

**R6 Publication:** no candidate becomes a default through catalog sync. Schema inspection → adapter validation → authorized execution test → task/sequence evaluation → reviewed release. Pin adapter/schema/policy versions and preserve provenance on rollback.

## Financial interpretation

The returned price unit “units” is not enough to compute a quote. This affects router calls and other candidates; verify underlying token rates, workload/configuration mapping, rounding, minimums and optional features before estimating. For rates given in time/characters/megapixels, still verify billing configuration and minimums. Provider lookup observations are not customer prices or current invoice charges.

fal queue transport uses fal.queue.submit/status/result/cancel through a server adapter, with FAL_API_KEY passed explicitly as credentials. Save returned request/tracking references. Do not reconstruct request paths for nested model IDs by guessing. The queue is provider execution persistence, not a substitute for our cross-provider tasks, approvals, budgets and delivery state.

## Source documentation checked

- fal asynchronous queue: https://fal.ai/docs/documentation/model-apis/inference/queue
- Supabase signUp: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase signed upload: https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- Stripe checkout candidate: https://docs.stripe.com/api/checkout/sessions/create
- Resend email candidate: https://resend.com/docs/api-reference/emails/send-email

Stripe and Resend are proposed adapters, not connected services or approved vendor commitments. Auth modes, email settings, storage selection and payment terms still require decisions and tests. Framework/worker packages must be pinned and tested before release.

## Coverage summary

Total inventoried functions: **105**. Live-schema-inspected fal endpoints: **20**. Paid execution tests: **0**. Quality-validated routes: **0**.

| Area | Functions |
| --- | --- |
| Entry and projects | 9 |
| Story and filmmaking intelligence | 13 |
| Song and audio intelligence | 10 |
| Cast, design and storyboard | 8 |
| Motion and performance production | 10 |
| Music and sound production | 6 |
| Review, edit and delivery | 13 |
| Execution and financial foundation | 10 |
| Admin and founder operations | 20 |
| Explicitly blocked research or future scope | 6 |

These counts describe planning coverage, not implementation completion. Shared endpoints intentionally support multiple specialist tasks with different skill/input/output/review contracts. A row tagged P still needs its stated application/worker code. A row tagged S still needs a compatible adapter, execution and quality testing.

## Functionality coverage by area

Full contracts are in the CSV. This readable view links each requirement to its proposed operation and exact external binding. All listed API routes are proposals.

### Entry and projects

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F001 | Explore pre-rendered sample | `GET /api/examples` | `Application curated sample manifest` |
| F002 | Sign up and sign in | `POST /api/auth/session` | `Supabase Auth` |
| F003 | Recover account and end session | `POST /api/auth/recovery` | `Supabase Auth` |
| F004 | Create or reopen project | `POST /api/projects` | `Supabase Postgres via authorized application API` |
| F005 | Autosave and resolve concurrent edits | `POST /api/projects/:id/drafts` | `Supabase Postgres revision-guard transaction` |
| F006 | Import script/project | `POST /api/projects/:id/import` | `Application parser and schema validator` |
| F007 | Search project and media library | `GET /api/library` | `Supabase Postgres authorized search` |
| F008 | Upload and finalize source media | `POST /api/assets/upload-intents` | `Supabase Storage signed upload plus server finalization` |
| F009 | Preview or download private media | `GET /api/assets/:id/access` | `Supabase Storage signed access through authorization` |

### Story and filmmaking intelligence

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F010 | Interpret brief and ask necessary questions | `POST /api/projects/:id/brief/interpret` | `openrouter/router` |
| F011 | Research and source-backed creative context | `POST /api/projects/:id/research` | `openrouter/router` |
| F012 | Develop treatment and story arc | `POST /api/projects/:id/treatments` | `openrouter/router` |
| F013 | Write screenplay and dialogue | `POST /api/projects/:id/scripts` | `openrouter/router` |
| F014 | Script breakdown and production plan | `POST /api/projects/:id/breakdown` | `openrouter/router` |
| F015 | Direct scene blocking and performance | `POST /api/projects/:id/direction` | `openrouter/router` |
| F016 | Plan camera, lighting and coverage | `POST /api/projects/:id/coverage` | `openrouter/router` |
| F017 | Plan continuity and character knowledge | `POST /api/projects/:id/continuity/plan` | `openrouter/router` |
| F018 | Create sound/music cue plan | `POST /api/projects/:id/sound/plan` | `openrouter/router` |
| F019 | Translate/localize approved dialogue | `POST /api/projects/:id/scripts/localize` | `openrouter/router` |
| F020 | Interpret natural-language revision | `POST /api/projects/:id/revisions/interpret` | `openrouter/router` |
| F021 | Approve creative version | `POST /api/approvals` | `Supabase Postgres approval transaction` |
| F022 | Invalidate dependent approvals on change | `POST /api/revisions/:id/commit` | `Application dependency graph plus database transaction` |

### Song and audio intelligence

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F023 | Decode song and inspect metadata | `POST /api/audio/:id/inspect` | `Worker FFprobe and FFmpeg` |
| F024 | Understand song mood, instrumentation and development | `POST /api/audio/:id/interpret` | `openrouter/router/audio` |
| F025 | Secondary audio-question/interpretation benchmark | `POST /api/audio/:id/interpret-candidates` | `fal-ai/audio-understanding` |
| F026 | Transcribe speech or attempt sung lyrics | `POST /api/audio/:id/transcribe` | `fal-ai/elevenlabs/speech-to-text/scribe-v2` |
| F027 | Edit and confirm canonical lyrics | `POST /api/audio/:id/lyrics` | `Supabase Postgres versioned lyric record` |
| F028 | Align known lyrics/dialogue to recording | `POST /api/audio/:id/align` | `fal-ai/elevenlabs/forced-alignment` |
| F029 | Separate optional vocal/instrument stems | `POST /api/audio/:id/stems` | `fal-ai/demucs` |
| F030 | Estimate tempo, beats, onsets and energy | `POST /api/audio/:id/features` | `Worker librosa: beat.beat_track, onset.onset_detect, feature.rms` |
| F031 | Propose musical sections and visual pacing | `POST /api/audio/:id/sections` | `openrouter/router` |
| F032 | Map song moments to story and shots | `POST /api/projects/:id/music-shot-plan` | `openrouter/router` |

### Cast, design and storyboard

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F033 | Generate initial casting/location/prop concepts | `POST /api/projects/:id/concepts` | `fal-ai/z-image/turbo` |
| F034 | Derive reference-preserving looks, angles and frames | `POST /api/assets/:id/reference-edits` | `bytedance/seedream/v5/pro/edit` |
| F035 | Review reference identity, wardrobe and composition | `POST /api/assets/:id/visual-review` | `openrouter/router/vision` |
| F036 | Manage character/world versions and use rights | `POST /api/world-elements` | `Supabase Postgres plus private Storage` |
| F037 | Create storyboard direction and shot contracts | `POST /api/projects/:id/storyboard/plan` | `openrouter/router` |
| F038 | Generate storyboard/keyframes from references | `POST /api/shots/:id/frames` | `bytedance/seedream/v5/pro/edit` |
| F039 | Approve/order shots and choose takes | `POST /api/shots/:id/selection` | `Supabase Postgres version-guard transaction` |
| F040 | Assemble timed animatic before motion production | `POST /api/projects/:id/animatics` | `Worker FFmpeg timeline composer` |

### Motion and performance production

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F041 | Generate scene from approved references/keyframes | `POST /api/shots/:id/video-jobs` | `minimax/h3-max/reference-to-video` |
| F042 | Generate text-only establishing/background clip | `POST /api/shots/:id/background-jobs` | `minimax/h3-max/reference-to-video` |
| F043 | Edit targeted video defects or appearance | `POST /api/shots/:id/video-edits` | `fal-ai/kling-video/o3/pro/video-to-video/edit` |
| F044 | Generate dialogue/narration voice take | `POST /api/dialogue/:id/voice-jobs` | `elevenlabs/tts/eleven-v4` |
| F045 | Clone authorized voice for optional future use | `POST /api/voices/clone-jobs` | `fal-ai/minimax/voice-clone` |
| F046 | Animate portrait with approved voice recording | `POST /api/shots/:id/avatar-jobs` | `veed/fabric-1.0` |
| F047 | Synchronize existing visible speaking footage | `POST /api/shots/:id/lipsync-jobs` | `fal-ai/sync-lipsync/react-1` |
| F048 | Generate and verify singing performance | `POST /api/shots/:id/singing-jobs` | `veed/fabric-1.0` |
| F049 | Create reference-guided physical action/VFX shot | `POST /api/shots/:id/action-jobs` | `minimax/h3-max/reference-to-video` |
| F050 | Create region-specific deterministic overlays/composites | `POST /api/shots/:id/composites` | `Worker FFmpeg filters and authored masks` |

### Music and sound production

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F051 | Generate score/instrumental music | `POST /api/projects/:id/music-jobs` | `elevenlabs/music/v2.5` |
| F052 | Generate an original song with lyrics | `POST /api/projects/:id/song-jobs` | `fal-ai/minimax-music/v2.6` |
| F053 | Generate ambience and Foley/effects | `POST /api/projects/:id/sfx-jobs` | `fal-ai/elevenlabs/sound-effects/v2` |
| F054 | Check generated dialogue against script | `POST /api/dialogue/:id/verify` | `fal-ai/elevenlabs/speech-to-text/scribe-v2` |
| F055 | Mix dialogue, score, ambience and effects | `POST /api/projects/:id/mix-jobs` | `Worker FFmpeg amix, volume, sidechaincompress, loudnorm` |
| F056 | Trim/extract exact song or dialogue segments | `POST /api/audio/:id/segments` | `Worker FFmpeg timestamp extraction` |

### Review, edit and delivery

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F057 | Inspect video performance/motion/continuity | `POST /api/shots/:id/video-review` | `openrouter/router/video` |
| F058 | Compare neighboring shots and intended/observed state | `POST /api/sequences/:id/continuity-review` | `openrouter/router/video` |
| F059 | Technical media validation | `POST /api/assets/:id/technical-checks` | `Worker FFprobe plus FFmpeg decode` |
| F060 | Timecoded notes, comparisons and approvals | `POST /api/reviews` | `Supabase Postgres review/approval records` |
| F061 | Save trim/reorder/transitions and sound edits | `POST /api/timelines/:id/versions` | `Application timeline validator plus Postgres` |
| F062 | Preview full sequence with sound | `POST /api/timelines/:id/previews` | `Worker FFmpeg proxy composer` |
| F063 | Colour/exposure matching | `POST /api/timelines/:id/colour-jobs` | `Worker FFmpeg eq, curves, colorspace or reviewed LUT` |
| F064 | Generate and correct caption timing | `POST /api/timelines/:id/captions` | `fal-ai/elevenlabs/forced-alignment` |
| F065 | Compose titles, captions and credits | `POST /api/timelines/:id/graphics-jobs` | `Worker FFmpeg subtitle/overlay templates` |
| F066 | Optional video enhancement/upscale | `POST /api/exports/:id/upscale-jobs` | `fal-ai/bytedance-upscaler/upscale/video` |
| F067 | Final MP4 and requested variants | `POST /api/exports` | `Worker FFmpeg encode/mux` |
| F068 | Verify exported file and delivery access | `POST /api/exports/:id/verify` | `Worker decode validation plus scoped playback review` |
| F069 | Share/revoke review links and download | `POST /api/shares` | `Application scoped access tokens plus private Storage` |

### Execution and financial foundation

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F070 | Quote route and sequence profile | `POST /api/routing/preview` | `Application registry constraint engine` |
| F071 | Authorize and reserve budget atomically | `POST /api/productions/:id/authorize` | `Postgres transaction and ledger` |
| F072 | Submit approved fal operation | `POST /api/operations` | `fal.queue.submit(endpoint_id, input)` |
| F073 | Reconcile status and retrieve results | `POST /api/operations/:id/reconcile` | `fal.queue.status and fal.queue.result` |
| F074 | Handle provider callback safely | `POST /api/webhooks/fal` | `Application verified webhook receiver plus reconciliation` |
| F075 | Pause scope or request cancellation | `POST /api/productions/:id/pause` | `Application submission gate; fal.queue.cancel when supported` |
| F076 | Durable queue leases and restart recovery | `POST /api/internal/tasks/claim` | `Postgres leased task queue plus hosted worker` |
| F077 | Checkout and subscription entitlements | `POST /api/billing/checkout` | `Stripe POST /v1/checkout/sessions candidate` |
| F078 | Payment callbacks, refunds and reconciliation | `POST /api/webhooks/payments` | `Payment adapter and append-only ledger` |
| F079 | Notify user of review/export/blocker | `POST /api/internal/notifications` | `Resend POST /emails candidate plus in-app records` |

### Admin and founder operations

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F080 | Staff access and case-bound media grants | `POST /api/admin/access-grants` | `Application server authorization and Postgres` |
| F081 | Production trace and blocker search | `GET /api/admin/productions` | `Postgres event/job/asset projections` |
| F082 | Unknown-job and dead-letter triage | `POST /api/admin/operations/:id/reconcile` | `fal.queue.status/result plus application reconciler` |
| F083 | Restore missing completed output | `POST /api/admin/operations/:id/retrieve` | `Application retrieval worker and private Storage` |
| F084 | Endpoint/schema import and capability inspection | `POST /api/admin/registry/import` | `Read-only catalog discovery and schema snapshot importer` |
| F085 | Model and sequence policy publishing | `POST /api/admin/registry/releases` | `Application evaluated release command` |
| F086 | Skill/knowledge release management | `POST /api/admin/skills/releases` | `Application versioned source/evaluation store` |
| F087 | Benchmark and regression execution | `POST /api/admin/evaluations` | `Evaluation runner using explicit M01–M20 bindings` |
| F088 | Quality triage and defect/repair history | `POST /api/admin/quality/findings` | `Postgres findings, lineage and review records` |
| F089 | Customer support and remediation | `POST /api/admin/support/cases` | `Application case workflow` |
| F090 | Cost, credits and provider reconciliation | `POST /api/admin/finance/reconcile` | `Append-only ledger plus provider/payment records` |
| F091 | Issue goodwill credits or refunds | `POST /api/admin/finance/adjustments` | `Privileged ledger/payment adapter commands` |
| F092 | Tenant/provider kill switches | `POST /api/admin/controls/pause` | `Application scope-aware submission gate` |
| F093 | Incident management and alert triage | `POST /api/admin/incidents` | `Application incident records and monitoring adapter` |
| F094 | Backups and restore rehearsal | `POST /api/admin/recovery/rehearsals` | `Provider backup capability plus worker restore procedure` |
| F095 | Rights, consent and retention/deletion | `POST /api/admin/assets/retention` | `Postgres dependency/consent records plus storage delete adapter` |
| F096 | Audit export and emergency access review | `GET /api/admin/audit` | `Append-only admin audit projection` |
| F097 | Founder completion and unit economics | `GET /api/admin/analytics/outcomes` | `Versioned analytics queries over ledger/production events` |
| F098 | Product experiment governance | `POST /api/admin/experiments` | `Application experiment registry and event capture` |
| F099 | Voice identity misuse or consent withdrawal | `POST /api/admin/rights/cases` | `Case-bound rights review and dependent-use controls` |

### Explicitly blocked research or future scope

| ID | Function | Proposed operation | Candidate binding |
| --- | --- | --- | --- |
| F100 | Guaranteed identity or celebrity likeness detection | `POST /api/research/capabilities` | `No approved execution route` |
| F101 | Automatic arbitrary VFX/physics/face repair | `POST /api/research/capabilities` | `No approved execution route` |
| F102 | Neural, persuasion or memorability predictions | `POST /api/research/capabilities` | `No approved execution route` |
| F103 | Universal broadcast/EXR/depth/alpha delivery | `POST /api/research/capabilities` | `No approved execution route` |
| F104 | Automatic learning or retraining from customer projects | `POST /api/research/capabilities` | `No approved execution route` |
| F105 | Legal compliance certification | `POST /api/research/capabilities` | `No approved execution route` |

## Release-critical unresolved dependencies

1. Hosted render/analysis worker and actual render/retrieval test. Local FFmpeg presence does not establish hosted operation.
2. Text/audio/video model availability and prices for the selected underlying model; long-song handling and semantic audio quality.
3. Identity consistency, exact dialogue, physical action, lip-sync and especially singing quality under the intended sequence profile.
4. Voice-clone lifecycle and a compatible downstream TTS route before making cloning usable.
5. Private storage, queue/leases, signed access, tenant policies, permissions and durable assets. No new schema was applied.
6. Payment provider, credit/refund semantics and settlement integration before paid public launch. Stripe is a candidate only.
7. Vendor usage/invoice ingestion, backup entitlement, restore/media coverage, monitoring and optional email before claiming those admin operations are automated.
8. Research promises remain blocked; do not fill a missing production capability with an unsupported model assertion.

## Immediate planning recommendation

Accept this inventory as a coverage baseline, resolve the dependency choices and define a small separately budget-authorized test plan. First test song interpretation/alignment if music is the entry workflow, the hardest reference/performance shot, and the actual render path. Choose defaults from those results. Then implement the shared foundation and the approved adapters in a vertical short-film workflow; retain the music/audio bindings rather than inventing them later.

The four earlier seed entries are now part of a broader candidate registry. This deliverable supersedes any impression that four inspected routes were enough to implement the whole studio. The core filmmaking architecture remains unchanged.

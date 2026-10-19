# Reference generation and selection — 19 October 2026

The first Step 7 increment implements character identity, identity-bound look and location reference production. Users can prepare source-bound directions, review a verified model and cost, explicitly set a project spending cap, authorize one image, run a durable job, import its actual pixels privately, select a candidate and separately approve the exact reference. Existing script, department and storyboard planning remain intact.

**618 automated tests, syntax checks and the production build pass.** Five actual local reference-browser scenario groups pass, alongside department, revision, storyboard and seven earlier browser regressions. Twelve independent isolated PostgreSQL/WASM proof groups pass. Director migration `20261019132520_director_reference_production` is installed; 18 new and five replaced functions have service-only invoker execution and empty search paths. Nine affected tables retain RLS. The new PNG-only 10 MiB bucket is private, candidate receipts permit service SELECT/INSERT only, and security advisor reports no findings. Native models remain inactive and generation stays paused. No paid provider request or credential inspection/change occurred.

## Creative workflow and user experience

Cast & World begins with compact reference rows. Free preparation proposes identity and look directions for each screenplay character and a location direction for each scene. The rows are optional creative scopes; they do not establish that an off-screen narrator is visible or that a person has been cast. Directions reuse approved facts and preserve unknowns rather than inferring appearance, demographics, accent or voice from names. Existing subjects and selected-image histories survive preparation, edits and source changes. With no missing subjects, preparation is a no-op.

One focused prefilled editor handles corrections. Direction approval establishes the specification for generation. Every candidate remains unselected until the user inspects its actual image and selects it with an acknowledgement. A separate reference approval applies to that exact selected image and subject version. Uploaded role-compatible owned images can enter the same candidate/review flow without being labelled generated.

Looks use the exact currently selected and approved identity image through the reviewed edit route. A missing identity holds look generation; changing the identity selection holds existing looks without deleting their images or history. Explicit refresh binds a current source and, for looks, the selected approved identity. Refresh rebuilds the baseline in a new version; the UI explicitly warns about replacing the current direction. A focused edit can instead retain the desired wording. Both require renewed direction review.

The source binding conservatively covers the approved brief, source-current screenplay and all 17 approved, dependency-current department plans. A change to one bound source can hold all earlier reference directions/selections. Source holds preserve media and historical reviews. Selective semantic impact analysis is not claimed. Reference generation intentionally precedes storyboard approval; a narrow reference-brief image gate avoids a circular dependency while ordinary footage/audio/media gates retain their prior requirements.

## Routing, cost and recovery

The added tasks are `reference_image` and `reference_look`. Text-to-image adapters support reviewed fixed 1024×1024 PNG configurations for `fal-ai/flux-2-pro` and `fal-ai/flux-2/klein/9b`; identity-conditioned looks use `bytedance/seedream/v5/pro/edit`. Adapter availability and current catalog evidence do not activate a model or prove its creative quality. The live discovery observed FLUX Pro at $0.03 for the fixed single-output request. Klein's per-megapixel rounding remains unresolved, so that observed rate is not an approved exact production tariff. The [endpoint evidence](evidence/FAL_REFERENCE_ENDPOINTS_2026-10-19.json) records scope and pricing uncertainties. Enabled profiles still need fresh operation/task, schema, execution, quality and configuration-specific pricing evidence in the existing registry.

The deterministic image compiler includes the complete approved subject document, exact source character or scene heading/action, four relevant brief fields and six complete relevant department documents. It binds the full approved sources without repeating unrelated dialogue/music/admin instructions in the image prompt. Included fields are never sliced to fit; excessive context fails closed at the declared local input bound. Source text is creative data and cannot alter routing, billing, output count or safety configuration. Initial text-to-image candidates cannot claim continuity with an absent identity image. Human image review remains necessary.

Every explicit attempt requests one image. The quote shows its provider/model, configured unit price where verified, quantity and total. Project cost caps are explicit shared limits, separate from the quote-specific authorization; no quote or permission silently creates a budget. Existing protected reserves and held/unknown exposure constrain new work. Approving a cap or permission starts no provider call. Run is explicit and idempotent. A used quote/authorization cannot be reused by the UI to create another attempt; a new attempt needs a fresh estimate and authorization.

The existing hard two-attempt work-unit limit remains. Attempt two requires a recorded visible correction reason. This is a diagnosis/retry gate, not an automatic prompt repair: the review reason is not currently consumed by the prompt compiler. A changed creative direction must be edited and approved explicitly. No automatic variants, paid fallback, model switching or blind resubmission occurs. The two-attempt quality-success target remains unproven.

Known requests are polled using their frozen model snapshot, even after the serving registry changes. An uncertain submission retains its money hold and original request identity. A known unstarted reserved job can be explicitly submitted once; unknown work cannot be replaced automatically. Provider completion does not settle an invoice, accept creative output or select a character. Costs remain labelled reservations while actual billing reconciliation is pending.

## Private media and persistence

The importer reads an owned completed job's saved output receipt; clients cannot provide download URLs or job-success flags. It accepts one reviewed fal HTTPS media URL, refuses redirects and unrelated hosts, bounds the stream at 10 MiB, checks PNG CRCs, decompresses the pixel stream and verifies the actual 1024×1024 dimensions. Successful HTTP status or MIME metadata alone does not create an image asset.

Immutable bytes are saved in private `director-reference-media`; existing user uploads retain their 2 MiB limit. Deterministic job-derived asset/candidate IDs and checksum-preserving writes recover interrupted imports without another generation. Candidate receipts bind exact project, subject/version, asset/version, completed job, saved payload, request ID and recorded endpoint. Registered asset content identity cannot be substituted under the same version. Repeat imports reuse the same receipt. The owner-checked content proxy serves the stored image; external provider URLs are not library assets.

Look input uses a server-signed private identity link with at most one-hour expiry, only after explicit sharing permission. It is not a public bucket or permanent share. Actual storage/provider timing and production data-handling behavior remain live checks. Server credentials and private approval evidence stay out of public responses.

The bounded `project.referenceProduction` archive keeps independent subject histories, source histories and append-only selection events. Guarded saves bind owner, project version, latest approval identity and allowed scope under transaction locks. Selection and approval validate trusted candidate facts rather than user-supplied authority. Imports retain creative/reference history but do not transfer candidate receipts, approvals, generation provenance, spending permissions or project budgets. A receiving account must establish its own candidate/review authority. Generic project PATCH cannot forge reference archives.

## API surface

- `GET /reference-production`: current references, eligible/held model profiles, saved job states and project cap.
- `POST /reference-production`: free `prepare`, `update`, `refresh`, `select` and server-validated `add_uploaded` commands.
- `POST /reference-production/quotes`: canonical server-built image input; clients choose a subject/model and cannot pass a raw prompt. Generic media quotes reject the new reference tasks.
- `POST /spending-budget` and existing `/spending-authorizations`: separate explicit financial decisions.
- `POST /reference-production/jobs`: reserve and explicitly dispatch the exact saved scope. Existing job dispatch/poll inspect the original request.
- `POST /reference-production/import`: recover and privately store one completed output.
- `POST /reference-production/reviews`: save a correction reason without generation.
- Existing `/approvals`: review a reference brief or explicitly acknowledge visual review of the exact reference selection.

All routes above sit under `/api/projects/:id` and require ownership. Provider configuration remains server-side; the registry governs which models can serve each task. Supabase schema/tool access does not prove deployed runtime credentials or real account isolation.

## Verification and limits

| Check | Evidence |
| --- | --- |
| Automated | 618/618 pass: 23 new API, six integration, 21 core, 15 provider, nine cloud and five PNG/storage cases plus existing regressions. |
| Build | Syntax and production package/import checks pass, including the new schema evidence in build and Vercel packaging. No provider calls. |
| Reference browser | Five groups against actual local HTTP APIs, LocalStore, private image reads and Chromium with a server-side simulated fal provider; no browser API interception. Three simulated image jobs, zero real paid calls. Exact image decoding, explicit cost/authorization boundaries, consumed-quote guards, identity-bound look and source holds pass with no console/HTTP errors. |
| Mobile viewport | 390×844 Chromium: no overflow; unsaved edits survive blocked navigation; Save/Cancel center-point hit checks pass above the footer; actual private image selection/approval works. This is not physical-device or virtual-keyboard verification. |
| Browser regressions | Department overview, targeted revisions, storyboard handoff, creative brief, workspace saving/editing/image selection/uploaded-video playback, mobile footer, compact proposal, registry, writing recovery and planning UI pass. Writing deliberately injects a 503; planning UI uses intercepted fixtures and an injected network failure. No unexpected errors. |
| SQL | Twelve independent isolated groups verify source/history/identity checks, narrow image gating, exact scope, owner/version/review races, candidate/asset immutability, budget/authorization/attempt/unknown holds, saved result recovery, permissions and rollback. Sequential stale-read simulations are not simultaneous-session testing. |
| Native | Migration, 23 functions, nine RLS tables, private bucket, candidate privileges and clean security advisor verified read-only. Zero active models, candidates, reference archives, jobs and planning reservations; pause retained. No native account, latency or real-media execution proof. |

Machine-readable evidence: [checks](evidence/REFERENCE_PRODUCTION_CHECKS_2026-10-19.json), [native checks](evidence/REFERENCE_PRODUCTION_NATIVE_CHECKS_2026-10-19.json), [isolated SQL](../database/checks/reference-production-pglite-results.json). Gitignored `test-results/` retains actual local reports/screenshots; the evidence records their hashes. The visible gradient images in the browser evidence are explicitly synthetic valid PNG fixtures, not model-quality samples. [Reference Production Knowledge](REFERENCE_PRODUCTION_KNOWLEDGE.md) records the source and filmmaking rules.

This increment does not generate storyboard frames, timed animatics, voice auditions, footage or a finished export. Approved references are not yet projected into generic production records or assigned to storyboard shots; that binding is subsequent visual-production work. Broader reference packs/turnarounds, prop/product editing, automated image-quality/identity judgments, production billing reconciliation, paid creative quality, native concurrency/latency, deployed-account and physical-device tests remain incomplete. Tracker totals are 69 partial, 92 missing/unverified, six deferred and zero fully production-accepted. F033/F034 advance to partial; F038/F040 actual storyboard frames/animatics remain missing.

Next is actual storyboard-frame production using approved reference selections and shot contracts. Code publication is tracked by its main commit; a push alone is not deployment acceptance. Live-site/account testing remains deferred as requested.

Rollback the application commit if necessary while retaining additive database provenance, private assets, approvals and financial records. Keep generation paused/inactive while investigating; do not delete customer evidence or relax guards to roll back. The migration checks expected prior function definitions and installs transactionally.

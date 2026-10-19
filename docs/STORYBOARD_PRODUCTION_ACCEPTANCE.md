# Storyboard frame production — 19 October 2026

This second Step 7 increment connects approved identity, look and location references to individual shot contracts and implements storyboard still generation, private import, explicit candidate selection and separate human frame approval. It preserves screenplay, department, shot and reference histories. A selected START-state picture is planning evidence; it does not establish motion, performance, voice, a timed animatic or a finished film.

**696 automated tests, syntax checks and the production build pass.** Four new local browser scenario groups pass, alongside department, revision, shot-handoff, reference and seven earlier browser scripts. Fifteen independent isolated PostgreSQL/WASM proof groups pass. Director migration `20261019135954_director_storyboard_production` is installed. Twenty new and seven replaced functions retain service-only invoker execution with empty search paths; ten affected tables retain RLS. The existing private PNG-only 10 MiB bucket is unchanged. Security advisor reports no findings. Native models remain inactive and generation stays paused. No paid provider calls or credential inspection/change occurred.

## Creative workflow

Free preparation creates compact, source-bound frame directions only for missing shot specifications. Script character associations propose who might be pictured; users explicitly confirm the pictured cast before approving the direction. An off-screen speaker need not appear, and exact dialogue remains in the shot contract. No demographic, appearance or voice identity is invented from a name.

Every pictured character requires the exact currently approved identity and identity-bound look selection. The scene requires its approved location. Role pins remain separate even when the same image supplies two roles; actual provider inputs and their cost deduplicate the same asset/version. Canonical order is all identities by codepoint-sorted character ID, then all looks in that order, then location. One to ten unique images are supported; excess inputs are held rather than truncated. Unsupported product, composition, lighting or performance reference requirements remain explicit holds. A not-applicable decision cannot waive an applicable pictured identity or look requirement.

The focused, prefilled editor changes direction, pictured cast and output aspect. Native reviewed configurations are 1536×864 for 16:9, 864×1536 for 9:16 and 1024×1024 for square. A conflicting approved brief or unsupported explicit ratio holds generation; no silent crop changes the output. Reference refresh is explicit, retains valid human direction/cast/aspect choices, versions the specification and requires renewed direction review.

The image prompt includes the complete bound shot contract, frame specification, source scene/characters and relevant brief/department direction. Included text is not silently cut; excessive input fails at the declared bound. Action endings and future motion are context for an opening still, not claims that the picture depicts an entire transition. Human inspection separately selects the actual candidate and approves that exact selection. Neither provider completion nor import automatically approves a frame.

## Routing and spending

The operation-specific `storyboard_frame` task uses the reviewed `bytedance/seedream/v5/pro/edit` adapter. The registry still requires approved task, schema, execution, quality and configuration-specific price evidence. Adapter support and discovery evidence do not activate a serving model or prove cinematic quality.

An explicit estimate shows the selected model, output and additional input-image components. Its price profile must cover one output and extra unique inputs after the first; an old flat output-only tariff cannot silently underprice a multi-reference request. The dated public candidate is $0.0675 base plus $0.0045 for each additional unique input image: $0.0675 with one input, $0.0855 with five, $0.108 with ten. These are candidate observations, not an approved live invoice. Stored reviewed rates govern actual quotes.

Private references require explicit sharing permission before server-signed, time-limited input URLs are created. Project caps and quote-specific spending authorization remain separate, and neither starts a call. Run is explicit. Quotes bind the exact specification, currently approved sequence, canonical prompt, input pins, selected model and price. Reference and storyboard jobs share the existing wallet, reservations and unknown exposure; this is not a second budget.

The existing hard two-attempt work-unit limit remains. A second attempt requires an explicit correction diagnosis, fresh quote and authorization. A consumed permission cannot start another variant. The saved diagnosis is not an automatic prompt repair; desired creative changes must be made and approved in the direction. Unknown submissions retain the original request and hold; automatic resubmission, paid fallback and model switching are blocked. Known jobs can be polled and recovered through their frozen model snapshot after registry retirement or generation pause. Reservations remain labelled as such until actual billing reconciliation.

## Private pixels, histories and review flags

The importer accepts only an owned completed job's saved output receipt. It validates one trusted fal PNG descriptor, downloads with existing host/redirect/size safeguards, decodes actual PNG pixels and checks the exact historical output dimensions. Deterministic job-derived IDs, checksums and immutable receipts allow interrupted imports to recover without generating again. Bytes remain in the private `director-reference-media` bucket. Clients cannot submit arbitrary output URLs, success flags or generation provenance.

The bounded archive supports 200 shots, 100 versions per shot and 1,000 selection events. Guarded saves lock owner, project version and latest approval identity, preserve history and admit only storyboard production changes. Imported creative histories do not transfer approvals, trusted candidate receipts or spending authority. Generic project PATCH cannot forge this archive. Private database approval evidence is omitted from customer responses.

Own contract/source/reference changes hold stale direction and selection reuse while preserving images, jobs and review history. Sequence reordering or a neighboring contract edit requires renewed whole-sequence review. After that review, an unchanged shot's own exact inputs can be reused without generating another image. New quotes bind the current approved sequence. Frames are stored in dedicated selection history rather than written into legacy flat shots/timelines; that avoids invalidating managed contracts or implying footage approval.

## API surface

Routes sit under `/api/projects/:id` and require project ownership:

- `GET /storyboard-production`: source/reference holds, frame histories, exact eligible model profiles, saved jobs and project cap.
- `POST /storyboard-production`: free `prepare`, `update`, `refresh` and acknowledged `select` commands.
- `POST /storyboard-production/quotes`: canonical server-compiled input; no client raw prompt route.
- `POST /storyboard-production/jobs`: reserve and explicitly dispatch the approved scope.
- `POST /storyboard-production/import`: privately recover the actual owned completed image.
- `POST /storyboard-production/reviews`: save an explicit correction diagnosis without generation.
- Existing `/spending-budget`, `/spending-authorizations`, job dispatch/poll and `/approvals` provide the shared financial and review controls. Direction/frame approvals require their own acknowledgements.

## Verification and remaining acceptance

The new automated coverage comprises 20 core, 17 provider, 22 API, seven integration, nine cloud-adapter and three pricing cases. It checks source and reference revocation, scope/owner isolation, immutable histories, exact costs/aspects, shared spending exposure, explicit review, two-attempt limits and frozen-job recovery. The independent SQL proof uses the final migration SHA256 `b47ca7b6fe4282d2092a2f49ccfbd81e87f3cd110552e613980db020289ad61b`.

Local Chromium exercises actual HTTP APIs and private image reads with server-side synthetic fal output: free preparation; wide generation with five distinct inputs and consumed-quote protection; portrait generation and unsaved editor/footer hit checks at 390px; and exact identity-review revocation preserving earlier images. No unexpected console/HTTP errors appeared. Earlier recovery checks deliberately inject a store 503 or planning network failure and label them as fixtures. Existing project persistence, edits, image selection and uploaded-preview playback regressions pass. Hosted finished-movie export remains unavailable.

Screenshots show synthetic dimension-valid images, not actual model quality. Deployed website/account tests remain deferred. Physical phones, virtual keyboards, native concurrent-session scheduling/latency, paid quality, identity continuity, provider invoice accuracy and the two-attempt quality-success target remain unverified. No broad release acceptance is claimed. The tracker advances F038 to partial: 70 partial, 91 missing/unverified, six deferred and zero fully production-accepted.

Next production work is timed storyboard animatics and the subsequent footage/sound workflows. See [machine-readable checks](evidence/STORYBOARD_PRODUCTION_CHECKS_2026-10-19.json), [native checks](evidence/STORYBOARD_PRODUCTION_NATIVE_CHECKS_2026-10-19.json), [endpoint evidence](evidence/FAL_STORYBOARD_ENDPOINT_2026-10-19.json) and [implementation knowledge](STORYBOARD_PRODUCTION_KNOWLEDGE.md).

# fal routing and intelligence: source reconciliation

Reviewed 18 October 2026 UTC. This note incorporates the two user-supplied documents and live official documentation into the Model Router Intelligence Bible. It records knowledge and implementation requirements; no model was executed, new registry entry activated or provider setting changed during this review.

## Sources and authority

- User attachments preserved as [overview](knowledge-sources/fal/overview-2026-10-18.md) and [models](knowledge-sources/fal/models-2026-10-18.md).
- Live documentation starts at [fal documentation](https://fal.ai/docs/documentation) and its [agent index](https://fal.ai/docs/llms.txt). Selected official pages were fetched directly and archived by URL/hash in the source manifest.
- Two agents independently reviewed platform behavior and model/schema changes. Live catalog discovery was supplemented by full schema reads for Nemotron audio, sync-3 and Flashtalk. These are schema observations, not execution, musical-analysis accuracy, singing fidelity or creative-quality acceptance.
- Exact endpoint schemas, account eligibility and observed tests control runtime fields. Overviews, cards, curated skills and recommendation rankings guide candidate discovery; they do not establish universal best models or equivalent capabilities.

The overview card titled “Kling 3.0 Pro” points to a `v2.5-turbo` endpoint. The available-models Nano Banana 2.1 generation row mentions references while describing text-only input. These inconsistencies demonstrate why display labels cannot become executable registry contracts. Absence from this selected list is not deprecation evidence.

## Architecture clarification

Our present provider integration uses **Model APIs**, which invoke hosted endpoints. **fal Serverless** deploys our own Python/GPU applications, has different billing/scaling responsibilities and requires separately approved deployment access. Do not treat that access as existing or apply Serverless deployment/retry controls to shared hosted endpoints without verifying applicability.

The app can keep its `FAL_API_KEY` environment name while sending the documented `Authorization: Key …` header from the server. Documentation examples naming `FAL_KEY` do not require an additional secret merely because the example variable name differs.

## Required platform changes before generation activation

| Priority | Verified finding | Director requirement |
| --- | --- | --- |
| P0 | [Model fallbacks](https://fal.ai/docs/documentation/model-apis/inference/reliability#model-fallbacks) are enabled by default for supported models. | Explicitly disable fallback for an exact approved/quoted route with `x-app-fal-disable-fallback: true`, or implement a separately evaluated and approved fallback contract. Current provider adapter does not yet set this header. |
| P0 | [Queue retries](https://fal.ai/docs/documentation/model-apis/inference/queue#disabling-retries) can repeat infrastructure execution; [reliability](https://fal.ai/docs/documentation/model-apis/inference/reliability#automatic-retries) describes up to ten retries. | Track creative attempts, application submissions, provider infrastructure attempts and webhook deliveries separately. Set an explicit retry policy. `X-Fal-No-Retry: 1` can disable queue retries; custom per-condition Serverless retry configuration is not assumed to govern shared endpoints. Two acceptable creative attempts remain a measured target, not a network retry count. |
| P0 | [Lifecycle defaults](https://fal.ai/docs/documentation/model-apis/common-parameters#x-fal-object-lifecycle-preference) can be forever and publicly readable when not configured. [Request payloads](https://fal.ai/docs/documentation/model-apis/media-expiration) have separate retention controls. | Choose explicit media lifecycle/ACL and request-history policy, ingest outputs into owned private storage and track expiration/deletion evidence. Never assume a universal seven-day retention window or claim ZDR from one header. |
| P0 | [Billing events](https://fal.ai/docs/platform-apis/v1/models/billing-events) supply request IDs, units and actual cost breakdowns, including discounts and nano-USD representation. | Reconcile reservations against request-level events with exact arithmetic and deduplication. Preserve unknown-charge holds until evidence resolves them. Billing access requires permissions beyond ordinary inference. |
| P1 | [Model discovery](https://fal.ai/docs/platform-apis/v1/models) supports exact IDs, search, pagination and `expand=openapi-3.0`. | Import into a versioned staging catalog, record source/time/schema hash and diff changes. Promote only after adapter, price and quality verification. Keep the original M01–M20 associations historically intact. |
| P1 | [Pricing](https://fal.ai/docs/documentation/model-apis/pricing) includes images, megapixels, video seconds/videos and compute-based cases. [Estimation](https://fal.ai/docs/platform-apis/v1/models/pricing/estimate) distinguishes historical call estimates from expected billing units. | Extend the current simple-unit engine through explicit unit/configuration adapters. Do not reinterpret compute seconds as media duration, guess pixel rounding, assume all rates are linear or promote advisory estimates into invoices. |
| P1 | [Webhooks](https://fal.ai/docs/documentation/model-apis/inference/webhooks#verification-process) use raw-body hashing and ED25519 verification. | Verify all four headers, timestamp ±300 seconds and JWKS; cache keys for no more than 24 hours. Bind request and account identity to stored jobs, durably deduplicate and acknowledge quickly. Webhook OK/ERROR is not queue IN_QUEUE/IN_PROGRESS/COMPLETED. |
| P1 | [File access](https://fal.ai/docs/documentation/model-apis/fal-cdn#using-your-own-storage) requires runner-accessible media URLs. | Use bounded signed URLs or explicit provider ACL access for private references. Cookie-protected app proxy URLs cannot simply be sent as model inputs. Signed-link validity and stored-file lifetime are different. |

A transport timeout does not prove that no output was generated or charged. Provider-owned retries are not evidence of hosted POST idempotency. Keep the existing no-blind-resubmission policy and request-identity recovery. Cancellation also requires evidence of its actual outcome; a request to cancel does not prove the work stopped.

Webhook delivery windows are bounded: current docs describe a maximum of 31 retries, different timeouts for first/retried delivery and shorter retention windows for larger results. Persist/ingest promptly and retain polling recovery rather than relying on eventual webhook success forever.

## Candidate expansion and task-specific limits

| Production role | Candidate / source | Evidence and constraint |
| --- | --- | --- |
| Semantic song/audio interpretation | [Nemotron audio](https://fal.ai/models/nvidia/nemotron-3-nano-omni/audio/api) | Schema inspected. Requires prompt/audio_url; documentation describes English-only prompts, WAV/MP3 and up to 50-minute recordings. Song-analysis quality is untested. Use semantic descriptions alongside separate DSP timing, transcription and alignment. |
| Portrait plus audio | [Flashtalk](https://fal.ai/models/fal-ai/flashtalk/api) | Schema inspected. image_url/audio_url plus optional seed; inspected description gives 768×448 at 25 FPS. No input resolution/aspect selectors observed. Singing and identity/temporal quality untested. |
| Existing-video lip-sync repair | [sync-3](https://fal.ai/models/fal-ai/sync-lipsync/v3/api) | Schema inspected. Requires video_url/audio_url; default cut_off, nested options.sync_mode overrides top-level. Some inherited fields are ignored or refer primarily to react-1. Do not reuse the emotional-performance contract of M20 unchanged. |
| Character continuity and physical action | Wan 3.0 Prime reference routes; Kling v3 motion control | Live discovery only. Reference-driven generation and motion control are separate capabilities from ordinary image-to-video. Exact schema and identity-quality pilots required. |
| Final character/reference stills | GPT Image 2/2.5 generation/edit variants; Nano Banana 2.1/edit | Discovery candidates for the casting-image gap. Resolve each endpoint/version/schema rather than swapping the old draft-image route by brand name. |
| Audio-timed video and longer shots | LTX 2.3 audio-to-video; Seedance 2.5 variants | Attachment/discovery leads. Confirm canonical endpoint/region, timing/resolution and audio behavior before adapter creation. A limited search that misses the attachment's exact ID does not prove unavailability. |
| Video-conditioned sound | Sonilo video-to-SFX; Mirelo video-to-audio | Distinct from text-prompt SFX. Add event timing, ambience/foley roles and listening/synchronization review to the workflow. |
| Localization and speech preparation | Dubbing, speech conversion, Silero VAD | Distinct processing tasks requiring consent/language/timing and speaker-quality checks. They do not automatically prove singing translation or voice preservation. |

The attached `fal-ai/elevenlabs/music` and existing M11 `elevenlabs/music/v2.5` are different IDs. Do not overwrite one with the other because their display names both say ElevenLabs Music. Nemotron and other direct fal analysis candidates may reduce optional OpenRouter dependence, but capability and output benchmarks must decide that change.

## Intelligence-layer implications

The Director should create an intent/constraint brief first, then select a department workflow and task profile. A profile specifies input artifacts, measured facts, reference roles, model/schema version, prompting recipe, cost rule, expected output, evaluation criteria and a scoped repair path. Candidate popularity or a provider's default recommendation is one input, not the creative decision itself.

- **Short film:** story/script → breakdown → character/world references → shot-specific route (reference, image-to-video, motion control or text-to-video) → separate dialogue/performance/sound → continuity and temporal review → editing/export.
- **Music video:** semantic song analysis + measured tempo/beats/sections + canonical lyrics/transcription/alignment → treatment and timing plan → continuity references → beat/phrase-aware shots → performance/lip sync only on appropriate passages → audiovisual review and edit.
- **Talking avatar:** consent/reference → approved speech and performance direction → measured audio → portrait performance or existing-video lip-sync route → identity, timing, articulation and listening review.

The requirement ledger should distinguish facts mechanically validated by schemas, descriptive limits documented by providers, observed benchmark results and creative judgments. Unsupported fields, inherited schema fields, claimed identity consistency and musical understanding must not silently become verified capabilities.

## Immediate implementation sequence

1. Preserve these sources and this reconciliation in the Bible and build index.
2. Add explicit fallback/retry/retention policies and tests before paid routes are enabled.
3. Add staged live catalog/schema/pricing imports with provenance and change review; evaluate new candidates without replacing historical IDs.
4. Build actual request-level billing reconciliation and signed webhook ingestion, retaining unknown-cost recovery.
5. Add task/sequence profiles and quality benchmarks for song analysis, reference continuity, portrait performance and lip sync.

Only source research and knowledge incorporation were performed for this refresh. The 122-test router/estimate implementation from the preceding work remains a separate, locally verified, uncommitted batch; this review does not upgrade it to a deployed full intelligence system.

# Song Intelligence — provider workflow and qualification boundary

20 October 2026. Provider increment published to main as `1fb196774d3c1f14703183ff9295bb712039c993`, following `2529691a58219c4d9c82d1a457150892f065ca7c`. Music Video Production remains the locked first release, using the frozen interface, shared production engine, seventeen departments, Model Router Intelligence Bible, Realism Intelligence Layer and all eighteen release deliverables.

## Current implementation

The recovered deterministic analysis and saved song evidence now have a complete task-specific provider request/result path. It uses existing private storage, registry selection, quotes, cost authorization, reservations, job dispatch/polling, audit output history, two-attempt controls, project budgets and review/version mechanisms. No provider, runtime service, dependency, editor framework or QA framework was introduced.

| Capability | Actual implementation | Verification / remaining qualification |
|---|---|---|
| Original song ingestion | Existing device/ordinary upload and gated resumable source ingestion. Exact asset ID/version/checksum remains the master; no replacement vocals or rewritten audio. | Source/transport code and local fixtures tested; real source-publication installation/account acceptance still required. Ordinary upload remains 2 MiB; the separate resumable source path retains its existing 128 MiB bound and gates. |
| Deterministic signal analysis | Browser decoded duration/properties, waveform, RMS/peak, energy, onset candidates and low-confidence estimated tempo. Original codec/rate/channels are shown separately when trusted inspection metadata exists. | Real browser decoding tested. Energy boundaries are not musical labels; onsets are not a verified beat grid. Browser decoding remains bounded to 12 MiB/five minutes. Larger inspected originals can use the separately saved FFmpeg measurements described below; hosted execution still requires qualification and authorization. |
| Private published-source analysis | Authenticated same-origin reads in chunks up to 2 MiB; upstream range identity/size verified; complete original checksum verified before browser decoding. | Actual browser decoder and HTTP owner/range checks passed against the local storage fixture. No CSP or public-bucket/security change. Production storage behavior remains an account acceptance check. |
| Musical structure and understanding | `fal-ai/audio-understanding` receives the actual original audio plus a strict structure/evidence request. Sections, observations and vocal passages are normalized as proposals; unsupported/invalid conclusions are held. | Actual endpoint input/output schema observed. Real music interpretation, structure boundaries, emotion and instrumentation accuracy remain unqualified. A text-only LLM is not claimed to hear audio. |
| Lyrics | `fal-ai/elevenlabs/speech-to-text/scribe-v2`: automatic language, diarization, audio-event tags and empty premium-keyterm list. User text is never silently replaced. | Provider-shaped output conversion and end-to-end simulated request/review tested. Singing, language mixtures and multiple performers need real-output qualification; speech qualification alone does not enable this route. |
| Canonical text and timing | Exact Unicode/whitespace preserved. Transcript words map only to exact text spans and actual returned timestamps; missing/overlapping timing stays unresolved. User-reviewed matching transcript timings can be reused without another call. | Exact multilingual offsets/uncertainty, canonical replacement consent and saved-output reuse verified. Corrected lyrics require exact matching alignment, not guessed offsets or durations. |
| Forced alignment | `fal-ai/elevenlabs/forced-alignment`: original master plus exact current canonical lyrics. Word times become a proposal with unknown uncertainty; provider loss is never converted into a fabricated confidence/error bound. | Native and JS hourly pricing/source parity tested. Singing alignment accuracy remains unqualified; no real call was made. |
| Director/department handoff | Approved song evidence feeds the existing music-treatment operation/context and all seventeen department contracts. Lyrics remain original-song content, not replacement dialogue. Existing character/look/location/reference inputs and selective invalidation remain intact. | Real request construction and shared-contract fixture validation passed. Actual OpenAI treatment quality/activation still requires a separately reviewed music-enabled planning profile and real outputs. |
| Complete-song assembly | Portable FFmpeg supplied-media entry point covers an entire approved interval and preserves original-master content. | Actual 180-second/4,320-frame MP4 proof passed in the previous increment. Hosted dispatch, private output publication and customer download remain separate work. This is not a substitute for full Music Video Production. |

## Financial behavior

The registry remains authoritative for approved models and tariffs. Task-specific requests require fresh music-purpose evaluation (`musical_audio_analysis`, `singing_transcription`, `sung_lyric_alignment`), exact reviewed schemas and all existing activation, cost and operational controls. No real route is activated by adapter availability.

Only trusted inspected/published duration can price a song request. A browser estimate, edited duration field or arbitrary URL cannot supply billing authority. The request URL must identify the exact owned private recording. Source analysis is permitted before film departments are finished, through a narrow typed-source exception; other media tasks retain their ordinary department/storyboard prerequisites.

Observed pricing on 20 October 2026:

| Operation | Evidence | Conservative estimate for a 180-second song |
|---|---|---:|
| Audio interpretation | fal pricing lookup: $0.01 per five seconds | $0.36 |
| Transcription, no keyterms premium | fal model page/lookup: $0.008 per audio minute | $0.024 |
| Forced alignment | Published model page: **$0.22 per audio hour, rounded up to the nearest hour** | **$0.22** |
| All three, one request each | Audio analysis operations only | **$0.604** |

These are provider-cost estimates, excluding LLM treatment planning, images/footage, rendering, storage/transfer and customer markup. They are not an invoice or a complete music-video price. Interpretation/transcription reserve whole reported billing blocks conservatively; reconciliation remains separate. Alignment is billed by a started hour even for a short excerpt. The initial API lookup returned generic `units`; the published page resolves that ambiguity. [Observed schemas/pricing](evidence/FAL_SONG_ENDPOINTS_2026-10-20.json) records the exact alignment wording and source URL.

The interface reuses the existing spending dialog. Estimate review and spending authorization do not submit a model request. Start authorized analysis makes one explicit reserved request; unknown outcomes retain the cost hold and block duplicate replacement. An explicit diagnosed correction is required before attempt two. Import/review never settles a provider charge or approves production automatically.

## Output reuse and editorial authority

A completed result remains in the existing job/audit history. When the exact original master is unchanged, it can be reviewed against a later song-evidence version without re-transcription/re-interpretation. The user sees both source versions. A proposal fingerprint prevents applying evidence that changed since preview. Existing canonical text needs explicit replacement consent. Alignment additionally requires the exact canonical text used in the saved request; changed lyrics are held.

A reviewed proposal updates only the relevant song evidence. The original master, accepted media and other production records remain. The new evidence version is unapproved until separately reviewed for Director handoff; prior versions remain. Dense transcription stores words in compact bounded groups without removing word timestamps or asserting musical phrase boundaries. A 600-word/180-second capacity case preserves every word row inside the existing production-record bound. Oversized documents still fail explicitly; no canonical text or timing is silently truncated.

## Concrete code entry points

- `public/song-analysis-core.js`, `public/song-analysis-browser.js`: deterministic measurement and bounded original reads.
- `public/song-intelligence-core.js`, `public/song-intelligence-ui.js`: saved evidence, canonical edits, approval and Director handoff.
- `song-provider-results.mjs`: task-specific request preparation, proposed interpretation/transcription/alignment normalization and explicit review.
- `song-pricing.mjs`, existing `cost-quotes.mjs` / `spending.mjs`: trusted audio usage and shared quote/accounting rules.
- `song-provider-controller.mjs`, `song-provider-store.mjs`: existing job/cost/review machinery, source-bound reservations and result reuse.
- `public/song-provider-ui.js`: contextual analysis/cost/request/result controls inside the existing song panel; no layout redesign.
- `api.mjs`: `/music-video/intelligence/providers` and `/quotes`, `/start`, `/poll`, `/proposal`, `/apply`, `/review`; owned `/assets/:id/analysis-content` byte ranges.
- `database/director-song-provider-pricing.sql`: prepared native pricing/approval/job/registry parity. Existing department machinery is reused.

## Checks actually run

1. One full existing Node regression invocation passed **881 tests / zero failures** at the provider-increment boundary. The subsequent alignment-pricing refinement passed the updated six-case result parser, nine-case API/control suite and nine reported native PGlite checks. These focused late checks were used instead of repeating the whole suite after that refinement.
2. Existing shared cost/model/provider/reference/storyboard regression selection passed 63 cases. The storage range checks passed five cases. No separate QA framework was created.
3. Affected local Chromium groups passed: music-video source/timing workflow; song evidence/canonical correction/approval/Director handoff; provider quote → existing spending dialog → one saved job → original request poll → review → new unapproved song version. Private published-source browser decoding passed as well.
4. Desktop and mobile viewport evidence exists, with no captured page/console/HTTP errors in these groups. Model/storage responses in the provider flow are explicitly simulated. No physical-device verification or live production QA is claimed.
5. Syntax checks and production Node build passed. The native proofs run only in isolated PGlite; they do not install production schema or qualify providers.

## Production gates and requested approval

**No production migration, model activation, paid provider request or Vercel Sandbox operation was executed.** No Vercel connection/deployment retry was made; GitHub remains responsible for triggering deployment.

The existing prepared source-media SQL must be installed before trusted source publication can be exercised in the production account. After confirming which dependencies are already installed, the prepared order is:

1. `database/director-media-ingestion.sql`
2. `database/director-source-inspection-jobs.sql`
3. `database/director-source-publication.sql`
4. `database/director-song-intelligence.sql`
5. `database/director-song-provider-pricing.sql`

All retain the existing foundation/production/registry dependencies. Apply only missing increments after explicit production-migration approval. Do not blindly rerun existing migrations or enable broad access. Installation does not authorize paid models, a Sandbox, public storage or configuration/security changes.

Real qualification requires an explicitly approved source song, financial authorization, and review of actual structure/lyrics/timing plus a music-enabled Director planning profile. A one-song sample cannot establish general singing/lip-sync quality or the two-attempt creative target. A qualified source-inspection executor, real account isolation/private playback, hosted complete-song finishing and subsequent creative pilots retain their own acceptance gates.

## Next increment

Qualify actual Song Intelligence/Director outputs when the explicit source/access/spend gates are authorized. Continue the approved treatment and applicable department outputs into existing cast/look/location/reference binding, real storyboard frames and full-song animatics, then singing/performance/B-roll, editing and complete-song delivery. Keep every [music-video release deliverable](MUSIC_VIDEO_RELEASE_IMPLEMENTATION.md) and shared-format contract intact; no simplified demo or product-scope reduction is accepted by this checkpoint.

## Full-size original measurement increment

The existing isolated FFmpeg source-inspection worker now accepts an explicit `songAnalysis: true` configuration. For mono/stereo audio from one second to five minutes within the existing 128 MiB source limit, its full decode also produces bounded waveform, energy, level, onset and tentative tempo evidence at a 16 kHz analysis rate. Original stream metadata remains separate. The original object is not changed or re-encoded. Unsupported channel/duration configurations retain ordinary inspection without claiming song measurements. No executor is enabled by this option.

The trusted existing inspection coordinator validates the ordinary inspection result and normalized signal contract, saves a `song_signal_measured` event, then accepts inspection and optionally publishes the original through the existing source-publication mechanism. A failed feature save holds the result without automatic paid replay. A saved signal grants no source-publication, spending, lyrical, musical-structure or creative approval authority.

Owned `GET /api/projects/:projectId/assets/:assetId/song-analysis` returns only saved measurements pinned to the exact published master/checksum/version. A missing result returns a hold; reading it never starts a worker. The cloud read filters the exact source event before pagination. The existing analysis action uses this result for private originals above 12 MiB, avoiding another large original download or browser decode. Saved technical provenance distinguishes `worker_decoded` / `director-ffmpeg-audio-features-v1` from browser measurements. Manual review/version/Director controls remain unchanged.

Actual local evidence: a 180-second, stereo 48 kHz PCM WAV larger than 12 MiB was fully decoded, measured and checked against the unchanged original checksum and modification time. Its saved record retained the actual 180-second duration, 128 waveform bins, 180 energy intervals and explicit tempo/beat uncertainty. Four new focused checks, fifteen existing worker checks, seventeen existing inspection/coordinator/SQL checks and thirty song/provider compatibility checks passed. The affected provider Chromium group, syntax check and production build passed. One initial local child-Node proof returned empty stdout under restricted process permissions; rerunning that affected group with scoped local-runtime permission passed all fifteen checks. No production setting was changed.

The Sandbox-compatible proof harness now packages the reused deterministic analyzer alongside the inspector, preserving portable module imports. Only its local adapter was exercised. Actual Vercel Sandbox execution, runtime image, private transfer, cost and cleanup remain unqualified and unauthorized. This closes the independent implementation/local proof for large originals, not live hosted activation.

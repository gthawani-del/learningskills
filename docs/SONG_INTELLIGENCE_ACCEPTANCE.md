# Song Intelligence — implementation and acceptance

**Latest implementation:** [Provider workflow, current alignment pricing, qualification boundary and native installation gates](SONG_INTELLIGENCE_PROVIDER_ACCEPTANCE.md) supersede the initial automatic-provider code gaps below. This page records the first published recovery/Director/render increment at `2529691`. Real provider/production acceptance is still not claimed.

20 October 2026. Baseline main: `b8b5fde4fd4a61267c8f3a90caed982f27c78842`. Music Video Production remains the first release. The frozen interface, shared production records, seventeen departments, approved media and all eighteen release deliverables remain authoritative.

## Working implementation in this increment

- Recovered the unpublished browser audio-analysis modules; extended them rather than replacing them. Original owned WAV/MP3 bytes are checksum-checked before decoding and never rewritten. Device drafts and ordinary private assets work within existing upload limits. Browser measurement is bounded to 12 MiB and five minutes. Larger-source ingestion/inspection retains its existing separate activation gates.
- Measured decoded duration, sample count, channel count and analysis sample rate; persisted waveform extrema, RMS/peak/near-full-scale fraction, bounded energy envelope and strongest positive-energy onset candidates. Tempo is explicitly low-confidence with half/double ambiguity. The decoder's sample rate is not presented as the original recording's sample rate/codec. Energy boundaries are not automatically named verse or chorus.
- Added one versioned `song_intelligence_v1` edit record referencing the exact `music_video_plan_v1` master. It stores complete source coverage, evidence-labelled musical sections, mood/instrumentation/vocal/emotion/transition observations, vocal passages, exact canonical lyrics, languages, optional singers and phrase/word timings with nullable uncertainty. No language, visible singer, lyrics or genre is imposed. Instrumental projects do not acquire invented vocals.
- The existing music panel now exposes measured features and collapsed correction controls, save/cancel, explicit evidence review and approval. Canonical text preserves whitespace, Unicode and user corrections. Changing it clears alignment from the new version; prior versions remain. Incomplete evidence remains visibly unknown. Oversized records fail explicitly instead of truncating canonical text or inventing timing.
- Approval exposes an owned Director context and Continue to music treatment. Existing planning operations receive the approved song structure, canonical text, uncertainty, timing, shot roles and original-master instructions. Lyrics do not become replacement spoken dialogue. Existing approved character/look/location inputs remain available through the shared context.
- All seventeen existing departments retain their contracts and approval ledger. Their shared deterministic preparation receives exact song pins, musical sections and applicable original-master guidance. Instrumental work can mark voice non-applicable only when no additional speech is requested. Fixture-authored treatment output validates through the actual department proposal contract; this does not establish OpenAI creative quality.
- Song version changes invalidate dependent screenplay/department source bindings and planning scopes without deleting approved history. Device-to-cloud import remaps both song-plan and song-intelligence source IDs while preserving canonical text/checksum; it never imports approval or spending authority.
- `song-render.mjs` extends the existing FFmpeg foundation with a portable supplied-media assembly entry point. It requires complete contiguous approved-range coverage, exact master/source pins, explicit trims, correct project duration/aspect and sufficient footage. Singing requires a reviewed original-master/source timing binding. It rejects hidden retiming, looping, short clips, unsafe paths and changed master bytes. Generated clip sound is discarded. Final audio is AAC encoded from the original master, not a byte-identical compressed audio stream.

## Verification actually performed

- One full existing Node regression invocation: 857 tests, 856 initially passed; one pre-existing frozen-navigation assertion still expected Home. Corrected that assertion to the approved Create label and reran its six-case file: all passed. No runtime navigation redesign was made to satisfy an old test.
- New analysis, saved-evidence/API, Director/department, PGlite source-currentness and render tests all passed within that run. The supplied-media test actually encoded and decoded a 180-second MP4 with 4,320 frames, then checked original-master frequencies in early/middle/late audio against different source-video audio. It also checked source bytes unchanged, short/unsafe source rejection and cancellation.
- Two affected local Chromium groups passed after replacing stale selectors with the frozen UI's actual stage select, Upload and mobile Results controls. Song evidence/canonical corrections/approval survive reload; approved Director context is returned; source audio stays unchanged; no captured page/console/HTTP errors. Desktop and 390×844 viewport evidence is recorded. This is not physical mobile-device or production-account verification.
- Production Node build imported successfully. Existing affected QA selection checks were reused. No dependencies or QA framework were added.

## Explicitly incomplete / gated

1. Automatic semantic audio understanding, singing transcription and forced-alignment execution/import remain the next code increment. Manual review and contract tests do not prove those provider capabilities. Plain text-only LLMs are not described as hearing audio. No paid calls occurred.
2. A music-planning model profile must separately opt into `song_intelligence_v1` and its current schema/instruction fingerprint. Old ordinary-film profiles remain unchanged. No model was activated or claimed qualified.
3. `database/director-song-intelligence.sql` is prepared and tested in isolated PGlite only. Production migration approval/application is still required for native source-currentness and consent-snapshot parity. No live schema, permissions or security settings changed.
4. Original-source resumable upload, trusted hosted inspection and real two-account/private-storage acceptance retain their recorded dependencies. Browser-derived features are creative evidence, not trusted billing measurements.
5. Complete-song rendering is locally proven from supplied media. Hosted worker execution, durable render dispatch/recovery, private output publication and a user download route are not delivered by this portable feasibility proof. No Sandbox was provisioned.
6. Actual singing quality, generated footage/storyboards, full-song creative acceptance, live billing reconciliation, physical devices and private pilots remain outstanding. No release percentage is inferred from passing tests.

## Next functional increment

Connect task-specific audio provider results to this evidence/version/canonical-text workflow through the existing registry, quote/authorization, reservation, job and audit mechanisms. Keep unsupported prices and unqualified singing capabilities held. Then use the approved treatment/departments for existing cast/reference/storyboard and full-song animatic workflows. Preserve every item in [the eighteen-deliverable release checklist](MUSIC_VIDEO_RELEASE_IMPLEMENTATION.md).

## Release / rollback

Publish the scoped source, prepared SQL, tests and acceptance evidence through the existing main workflow. GitHub triggers Vercel; no Vercel deployment orchestration is performed here. An application rollback is a normal revert to the baseline above. The prepared migration is not installed, and no provider routes, paid processing or product security settings were activated. Exact publication hash is reported with the increment.

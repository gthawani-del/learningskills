# Five-foundation production implementation — 19 November 2026

This is the implementation update to the [source audit](reconciliation/FIVE_FOUNDATIONS_AUDIT_BASELINE_2026-11-19.md) and [54-row reconciliation](reconciliation/FIVE_FOUNDATIONS_BASELINE_2026-11-19.csv). Those are preserved historical baseline findings, not current completion claims. The 105 historical requirements remain in their existing matrix/CSV; they have not been relabelled freshly verified. Music Video remains first; all seventeen departments and eighteen release deliverables remain binding. No frozen shell redesign, new provider, dependency or hosting infrastructure.

## What now executes

| Requirement / baseline rows | Existing architecture extended | User-visible behavior and enforcement | Evidence / remaining gate |
|---|---|---|---|
| Intent to suitable model (FND4-02) | `routing-policy.mjs`, ordinary edit records/approvals, planning context and cost quotes | Optional approved policy follows quote → allowance → start/recovery. Revocation, duplicate records and changed brief hold execution. Existing model allowance never silently changes model. | Policy/routing lifecycle tests; prepared native quote policy guard tested offline. Production migration unapplied. |
| Quality/cost/speed (FND4-03) | Existing routing evaluator and full server quote | Explicit weights/scales, hard measured quality floor, complete configuration cost bound and measured latency. No cheap-by-default inference or demographic stereotype. Explanation is part of the quote/routing result. | Utility, cost quote and quote→persist→authorization tests. No claim these bounds are expected cost or live latency. |
| Learning/evals/health (FND4-04, BIND-01) | Existing audit, job/attempt, registry and staff controls | Explicit actual-media acceptance/defects; supersession conflicts; measured attempt denominators; known/unknown cost separation; accepted finished minutes. Optional scoped provider-health hold; discounted Beta evidence and seeded Thompson replay are offline recommendations only. | Outcome/health/replay tests. Real benchmark scores, active experiments and automatic registry promotion are not granted. |
| Same Director, both modes (FND4-01, FND5-01–03) | `production-package.mjs`/controller, existing planning operations, one existing composer | Full-song recommended treatment, applicable department documents, casting/reference/shot plan, quote items, uncertainties and one bounded approved next action. Existing revisions/actions remain authority. Motion/edit/delivery readiness reads actual source/acceptance/timeline/render facts. | Package/API tests and Chromium. This is not an unrestricted autonomous tool loop or a paid whole-film completion claim. |
| Stills → motion, selective singing (FND2-03, FND3-01–03) | `performance-input.mjs`, production controller/store, existing finance/jobs | Review motion direction and exact selected frame; permit input sharing; exact quote; project cap; separate spend allowance; dispatch/poll/import/decode; review and select take. Failed work needs diagnosis before the second attempt. Existing clips survive edits. | Exact compiler, schema/provider transport, actual FFmpeg excerpt/MP4 inspection and native guard tests. Singing quality remains unqualified. |
| Complete edit/master/text/delivery (FND1-03, FND3-04) | `music-video-editing.mjs`, existing edit/approval records and FFmpeg renderer; durable render job adapter | Full original-song coverage, explicit trims/fit, accepted video or explicitly approved current storyboard stills, canonical captions and timed title, timeline approval, bounded render authorization, private result and separate download. Singing requires exact original-master timing and reviewed selected motion. | Actual 180-second render proof; private-worker short-file proof; owner playback/download API; native leases/caps/source-race/cancellation tests. Hosted qualification remains external. |
| Frozen customer experience (FND5-04) | Existing right-hand production/edit/export content and planning dialog | Collapsed, prefilled production controls; saved job status, cost limits, explicit problems and next actions; unsaved production edits protected. Desktop layout and mobile navigation unchanged. | Chromium desktop/mobile viewport screenshots and console checks. No physical-device claim. |

## Seventeen departments, one production system

The existing `DEPARTMENT_IDS`, planning contracts, versioned guidance, dependency graph and package approvals remain authoritative. The new motion compiler reads their current scene-specific requirements and user-selected choices, retaining applicability rather than inventing seventeen customer approvals or seventeen runtime agents.

| Department | Production responsibility retained |
|---|---|
| Producing | Scope, order, constraints, expenditure and delivery readiness. |
| Direction | Emotional arc, staging, performance and purposeful coverage. |
| Script breakdown | Treatment/scene/source interpretation and requirements. |
| Casting | Exact approved performer identity and permitted reuse. |
| Look | Identity, wardrobe, hair/material continuity and chosen style. |
| Locations | Approved setting, layout and environmental continuity. |
| Camera | Shot contract, viewpoint, movement, lens and coverage intent. |
| Lighting | Motivated light, exposure/material detail and continuity. |
| Voice | Original singer/performance preserved; no replacement TTS in this flow. |
| Sound | Original-song playback and applicable sound requirements. |
| Music | Actual song intervals, phrasing, emotional progression and sync roles. |
| Continuity | Source versions, exact references, accepted neighboring work and selective repair. |
| Storyboard | Approved start-state frame and current shot contract. |
| Animatic | Full-song timing/pacing reference, not a singing-quality certificate. |
| VFX | Applicable graphics/finishing intent; no accidental photographic CGI finish. |
| Editorial | Source selection, trim, fit, master clock, captions/titles and final assembly. |
| Rights | Existing ownership, source and consent requirements; model output is not legal clearance. |

Photographic motion prompts preserve natural anatomy/skin, breath/blinks, contact, light and material stability; stylized briefs retain their chosen style. They are instructions requiring evaluation, not guarantees. Prompts retain the existing original-master/canonical-text restrictions. Oversized/unsupported configurations hold before paid submission rather than dropping requirements.

## Exact provider and deterministic boundaries

- **Singing adapter prepared:** `bytedance/omnihuman/v2`, exact `image_url`, `audio_url`, optional `prompt`; no fabricated duration/resolution input. Read-only fal metadata observed USD **0.105/second** on 19 November 2026. This does not activate a registry entry or establish output quality.
- **Image-led B-roll/narrative/dance adapter:** existing `minimax/h3-max/reference-to-video`, image-only reviewed input. Timed audio/video-reference H3 execution remains held. No beat-sync or singing claim from an image-only call.
- **Audio excerpts:** original source, native samples/rate/channels, WAV derivative, 4–300 seconds and at most 15 MB. MP3 decoding uses PCM; no voice synthesis, lossy re-encoding, stretching or invented padding. Nearest-sample rounding explicitly records maximum half-sample boundary error. A whole-second quote quantity is a conservative upper bound, not an assertion about supplier billing rounds.
- **Finishing:** deterministic FFmpeg, explicit original-master audio, canonical literal caption text and literal title files; contain/cover framing, complete frame/timing/decode checks. AAC delivery re-encodes the original audio; the MP4 audio stream is not byte-identical to the source.
- **Execution:** `createPrivateSongRenderWorker` consumes already authorized jobs and existing private storage. It stages bounded exact sources, uses FFmpeg and requires truthful compute accounting. `scripts/run-director-render.mjs --help` documents explicit local unbilled execution. It never creates a VM. Production needs the existing trusted hosted executor/runtime and its reviewed quote/accounting integration.

## Recovery, financial and source guardrails

Ordinary approval never grants paid generation. Current model/schema/price/task qualification, project caps, reserved finishing money, exact quotes, explicit authorizations and job claims still apply. Media and render reservations share project exposure. Unknown execution/charges remain held; no automatic model replacement or retry.

An unclaimed expired render releases its reservation; an owner can cancel an unclaimed render idempotently. Running/unknown renders cannot use cancellation to erase possible charges. Completed settlements retain truthful overruns. Render claims and completion recheck selected source bytes, current source records/approvals and actual verdicts. Navigation and unrelated reviews do not invalidate an unchanged authorized timeline. Take selection and its accepted verdict save atomically under project/source/approval fences.

The backoffice adds owned-project quality/outcome reporting within existing staff permissions. It does **not** confer organization-wide access, payment/refund authority or completed commercial operations. Missing render accounting is explicit and suppresses a falsely complete cost-per-minute figure.

## OpenMontage and practical-song provenance

The [pinned technical assessment](reconciliation/OPENMONTAGE_TECHNICAL_ASSESSMENT_BASELINE.md) remains the source inventory and license boundary. No AGPL source, prompts or skill files were imported. Independent implementations adapt the useful concepts: exact adapters, approved checkpoints, asset-first planning, bounded execution, diagnosis before repair, immutable selected work and source-aware editing/recovery. Director's existing departments/jobs/stores remain the implementation.

The recorded recent-song workflow informs approved stills before motion, selective singing, purposeful B-roll/dance, per-shot routing, exact original audio, reuse, deterministic text and editorial assembly. It does not turn prior attractive clips into qualified models or prove all footage was used. Each new selected take carries its actual job and review evidence.

## What is not a completed production release

1. No paid models, Sandbox sessions, production migrations, model activation or security settings were changed.
2. Prepared SQL: `director-performance-registry.sql` requires existing song pricing/registry migrations; `director-motion-production.sql`, `director-routing-policy.sql` and `director-render-jobs.sql` require their documented current baseline. Offline native installation tests are not live installation evidence.
3. Real task/configuration qualification remains required for singing, continuity, motion, multilingual transcription/alignment and full-song creative acceptance. WAN/Seedance and other candidates are not enabled by generic capability claims.
4. Hosted runtime/private transfer, truthful real compute/provider billing, two-account isolation and physical mobile-device release acceptance remain unverified.
5. Licensed stock retrieval/cross-project permitted reuse, face-aware automatic cutting, live adaptive experiments, broad creative benchmark execution, skill publication lifecycle and complete billing/refund/support/retention/founder operations are not declared finished by this increment. They remain explicit roadmap work, not disguised credential blockers.
6. Whole-production savings and acceptance within two attempts need representative finished-video pilots. Known operation bounds are not a complete-video price promise.

## Verification and engineering rulings

See `docs/evidence/FIVE_FOUNDATIONS_IMPLEMENTATION_2026-11-19.json` for final run results and review fixes. Existing tests/build, Chromium/Playwright and PGlite were reused; no QA framework or dependency was added. Two existing domain support agents handled independent media/render modules; one fresh whole-branch reviewer examined integration. Primary owned shared API/store/UI changes. Targeted tests accompanied fixes; broader regression ran at integration boundaries.

Rulings: optional policies use existing edit records/approvals; no policy preserves legacy defaults. Utility uses explicit reviewed bounds and weights, not invented market prices. Learning is offline until an authorized production policy exists. Local unbilled execution is explicitly distinct from hosted cost. Independent domain support was reused for renderer/native lease fixes, avoiding new per-task agents. If these choices prove unsuitable, their exposure is limited to policy UX, model qualification and executor integration; they do not authorize production spending.

### Recorded checks and UI evidence

Final full regression: **1,023/1,023**; syntax and production build passed. Later focused playback/download, storage and policy-UI checks passed (2, 7 and 3 cases). Affected Director Chromium flow passed: no unexpected page, HTTP or console errors, both participation modes, exact request recovery, preference save/approval and new production/editing controls. Providers and original-audio HTTP delivery in that browser fixture were simulated. The FFmpeg output checks used actual locally rendered media.

[Desktop motion controls](evidence/production-ui-2026-11-19/desktop-motion-controls.png) · [Desktop full-song editing](evidence/production-ui-2026-11-19/desktop-song-editing.png) · [Mobile viewport editing](evidence/production-ui-2026-11-19/mobile-song-editing.png). Screenshots are local fixture evidence, not production or physical-phone verification.

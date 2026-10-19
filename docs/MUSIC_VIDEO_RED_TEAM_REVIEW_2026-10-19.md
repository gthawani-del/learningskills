# Music-video red-team review and corrective QA

Reviewed baseline: `02120b450e5be89ef8133ae890657b52600249e6` (PR #5).
Scope: the new song-planning feature and the existing project settings, production dependency graph, storyboard, animatic and device/browser boundaries it uses. This is not a certification of every unfinished studio feature.

## Findings and corrections

| Finding | Evidence before correction | Correction | Regression evidence |
|---|---|---|---|
| High: the shared animatic ignored song intervals and could use another owned song | Adversarial Node test failed against baseline: contract estimates won over song timing; a different song was accepted | Existing animatic consumes the versioned song plan, its exact original audio, selected interval and cumulative integer-frame boundaries. Independent fitting/timing edits are disabled for that bound preview | Exact-source rejection; 24/25/30 fps frame conservation; real private-audio browser seeking and excerpt start/end checks |
| High: an old preview remained playable after song-plan changes | Adversarial Node test failed against baseline | Saved animatics pin the song record/version as an actual dependency; changes require explicit refresh | Old-version hold and missing-dependency tests |
| Medium: a positive millisecond interval could produce zero video frames | Adversarial Node test failed against baseline | Each shot must occupy at least one frame; runtime and shot limits match existing project/import/editor constraints | Subframe and shared-limit rejection tests |
| Medium: singer pins could disagree with production dependencies | Adversarial Node test failed against baseline | Performer pins must match stored dependency versions before readiness is reported | Missing-pin and stale-identity tests |
| Medium: one changed singer contaminated unrelated B-roll holds | Adversarial Node test failed against baseline | Shared source/timeline holds are separated from shot-specific performance holds; dependency graph exposes each separately | Production-state test proves the unrelated insert does not inherit singer holds |
| Medium: shared project settings silently ignored format changes | Separate before-fix Node reproduction failed (`short_film` remained after requesting `music_video`) | Existing settings updater validates and applies supported formats; established source-signature review rules continue to apply | Format change and invalid-format tests; full existing API/production regression suite |
| Medium: saving shot edits also promoted section timing review and could replace saved versions without explicit rebind | Baseline source review: all sections changed to `user_reviewed`; shot/contract and performer versions were read from current records on submit | Section review has its own visible acknowledgement. Changed shot contracts require explicit rebinding. Historical performer pins remain held rather than being silently upgraded | Actual browser tests preserve provisional sections and old identity versions, and block a changed contract until its rebind checkbox is acknowledged |
| Medium: the single-performer editor could discard existing additional performers | Baseline source review: submit selected only the first performer | Existing editor supports multiple selected pins and preserves missing/historical selections. Multi-singer attribution remains explicitly held where unsupported | Actual API/UI round-trip retains both performers during an unrelated edit |
| Medium: pending song decoding was not an unsaved edit; clearing a selection could leave an old decoder authoritative | Baseline source review: navigation did not track source choice; old audio reference remained after clearing | Pending choice participates in existing navigation guards; cancel clears the authoritative decoder and candidate; decode errors disable binding | Browser cancellation/navigation tests; explicit pending-choice cancellation |
| Medium: saving the shared animatic left the song form holding a stale project version | Browser integration path exposed the captured project-version boundary | Rebase only unrelated version changes when a signature proves song, shot, character and plan inputs are unchanged; relevant changes still require reopening | Browser saves song edits immediately after an animatic save without losing optimistic concurrency protection |
| Medium: malformed generic preview content could cause an exception before it was held | Adversarial payload inspection and new malformed-content test | Type-check stored frame arrays before comparing song bindings | Malformed data produces a held preview instead of an exception |

Six initial adversarial tests failed before fixes. A separate format-change reproduction also failed before its fix. UI defects above were established by baseline code review and validated with actual post-fix browser regressions; they are not falsely described as executed before/after browser benchmarks.

## Reuse and boundaries

There is one project, production library, permissions system, asset store, cost/job system, storyboard and animatic player. Music-specific rules supply a typed timing/source contract to that player. No second editor, database, queue or testing framework was introduced. The test fixtures accept optional initial project settings through their existing construction path; they still use the existing real local APIs and synthetic provider outputs.

Planning retains earlier record versions, selected frames, source files and approvals. Actor changes do not automatically accept new identities. A chosen source means preserve the original recording; it does not claim that its bytes or singing quality were inspected merely because metadata exists. New input durations remain explicitly user-reviewed browser metadata. Unsupported or uncertain singing attribution stays held.

## QA procedure and evidence

1. Reproduce deterministic failures with the new `music-video-redteam.test.mjs` cases.
2. Run existing `qa:fast` against the new adversarial test; it selects the new cases, build checks and both music-video browser flows.
3. Freeze runtime changes and run existing `npm run qa` for full release checks, including all prior format, permissions, spending, writing, department, storyboard, preview, import and SQL proofs.
4. Verify the exact committed sources, run GitHub Actions, and inspect the resulting deployment. Do not bypass certificate validation or change deployment protection.
5. Report local, fixture, CI, deployed-source, account and actual-media evidence separately.

Exact results, file hashes and screenshots are recorded in `docs/evidence/MUSIC_VIDEO_RED_TEAM_CHECKS_2026-10-19.json`. A procedure is not a passing result until that evidence records completion.

## Remaining limits

- Song structure, vocal attribution, transcription and beat/lyric alignment are not automatically analysed by this patch.
- No paid Seedance/Wan/other singing benchmark, realism acceptance, final footage assembly or hosted finished-film export is established.
- The existing upload and production-record size/reference limits still apply.
- Desktop Chromium mobile viewports are not physical mobile-device, keyboard or touch verification.
- Live account tests still depend on working production configuration and authorized sessions; the prior deployment returned application HTTP 503 for projects and the automation browser rejected its certificate. Retest and report actual results without changing security settings.

Rollback follows `ENGINEERING_RELEASE.md`: revert this scoped change or restore the compatible prior deployment; preserve stored songs, plans and prior versions. No reverse database migration or deletion is needed.

# Music-video song and shot planning — implementation checkpoint

Date: 19 October 2026. Base: `a554cd37a284e2bca724e6e3f1cd0aa28e06ce6e`.

## Delivered scope

The Brief and Storyboard stages expose one compact song panel for music-video projects. Existing upload controls supply project-scoped original-song WAV/MP3 assets. Browser decoding supplies a duration which the user reviews; this is explicitly not server measurement, beat detection, lyric alignment or listening-based analysis. Selecting the complete song sets the intended runtime and consequently makes existing source-bound brief/department/storyboard decisions require their normal review where their inputs changed.

`GET/POST /api/projects/:id/music-video` uses existing authentication, owner scoping, optimistic project versions, production edit records, immutable history and storage references. No database migration or dependency was added. The source is pinned by owned asset ID, version and checksum. Device drafts compute the same checksum representation as existing cloud imports, and import completion remaps the nested song pin to the uploaded cloud asset.

The versioned document contains the original-song metadata, selected interval, frame rate, contiguous labelled song sections and shot assignments. Each assignment pins the existing shot and storyboard-contract versions, song interval, role, sync class and performer record versions. Narrative, B-roll, dance, singing and lyric-graphics roles are distinct; readable singing can require sync even in a dance shot. No language or genre is hard-coded into this contract.

A user can save incomplete assignments as a draft. Gaps, overlaps, incomplete coverage, provisional timing, changed source/shot/character versions and unresolved vocal attribution hold downstream review. A single whole-song section explicitly says structure has not been analysed. The editor can review timing without a claim of verse/chorus/beat analysis. More detailed sections can be stored through the contract; automatic song analysis and a richer section editor remain subsequent work.

The production-state graph includes the music-video plan and shot-specific holds. `generationAuthorized` and `lipSyncValidated` remain false. A complete planning document never grants permission to run a model or claims a performance passed inspection. Existing character records, storyboard images, approvals, takes and original audio remain preserved.

## Editor handoff

The shot plan supplies source-song in/out intervals, order, performance classes, exact identities and immutable revisions. These are planning inputs for the existing storyboard workflow and future final assembly. This patch does not claim that a final video editor, automatic song-driven animatic assembly, source-clip selection, audio mixing or finished-film export is implemented. Existing original-audio animatic functionality remains separate and must continue passing its own tests.

## Verification and release

Use the existing `npm run qa:fast -- --changed ...` for affected work and `npm run qa` before release. The new Node scenarios cover malformed timing, source ownership/checksum, version conflicts, immutable revisions, performer changes, held coverage and actual local HTTP APIs. The browser scenario exercises selection, duration decoding, saved timing/roles, unresolved singing, reload, navigation guards and 390px/1440px layouts, with console/network inspection and original-byte comparison. The existing import suite checks nested song-pin remapping.

Local fixture providers generate no billable media. Browser viewport evidence is not physical mobile-device testing. Live Supabase/Vercel account acceptance, real song analysis, singing quality and hosted final export require separate evidence. Record exact test outcomes in `docs/evidence/MUSIC_VIDEO_PRODUCTION_CHECKS_2026-10-19.json`; a test plan alone is not a pass.

Rollback: use the existing release procedure to revert this feature's commit or restore its compatible prior application deployment. Its additive edit-record content can remain stored; do not delete songs, records, media or historical versions. No credential, security, provider activation or infrastructure setting needs changing for this patch.

## Next production slices

1. Authoritative backend audio inspection and routed song analysis with provenance, confidence and vocal attribution.
2. Director treatment/department prompts consuming that song map; targeted storyboard revisions and explicit song-driven animatic timing.
3. Reference-bound singing proofs comparing qualified Seedance, Wan-S2V and other audio-driven routes; footage-based sync where appropriate. Discover current schemas/prices and authorize bounded costs before running.
4. Store actual proof outputs and review evidence for sync, identity, expression and temporal artifacts. Fix diagnosed failures within the approved attempt limit.
5. Production footage, scoped repairs, versioned editorial assembly and verified hosted export against the original song.

## Playback regression found during release checks

The first broad run exposed a timing-sensitive silent-preview failure. A deliberately stale first animation callback reproduced a negative playhead (`Invalid playhead frame`). Clamping the derived frame to zero fixed the reproduction. The existing silent animatic browser scenario now injects that timing condition and verifies actual advancement, seeking and natural completion; original-audio WAV/MP3 regressions remain separate. This is a one-expression playback fix, not a new player or testing framework.

## Red-team follow-up

See `MUSIC_VIDEO_RED_TEAM_REVIEW_2026-10-19.md`. Its follow-up binds the existing animatic to the exact song-plan version, original audio, selected excerpt and integer-frame timing. Independent proportional fitting and detached timing editing are disabled for that bound preview. This supersedes the first-checkpoint limitation that music timing and animatic timing were disconnected. Automatic song analysis, generated singing proof and final-film export remain separate unfinished work.

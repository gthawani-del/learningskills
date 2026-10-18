# Production library acceptance — 18 October 2026

Baseline: main `08494049f8070f72b4020522cd283d87a61b2b3e`. This update advances development Step 3; it does not complete filmmaking or activate generation.

## Implemented

- Typed character, voice, location, wardrobe, prop, audio, take and edit records, immutable creative snapshots, explicit versioned references/dependencies and shot bindings.
- Cast & world form creates and revises records on device or through the owner-scoped project API. Revisions preserve previous content and media. Only shots dependent on the changed record receive a new draft version.
- Stale direct/transitive dependencies hold specification approval. Device-to-cloud imports preserve historical records and bindings, remap every historical media reference, retain original device data and exclude imported approvals/authority.
- Drafts without a library retain their pre-update import identity, so interrupted copies can resume.
- Local approval validation runs inside the save queue against the current owned project. Database currentness guards apply the same dependency rules to server-side approval/dispatch checks.

## Verified before release

- 77 automated scenarios pass; syntax checks and production package build pass.
- API tests exercise create, bind, revise, stale save/approval rejection, selective invalidation, persistence after reopening and cross-project reference rejection.
- Import tests cover history/reference remapping and invalid archives rejected before project creation. Existing interrupted-upload browser recovery passes against the real local demo API. The full guest workspace regression passes against the updated local server, including playback, reference selection, recovery and narrow-screen controls. A separate real-browser library scenario passes create/revise, two-version history preservation, reload, historical binding retention and rebinding to the latest version, with no console/page errors or failed HTTP responses.
- Director Supabase migration `20261017235051` / `production_record_currentness` applied. Twelve synthetic, read-only SQL fixtures all pass: legacy story/shot, missing records/current versions, null versions, superseded versions, transitive staleness, cycles, valid/stale bindings and malformed arrays.
- All three currentness functions deny execution to anon/authenticated and permit service_role. Security advisor returned no findings.

SQL fixtures establish guard behavior, not real-account cloud storage or production media quality. References currently point to immutable version-1 assets. Imports retry whole files up to 2 MB; large-file/chunk-resume transport is unfinished.

## Release and rollback

Commit only this scoped library batch after browser checks. Keep the previous main SHA above as the application rollback target. The database guard extension is backward compatible with old story/shot records. Prefer rolling back application code while retaining stricter guards. Reverting the database wrapper to the prior implementation would remove production-binding currentness protection and requires deliberate review; no data deletion is needed.

## Still required

Live two-account Supabase verification, record approval/history browsing UX, rights evidence, generated-media quality gates, active model routing, commercial cost accounting and hosted film rendering remain incomplete. No physical mobile-device or two-attempt generation quality claim is made.

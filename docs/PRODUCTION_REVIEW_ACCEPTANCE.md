# Production review acceptance — 18 October 2026

## Prior deployed library release

Commit `539b65b56cabbc21467062c22ca9553da029a384` reached successful Vercel deployment. The live site https://learningskills.vercel.app passed both `production-library-smoke.py` and `v2-workspace.py` using Chromium with HTTPS verification enabled. Checks included library creation/revision, preserved historical data, shot rebinding, draft recovery, editing, image selection, playback/pause/seeking, project reopening, draft download and truthful hosted-export unavailability. Both runs reported no JavaScript exceptions, console warnings/errors or failed HTTP responses. Narrow desktop-browser viewports are not physical mobile-device evidence.

## Next review workflow update

- Historical versions are inspectable in native disclosure controls, including their descriptions, references and related record versions.
- Each current library version shows creative approval status and dependency holds. Approve and revoke controls persist review events on device or through the owner-scoped API; cloud project loading fetches approval history together with references.
- Revision leaves historical reviews intact and the current version awaiting review. A stale dependency prevents approval but does not prevent withdrawing an approval from the current version.
- Production review readiness requires creative approval of bound records and their transitive current dependencies. Revocation creates holds on affected shots without deleting media or bumping shot versions.
- Creative review is separate from rights, likeness consent, generated-media quality and permission to spend.

## Verification before deployment

80 automated scenarios pass, including approval revocation with stale dependencies, unchanged media bytes, transitive approval holds and selective readiness. Syntax checks and production package build pass. Browser checks cover history inspection, approval/revocation reload persistence and a held dependency whose approval can still be revoked. The local demo API browser scenario also persists approval/revocation across reload. No real Supabase-account integration claim follows from local demo tests.

## Remaining activation prerequisites

Recursive dependency approvals currently govern specification review readiness. They are not yet enforced atomically by the database reservation/dispatch functions. Generation must remain disabled until those guards, route validation, current pricing, spending authorization, rights and quality acceptance are implemented and tested. The existing database currentness guard checks versions and dependency currentness, not all these approvals.

Vercel connection listing still reports zero active accounts, so deployment environment configuration and real two-account cloud tests remain blocked. Hosted rendering, paid pilots and physical mobile-device testing remain unfinished.

Rollback target for this application update: `539b65b56cabbc21467062c22ca9553da029a384`. This review update requires no schema migration or destructive data changes.

# Production review workflow — 18 October 2026

The versioned library release `539b65b` deployed successfully and passed public-site library and v2 workspace browser checks, with no page/console/HTTP errors. The next scoped update adds visible history and creative approval/revocation controls plus transitive creative-review holds. **80 automated tests, syntax checks and production build pass.** See [Production review acceptance](PRODUCTION_REVIEW_ACCEPTANCE.md) for evidence and remaining atomic dispatch prerequisites.

Real cloud-account verification, generation and hosted export remain unfinished. No physical mobile-device verification is claimed.

---

# Current production-library update — 18 October 2026

The next release adds versioned production-library records, explicit shot bindings and dependency holds. **77 automated tests, syntax checks and the production build pass locally.** SQL migration `20261017235051` has been applied to Director Supabase; twelve guard fixtures pass, function execute grants remain service-only, and security advisor returns no findings. See [Production library acceptance](PRODUCTION_LIBRARY_ACCEPTANCE.md) for scope, evidence and rollback.

Application release/browser evidence will be recorded after deployment. Live cloud-account integration, paid generation, quality pilots and hosted movie export remain incomplete. The initial audit is the only completed major milestone; tracked requirements remain 56 partial, 105 missing/unverified and 6 deferred, with zero fully production-accepted.

---

# Director Studio — Implementation Status

Updated 17 October 2026 UTC. This record replaces the earlier foundation-only status. Specifications describe intended behavior; this file and the [Development Tracker](DEVELOPMENT_TRACKER.md) distinguish code, tests and production acceptance.

## Repository and deployment baseline

Repository: `gthawani-del/learningskills`. Main baseline `f7cc9f03856fc081d9e6bf745eb9e75e938914b6` deployed the v2 UI to https://learningskills.vercel.app. The current development batch adds retry-safe device migration and scene/brief review dependencies. Release status must be checked against its GitHub commit/Vercel result, not inferred from this document.

The active app is `apps/director/`, served through `api/index.mjs`. `apps/studio/` is preserved legacy prototype code; its direct Sora/silent-render routes are not the active product architecture.

## Implemented and verified within stated limits

- V2 light conversational briefing and graphite project/viewer/Director production workspace, responsive drawers, shot strip and audio reference lanes.
- Explicit browser-device drafts in IndexedDB: brief, story, shots, local approvals, direction notes and uploaded media. These are not cloud backups or generated assets.
- Manual story and shot editing, optimistic version checks, current-version specification approvals, keyboard skill selection and scoped reference mentions.
- Supabase server adapter: account login, verified user lookup, owner-filtered project access, versioned save RPC and private media proxy. Production cloud application integration remains unverified.
- Previous deployed batch: separate HttpOnly access/refresh cookies, server refresh rotation, one shared client refresh for concurrent expired requests, current-browser logout and no retries after uncertain network/provider outcomes. Tests use fixture accounts/transports, not real Supabase sessions. Signup and password recovery remain unfinished.
- Job reservation/dispatch/unknown-submission foundations and direct OpenAI/fal adapters, tested with mocks. No paid model call made in this batch; API planning stays disabled and routes stay inactive.
- Local FFmpeg assembly preserves sound and validates duration. Hosted rendering/export remains unavailable.
- Admin allowlist and limited read-only own-project/registry views. The full backoffice is not implemented.
- Actual site icon and explicit SVG/legacy icon routes replace the missing favicon route. Verify the complete live console after deployment.

## Migration and dependency additions

- Import endpoints create a deterministic owner-scoped copy, snapshot artifacts using the existing transaction, transfer each reference idempotently and finalize only after all expected checksums/IDs exist. No database migration required. Existing cloud edits are not overwritten on replay.
- Shared browser/server scene-impact rules advance only linked shot versions when a scene changes. Brief changes require a fresh story approval. Existing media and unrelated shot versions are preserved.
- Authorized production-state endpoint reports specification review holds, reference dependencies and shot adjacency. It does not authorize generation. Character/voice/take/audio/edit dependency coverage remains incomplete. Unaffected shot versions survive scene edits, but the revised global story still needs reapproval before any shot is ready for route review. Whole-file retries are supported; byte/chunk resume is not.

## Database read-only verification in the previous batch

Director Supabase project `ygyjqubrpqwfgbquwqeo`: `ACTIVE_HEALTHY`; 12 public Director tables returned, all RLS enabled; 20 model candidate rows; no projects or jobs returned by inventory. Security advisor returned no findings. These observations establish database state, not successful application login or cloud persistence. That earlier batch made no schema, credential, policy or production configuration changes; the newer guard migration is recorded above.

## Tests and limitations

- `npm test`: 60 scenario tests pass after this batch, including session/adapter/client, import/recovery, storage transport and production-state scenarios and the icon regression check.
- Syntax checks and production packaging pass.
- `apps/director/tests/v2-workspace.py`: actual browser editing, approvals, image preview, uploaded-video play/pause/seek, reload persistence, notes, cloud-unavailable messaging, JSON draft download and 390px viewport drawers/overflow. Run against the current deployment after release; evidence saved under gitignored `test-results/`.
- Physical mobile-device/keyboard testing is outstanding. Browser viewport checks are not device verification.
- No generated-human, voice, singing or finished-film quality claim. No measured two-attempt acceptance rate.
- Supabase account/session tests are local transport and API fixtures. Real two-account, cross-browser, private-storage and expiry/revocation checks remain blocked by production connection configuration.

## Next gates

1. Complete Vercel connection authorization; inspect environment keys/targets without revealing values. Verify `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` are available to the deployed runtime. Neither database-tool access nor a publishable browser key substitutes for this server configuration.
2. Verify real login, refresh, current-device logout, owner isolation, project persistence and private assets with designated test accounts.
3. Verify the implemented retry-safe device-to-cloud migration against real Supabase. It preserves notes, transfers checksummed media, rebinds references and keeps device originals. Local demo browser interruption recovery passes. Local approvals are intentionally not imported as cloud approvals or spending authorizations.
4. Implement production record dependencies, staff permissions, ledger/quotes, reviewed skill/model activation, Director orchestration and media workflows in the tracker order.
5. Add hosted render workers, complete customer/admin acceptance, then produce and review representative paid pilots within an approved budget.

## Rollback

The batch does not change database state. Revert its application files to the previous main baseline and redeploy to remove session changes. Existing device drafts remain in IndexedDB. Clearing browser storage removes local drafts/media, so do not use it as an operational rollback procedure for customer data.

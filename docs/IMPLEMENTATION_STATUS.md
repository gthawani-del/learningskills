# Director Studio — Implementation Status

Updated 17 October 2026 UTC. This record replaces the earlier foundation-only status. Specifications describe intended behavior; this file and the [Development Tracker](DEVELOPMENT_TRACKER.md) distinguish code, tests and production acceptance.

## Repository and deployment baseline

Repository: `gthawani-del/learningskills`. Main baseline `e05c45bdedfc36f95d3d72aa1e9d5533e1dbbb54` deployed the v2 UI to https://learningskills.vercel.app. The current development batch adds the requirements ledger and cloud session recovery. Release status must be checked against its GitHub commit/Vercel result, not inferred from this document.

The active app is `apps/director/`, served through `api/index.mjs`. `apps/studio/` is preserved legacy prototype code; its direct Sora/silent-render routes are not the active product architecture.

## Implemented and verified within stated limits

- V2 light conversational briefing and graphite project/viewer/Director production workspace, responsive drawers, shot strip and audio reference lanes.
- Explicit browser-device drafts in IndexedDB: brief, story, shots, local approvals, direction notes and uploaded media. These are not cloud backups or generated assets.
- Manual story and shot editing, optimistic version checks, current-version specification approvals, keyboard skill selection and scoped reference mentions.
- Supabase server adapter: account login, verified user lookup, owner-filtered project access, versioned save RPC and private media proxy. Production cloud application integration remains unverified.
- Current batch: separate HttpOnly access/refresh cookies, server refresh rotation, one shared client refresh for concurrent expired requests, current-browser logout and no retries after uncertain network/provider outcomes. Tests use fixture accounts/transports, not real Supabase sessions. Signup and password recovery remain unfinished.
- Job reservation/dispatch/unknown-submission foundations and direct OpenAI/fal adapters, tested with mocks. No paid model call made in this batch; API planning stays disabled and routes stay inactive.
- Local FFmpeg assembly preserves sound and validates duration. Hosted rendering/export remains unavailable.
- Admin allowlist and limited read-only own-project/registry views. The full backoffice is not implemented.
- Actual site icon and explicit SVG/legacy icon routes replace the missing favicon route. Verify the complete live console after deployment.

## Database read-only verification in this batch

Director Supabase project `ygyjqubrpqwfgbquwqeo`: `ACTIVE_HEALTHY`; 12 public Director tables returned, all RLS enabled; 20 model candidate rows; no projects or jobs returned by inventory. Security advisor returned no findings. These observations establish database state, not successful application login or cloud persistence. No schema, credential, policy or production configuration changed in this batch.

## Tests and limitations

- `npm test`: 40 scenario tests pass after this batch, including nine cloud-session/adapter/client scenarios and the icon regression check.
- Syntax checks and production packaging pass.
- `apps/director/tests/v2-workspace.py`: actual browser editing, approvals, image preview, uploaded-video play/pause/seek, reload persistence, notes, cloud-unavailable messaging, JSON draft download and 390px viewport drawers/overflow. Run against the current deployment after release; evidence saved under gitignored `test-results/`.
- Physical mobile-device/keyboard testing is outstanding. Browser viewport checks are not device verification.
- No generated-human, voice, singing or finished-film quality claim. No measured two-attempt acceptance rate.
- Supabase account/session tests are local transport and API fixtures. Real two-account, cross-browser, private-storage and expiry/revocation checks remain blocked by production connection configuration.

## Next gates

1. Complete Vercel connection authorization; inspect environment keys/targets without revealing values. Verify `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` are available to the deployed runtime. Neither database-tool access nor a publishable browser key substitutes for this server configuration.
2. Verify real login, refresh, current-device logout, owner isolation, project persistence and private assets with designated test accounts.
3. Complete retry-safe device-to-cloud migration, including media/reference rebinding and note preservation. Current project-copy action does not transfer those items or preserve creative approvals as cloud authorizations.
4. Implement production record dependencies, staff permissions, ledger/quotes, reviewed skill/model activation, Director orchestration and media workflows in the tracker order.
5. Add hosted render workers, complete customer/admin acceptance, then produce and review representative paid pilots within an approved budget.

## Rollback

The batch does not change database state. Revert its application files to the previous main baseline and redeploy to remove session changes. Existing device drafts remain in IndexedDB. Clearing browser storage removes local drafts/media, so do not use it as an operational rollback procedure for customer data.

# Cloud persistence acceptance runbook

Scope: Director Supabase project and the `learningskills` Vercel application. This is the next integration gate; it is not a record of a passing live cloud test.

## Configuration

Inspect production-target environment metadata through the authorized Vercel account. Required: `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, and correct `APP_ORIGIN` for the tested domain. Never output secret values, place them in frontend code, or obtain service keys using SQL. The current API requires the named service-role variable; do not silently substitute another key type.

An environment variable existing does not prove it is available in an already-built deployment. Redeploy the reviewed application after configuration, then check `/api/config`. `capabilities.uploads` means a store was configured; it does not prove credentials work, the bucket exists or permissions are correct.

Keep planning/media disabled. Do not make paid provider calls while verifying persistence.

## Designated account and data setup

Use two designated test accounts with separate verified Supabase identities; do not create accounts or send verification/reset emails to unrelated addresses. Use synthetic script/image/audio/video fixtures. Do not expose passwords, cookies, access or refresh tokens in logs or screenshots. Run production checks only in the intended project, with uniquely named test records and a cleanup inventory.

## Required scenarios

| Scenario | Passing evidence |
|---|---|
| Login and logout | Correct account shown; invalid credentials rejected; current-browser logout revokes refresh; unrelated account session remains usable |
| Expired access | Refresh cookie rotates through server; project reload succeeds; both cookies HttpOnly/Secure in production; response body has no tokens |
| Revoked refresh | Signed-out recovery shown; both cookies cleared; drafts retained |
| Temporary auth outage | No false sign-out success or erased draft; user can retry; uncertain mutations not replayed |
| Project persistence | Create, edit, save and reopen in another authenticated browser; stored values/versions match |
| Concurrent edits | Stale expected revision returns conflict; accepted work is not overwritten |
| Tenant isolation | Other account cannot list/read/edit project, retrieve its media or bind a foreign asset ID |
| Private media | Upload supported fixture; mismatch/oversize rejected; media reopens privately after session renewal; no public object access |
| Device migration | Resumable/idempotent transfer; notes and supported files preserved, IDs rebound, pending files visible; interrupted save does not create duplicate projects |
| Approval scope | Device approval is not a spending authorization; imported/changed artifact versions require appropriate review |
| Browser/device | Desktop and narrow viewport checks; real mobile keyboard/orientation tested separately |

## Current implementation constraints

Uploads use a 2 MB proxied JSON request. This is insufficient for typical source songs/footage; larger private resumable uploads, completion verification, checksum/metadata validation and orphan cleanup remain planned. Private video proxy does not yet implement full range streaming. Project-copy action currently omits media and notes and is not retry-safe migration.

## Documentation verification

Reviewed current Supabase changelog and server-side advanced auth guidance on 17 October 2026. Refresh tokens rotate and both cookies must update. Current-session sign-out uses `scope=local`; no-store API responses prevent cached session sharing. Our server-only session design keeps tokens HttpOnly because frontend code calls our server instead of the Supabase browser SDK.

References: https://supabase.com/changelog.md ; https://supabase.com/docs/guides/auth/server-side/advanced-guide ; https://supabase.com/docs/guides/auth/signout

# Account recovery — music-video foundation batch

Application baseline: main `9378628214ba21b0f5e876b0f19ba9f1ad5baf11`. This increment implements recovery through the existing Supabase Auth adapter and UI. It does not complete real cloud-account acceptance, large uploads, media generation or the music-video release.

## Implemented behavior

Forgot password is available in the existing sign-in dialog. A recovery request produces a generic response without confirming account existence. A random PKCE verifier and state stay in a short-lived HttpOnly cookie. The email callback exchanges its one-time code server-side only when state and age match the initiating browser. No normal app session is created from that callback. Password update uses a separate recovery capability; success clears recovery and app session cookies and asks the user to sign in. Device project/media storage remains intact.

Cookie scope is `/api/auth/recovery`; production cookies are Secure. Callback flow cookies use SameSite=Lax for the email return; the recovery capability is SameSite=Strict. Callback responses have no-referrer/no-store and redirect to a token-free UI URL. Application APIs retain their existing origin/cross-site protections. Input bounds, recovery throttling and safe provider errors are implemented. No new package, schema or model/provider activation is required.

## API and Auth transport

- POST `/api/auth/recovery/start`: `{email}`. Calls normal Auth `/recover` with `redirect_to`, a server-generated challenge and `s256`.
- GET `/api/auth/recovery/callback`: validated code/state and initiating cookie. Exchanges `/token?grant_type=pkce` server-side; no credential is returned to JavaScript.
- GET `/api/auth/recovery/status`: `{ready}` only; no email/account/token disclosure.
- POST `/api/auth/recovery/complete`: `{password}` only; updates `/auth/v1/user` under the recovery token, never an admin password API.
- POST `/api/auth/recovery/cancel`: clears recovery cookies.

Supabase account password policy remains authoritative. This does not promise that changing a password invalidates all pre-existing access tokens/devices. A recovery email opened in a different browser requires a new recovery request from that browser. Wrong/expired state cannot exchange an authorization code. Provider outages do not claim successful email sending or password updates.

## Local verification

The new Node tests cover PKCE generation/exchange, same-browser state, missing/expired/future state, cross-origin rejection, credential boundaries, missing recovery capability, rate limits, password bounds/policy errors, safe upstream failures, cancellation and actual Auth request shapes. The actual local HTTP/browser scenario covers 1440×1000 and 390×844, wrong-browser rejection, password mismatch, completion, cleared cookies, absence of tokens from localStorage, and preserved draft text. Identity/email are simulated by the test fixture; no email, real account mutation or paid call occurred.

Affected checks use the existing QA runner, which includes the new recovery browser scenario plus the existing first-use migration scenario. Full release QA passed 758 automated tests, 20 browser flows, build/syntax and SQL proof. The final malformed-Unicode state-comparison correction was separately retested in the 24 account/session cases after the full run began; exact-commit CI is still required. See [batch evidence](evidence/MUSIC_VIDEO_RECOVERY_BATCH_2026-10-20.json). Physical devices and real email delivery are not established by local evidence.

## Production verification still required

1. Confirm runtime `APP_ORIGIN=https://learningskills.vercel.app` for this target. Preview verification requires its explicitly configured origin; do not infer settings from database-tool access.
2. Confirm Supabase Auth allows the application's `/api/auth/recovery/callback` redirect, including its generated state query. Existing email templates/settings have not been changed.
3. Run request/email/callback/password/sign-in against designated test accounts. Verify the old password fails, the new one works, draft import resumes and private cloud media remains owner-isolated across two accounts and another browser session.
4. Inspect the deployed UI/cookies/network and repeat affected checks after release. Do not use real customer accounts as fixtures.

Current read-only observations: Director Supabase is ACTIVE_HEALTHY. Public `/api/config` reports Supabase mode and uploads enabled, with the existing 2 MiB limit. This is not live login/storage proof. Vercel management still returns 403 for the intended `ggg12` scope; no settings or security controls were changed. No authenticated Vercel CLI or application credentials/designated account sessions are configured in this executor.

Sources reviewed: Supabase changelog and current password/PKCE documentation; the Auth OpenAPI recovery/token/user contracts. The upcoming TLS-cipher deprecation does not require an application recovery change; runtime transport uses current system TLS verification.

## Release and recovery

Review this application-only increment and full QA before production deployment. No database rollback is needed. Reverting the scoped application commit removes recovery entry points while preserving user records/media and the existing login/signup flow. This batch does not rotate keys, disable confirmation, enable paid models or send production email during testing.

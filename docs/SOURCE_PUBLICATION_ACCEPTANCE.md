# Inspected source publication and private playback

20 October 2026. Reuses private source receipts, durable inspection results, the shared asset library and existing Studio attachment sheet. No new dependency or hosting provider.

## Implemented behavior

An authenticated owner can check a completed source's inspection from the attachment sheet. Only an exact accepted inspection can publish it. The trusted coordinator also supports optional automatic publication after persisting a passed result. The database locks the current project, receipt and inspection; verifies owner, exact source snapshot, status, checksum, size, MIME, expiry and current shot binding; then inserts one normal asset and one publication record in the same transaction. A failed write rolls both inserts back. Repeated requests recover the same asset without another upload, model call or copy.

The original object remains in the private source bucket. Raw-byte SHA-256 is explicitly labelled `sha256-bytes`; existing small-file checksum semantics remain unchanged. Measured duration/streams and the inspection version accompany the asset. Media integrity does not approve artistic quality, grant production permission or establish legal rights. Rights remain user-supplied/unverified.

The existing private content route authorizes the project owner and asset before signing the exact object. Large sources redirect to bounded signed storage playback instead of loading up to 128 MiB into a web function. Storage handles streaming/range requests. The app response is private/no-store; the URL is not stored in asset records. The signing lifetime is at least five minutes and at most one hour, allowing measured playback plus a margin. Signed links are bearer access: logout does not revoke an already issued link, and storage CDN cache behavior is a separate live qualification concern. No claim of immediate revocation is made.

Pending sources stay unavailable. The attachment sheet gains an inspection check and a published-library state; published sources cannot be removed through upload cancellation. Other library/deletion workflows are separate. The approved desktop/mobile layout is preserved.

## Verification

- 13 focused checks: identity-preserving/idempotent publication, incomplete/changed/cancelled/expired/foreign rejection, auth and feature gate, no-buffer playback signing, trusted dispatch ordering and cloud RPC wiring.
- Real local PGlite execution checks source-to-asset atomicity, exact inspected identity, removed-shot rejection, rollback after a deliberately failed publication write, unchanged rights status and role restrictions/RLS.
- Chromium at 1440px/390px exercises interrupted upload/reload/resume with the real TUS client and app/API, using simulated storage. An additional 390px flow simulates the trusted inspection result, clicks the actual inspection check, verifies the shared library asset and published state, and checks for page errors/overflow. This is not live storage or physical-device acceptance.
- Full local QA: **823 automated tests, 22 browser groups, build and SQL proofs passed**. [Evidence](evidence/SOURCE_PUBLICATION_2026-10-20.json).

## Live gates and rollout

The source schemas were absent in the connected Director Supabase project during read-only preflight. Its security advisor returned no findings. Installing the three reviewed additive schema sources was attempted through the migration connector and **rejected by automatic approval review**: persistent production schema/security changes need specific approval. No schema was applied. A separate bounded Vercel Sandbox creation was also rejected because external compute can incur cost. No sandbox was created. Approval requests identify both concrete actions; do not retry through another API or weaken protection.

After approval, apply the reviewed schema in order: media ingestion, inspection jobs, source publication. Verify grants/RLS, native RPC behavior and the private bucket; then qualify actual isolated FFmpeg execution, scoped private transfer, lifecycle cleanup and processing exposure. Keep large uploads/dispatch disabled until the path and account isolation work. Do not start paid creative generation merely because these integrity checks pass.

## Rollback and remaining development

Disable new dispatch/uploads first, retain receipts/assets/publication history and confirm existing workers have stopped. Revert the application to compatible main `c205c40` if necessary; leave additive schema/data intact for investigation. No automatic destructive reverse migration.

Durable scheduling/cleanup, hosted full-song rendering, automatic musical/lyric analysis, music-specific department integration, real footage/lip-sync quality, commercial reconciliation and finished production pilots remain separate incomplete release requirements. This increment does not complete the music-video product.

# Durable source-inspection jobs

Implementation increment, 20 October 2026. Reuses upload receipts, the portable inspector, Supabase service RPCs and the existing QA/Actions infrastructure. No dependencies, hosting providers or customer screens added.

## Delivered

- Additive schema source `database/director-source-inspection-jobs.sql`, installed after the existing ingestion schema. A receipt transition to inspection-pending and its unique job are committed in the same transaction. Installation backfills existing pending receipts.
- Service-only job records with RLS and explicit revocation from anonymous/authenticated customer roles. Functions use security invoker with an empty search path. No browser endpoint can claim or finalize a job.
- Receipt-first/job-second row locking, one live claim per upload, a rotating private UUID fencing token and 30–900 second leases (600 by default). Expired claims may be recovered with a fresh token, with at most three claims. Prior tokens cannot be reused. No automatic provider retry or live scheduler was added.
- Exact receipt snapshot binding: owner, project, object key, manifest, checksum and expiry remain authoritative. Cancellation, expiry or receipt changes reject late results. Terminal jobs cannot be dispatched again through this claim API.
- Trusted coordinator dispatch contract: disabled by default; receives an explicitly supplied qualified executor. It keeps database credentials and fencing tokens out of the decoder task, preserves an independent source snapshot and makes one execution attempt. An executor exception attempts to quarantine the job as held; persistence failure does not imply confirmed cleanup. No success is returned on an uncertain execution.
- Result normalization in Node and independent SQL validation. Only supported measured streams, codecs, dimensions, channels, duration, decode success and exact source bytes can pass. Arbitrary metadata, private URLs and raw diagnostics are discarded. Failure records have a fixed safe code.
- A passed inspection is stored once and **does not publish an asset**. Original source bytes, approvals and existing small-file upload behavior are unchanged.

## Verification and practical limits

Seventeen focused checks cover normalization, cloud RPC wiring, disabled dispatch, private fencing tokens, immutable source binding, uncertain-execution quarantine and actual PostgreSQL-compatible PGlite execution of the schema/functions. SQL checks exercise enqueue idempotency, claim exclusion, stale/reused tokens, changed/expired/cancelled receipts, malformed reports, bounded retry exhaustion and customer-role denial. These use local database execution and fixture identities, not a live Supabase account or simultaneous production database connections.

Existing inspector tests separately run real FFmpeg/FFprobe on WAV, MP3 and MP4. This increment does not claim cloud runtime, real private transfer, database advisor certification, provider billing or production performance evidence. No physical device was tested. Full regression passed **810 automated tests, 22 browser groups, build and SQL proofs**. [Recorded evidence](evidence/SOURCE_INSPECTION_JOBS_2026-10-20.json). All 34 customer UI files match parent revision `7a43483`.

## Activation and next work

Keep `DIRECTOR_RESUMABLE_UPLOADS` disabled. No production migration or executor activation occurred. The new SQL is schema source for the existing reviewed migration process; it has not been installed remotely.

The next implementation is trusted atomic ready-asset publication with private playback and cleanup, followed by a qualified durable dispatcher. The dispatcher must authorize/reserve processing exposure through existing spending controls, select eligible jobs, apply runtime concurrency limits, sign only the exact source download, and verify isolated-runtime cleanup before allowing recovery. Database credentials stay in the trusted coordinator; the media runtime receives only short-lived object-scoped access. Fencing protects results, not the cost of two accidentally running VMs. Automatic scheduling must not be enabled until lifecycle and spending controls are qualified.

Live gates remain: reviewed schema application, actual Vercel runtime/FFmpeg/private-transfer and cost proof, designated two-account acceptance and physical-device qualification. A planning ceiling is not execution permission.

## Rollback

Before release, keep dispatch disabled and take the existing database backup. If activation fails, stop new dispatch and confirm existing runtimes have stopped; leave held/pending receipts and inspection records intact. Retain the additive schema for investigation instead of dropping customer records. Revert application code to the prior PR revision if necessary. Source uploads remain unpublished, and existing small-file references continue through their original route.

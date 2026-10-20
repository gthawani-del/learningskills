# Contextual attachments and resumable source ingestion

Implementation increment, 20 October 2026. Based on recovery branch commit `5e8d022f8a886b8c482df7f79f7071eec8e7ce57` (PR #9). No production activation, security-setting change, migration execution or paid provider call is included.

## Implemented scope

The updated Studio shell is preserved. The previous generic upload form is replaced with contextual Upload file / Project library tabs, selected-file preview, replace/remove, editable media-compatible role suggestions and project/selected-shot scope. Existing session-owned project assets can be searched and selected into the current message draft without copying or uploading them again. The mobile surface is a bottom sheet with bounded viewport scrolling. This is a customer attachment component, not a replacement editor or studio layout.

Normal references retain the existing 2 MiB validated whole-file path and device/cloud semantics. Cloud source ingestion adds the official `tus-js-client` pinned to 4.3.1, served locally, with 6 MiB chunks, bounded retry, progress/pause and recovery after reload. The server allocates an immutable owner/project/object path and issues only a scoped signed upload token; service/account credentials are not exposed. The client matches the complete file's raw SHA-256 before resuming and refuses different file metadata. Signed upload tokens are not persisted; the TUS SDK persists the transport URL/receipt fingerprint. Request targets and resumed URLs are constrained to the configured private storage origin.

Receipts are separate from `director_assets`: uploading → inspection_pending or cancelled. Duplicate creation requests return the original receipt; conflicting manifests fail. Owner checks, serialized per-project pending limits (10 receipts, 512 MiB total), a 128 MiB file bound and 24-hour receipt lifetime prevent unbounded active transfers. No overwrite is requested. Completion probes storage metadata without buffering the large object through Vercel; current FileObjectV2 size/content_type fields take precedence over legacy system metadata. This proves transport only, never content safety, actual duration, decode validity or authenticity of the client checksum.

## Production activation remains held

`DIRECTOR_RESUMABLE_UPLOADS=0` is the default. Do not enable it for customers until these gates pass:

1. Convert/review the additive schema source `database/director-media-ingestion.sql` through the existing migration process and install it. It creates service-only RLS-protected receipts, invoker RPCs and a separate private source bucket; existing buckets and policies are not widened.
2. Qualify real Supabase signed TUS creation, interruption/reload/resume, expired token refresh and private-storage permissions with designated QA accounts. Local fixtures do not establish any of these live guarantees.
3. Add trusted bounded inspection: private download, byte checksum verification, MIME signature/decode validation, duration/stream metadata and applicable unsafe-file handling. Reject/quarantine failures. Atomically publish a standard asset only after inspection passes. No ready-publishing method exists in this increment.
4. Implement durable inspection scheduling/leases/recovery, cancellation/expiry cleanup and orphan-object retention/deletion, and verify failure recovery. Cancelling currently changes the receipt only; an already issued token can finish writing an isolated object until its provider expiry. It does not gain production approval or become an asset. No deletion or token-revocation guarantee is claimed.
5. Finish large device-draft/welcome ingestion and migration compatibility. Current welcome and device-draft upload limits remain 2 MiB; large cloud transfers start from an existing signed-in project. Large private playback/export belongs to the later inspected-asset integration.
6. Verify maximum-size memory/latency on supported browsers: the pilot client uses a bounded whole-file Web Crypto hash before the chunked network transfer. Streaming client hashing and physical-mobile memory acceptance are not implemented.

The Vercel Sandbox processing proof is the next dependency for trusted inspection and later hosted export. The US$100 planning ceiling is not permission for paid execution.

## Verification

Existing `npm run qa` is reused, with two additional Chromium flows and existing node:test coverage. `attachment-browser` exercises actual app/API selection, preview, role suggestions, invalid replacement preservation, cancellation/focus, library search and draft binding. Its illustrative photo comes from the user-provided frontend prototype. `media-ingestion-browser` uses the actual official TUS SDK and a simulated storage endpoint: a 7 MiB WAV is interrupted after its first 6 MiB, the page reloads, HEAD finds the offset, one remaining chunk completes, and the received bytes match the original. The object stays outside Assets and starts no provider call. Both flows run at 1440×1000 and 390×844; physical devices, real Supabase and provider quality remain unverified.

Automated checks additionally cover malformed manifests, concurrent idempotent creates, conflicting replays, persisted receipt restart, account/project isolation, capacity, cancellation/late completion, expiry, signed-token scope, metadata mismatches, held configuration, missing schema, poisoned resume URLs and SQL role permissions. Test reports and actual screenshots are under `test-results/attachments/`, `test-results/media-ingestion/` and `test-results/qa/`. The committed evidence file records the completed run, not a claim about live production.

## Release and rollback

Keep the resumable feature flag closed while reviewing/deploying the attachment UI. Preserve PR #9's recovery changes; this increment depends on that branch. After authorized deployment, check the actual release URL and verify the default small-file/device/library flow before enabling any later capability. A code rollback returns to the prior application deployment; leave new private receipt records and objects intact for investigation/cleanup. Do not drop storage or user project records as rollback.

Final local full QA: **778 automated tests, 22 browser flows, build and SQL passed**. Evidence: [STUDIO_ATTACHMENTS_2026-10-20.json](evidence/STUDIO_ATTACHMENTS_2026-10-20.json). Earlier failing runs identified the Characters-tab context handoff and the workspace test's old form order; the corrected final run retains all existing media/playback/recovery assertions.

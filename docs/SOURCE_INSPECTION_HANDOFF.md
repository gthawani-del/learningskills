# Deterministic source inspection and Sandbox proof handoff

Implementation increment, 20 October 2026. Follows the contextual attachment/TUS work in PR #10. No customer UI change, model call, new hosting provider or new dependency is introduced.

## What is implemented

`apps/director/workers/source-inspection.mjs` is a portable Node.js worker using the existing FFmpeg/FFprobe toolchain. It accepts an already saved source manifest and either an isolated local file or a scoped private-source download configuration. It produces an inspection report; it does not change project records, media storage, approvals or production assets.

The worker:

1. Validates the supported MIME and bounded size/checksum manifest.
2. For private download, accepts only HTTPS links to the exact owner/project/upload object in `director-source-media` on the specified Supabase project. Rejects extra query destinations, arbitrary hosts, credentials, wrong buckets/identities and redirects. Streams into a new isolated file, checks declared and actual byte length and SHA-256, removes incomplete downloads, and never overwrites a previous file.
3. Requires a regular file under its isolated work directory, rejects symlinks/outside paths, stream-hashes actual bytes and checks basic media signature. Rejects a WAV whose declared RIFF length exceeds the available bytes.
4. Runs FFprobe with a container/protocol allowlist and a restricted metadata projection. Uses measured duration, streams, codecs, sample rates, channel counts, dimensions and frame rate. Does not expose free-form embedded tags to a model or treat them as instructions.
5. Distinguishes MP3 attached cover art from video performance. Rejects unsupported subtitle/data/attachment streams and configurations outside the pilot policy.
6. Fully decodes allowed audio/video with FFmpeg into a null sink using explicit error detection, a single decode thread, no shell and bounded command output/time. Does not normalize, time-stretch, cut, encode or replace the original master.
7. Checks the source file did not change during inspection and returns versioned measured metadata with `decodeVerified:true`, raw-byte SHA-256 and `assetPublished:false`. CLI failures emit only a safe held-state code/message; private URLs, tokens and raw subprocess diagnostics are excluded.

Current pilot policy: 128 MiB, up to 30 minutes, at most eight container streams, one actual video stream for MP4, up to 4096 pixels per dimension / 4096×2160 pixels per frame, 120 fps, eight audio channels and 8–192 kHz sample rate. Each binary is limited to 120 seconds and 1 MiB output; private download has a 45-second bound. WAV/MP3 audio requires one audio stream; MP4 can be silent. These are explicit qualification limits, not universal media support promises. Codec allowlists are in the worker. RF64/unfinished streaming WAV headers, other file types, arbitrary ancillary streams and unsupported configurations require a separately reviewed route.

## Sandbox proof harness

`apps/director/sandbox-inspection-proof.mjs` uses the documented Sandbox interface (`writeFiles`, `runCommand`, `stop`). It is disabled by default and receives a dedicated session from an authorized caller. It never creates/resumes a VM or installs packages. It checks Node/FFmpeg/FFprobe versions, writes the same portable worker plus a deterministic one-second WAV, verifies successful inspection and checksum-mismatch rejection, and optionally inspects a separately authorized private source. It checks command exit codes, never replays an uncertain command and stops the dedicated session in `finally`. Unconfirmed cleanup holds the proof and requires inspecting/stopping the original session before retrying.

The harness deliberately returns `cloudProvenanceVerified:false` and `costVerified:false`. Successful use of the interface by a local adapter is not Vercel account, private-transfer or billing evidence. The current tests run the actual worker and actual binaries through a local process adapter, explicitly labelled local.

A future actual invocation must use the approved Vercel team/project, a bounded one-off nonpersistent VM, reviewed image with FFmpeg installed, one vCPU where supported, no public ports and restrictive egress. Synthetic file-mode proof can deny all egress; a private transfer must allow only the configured Supabase source hostname. Never put Supabase service-role, OpenAI or fal keys into the VM. A scoped short-lived download token is sufficient for the source. Session lifetime, image/package qualification and cost/reservation controls belong to the caller before it creates the VM.

## Verified limits and blockers

- Local automated evidence includes a real three-minute WAV, MP3 and H.264 MP4; actual hashing, measured duration and full decode; incomplete/mismatched downloads; corrupt containers; unsafe paths; stream/duration policy; embedded artwork; SDK-interface handoff, mismatch rejection and cleanup failure. This does not assess music content, beat/lyric alignment, audiovisual realism or generated quality.
- On 20 October 2026, read-only Vercel project lookup for `prj_FPEsU1tgKwrXw2yaxG45aV0fciH2` under `team_m3EJjTDjwR7e7VD6QZDgDzaE` returned **403 forbidden for scope ggg12**. No authenticated Vercel CLI is installed and this execution environment has no Vercel runtime credential binding. No other team/account was substituted, and no security settings changed.
- The actual Sandbox/FFmpeg/private-transfer/cost proof remains **blocked and unexecuted**. The US$100 planning ceiling is not spending authorization. Reconnecting the intended Vercel scope and explicitly bounded proof execution are needed for that external gate.
- Resumable customer uploads remain disabled. No new schema was applied. A source that passes this standalone worker still remains pending in the application: durable task scheduling, leases, worker identity, exact receipt/result binding, cancellation/expiry handling, atomic ready-asset publication, private playback and orphan retention/cleanup are not wired in this increment.
- This is media compatibility/integrity inspection, not malware-scanner, legal-rights or universal security certification. Untrusted production media must execute in the isolated runtime, not in a shared Vercel web function. Physical-device and maximum-size performance qualification remain outstanding.

## Next implementation

Connect an inspection task to the existing source receipt through a versioned, hash-bound contract and durable claim/lease. Accept only a trusted worker result for that exact source and live claim, with atomic publish-once behavior and cancellation/currentness guards. Preserve original bytes, existing small-file imports and all approved production decisions. Qualify the actual Sandbox runtime before enabling it. Reuse existing spending/accounting for measured processing exposure rather than creating a competing billing system.

## Completed QA evidence

15 focused worker/proof tests and affected QA/build passed. Full `npm run qa` passed **793 automated tests, 22 browser flows, production build and SQL**. [Machine-readable record](evidence/SOURCE_INSPECTION_2026-10-20.json). The 34 customer UI files are unchanged from the parent release branch. GitHub CI for the subsequent inspection commit is a separate check; no deployment or live Sandbox proof is implied.

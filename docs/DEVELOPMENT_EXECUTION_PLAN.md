# Director Studio — Development Execution Plan

Revision 1 · 17 October 2026 UTC. This is an execution map for existing specifications, not another product blueprint. Development is requested; paid generations and production deployment still need their existing explicit authorizations.

## Current baseline and rollback

Local code lives in `apps/studio/`: dependency-free Node development server, browser IndexedDB project, direct OpenAI storyboard/Sora calls and FFmpeg silent assembly. It is an old prototype, not the planned studio. GitHub README and recursive main tree reads succeeded. Main is `290c33dba38b3508bae77c9aa9e6a5637fd588d6` and contains only README/REA research and inventory scripts, not the app or planning docs; `apps/studio/package.json` returned 404. There is no usable local Git checkout. Reconcile repository tree/branch before treating local code as an authoritative patch or opening a PR. Do not overwrite remote files from this directory blindly.

Baseline test execution reached four tests, all blocked by sandbox `listen EPERM` on loopback; no existing assertion failure is established by that run. Preserve existing prototype files. The first new implementation is isolated in `apps/studio/intelligence/production-contract.mjs`, with a dedicated test file. Rollback: remove those additions; no database state or existing routes change.

## Phase 0 — Knowledge consolidation and evidence

**Delivered locally:** original sources preserved; Realism rev2 and Bible rev2 integrate conditional craft rules; research register distinguishes confirmed schemas from unverified summaries; five live schema snapshots saved. Original attribution retained. Remaining research has explicit holds rather than fabricated completion.

**Exit:** valid local links and JSON; no unsupported claims promoted; capability conflicts recorded. The 24-video research is incomplete, not an exit gate for unrelated known craft.

## Phase 1 — Contracts and repository reconciliation

**First local code:** validate a structured production contract, choose only requested reviewed craft modules, enforce framing-dependent detail, and produce a non-billable planning envelope. This accepts explicit structured intent; it does not claim to understand arbitrary prose. A later reasoning service extracts that intent, then passes through validation.

**Repository task:** inspect remote tree and intended branch, establish an isolated checkout, compare the local prototype and current files, then decide the smallest integration patch. No guessed Next.js rewrite, dependency upgrade or deployment configuration.

**Exit:** invalid or contradictory contracts rejected, user style preserved, mandatory hand action not hidden, narrative gaze not replaced by avatar default, pending routes not auto-selected. Unit tests run without a server/provider.

## Phase 2 — Durable project and operational foundation

| Domain | Proposed records | Server responsibility | Acceptance |
| --- | --- | --- | --- |
| Identity/access | workspace, membership, project | Authenticated tenant authorization, role checks | Cross-tenant requests denied |
| Creative state | brief version, script version, scene, shot, continuity state | Immutable approvals and dependency invalidation | Editing words invalidates timing, not unrelated accepted assets |
| Assets | asset, asset version, reference binding, provenance/consent | Private upload/finalize, MIME/metadata validation, access-controlled retrieval | Expired reference restored; other tenants cannot read |
| Intelligence | reviewed knowledge version, skill version, endpoint version, production profile | Bind skill to eligible workflow; explicit evidence flags | Pending endpoints excluded from automatic execution |
| Operations | proposal, estimate, authorization, reservation, job, attempt lineage, review, audit event | Atomic spend/attempt reservation; uncertain outcome reconciliation | Concurrent requests cannot spend the last attempt twice |

Use Supabase for the agreed foundation, verifying current documentation and project state before schema work. Table names above are proposed domain concepts, not deployed tables. Keep provider secrets server-side; apply tenant-specific RLS and storage policies; do not use user-editable metadata as an authorization source. A migration, policy test and rollback review must precede any production activation.

**Admin alongside customer work:** project/job queue, route availability, unresolved charges, review holds, audit history and emergency route disable. These controls must exist before live paid generation, not after a polished frontend.

## Phase 3 — Frontend v2 and non-billable planning flow

Build reusable shell and composer in the verified existing stack. Desktop project/canvas/Director; mobile focused canvas and bottom sheet; typing, `/` skills, `@` authorized asset versions, `+` scoped uploads. Preserve drafts and explicit shot context. Use safe text rendering, keyboard navigation and responsive controls.

Connect premise → structured intent → treatment → script → cast/world plan → timed storyboard. A planning call may itself cost money: define allowance or authorization separately from video spend. No model call is hidden behind supposedly free UI actions.

**Exit:** applicable C01–C17, C22–C24, C27–C28 and C32 from frontend v2; account/private-storage checks; device tests when browser execution is available. Screenshot resemblance alone is insufficient. Voice controls stay truthfully unavailable until enabled.

## Phase 4 — Provider adapters and first short-film workflow

| Workflow step | Implementation responsibility | Gate |
| --- | --- | --- |
| Story/script | Approved direct OpenAI model; structured response plus validator | Account/model availability and scope authorization |
| Cast/world references | Verified premium still/reference-edit route | Quote, identity checks and approved master |
| Storyboard/animatic | Versioned frames, actual dialogue durations and edit plan | Approved timing and quantity |
| Voice | Verified fal speech route, selected voice, pronunciation and measured take | Listening, language and exact text |
| Shot generation | Eligible fal production profile, queued submission and reconciliation | Required approvals, price, reserved budget, attempt count |
| Review/repair | Full playback, evidence-based defects, one scoped correction | No hidden third round or accepted-asset overwrite |
| Sound/edit | Preserve speech/song, ambience, SFX, intentional cut timing | A/V continuity and mix review |
| Export | Selected hosted media worker, authorized assets, deterministic assembly | Decode/probe and actual final playback |

Do not wire the old Sora route as the fal router. Do not promote the old render path as final finishing: it strips sound and can pad frozen frames. Preserve its prototype behavior until a tested replacement exists, then gate it behind the new workflow. Browser-local deduplication is not durable job idempotency.

**Exit:** complete coherent short film, not disconnected generated clips; target output count/duration/format met; accepted actors/voice stable; sound preserved; admin can trace costs and holds.

## Phase 5 — Representative proof and calibrated release

Pilot brief: 45–60 seconds, one main character, restrained dialogue performance, meaningful hand/prop contact, location continuity, purposeful B-roll, ambience/score and final edit. The pilot length is a test scope, not a product limit. Select language and voice before quoting. Have a human reviewer inspect actual images, listen and watch the connected film. Add singing as a separate proof.

Before running, prepare exact inputs, approved reference rights, configuration-specific quotes, total budget ceiling and finishing reserve. No paid proof is run under this document alone. Report first-round and within-two-round acceptance with all failed/held work in the denominator, candidate counts, actual spend and manual intervention.

**Release gate:** production deployment is separately approved after reviewable implementation and test evidence. Do not request release approval for an unfinished branch. Verify the deployed domain, secrets configuration and queue/worker health after any authorized release.

## Decisions and blockers

| Item | Current decision / required evidence |
| --- | --- |
| Repository baseline | Remote recursive tree confirmed at 290c33d; app/docs absent on main; local work is not pushed |
| Framework | Reuse actual repository stack; not selected by this document |
| Storage/worker | Selection unresolved; no production export claim |
| OpenAI | User reports access; credentials/models untested |
| fal | Discovery works; deployed credential execution and quality untested |
| Premium casting | Schema available; configuration pricing and human benchmark pending |
| Lip-sync candidate | Public guide/schema conflict; hold promotion |
| Voice | Schema verified; actual voice/language performance untested |
| OpenRouter | Optional only, not silently introduced |
| Supabase | Prior account access not proof of implemented application schema |
| Browser verification | Existing server tests blocked by loopback sandbox permission; no UI test claim |

## Definition of progress

Track planned, locally implemented, unit-verified, integration-verified and deployed separately. This pass delivers phase 0, a phase-1 local module and tests, and this executable phase map. Later phases remain pending. Never report a complete studio or completed video validation from this work.

## Verification record for this pass

- `node tests/production-contract.test.mjs`: seven tests passed.
- `node --test tests/production-contract.test.mjs`: file-level runner passed.
- Local links in changed planning documents and all evidence JSON parsed successfully.
- Existing four server/movie tests: blocked by sandbox `listen EPERM` on 127.0.0.1. No passing integration/browser/export claim is made.
- New compiler remains isolated; no existing API route, UI, generation path or database was changed. It is not a security boundary until integrated with server-controlled authorization.
- No branch, commit, PR, migration, paid generation or deployment was created. Full frontend/backend implementation and generated-film validation remain pending.

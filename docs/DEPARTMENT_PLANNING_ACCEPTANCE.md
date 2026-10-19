# Department planning acceptance — 19 October 2026

Step 6, Point 4 now has an implemented planning workflow. From a current approved creative brief and screenplay, the studio prepares 17 source-linked department documents. Users review a compact overview, open one department, correct a focused field and approve its current version. Deterministic preparation and manual changes are free. A separately authorized model call may propose a coherent alternative; it never applies or approves itself.

**427 automated tests, syntax checks and the production build pass.** Five new actual-local browser scenario groups, seven existing browser regression scripts and 18 isolated PostgreSQL proof groups pass. Native Director migration `20261019112531_director_department_planning` is installed; service-only function permissions and RLS are verified, with no security-advisor findings. All native models remain inactive and generation remains paused. This is implementation and bounded verification, not live model-quality or customer-account acceptance.

## Scope and user flow

The 17 responsibilities are production, direction, script breakdown, casting, character look/wardrobe, locations/set design, camera, lighting, voice, sound, music, continuity, storyboard, animatic, VFX, editorial and rights. They are coordinated documents, not a requirement for 17 paid calls or 17 independent runtime agents.

1. Approve the current brief and screenplay, including the screenplay review acknowledgement. Imported script text remains exact source material; a source upload does not manufacture structured scenes, permission evidence or approval.
2. In Cast & World, choose **Prepare missing plans**. The rule compiler carries known brief facts, all structured scenes and roles, original-audio constraints, production requirements and craft guidance into proposed documents. It does not invent actual assets or measured song/voice timings.
3. Open a collapsed department row, review its applicability, requirements, proposed choices, handoffs and checks. Edit one field at a time. Unknown creative preferences receive proposed direction rather than a wall of blank questionnaires.
4. Acknowledge that approval covers a plan only. Even a department marked not applicable needs a reviewed rationale. The current 17 plans must be approved before continuing through the department handoff; existing projects without a department archive retain their prior behavior.
5. Optionally request **Department planning** through AI planning & proposals. The selected reviewed model, operation, maximum reservation and allowance are displayed before submission. Giving an allowance does not submit a call. Inspect the saved proposal and explicitly apply it; new content remains unapproved.

Approving casting, look or voice direction does not select an actual performer, identity image or voice sample. Storyboard and animatic plans are not generated frame assets or playable assemblies. Rights plans are not legal clearance. Neither plan approval nor a model response grants permission to spend on media.

## Contracts and preservation

- `departmentPlanning` stores immutable source snapshots and independent version histories for the 17 IDs. Each typed document includes applicability and rationale, summary, requirements, proposed/user-selected choices, handoffs and checks. Scene and character links must exist in its bound screenplay. Bounds reject oversized input instead of truncating source material.
- `GET /api/projects/:id/department-plans` returns review context. `POST` on the same path supports free prepare, focused update and explicitly acknowledged single-department source refresh. `POST /api/projects/:id/department-plans/apply-proposal` applies a saved owned completed call after exact context validation. Existing approvals use the `department:<id>` logical key and explicit `ackPlanningOnly` for approval.
- Preparation fills missing plans only. Editing advances one department version and preserves the other documents and decisions. A source refresh requires explicit acknowledgement; removed scene/character links require focused repair rather than silent retargeting. Explicit user-selected choices survive valid refreshes and model proposals. Currently approved fresh department documents are protected from proposal overwrite.
- All saves compare both project version and the latest project approval identity inside the durable local transaction or locked Supabase RPC. An approval or revocation after the initial read rejects the write without losing the newer review. Partial disk/database failures do not publish half an archive.
- Brief/script edits make source-bound plans stale; revoked source approvals hold new planning and media work. Media quote, authorization and dispatch reject a department plan as a generation target. New media spending for projects with an archive waits for all 17 current department approvals. Known submitted work may still be recovered and accounted after a new hold.
- Imports retain creative plan history but do not copy approval or spending authority. Cloud reads expose bounded approval summaries, excluding private approval archive evidence.

## Model and craft boundary

The new task is `department_planning`, operation `plan_departments`, request contract `director-planning-v4`. A model must have a reviewed operation-specific profile, schema hash, evidence and price contract before eligibility. Existing five operations keep their exact v3 request contract and saved-call recovery. The admin registry displays both schema hashes; neither hash is evidence of model quality.

The reviewed pack `director-department-knowledge-v1` supplies department-specific craft direction, including scene intent, motivated performance/camera/light, identity and wardrobe continuity, audio-first voice timing, actual board/animatic review, contextual realism and rights boundaries. Intentional illustration and stylization remain valid. See [knowledge sources and limits](DEPARTMENT_PLANNING_KNOWLEDGE.md).

The paid context retains the complete approved brief, structured screenplay, exact source text, current department documents and guidance. Two duplicated canonical signature strings are replaced with SHA-256 bindings, validated against full internal source signatures. A comprehensive regression measured 155,287 request bytes versus 253,020 with the duplicated strings; the reviewed 200,000-byte request ceiling did not increase. A larger accepted manual archive can still exceed the model context limit and then fails closed. Scoped batching is future work. Invalid or partial output never becomes a free template success. Unknown provider outcomes retain their financial hold and observed-usage evidence.

## Verification

| Evidence | What passed | Practical limit |
| --- | --- | --- |
| `npm test`, `npm run check`, `npm run build` | 427 tests, syntax, production package/import | Mocked provider fixtures do not establish real provider transport or creative quality. |
| Department browser | Five scenario groups: all 17 prefilled plans, focused edit/independent history, reload/choice preservation, separately authorized simulated proposal, compact 390px layout | Actual local Chromium/API/file store with server-side simulated OpenAI, no browser request interception; no paid calls. Zero unexpected console/page/HTTP errors. |
| UI regressions | Creative brief, v2 workspace, mobile footer, compact brief proposal, registry, writing recovery and planning UI | Writing recovery deliberately injects one 503; planning UI uses intercepted fixtures and a deliberate network failure. Those injected failures are labelled, not real infrastructure faults. |
| Visual inspection | Desktop overview and 390px collapsed overview plus geometry | Mobile rows measured 74px with no horizontal overflow. Screenshots/viewport emulation are not physical-device or virtual-keyboard tests. |
| Isolated SQL | 18 PostgreSQL/WASM groups covering exact sources/artifacts, independent approvals, atomic save rollback, review-change races, media guards, v3/v4 opt-in, reservations/claim/recovery and privileges | Real core archives with synthetic projects and model requests; single connection, not simultaneous cross-session locking evidence. Rollback leaves only inactive seed records. |
| Native Director database | Migration installed; 10 invoker functions have empty search paths, service-only execution; six affected tables retain RLS; security advisor clean | Read-only metadata/security checks after DDL, not real application account/isolation tests. Zero native department archives and planning reservations; zero active OpenAI/fal models, pause retained. |

Machine-readable evidence: [checks](evidence/DEPARTMENT_PLANNING_CHECKS_2026-10-19.json), [native checks](evidence/DEPARTMENT_PLANNING_NATIVE_CHECKS_2026-10-19.json), [SQL proof](../database/checks/department-planning-pglite-results.json). Screenshots and full browser results remain in local gitignored `test-results/`; committed evidence records their hashes and scope.

## Remaining acceptance and next work

Point 5 is next: targeted revisions with explicit interdepartment version dependencies and selective downstream review holds. This increment preserves unrelated documents and approvals, but does not yet automatically determine that a changed camera requirement invalidates a previously approved storyboard. Whole-source changes conservatively hold all source-bound plans. Do not claim the complete targeted downstream workflow is finished.

Actual character/voice selection, generated references and footage, storyboard frames, playable timed animatics, sound production and hosted finished-film export remain later work. Model publication/activation, real provider outputs, billing reconciliation, two-attempt quality pilots and factual/legal review remain unvalidated. Deployed/Vercel and real-account browser tests remain deferred as requested; physical devices and keyboards remain untested. No provider key was inspected or changed and no paid OpenAI/fal call was made.

## Release and rollback

The code is published through a leased main update; commit identity is reported separately to avoid embedding a self-referential SHA. Deployment success is not inferred from the push. The additive database migration installs no model and does not unpause generation. If application rollback is required, restore the previous application commit and retain the additive database history; do not delete plans, approvals, reservations or evidence. SQL baseline anchors fail the migration atomically if required previous function definitions differ.

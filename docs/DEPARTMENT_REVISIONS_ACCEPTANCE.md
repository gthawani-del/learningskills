# Targeted department revisions — 19 October 2026

Step 6 Point 5 now preserves department decisions through targeted revisions and automatically flags dependent plans for review. A plan records the exact upstream versions it used. Changing one department advances only that department's snapshot; dependent content and approval history stay intact, while current eligibility is held until reviewed.

**469 automated tests, syntax checks and the production build pass.** Four new actual-local browser groups, the five-group department regression and seven existing browser scripts pass. Seventeen isolated PostgreSQL proof groups pass. Native Director migration `20261019115348_director_department_revisions` is installed; seven affected functions are service-only invoker functions with empty search paths, six affected tables retain RLS, and security advisor reports no findings. Native models remain inactive and generation remains paused. No paid OpenAI/fal call or provider-key change occurred.

## User-visible behavior

A camera-plan edit flags lighting, continuity, storyboard, animatic, VFX and editorial through the reviewed dependency graph. Voice, music, rights and other unrelated current approvals remain valid. The changed camera plan needs its own approval. Flagged plans display the upstream department and the recorded/current version; the system does not silently rewrite their content or create new paid work.

Users have three explicit options:

1. **Keep plan and review changes.** After acknowledging the changed upstream context, retain the entire document and recorded choices in a new unapproved version with current bindings. Stale upstream dependency chains must be reviewed first. Upstream approvals need not be entered in a particular order; dependency freshness and the existing all-17 approval gate are separate checks.
2. **Edit a focused field.** Save a direct correction for that department. Other department documents and histories remain unchanged. The new version needs review; any affected descendants receive holds.
3. **Request a targeted revision.** Select one or more departments and save the requested change. Saving is free and starts no model call. Review the separately displayed model, price ceiling and revision allowance, explicitly run it, inspect the saved subset proposal and explicitly apply it. Only selected department documents may change. Recorded `user_selected` choices remain protected, including inside selected departments.

The general department planning operation cannot rewrite a source-current previously approved document merely because its upstream dependencies became stale. Only an explicit targeted revision request grants that selected creative scope. A flagged document remains available for inspection, comparison and repair.

## Data and runtime contracts

- The immutable policy `director-department-dependencies-v1` uses the reviewed 17-unit DAG from the craft catalog. New snapshots contain `dependencyContext: {policyVersion, bindings: [{departmentId, version}]}` in the exact prescribed dependency order. Clients cannot submit arbitrary dependency graphs or pin metadata through the document editor. Multi-department writes bind downstream selections to the final versions of selected upstream plans.
- `departmentPlanningContext` reports `sourceStale`, `dependencyStale`, combined `stale`, and named `dependencyChanges`. Production-state nodes expose the same dependency edges and holds. No-op edits do not advance versions. Unselected snapshots are not automatically rewritten or versioned by targeted application.
- Historical snapshots without bindings preserve their original structure and approval history. All such units, including the empty-dependency rights root, require an explicit first dependency review. The system does not invent historical evidence. An explicit targeted model proposal may repair selected legacy plans, but new approval/media eligibility still requires fresh dependency chains.
- Free commands use `POST /api/projects/:id/department-plans`: `review_dependencies` requires `departmentId` and `acknowledgeDependencies: true`; `request_revision` requires catalog-ordered unique `departmentIds` and a nonempty instruction up to 4,000 characters. Existing prepare/update/source-refresh commands remain available.
- Optional `revisionRequests` history is bounded to 50 entries. Each request records its version, selected IDs, instruction, source version, the exact current versions of all 17 departments and a timestamp. A source or department-version change makes the request stale; editing the request does not change plans or their approvals. A missing prepared unit prevents a new revision request/allowance.
- Both saved department operations apply through `POST /api/projects/:id/department-plans/apply-proposal` with `expectedVersion` and an owned saved `callId`. The server selects the command from the recorded operation, verifies completed strict output and exact full current context, and binds the latest request version. Client-supplied instructions or another call's output cannot widen that scope.
- Saves retain the existing atomic project-version and latest-approval-identity checks. A concurrent review, source edit or revision request holds stale application without overwriting the newer state. Disk/database failures retain prior durable documents. Imports retain creative history without importing approval or spending authority.

## Models, costs and recovery

The new operation is `revise_departments`, routing task `department_revision`, with request version `director-planning-v5`. Registry eligibility requires its own fresh operation/task, execution, quality, schema and price evidence. The admin registry exposes its schema hash. Previous operation approvals or allowances do not enable a revision call or a model switch.

Existing five v3 operations and v4 `plan_departments` keep their saved request contracts. New department profile hashes bind the dependency policy and current full context contract. Known older v4 responses remain recoverable using their captured context and instruction. A later source change, pause or model retirement holds new submissions but does not prevent polling or accounting for a known submitted request. An unknown submission retains its financial hold; it cannot trigger a replacement call automatically.

Revision requests preserve the full brief, screenplay, raw uploaded source, current department documents, choices and guidance. Duplicate department content is omitted only from the redundant approved-artifact list; the complete documents and effective approval states remain in department context. The measured all-17-approved, two-target request is 136,263 bytes, below the unchanged 200,000-byte limit. Oversized context fails closed without truncating creative facts or silently using a template.

## Verification evidence

| Check | Result and scope |
| --- | --- |
| Automated suite | 469/469 cases pass, including 18 new revision API scenarios, 15 new shared revision scenarios, provider validation and existing writing/planning regressions. |
| Syntax and build | `npm run check` and `npm run build` pass; production package imports without provider calls. |
| New browser flows | Actual local HTTP APIs, durable LocalStore and Chromium with a server-side simulated provider; no request interception. Checks selective flags, exact content preservation, dependency acknowledgement, free scope saving, separate allowance, queued-call reload, subset review/application, simulated charge accounting and no automatic retries. |
| Mobile viewport | 390px Chromium viewport, one focused editor, no horizontal overflow. Save/Cancel scroll fully above the fixed footer, pass center-point hit checks and perform a real Save interaction. This is viewport verification, not a physical-device or keyboard claim. |
| Regressions | Department overview; creative brief; v2 editing, image selection and uploaded-video playback; mobile footer; compact brief proposal; registry; writing recovery; planning UI. Writing deliberately injects one 503; planning UI uses intercepted fixtures with an injected network failure. No unexpected page/console/HTTP errors observed. |
| Database proof | 17 isolated PostgreSQL/WASM groups: exact DAG/policy/pins, legacy review, source/version types, selective descendants, acknowledgement, saved requests, operation-specific v5 guards, stale claim/replay, unknown holds/recovery, v3/v4 compatibility, real reservation/claim SQL paths and service-only permissions. Fixtures are synthetic and rolled back. |
| Native metadata | Migration installed; function privileges/search paths, RLS and clean security advisor verified. Zero active OpenAI/fal models, department archives and planning reservations; pause retained. This does not prove application login, account isolation or simultaneous-session locking. |

The SQL traversal validates each reachable department/version once. A same-archive local WASM sample improved from repeated-recursion hundreds of milliseconds to bounded-traversal tens of milliseconds. These samples are development observations, not production latency claims.

Machine-readable records: [checks](evidence/DEPARTMENT_REVISIONS_CHECKS_2026-10-19.json), [native checks](evidence/DEPARTMENT_REVISIONS_NATIVE_CHECKS_2026-10-19.json), [isolated SQL proof](../database/checks/department-revisions-pglite-results.json). Local gitignored `test-results/` retains screenshots and browser reports; committed evidence records their scope and hashes.

## Remaining limits and next work

Impact is deterministic at department granularity using the reviewed fixed graph. A summary-only edit conservatively flags that department's descendants; this release does not claim semantic field-level dependency reasoning. Whole approved-brief or screenplay changes still conservatively require source review across the department plans. Existing screenplay revision tools preserve unselected scenes, but finer scene-to-department source impact remains future work.

The existing all-17 current-approval media spending gate remains conservative across the project. Plan approval does not establish actual image/voice selection, generated storyboard frames, timed animatics, rights clearance or finished-film quality. Deployed/account browser tests remain deferred; physical devices, virtual keyboards, live OpenAI/fal quality and billing, simultaneous native database races and the two-attempt target remain unvalidated.

Next is Point 6, the storyboard handoff contract, followed by actual reviewed frame and animatic generation. Code publication is recorded by its main commit separately; a push does not establish deployment success. Roll back the application commit if required while retaining additive database evidence and generation holds. Do not delete project histories, reviews or financial records to roll back this feature.

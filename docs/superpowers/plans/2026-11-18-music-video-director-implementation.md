# Music Video Director Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Preserve the agreed one-primary-developer execution method; do not dispatch an agent per task.

**Goal:** Connect the two Director participation styles and a saved, song-aware conversation to existing planning and scoped-revision workflows without bypassing production or spending controls.

**Architecture:** Extend the existing Director project document and authenticated API. Reuse the existing OpenAI planning controller, registry, reservations, production records and source-bound proposals. The model returns a bounded conversational proposal with an allowlisted next action; existing application handlers retain execution authority.

**Tech Stack:** Existing Node.js ES modules, browser JavaScript/HTML/CSS, OpenAI Responses integration, Supabase project/financial records, Node tests and existing Chromium/PGlite checks. No new dependencies or infrastructure.

**Spec:** [Approved consolidated design](../specs/2026-11-18-music-video-director-design.md).

## Global Constraints

- Complete Music Video Production remains first; preserve the wider multi-format architecture.
- Preserve the frozen desktop/mobile UI, all seventeen departments and all eighteen release deliverables.
- No paid model calls, production migrations, hosted processing or model activation without explicit authorization.
- Reuse existing planning, approvals, assets, jobs and money controls; do not introduce parallel systems.
- A conversation or participation-style change does not grant creative approval or spending authority.
- Preserve the original master, canonical lyrics, references, decisions, existing media and version history.
- No provider/model fallback or attempt-counter reset without the existing required authority.
- Distinguish implementation, fixture verification, live availability and creative acceptance.

## Review Focus

1. Reload, duplicate submission and two open tabs must preserve conversation and reject conflicting writes. Task 1 owns these cases.
2. A quoted lyric or attachment telling the Director to ignore spending rules must remain untrusted content. Tasks 2/3 own these cases.
3. “Handle the rest” or switching participation style must not authorize paid work or approve unseen media. Tasks 1/4 own these cases.
4. A source/reference/approval change during a pending turn must prevent stale action application while retaining the old response. Tasks 3/4 own these cases.
5. A failed or uncertain provider submission must not trigger duplicate payment, invented advice or a misleading completion state. Tasks 3/5 own these cases.

## Scope and implementation decisions

This is the coding plan for **Increment 1: Director interaction**, not a claim to finish the entire music-video release. Its independently useful first slice saves participation style and conversation and connects existing planning actions. The subsequent slices add qualified conversational planning and targeted handoff. Report each slice honestly; a saved chat interface does not complete the agent.

Existing baseline: `bf51cda57f8f9adc9d937f5b956ecf256e9b956a`. Existing design is a local documentation change; do not overwrite it or concurrent work.

### File map

| File | Responsibility |
|---|---|
| New `apps/director/public/director-session-core.js` | Pure validation and immutable project-session commands. |
| New `apps/director/director-context.mjs` | Build source-bound current-project context and validate the conversational proposal. |
| New `apps/director/director-actions.mjs` | Map allowed proposed next steps to existing workflows; no arbitrary API dispatch. |
| Existing `api.mjs`, `domain.mjs`, `imports.mjs`, `store.mjs` | Authenticated session access, guarded persistence, safe imports and source/version checks. Modify store only if needed for existing save parity. |
| Existing planning provider/profile/controller/router/policy/store modules and task catalog | Add one explicitly reviewed conversational planning operation through existing financial machinery. |
| Existing `public/app.js`, `public/index.html`, `public/styles.css` | Fit participation control and conversation into the approved controls column; retain preview/mobile shell. |
| New focused test files and existing QA runners | Exercise the feature with existing infrastructure and simulated providers. |
| New `database/director-conversation-planning.sql` | Prepared additive compatibility migration for the new planning operation; never apply automatically. |

Paths marked new are proposed files, not existing capabilities. Do not split or refactor unrelated modules.

## Task 1: Save the participation style and conversation

**Files:** Create `public/director-session-core.js`, `tests/director-session.test.mjs`, `tests/director-session-api.test.mjs`; modify `api.mjs`, `domain.mjs` and existing import normalization as needed. All paths are under `apps/director/`.

**Interfaces:**
- `directorSession(project) -> SessionView`: defaults old projects to an empty session; modes are `plan_for_me` and `create_with_me`.
- `applyDirectorSessionCommand(project, command) -> Project`: immutable versioned update, using the existing optimistic project save.
- Commands contain `requestId`, `expectedVersion`, and either `set_mode` with `mode`, or `append_user_message` with `text`.
- `GET /api/projects/:id/director-session` returns the current session. `POST` accepts only the supported commands. Actor/project identity comes from the authenticated request.
- Store optional `directorSession` in the existing project document, not an edit/take record or separate database. Messages have server-generated identity/time and explicit user/assistant roles. Only the server may append assistant responses.

- [ ] Add failing tests for default old-project behavior, mode persistence/reload, message preservation, duplicate request replay, same-ID/different-body rejection, stale versions and foreign-account access.
- [ ] Add failing tests proving a mode switch changes no song, approvals, money, references or selected media; generic project PATCH and imports cannot forge assistant messages or authority.
- [ ] Implement the core and authenticated routes. Use existing owner checks and `store.save(project, expectedVersion)`; reject conflict without dropping the user's draft.
- [ ] Bound a user message to 4,000 characters and session JSON to 64 KiB. Reject over-limit writes without deleting prior messages. This is a builder-selected safety bound, not a product retention policy; automatic summarization is outside this increment.
- [ ] Run `node --test apps/director/tests/director-session.test.mjs apps/director/tests/director-session-api.test.mjs`; expect all assertions to pass.
- [ ] Commit this coherent saved-session slice with the approved design/plan documentation if appropriate. Do not present it as real conversational AI.

## Task 2: Define the song-aware conversational contract

**Files:** Create `director-context.mjs`, `tests/director-context.test.mjs`; reuse `planning-profile.mjs`, `public/song-intelligence-core.js`, `public/department-plan-core.js`, `public/production-records-core.js` and existing production-state readers.

**Interfaces:**
- `buildDirectorContext({project, approvals, assets, session}) -> DirectorContext` includes exact project/song/reference versions, latest decisions, current stage, applicable departments, readiness and recent conversation.
- `validateDirectorProposal(value, context) -> DirectorProposal` accepts contract `director_conversation_v1` with `message`, `sourceDigest`, `nextAction` and `limitations`.
- Compute `sourceDigest` from creative source versions/hashes and the approval ledger, excluding conversation append timestamps, financial bookkeeping and other unrelated metadata. Message/request identities bind the specific turn separately; saving the assistant response must not invalidate its own creative-source binding.
- `nextAction.kind` is one of `none`, `review_song`, `interpret_brief`, `write_script`, `prepare_script_revision`, `plan_departments`, `prepare_department_revision`, `plan_storyboard`, `review_references`, `review_animatic`.
- Actions contain existing scene/shot/department IDs where applicable. This increment proposes or opens work; it does not create arbitrary paid-media actions or financial authority.

- [ ] Add failing tests for instrumental/multiple-singer context, uncertain analysis, preserved canonical lyrics, exact approved-reference bindings and approved-decision changes without a project-version change.
- [ ] Add failing tests for unknown actions/IDs, forged approval/spend fields, embedded media bytes, prompt-injection text and unsupported claims of audio listening or pixel inspection.
- [ ] Implement bounded context from existing readers. Include no secrets or raw media bytes. If the complete required source context exceeds the reviewed planning limits, hold rather than silently truncate approved constraints.
- [ ] Implement strict proposal validation; a model may state creative opinions but cannot invent performed checks, costs, jobs or approvals. Keep measured source evidence separate from suggestions.
- [ ] Run `node --test apps/director/tests/director-context.test.mjs`; expect passing contract and adverse-input cases.
- [ ] Commit the contract slice.

## Task 3: Connect the contract to existing paid planning controls

**Files:** Modify `planning-provider.mjs`, `planning-profile.mjs`, `planning.mjs`, `planning-router.mjs`, `planning-policy.mjs`, `planning-consent.mjs`, `planning-store.mjs`, `routing-task-catalog.mjs`, `api.mjs`; create focused `tests/director-planning.test.mjs` and prepared `database/director-conversation-planning.sql`.

**Interfaces:**
- New operation: `director_turn`; new request identity: `director-planning-v7` for this operation only. Preserve earlier request versions and their replay behavior.
- Map `director_turn` to task catalog ID `director_conversation`; admission remains an explicit profile capability, not an alias for an already-reviewed writing or interpretation operation.
- Extend existing `buildPlanningRequest(...)`, result validation, profile hashing and response normalization with the Task 2 schema/context.
- Use existing controller `summary`, `consent`, `start`, `poll` and `resume`. Persist the completed conversational result in the existing planning-call record; it is not itself a tool-execution approval.
- Reviewed registry profiles must explicitly admit the operation/schema, format, cost bounds and execution configuration. Do not hardcode a model or repurpose an old qualified schema silently.

- [ ] Add failing fixtures for authorized `director_turn`, missing review/key/consent, paused generation, old contracts, unknown-charge holds, source changes during execution and duplicate request/resume.
- [ ] Extend the existing adapter/controller path. Accept normalized structured responses only; retain response ID, usage, charges and proposal provenance through existing records.
- [ ] Prepare the additive SQL operation/contract checks following the repository's existing planning migrations. Keep identical allowlists in JS/SQL. Include targeted parity tests in the existing PGlite infrastructure; do not modify production.
- [ ] Test that failed/unknown results preserve the user's message and never produce a canned successful assistant reply. No automatic paid fallback.
- [ ] Run the focused director-planning tests plus existing `planning-provider`, `planning-consent`, `planning-api` and `planning-registry-routing` tests once at this integration boundary. Run the added SQL case through the existing PGlite mechanism.
- [ ] Commit verified adapter/parity work. Report activation, migration installation, actual-model access and creative quality as separate external gates.

## Task 4: Turn advice into safe existing-workflow handoffs

**Files:** Create `director-actions.mjs`, `tests/director-actions.test.mjs`; modify `api.mjs`; reuse existing screenplay, department-revision and storyboard controllers.

**Interfaces:**
- `prepareDirectorAction({project, approvals, proposal}) -> ActionPreview`: validates current sources and returns the exact existing-workflow destination, selected IDs and instruction.
- `applyDirectorAction({project, approvals, proposal, actorId, store}) -> ActionResult`: prepares only an allowlisted review/revision action through existing handlers. Paid planning remains an explicit authorized existing operation.
- `POST /api/projects/:id/director-session/actions` accepts `requestId`, `expectedVersion`, `planningCallId` and the chosen action identity. Reload and validate the saved proposal server-side; do not trust browser-supplied instructions as the provider result.
- Expose `actionId = hash({planningCallId, sourceDigest, nextAction})` in `ActionPreview`; the POST body field is `actionId`. Reject mismatches and recheck the current creative-source digest before preparing a handoff.

- [ ] Add failing tests for “change the second chorus,” preserving unselected scenes, approved identities, song timing and selected media; ambiguous chorus mapping requests clarification without mutation.
- [ ] Add failing tests for stale source/approval digests, arbitrary URLs/action names, repeated application and “handle the rest” without spending authority.
- [ ] Implement exact adapters to existing revision request/approval workflows. A user action can save a scoped revision request, but cannot overwrite the approved treatment or launch a paid revision merely by accepting conversational advice.
- [ ] Run `node --test apps/director/tests/director-actions.test.mjs` plus affected existing music-treatment/department-revision cases; expect unchanged neighboring content and enforced holds.
- [ ] Commit the handoff slice.

## Task 5: Fit the two experiences into the frozen UI

**Files:** Modify `public/app.js`, existing markup/styles only where necessary; extend existing `tests/music-treatment-browser.py` and its fixture, `scripts/test-director.mjs`, `scripts/qa-director.mjs`, `tests/qa-runner.test.mjs`. Do not create another browser framework or install tools.

**Interfaces:**
- Participation labels: **Plan it for me** and **Create it with me**.
- Display persisted conversation and a pending user draft in the existing creation controls area. Keep the largest preview panel and existing mobile Create / Results tabs.
- Render proposal cards/actions from validated server responses. Expose current planning estimate/authorization before paid conversation; do not imply free or activated AI when no route is available.
- Distinct states: saved, needs authorization, planning, awaiting review, blocked and failed. “Plan it for me” shows a consolidated summary; “Create it with me” foregrounds discussion. Neither hides the other mode's saved work.

- [ ] Extend the existing fixture/browser flow for mode switch, simulated successful turn, targeted revision handoff, reload and a recoverable error retaining typed text.
- [ ] Include keyboard/focus, a long response, 390px viewport, scrolling and footer-overlap checks. Screenshots are viewport evidence, not physical-phone verification.
- [ ] Implement UI wiring and escape all displayed content. Retain upload controls, selected preview, assets and existing destinations. No marketing redesign or new sidebar.
- [ ] Register the new Node cases and affected browser selection in existing runners. Add one QA-selection assertion; do not repeat the entire suite after each small UI edit.
- [ ] Run `npm run qa:fast -- --changed apps/director/public/director-session-core.js apps/director/director-context.mjs apps/director/director-actions.mjs apps/director/planning-provider.mjs apps/director/api.mjs apps/director/public/app.js`. Expect the selected feature checks/build to pass; inspect captured desktop/mobile-viewport states against the frozen UI.
- [ ] Commit the integrated user flow with concise recorded evidence and tracker update.

## Task 6: Integration boundary and publication

- [ ] Verify the final diff is limited to the approved feature and preserves concurrent changes. Update `docs/DEVELOPMENT_TRACKER.md` with shipped behavior, exact evidence and remaining gates, not percentages.
- [ ] Run existing full `npm run qa` once at this functional boundary. Diagnose failures; repeat only the checks affected by corrections. No paid provider calls or deployed-account claims from fixtures.
- [ ] Verify old film planning, music treatment, departments, reference selection, animatics and spending are preserved by the existing relevant release checks.
- [ ] Follow the existing authorized main publication workflow without force-push or overwriting remote work. Report the exact accepted commit hash. Vercel handles deployment; do not orchestrate it or retry unrelated access failures.
- [ ] Mark Increment 1 complete only when the integrated behavior works at the claimed verification level. Mark paid/live conversation unavailable until its exact profile, native schema and provider execution are authorized and qualified.

## What follows this increment

Continue the approved design: production-route qualification → representative singing/motion → accepted full-song footage/B-roll and scoped repair → final editorial/hosted MP4 → private release pilots. Existing source/cloud dependencies remain early prerequisites where applicable. Preserve all eighteen deliverables; do not substitute a chat demo or short proof for the complete release.

## External gates and estimate discipline

Independent implementation and fixture tests need no paid execution. Real operation may require the prepared migration, existing production source/runtime qualification, an explicitly reviewed `director_turn` profile and authorized model calls. Report each dependency precisely and continue unaffected work.

This plan introduces no paid qualification budget and no completion-date promise. Once implementation starts, report actual coherent slices delivered and observed blockers. Avoid invented hours or completion percentages.

## Self-review

The plan preserves the approved two-mode experience, shared engine, exact source bindings, strict financial authority and frozen UI. Its review-focus cases are assigned to explicit tasks. Tool names, schema identity and modes are consistent across tasks. Later footage/render/pilot scope is retained as subsequent work rather than declared complete here. Native execution with one primary developer remains the chosen method.

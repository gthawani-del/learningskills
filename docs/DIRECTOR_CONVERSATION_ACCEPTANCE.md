# Music Video Director participation and conversation — 19 November 2026

Status: implemented and locally exercised with synthetic provider output. Production activation and creative quality are not accepted. Baseline: `bf51cda57f8f9adc9d937f5b956ecf256e9b956a`. This increment follows the approved [design](superpowers/specs/2026-11-18-music-video-director-design.md) and [implementation plan](superpowers/plans/2026-11-18-music-video-director-implementation.md). Music Video remains the first release; the complete eighteen-deliverable scope and seventeen departments are unchanged.

## What works in local application tests

- The existing Music Video composer saves either Plan it for me or Create it with me and bounded conversation text in the versioned project. Changing participation does not erase production or transcript history. Device drafts reuse the existing draft store; account projects reuse owned API storage. Imported transcripts retain text as untrusted imported history, without approvals or action authority.
- `director_turn` is a separate, strict v7 planning contract. It receives saved song evidence and its uncertainty, original/corrected lyrics, treatment, scenes, references, approval history and all seventeen department guides. No text-only model is represented as listening to the song or inspecting media.
- The existing router, registry evidence, planning quote/consent, reservation, background result recovery and reconciliation paths handle the turn. Its profile must explicitly declare `director_conversation_v1` and the correct schema/operation quality evidence. Existing operation contracts stay available. The staff registry manifest exposes the new contract hash.
- A completed settled response can be saved as a source-bound proposal. Supported next steps navigate existing tools or prepare exact scene/department revision requests using existing handlers. They cannot approve creative work, spend money on media or invent arbitrary tool calls. Changed creative sources/approval history, foreign calls and forged/stale actions are rejected. Receipt, revision request and project update are saved atomically with approval-ledger and normalized reference-asset fences. Native asset changes serialize on the same parent lock. Local Director consent also tracks the creative-source digest.
- The frozen desktop columns and mobile Create/Results shell are retained. The existing composer is reused; no second prompt box. Mode choice, escaped history, evidence limitations and reviewable next actions appear inside its current control panel. The existing planning dialog still owns cost authorization. A failed message save retains the unsent draft. Uncertain writes retain the exact pending message/mode/action request across reload, so a lost HTTP response cannot duplicate the committed decision. Completed responses whose sources changed remain readable as history with actions held.

## Implementation references

| Concern | Existing integration / increment |
| --- | --- |
| Project history and import | `public/director-session-core.js`, `imports.mjs`, guarded `director-session` routes in `api.mjs` |
| Source and proposal contracts | `director-context.mjs`, `planning-provider.mjs`, `planning-profile.mjs` |
| Routing, consent and accounting | Existing `planning-router.mjs`, `planning.mjs`, `planning-consent.mjs`, `planning-policy.mjs`, routing task catalog |
| Recorded proposals / scoped handoff | `director-actions.mjs`, existing screenplay/department commands, `store.mjs` guarded save |
| UI | `public/director-ui.js`, existing `public/app.js`, `server.mjs` static allowlist |
| Native cloud parity | Prepared `database/director-conversation-planning.sql`; not applied to production |
| Targeted proof | `tests/director-*.test.mjs`, existing QA runner and `tests/music-director-browser.py` |

## Verification and limitations

Targeted tests cover ownership, immutable history, idempotence/conflicts, injection/schema rejection, source currentness, registry holds, uncertain-provider reconciliation, actual instrumental/multilingual evidence records, preserved media and exact revision scopes. Isolated PGlite installs the prepared migration, checks native snapshot behavior and service-only privileges, and exercises guarded save/version conflict. This is not a full hosted financial integration test.

Chromium uses the actual application and owned APIs with synthetic identity/song evidence/model output. It verifies mode and transcript reload, consent before provider submission, action handoff, preserved original-song document and shots, draft recovery, keyboard control, desktop/mobile viewport and absence of unexpected browser/HTTP errors. Screenshots/results are generated under `test-results/music-director/`. This does not establish physical-device compatibility, live account isolation, AI creative quality or real billing accuracy.

No paid models, production migration, billable hosted processing or environment/security changes were performed. GPT-6.2 Sol is the preferred conversational candidate from the approved design, not an activated or hardcoded production model. Live availability requires the prepared migration to be reviewed/applied and an exact provider/model profile to receive real execution, quality and pricing qualification in the existing registry. Existing production controls remain authoritative; missing readiness holds the operation.

## Remaining release work

Qualify the conversational model with authorized real songs and review human usefulness, action scope, languages, cost and recovery. Continue the existing roadmap for qualified footage, singing/lip-sync, selection/editing, finishing and hosted full-song MP4. Conversation is an orchestration increment, not completion of Music Video Production or an autonomous arbitrary-tool agent.

## Final review and release-check record

One independent final reviewer inspected the complete increment and corrective delta. Three important recovery/currentness findings and one minor local/native consent discrepancy were corrected; the reviewer confirms no remaining important findings at the offline implementation scope. A temporary unintended change to two legacy cloud RPC calls was removed before publication; their existing cloud tests passed afterward.

The first full QA attempt passed all 941 then-current Node cases, syntax, build and the Director browser scenario, then stopped on the unchanged attachment scenario's hidden `#cast-upload` control. That same failure was reproduced on baseline main. The existing department-revision browser scenario also expects a collapsed panel to be visible and fails at line 61 on both trees. These tests were not changed to conceal failures; full browser release QA remains incomplete. Independently run affected music-treatment and music-storyboard/full-song-animatic flows passed. The Director browser was repeated after fixes and proves actual commit/response-loss/reload recovery for both a message and scoped action with simulated model output. The final corrected tree passes all 943 Node cases, syntax and production build; its prepared SQL proof is included. Final details are in the accompanying [evidence](evidence/DIRECTOR_CONVERSATION_2026-11-19.json).

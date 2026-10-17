# Director Studio Frontend v2 - Codex Handoff

## Scope
Customer-facing film studio only. Not the backoffice. No live application code or production database has been changed by this package.

## First read
1. `DIRECTOR_STUDIO_FRONTEND_UI_UX_V2_CODEX_SPEC.md` (complete scope, screen and interaction contracts)
2. `DIRECTOR_STUDIO_FRONTEND_UI_UX_V2_CODEX_HANDOFF.pdf` (formatted review document and five UI plates)
3. `DIRECTOR_STUDIO_FRONTEND_UX_V2_PROTOTYPE.html` (self-contained **illustrative** interaction prototype)
4. `screenshots/` (approved-for-review visual references, not production screens)

## Recommended execution
- Inspect the repository, existing customer routes/components and permissions before changing code.
- Apply the smallest safe patches; reuse existing components and project/job/asset records.
- Implement the universal multimodal composer, then slash and reference selection, followed by private upload integration and cost/approval gates.
- Connect voice only after verifying browser/device support, transcription, privacy, and service cost.
- Keep orchestration details collapsed by default; View Activity shows understandable statuses only.
- No externally branded orchestration components or visible references are allowed in product surfaces.
- Do not change the administrator backoffice or unrelated flows.
- Do not submit paid provider jobs without explicit user authorization and verified budget reservation.

## Prototype behavior
- Demonstrates production and brief UI plus mobile composer, upload menu and slash menu.
- The source contains illustrative film media embedded locally for portability.
- Skill selection, reference chips, file selection, activity panel and disabled authorization modal are demonstrations.
- Does NOT implement private storage, transcription, AI model calls, billing, real video playback or actual role persistence.

## View modes
Open the prototype with query parameters:
- `?screen=production`
- `?screen=brief`
- `?screen=mobile`
- `?screen=mobile-skills`
- `?screen=mobile-attach`

All file links in this ZIP are relative. Open the HTML prototype locally in a browser; no CDN required.

## Acceptance
Begin with the 32 C01-C32 tests in the specification. Mark integration-only tests as unverified until exercised against a real test environment. Do not report a generated screen as a shipped feature.

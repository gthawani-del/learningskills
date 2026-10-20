# Frozen Director UI — 20 October 2026

Authority: the seven user-attached Director screenshots, reproduced locally under `docs/evidence/frozen-ui/approved/`. Later explicit user decisions supersede older shell/v2 layouts. No replacement design was proposed.

## Implemented presentation

- Home: Image / Video / Audio / Studio, visible upload, prompt, settings, Review estimate, four shortcuts, original reference-art excerpts and retained access to every production format.
- Upload: creation controls beside a large original-reference preview; reference remove/replace and prompt preservation.
- Sign-in/account/recovery: shared logo, contextual modal, show/hide password and retained inputs; existing authentication handlers.
- Desktop workspace: navigation/project context, creation controls, largest preview/review column. Existing brief, script, department, character, storyboard, edit and delivery controls remain accessible.
- Preview: actual stored-media playback, saved take records, reference distinction, use/download/revise controls and shot strip. No invented takes.
- Revision: selected-shot heading, current/reference comparison, preservation intent, cancel and existing cost review. Other shots retain their records.
- Generation: stored job status with reference/generation/review stages. Unsupported cancellation stays disabled; no fake progress percentage.
- Mobile: project selector, Create/Results tabs, responsive media/takes/actions and revision controls in normal flow; no fixed footer overlay.
- Projects, Assets Images/Videos/Characters/Audio, Brand & characters, Usage, Help, Account and four backoffice sections share the same visual system.

## UI checks only

Recorded local Chromium walkthrough: 1586×992 desktop, 390×844 mobile viewport, 360×640 narrow home. 64 screenshots; no page/console/HTTP errors or document horizontal overflow in those states. Exercised navigation, contextual uploads/removal, modal preservation, password visibility, recovery navigation, preview playback, selected-shot controls, cost/attachment dialogs and sidebar Escape close. The walkthrough reuses the installed Playwright/Chromium infrastructure.

Interactive/layout checks: PASS for the exercised controls and bounds. Visual comparison: seven attached anchors were inspected against rendered screenshots; shared layout, palette, typography and component hierarchy are applied. This is not a pixel-identical static reconstruction: real record counts and unavailable production actions stay truthful.

[Local side-by-side gallery](/workspace/learningskills/docs/evidence/frozen-ui/index.html) · [Machine-readable UI results](/workspace/learningskills/docs/evidence/frozen-ui/results.json).

Fixture media, take records, progress and staff responses are explicitly UI-only. No paid provider calls, production data writes, unit/backend/SQL suite, physical-device certification or full generation/export acceptance. Preview aspect ratio is a viewing preference; production model eligibility and prices still come from the existing registry/cost gates. The automatic song-analysis increment remains unpublished.

## Publication and rollback

Application baseline: `de7bc1a9302154b403b7e47fe82448a9aefb0928`. Publish only the UI increment. No database, secret, security, provider or CI configuration changes. Full CI is explicitly skipped for this UI-only commit at the user's instruction; normal future commits retain the existing QA workflow. Vercel packaging is distinct from testing. After publication, inspect the exact production commit and repeat a focused live UI check. Roll back the application to the baseline if the UI fails; retain all project/media data.

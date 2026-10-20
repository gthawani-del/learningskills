# Studio UI implementation rules

Applies to every new or modified customer screen across movie, advertising, documentary/series, music-video, avatar and individual-media workflows. Confirmed with the user on 20 October 2026.

## Authority and layout

Use the updated Studio shell released through PR #8, with [navigation and layout mapping](STUDIO_NAVIGATION_ASSETS_IMPLEMENTATION_2026-10-19.md), the [frontend v2 specification](frontend-v2/DIRECTOR_STUDIO_FRONTEND_UI_UX_V2_CODEX_SPEC.md) and subsequent explicit user corrections. Later explicit decisions govern overlapping layout details. The presence of an older component in the repository is not approval to reproduce it.

Desktop production retains three frames: left navigation/project context, central creation/Director controls, and a large right preview/sequence. Do not add a fourth permanent pane. Other stages retain their task-appropriate review surface. Mobile uses focused content and contextual drawers/sheets, not compressed permanent desktop columns. Preserve the existing typography, blue/light controls, spacing, borders and media-canvas treatment.

## Interaction requirements

- Keep the primary task visible. Prefill from known context and show editable suggestions; do not label an inference as the user's explicit choice.
- Reuse existing project, asset, character, approval, job and cost records. A new screen must not duplicate the underlying production system.
- Attachments offer file selection and existing project references, immediate previews, replace/remove, suggested compatible roles and explicit scope. Library selection must not create duplicate uploads. Removing a pending selection must not delete a saved asset.
- Preserve unsent work and selected files after recoverable errors or closing the attachment surface within the page session. Cross-reload resumable transfers require reselecting the exact original file and matching its checksum.
- Separate selected, transferring, inspection pending and ready states. Never show transport completion as trusted media readiness.
- Uploads, attachment selection and library references start no paid generation. Existing spending/approval gates stay authoritative.
- Do not advertise unsupported formats, processing, recording, model quality or export readiness.

## Acceptance before release

Compare actual rendered desktop and mobile-viewport states against the approved shell and screen-specific interaction requirements. Exercise primary action, keyboard/focus return, cancellation, validation failure and recovery. Check console/network errors, bounds, scrolling, touch controls and safe-area behavior. Keep visual review separate from functional verification. Screenshots and Chromium mobile viewports do not prove physical-device or assistive-technology acceptance.

Record exact code/CI/deployment states. Passing tests alone do not certify design compliance. UI changes are reviewed with real media content, not only an empty form.

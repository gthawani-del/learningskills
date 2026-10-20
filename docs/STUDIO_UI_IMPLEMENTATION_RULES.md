# Studio UI implementation rules

Applies to every new or modified customer screen across movie, advertising, documentary/series, music-video, avatar and individual-media workflows. Confirmed with the user on 20 October 2026.

## Authority and layout

The seven user-attached screens (01 desktop home, 02 upload, 03 sign-in, 04 generating, 05 preview, 06 revision and 07 mobile preview) are the frozen visual authority. They supersede the layout in PR #8 and older frontend-v2 screenshots wherever they differ. See [frozen UI implementation and UI-only evidence](FROZEN_UI_ACCEPTANCE_2026-10-20.md). Do not invent a replacement direction.

Home uses the unified Image / Video / Audio / Studio composer, a visible upload tile, settings, Review estimate, format shortcuts and photographic inspiration. Desktop creation uses three columns: navigation/project references; creation controls; the largest pane for preview, takes and the shot sequence. Mobile uses Create / Results tabs and normal document flow; no fixed bottom composer obscures content. Use the approved blue D symbol, light surfaces, sans-serif typography, thin borders and blue primary actions on every page, including backoffice.

Project, approval, budget, data and provider contracts remain authoritative. A reference is not a generated take; UI fixtures are not production results. Existing format, character, cost and account destinations remain accessible through the shared sidebar.

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

# Brief composer approval correction

## Problem and scope

Live Chromium reproduced the music-video brief composer intercepting normal clicks on the approval button. The existing local footer regression was extended with a tall music-video brief and a saved inline correction. Before the CSS change, the extended test also reproduced the composer note intercepting the inline Save button.

The layout now gives the desktop transcript its natural content height, prevents the direction card from shrinking below its contents, and preserves space for the composer and its note. Existing mobile transcript scrolling remains governed by the narrower-screen rules. No application logic, dependencies, database, authentication or security settings changed.

## Acceptance

The existing footer browser check exercises normal Save, reload, Approve and Continue clicks for music-video drafts at 1440x1000, 1100x800 and 390x844, alongside its existing five small-viewport geometry and navigation checks. No forced clicks are used. Full release QA is required before publishing.

## Production boundaries

Before this correction, production configuration advertised planning controls and uploads, and signed-out project/job requests returned the expected HTTP 401, replacing the earlier missing-configuration HTTP 503. This establishes configuration detection, not a verified authenticated database transaction. Real account saving, uploads, paid generation, final export and physical mobile testing remain outside this regression proof.

## Rollback

Revert only this correction commit and redeploy the prior accepted main revision f96e4cc33ebfdf200c093536c876f0ff89420b04. Do not revert environment-variable corrections.

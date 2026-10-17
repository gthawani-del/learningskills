# Director Studio — Implementation Status

Updated 17 October 2026 UTC. This record distinguishes actual work from the much broader approved blueprint. It does not declare the entire studio complete.

## Repository

Development branch: `codex/director-studio-foundation`, based on main `290c33dba38b3508bae77c9aa9e6a5637fd588d6`. The complete 29-file planning/reference set was preserved in commit `78036bdceddfa0a87b35b06006afa992ab5500a4`; main was not changed. Application additions are prepared as a separate reviewable commit/PR.

## Implemented

- Responsive light briefing and dark project/canvas/Director workspace; mobile navigation and Director sheet.
- Editable projects, treatments/scenes and shot direction with optimistic version checks; scoped composer drafts, keyboard `/skills`, `@references` and classified uploads.
- Cookie-based existing-account sign-in with server verification through Supabase; owner checks on project routes; no service credential in the client.
- Atomic project snapshot persistence, immutable artifacts/approvals, private asset retrieval and owner-scoped records.
- Actual Supabase foundation: 12 RLS-protected tables, private `director-media` bucket and 20 inactive model candidates with task-purpose descriptions and dated evidence.
- Spending/attempt reservations, canonical payload hash checks, atomic dispatch claims, current approval/authorization checks and uncertain-submission holds.
- Mock-tested direct OpenAI planning and fal queue adapters; no paid execution.
- Read-only admin job/registry views, restricted to configured administrators. Current overview is explicitly limited to administrator-owned projects; global operational access and management actions are not complete.
- Local-only sound-preserving FFmpeg export from approved uploaded clips with actual duration checks. It does not strip sound, stretch audio or freeze-pad a clip to satisfy the plan.

## Verified versus pending

Unit and local HTTP tests cover manual planning/persistence, version conflicts, reference isolation, authorization boundaries, immutable job identity, uncertain submissions and sound-preserving export. Mock provider tests establish request/response handling only. Live SQL checks establish schema/privilege state, not a complete multi-user production integration.

No live OpenAI/fal generation, generated-human realism test, singing proof, user usability study or production application deployment is claimed. The short synthetic export proof is not the representative 45–60 second filmmaking pilot.

## Operational gates still closed

| Gate | Required next evidence |
| --- | --- |
| Real application Supabase connection | Configure server URL/service credential and test sign-in, owner isolation and persistence through the deployed/test app |
| AI script planning | Verified quote/allowance, durable reservation/idempotency/uncertain charge lifecycle; environment flag alone cannot enable billing |
| Media generation | Use-case execution/quality validation and explicitly activated profile, quote and approved budget; all seeded routes remain inactive |
| Premium casting/voice/singing | Actual image/listening/temporal benchmarks and resolution of provider-document conflicts |
| Hosted export | Chosen durable worker/queue, private asset access and final A/V playback test |
| Full backoffice | Workspace-wide authorized operations, reviewed registry management, reconciliation, reporting and support workflows |
| Production release | Reviewable PR, remaining integration checks and explicit deployment approval |

## Verification record

Final case counts, browser evidence and database advisor results are recorded below as checks complete. A check must not be called passed merely because the screen or schema exists.

### Completed browser and application checks

- `npm test`: 30 scenario tests passed.
- `npm run check`: JavaScript syntax checks passed.
- `python3 apps/director/tests/browser-flow.py` against explicit local demo: desktop project creation, manual story/shot editing, current-version approvals, locked constraints persistence, keyboard skill selection, classified upload, asset mention, scoped proposal, mobile Director sheet/navigation, unavailable-voice recovery, reload persistence and no horizontal overflow passed. No page JavaScript errors were observed.
- Desktop and mobile screenshots were visually inspected. Local evidence is under `test-results/` (gitignored); it depicts real local app behavior, not generated product screens.
- HTTP synthetic-media proof exported a playable four-second MP4 with sound. This does not validate AI filmmaking quality.
- Supabase verification confirmed 12 RLS tables, 20 inactive candidates and a private bucket. Server-only table/function privileges were checked. Security advisor returned no findings after removal of unnecessary direct-client database read grants.
- Browser checks used local demo persistence. Real Supabase login, storage and project integration through the application remain unverified until hosting credentials are configured. No production application deployment or paid generation occurred.

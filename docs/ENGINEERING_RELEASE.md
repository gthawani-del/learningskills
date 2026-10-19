# Director engineering checks and release recovery

The existing Node tests, Python Playwright scripts, fixture servers, FFmpeg checks and isolated PostgreSQL proof remain the test infrastructure. The QA runner only selects and orchestrates them. Paid credentials are removed from its child environment; it does not deploy, change live data or activate models.

## Setup and daily checks

Use Node 22, Python 3.12 and FFmpeg/FFprobe. Run `npm ci`, `python3 -m pip install -r requirements-qa.txt`, and `python3 -m playwright install --with-deps chromium` once. Chromium at `/usr/bin/chromium` remains supported; `DIRECTOR_CHROMIUM_PATH` selects another installed executable. CI installs the same pinned PGlite/Playwright versions and FFmpeg. Runtime code has no new dependency.

Run `npm run qa:fast -- --changed apps/director/public/storyboard-production-core.js` during feature work. In a Git checkout, `npm run qa:fast -- --base origin/main` selects files changed since the common ancestor. Explicit paths support connector-backed workspaces without Git metadata. The runner follows static module imports for Node tests, maps affected browser surfaces, includes SQL for persistence changes and falls back conservatively for unclassified runtime/tooling changes. Fast mode always performs syntax/build checks; it is not release acceptance. Dynamic dependencies cannot be inferred perfectly: shared changes and uncertain impact require full QA.

Run **`npm run qa` before a release**. This invokes the entire existing Node suite, syntax/build, the existing browser regression set (including controlled writing failure recovery) and the current comprehensive SQL proof. Fixtures remain simulated where declared. Reports/logs go to `test-results/qa`; browser screenshots/reports remain under `test-results`. Missing dependencies fail the run. A green local/CI result does not prove physical mobile, real accounts, paid quality or live billing.

GitHub Actions runs full QA on pull requests and main pushes with read-only permissions, a 25-minute limit and seven-day artifact retention. It has no production secrets and does not apply migrations. Require its `qa` check before merging when an administrator can configure branch protection. Until then, manually refuse release on a failing/pending check. GitHub Actions success alone cannot prevent Vercel's automatic main deployment; do feature work in a branch/PR and inspect the full check before merging.

## Small agent handoffs

Start with one implementer. Delegate only independent work that benefits from parallelism; do not choose a fixed agent count. Before delegation, state the input/output contract, owned files, acceptance checks and dependencies. One integrator owns shared API/schema changes. A handoff lists changed interfaces, relevant checks and unresolved issues. Reuse established source evidence and rerun checks only after relevant changes/failures. Freeze owned files before final integration verification. No new agent framework or instruction hierarchy is introduced.

## Release acceptance

Record the candidate commit, last accepted deployment, affected flows, migration compatibility and QA evidence. Apply only reviewed migrations after isolated proof and native permission checks. Before production deployment, confirm authorization and a compatible recovery target. Never treat an untested older commit as known-good.

After deployment, confirm Vercel success for the exact commit and verify the actual deployed revision through deployment metadata. Open the live URL, exercise affected user flows, inspect console/network failures and capture relevant screenshots. Test saved projects, editing, reference/frame selection and playback when affected. Finished-film export is accepted only after a real playable output. Record each result as passed, failed, blocked or not run. Do not label desktop viewport checks as physical-device verification. Generation stays paused unless separately authorized and validated.

If a regression occurs, stop further promotion. For provider/spending incidents, use the existing authorized emergency generation controls while retaining known-job accounting/recovery. Restore the recorded compatible Vercel application deployment when authorized access permits, or revert only the feature's commits through a reviewed GitHub commit and redeploy. Never force-reset shared main. Repeat the affected smoke checks after recovery and record the exact restored deployment/commit.

Application rollback does not roll back Supabase data. Keep compatible additive migrations; use a reviewed forward fix for incompatible schema/data. Do not drop tables, remove history or run destructive reverse SQL as an automatic recovery step. A hosting rollback rehearsal and real account checks remain pending access; this runbook does not claim they passed.

## Vercel access diagnosis — 19 October 2026

The initial investigation was limited to read-only public requests, with 12-second request timeouts, TLS verification enabled and no cookies/credentials. It completed within the 60-minute budget. See `docs/evidence/VERCEL_QA_ACCESS_2026-10-19.json`.

Production `/` and `/api/config` return HTTP 200 without a Vercel login redirect or observed bot challenge. Config reports Supabase mode with planning/media/uploads/local export unavailable. Production `/api/projects` returns HTTP 503: “Configure the server Supabase connection before saving projects.” This application response differs from deployment protection. Verify the intended production target has `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` available, without exposing their values. Successful TLS in these requests does not certify every browser environment.

The historical foundation preview `/api/config` returns HTTP 302 to `https://vercel.com/sso-api`, with Vercel Authentication text. Protected preview automation requires an authorized session or the supported Vercel automation bypass; no bypass secret is available/verified here. No protection, environment variables, credentials, TLS settings or account data were changed. There is no current evidence of a production bot challenge. Direct Vercel administration/runtime-log access and two-account production tests remain blocked. This does not block local animatics work. Ask the account owner to verify the production server settings and, when preview QA is needed, provide an authorized access path through the hosting connection—never paste secrets into source or reports.

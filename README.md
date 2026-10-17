# learningskills

Important lessons — now also the development home for Director Studio.

## Director Studio development foundation

Start with [the build index](docs/BUILD_DOCUMENT_INDEX.md), [implementation status](docs/IMPLEMENTATION_STATUS.md) and [execution plan](docs/DEVELOPMENT_EXECUTION_PLAN.md). The approved frontend handoff is under `docs/frontend-v2/`.

Node 22+ is required. No application npm dependencies are installed.

```sh
npm test
npm run check
DIRECTOR_DEMO=1 DIRECTOR_LOCAL_RENDER=1 npm start
```

The explicit local demo binds to loopback, persists under `/tmp/director-studio` and cannot submit paid media. It is disabled on Vercel and in production. Open `http://localhost:3000`. For local admin review, add `DIRECTOR_ADMIN_IDS=demo-user`. Local export additionally requires FFmpeg/FFprobe.

For the real workspace, configure server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the hosting environment. Sign-in uses an existing Supabase email/password account and an HttpOnly cookie. The key is never sent to the browser. Set `APP_ORIGIN` to the actual HTTPS origin and `DIRECTOR_ADMIN_IDS` to verified administrator user IDs. See `.env.example`; never commit real values.

`FAL_API_KEY`, `OPENAI_API_KEY` and `OPENAI_STORY_MODEL` are server-only provider settings. Their presence does not enable paid operations. All seeded media candidates remain inactive/unvalidated, and AI planning stays closed until it has its own quote/reservation lifecycle. Private uploads currently support server-validated files up to 2 MB; large/resumable uploads are a later integration.

`database/` contains the reviewed SQL applied to the Director project, in order: foundation, project persistence, candidate seed, route freshness, dispatch claims, registry roles. These files are not instructions to rerun against an already-initialized database. No production app deployment or paid provider validation has occurred.

The original local prototype remains under `apps/studio/` for reference; the active new server is `apps/director/server.mjs`. Vercel routes target the new handler. Export is local-only until a hosted sound-preserving worker is selected and validated.

A local HTTP export proof is available with Python and FFmpeg:

```sh
python3 apps/director/tests/local-export-e2e.py
```

It uses synthetic footage and tones; it proves technical assembly, not creative realism or provider quality.

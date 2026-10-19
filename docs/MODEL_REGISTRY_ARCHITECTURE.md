# Director Studio — provider credentials, reviewed models and routing

Updated 19 October 2026. Current user instruction: apply the same architecture to OpenAI and fal. This implementation contract supersedes the earlier single-model environment setting. It does not activate a model or certify generated media quality.

## Deployment configuration

Store `OPENAI_API_KEY` and `FAL_API_KEY` as server-only Vercel environment variables. Keep Supabase service credentials server-only too. Never use a `NEXT_PUBLIC_` prefix, put credentials into registry JSON, return them to a browser or save them with a project. Redeploy after changing Vercel secrets so the serving functions receive them.

Model names, versions, task associations, supported languages/formats, request bounds, pricing and evaluation evidence belong in the Supabase-backed model registry. `OPENAI_STORY_MODEL` and `DIRECTOR_PLANNING_ENABLED` are no longer runtime configuration. The retired legacy planning helper cannot submit a request. Operational generation pause, reviewed registry eligibility and project spending authorization govern new submissions.

## Model lifecycle

1. An owner creates or updates a credential-free model draft in Backoffice → Model registry. A draft has its own version and profile hash. Saving it leaves the serving model unchanged.
2. The owner records actual schema, configuration-specific price, execution and quality evidence for the exact provider, endpoint, model version and tasks. OpenAI planning additionally needs operation bindings, language/format coverage, reviewed background-response retention and complete-request token bounds. Merely checking boxes does not run a benchmark.
3. The owner reviews the exact saved draft and submits publication with its version, hash, control revision, reason and evidence acknowledgement. The backend validates supported adapters, fresh evidence and exact bindings. Unknown or unsupported functions remain held.
4. Publication records immutable before/after profiles and review evidence. It increments the operational revision; it does not clear the global generation pause or authorize a customer's spending.
5. Any unresolved job, unknown charge or outstanding planning reservation on that model blocks publication. Current serving-profile changes also invalidate an older draft's publication baseline. Save a fresh draft after resolving the conflict.

Only server-derived owners can save/publish. Operators can retain their existing pause/disable permissions; reviewers can inspect. Customers and browser metadata cannot grant staff access. Drafts, releases and command receipts are service-only database records with RLS and append-only history.

The API uses `GET /api/admin/registry` and `POST /api/admin/registry/commands` (`save_draft` or `publish_draft`). Request IDs bind exact commands; an unconfirmed response is reconciled by explicitly retrying the same payload and ID. There is no automatic publication retry. Registry fields accept bounded plain JSON and reject credential/header fields. Provider hosts are fixed by implemented adapters.

## How the router decides

The request supplies a production task and project constraints. Registry discovery finds candidates; it grants no execution permission. The server checks the exact task/operation binding, active/reviewed state, supported input/output configuration, schema, fresh prices, evidence, project scope and financial limits.

Suitable candidates are ranked by reviewed fit and priority. Explicit quality, language, format, duration and budget constraints can hold a route. Cheapness alone does not determine the choice. Fresh measured routing evaluations support quality and latency preferences; an unsupported preference is held rather than invented. Route previews explain the selected model and candidate holds.

An OpenAI planning estimate is operation-specific:

| Operation | Registry task | Current execution adapter |
|---|---|---|
| `interpret_brief` | `brief_interpretation` | OpenAI Responses, structured brief proposal |
| `initial_plan` | `film_planning` | OpenAI Responses, film/shot plan proposal |
| `revise_plan` | `film_plan_revision` | OpenAI Responses, plan revision proposal |
| `write_script` | `screenplay_writing` | OpenAI Responses, screenplay proposal |
| `revise_script` | `screenplay_revision` | OpenAI Responses, scoped screenplay proposal |

`GET /api/projects/:id/planning/:operation` previews that task. The existing `/planning` route defaults to brief interpretation. Planning allowances record the operation and selected model/profile. The UI sends the displayed model ID and fingerprint as expectations; a changed route requires a refreshed review. New allowances are for one operation; historical operation-less allowances retain their original scope. A future multi-operation or multi-model allowance needs its own explicit authorization contract.

Starting or resuming a call uses its authorized model, not whichever candidate now ranks first. A price/profile/scope change holds new submission. A failed or uncertain request never triggers a hidden model switch or paid retry. Known provider requests remain inspectable and reconcilable using their saved request/profile snapshots.

## Cost and recovery

OpenAI pricing uses reviewed rational input, cached-input and output token rates. The displayed maximum reservation uses the complete reviewed request/context bound and output limit; it is not a promise of typical cost. An explicit task cap can reject unsuitable routes. Actual recorded usage settles the original call; missing usage or overruns retain an unresolved hold.

Fal media quotes use reviewed configuration-specific scalar or composite tariffs, actual requested units and the existing project quote/authorization/reservation lifecycle. Route publication does not authorize variants, retries or fallback generation. User-facing per-creation billing and provider invoice reconciliation remain separate incomplete commercial work.

## Coverage and release limits

This batch manages both providers through one reviewed registry lifecycle. It does not make the entire fal catalog executable. Current reviewed fal execution adapters are:

| Endpoint | Supported task |
|---|---|
| `minimax/h3-max/reference-to-video` | `reference_video` |
| `bytedance/seedream/v5/pro/edit` | `image_edit` |
| `elevenlabs/tts/eleven-v4` | `speech_synthesis` |

Other valid fal endpoint identities can be researched and saved as drafts. Publication for execution requires a reviewed implemented adapter, exact schema hash, supported task/input configuration and actual test/quality evidence. OpenAI functions outside the five implemented planning operations, including separate department planning, also need their own schemas, adapters and acceptance checks. Nothing in this document declares them complete.

No real paid call or model-quality pilot is implied by local synthetic tests. Vercel/deployed account checks remain deferred; physical mobile and real generated-output review remain outstanding. Default generation pause and inactive native model records remain unchanged by installing the migration.

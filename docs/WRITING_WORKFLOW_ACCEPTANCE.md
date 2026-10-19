# Screenplay writing and originality review

Implementation batch: 19 October 2026. Baseline: `1fcd2da7ebf23507164cd70bf35b9aece107ddf5`. This document records engineering behavior and its evidence limits; real writing quality and universal originality are not established.

## User workflow

The primary path is approved idea/brief → explicitly authorized LLM screenplay proposal → read-only review → apply as an unapproved version → source comparison and user approval → Cast & World. A script upload is optional. Treatment, character descriptions, scene action, attributed dialogue, delivery direction and estimated scene durations are actual structured fields; this is not a shot list or a generated movie.

The optional source path preserves UTF-8 TXT/Markdown originals separately from the working screenplay. Choosing a source as the working script divides its text into labelled sections without claiming screenplay analysis. Supplied authorship and adaptation rights remain declarations. PDF/DOCX screenplay parsing is not supported by this batch. Editing a working version preserves the supplied original and previous script versions.

The Story stage displays a readable screenplay and opens one focused editor when needed. Draft input is scoped to its project; approval requires saving or cancelling the editor. A proposal cannot silently replace approved work. Applying a proposal records its owned saved model-call identity and requires a fresh review.

## Paid planning boundary

`write_script` requires a current approved structured brief and no current screenplay. `revise_script` requires a saved revision instruction and current screenplay. The existing planning allowance, conservative maximum reservation, one dispatch claim, exact request replay, provider ID, usage reconciliation and unknown-outcome holds apply. There is no automatic paid rewrite or repair.

The `director-planning-v3` request and reviewed schema bind screenplay instructions and output, project sources, current script, revision request and approved decisions. Full inputs are retained or explicitly rejected at the reviewed size bound; no approved constraints or source text are silently truncated. New schema evidence requires review before enabling any production profile. Exact saved v2 requests remain pollable for their original operations; a v2 request cannot authorize writing operations.

Actual model activation, a real screenplay benchmark and live provider-invoice settlement remain outstanding. Passing a simulated-provider test is not evidence of good writing.

## Deterministic records and revisions

The screenplay archive contains immutable versions, exact source text, provenance, saved revision requests and version-bound use declarations. LLM output cannot supply approval, ownership or spending authority. General project PATCH cannot replace this archive or edit its derived story independently.

A targeted revision preserves the complete character array, title, logline, treatment, scene order/identities and every untargeted scene exactly. The validator rejects changes outside that scope. A whole-script revision is an explicit separate scope. Revised scene documents invalidate linked shot specifications while preserving media; global character, logline or treatment changes conservatively require renewed shot review where dependencies are not sufficiently specific. This does not claim complete intelligent downstream repair.

The existing story view stores the screenplay treatment and scene headings as summaries. Full scene action and dialogue remain in the authoritative screenplay, and scene-change checks compare full screenplay scenes. Device-to-cloud import derives these summaries from the screenplay, preserves sources and versions, and imports no approvals or permitted-use review authority.

## Originality coverage

The implemented comparison collection is **this project's supplied text sources only**. It contains no external screenplay corpus, search index, other customers' private work or licensed catalogue. A newly written script with no supplied sources reports **coverage unavailable**. It is never labelled plagiarism-free or legally cleared.

Comparison uses code rather than an LLM judgment: Unicode normalization, case and punctuation handling, matching-view format-control removal with original offsets, contiguous passages, separated fragments and bounded token-edit comparisons. Character descriptions and performance directions are included alongside treatment, action and dialogue. Source originals are not normalized in storage.

Thresholds are explicit comparison heuristics: contiguous matches require at least eight tokens, forty normalized characters and six distinct tokens. Near-verbatim checks use sentence windows with a shared four-token anchor, at least twelve tokens, and a maximum of three token edits within fifteen percent. These are not legal safe thresholds. Short quotations, unindexed works, semantic copying, translated copying, transliteration and plot similarity can be missed. Incomplete checks must hold approval rather than become a successful report.

Findings identify the source and exact matched spans. Approval requires a current script and project version, resolved current findings and explicit acknowledgement of limited coverage. A permitted-use explanation records the user's declaration; it is not independent proof of a licence. Reports and declarations bind exact script/source/policy inputs. Source changes stale the existing script review. Current screenplay approval also depends on current brief approval and gates downstream production readiness.

## API and execution

| Operation | Behavior |
| --- | --- |
| `GET /api/projects/:id/screenplay` | Read the owned screenplay, sources, review state and comparison coverage. |
| `POST /api/projects/:id/screenplay` | Save a bounded source, use a source, edit a document, save revision scope or record current finding declarations. Requires the current project version. |
| `POST /api/projects/:id/screenplay/apply-proposal` | Apply only a completed saved owned writing proposal after exact source/context validation. Client-supplied model output is rejected. |
| Existing planning-consent/call endpoints | Authorize and run `write_script` or `revise_script` under reviewed planning controls. |
| Existing approval endpoint | Approve/reject/revoke the screenplay artifact with the required current-version and coverage checks. |

## Verification record

318 automated tests, syntax checks and the production build pass. Six actual local browser runs pass: normal writing, controlled post-apply navigation failure, compact brief editing, v2 workspace/media editing, mobile footer and brief-proposal review. Normal runs report zero console/HTTP errors; the recovery run separately identifies its deliberately injected 503. Nine isolated PostgreSQL proof groups pass. Native migration `20261019093706` is applied; service-only function access, RLS, empty-input guards and a clean security advisor are verified. Evidence: [workflow checks](evidence/WRITING_WORKFLOW_CHECKS_2026-10-19.json) and [native database checks](evidence/WRITING_NATIVE_DATABASE_CHECKS_2026-10-19.json). Browser fixtures use a real local HTTP server and store with a clearly simulated provider; they do not exercise OpenAI, fal or deployed customer accounts. Desktop mobile viewports do not establish physical mobile-device or actual keyboard behavior.

Release limits remain: reviewed production model and controlled writing-quality run, wider permitted comparison corpus, source-backed research and fact review, complete department planning, storyboard generation, timed animatics, real media pilots and live financial settlement. Vercel/account browser tests remain deferred by the user's instruction.

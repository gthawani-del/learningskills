# Creative intent and structured brief intelligence

Implemented 18 October 2026 against `4fa45492aa44eb31bbde94505b216ca9fa40e6f8`. This is the implementation and acceptance record for Step 6, structured brief interpretation. The six active specifications remain authoritative.

## Purpose

The Director keeps a revisable, project-scoped understanding of the user's creative job. Practical Theory of Mind is a design principle here: represent the goal, audience response, preferences and uncertainty without treating guesses as facts. It is not psychological profiling or proof of an internal mental state.

The first deliverable is a reviewable brief. Script, casting, storyboard, motion and sound production consume accepted decisions; the brief itself is not a screenplay or finished movie. [Competitor research](CREATIVE_INTENT_COMPETITOR_REVIEW_2026-10-18.md) distinguishes official guidance from the blocked browser/REA observations.

## Field contract

Sixteen fields cover purpose, audience, audience response, platform, aspect ratio, visual style, tone, setting, cast, voice, product, constraints, budget direction, format, duration and language. Each field retains a value, status, source and supporting evidence.

| Status | Meaning |
| --- | --- |
| Explicit | Directly entered in the editor, or supplied as a known explicit project setting. |
| Inferred | An unconfirmed project default or proposed creative interpretation. Approval accepts its use; it does not change its provenance. |
| Unknown | Information is absent. The system does not invent a cast, location, reference, budget or permission. |

Manual corrections are explicit. Existing legacy settings without explicit-source metadata remain unconfirmed. Model outputs can only propose inferred or unknown fields. Supplied evidence must be an exact excerpt from the saved request sources; a creative hypothesis can omit evidence rather than invent a quotation. The current prompt does not claim to extract verified facts from media attachments.

Budget direction is descriptive creative scope. It is not an authorization, customer balance or quote. No creative field can activate a model, approve itself, establish rights or authorize spending.

## User flow

1. Enter the idea and project settings. Reviewing and editing are free.
2. The main workspace shows a compact starting proposal with the supplied idea, format, runtime, language and any known creative direction. The free `suggest` path anchors the purpose to the actual idea and retains known decisions. It does not claim an LLM interpretation or invent production facts.
3. Review the filled proposal. Open one prefilled editor only when a correction is needed. Additional details, provenance and department handoffs stay in optional disclosures; missing optional fields do not become a questionnaire or a generic creative fallback. Project settings use a separate drawer rather than occupying an empty permanent column.
4. Optionally explore AI interpretation through the planning controls. A reviewed, enabled model and a separate scoped planning allowance are required. Recording the allowance does not submit a call.
5. Explicitly start **Interpret brief with AI**, then check the saved call. Reload and status polling reuse the original response identity.
6. Review the human-readable proposal. An explicit apply action creates an unapproved brief version and preserves protected choices. It does not start media generation or replace a story.
7. Choose **Approve direction**, then **Continue to story**. The approval accepts visible suggestions and deferred choices; optional unknowns remain internally recorded. Approval is distinct from financial consent. Unsaved inline edits block approval and continuation until saved or cancelled.
8. Continue to Story. Paid initial/revision planning requires a fresh, approved structured brief once the project has one.

The briefing keeps stage navigation and the main canvas, with one default composer and no default brief-field textareas. A single editor opens on demand; advanced users can add a specific optional detail. The separate AI-result review is read-only and applies into a new unapproved brief version. A viewport check is not physical mobile-device verification.

User correction, 18 October 2026: the earlier sixteen-field modal and then its two-column version exposed internal structure and demanded too much information. This compact proposal supersedes those layouts. A labelled suggestion must reuse the actual request or a known setting; it must not fabricate a character, voice, brand, claim, budget or reference merely to fill a field. Material missing production prerequisites remain unresolved for their relevant stage.

## Hybrid execution

| Operation | Execution | Cost boundary |
| --- | --- | --- |
| Free interpretation, targeted correction, approval, saved result retrieval | Shared deterministic code / owned project records | No model call |
| `interpret_brief` | OpenAI Responses with its own strict proposal schema and versioned instructions | Existing planning consent, bounded reservation, one dispatch claim |
| `initial_plan`, `revise_plan` | Existing film-plan schema plus reviewed creative context | Same authorization and recovery controls; fresh brief approval required when a brief exists |

`director-planning-v2` binds operation, instructions, schema, inputs and context into the saved request hash. Reviewed schema evidence covers both brief and film schemas. Old profile evidence does not silently qualify for the new contract. No new endpoint or provider is enabled by this release.

Planning context contains the current brief, unresolved questions, department handoffs, an approval-history digest and exact current approved story, shot and production-record contents. Reference IDs and versions are included where available; media bytes and old record histories are excluded. Oversized contexts are held rather than silently dropping approved constraints.

The model must preserve approved choices, avoid demographic shortcuts, keep unknowns visible and treat embedded content as creative data. These instructions support creative consistency; they are not a measurable guarantee of writing or media quality. Deterministic gates independently protect authority and saved decisions.

## Corrections, history and dependency rules

- Brief versions are immutable and bounded to 50 per project. Identical interpretation is a no-op. Applied revisions receive an actual revision timestamp.
- Newer targeted manual choices, including explicitly clearing a value, survive later interpretation. A model cannot overwrite manual or approved choices.
- Format, runtime and language remain consistent with current project settings. Editing these in the brief editor updates the source setting and signature. An unrelated correction cannot mark an old runtime as current.
- Source changes make the previous interpretation stale. Approval of that stale interpretation is rejected.
- Meaningful brief changes invalidate story approval through its version. Existing shots, references and uploaded media remain available. The production graph also holds downstream work while current brief approval is missing, revoked or stale.
- Applying a saved model proposal revalidates the original request and exact current creative context. A changed source, brief or approval history prevents stale application. It does not require another provider call.
- Device-to-cloud import preserves the validated creative archive and source signature, but imports no approvals or spending authority. The device source stays intact.
- Legacy projects without a structured brief retain their previous backend behavior. The current customer Story flow introduces brief review; this release is not a retroactive approval certification of legacy projects.

## Department handoffs

The brief represents producing; story and direction; casting; look and costume; art and locations; camera and lighting; voice and performance; sound and music; continuity and assistant direction; storyboard; animatic; VFX and animation; editing and finishing; and rights and delivery.

Each handoff identifies its inputs and planning task. “Ready for planning” means its listed brief inputs are present. It does not mean the department executed, that references or voices were generated, or that its output passed review. Generated storyboard frames, a playable animatic and actual media production remain separate implementation work.

## Runtime routes

| Route under `/api/projects/:id` | Behavior |
| --- | --- |
| `GET /brief` | Read the current interpretation, questions, approval and staleness status. |
| `POST /brief` | Owned, version-checked `suggest`, `interpret` or targeted `update`; client-supplied proposals and authority fields are rejected. |
| `POST /brief/apply-proposal` | Apply a validated saved `interpret_brief` result by call ID after exact-context checks. |
| `GET /planning-calls/:callId` | Retrieve an owned saved result without dispatch. Internal request/profile snapshots remain private. |
| `POST /approvals` | Existing review route with artifact `brief`, exact version and explicit assumptions acknowledgement. |
| Existing planning consent/call routes | Add the `interpret_brief` operation without a new financial mechanism. |

All mutations retain existing ownership and incomplete-import gates. Brief snapshots use the existing atomic project-save RPC and immutable artifact records; no parallel brief database is introduced.

## Database and release evidence

Migration `20261018035212_director_structured_brief_planning` was applied to the Director project. It captures exact creative-brief JSON at consent creation, independently fences reservation and submission against archive changes, supports `interpret_brief`, and requires exact current brief content/source plus latest owner approval for dependent production readiness.

Seventeen isolated PostgreSQL/WASM proof groups pass. They exercise the actual SQL as `service_role`, including stale application hashes, unchanged simulated revision attacks, currentness, revocation and rollback. This is a single-connection proof, not a true concurrent-session race test. Live checks confirmed service-only new functions, RLS retained, zero active OpenAI models, zero planning calls/consents and generation paused. The security advisor returned no findings.

The initial release evidence is recorded in [the original checks JSON](evidence/CREATIVE_INTENT_CHECKS_2026-10-18.json). The subsequent compact UX correction passes 258 tests/build and three local browser flows; its current evidence is recorded in [the compact UX checks](evidence/COMPACT_BRIEF_UX_CHECKS_2026-10-18.json). Local browser checks cover device persistence and an actual local API/file-store workflow with a server-side simulated provider. They do not intercept browser requests, call a real paid provider or establish live Supabase account isolation.

## Remaining gates and next work

Live paid interpretation stays disabled pending a reviewed model/profile and an authorized controlled run. Validate useful question selection, faithful intent interpretation, multilingual briefs and creative preference preservation on representative real requests. The conservative free path and simulated responses do not establish those quality results.

The subsequent [writing implementation](WRITING_WORKFLOW_ACCEPTANCE.md) adds structured screenplay proposals, review/application, versioned script editing and deterministic project-source originality checks. Real treatment/script quality, department breakdown, actual casting/look/voice auditions, generated storyboards and timed animatics remain upcoming work. General attachment content analysis, cross-project preference memory, comprehensive deadline/control fields and full contextual repair orchestration are not implemented by this brief reviewer. The two-attempt quality target remains unproven.

The compact editor retains project-scoped unsaved text during client-side navigation, blocks approval while an editor is open and disables controls during a pending write. Failed saves retain the visible input. This is not a claim that unsaved editor text survives a full page reload.

Deployed account/browser checks remain deferred by the user's instruction. Physical mobile testing is outstanding. No current authenticated competitor workflow or internal Theory of Mind architecture was verified.

Rollback: keep paid planning and generation paused, restore the previous application revision if necessary, retain additive records and avoid deleting history. An older planning client cannot submit the new request version; resume through a reviewed roll-forward rather than weakening the version or approval fences.

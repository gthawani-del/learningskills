# Director Studio: Music Video Director — Consolidated Design

**Date:** 18 November 2026  
**Status:** For review. This document does not authorize implementation, paid generation, production migrations or new infrastructure.  
**Code baseline inspected:** `bf51cda57f8f9adc9d937f5b956ecf256e9b956a`  
**First release:** Complete Music Video Production. The wider filmmaking platform remains intact.

## 1. What we are building

A user uploads a song. Director Studio understands it, recommends a coherent music video, plans the production, manages permitted work and delivers the complete film.

The user can let the Director lead or collaborate through conversation. Both experiences use the same project, assets, decisions and budget.

Success means a video the user likes, with the original recording preserved, believable performances, purposeful visuals and controlled cost. A collection of clips, a storyboard or an animatic is not a finished music video.

## 2. The five foundations

| Foundation | Its role |
|---|---|
| Director Studio today | The application, frozen UI, shared production engine, seventeen departments, records, approvals, assets, routing, spending controls, jobs and rendering foundation. |
| OpenMontage | Selected production knowledge, tool/adapter patterns, checkpoints, editorial guidance and evaluation ideas. Review licensing before copying material. |
| Our recent-song workflow | Practical direction: strong approved stills, shot-specific models, selective singing, dance, B-roll, continuity, reuse, deterministic lyrics and editing. |
| Director persona | Creative judgment, empathy, proactive coordination, audience awareness, practical recommendations and financial discipline. |
| Customer experience | “Plan it for me” and “Create it with me,” sharing one production system. |

The approved Model Router Intelligence Bible, Realism Intelligence Layer, frozen UI rules and eighteen-deliverable release plan remain authoritative. This document connects them; it does not replace their detailed requirements.

## 3. Approach selected for this design

**Extend Director Studio around our production workflow.** Use OpenMontage selectively where it strengthens a defined capability.

Replacing Director with OpenMontage would discard existing application work and introduce a different operating model. A separate music-video engine would duplicate assets, approvals and financial records. Neither fits the agreed direction.

The user agreed the central experience and asked for this consolidation. The detailed design below remains subject to review; new recommendations are not presented as already shipped functionality.

## 4. Two ways to work with one Director

### Plan it for me

The Director proposes one complete recommended production. The summary shows the concept, visual direction, necessary cast, full-song coverage, performance strategy, reuse, cost and important uncertainties. Details are expandable.

The user can approve the proposed scope, change something or start a discussion. Approval of production spending must explicitly cover the quote, ceiling and allowed operations through existing controls. It is not permission for unlimited attempts.

Unseen reference images and performances are not magically approved by accepting a text plan. Consolidate meaningful reviews: actual look/keyframes, representative difficult performance and final output. The existing full-song storyboard/animatic remains available for review. Do not require seventeen departmental sign-offs from the customer.

### Create it with me

The Director discusses the song, brings useful ideas and turns feedback into saved decisions and permitted actions.

Example: “Make the second chorus more celebratory” should identify the affected shots, recommend changes, reuse suitable footage and show any additional charge before paid execution.

The user can say “handle the rest” or “let’s discuss this scene.” Switching participation style never resets the project, spending authority, approvals or attempt counts.

**Proposed default for delegated selection:** the Director may inspect and provisionally select ordinary takes within the approved direction and spending allowance, then include them in the rough cut. Record that as Director selection, not human approval. The user reviews actual look/keyframes, the representative difficult performance before scaling, and the assembled film before final approval. Do not add a new human operator or require a customer decision on every ordinary clip. Additional review remains available in either participation style. If actual media inspection is unavailable, mark the selection unverified and surface it for review; do not manufacture a pass. This default is a recommendation for review, not a claim about an existing permission policy.

## 5. The user journey

| Stage | What the user sees | What the system does |
|---|---|---|
| Upload | Visible song upload, playback and optional lyrics/photos/references. | Preserve original bytes and source identity; inspect privately. Uploading alone starts no paid generation. |
| Understand | A concise song interpretation, editable lyrics/timing and clearly marked uncertainty. | Measure technical properties; use qualified audio models for interpretation/transcription/alignment. Do not invent sections, languages or singers. Disclose paid analysis before authorization. |
| Direct | One recommended concept, emotional progression, visual world and ending. | Use approved song evidence and relevant departmental knowledge. Ask only consequential questions; prefill editable assumptions. |
| Establish the look | Actual identities, outfits, locations and representative compositions. | Reuse compatible approved assets or generate within authority. Save exact reference versions and approval scope. |
| Preview the plan | Timed storyboard and full-song animatic with the original recording. | Give each shot a purpose and role; validate exact coverage and reference dependencies. Label previews honestly. |
| Approve production | Clear new/reused asset counts, footage/sync requirements, estimate, reserve and ceiling. | Compile current task-compatible routes and quotes. Keep creative approval separate from spending authority. |
| Produce | Actual footage arriving, specific progress and relevant review requests. | Prove difficult requirements before scaling; generate eligible shots, inspect results and repair only diagnosed failures. |
| Edit and deliver | Rough cut, targeted revisions, export progress and downloadable finished video. | Select takes, trim, mix, add deterministic text, validate the complete export and store it privately. |

Planning is iterative: an initial shot map guides keyframe creation; accepted imagery refines shot execution. Do not pay for a large image batch before knowing how its shots serve the song.

Instrumental songs, multiple performers and multiple languages are supported requirements. Visible singing is a creative choice where applicable, not a requirement imposed on every song. A singing request cannot silently become reaction footage or unrelated B-roll.

## 6. The Director's responsibilities

The Director understands intent, recommends a direction, coordinates applicable departments, explains trade-offs, maintains continuity, manages cost, reviews results and follows the production through delivery.

It should be empathetic without agreeing with every idea. It should be financially disciplined without automatically recommending the cheapest model. Marketing judgment applies to the song's purpose; it must not turn every artistic work into an advertisement.

Every useful exchange should lead to a decision, a reviewable proposal, a permitted action or a clear explanation of a dependency. Avoid endless conversation that does not advance the film.

### All seventeen departments remain

Producing; direction; script breakdown; casting; look; locations; camera; lighting; voice; sound; music; continuity; storyboard; animatic; VFX; editorial; rights.

Each contributes where applicable through existing contracts. “Not applicable” needs a reason. Departments are responsibilities and skills, not a requirement for seventeen agents or seventeen model calls.

## 7. How the agent works inside the existing application

**Recommended architecture:** one bounded Director using existing OpenAI planning integration and permitted application tools. Do not add another agent framework, database or job system.

1. Load the current project, source versions, approved direction, relevant assets and budget.
2. Select only the departmental knowledge needed for the current task.
3. Produce a structured proposal or request an allowed tool action.
4. Let application code validate permissions, references, versions, approval scope, cost and attempts.
5. Execute through existing services and jobs; persist results and evidence.
6. Report actual progress and request a meaningful decision only when needed.

Allowed tool families cover existing project reads, planning/revision proposals, asset lookup/binding, quote preparation, authorized generation, job status, reviewed take selection, edit proposals and rendering. The coding plan must map these to existing handlers and add only missing wrappers.

The agent cannot grant itself approval, alter invoices, bypass shutdowns, install tools, run arbitrary code, access another user's assets or claim it inspected inaccessible media. Attachments and external text are data, not instructions that override application policy.

A conversational tool loop is proposed work. Existing treatment calls and departmental workflows do not establish that this complete agent is already implemented. The selected OpenAI model and tool-calling configuration require registry review and qualification; a stored API key does not activate them.

## 8. Model routing and image production

Choose the production method before choosing the model:

- Approved asset reuse or deterministic editing where suitable.
- Image generation/editing for references and actual shot compositions.
- Motion generation for narrative, dance and camera requirements.
- Audio-driven performance or a separately qualified synchronization operation for visible singing.
- Deterministic processing for technical measurements, typography and assembly.

First filter exact endpoints by supported inputs, duration, reference controls, output properties, permitted use, current schema and price. Then consider reviewed quality, continuity, expected accepted-output cost, speed and reliability.

Plan related shots together. Frequent model switching can increase repair costs and visual drift. Unknown quality or latency stays unknown; availability, popularity and stability labels are not measured creative success.

API imagery will not be assumed identical to native ChatGPT imagery. Compare supported OpenAI API routes and existing compatible fal routes against approved character, new-shot and localized-edit examples. These are different tasks. Keep accepted references and exact configurations. No new provider is required by this design.

For singing, preserve exact song intervals and performer assignments. A timing-preserving vocal stem may guide a compatible model; the original master remains final audio. Do not silently loop, reverse, truncate or retime performance because of provider defaults.

## 9. OpenMontage: retain the lessons, check the rules

| Retain or adapt | Do not inherit automatically |
|---|---|
| Continuing production context and clear delivery promises. | An IDE assistant as the hosted customer execution system. |
| Structured shot direction and contextual knowledge. | Treating prompt instructions as guaranteed physical/model controls. |
| Endpoint adapters, validation, job receipts and resume. | Family-level capability flags as proof an exact endpoint supports the task. |
| Source retrieval, provenance and reuse. | Random footage assignment as our creative default. |
| Emotional editing, representative proofs and scoped corrections. | Mandatory generic research quotas, narration/music rules or cinematic formulas. |
| Concrete review findings tied to artifacts. | Automatically passing unresolved critical failures after a fixed number of reviews. |

OpenMontage is AGPL licensed. Copying code, schemas or skill prose requires a suitable license decision. Functional requirements can inform independent implementation, but translating covered code is not an automatic exemption. Use existing independently developed modules while any incorporation decision remains unresolved.

## 10. What the interface shows

Preserve the approved visual system and existing navigation. Do not redesign the product.

| Area | Purpose |
|---|---|
| Desktop left column | Existing navigation, project references and production context. |
| Desktop middle column | Current task, conversation, editable proposal or selected-shot controls. Reveal detail when useful. |
| Desktop largest/right column | Actual images, selected takes, shot sequence, animatic, rough cut and final preview. |
| Mobile | Existing Create / Results structure, focused tasks, accessible preview and normal document flow. No overlapping fixed composer. |

Use honest states: uploading, inspection pending, planning, queued, generating, awaiting review, accepted, needs correction, rendering, export ready or blocked. Provider completion is not creative acceptance. Show real completed counts; do not invent progress percentages or completion times.

Keep spent, reserved/pending and estimated remaining cost understandable through existing controls. Put exact model/configuration details behind an expandable explanation. Show consequential route changes before execution.

Recoverable errors preserve work. Cancel stops new submissions; an already-running provider job may still finish or incur a charge. Reconcile it rather than promise an automatic refund.

## 11. Quality and spending rules

**Application-enforced:** ownership, private media access, current source/reference versions, valid timeline coverage, spending authority, reservations, job identity, attempt limits and output integrity.

**Creative review:** story usefulness, singing, expression, dance, identity, body motion, continuity, lighting, pacing and B-roll relevance. A contact sheet cannot certify motion or lip sync. The model does not independently certify its own work.

Director inspection can support provisional take selection under the delegated policy above. It is recorded judgment, not independent evaluation or the user's approval. Technical checks supply their own measured evidence; the user supplies final creative acceptance. No separate evaluator model, staffing role or new QA framework is assumed.

Default correction policy remains one initial creative attempt plus one diagnosed correction per shot within the approved allowance. Record billable operations separately: a motion job and sync job may belong to one planned production attempt. Changing models or splitting work does not reset the allowance.

Uncertain submissions are reconciled before another paid request. A failed critical requirement remains blocked after the limit; offer salvage, an explicit compromise or separately authorized escalation. Never convert exhaustion into a quality pass.

Preserve the master recording and canonical lyrics. Add requested text deterministically with correct shaping and safe placement. Rights, likeness consent and asset-specific permissions remain necessary.

Measure cost to an accepted finished video, including rejected generations and finishing. The reported ₹6,000–₹7,000 productions are user observations, not universal cost promises. Acceptance within two attempts remains a target requiring evidence.

Retain production outcomes in existing records: unique sources versus timeline cuts, paid attempts, accepted/rejected/salvaged footage, reused ranges, usable seconds, actual charges and exact review scope. These records improve subsequent routing recommendations without silently changing approved models, exposing another user's media or treating a small sample as proven reliability.

## 12. What exists and what still needs delivery

| Area | Position at the inspected baseline |
|---|---|
| Song Intelligence | Records, measurements, provider adapters and treatment handoff implemented; real provider/music qualification and production source dependencies remain separate. |
| Treatment and departments | Timed treatment, seventeen-department integration and selective revision implemented with recorded local evidence. |
| References and storyboard | Approved reuse/bindings and music-aware image request handling implemented; actual provider output quality remains unqualified. |
| Full-song animatic | Saved full-song assembly and player implemented; latest browser evidence uses simulated provider output/audio playback. |
| Routing and money | Existing registry, quotes, authorization, reservations and job controls; exact enabled routes need current qualification. |
| Complete-song assembly | Actual supplied-media local FFmpeg proof recorded; durable hosted customer export remains incomplete. |
| Adaptive Director and two experiences | Proposed integration with existing production systems; not established as shipped by previous workflow code. |
| Singing, accepted footage and finishing | End-to-end creative/hosted acceptance remains outstanding. |
| Cloud and release | Real accounts, private source/runtime acceptance, necessary approved schema installation, full pilots and physical-device acceptance remain open. |

This table reports source and recorded evidence, not a new test run or current live deployment verification. Do not estimate percentage completion from files or tests.

## 13. Development order and acceptance

| Increment | Reuse and missing work | It is accepted when |
|---|---|---|
| 1. Director interaction | Existing planning, treatment, departments and records; add bounded conversation/action handling and the two participation styles. | User direction becomes saved reviewable proposals; switching styles preserves decisions; no unauthorized action or unrelated revision occurs. |
| 2. Production-ready routing | Existing adapters, registry, quotes and jobs; close exact task/input/configuration gaps and expose clear explanations. | Hard requirements reject incompatible routes; requests and prices bind to current versions; uncertain jobs resume without duplicate spending. Real media quality remains a separate qualification. |
| 3. Performance and footage | Existing reference/shot/take records; qualify singing and difficult motion, then complete purposeful footage/B-roll and scoped repair. | Authorized actual outputs meet reviewed shot requirements, retain identity/master timing and cover the complete intended song. |
| 4. Editor and delivery | Existing edit and FFmpeg foundation; complete missing take/range controls, finishing, durable execution and private MP4 retrieval. | A complete-song film is actually rendered, checked, saved, reopened and downloadable with the intended picture and sound. |
| 5. Private release | Existing QA/CI, cost controls and production references. | Real full-song projects demonstrate quality, charges, isolation, recovery, usable UI and required device acceptance. |

Close cloud/source dependencies early where they affect these increments. Independent coding can continue while explicit external approvals are pending; do not label it live acceptance. No model or hosting spend is authorized by this sequence.

Use one primary developer by default. Use existing affected-feature checks; broader regression at meaningful integration/release boundaries. No new QA framework, repeated general audit or unrelated refactoring. Publish verified implementation increments through the approved main workflow after implementation is authorized; Vercel handles deployment.

A reliable calendar estimate requires a bounded coding plan and identified external dependencies. Do not invent a completion date from this design.

## 14. Preserve all eighteen release deliverables

| # | Existing release deliverable | Where it remains in this design |
|---|---|---|
| 1 | Checklist and baseline | Current baseline, status and release tracking. |
| 2 | Cloud accounts and recovery | Source access, private projects and pilot acceptance. |
| 3 | Resumable ingestion | Original song upload and dependable source availability. |
| 4 | Approved processing-runtime proof | Existing runtime qualification dependency; no billable operation authorized. |
| 5 | Durable processing | Recoverable source/generation/render execution. |
| 6 | Hosted uploaded-asset export | Complete-song delivery and private output acceptance. |
| 7 | Music source adapter | Existing song-to-treatment/department bindings retained. |
| 8 | Assets before generation | Approved owned reuse and rights-reviewed imports. |
| 9 | Cost indicator | Estimates, exposure, reserve, ceiling and actual charges. |
| 10 | Model-route qualification | Exact schema, task, configuration, price and output evidence. |
| 11 | Song Intelligence | Measured properties, evidence, canonical text and uncertain timing. |
| 12 | Treatment and departments | Whole-song creative plan and applicable seventeen-department package. |
| 13 | Character/reference integration | Exact approved identity, look and location versions. |
| 14 | Costed storyboard/animatic | Actual frames and full-song preview before expensive production. |
| 15 | Singing proof | Representative exact-audio performance qualification. |
| 16 | Footage/B-roll and repairs | Accepted coverage and diagnosed local correction. |
| 17 | Final editor/render | Take selection, timing, graphics, finishing and actual MP4. |
| 18 | Private pilot/release | Complete-output quality, financial, recovery and customer acceptance. |

## 15. Decisions and approvals still needed

- Review this consolidated design before implementation. The first priority, full scope, shared architecture and frozen UI are already settled.
- Qualify an approved OpenAI Director/tool-calling profile and exact image/motion/singing configurations. Model names are not permanent creative rankings.
- Resolve licensing before copying OpenMontage material. Independent work on existing code need not wait for unrelated licensing questions.
- Authorize concrete paid qualification, necessary production migrations and hosted processing when scope and cost are presented. Do not repeat broad permission requests for actions already authorized.

Minor implementation details such as internal helper names, tool wrapper boundaries and layout-fitting control placement are the builder's decisions within existing conventions. They do not authorize product redesign or changes to approval policy.

## 16. References

- [Existing eighteen-deliverable release plan](../../MUSIC_VIDEO_RELEASE_IMPLEMENTATION.md), [development tracker](../../DEVELOPMENT_TRACKER.md).
- [Model Router Intelligence Bible](../../MODEL_ROUTER_INTELLIGENCE_BIBLE.md), [Realism Intelligence Layer](../../REALISM_INTELLIGENCE_LAYER.md), [frozen UI rules](../../STUDIO_UI_IMPLEMENTATION_RULES.md).
- [Original music-video workflow attachment](/tmp/codex-remote-attachments/01a149dc-457c-7671-bcac-605675159043/B4C466EB-D0F7-44E2-8060-6D29FF59E85E/1-AI_Music_Video_Production_Workflow.md).
- [OpenMontage technical assessment](/workspace/OPENMONTAGE_DIRECTOR_STUDIO_TECHNICAL_ASSESSMENT.md), [18 November routing evidence](/workspace/DIRECTOR_ROUTING_EVIDENCE_2026-11-18.json).
- [OpenMontage inspected revision](https://github.com/OpenMontageInc/OpenMontage/tree/2e003e65fa99a0f329478a2c1cdcf26bc481933a). Reviewer/checkpoint/prompt findings are source observations, not runtime validation.

Historical project notes and newer full videos are different evidence. The recorded Samandar proof does not describe every shot in its later full-length export. Conflicting project-state/completion claims must be reconciled before using them as qualification evidence. API documentation and dated prices are discovery evidence, not authorization or demonstrated creative success.

# Storyboard handoff: shot-contract knowledge and review

Revision 1 · 19 October 2026 UTC · Point 6 implementation companion.

The handoff converts the approved brief, complete approved screenplay and all 17 current approved department plans into versioned, ordered **shot contracts**. It defines what later visual production must create, preserve and prove. It does not create storyboard pictures, audition voices, analyze a song, select a performer, render an animatic or approve generated footage.

This companion explains filmmaking knowledge and its application boundary. The [Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md) remains authoritative for model/tool routing and costs; the [Realism Intelligence Layer](REALISM_INTELLIGENCE_LAYER.md) governs photographic/performance acceptance; the [Product Experience Specification](PRODUCT_EXPERIENCE_SPEC.md) supplies the worked enforceable contract. No new competitor backend research or paid-media benchmark was performed for this document.

The runtime handoff version is `director-storyboard-handoff-v1`, defined with its bounded guidance in [storyboard-handoff-core.js](../apps/director/public/storyboard-handoff-core.js). The structured provider instructions and schema live in [storyboard-proposal.mjs](../apps/director/storyboard-proposal.mjs). Their exact reviewed content is bound into the v6 registry fingerprint; this companion is not an instruction to paste an unbounded documentation corpus into every request.

## Sources and corrections

| Source read | Applied knowledge | Evidence limit |
| --- | --- | --- |
| [Film Studio Blueprint](FILM_STUDIO_BLUEPRINT.md), §§5–8 | Whole-story direction, versioned production records, mandatory/flexible/evidence/failure conditions, intended versus observed state | Planning and version checks are not observed media quality. |
| [Product Experience Specification](PRODUCT_EXPERIENCE_SPEC.md), §10 | A wrong hand, wrong line or wrong mandatory framing fails the existing contract even when the take is attractive | The Mara/Ishan example is illustrative; no such take was generated or inspected in this pass. |
| [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md), mandatory production workflow and §14 | Complete department coverage, character/look/voice preparation, hold/move/cut, purposeful composition, shot-to-sequence continuity | Earlier catalog/model examples remain candidates, not an activation decision. |
| [Realism Intelligence Layer](REALISM_INTELLIGENCE_LAYER.md), §§5–13 | Role-labeled references, identity versus scene variation, believable anatomy/contact, motivated camera/light, audio-first speech and evidence-based repair | Prompt wording and successful provider responses cannot certify fidelity. |
| [Department Planning Knowledge](DEPARTMENT_PLANNING_KNOWLEDGE.md) | Approved whole-script facts, source provenance, off-screen narration, contextual style and exact department dependencies | A department-plan approval does not approve the images, audio or rights it discusses. |
| [Reviewed filmmaking cheat sheet](knowledge-sources/AI_Filmmaking_Master_Cheat_Sheet.md), attributed to Shailesh (@BEGINNERSBLOG), through the Bible’s corrections | Attention → trigger → reaction → end state, informative framing and meaningful cut decisions | One main beat/move is a useful starting complexity recommendation, not a universal format restriction. |
| fal storytelling [SKILL.md](skill://plugin_asdk_app_6a19d5012d308191a00a48780f7dcdcc/storytelling/SKILL.md) | Every shot has a narrative job, continuity anchors, an ending state and an editable relationship to the sequence | The skill’s endpoint suggestions are neither current schema evidence nor quality/price approval. |
| fal cinematography [SKILL.md](skill://plugin_asdk_app_6a19d5012d308191a00a48780f7dcdcc/cinematography/SKILL.md) | Concrete subject/action, framing/viewpoint, movement, focus, motivated light, reference preservation and start/end states | Lens numbers and camera names are intended treatment unless supported controls and actual outputs prove more. |

The internal rules below are newly written synthesis of those reviewed sources. They do not copy an external prompt library, assert access to a competitor’s intelligence or make a fixed premium/cheap model the default.

## Preconditions and authoritative facts

Preparation and a new paid handoff request require the current approved structured brief, source-current approved screenplay and all 17 current approved department plans. The relevant department dependency chains must be fresh. The bound source preserves explicit instructions, acknowledged inferences, source IDs, exact dialogue and department versions. It does not convert acknowledged assumptions into researched facts.

Read the entire approved story, including its ending. Determine what each scene changes and why it belongs next to the previous/next scene. A source heading or one-line user premise is insufficient context for purposeful coverage. Script-planned duration is an estimate; it is not measured dialogue, music, footage or export timing.

Use the approved departments to preserve:

- Character visibility and identity/look decisions without assuming that every script speaker appears on screen. An off-screen narrator can require voice planning while requiring no actor portrait or costume.
- Product/package/label requirements and exact approved advertising copy without inventing a brand, SKU, claim or authentic regional detail.
- Original-song/voice decisions without inventing canonical lyrics, a voice selection, beat grid, BPM, timestamps or singing capability.
- Intended scene states without promoting a previous generated defect into the new story truth.
- Required reference roles without pretending a reference image or licensed clip already exists.

Changing the underlying brief, script or any one of the 17 bound department versions marks every earlier current shot contract source-stale and requires renewed source review. This is a conservative source binding. It is not a claim of selective semantic field-by-field or scene-by-scene shot-impact inference. A focused shot-contract edit with the same source preserves neighboring contract versions/approvals; the sequence must separately review its changed version pins.

## A shot contract must direct something filmable

| Contract concern | Useful direction | Misleading substitute |
| --- | --- | --- |
| Purpose | The audience must notice the discovery before the character conceals it | “A cinematic shot” with no information or emotional job |
| Subject/action | One observable action with a readable consequence, grounded in the scene | Invented activity or several incompatible micro-actions |
| Framing/viewpoint | Medium framing at a useful camera position so the required prop interaction stays visible | Hiding a mandatory hand action in an attractive face close-up |
| Camera/focus intent | Hold for the reaction; move when attention needs to shift; identify the focus priority | A random orbit, conflicting optics or a numerical promise that the renderer simulates an exact lens |
| Lighting/world | A motivated window/practical/environmental source consistent with adjacent coverage | “8K hyper-real masterpiece” replacing a coherent light and material plan |
| Start/end state | State what is known, held, visible and changed where the source establishes it | Fabricated coordinates, prop hands, character knowledge or observed media facts |
| Continuity | Preserve identity, wardrobe/condition, prop ownership, eyelines, screen direction and world state where relevant | Reusing the same seed as proof of identity or spatial consistency |
| References | Specify whether an identity, look, location, product, composition or material reference is required and why | Treating a style photo as actor identity, or a requirement as a selected asset |
| Acceptance | List the actual visual/audio/playback evidence required and what makes the shot fail | Passing a take because its API status is complete or its image is attractive |

The sequence supplies the reason to hold, move or cut. Do not force every project through a rapid-cut template, one focal length, a fixed palette, mandatory shallow focus, continuous music or an imagined platform attention formula. A quiet observational frame can be the right choice; an expressive camera move can also be right when the source and supported route justify it.

Camera position determines perspective. Focal length and sensor/framing affect field of view; wording alone does not certify optical simulation. Rack focus is not camera translation; zoom is not a dolly. Define actor and camera motion separately. Numerical trajectories require a suitable control/reference route and later observed proof.

## Typed contract boundary

The model proposal contains only ordered `{id, document}` shot entries. The typed document carries `sceneId`, title, purpose, action, existing `characterIds` and `dialogueIds`, estimated duration, framing/camera/lighting intent, start/end state, continuity, requirements, reference requirements, control classifications, audio cues and a proposed performance path. Snapshot/source versions, approval flags, dependency pins, observations, media IDs and provenance are not model-supplied document fields.

Coverage must include every source scene and assign every source dialogue ID exactly once in its actual scene. Speaker IDs associated with those lines remain in the shot’s character associations; this does not make an off-screen speaker visible. Dialogue IDs refer to the authoritative screenplay wording. The model does not supply a replacement transcript, translation or paraphrase as a new spoken line.

Each requirement has a stable ID, requirement text, `mandatory` or `flexible` priority, future acceptance evidence and a failure condition. Reference requirements name a role—identity, look, location, product, composition, lighting or performance—and source-character associations where applicable. They request reference work without binding or inventing assets. Audio cues distinguish dialogue, music, ambience, effects and silence. The proposed performance path may be `silent_or_ambient`, `audio_first`, `joint_av` or `unresolved`; it does not certify a working lip-sync/singing route or select a voice.

## Mandatory requirements, permitted variation and execution intent

Mandatory requirements are acceptance conditions, not guarantees of generation control. If the approved contract requires an envelope in the left hand, exact wording or a medium frame, a take that violates it fails that contract. Do not soften a hard requirement after generation merely because the alternative looks good. An explicit creative contract revision is a separate user decision.

Permitted variation describes genuinely flexible detail, such as noncritical background movement. It cannot negate a protected identity/product/action/dialogue constraint. If a mandatory event cannot be executed by an eligible route, record a hold or a disclosed alternative before authorizing a paid attempt.

The current contract deliberately uses three control classifications:

1. **`prompt_only`:** descriptive visual/performance intent, without a guarantee of execution.
2. **`reference_required`:** the requirement needs a suitable approved reference/conditioning input; the handoff does not claim that input exists or has been selected.
3. **`route_verification_required`:** endpoint support or execution feasibility must be checked before production. This includes known unsupported mandatory requirements that need a hold or an explicitly accepted alternative.

A later execution binding must distinguish a genuinely exposed endpoint parameter from prompt intent and reference/blockout conditioning. This planning contract does not claim `native_verified` controls or invent provider parameters. A requested focal length, camera trajectory or performance label is not proof of capability.

This handoff records intended direction and requirements for later binding. It does not choose an endpoint, invent parameters, grant permissions or claim that the reference/media already satisfies the contract. Observations remain unverified until actual outputs are inspected. A correct JSON document proves structure and bounded references, not realism or instruction-following.

## Conservative free preparation and richer reasoning

Free preparation copies the approved scene action and exact dialogue associations and supplies explicit starting notes for purpose, framing, camera, lighting and continuity, pointing back to the approved department plans. These reversible rule notes are a baseline, not semantic creative direction by an LLM. One contract per scene is not a judgement that every scene needs exactly one shot or that the film is sufficiently covered. The paid planner or manual review supplies richer purposeful coverage while preserving the source and version rules.

The handoff contract accepts an estimated duration no greater than 900 seconds per shot. This is a data-contract boundary, not a recommended shot length, endpoint capability or claim that a model can generate a fifteen-minute take. A scene exceeding that bound needs a visible split/replanning hold. Do not silently clamp its duration, omit its ending or pretend one endpoint can fulfill it. Actual media routes impose their own reviewed duration and input limits later.

Do not infer human appearance, accent or screen visibility from names, nationality or dialogue membership. Where an approved source leaves staging, geometry, identity or reference detail unspecified, use a clearly proposed choice or a consequential hold. Preserve actual approved department constraints rather than manufacturing a generic fallback.

Paid `plan_storyboard` reasoning uses registry task `storyboard_planning` and a separately reviewed `director-planning-v6` contract, with its own route preview, exact spending allowance and bounded reservation. Writing or department-planning eligibility does not confer this operation. The model returns shot-plan proposals; the server retains source/version/approval authority and protects approved current contracts. A completed saved project-owned proposal must be explicitly applied. Saving a manual change or pressing preparation/review does not start that paid call.

Known v3, v4 and v5 paid requests retain their saved retrieval/recovery contracts. A new storyboard operation must not reinterpret them under its own schema, switch their model or charge a hidden retry. Complete source/request bounds remain enforced; oversize context is held rather than silently dropping approved decisions.

## Versioned shots, sequence review and existing editing

Shot contracts have independent histories. The sequence records the ordered exact shot versions it contains, so an order change or a changed contract cannot silently inherit the earlier sequence approval. A source change preserves old contracts and media; it does not erase or regenerate them.

Model proposals preserve all existing active shot IDs and their relative order. Source-fresh approved shot documents remain exact. Extra coverage can be proposed only within the source/coverage and existing-order protections; reordering existing shots requires explicit manual intent. An effectively approved sequence blocks a new paid planning call until its review is reopened by an explicit edit/order change; an older saved result cannot silently alter its protected quantity/order. These rules protect accepted decisions rather than using a new call as an undeclared rewrite.

The review checkpoint concerns current shot contracts and their ordered sequence together. It remains explicitly planning-only. A sequence-plan approval does not approve a character identity image, look sheet, voice take, storyboard frame, playable animatic, selected video take, rights declaration, factual claim or spending.

The existing flat shot workspace is a projection of managed contract fields: title, action→description, estimated duration, framing, camera, joined mandatory requirements→constraints, source scene, exact source-linked dialogue text and continuity. Lighting and other richer direction remain in the typed document. Existing media IDs, reference IDs, production bindings and other separate editing/reference controls are preserved. Updating a contract does not invent a new selection; legacy media association does not supply missing frame or production approval evidence. Source/version checks and guarded persistence prevent a stale flat edit or proposal from silently bypassing contract review.

Existing flat shots must first pass free adoption before a new model handoff can replace their managed workspace. Adoption preserves their IDs, order, direction, constraints and media. A missing/unassigned scene, ambiguous/changed dialogue or duplicate source-line coverage produces an explicit repair hold; the old draft and media remain intact. Missing legacy constraints, action or continuity are not secretly replaced with approved creative decisions: planning approval is held until action/continuity and at least one mandatory requirement are reviewed. Additional baseline contracts cover only missing source coverage.

For an already prepared archive, `prepare` adds only missing current-scene/dialogue coverage and records a new unapproved sequence version. Existing contract documents, versions, media and relative order remain exact. It is a no-op when no source coverage is missing; changed sequence pins still require explicit `review_sequence`. Old contracts referring to changed or removed source remain visible and held for repair. A partially repaired stale-source draft can be saved, while full source/coverage checks remain mandatory for new model acceptance and planning approval. Preparation cannot erase awkward coverage or label an old decision reviewed merely to make the project appear current.

The checkpoint is `storyboard_sequence` at its current sequence version. Its atomic approval writes that decision together with `shot_contract:<id>` decisions for the exact current contracts. Individual contract approvals cannot bypass the complete sequence review. The explicit acknowledgement is planning-only; source/department freshness, full scene/dialogue coverage, exact version pins, complete requirements and the managed workspace projection must all agree.

## Three source-grounded planning examples

These are illustrative requirements, not real generated projects or evidence that any image, song, voice, claim or performer was inspected.

### Cooking-oil advertisement for India

Assume the approved source calls for preparation → oil pour → plated meal beside a supplied product, with no approved health/comparative claim and no selected demographic appearance. A useful coverage proposal makes the pour and product identifiable, keeps hand/vessel/liquid contact visible, preserves the approved package and label and relates the finished meal to that cooking action. The kitchen’s specific regional styling stays unresolved unless the source establishes it.

Required reference tasks include the actual approved product asset, any applicable visible-character identity/look and the necessary kitchen/material context. Exact labels/copy should use approved deterministic graphics where appropriate. Mandatory failures include the wrong label/SKU, an invented health claim, impossible liquid flow/contact or omission of the specified pour. Framing and lighting must expose those requirements rather than hide them. No identity, product-reference availability, native product-control parameter or generated realism is inferred from this plan.

### Two-minute Hinglish music video with original audio

Assume the approved brief says to preserve the uploaded original vocals and gives a rough two-minute runtime, while lyrics/structure/alignment have not been verified in this example. The handoff can propose visual narrative, recurring locations, a performance requirement and an editorial purpose per scene. It cannot assert beat-aligned cuts, measured vocal timing, canonical lyrics, BPM or song sections without actual analysis/review evidence.

A duration estimate is labelled as such. Plan authoritative-song and canonical-lyric review, preserve original performance and require a singing-validated route only where a visible singing shot is actually intended. The future animatic must use the actual master and reviewed timing. Do not replace the voice, time-stretch the song or invent a generic speech model’s singing ability to fit a proposed visual.

### Indian-wealth documentary with off-screen narration

Assume the source is a research-led pilot with an off-screen narrator, no on-screen host and no approved economic statistics or archival footage. A shot can present an approved research question or an evidential object/location once verified. It must not invent interviews, property ownership, licensed archival assets, wealth statistics, causal explanations or authentic labels.

The narrator’s character ID associates the spoken line with the story. It does not mandate a visible actor portrait, costume, identity master or lip-sync performance. Voice casting/listening and exact factual-script review remain applicable. Required holds include unverified factual/claim sources, unselected/unlicensed footage and unresolved technical delivery. A beautiful mansion/car montage is not evidence about the documentary’s thesis.

## Release boundary

The implementation can validate typed contracts, source IDs, version pins, order, protected decisions, explicit application and approval boundaries. Actual storyboard-frame generation remains F038 work; playable timed animatic production remains F040 work. Ordered plan review advances part of F039 but does not complete take selection/comparison or generated-media review.

No visual/voice/song evaluation, physical mobile test, competitor-intelligence inspection, two-attempt success rate or finished-film result is established by this document. The root acceptance record supplies the final automated, local-browser and native-database evidence for the implemented contract; those checks must remain distinct from real filmmaking quality and media delivery.

Large-plan operational behavior needs separate validation: the isolated WASM scale proof took 25.264 seconds for a 200-shot bulk approval, exceeding the application adapter’s 20-second timeout. This is neither a native latency measurement nor evidence of reliable timeout recovery. The caller must not infer approval failed and blindly repeat it; the exact saved project/sequence/approval state needs reconciliation. Native latency, concurrent sessions and timeout/recovery acceptance remain release work.

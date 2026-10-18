# Film Studio — Realism Intelligence Layer

Revision 2 · 17 October 2026 UTC · Detailed planning specification

## 1. Purpose, authority and honest status

The studio should translate a user's intention into believable filmed people, places, performances and sound. Photographic realism must survive the entire sequence: casting, dialogue, movement, wardrobe, weather, camera, lighting, editing and voice. A realistic face in an inconsistent film does not meet the goal.

This document defines the intelligence that sits between the user's brief and the model adapters. It supplies production rules, original reusable prompt templates, routing requirements, quality gates and recovery policies. It is the realism companion to the [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md), which controls endpoint records, dated costs and overall workflows. This document controls realism-specific requirements; discrepancies must be resolved before a production run.

**Status:** a specification, not an implemented or validated system. No paid generations, character comparisons, listening tests or rendered-film evaluations were performed for this document. Public product documentation supplies evidence of advertised workflows, not access to competitors' internal prompts, model weights or quality systems. Every route below remains a candidate until tested.

The customer's ambition is acceptance within two attempts. We can enforce an attempt limit and design to improve success. We cannot honestly guarantee that every model will satisfy every requested scene in two attempts. On failure, the studio must stop, explain the problem and offer a decision rather than conceal poor quality or continue charging.

## 2. What the user should experience

A user can start with one box: “Make a 45-second realistic film about a father waiting outside a hospital at dawn. Quiet, hopeful, in Hindi.” The studio interprets that request, shows a concise interpretation and a production estimate, and asks only about consequential missing information.

The system then prepares a story, continuity plan, cast and voice direction, shot plan, reference assets, performances and edit. The user sees meaningful checkpoints rather than a list of endpoint names. They can say “less polished,” “older voice,” or “he should be trying not to cry.” The system translates those statements into specific, scoped changes.

Expected checkpoints are:

1. **Direction:** story, intended duration, delivery format, realism style and spending boundary.
2. **Casting and performance proof:** the necessary character reference and a short representative voice/performance sample. Reuse existing approved assets when suitable.
3. **Sequence proof:** enough connected material to judge continuity, pacing and the chosen look before committing the remaining budget.
4. **Final review:** the actual assembled film, including sound and export properties.

Checkpoints may be combined for a short, low-risk request. They must not become a disguised requirement to buy many variations. User-approved scripts, identity references and voices become versioned constraints.

## 3. The intelligence pipeline

| Component | Its responsibility | Required output |
| --- | --- | --- |
| Intent compiler | Understand what success means in the user's words | Deliverable contract and unresolved questions |
| Creative director | Turn intention into a coherent treatment | Story, emotional arc and production profile |
| Casting director | Define a distinct, appropriate person | Character contract and reference strategy |
| Production designer | Make the world specific and coherent | Location, props, wardrobe and material rules |
| Cinematographer | Make the scene photographically plausible | Shot, lens intent, light sources and camera behavior |
| Performance director | Connect character intention to behavior | Action, attention, restraint and emotional progression |
| Voice director | Connect words, speaker and delivery | Voice contract, pronunciation and approved audio |
| Continuity supervisor | Track what must persist or change | Time-indexed scene state and identity references |
| Router and adapters | Select a compatible, verified route | Schema-valid request and explicit capability gaps |
| Quality reviewer | Inspect the actual output | Evidence, defects and acceptance decision |
| Recovery controller | Make one justified correction | Scoped repair or a stop decision |

These are responsibilities, not a requirement for eleven independent autonomous agents or eleven LLM calls. Combine work where appropriate. Keep contracts and evidence separate so one fluent model response cannot declare its own output correct.

A reasoning model proposes plans and structured contracts. The application validates required fields, supported controls, budgets and dependencies. Media models generate assets. Deterministic tools measure properties they can actually measure. Creative reviewers judge the visible and audible result. No layer should claim another layer's checks were completed without evidence.

### Required visible preproduction gates — 18 October 2026 correction

Photographic realism and believable voice begin with explicit user choices: character selection/identity master → look, wardrobe and world references → representative voice auditions (or an approved original-song/silent-workflow decision) → approved storyboard frames → a playable timed animatic. The storyboard must demonstrate composition, continuity and intended action; the animatic must demonstrate pacing and measured audiovisual timing. Neither is replaced by a text shot list or an endpoint recommendation.

Approve each artifact/version before the expensive work that depends on it. Revisions trigger scoped downstream review while preserving accepted media. Count audition/casting/storyboard candidates and preparation costs in project quality/cost reporting. Reusing approved references or original song audio is a recorded choice; it is not an omitted department. These gates are requirements, not currently proven runtime functionality. See the Bible's mandatory department workflow correction.

## 4. The expectation contract

Before spending, compile the request into these fields:

- **Product:** film, music video, talking avatar, B-roll sequence, commercial or another explicit format.
- **Quantity:** number of finished outputs, scenes, characters and variants; distinguish final deliverables from intermediate assets.
- **Technical delivery:** target duration and permitted tolerance, aspect ratio, export resolution, frame rate, audio channels, subtitles and file format.
- **Creative target:** audience, emotional effect, genre, pacing, photographic or stylized look, and reference priorities.
- **People:** identity source, apparent age, role, language, wardrobe and any user-specified appearance requirements.
- **Performance:** intention, relationship, subtext, speech style, physical action and emotional limits.
- **Non-negotiables:** exact dialogue, brand details, identity, approved music timing, required props and prohibited alterations.
- **Flexibility:** where the director may simplify camera movement, cut around an action, or choose a different composition.
- **Economics:** estimate, reserved finishing cost, attempt policy and the next spending checkpoint.
- **Evidence:** what must be watched, heard, measured or manually reviewed before acceptance.

If a user requests “hyper-real,” clarify through the proposed direction whether they mean convincing photography, highly detailed close-ups, documentary texture or deliberate exaggeration. Default to believable photography. Do not add grime, wrinkles, sweat or tiredness merely to prove realism.

Do not infer accent, personality, occupation, class or cultural behavior from skin tone or nationality. A clean commercial portrait, an older face, a person wearing makeup and a documentary subject can all be realistic.

### Example structured contract

This is an illustrative plan, not a completed assessment or a provider payload.

```json
{
  "contract_version": "realism-v1",
  "project_type": "short_film",
  "deliverable": {
    "count": 1,
    "target_seconds": 45,
    "duration_tolerance_seconds": 1,
    "aspect_ratio": "16:9",
    "export_resolution": "1920x1080"
  },
  "look": {
    "mode": "photographic",
    "intent": "restrained dawn drama",
    "avoid": ["waxy skin", "unmotivated glow", "beauty-filter smoothing"]
  },
  "character": {
    "id": "father_01",
    "identity_reference_version": null,
    "immutable": ["facial proportions", "hairline", "established distinguishing marks"],
    "scene_variables": ["expression", "pose", "lighting", "wardrobe state"]
  },
  "audio": {
    "language": "Hindi",
    "exact_dialogue_required": true,
    "voice_reference_version": null,
    "retiming_allowed": false
  },
  "attempts": {
    "maximum_generation_rounds_per_work_unit": 2,
    "hidden_variants_allowed": false
  },
  "acceptance": {
    "requires_actual_playback": true,
    "identity_review": "pending",
    "voice_review": "pending",
    "temporal_review": "pending"
  }
}
```

Application validation must reject contradictory contracts, such as an immutable dry costume and an explicitly rain-soaked later scene without a state transition.

## 5. Casting: a person before a scene

### Character identity contract

Describe an individual with a story role and an identifiable appearance, rather than a generic “beautiful cinematic actor.” Record facial proportions, hairline, eye appearance, body proportions, distinguishing details and the approved reference asset. Avoid unnecessary exact measurements the selected model cannot honor.

Separate three categories:

| Category | Examples | Policy |
| --- | --- | --- |
| Identity invariants | Established facial structure, hairline, distinguishing mark | Preserve unless the user approves a new identity version |
| Controlled continuity | Hairstyle, grooming, costume, jewelry, injury, makeup | Change only through the scene state |
| Performance variables | Expression, gaze, posture, breathing, movement | Change according to the shot and emotional progression |

Lighting changes can alter perceived skin color without changing identity. Reviewers must distinguish exposure and white balance from an actual identity error. Do not demand pixel equality between different angles.

### Identity master

Create or select a clean reference with inspectable facial features, appropriate focus, plausible skin response and uncomplicated lighting. A neutral chest-up or waist-up three-quarter view is often useful. Choose framing for the actual use: hands need inspection when they will matter, not in every face close-up.

The identity master establishes the person; it is not necessarily the hero frame of the movie. Avoid dramatic color casts, heavy occlusion or shallow focus that hide casting defects. Reject visible anatomy and eye problems before using the image as a reference.

Derive only the views needed for the production from that master. Compare every new view back to the original approved reference, not only the previous generation. Otherwise, small changes can accumulate across iterations.

For an existing person's supplied image, preserve their identity according to their permitted use. For an original character, establish a distinct identity. Do not silently substitute a famous person's likeness or imitate an identifiable person's voice.

### Reference pack

Each reference has a role: identity, wardrobe, location, composition, material or style. Label these roles in the internal contract and use only the roles the endpoint can accept. A style photograph must not accidentally become the actor's face. Conflicting references require resolution before generation.

Store reference provenance, asset version, approval status and permitted use. Private user references require access controls and appropriate retention. Saving a reference is not permission to reuse it for another customer's film.

## 6. Human appearance and material realism

The desired result is a believable person photographed in the intended conditions.

**Skin:** retain natural variation appropriate to framing, age, lighting and makeup. Avoid waxy smoothing, repeated pore patterns, metallic specular response, over-sharpened pores and uniform artificial glow. Do not force blemishes onto every person.

**Eyes:** plausible eye direction, eyelids, reflections and eye moisture; stable iris appearance; no vacant fixed stare or independently wandering eyes. Catchlights should make sense for the lighting setup, without requiring identical reflections in every frame.

**Hair:** believable hairline, strand grouping, volume and occlusion. Avoid fused hair edges, crawling textures and hair moving independently of the person's motion or wind.

**Mouth and teeth:** plausible dental appearance, stable lip boundaries and no melting teeth during speech. Natural teeth need not resemble a cosmetic advertisement.

**Hands and body:** coherent visible anatomy, grips, joint bends, weight distribution and contact. Inspect only what is visible, but do not hide a required hand action to make a failed shot pass.

**Wardrobe:** material-appropriate folds, stitching, fasteners and weight. A wet sleeve behaves differently from a dry one. Jewelry, glasses and accessories should remain attached and consistent through movement.

**Contact:** feet should meet the ground, fingers should contact objects, seated bodies should load the seat, and objects should cast plausible contact shadows. Physical interaction is often more revealing than face detail.

**Polish:** professional grooming and intentional beauty lighting are allowed when requested. The objective is believable craft, not mandatory roughness.

Enhancement and upscaling cannot be used as proof that anatomy, identity or performance was repaired. Inspect again after processing because an enhancer may change the very details the customer approved.

## 7. World, B-roll and production design

B-roll must contribute information, atmosphere, geography or emotional rhythm. It must not become a collection of unrelated attractive stock-like clips.

For each shot, specify its editorial purpose, physical place, time, subject, action and connection to the neighboring shots. Record weather, light direction, wardrobe state, recurring props, architecture and relevant cultural details. Research or ask when a meaningful local detail is unknown; do not invent signage, uniforms or rituals and present them as authentic.

A hospital exterior should have coherent entrances, believable activity and location-appropriate details. A coffee pour needs plausible liquid flow, vessel contact and changing fill level. A road shot needs consistent travel direction and credible traffic behavior. A rain scene needs agreement among wet surfaces, costume, precipitation and sound.

For difficult actions, the director may propose a simpler staging or an editorial alternative. That is an explicit creative choice, not permission to omit an essential requested event. If the requested product requires readable signage, generate a suitable clean surface and add approved text through a deterministic graphics/compositing step where possible. Avoid accidental pseudo-text.

If authentic supplied or licensed footage would serve the brief better, the plan may propose it with provenance and compatibility checks. Never assume a web image or clip is licensed for use.

## 8. Cinematography and temporal behavior

A prompt should describe a filmable situation: subject, action, framing, camera behavior, light source, environment, texture and essential constraints. “Cinematic, 8K, masterpiece, hyper-real” is not a shot plan.

Define where the camera is, what it observes and why it moves. Lens terminology supplies visual intent; it does not prove the generator simulates exact optics. Use plausible perspective and depth of field. Do not prescribe conflicting cues such as an extreme wide-angle face perspective and compressed telephoto proportions in the same setup.

Light should have a plausible source: dawn through a doorway, an overhead practical, a window or a deliberate studio setup. Deliberately stylized lighting is valid when requested. Keep adjacent coverage consistent with the established production profile.

Temporal requirements include:

- Stable identity, wardrobe, props and background geometry through the shot.
- Plausible acceleration, stopping, balance, contact and object persistence.
- Eye lines that agree with the scene's geography.
- Breathing and facial movement that support the performance rather than random twitching.
- No unwanted face morphing, texture crawling, liquid clothing or duplicated objects.
- Camera movement that does not accidentally distort the person or space.

Plan the beginning and ending state of each clip. Review the entire clip at normal speed and inspect suspicious moments. Sampled frames alone cannot establish believable motion or lip sync. Slow motion inspection is a diagnostic aid, not a substitute for normal-speed acceptance.

Split complex scenes at sensible editorial boundaries only when the result still fulfills the brief. A succession of short disconnected clips is not automatically a coherent movie.

## 9. Voice, dialogue and emotional truth

Voice realism is a performance problem as well as an audio-quality problem.

The voice contract records speaker identity, language, accent if specified, pronunciation, conversational register, intended listener, intention, emotional progression and the approved take. Voice selection must be based on listening, not a name or assumed demographic match.

Direct a performable intention: “Trying to reassure his daughter while concealing his own fear.” This is more useful than stacking labels such as “sad, cinematic, emotional, realistic.” Preserve restraint where requested. Avoid constant whispering, exaggerated breathiness, theatrical crying on every word or a generic advertisement cadence.

For speech-led scenes:

1. Approve the text and pronunciation requirements.
2. Select an appropriate voice and produce a representative take within the agreed spending policy.
3. Listen for words, naturalness, emotion, accent and artifacts.
4. Measure actual duration, pauses and the timing information the service actually returns.
5. Drive the visible performance from approved audio where the route supports it.
6. Inspect the resulting audio and video together.

The planner's delivery notes must not be spoken as dialogue. Only approved words and supported non-spoken controls should enter the speech request. Do not invent pitch, pace, breath or emotion API fields. If a selected model lacks a control, express the requirement through a verified mechanism or mark it unsupported.

For jointly generated audio/video, inspect the actual spoken words and delivery against the same contract. Do not assume a text prompt guarantees exact dialogue.

### Singing and music videos

Speech synthesis and speech lip-sync capability do not establish singing capability. Singing requires separate validation of pitch, sustained vowels, phrasing, consonants and musical timing. Preserve the approved song's tempo and structure unless the user authorizes a change. Any lip-sync route must be tested on the actual singing use case before it is advertised for that purpose.

Transcription or forced alignment can be wrong on sung lyrics. Compare against canonical user-approved lyrics and mark uncertain alignment. Beat/onset analysis, lyric meaning and emotional interpretation are different tasks; none substitutes for the others.

## 10. Model routing and adapter precautions

The existing M identifiers refer to the controlling Bible. They are candidate routes, not quality endorsements.

| Task | Candidate | Realism-specific limitation or gate |
| --- | --- | --- |
| Treatment, screenplay, shot contracts | Direct OpenAI reasoning route | Structured plans need application validation; no invented direct audio/video analysis capability |
| Fast visual drafts | M18 `fal-ai/z-image/turbo` | No reference-image input in inspected schema; do not promote automatically to final identity casting |
| Reference-based image work | M09 `bytedance/seedream/v5/pro/edit` | Preserve reference roles; reject more than 10 images instead of silently losing earlier references |
| Reference-driven video | M17 `minimax/h3-max/reference-to-video` | Enforce actual reference limits and required prompt-expansion mode; actual duration can overrun |
| Audio-driven portrait performance | M10 `veed/fabric-1.0` | Candidate talking-performance route; validate identity, delivery and resolution, singing not established |
| Speech | M19 `elevenlabs/tts/eleven-v4` | Validate voice availability/language and supported tags; no assumed speed parameter |
| Lip-sync adjustment | M20 `fal-ai/sync-lipsync/react-1` | Inputs limited to 15 seconds; default bounce behavior must not silently alter the approved performance |
| Video edit | M13 Kling video-to-video edit | Editing may alter accepted identity, action or sound; inspect preserved properties again |
| Upscale | M14 ByteDance video upscaler | Check identity, temporal artifacts, timing, audio and configuration-specific cost |
| Voice cloning | M16 MiniMax voice clone | Consent, permitted use, lifecycle and downstream compatibility unresolved; not production-ready |

**Premium casting gap:** `openai/gpt-image-2.5/sunburst/text-to-image` was discovered in the live fal catalog as a possible premium image candidate. Its schema was subsequently inspected in revision 2; account execution, pricing configuration and photographic-human quality remain unverified. It must not be treated as an approved replacement or silently added as a production default. Reference-edit suitability requires its own verified route.

A recommendation service once returned a video route for an image-casting request without fit checks. The policy is therefore explicit: reject a recommendation whose output type or required controls do not match the task, regardless of its ranking or confident explanation.

### Adapter rules

- Refresh endpoint availability, schema and configuration-specific price before approval and release.
- Translate the creative contract into controls the selected schema actually supports.
- Do not pass invented `negative_prompt`, `seed`, `reference_strength`, `focal_length` or voice-control fields.
- Put exclusions in an appropriate supported instruction field when needed; they are guidance, not guaranteed enforcement.
- Disable unwanted automatic prompt expansion only through a supported setting; otherwise flag the behavior and assess its risk.
- Explicitly resolve lip-sync duration mismatch. Do not silently loop, bounce, truncate or remap approved audio to fit video.
- Use the smallest appropriate edit scope. A lips-only operation may better preserve approved acting than a full-head rewrite, but must still be evaluated.
- Validate reference count, type, duration, access and retention before submission.
- Record effective payload, endpoint/schema version, price observation and approved asset versions, with secrets redacted.

## 11. Original reusable prompt library

These templates are original application instructions informed by production principles and public workflow documentation. They are not recovered competitor prompts. Resolve placeholders before use. Keep internal planning instructions separate from provider payloads.

### P01 — Realism director system instruction

> Translate the approved brief into a filmable production plan. Preserve the user's intended style, story, quantity, duration, language and non-negotiables. When photographic realism is requested, direct believable people in a coherent physical world. Specify observable actions, motivated light, material behavior, continuity and emotionally credible delivery. Separate identity invariants from scene changes. Do not replace specific direction with superlatives. Do not invent cultural facts, provider controls, review evidence or completed checks. Identify unknowns that materially affect the result. Use only approved references and eligible routes. Return a structured plan, its assumptions, required evidence and capability gaps. Respect the attempt and spending limits.

### P02 — Brief compiler

> Extract the requested final product, output count, duration, format, audience, emotional goal, realism style, characters, language, exact wording requirements and references from {{user_request}}. Mark each field as explicit, proposed or unresolved. List only consequential questions. Explain the proposed direction in plain English. Identify any conflict between the reference style and requested behavior. Do not quietly simplify an essential requirement. Return mandatory constraints, permitted variations and acceptance evidence.

### P03 — Original character casting master

> Create a photographic casting reference of {{character_description}}, an original individual whose presence suits {{story_role}}. Use {{framing_and_view}} with enough focus to inspect the relevant features. The person has {{approved_distinctive_traits}} and wears {{wardrobe}}. Use {{simple_motivated_lighting}} against {{uncomplicated_environment}}. Show believable skin response, natural facial variation, plausible eyes and hair, and physically coherent visible anatomy. Preserve the intended grooming and makeup. Expression: {{neutral_or_restrained_expression}}. Avoid beauty-filter smoothing, waxy highlights and synthetic over-sharpening. No decorative typography or invented labels.

### P04 — Reference-based scene or angle

> Reference {{identity_reference}} defines the person's identity. Reference {{wardrobe_reference}} defines the costume only. Reference {{location_reference}} defines the location only. Preserve {{identity_invariants}}. Change only {{approved_scene_changes}}. Photograph the person {{action_and_position}}, using {{shot_and_camera_intent}} and {{motivated_light}}. Maintain {{continuity_state}}. Ensure {{visible_contact_or_anatomy_requirements}}. The desired result is {{specific_photographic_look}}, not an illustration. Do not copy unrelated people or objects from style references.

Only include reference-role sentences that correspond to actual supplied inputs. Do not name nonexistent images.

### P05 — Purposeful B-roll

> Editorial purpose: {{what_this_shot_communicates}}. Show {{subject}} at {{specific_place_and_time}}, doing {{single_clear_action}}. Maintain {{world_state_and_geography}} from the surrounding scene. Camera: {{framing_and_movement}}. Light: {{physical_source_and_quality}}. Materials and contact: {{relevant_physics}}. Begin with {{start_state}} and end with {{end_state}}. Preserve {{required_detail}}. No unrelated spectacle, accidental pseudo-text or additional story events.

### P06 — Video performance

> Use the approved reference to preserve {{character_identity}} and {{wardrobe_state}}. During this shot, {{performable_action}}. The character wants {{intention}} and responds to {{listener_or_event}} with {{restrained_visible_behavior}}. Attention and gaze follow {{eyeline}}. Camera {{camera_behavior}}. Lighting and environment remain {{established_state}}. Movement should have plausible weight, contact and timing. Begin {{start_state}}; end {{end_state}}. Preserve {{required_objects_and_relationships}} throughout.

Do not force blinking, breathing or gestures at arbitrary intervals. Naturalness depends on the situation, not the number of movements.

### P07 — Voice direction for the planner

> Speaker: {{approved_voice_identity}}. Language and pronunciation: {{language_and_pronunciation}}. Listener: {{relationship}}. Intention: {{what_the_speaker_is_trying_to_do}}. Subtext: {{what_is_unspoken}}. Delivery: {{register_restraint_and_emotional_progression}}. Preserve the exact approved words. Propose only controls supported by the selected endpoint. Keep direction outside spoken text unless a verified non-spoken tag is intentionally used. Flag any requirement that cannot be represented. Do not time-stretch the approved take without permission.

### P08 — Evidence-based critic

> Review {{actual_asset}} against {{approved_contract}} and {{approved_references}}. Report only properties you can inspect with the available modality and tools. For each defect, give the visible or audible evidence, timestamp or region when applicable, severity, violated constraint and confidence limits. Distinguish an absent check from a passed check. Do not infer motion quality from still images or voice naturalness from a transcript. Return accept, repair or hold, plus the smallest justified correction. Do not invent numerical quality scores or claim certainty about unobserved frames.

### P09 — Correction planner

> Attempt one failed because {{observed_defect_and_evidence}}. Preserve {{accepted_properties_and_versions}}. The second and final generation round may change only {{permitted_controls}}. Explain why this change addresses the defect using verified capabilities. State what could regress and what must be reviewed again. If no plausible correction exists within the remaining budget and capability limits, return hold rather than repeat the same request with more adjectives.

### P10 — Customer-facing explanation after a hold

> Explain what succeeded, what did not meet the agreed brief and why acceptance is being withheld. State the actual attempt count and known charges without implying a refund has occurred. Offer relevant choices: retain accepted work, revise a specific requirement, request a manually reviewed alternative, or stop. Do not describe a failed asset as ready or trigger another paid generation.

## 12. Quality gates: observable acceptance

A quality gate needs an asset, a relevant contract, an observation method and a decision. “The model says it looks good” is insufficient.

| Gate | Required evidence | Typical blocking defect |
| --- | --- | --- |
| Deliverable completeness | Manifest, actual file properties and playback | Missing scene, wrong number of outputs, invalid export |
| Identity | Comparison to approved master across relevant views and time | Different person, changing defining features |
| Human appearance | Visible face/body/material inspection | Broken anatomy, melting teeth, waxy face outside brief |
| Physical interaction | Full-motion review of relevant action | Floating prop, implausible grip, lost contact |
| Continuity | Scene-state comparison and adjacent-shot playback | Wrong prop hand, unexplained costume or weather change |
| Performance | Actual picture and sound against direction | Wrong intention, distracting random movement |
| Dialogue | Listening and transcript comparison | Missing or altered required words, wrong language |
| Voice | Listening at normal playback speed | Unnatural delivery, pronunciation errors, unsuitable approved identity |
| Lip sync | Actual audio/video playback and diagnostic timing | Persistent perceptual mismatch, altered approved audio |
| Music fidelity | Canonical song and assembled timeline | Unauthorized tempo, lyric or structural change |
| Photographic coherence | Sequence-level look comparison | Unmotivated lighting/perspective or inconsistent visual treatment |
| Technical finish | Decode, duration, frame/audio checks and final playback | Clipping, bad joins, missing sound, black/frozen frames |

Severity classes:

- **Blocking:** violates a mandatory requirement or makes the result visibly unusable.
- **Material:** undermines the intended quality or emotion and requires a review decision.
- **Minor:** does not compromise the agreed outcome; record it rather than trigger uncontrolled polishing.

There is no universal “90% realistic” threshold. Numerical measures may support calibrated tasks, but they do not replace creative acceptance. A missing reviewer, unavailable playback or unsupported evaluator produces **hold**, not an automatic pass.

An image-capable reasoning model may assist with still-frame review. It cannot establish temporal realism or natural voice delivery without the necessary input capabilities. An optional audio/video analysis provider requires its own approved data route. Until suitable evaluation is operational, explicit human listening and playback remain necessary.

## 13. Two-attempt control and intelligent repair

### Define the unit before generation

A work unit is a customer-relevant asset with a stable purpose: one casting master, one voice take, one shot or one specified repair. Attempt one is the initial generation round; attempt two is one diagnosed correction. Default to one candidate per round.

If the user explicitly approves a batch, disclose its size and price. Every generated candidate remains visible in the ledger; do not call ten variants “one try” to claim two-try performance. Track both rounds and candidate counts. The two-round policy for a shot is not a promise that a whole film requires only two provider calls: a film contains references, voice, shots and finishing operations.

Changing endpoint, duplicating a job or splitting identifiers must not reset the logical attempt count. Reusing an accepted asset does not consume a new creative attempt. A deterministic render is a finishing operation, but its cost and failures still count in the project ledger.

### Before attempt one

Validate feasibility, references, schema, exact required text, selected voice, timing plan and budget. Reserve expected generation cost and a protected finishing allowance. If the request depends on an unverified capability, do not spend as though it were supported.

### Between attempts

Inspect the actual result. Identify whether the failure concerns identity, reference ambiguity, action complexity, performance, unsupported controls, source audio, timing, editing or technical delivery. Preserve everything already accepted. Choose a targeted prompt change, corrected reference, supported setting or genuinely better-suited eligible route.

A route switch consumes the same second attempt. Repeating the initial prompt with “more realistic” is not a diagnosis. If the defect cannot plausibly be fixed, hold before spending the correction budget.

### After attempt two

Stop automatic creative regeneration. Preserve accepted assets and present the unresolved issue. Additional work requires a new explicit scope/spending decision; it must remain linked to the original failure so reporting cannot erase it.

Infrastructure recovery must be distinguished from creative correction. A timeout with unknown billing status requires reconciliation before resubmission. Application idempotency does not guarantee provider billing idempotency. Any billable retry remains in cost reporting. Concurrent workers must share atomic reservations and attempt state so two jobs cannot both claim to be the final allowed attempt.

## 14. Continuity, approvals and storage contracts

Maintain proposed records for project, brief version, character version, reference role, voice selection, scene state, shot contract, generation job, review, approval and final deliverable. These are design requirements, not tables created by this document.

For every asset, retain parent references, effective instructions, model/endpoint version where available, generation parameters, actual duration, review evidence and lineage. Protect credentials and private media URLs in logs. Store the approved instruction version and a traceable payload, not just a mutable prompt name.

Approvals are scoped. Approving an actor's face does not approve every later performance. Replacing dialogue invalidates timing and dependent lip-sync approval. Replacing the identity master requires review of dependent shots. An upscale or face-affecting edit requires renewed checks of properties it may change.

Scene state should distinguish story truth from generation mistakes. If a prop accidentally disappears, do not update the canonical story state to make the mistake look consistent. Record intentional transitions such as a coat being removed or a sleeve becoming wet.

## 15. Admin backoffice: the controls that protect quality

The backoffice needs more than a model dropdown and a prompt editor.

| Control | Founder benefit |
| --- | --- |
| Versioned realism packs by product and language | Prevents one generic prompt from degrading all use cases |
| Capability evidence per endpoint/configuration | Separates catalog claims, schema verification, execution and creative validation |
| Representative benchmark library | Reveals which scenes, accents and interactions actually fail |
| Failed-attempt replay with asset lineage | Shows whether the prompt, reference, route or evaluator caused the problem |
| Review overrides with reasons and identity | Prevents silent relaxation of acceptance standards |
| Prompt and route change comparison | Detects improvements that damage previously reliable cases |
| Cost reservations and uncertain-charge ledger | Prevents hidden retry spend and lost finishing budget |
| Cohort metrics with failures retained | Prevents success claims built only from accepted outputs |
| Reference access, consent and deletion tracking | Protects customers and enables accountable media use |
| Customer preference versus model defect labels | Avoids training the system to mistake a personal taste change for a technical failure |
| Provider incident and route kill switch | Stops a degraded model before it burns more customer budget |
| Complaint-to-case linkage | Turns a support issue into an inspectable production failure and regression case |

Prompt updates should have an owner, rationale, examples, review and rollback path. Do not allow unreviewed customer feedback to rewrite global instructions automatically. Personal preferences belong to the user's project or profile unless separately evaluated as a general improvement.

The overlooked founder advantage is **knowing the boundary of competence**. A smaller set of proven workflows with clear limits can earn more trust than claiming every model and every movie type works equally well.

## 16. Measurement and validation programme

The acceptance target is a measurable product objective, not marketing copy before trials.

Report first-round acceptance, acceptance within two rounds, unresolved work units, manual intervention rate, candidate count, total project cost, cost per accepted output minute, rework caused by upstream changes and customer acceptance after final playback. Publish the denominator and evaluation scope internally.

Do not exclude failed, held or abandoned cases from the within-two denominator. Separate provider incidents and customer scope changes for diagnosis while keeping their costs visible. Distinguish internal reviewer acceptance from customer acceptance.

Benchmark across relevant languages, skin appearances, age ranges, lighting conditions, camera distances, wardrobe materials, hand interactions, emotional registers and product types. This is coverage of production conditions, not permission to stereotype people.

Recommended initial proof: a 45–60 second connected film exercising an original character, a meaningful hand/prop interaction, dialogue, quiet emotion, B-roll, environmental sound and a finished edit. Use the same approved production profile across shots. Add a separate singing proof before offering singing performance. A short proof must cover departments, not merely produce an attractive montage.

No paid proof is authorized or executed by this document. The eventual pilot needs a defined brief, routes, reviewers and cost ceiling before running.

## 17. Required acceptance scenarios before implementation release

These are specification checks and future test cases; they have not been run on generated media.

1. A user requests clean beauty photography: the director does not add dirt or excessive pores as a realism shortcut.
2. A user explicitly requests animation: photographic defaults do not overwrite their style.
3. A character turns sideways: identity is checked against the master rather than only the preceding frame.
4. A close-up has no hands: the reviewer does not fabricate a hand defect; a required hand interaction still receives inspection elsewhere.
5. A reference pack contains style and identity images: their roles remain distinct.
6. A supported schema lacks a negative-prompt or speed field: the adapter does not invent one.
7. Approved audio is longer than video: the system holds instead of silently using bounce, loop or truncation.
8. A model recommender returns video for a casting still: modality validation rejects the recommendation.
9. A transcript is accurate but delivery is robotic: transcript checks do not pass the voice gate.
10. Still frames look good but motion is unstable: frame review does not pass temporal acceptance.
11. Two workers request the remaining correction simultaneously: only one can reserve it.
12. A timeout leaves billing unknown: reconciliation precedes another provider submission.
13. A second attempt fails: no automatic third generation, endpoint switch or hidden batch occurs.
14. A voice or identity reference changes: dependent approvals are invalidated appropriately.
15. A music video uses sung lyrics: speech alignment confidence does not masquerade as verified singing alignment.
16. An upscale improves sharpness but changes the face: the identity gate blocks release.
17. Required local details are unknown: the plan marks uncertainty rather than inventing cultural authenticity.
18. Final output contains the right number of clips but lacks a requested scene: completeness fails despite successful individual jobs.

## 18. Research evidence and limits

Public sources informed workflow principles, not claims that their systems or our candidate routes meet the proposed acceptance bar.

| Source | What it supports | What it does not establish |
| --- | --- | --- |
| [Luma: How To Use References Properly](https://lumalabs.ai/learning-center/articles/how-to-use-references-properly) | Stable master references, explicit reference constraints and re-anchoring to avoid iterative drift | Our endpoints' identity retention or access to Luma's private intelligence |
| [Luma image prompt guide](https://docs.agents.lumalabs.ai/guides/images/prompt-guide/) | Public guidance for reference-aware image prompting | Guaranteed transfer of controls to unrelated fal models |
| [Krea: generating images with style references](https://www.krea.ai/blog/how-to-generate-images-with-style-references-in-krea) | Style-reference workflow as a distinct production tool | Style reference alone guaranteeing character identity |
| [Hedra Character-3](https://www.hedra.com/models/video/hedra/character-3) | Public positioning of audio-driven character performance | Verified quality of our talking, singing or lip-sync candidates |
| [OpenArt: consistent characters in AI video](https://openart.ai/blog/consistent-characters-in-ai-video/) | Reusable character/reference workflow rather than independently reinvented faces | Competitor internal prompts, backend architecture or measured success rate |
| Existing [UX research record](REFERENCE_UX_RESEARCH.md) | Earlier public interface observations | Backend implementation or generated-media realism |
| Existing Bible and schema evidence | Candidate endpoint fields, constraints and dated price observations | Execution readiness or creative quality |

Official pages above were read during the research for this specification. They are vendor documentation and may change. The new REA/browser capture pass for realism-specific guides did not complete and yielded no usable capture artifacts; it must not be represented as completed competitive reverse engineering. Earlier public-interface captures remain limited to their recorded scope.

The Character Director, fal cinematography and fal prompting skill guidance informed the production structure. The prompt library above is newly written for this studio. None of these sources replaces actual generated-image inspection, listening or sequence playback.

## 19. Release boundary and next concrete step

This document is ready for blueprint review. It is not evidence that the app already contains these capabilities.

Before production activation, implement and validate the contracts, adapters, lineage, budget/attempt controls, review interface and export checks. Resolve the premium casting route, voice availability, evaluation modalities, hosted media worker and data-retention behavior. Then run the representative proof with a fixed budget and human review, record the failures honestly, and promote only the routes that pass their intended use case.

The central rule is simple: **understand the desired result, lock what matters, direct specifically, inspect the actual media, and make one justified correction before stopping.** Realism is an acceptance discipline across filmmaking departments, not a list of flattering prompt adjectives.


## 20. Incorporated character knowledge — revision 2

The user-supplied [Character Realism Prompting Guide](knowledge-sources/AI_Character_Realism_Prompting_Guide.md) is preserved as source material. Its 37 principles are incorporated into the existing appearance, identity, photographic treatment, prompt and review sections by semantic grouping rather than appended as 37 mandatory instructions.

| Source principles | Existing controlling rule | Additive clarification |
| --- | --- | --- |
| 1–15 | Sections 5–6: identity and biological appearance | Scale skin detail to framing; makeup and polished presentation remain valid. |
| 16–27 | Sections 5, 8–9: composition and communication | Avatar direct gaze, portrait lenses, simple backgrounds and optional hidden hands are use-case choices, never universal film rules. |
| 28–32 | Sections 5 and 14: reference lineage | A synthesized unseen side of a person is a proposed interpretation until approved, not recovered factual anatomy. |
| 33 | Sections 4 and 6: photographic intent | Restrict CGI exclusions to the photographic layer when graphic or surreal elements are intentionally requested. |
| 34–36 | Sections 7 and 11: text governance | Explicit modes: TEXT OFF, TEXT PRESERVE and TEXT DIRECTED; required authentic branding must be checked, not assumed preserved. |
| 37 and correction checklist | Sections 12–13: evidence and repair | Inspect identity independently from realism; corrections retain successful directions and consume the existing attempt allowance. |

### Performance contract extension

The [Master Cheat Sheet](knowledge-sources/AI_Filmmaking_Master_Cheat_Sheet.md), attributed to Shailesh (@BEGINNERSBLOG), adds a practical behavior structure: attention target, triggering event, main reaction, supporting behavior, timing and end state. Use this structure when it helps express the scene, while retaining character intention and subtext. Do not force all six fields into every provider prompt.

Example: a listener hears a particular name, pauses, looks toward a photograph, then returns attention to the speaker. The reaction must connect to the actual dialogue timeline. A silent character can be actively listening; continuous nodding is not a substitute. Stillness is a valid directed performance. Blink timing is optional direction, never a periodic realism effect.

### Additional original prompt — motivated reaction

> Preserve {{approved_identity_and_scene_state}}. The character is attending to {{attention_target}}. When {{trigger}} occurs, show {{main_reaction}}, supported only if useful by {{secondary_behavior}}. Allow {{timing_or_pause}} before settling into {{end_state}}. This behavior serves {{intention_and_subtext}}. Preserve the approved dialogue and camera. Omit supporting movement if it makes the beat busy or contradicts the performance.

### New acceptance checks

- An imagined profile is labeled proposed until approved.
- An avatar portrait default does not override narrative gaze or environmental framing.
- Macro skin instructions are not applied at implausible scale in a wide shot.
- A full-face performance edit triggers renewed identity and acting review.
- A trigger-dependent reaction is checked against the actual trigger timing, not just its presence in the prompt.
- Expressive distortion is judged against the requested style instead of automatically rejected.

### Capability refresh

The premium image candidate's schema is now inspected; pricing, execution and casting quality remain unverified. A separate H3 Max lip-sync candidate is now documented for singing investigation, not approved use. Its public guide and live schema disagree on maximum duration and transcription defaults. See the [research validation register](RESEARCH_VALIDATION_REGISTER.md). Existing M01–M20 IDs remain unchanged. No quality or cost entitlement is inferred from schema discovery.


## Reviewed Gemini knowledge refinements — 18 October 2026

Read the [source reconciliation](GEMINI_KNOWLEDGE_RECONCILIATION_2026-10-18.md) for provenance and corrections. Keep intended optical/physical direction, exposed provider controls and observed output evidence separate. Reference-led identity and actual sequence playback remain essential; JSON, a seed, a color palette or a speed in prompt text cannot certify realism.

For applicable scenes, attach action-axis, screen-direction, eyeline and entry/exit relationships to intended continuity state. Record justified exceptions, including visible line crossing, neutral coverage or establishing resets, and inspect the resulting sequence for orientation. Maintain coherent coverage while allowing motivated focal-length, viewpoint and camera changes. Ad hooks and audiovisual timing follow audience/message/music intent rather than universal timing formulas.

Unknown geometry stays unknown until evidence supplies it. Classify unsupported mandatory controls before spending; do not fabricate coordinates or silently reinterpret a protected requirement to match a generated defect. The full department, casting/look/voice, storyboard, animatic and final audiovisual gates remain required.

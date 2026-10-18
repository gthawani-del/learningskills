# fal Learn — Director Studio knowledge integration

Reviewed 18 October 2026 UTC. Research and implementation guidance only. No model execution, training, application change or quality validation was performed. Read alongside the controlling [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md), [realism specification](REALISM_INTELLIGENCE_LAYER.md) and prior [documentation refresh](FAL_ROUTING_KNOWLEDGE_REFRESH_2026-10-18.md).

## Coverage and evidence

The [Learn landing page](https://fal.ai/learn) and developer, tools and business category listings were inspected. Twelve selected guides were reviewed for the studio-relevant guidance below. This is not an exhaustive review of the 18-page Learn archive. Additional downloaded articles are marked fetched-only in the [source manifest](evidence/FAL_LEARN_REVIEW_2026-10-18.json).

Source article examples, prices, comparisons and benchmark claims are fal-published observations. They do not establish our endpoint access, current schema, account price, identity fidelity, timing accuracy or production reliability. The source manifest records retrieval date and body hashes. No claims depend on visually verifying article videos: their text was reviewed, their media was not played.

## 1. Routing begins with the production problem

Choose the generation mode and required controls before comparing models or price:

| Production need | Candidate workflow | Required verification |
| --- | --- | --- |
| Explore a new visual concept | Text-to-image or text-to-video | Brief fit; composition; output settings and estimated cost. |
| Animate an approved composition | Image-to-video | First-frame support; identity and geometry through motion. |
| Reuse an actor, product, wardrobe or motion in a different scene | Reference-conditioned generation | Supported reference types; role mapping; fidelity and actual reference charges. |
| Change a small region while preserving the rest | Local/masked image edit or compositing | Real mask semantics and dimensions; unchanged-region comparison. |
| Connect approved keyframes | First/last-frame video, if supported | Endpoint fields; join velocity, exposure, continuity and measured duration. |
| Change an actor in approved footage | Recast, subject to consent and schema validation | Person mapping, occlusion, identity, original audio and environment preservation. |
| Deliver exact titles, labels, charts or kinetic typography | Deterministic graphics/compositing where exactness matters | Approved copy, fonts, placement and temporal stability. |
| Repeated production around a character or style | Reusable approved references; evaluate optional LoRA | Rights, dataset quality, held-out tests, model compatibility, training and inference costs. |

Model families are candidates for particular controls, never blanket quality or age tiers. Resolution, quality/thinking level and prompt expansion also affect suitability, latency and price within a model. Preserve the user's intended result, approved decisions and requested creative control. A low-resolution draft is optional when it resolves a real uncertainty; it does not validate fine text, skin or final-resolution fidelity.

## 2. Character identity is an approved asset, not a repeatedly invented description

1. Record a concise identity specification, fixed signature details and rights/consent where relevant.
2. Present the agreed number of casting candidates, with their costs included. Approve one identity master.
3. Generate and inspect a front/profile/back reference sheet. Check that every panel depicts the approved identity; a sheet can itself introduce drift.
4. Use even lighting for neutral identity references. Dramatic shadows can be mistaken for facial geometry downstream.
5. Store angle-specific crops with their parent master, version, role and approval. Select views appropriate to the shot; do not ask a front-only image to define an unseen back or profile.
6. Keep identity, wardrobe and scene state distinct. A wardrobe change must not silently change facial structure.
7. Record why an output was approved or rejected alongside the media. Project memory preserves decisions as well as pixels.

Inspect small signature features, handedness, asymmetrical accessories, face, build, hair, garment construction and product geometry. Do not silently rewrite an approved left/right requirement to match a model mistake. Seek an explicit decision or repair the affected feature.

LoRA is an escalation option for repeated work, not an identity guarantee. Evaluate held-out angles, expressions, motion and overfitting. Include consent, dataset access/deletion, base-model/license compatibility and storage of weights in the plan. Generated variations are not independent ground truth for the real person's identity.

## 3. References need stable roles and lineage

Every request carries an ordered reference manifest: asset/version, modality, position, purpose, permitted influence and protected attributes. Examples: Image 1 supplies identity; Image 2 supplies product geometry; Video 1 supplies only camera motion; Audio 1 supplies timing.

Compile that manifest into endpoint-specific addressing. Different families use different field names and conventions. The prompt, arrays, customer preview and saved job recipe must agree on ordering. Missing inputs or unsupported roles hold the request rather than letting the model guess.

Two Learn workflows require reconciliation:

- Krea's sequential editing examples reuse an approved scene output plus original identity/product references for the next angle.
- Nano Banana's storyboard example generates each panel from the same approved casting/product masters, avoiding propagation of the previous panel's mistakes.

Our rule: anchor every shot to canonical approved masters. Add a selected scene output only when its scene state is needed and verified. Preserve lineage and inspect cumulative drift; never chain unchecked outputs. Attach only useful references, while retaining enough detail for the task. Token savings do not justify crops that hide essential geometry or identity.

## 4. Storyboard and animatic remain mandatory production stages

Create actual storyboard panels after script, casting/look and applicable voice approvals. Each panel has a stable shot ID, source references, framing, camera/subject action, timing, dialogue/audio notes and protected details. Review the sequence, then assemble a playable timed animatic against the original song or approved/scratch dialogue before expensive final footage.

The Learn Nano Banana example explicitly begins with casting and uses those references across individual storyboard frames. Its four-panel advertisement is an example, not a fixed panel count for our studio. Coverage and pacing determine the board size.

For keyframe transitions, inspect both endpoint support and the result. Matching endpoint images can still hide camera-speed changes, exposure jumps, shape morphs or duplicate frames at joins. Measure actual clip duration and trim deliberately; requested durations are not a reliable final timeline clock. Review loops at full speed with sound. A merge endpoint is one assembly operation, not a substitute for the studio's durable edit/render/export system.

## 5. Edit instructions become acceptance checks

Before editing, separate the requested change from the protected attributes. Turn each protected attribute into a review criterion. Example: change the background; preserve bottle silhouette/cap/label, rotation speed, camera position and final framing.

Preserve approved instructions and stored settings, including expansion mode and any returned expanded prompt. Detailed final direction may call for expansion disabled; broad ideation may benefit from expansion. Confirm behavior per endpoint rather than applying a universal setting.

Compare matched timestamps or aligned frames across source and output. Frame-index matching alone is insufficient when frame rates differ. Still-frame checks support identity/geometry review; full playback and listening are also required for flicker, motion, rhythm, cuts, speech and sound. Repair the failed region/shot where possible and keep accepted neighboring work.

Seeds are useful experimental controls where supported. They are not a universal reproducibility guarantee across provider implementations, version changes, settings or resolutions. Record endpoint/model version, exact payload, references, seed, expansion and output metadata together. A successful draft does not automatically certify a higher-resolution rerender.

## 6. Realism comes from coherent direction and review

Use specific scene relationships, framing, lens intent/focus, motivated light direction, materials, physical interaction and restrained color treatment. Replace generic strings such as “masterpiece, ultra realistic” with concrete visible requirements. A believable human also needs natural expression, performance, body motion, voice and contextual interaction; an image prompt alone cannot ensure this.

Prefer clear positive scene descriptions. Use targeted exclusions or negative-prompt fields when supported and useful; the music and character guides themselves demonstrate these. Do not treat “never use negatives” as a global rule. Prompt controls require model-specific compilation and output inspection.

The article's recommendations to allow automatic framing or routinely generate several candidates do not override a user's delivery aspect ratio, approved shot plan, budget or two-attempt policy. Count drafts, auditions and quality repairs transparently. No Learn example proves our two-attempt acceptance target.

## 7. Music direction and uploaded-song preservation

For newly requested music, capture use, genre, emotional arc, tempo where needed, instrumentation, vocal/instrumental choice and duration. Describe section-level intent without conflicting instructions. Use authorized canonical lyrics when applicable and check pronunciation and actual timing.

For an uploaded Hinglish song, preserve the original recording as the master unless the user requests changes. Perform semantic analysis, DSP timing/structure, transcription and canonical-lyric alignment as separate needed tasks. A music-generation guide does not identify an audio-analysis endpoint or validate Hinglish accuracy.

The Eleven Music article proposes sectional extension, conversational edits and isolated instrument generation. Enable these only if the exact selected endpoint exposes the required operation. A prompt saying “solo” does not produce a phase-aligned stem of an existing song; a prompt asking for 128 BPM does not prove the output is exactly 128 BPM. Verify duration, beat alignment, transitions, sample format, clipping and listening quality. Source dates, endpoint generations and output constraints must be checked live.

## 8. Costing changes required by these guides

Every quote must cover the actual configuration and inputs, not merely a family headline rate. Current simple unit-based estimates are insufficient for some documented composite tariffs.

- **H3 Max references:** Learn describes output-duration/resolution charges plus a reference-token allowance and overage. Its five-second reference-video edit example reports approximately $0.42 at 480P, $0.96 at 768P and $1.36 at 1080P, for one specific 16:9/24fps input. These are historical article examples, not our live quotes. Frame rate, dimensions, input duration and reference mix affect the charge.
- **Keyframe billing ambiguity:** the motion-design article expressly leaves uncertainty about whether opening/landing frames count toward reference tokens. Hold a firm quote until authoritative tariff/configuration evidence resolves the rule; do not choose the cheaper interpretation silently.
- **Recast ambiguity:** the character-replacement article lists $0.05 per unit and a $3.49 worked recast charge without enough unit-conversion detail. Preserve the discrepancy as unresolved. Neither a per-second assumption nor a fixed per-request total is justified.
- **Image reasoning:** Nano Banana 2.1 articles describe input-media, output-image and thinking/text tokens. Their per-image examples depend on a short prompt, resolution, thinking setting and reference count. GPT Image comparisons also vary with size/quality. Do not turn article examples into universal flat image prices.
- **Wan configuration:** the Wan comparison describes different resolution rates and input-video billing on Wan 2.7 reference-to-video. This is not directly comparable with a bare connected-account base rate. Preserve both observations with their scope and seek the executable tariff.
- **Training:** the Wan 2.2 article reports per-step training with a minimum, separate from inference. Its 400-step examples were $1.60 T2V and $2.00 I2V on the article's stated date. Training also requires preparation, storage, evaluation and approval of the total spend; no automatic training.
- **Hosted assembly:** a merge operation billed on processing time requires its own estimate/reservation/reconciliation policy. Do not quote it as free because one article reports a sub-cent run.
- **Account boundary:** temporary fal Agent reasoning offers or UI subscription discounts do not establish free reasoning or discounted API usage for Director Studio. Quote our actual backend providers and commercial terms.

Source-backed prices remain dated research until exact endpoint/schema/settings/account pricing, minimums and billing-unit conversion are verified. Show each user the creation scope, estimate, authorized cap, reserved/spent/pending amounts and final charges. Unknown tariff components hold the paid action. Never hide preparation, casting, voice auditions, boards, animatics, review, repairs or finishing.

## 9. Training integration requirements

The Wan 2.2 guide distinguishes text-to-video and image-to-video trainers and matching inference conditioning. It documents captions/trigger phrases, separate LoRA weights/configuration and a low-noise-transformer binding for its example. Store this as endpoint-specific research; do not assume one LoRA loads into every Wan endpoint or other family.

Validate dataset media/caption pairs, quality, variation and permissions; keep a held-out evaluation set. Stage a training proposal with a step-based cost cap and explicit approval. Store trained weight version, compatible base endpoint, transformer/scale settings and evaluation evidence. Training is not authorized or implemented by this research.

## 10. Implementation handoff and acceptance

1. Extend the registry with dated control/reference/pricing evidence. Import candidates as inactive until schema, execution and quality gates pass.
2. Compile approved brief, identity/world/audio state and ordered references into each endpoint's supported fields. Reject incompatible plans.
3. Add protected-attribute review contracts to versioned shots/takes and reference-driven revisions.
4. Implement composite and token-based tariff adapters, bounded reservations and actual-charge reconciliation before enabling these routes.
5. Connect the department manifest, casting/look/voice approvals, storyboard and animatic stages to the Director workflow.
6. Test representative Indian cooking-oil, Hinglish music-video and documentary cases with consented assets and an approved pilot budget. Record failures, attempt counts, full costs and finished outputs.

These remain implementation requirements. No requirement status is upgraded by reading these articles. Existing automated test counts do not validate these new creative workflows.

## Reviewed guides

1. [Fine-tuning Wan 2.2](https://fal.ai/learn/devs/how-to-fine-tune-wan-with-the-api).
2. [Nano Banana 2.1 vs GPT Image 2.5](https://fal.ai/learn/devs/nano-banana-2-1-vs-gpt-image-2-5) — routing controls and price context.
3. [Nano Banana 2.1 workflows](https://fal.ai/learn/tools/how-to-use-nano-banana-2-1).
4. [Krea 3 reference editing](https://fal.ai/learn/tools/krea-3-prompting-guide).
5. [Character replacement](https://fal.ai/learn/tools/how-to-make-a-character-replacement-video).
6. [Keyframe motion design](https://fal.ai/learn/tools/motion-design-video-generation-with-claude).
7. [Reference-driven video editing](https://fal.ai/learn/tools/how-to-use-gpt-6-astra-for-video-editing).
8. [Character consistency](https://fal.ai/learn/tools/ai-character-consistency).
9. [Photorealistic image direction](https://fal.ai/learn/tools/how-to-generate-photorealistic-images-with-ai).
10. [Reference-to-video](https://fal.ai/learn/tools/what-is-reference-to-video).
11. [Eleven Music prompting](https://fal.ai/learn/biz/eleven-music-prompt-guide).
12. [Wan 3.0 and Wan 2.7](https://fal.ai/learn/devs/wan-3-vs-wan-2-7) — schema and tariff differences.

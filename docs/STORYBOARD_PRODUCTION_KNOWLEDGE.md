# Director Studio — storyboard frame production knowledge

Revision 1 · 19 October 2026 UTC · First storyboard-image production increment.

## Purpose and source authority

This module turns an approved shot contract and exact approved identity/look/location references into a **candidate image depicting the intended starting state of one shot**. It adds image generation/import, explicit selection and human frame review to the text handoff. It does not create a moving take, prove an action's ending, speak dialogue, analyze a song or render a playable animatic.

The controlling sources are the [Film Studio Blueprint](FILM_STUDIO_BLUEPRINT.md), [Product Experience Specification](PRODUCT_EXPERIENCE_SPEC.md), [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md) and [Realism Intelligence Layer](REALISM_INTELLIGENCE_LAYER.md). The [shot-contract knowledge](STORYBOARD_HANDOFF_KNOWLEDGE.md) defines purpose, intended state, mandatory/flexible criteria and future production obligations. [Reference Production Knowledge](REFERENCE_PRODUCTION_KNOWLEDGE.md) distinguishes original/supplied identity, appearance and world images, their provenance and human approval. Public product workflows and specialist guidance do not disclose competitors' private orchestration or establish our output quality.

The source synthesis also uses the previously read fal [Storytelling](skill://plugin_asdk_app_6a19d5012d308191a00a48780f7dcdcc/storytelling/SKILL.md) and [Cinematography](skill://plugin_asdk_app_6a19d5012d308191a00a48780f7dcdcc/cinematography/SKILL.md) guidance, plus Character Director's [identity/camera/light](skill://plugins_6ac0a590b13c81918f9b80550f073105/character-director/SKILL.md) and [typography](skill://plugins_6ac0a590b13c81918f9b80550f073105/typography-director/SKILL.md) rules. This is original implementation-specific synthesis; a skill's premium endpoint, sample camera settings or candidate quantities do not activate a route or authorize spend.

## What a still can and cannot prove

| Requirement | Evidence available from an actual still | Evidence still needed later |
|---|---|---|
| Medium framing, approved person and blue coat | The selected image's composition and visible appearance, compared with the exact approved references | Identity and wardrobe stability across motion and neighboring takes |
| Envelope in the left hand | Visible possession/contact at the pictured instant, if the image clearly shows it | Whether it stays there through the whole action |
| Intended start and end state | The pictured starting state, reviewed against its declared intent | Arrival at the ending and continuity over time; one picture cannot establish both |
| Guarded performance hiding a discovery | A proposed pose, gaze/expression and arrangement that can suggest the intention | Played performance, behavior/subtext and audible delivery |
| Exact line “Nothing important.” | No spoken-word evidence; the line remains source context | Actual voice take/transcript/listening and audiovisual timing |
| Camera move, light progression, rain or liquid flow | Starting composition, material/contact and light appearance where visible | Continuous movement, physics, changes, sound and temporal coherence |
| Two-minute song, BPM or beat-aligned edit | A visual proposal linked to approved story decisions | Actual song analysis, canonical lyrics, measured timing and playable sequence |

The Mara/Ishan envelope contract in [Product Experience §10](PRODUCT_EXPERIENCE_SPEC.md#10-worked-shot-contract-and-ui-journey) is illustrative. A beautiful close-up fails its mandatory medium framing; a right-hand envelope fails its intended visible state. Do not rewrite the contract to match an attractive error. The example has not been filmed or evaluated in a paid pilot here.

Each shot's action/end-state/audio remains visible in source context as a future obligation. It must not be labelled “observed,” “verified” or “completed” merely because an image request succeeded.

## Prerequisites and proposed pictured characters

Preparation, a new quote and current frame approval require the current approved brief, source-current screenplay, all 17 fresh approved departments and the complete current approved shot-contract sequence. This is the existing planning checkpoint; it is not a claim that images already passed visual sequence review.

The source shot's character IDs are story associations and can include an off-screen narrator. Free preparation proposes pictured character IDs from those associations, visibly labelled for review. The user must confirm the frame direction, including who is actually pictured, and can remove an off-screen speaker. The proposal is not an inferred visibility fact or a selected actor. Names, nationality, language and audience age must not determine appearance, accent, style or budget.

Every chosen pictured character needs **both** its current approved selected identity master and its current approved selected look. The corresponding location image is required for every frame in this first increment. Missing inputs hold the affected work and point back to Cast & World; the system cannot quietly invent a person/world or switch to text-only generation. An abstract or empty-environment frame can have no pictured people after explicit review, while still needing its source-scene location reference.

The approved brief determines the visual treatment. Photographic, illustrated, animated and deliberately stylized images are valid when requested. Photograph-specific skin/material directions must not overwrite the chosen style. The reference and shot contracts remain production-useful within that treatment.

## Role-labeled exact references

Each binding records its role (`identity`, `look` or `location`), applicable character ID, reference subject/version, selection version and asset/version. The image must be an actual owned private stored asset with the current approved reference selection; prose names or URLs are insufficient. Look references must themselves retain the exact approved identity binding. The location subject must belong to the shot's actual scene.

Keep the approved identity master as the comparison anchor across frames. A previous generated storyboard image is not automatically adopted as a replacement actor or look reference; attractive errors must not accumulate into a new identity or scene truth.

Canonical role order is all identity bindings in stable character-ID order, then all look bindings in that same order, followed by location. The provider receives each **distinct asset image once**, in its first canonical occurrence, while the context retains every role and version pin served by it. One approved image serving two explicit roles therefore counts once for input-image fees but does not erase either approval/dependency role. Stable `Image1`…`ImageN` labels connect the prompt's role descriptions to the exact submitted image list.

The bounded Seedream edit adapter permits no more than ten distinct input images. Exceeding that limit holds generation; it never silently drops the last character/location, swaps an unapproved composite or changes the shot's visible cast. Explicitly revise the production scope or approve another implemented/evaluated route when needed. A five-person shot can exceed the limit when identity/look are separate images; role count and distinct image count must be shown accurately.

This increment uses the reviewed Seedream reference-edit configuration because it accepts the ordered approved image inputs needed for this contract. The existing FLUX text-to-image routes serve original identity/location exploration and cannot substitute for required visual identity conditioning here. This is a bounded adapter choice, not a claim that Seedream is best for every job or that the cheapest or premium endpoint should always win; alternatives need their own role/input, configuration, cost and actual quality evidence.

Every shot-contract reference requirement needs an explicit decision: bound, not applicable or unresolved with rationale. Identity/look requirements may be not applicable only where no relevant chosen person is pictured and the source permits that decision; frame-direction approval confirms it. Location remains required. Image-reference requirements for unsupported **product, composition, lighting or performance** roles hold this increment and require upstream contract review. They cannot be waived as not applicable or relabelled prompt-only to bypass a mandatory reference. This does not forbid motivated lighting or composition direction in prose; it distinguishes such intent from an unsupported required role-image input.

## Direction and image composition

A useful start frame makes the shot's narrative job legible: who/what matters, where it is, what holds attention and what state must be preserved before movement. Keep source purpose/action, framing, camera/light intent, identity/wardrobe, spatial relationships, prop ownership/contact and relevant character knowledge together. Avoid a generic attractive image unrelated to the planned cut or dramatic information.

Direct the image around its strongest required evidence:

- For a character exchange, keep the approved people, intended eyelines and source geography readable; do not let a glamorous angle accidentally recast the face or reverse the scene's axis.
- For a cooking/product action, preserve the required hand, vessel and product context. A still of a plated meal cannot stand in for the specified pour starting state or certify liquid motion.
- For a location/establishing frame, show the required physical context and relation to neighboring shots without inventing authentic signs, permissions or factual details.
- For a music-video performance frame, preserve the chosen person/look and visual premise. A posed mouth or microphone is not proof of singing or lip sync.

For photographic treatment, require plausible perspective, readable identity features, coherent skin/fabric/material response, motivated light and visible contact where the contract needs it. Do not hide essential hands, objects or labels to conceal a defect. Preserve intended stylization when requested. Exact lens, camera position or physics values in prose are treatment recommendations unless the adapter and actual evidence establish more; this bounded image route has no native locked-identity, exact-camera-pose or depth-control guarantee.

Default nonessential typography to TEXT OFF. Preserve only approved supplied product/brand text and require exact deterministic typography/compositing when necessary. No invented captions, character labels, logos, pseudo-signage or environmental filler should appear. The current acknowledgement is human visual review, not implemented OCR or automatic text-surface detection.

## Native aspect configurations and cost

This increment uses three explicit output configurations rather than generating a square and silently cropping it:

| Approved frame aspect | PNG dimensions | Output pixels |
|---|---|---|
| `16:9` | 1536×864 | 1,327,104 |
| `9:16` | 864×1536 | 1,327,104 |
| `1:1` | 1024×1024 | 1,048,576 |

A supported approved-brief aspect is prefilled. When no aspect was supplied, 16:9 is a proposal that still needs direction approval. An explicitly unsupported or conflicting source aspect holds work for an approved source revision; it is not silently replaced with 16:9. These sizes are storyboard-source configurations, not final-film resolution or export promises.

The [dated public Seedream evidence](evidence/FAL_STORYBOARD_ENDPOINT_2026-10-19.json) observes a candidate base of $0.0675 per output at or below 1536² pixels, plus $0.0045 for each distinct input image after the first, per output. For one image, one input is therefore a candidate $0.0675; ten inputs are a candidate $0.108. All three bounded configurations are in that observed area tier. The tool's flat $0.0675 “unit” alone is insufficient for a multi-reference quote.

These are public observations, not account-verified tariffs, live customer quotes or invoice charges. Executable registry evidence must cover the exact output area/count and all actual input-image fees. The router requires a complete supported base plus `input_image` tariff; it cannot reuse an old flat single-reference price as if additional references were free. Duplicate role bindings share one actual submitted asset and one image-count charge; different input assets do not.

Show one output, distinct input count, selected reviewed route/configuration, itemized estimate and exact spending scope before authorization. Reuse the existing project cap, protected finishing reserve, quote/allowance/reservation, two-attempt work unit and known/unknown outcome ledger. A direction approval, sharing consent or financial allowance does not start generation. There are no hidden panel batches, auto-paid retries or a second wallet.

## Frame workflow and storage

The runtime archive version is `director-storyboard-production-v1`. Independent shot frame-specification histories bind their exact handoff contract/source and role-labeled reference selections. They record the planning sequence version for audit. Selection events point to exact stored frame candidates and their specification versions. The archive does not duplicate the full screenplay or turn a still into the shot contract itself.

`GET/POST /api/projects/:id/storyboard-production` supports missing-only preparation, focused updates, acknowledged refresh and explicit selection. Preparation preserves existing specifications/history. A refresh retains reviewed direction, pictured cast and supported aspect where still valid, while explicitly updating source/reference pins; it does not silently invent replacement people or erase unresolved input constraints. Direction approval at existing `/approvals` uses `storyboard_brief:<shotId>` with `acknowledgeFrameDirection:true` to confirm pictured characters and the actual constraints.

`POST /api/projects/:id/storyboard-production/quotes` builds the canonical server prompt and privately signs the exact distinct approved reference images. `shareReferences:true` is explicit consent for their provider use, not rights clearance. Clients cannot replace the prompt, signed reference URLs or image order. Quote replay retains its saved identity before creating new signed URLs. `/storyboard-production/jobs` reuses the existing authorized job lifecycle, and the existing job dispatch/poll paths recover the exact original request.

The scoped image prompt includes the complete own shot contract and frame specification, exact source scene/action and relevant character descriptions, chosen reference directions/pins, six brief fields (aspect, visual style, tone, setting, product and constraints), and nine complete department documents (direction, casting, look, locations, camera, lighting, continuity, storyboard and rights). Unrelated screenplay text is not represented as a new full-film reasoning call. Included facts are bounded at 100,000 UTF-8 bytes without silent truncation. The starting state is the render target; movement, ending and audio are future context.

`POST /api/projects/:id/storyboard-production/import` accepts an owned completed job ID, not a caller output URL. The saved output receipt is checked, the one supported PNG is downloaded from an allowed fal CDN with redirects rejected, and actual bytes/dimensions are validated against the exact quoted aspect/configuration within the 10 MiB bound. Private immutable storage, checksum and matching job/payload/shot/specification provenance precede candidate registration. Old completed outputs remain retrievable/importable after a source change or model retirement; this does not make them eligible for a new current selection.

A candidate is not automatically selected. Selection requires actual image inspection and acknowledgement, then separate `storyboard_frame:<shotId>` approval with `acknowledgeFrameReview:true`. There is no generic upload-to-storyboard-frame shortcut in this increment; uploaded images enter as separately approved reference inputs. Generated frame provenance cannot be forged through upload metadata.

`POST /api/projects/:id/storyboard-production/reviews` records a visible correction reason before another same-work-unit attempt. It does not diagnose a defect automatically, rewrite the prompt, change direction or trigger paid repair. A new direction/reference scope needs its exact current approval/quote/financial context. Import, storage or candidate-registration failure is a recovery event against the saved original job, not permission to generate again. Unknown submission states remain held until reconciled.

## Reuse, changes and authority

A changed own shot contract, underlying source or exact bound reference makes its earlier frame specification/selection stale while retaining all images/history. Changed source means the whole approved brief/script and all 17 department-version baseline, rather than claimed semantic field-level impact. A new identity or look selection cannot silently become equivalent because it resembles the old image.

Sequence order/neighbor edits require the current complete shot-plan checkpoint to be reviewed again. Once that checkpoint is current, an unchanged own contract/source/reference/frame can remain usable; its archived sequence version is audit context rather than a reason to regenerate every image. New quotes still capture the current planning sequence and cannot use a stale financial context.

Selecting a frame does not change flat shot-contract versions, `referenceAssetId`, existing clip IDs, production bindings or timeline selections. This avoids an approval loop where selecting the planned output invalidates its own source plan. The typed frame selection is available for later explicit animatic/footage binding; it is not final media selection. Imported creative archives preserve history without copying trusted candidates, project ownership, live approvals or spending authority.

## Acceptance and remaining production evidence

Deterministic gates can establish exact source/contract/reference versions, owned asset/checksum/provenance, current approvals, role mapping, unique input count, schema/size/dimensions, quote/authorization scope and replay behavior. They cannot establish whether the pictured person is actually the same person, the framing communicates the intended drama, a claim is true or every visible defect was found.

The human frame review inspects the actual image against the own shot contract and approved identity/look/location images. Check mandatory pictured framing, source state, actor/look, spatial/prop/contact details, material/light plausibility, requested style and text/brand preservation. Compare neighboring selected frames for readable geography, eyelines and world continuity as applicable. A still-frame acknowledgement is neither calibrated semantic QA nor whole-sequence audiovisual acceptance.

F038 advances only its actual frame-lifecycle subset. F039 additionally supports candidate frame selection/review while generated moving-take comparison and acceptance remain incomplete. F040 playable timed animatics remains missing. Actual voice selection/listening, song analysis/alignment, footage generation, motion/physics/performance review, timed sound/editing, final export, real paid provider quality/cost and the two-attempt success target need separate representative production evidence.

Synthetic PNGs, injected providers, local browsers and native metadata can validate the workflow and storage/permission boundaries. They cannot certify photographic realism, temporal continuity, real account/invoice outcomes, customer-account isolation, physical devices, native concurrency or finished-film quality. Final acceptance/evidence records must state those limits explicitly.

See the [storyboard production acceptance record](STORYBOARD_PRODUCTION_ACCEPTANCE.md), [workflow checks](evidence/STORYBOARD_PRODUCTION_CHECKS_2026-10-19.json) and [native metadata checks](evidence/STORYBOARD_PRODUCTION_NATIVE_CHECKS_2026-10-19.json) for the final evidence and its limits.

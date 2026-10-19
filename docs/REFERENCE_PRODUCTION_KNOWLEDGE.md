# Director Studio — reference production knowledge

Revision 1 · 19 October 2026 UTC · First visual-production increment.

## Purpose and authority

This companion defines the craft decisions and acceptance boundaries for original character identities, identity-preserving looks and location references. It connects the approved story and department plans to reviewable image candidates. A candidate, a selected image and an approved production reference are different states. Generating a credible portrait does not establish a consistent character across a film.

The controlling sources are the [Film Studio Blueprint](FILM_STUDIO_BLUEPRINT.md), [Product Experience Specification](PRODUCT_EXPERIENCE_SPEC.md), [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md), [Realism Intelligence Layer](REALISM_INTELLIGENCE_LAYER.md) and [Department Planning Knowledge](DEPARTMENT_PLANNING_KNOWLEDGE.md). The user's [Character Realism Prompting Guide](knowledge-sources/AI_Character_Realism_Prompting_Guide.md) distinguishes biological plausibility, photographic plausibility and identity consistency; these remain separate review questions. Its photographic examples are contextual, not instructions to impose a demographic appearance, portrait lens or realism style on every project.

Specialist guidance read for this increment: [Character Director](skill://plugins_6ac0a590b13c81918f9b80550f073105/character-director/SKILL.md), its [Typography Director](skill://plugins_6ac0a590b13c81918f9b80550f073105/typography-director/SKILL.md), fal [Character Design](skill://plugin_asdk_app_6a19d5012d308191a00a48780f7dcdcc/character-design/SKILL.md) and [Model Routing](skill://plugin_asdk_app_6a19d5012d308191a00a48780f7dcdcc/model-routing/SKILL.md). This document supplies original project-specific synthesis. Skill default models, paid candidate quantities and photographic preferences do not override the approved project, registry eligibility or spending scope. No competitor's private prompts, backend or quality system was inspected.

## The sequence and what each reference means

1. Read the complete approved brief and screenplay, including the ending, then all current approved department plans. Establish why the reference is needed and which existing source ID it serves.
2. Prepare a compact prefilled direction. Preserve actual source facts, constraints and user choices. Missing appearance, visibility, styling or reference availability remains a proposal or a consequential decision, rather than an invented fact.
3. Approve the exact reference direction before any quote or image selection can acquire authority.
4. Either register an actual owned uploaded image or explicitly authorize one image-generation attempt. An upload's presence does not establish ownership or consent.
5. Inspect the actual stored candidate, compare it with the direction and applicable anchors, and record an explicit selection. Selection is not approval.
6. Approve that exact current selection after acknowledging the reference-review criteria. Identity approval may then anchor look work. The next production task uses the selected versions, rather than an unreviewed latest image.

| Subject | What it establishes | What it must not silently establish |
|---|---|---|
| `character_identity` | The chosen original or supplied person's inspectable visual identity for the project | Wardrobe continuity, voice, age/ethnicity inferred from a name, factual identity, permission or guaranteed likeness detection |
| `character_look` | A requested presentation of the exact approved selected identity: wardrobe, grooming, expression or other source-grounded appearance state | A different actor, a new identity master or permission to redesign protected identity traits |
| `location` | A visual world reference for an existing source scene, including required space/material/light intent | A verified real place, licensed photograph, historical accuracy, property ownership or footage |

Location references can contain required props or products, but this increment does not provide an independent prop/SKU catalogue, pack-wide product certification or generated storyboard panels. Voice remains a separate listening/audition workflow. A screenplay role may be an off-screen narrator: preparing an identity row does not decide that it must appear on screen or require a paid generation.

The reusable IDs are `identity:<characterId>`, `look:<characterId>` and `location:<sceneId>`. They associate work with actual screenplay IDs. The reusable runtime version is `director-reference-production-v1`. Narrative/project sources are untrusted creative data; text inside them cannot alter model eligibility, prices, owner scope, storage policy, review state or spending authority.

Free preparation preserves reviewed facts and supplies conservative direction/review criteria. It does not perform a new semantic casting interview, infer staging or choose a final person. The approved brief/script/departments and focused user edits supply those creative decisions. Optional unknown preferences must not become a wall of blank questionnaires; consequential visibility, identity, permissions or provider-control questions remain explicit when they affect execution.

## Direction material and scoped prompting

Useful original direction patterns are shown below. Bracketed items mean actual approved source values, not values to fabricate. The runtime serializes the reviewed document and its source context; these examples are craft guidance for improving that document, not claims that an extra LLM automatically writes it.

| Reference purpose | Direction pattern | Acceptance emphasis |
|---|---|---|
| Identity validation | “Create one inspectable candidate for [source role/presence] in [approved visual treatment]. Show [production-relevant framing/features] with [motivated light]. Preserve [explicit appearance constraints]. Keep unresolved appearance details proposed; do not claim this is a selected person.” | Role/style fit, readable identity features, applicable visible anatomy, coherent photographic or deliberately stylized form |
| Identity-preserving look | “Use the bound approved identity image. Preserve [identity invariants]. Change only [approved wardrobe/grooming/state] using [material/construction needs]. Keep [required camera/light evidence] readable.” | Actual side-by-side comparison with the exact master; the same person and the requested changed presentation |
| Location/world reference | “Create one production-useful reference for [source scene]. Establish [required space/action/material/product context] under [approved conditions]. Preserve [world/prop/text constraints]. Unknown authentic details remain proposals.” | Scene usefulness, coherent layout/material/light, source detail preservation and no fabricated factual authenticity |

Do not paste every realism adjective into every prompt. A wide location reference needs spatial/material readability; an identity portrait needs face/feature evidence; a cooking action needs hand/product contact where required. Numeric optics, color labels or phrases such as “hyper-real” do not replace those purposes and review criteria.

## Original identity and user-supplied identity

For an original character, first establish a story-relevant casting thesis: the role, presence, performance needs and any user-specified appearance constraints. Proposed people should be distinct for a reason. Do not substitute a famous person or borrow an identifiable performer's likeness merely because a model produces an attractive result. An apparent age or other appearance detail can be a deliberate reviewed casting choice; it is not inferred from a name, language or nationality.

The first identity master should make the person's relevant features easy to inspect. Use a simple physical setting, plausible perspective, sufficient focus, readable eyes/hairline and motivated light. A neutral three-quarter chest/waist-up view is useful when appropriate. The source realism contract requires hands to be inspectable when hand anatomy or interaction matters; a face-only avatar does not need hands artificially inserted into every portrait. Do not hide a required hand or product interaction to make a failed result pass.

For a user-supplied person, register the actual private project asset rather than copying an external URL into a direction document. Preserve the original image and provenance. Review permitted use separately. An unseen side, body detail or hairstyle generated from a single photograph is a proposed interpretation, not verified information about that person. A future generated reference must be compared back to the approved master, not only the previous variation; otherwise small changes can accumulate.

The first increment permits an uploaded image to be reviewed and selected without a paid generation. It does not independently verify that the upload depicts the claimed person, establish legal authority or supply a biometric detector. No image is auto-selected or approved because it was uploaded or generated successfully.

## Look development preserves identity

A look begins only from the exact approved selected identity and its subject/selection/asset versions. Record what may change and what must remain. Preserve approved facial geometry, distinctive visible features, hairline/body proportions where established and the intended style. Vary only the requested wardrobe, grooming, expression, pose, lighting or environment.

Wardrobe direction should describe production-useful silhouette, fit, fabric, construction, closures, footwear/accessories and relevant condition. Establish neutral dry continuity before a wet, damaged or weathered state when those changes matter. Do not automatically add glamour styling, blemishes, sweat, tiredness or distressed clothing as a shortcut to realism. A look reference's attractiveness is independent of whether it still depicts the same person.

Look direction must be explicitly refreshed or edited to bind a changed approved identity. Earlier look images and selections remain saved but become ineligible when their identity binding changes. A stale old face must not be treated as a harmless outfit variation. The identity anchor is supplied through the reviewed reference-edit route; a text-only fresh face is not an identity-preserving substitute.

## World and location direction

Connect each scene reference to its editorial purpose, physical geography, time/conditions, required objects and continuity needs. A useful kitchen reference establishes the workable preparation area and product/material context; a dramatic station scene needs coherent entrances, light sources and object geography. Attractive unrelated stock-like imagery does not fulfil that purpose.

Preserve only researched or supplied local, cultural, architectural, historical and branded details as facts. Unknown details may be proposed, but cannot be labelled authentic. A location reference in an Indian advertisement does not imply a particular region, class, religion, household structure or cooking practice. A documentary location concept is an illustration unless independently sourced and cleared as evidence.

Keep recurring surfaces, props, product package, scale, contact and lighting plausible. A liquid pour needs a coherent vessel, contact and flow; a reference still cannot prove the future motion works. When exact package copy or signage is required, preserve approved source material and plan deterministic graphics/compositing where generation cannot reproduce it reliably.

## Photographic and stylized intent

The user's approved visual treatment decides whether the image is photographic, animated, illustrated or otherwise stylized. Photographic instructions apply where photography is intended; they do not override a deliberate anime, graphic, stop-motion or fantasy treatment. Identity, source faithfulness, useful composition and continuity still matter within the chosen style.

For photographic people, avoid waxy smoothing, uniformly mirrored features, synthetic hair edges, implausible eyes, plastic specularity, detached jewellery, malformed visible anatomy and exaggerated sharpening. Detail must fit framing and focus: natural skin variation is useful in a close-up, while repeated high-contrast pores on a distant face are a defect. Polished makeup and beauty lighting can be believable when requested.

Camera/light direction must reveal the intended evidence. Choose perspective and distance that do not accidentally recast the face; sufficient depth of field for identity/wardrobe inspection; motivated key/fill; coherent shadows/reflections; and a restrained treatment appropriate to the brief. Exact millimetres, exposure values or light positions in prose are recommendations unless the route demonstrably exposes those controls. A prompt saying “85 mm” is not rendered optical metadata.

For subsequent views, compare every result with the approved master and source appearance state. Match identity and required wardrobe/world traits while allowing intentional pose/light changes. Pixel equality across angles is not the standard, and a face-similarity number alone cannot establish acceptance.

## Typography and protected source text

Default reference imagery to **TEXT OFF**: no invented names, captions, slogans, decorative labels, environmental copy, pseudo-writing or readable device/UI content. Place candidate names and review instructions in the application UI rather than relying on generated labels inside the image.

Use **TEXT PRESERVE** for approved source packaging/logos/type. Preserve only the approved copy and treatment; do not invent adjacent slogans, health claims or brand variations. If a designed deliverable later needs text, **TEXT DIRECTED** means an exact allowed-text list and placement zones, not permission to fill every wall, prop or screen with copy. Prefer deterministic professional typography for exact words. User-authorized treatments take precedence over generic stylistic defaults.

Audit text-bearing surfaces during actual image review. Wrong SKU/label, invented claims, pseudo-text, unexpected numbers or unapproved environmental copy are defects. These are review instructions, not a claim that OCR or automatic typographic inspection is implemented in this increment.

## Deterministic validation and visual acceptance

| Check | Deterministic authority in this increment | Evidence still requiring actual review |
|---|---|---|
| Source | Current approved brief/script and all 17 fresh approved department versions; exact subject/direction version | Whether the creative interpretation serves the whole story |
| Asset | Owned stored image, exact asset version/checksum and bounded validated PNG import for generated outputs | What the image actually depicts and whether it is suitable |
| Generated provenance | Owned completed job, immutable submitted payload/output audit and matching stored-output receipt | Whether the provider obeyed the requested direction |
| Look identity | Exact approved identity subject/selection/asset bindings | Same-person continuity, relevant visible features and plausible changed presentation |
| Selection | Explicit candidate ID, exact direction/source/asset context and review acknowledgement | Actual image inspection; a successful response cannot inspect itself |
| Approval | Exact current selection/direction, current prerequisites and explicit reference-review acknowledgement | Creative judgement, permissions, factual authenticity and production fitness |

Every direction records a name, production direction, identity/world anchor, intended framing, explicit must-preserve list and acceptance criteria. Each criterion states the requirement, what evidence a reviewer must see and the failure condition. It must be specific enough to reject a beautiful wrong result.

Applicable review questions include:

- Does the actual image fulfil the reference's role and requested style/framing?
- Are identity-critical features readable; for looks, is it the same selected person?
- Are visible eyes, anatomy, grip/contact, fabric and objects coherent for the requested treatment?
- Are motivated perspective, lighting, reflections and material response consistent?
- Are required wardrobe/world/product details present without unapproved substitutions?
- Are approved text/brand surfaces preserved and unintended text absent?
- Is the source/provenance/use decision sufficiently documented for the intended next step?

Review acknowledgements record a person's decision that they inspected the image against the criteria. They do not mean automatic anatomy detection, calibrated identity matching, independent rights clearance or a guarantee that every defect was found. Reject or change the smallest failed scope and preserve the candidate, original reference and earlier decisions for comparison.

## Generation, storage, selection and recovery contract

Free preparation creates missing subject directions from the complete approved source. Existing subjects, histories, selections and image assets remain intact. A focused edit or acknowledged refresh creates a new unapproved version; source/identity changes hold old selections rather than deleting media. All 17 department versions are conservatively source-bound. This is not semantic field-by-field impact analysis.

`GET/POST /api/projects/:id/reference-production` provides the context and free commands. Server `add_uploaded` registers an actual owned stored image as a candidate. Quote and job creation use the specialized `/reference-production/quotes` and `/reference-production/jobs` endpoints and the existing spending authorization lifecycle. Reference images have a narrow prerequisite exception from storyboard approval, because identities/look/world precede storyboard production; that exception must not allow unrelated video/audio, selection records or unrecognized tasks to bypass their gates.

The server builds the canonical generation input from the approved source/direction and reviewed route. Clients do not submit arbitrary provider prompts or external image URLs. `reference_image` serves text-origin identity/location candidates; `reference_look` serves identity-preserving edit work. A look quote requires explicit permission to share the selected private identity reference with the provider. This consent does not waive ownership, model-quality or budget checks.

The current image compiler is explicitly subject-scoped. It includes the complete reviewed subject document; the exact character description or source scene heading/action; the visual-style, setting, tone and constraints brief fields; and the complete casting, look, locations, lighting, continuity and rights department documents. Preparation also preserves all known reviewed brief fields in its must-preserve material. The full approved film and all 17 departments are source-version bound, but the whole screenplay/dialogue is not repeated into this still-image prompt. Review the direction against the whole story before approval; do not describe a scoped still-image request as an LLM's full-film analysis. Included material is not truncated: a prompt above the reviewed 100,000-byte limit is held for explicit scope simplification.

The bounded implemented adapters are `fal-ai/flux-2-pro` and `fal-ai/flux-2/klein/9b` for original identity/location text-to-image, and `bytedance/seedream/v5/pro/edit` for identity-bound looks. This module requests a single 1024×1024 PNG, asynchronous output and the safety checker enabled. The [19 October public schema/price evidence](evidence/FAL_REFERENCE_ENDPOINTS_2026-10-19.json) gives the FLUX2 Pro public example as $0.03 for this fixed-size image; that observation is not a live customer quote or verified invoice. Klein's advertised $0.006 per megapixel lacks a verified exact 1024-square rounding rule, so it remains an unevaluated price candidate. Neither a schema nor an observed price establishes actual quality, account access or activation.

Each explicit paid attempt requests **one image**. Do not silently produce three casting variants because a creative skill proposes three directions. The existing quote, authorization, work-unit reservation, two-attempt boundary, pause, expiry, uncertain-submission and spending controls remain authoritative; this module does not create another wallet. A quote is an estimate, an allowance is permission within its exact scope, Run starts work, and selection/creative approval does not authorize another charge.

Before another attempt on the same work unit, record the visible correction through `/reference-production/reviews` against the actual job and current project version. This review stores an observed problem/reason; it does not automatically diagnose a defect, rewrite the prompt, alter approved direction or start a replacement job. Direction changes require an explicit new reviewed version and the matching cost/authorization checks. The attempt bound applies to its exact work unit; it is not evidence that every user request succeeds in two images.

Completed owned jobs are imported through `/reference-production/import` using their job ID. The server reads the saved provider-output evidence, validates and copies the single supported output into private project-controlled storage, then registers the immutable candidate receipt. It accepts no caller output URL. Generated image ingestion validates actual PNG bytes, dimensions and size up to 10 MiB, uses an allowed fal CDN URL with redirects rejected and stores checksum/provenance. Existing user-upload limits remain separate. An expiring provider URL is not the archive.

Retrying an exact job request or output import reconciles the saved identity instead of silently generating again. A failed image download/storage/candidate registration is an import/recovery event, not permission to rerun a paid model. Preserve unknown submission/accounting states and inspect/retrieve the original job. The user can inspect a completed image while route enablement remains held; neither a receipt nor a display implies provider-invoice reconciliation.

Selection and its later approval remain distinct and version-bound. The reference archive has independent source/subject histories and append-only selection events. It is not mirrored into generic production-library records or automatically selected in a storyboard/shot. Importing a device archive can preserve creative history, but cannot copy trusted generated receipts, live candidate authority, approvals or spending permission into another account/project.

## Three illustrative production cases

These examples describe useful decisions; they do not report real image generation, a listened song, factual research or model-quality validation.

**Cooking-oil advertisement in India.** Use the approved preparation/pour/meal purpose and supplied product constraints. Prepare an original person only when visible casting is intended. Let the user choose a credible photographic or deliberately stylized treatment; do not infer a region, demographic or household. Select the identity master, then derive the requested cooking wardrobe/look without recasting. Prepare a usable kitchen reference with source package/material preservation. Fail wrong labels, invented health claims, hidden required hand/product contact and unrelated luxurious kitchens. Product-only references/SKU workflows remain further work where the current three subject kinds are insufficient.

**Two-minute Hinglish music video.** Read the approved narrative and any actually supplied song decisions. Preserve original vocals and the stated treatment. Identity/looks/location references can be developed without pretending that BPM, lyrics, verse boundaries or measured timing were analyzed. A recurring performer needs a stable selected identity and specific look states, while a lyric-only/abstract film may need no visible person. A still candidate cannot establish singing, lip sync, dance continuity or voice modulation; those need separate actual audiovisual proofs.

**Indian-wealth documentary.** The approved off-screen narrator remains a voice role unless visible participation is explicitly intended. A prepared character row must not force a portrait or identity-generation bill. Location concepts can explore the visual thesis but cannot become factual evidence of ownership, actual events or economic claims. Real archival/location material needs provenance and rights. A photo-real mansion, currency pile or luxury car cannot certify the documentary's facts.

## Release limits

This increment implements reference direction, guarded image-job/import plumbing and exact human selection/approval. It does not prove real provider output quality, reliable identity preservation, complete reference-sheet/angle coverage, prop/SKU management, listening/voice selection, actual storyboard frames, a timed animatic, final footage or a finished film.

Schema discovery and observed prices are not current eligible routes by themselves. Routes remain inactive until exact implemented adapters, configuration-specific prices, current execution/quality evidence and explicit operational enablement exist. Premium defaults and uniformly cheapest-model rules are both insufficient; use the job's actual controls, style, continuity, quality, timing and budget constraints. The two-attempt target remains a measurable ambition requiring representative paid pilots and actual output review.

Final automated, local-browser, isolated SQL and native metadata results belong in the root acceptance/evidence records. Synthetic PNGs and injected providers can validate workflow and storage checks; they cannot establish photographic realism, the same person, factual authenticity, customer-account isolation, physical-device behavior or production acceptance.

See the [reference production acceptance record](REFERENCE_PRODUCTION_ACCEPTANCE.md), [workflow checks](evidence/REFERENCE_PRODUCTION_CHECKS_2026-10-19.json) and [native metadata checks](evidence/REFERENCE_PRODUCTION_NATIVE_CHECKS_2026-10-19.json) for the final evidence and its limits.

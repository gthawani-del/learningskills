# User-supplied Gemini excerpts — deduplicated knowledge review

Reviewed 18 October 2026 UTC. Source: [preserved attachment](knowledge-sources/Director_AI_Codex_Master_Knowledge_Base.md). The source's “2.0.0-PRODUCTION” and “ready for deployment” labels describe its own proposal; they are not evidence about Director Studio. This review changes planning knowledge only. No supplied code or SQL was executed, no provider enabled and no application architecture replaced.

## Authority and deduplication

The [Build Document Index](BUILD_DOCUMENT_INDEX.md) continues to define precedence. The [Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md) controls routing; the [Realism Intelligence Layer](REALISM_INTELLIGENCE_LAYER.md) controls realism. Keep the attachment once as provenance and this reconciliation as its disposition, rather than introducing another competing master blueprint.

| Source sections | Overlap with existing knowledge | Disposition and useful refinement |
| --- | --- | --- |
| 1, 6.1, 8.1: structured shot schemas | Blueprint shot contracts; Bible prompt compiler; runtime validation | Retain one versioned internal shot contract, compiled into endpoint-specific payloads. Add explicit applicability and evidence for each camera/control value. Do not adopt the three inconsistent source schemas as parallel authorities. |
| 1.2, 5, 7: optical and motion direction | Bible §14; realism camera/physical direction | Make movement geometry and units explicit when meaningful. Distinguish intended optical effects from exposed controls and observed results. |
| 2A, 3, 4: blocking, continuity and editing | Intended/observed scene state; HOLD/MOVE/CUT; reference lineage | Add an explicit action-axis and screen-direction review contract, with intentional exceptions and reset coverage. Source attributions remain unverified. |
| 2B, 5.1: ad hooks and pacing | Brief/audience/platform-led direction | Store hook/pacing proposals as testable campaign options. Avoid universal three-second formulas and mandatory audio offsets. |
| 5.1: color consistency | Existing color script and lighting intent | Store per-scene look references and intended transitions; compare observed skin/material color. A hex array is metadata, not a calibrated grade. |
| 5.2, 6.4, 8.2: map/reduce | Department DAG, dependencies, versioned production records | Scope research/reduction to tenant, project, sequence and run; use bounded independent tasks and a version-checked merge barrier. Never reduce different runs into one plan. |
| 9.1: configurable agent prompts and logs | Admin model/skill registry and audit plan | Keep versioned, reviewed skill releases, controlled publication, redacted traces and rollback lineage. Do not copy the provider/model defaults into our stack. |
| 5.2, 9.2: retries | Existing idempotency, uncertain-charge and repair policies | Separate transient retrieval recovery, invalid-plan repair and a new billable creative take. Generic catch-and-repeat is not safe media orchestration. |

## Lessons incorporated into the controlling specifications

### 1. Three layers of a shot contract

Keep these distinct:

1. **Creative intent:** what the audience should understand; blocking; frame/optics/motion/light/performance intent; protected identity/product details; timing and sound.
2. **Executable controls:** exact selected endpoint, supported fields, settings, reference bindings and schema/configuration versions. Each requested control is classified as exposed API control, prompt-only intent, reference/blockout conditioning or unsupported.
3. **Observed acceptance:** actual output metadata, timed visual/audio findings, continuity comparison and user approval of the exact artifact version.

Passing JSON validation proves structure, permitted values and some contradictions. It does not prove physical realism, factual truth, identity, emotional quality or prompt obedience. Generation remains probabilistic even with a deterministic orchestration layer. Unsupported mandatory control holds the route or requires a disclosed alternative.

### 2. Motion representation with appropriate units

Describe camera movement separately from subject movement, and camera position/orientation separately from optics. Translational paths may use distance/time when calibrated; pans and tilts use angular speed; orbits need a center/radius/angular trajectory; lens zoom and focus changes are different operations. Declare coordinate frame, units, duration and start/end states only where supported or useful for previsualization.

A native endpoint parameter or controlled 3D/camera reference may support stronger control than text. A prompt saying “0.3 m/s” is a requested visual behavior, not evidence of metric camera execution. Do not invent API fields or require fabricated coordinates when a brief provides only qualitative direction. When the task needs exact geometry, require a suitable control route and output proof.

### 3. Sequence geography and editorial continuity

For applicable scenes, store action-line definition, subject sides, eyeline targets, screen-space entrances/exits and intended continuity with neighboring shots. An axis change is allowed when intentional: neutral/on-axis coverage, an establishing reset, a visible camera crossing or an approved expressive choice can orient the viewer.

Validate the plan for contradictions, then review the actual sequence for orientation, matching action and eye trace. Unknown geography prompts a question, an additional reference or a review hold; it must not be reported as a mathematically verified axis lock.

### 4. Parallel department work with a controlled merge

Independent research, shot proposals and continuity checks can run in parallel. Each task carries tenant/project/sequence/run identity, input-version hashes, skill/model version, dependencies, budget class and status. Bound concurrency and retain partial results/error attribution.

The reducer checks that all required units supplied valid outputs against the same approved baseline. Merge with transaction/version checks, deterministic ordering, idempotent operation IDs and explicit conflict handling. Do not silently overwrite a newer script or approval. Revalidate cross-shot geography, identity, timing, references and budget after merging. A union of palette strings does not perform those checks.

### 5. Creative standards stay contextual

Use a hook appropriate to the message, audience, placement and brand. Pattern interruption, a product demonstration, dialogue, quiet emotion and an establishing image are all legitimate possibilities. Treat proposed timing as a hypothesis assessed against the brief and, where available, campaign evidence.

J/L cuts, sound bridges, synchronized impacts and beat cuts serve different purposes. A universal three-to-five-frame offset would break intentionally synchronized work, including many music-video moments. Store offsets in a real timebase and review playback.

Maintain a scene's coherent visual language while allowing motivated focal-length, viewpoint, movement and lighting changes. Aspect ratio follows approved delivery/sequence rules. Do not lock all optics across a scene or force every project through the same ad template.

## Claims corrected or withheld

| Source assertion | Reviewed rule |
| --- | --- |
| Strict JSON removes stochastic hallucination or ensures continuity | Schemas enforce representational contracts; generated media still needs evidence-based quality and continuity review. |
| Video models understand numerical velocity and therefore obey physical vectors | Endpoint-specific control must be verified; textual numbers alone cannot establish metric motion. |
| Same seed preserves clothing and face across cuts | Use approved identity/reference conditioning and review. Seeds are optional supported controls, not cross-shot identity locks. |
| Wide/telephoto lenses dictate perspective/emotion | Viewpoint determines perspective; focal length/sensor determine field of view. Emotion depends on context. |
| Every extreme close-up needs at least 85mm to avoid spherical distortion | No universal focal-length threshold. Magnification, working distance, sensor/lens characteristics and desired perspective matter; spherical aberration is not the same as perspective distortion. |
| Every active camera move needs positive meters/second | Static, rotational, orbital, translational and lens actions need distinct semantics; qualitative intent is valid where metric control is unavailable. |
| Every shot must use the same focal length and master hex palette | Preserve intended continuity through approved changes and observed look matching; varied coverage is legitimate. |
| Every positive prompt ≤350 characters, negative prompt required | Use the endpoint's verified limits and supported fields. Detailed direction may require longer prompts; some endpoints have no negative prompt or seed. |
| Only listed camera/lighting/ratio/FPS options are valid | Use an extensible internal vocabulary and capability-based restrictions. Do not reduce the studio to this attachment's small enums. |
| “4k” and “temporal stability lock seed” in text activate controls | Set verified output parameters explicitly. These phrases create no native control and cannot certify 4K or stability. |
| Automatically requeue a failed/blurred generation | Classify the fault, inspect existing provider status/charges, preserve good work and obtain any required revised spend authorization. Respect the two-attempt policy. |
| Listed books are free/open access; lecture excerpts are authenticated transcripts | No source links, speakers/timestamps or licenses establish those claims in the attachment. Treat as unverified research leads. Named books may be copyrighted; do not label them open licensed. |
| Supplied code is production ready; Next.js/Gemini/Flow are our architecture | Treat as illustrative snippets. Existing runtime, authorized fal/OpenAI stack and repository contracts remain authoritative. New providers/framework changes require separate evaluation. |

## Source code review — do not copy these snippets into production

These are faults in the **attachment**, not newly discovered vulnerabilities in the running app. No code from the attachment was installed.

- **Cross-tenant access:** its project/sequence/shot policies check only `auth.role() = 'authenticated'`, and its projects have no ownership column or membership relation. If exposed/granted, those policies authorize signed-in users across rows. RLS being enabled does not provide tenant isolation by itself. Extend existing authorized records; do not create a duplicate `director_ai_*` graph.
- **Privileged server boundary:** a service-role client bypasses normal RLS protections; trusted server authentication, project authorization and parameter scoping remain essential. Keep privileged keys server-only and out of model context. “Environment variables” are not generic creative prompt material.
- **Run mixing:** the researcher cache has no sequence/run/version key or uniqueness constraint. Reduction queries only `project_id`; repeated or concurrent runs can mix unrelated inputs. The sample cache `project_id` has no foreign key.
- **Partial writes and silent failures:** reduction upserts each shot without checking the returned error and without atomicity/version conflict handling. It can return success after partial or failed persistence, and can reset existing state to `validated` without media/approval evidence.
- **Mock extraction:** `mockAgentExtraction` ignores most creative context and emits fixed camera/look/seed values. This is neither an intelligent Director nor actual research or continuity analysis.
- **Schema drift:** JSON Schema, TypeScript, hand validation and Zod disagree about required fields, bounds and identifiers. The JSON Schema leaves unknown properties open, several constraints absent and negative prompts mandatory. The manual validator assumes nested fields exist and can throw on malformed data. One generated runtime schema/contract should govern parsing and validation.
- **Type mismatch:** `processSequenceBatch` declares `results: any[]` but returns an object on success. The snippets were not compiled or tested here; they should not be described as a validated package.
- **Retry classification:** the wrapper retries every thrown error without distinguishing authorization, validation, rate limiting, unknown paid submission status or existing provider jobs. It lacks persisted attempt state, a deadline/cancellation policy, jitter, `Retry-After` handling and charge reconciliation. Its `maxRetries` variable actually limits total operation attempts, not retries after the first call.
- **Incomplete operational records:** proposed logs lack tenant/project/run/request correlation, redaction/retention and audit integrity. Raw prompt snapshots may contain sensitive material. Configs lack reviewed version publication, change attribution, rollback references and scoped operator controls.
- **False readiness:** merging unique colors does not check spatial continuity, light behavior, timing or creative quality. `validated`/`READY_FOR_RENDER` must describe the exact gate passed, not imply full production acceptance.

## Implementation handoff

Carry the refinements into existing components, in dependency order:

1. Versioned internal shot/scene contract with extensible creative vocabulary and endpoint-control evidence.
2. Continuity state and intended/observed geography, protected attributes and motivated exceptions.
3. Department task/run records, bounded parallel planning and atomic baseline-checked reduction.
4. Endpoint compilers, supported controls, current composite pricing and approved budget bindings.
5. Source/output review and scoped repair with durable request/charge reconciliation.
6. Representative storyboard/animatic/film pilots, including intentional axis changes, different focal lengths, synchronized music cuts and unsupported-control holds.

Keep the full existing character/look/voice selection, storyboard, animatic, sound, editorial and export gates. The commercial-focused attachment does not replace the requirements for music videos, documentaries or broader filmmaking departments. No tracked requirement is upgraded to implemented or verified by this review.

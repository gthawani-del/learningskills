# Director Studio — Build Document Index

Updated 17 October 2026 UTC. Planning/document inventory only; no application implementation is authorized by this index.

## 1. Ordered build references

There are **six active planning specifications**, plus this index. The new v2 frontend specification takes precedence for customer-facing UI/UX. It does not replace the production architecture, model routing, realism requirements or administrator design.

| Order | Document | Build responsibility and authority |
| --- | --- | --- |
| 1 | [Film Studio Blueprint](FILM_STUDIO_BLUEPRINT.md) | Product scope, production departments, architecture and shared project lifecycle. |
| 2 | [Product Experience Specification](PRODUCT_EXPERIENCE_SPEC.md) | Earlier customer journey and experience context. Use only requirements consistent with the newer v2 customer specification; do not implement competing layouts or duplicated flows. |
| 3 | [Director Studio Frontend UI/UX v2 Specification](frontend-v2/DIRECTOR_STUDIO_FRONTEND_UI_UX_V2_CODEX_SPEC.md) | Leading customer frontend handoff: desktop/tablet/mobile, FTUE, composer, skills, references, voice states, uploads, approvals, accessibility, components and C01–C32 acceptance criteria. |
| 4 | [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md) | Controlling functionality contracts, model/tool candidates, routing recipes, dated costs and recovery. |
| 5 | [Realism Intelligence Layer](REALISM_INTELLIGENCE_LAYER.md) | Character/world continuity, photographic and performance direction, voice, reusable prompts, evidence gates and attempt limits. |
| 6 | [Admin Backoffice Blueprint](ADMIN_BACKOFFICE_BLUEPRINT.md) | Operations, registry administration, permissions, billing oversight, support, audit and founder controls. Customer frontend v2 does not redesign or supersede this surface. |

This is reading and dependency order, not a requirement to finish the entire customer frontend before implementing backend or admin controls. Authorization, persistence, budget reservations and job state must support the UI before live paid operations become available.

## 2. Frontend v2 package — deduplicated supporting artifacts

Canonical location: `docs/frontend-v2/`. Originals were preserved from the user-supplied ZIP without modifying their contents.

| Artifact | Use | Authority |
| --- | --- | --- |
| [Package README](frontend-v2/README.md) | Package orientation, view modes and implementation cautions | Supporting instructions |
| [UI/UX v2 Markdown specification](frontend-v2/DIRECTOR_STUDIO_FRONTEND_UI_UX_V2_CODEX_SPEC.md) | Full customer requirements | Active specification, counted once in section 1 |
| [PDF handoff](frontend-v2/DIRECTOR_STUDIO_FRONTEND_UI_UX_V2_CODEX_HANDOFF.pdf) | Formatted review document and five visual plates | Presentation companion; do not count as a separate requirements source |
| [HTML prototype](frontend-v2/DIRECTOR_STUDIO_FRONTEND_UX_V2_PROTOTYPE.html) | Illustrative production, briefing and mobile interactions | Visual/interaction reference, not production code |
| [Desktop production screenshot](frontend-v2/screenshots/director_v2_production.png) | Project / canvas / Director hierarchy | Visual reference |
| [Desktop briefing screenshot](frontend-v2/screenshots/director_v2_brief.png) | Conversation with evolving brief and references | Visual reference |
| [Mobile composer screenshot](frontend-v2/screenshots/director_v2_mobile.png) | Selected-shot context and Director sheet | Visual reference |
| [Mobile skills screenshot](frontend-v2/screenshots/director_v2_mobile-skills.png) | Skills discovery state | Visual reference |
| [Mobile attachments screenshot](frontend-v2/screenshots/director_v2_mobile-attach.png) | Upload/library selection state | Visual reference |

The separately attached Markdown and HTML match their ZIP entries byte-for-byte. They therefore add no additional unique documents. The ZIP is a transport container, not another specification. It contains nine files: one spec, one README, one PDF, one HTML and five PNGs.

## 3. Other evidence and historical references

### Research and evidence retained

- [Reference UX Research](REFERENCE_UX_RESEARCH.md): public-site observations and their limits.
- [Endpoint schema snapshots](evidence/FAL_ENDPOINT_SCHEMAS.json): provider input/output evidence.
- [Original price observations](evidence/FAL_PRICE_OBSERVATIONS.json): historical price evidence.
- [Bible price snapshot](evidence/BIBLE_FAL_PRICES_2026-10-17.json): dated observations used in the consolidated plan.

Prices must be refreshed for implementation and actual quotes. Schema evidence does not establish execution readiness or creative quality.

### Historical inputs, superseded for overlapping decisions

- [Tool Registry Specification](TOOL_REGISTRY_SPEC.md): retain useful design detail, but the Bible controls current model/tool decisions.
- [Readable Functionality-to-Endpoint Matrix](FUNCTIONALITY_ENDPOINT_MATRIX.md).
- [105-function CSV](FUNCTIONALITY_ENDPOINT_MATRIX.csv).
- [20-candidate registry JSON](TOOL_REGISTRY_CANDIDATES.json).

The last three are consolidated into the Bible. Do not build separate registries or conflicting requirements from these exports. The earlier inventory described the registry specification as a core reference; this index corrects that classification to historical support because its own notice identifies the Bible as current.

## 4. Review findings for the newly supplied package

### What the package adds

- One reusable multimodal composer across briefing, storyboard, production and edit.
- Distinct `/` skill selection, `@` existing-asset references and `+` attachment pathways.
- Desktop project/canvas/Director panels; mobile focused canvas and Director bottom sheet.
- Typed, versioned skill and asset bindings rather than prompt-name strings and expiring URLs.
- Explicit selected scene/shot/take scope, preserved drafts and scoped repairs.
- Tap-to-talk transcription as a staged capability, with editable transcripts and optional spoken replies.
- Separate creative approvals and server-controlled spending authorizations.
- Thirty-two acceptance criteria spanning UI, security, integration, reliability, device and accessibility behavior.

### Implementation gaps and reconciliation rules

1. **Specification governs the prototype.** Source inspection shows the HTML implements only limited interactions. It does not implement the specified complete keyboard navigation, typed `@` behavior, durable version bindings, persistence or real media services. Treat those as work to build, not completed functionality.
2. **No implicit paid work.** Sending a message, selecting a skill or uploading a reference must not silently start paid media production. Any billable planning, transcription or spoken-response service also needs a defined, disclosed allowance or authorization policy; “no video generation” does not mean every other service is free.
3. **Shared registry, distinct records.** User-facing creative skills and provider endpoints are different concepts. A versioned skill can resolve to a workflow using several tools. Do not create a second competing model registry just to implement the skill picker.
4. **Backend invariants win over presentation shortcuts.** Tenant access, reference validity, attempt limits, atomic reservations and approval dependencies remain required even if the demo can show a button without them.
5. **Activation metrics need separate names.** Track reviewable treatment/storyboard, first accepted generated shot and first accepted export as separate milestones. Do not overwrite historical metrics with a broader label called “first film.”
6. **Voice is staged.** The package places tap-to-talk in P1, although its final definition of done describes voice once enabled. P0 can ship typed interaction with truthful voice availability; voice becomes complete only after device, privacy, cost and integration checks pass.
7. **Visual samples are illustrative.** Film imagery, status badges and privacy claims in the demo are sample content. They do not prove actual generation, persistence or private storage. Reusable UI must render filenames and other user input safely rather than copying the prototype's direct HTML interpolation.
8. **Quality and economics remain unproven.** The package does not validate two-attempt acceptance, character retention, precise camera control, singing lip sync or endpoint execution.

## 5. Inspection performed and limits

Read the Markdown specification and package README, inspected ZIP contents and prototype source, extracted the PDF text and visually inspected all five screenshots. Verified the standalone Markdown/HTML duplicates against the ZIP and checked local Markdown links in this index and the supplied specification.

The prototype was not executed in a browser for this review. No usability study, accessibility certification, production integration, paid model call, application edit, database change or deployment was performed.

## 6. Knowledge consolidation and execution additions

Consult the [Development Execution Plan](DEVELOPMENT_EXECUTION_PLAN.md) after the active specifications and before implementation. It maps work, dependencies, acceptance gates and the current baseline. Consult the [Research Validation Register](RESEARCH_VALIDATION_REGISTER.md) before promoting any new capability.

The three user-supplied filmmaking knowledge documents are preserved in `knowledge-sources/` as provenance, not competing product specifications:

1. [Character Realism Prompting Guide](knowledge-sources/AI_Character_Realism_Prompting_Guide.md): integrated into Realism rev2 §20.
2. [24-Video Breakdown](knowledge-sources/Comprehensive_Breakdown_of_All_24_Videos.md): unverified research backlog, not proof of capabilities.
3. [Master Cheat Sheet](knowledge-sources/AI_Filmmaking_Master_Cheat_Sheet.md): integrated into Bible rev2 §14 and Realism rev2 §20; preserve creator attribution.

[Five refreshed schema snapshots](evidence/KNOWLEDGE_REFRESH_SCHEMAS_2026-10-17.json) add dated evidence; they do not authorize new production defaults.

## 7. Count after this consolidation

Six active planning specifications remain. Two operational documents (execution plan and research register), three original knowledge sources and one schema-evidence file are added. Including this index, existing historical exports, supporting package artifacts and five screenshots, there are **29 retained files under docs/**. Physical-file count is distinct from independent requirements. No source attachment duplicates were added.

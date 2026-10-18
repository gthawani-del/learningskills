# Creative intent: bounded competitor workflow review

Date: 2026-10-18. Status: official public documentation reviewed. Fresh pinned REA target inventory completed, but browser Privacy error pages blocked product UI and bundle inspection.

## What this review establishes

Public guidance from Luma, Hedra and Krea supports a studio that makes creative constraints and reference roles visible, preserves accepted decisions, and makes iteration explicit. It does **not** establish their private prompt libraries, agent architecture, internal memory, practical Theory of Mind implementation, quality guarantees, or success rates. We did not sign in, upload customer material, generate media, inspect private traffic or pay for a competitor operation.

Here, practical Theory of Mind means our own product's bounded representation of what the user explicitly requested, what the system proposes as an interpretation, and what remains unknown. It is a design recommendation, not a claim about a competitor's implementation or an ability to read a person's mind.

## Evidence classes

| Class | Meaning | Available in this pass |
|---|---|---|
| Official documentation / public product claims | A company's published workflow or feature description | Yes, three pages retrieved through the web tool |
| Current public UI observation | A page actually inspected in a browser; interaction recorded separately | Blocked by browser Privacy error pages; no product UI interaction verified |
| Current REA evidence | Pinned REA command with successful target observation and retained output | Fresh parent inventory succeeded; application bundle inspection was blocked |
| Authenticated workflow | An interaction behind sign-in | Not attempted |
| Inferred internal architecture | Hypotheses about private planning, memory, prompts or models | Not verified and not adopted as fact |
| Generated-output validation | Inspection of media produced for a controlled brief | Not performed |

A search crawler's extracted document markup is not equivalent to having clicked through the application's workspace. Public claims also do not establish fal endpoint availability or authorize new providers.

## Official source findings

### Luma: structure the brief and protect original anchors

Luma's [How To Use References Properly](https://lumalabs.ai/learning-center/articles/how-to-use-references-properly), dated March 9, 2026, describes analyzing uploaded materials before creation, organizing constraints and open questions, planning production, and distinguishing changeable elements from original master references. It recommends re-anchoring revisions to those originals and evaluating consistency. This is published guidance; actual preservation quality was not tested.

**Our adoption:** preserve provenance and reference purpose. Maintain a versioned set of accepted constraints independently of the latest output. A proposed interpretation or revision must not silently replace an explicit or approved instruction. Ask about consequential uncertainty before a paid step rather than treating omissions as consent.

### Hedra: distinguish performance inputs from visual appearance

Hedra's [Character 3 public model page](https://www.hedra.com/models/video/hedra/character-3) presents portrait-plus-audio performance, with audio required, and advises clear portraits, clean speech, delivery direction and restrained movement. These are product documentation and recommendations, not a controlled test. Published singing claims do not validate our selected fal adapters or make speech and singing interchangeable.

**Our adoption:** separate character appearance, spoken wording, voice delivery and physical performance in the brief. A style preference cannot substitute for approved dialogue or measured audio. Keep unsupported singing, identity preservation or performance requirements visible as unresolved capabilities rather than choosing a loosely related route.

### Krea: make style references visibly distinct from the subject

Krea's [style-reference guide](https://www.krea.ai/blog/how-to-generate-images-with-style-references-in-krea), dated June 8, 2026, documents a subject prompt alongside an attached style reference, visible reference selection and strength adjustment. It describes controls for a particular model workflow. This review did not operate those controls or verify generated fidelity.

**Our adoption:** role-tag references such as identity, composition, location and style. Show which references actually guide the current proposal. Do not interpret a style example as the user's desired face, demographic attributes, exact location or permission to copy every visible detail. Any strength control must map to an actually supported adapter field; otherwise present it as creative direction rather than a numeric model guarantee.

## Recommended implementation contract

The following is our design, informed by the sources and existing studio specifications. It is not reverse-engineered competitor code.

| Layer | Required behavior |
|---|---|
| Explicit instruction | Retain the user's actual instruction, origin and version. Extracting a structured field must preserve the source text. |
| Proposed interpretation | Label an interpretation as inferred/proposed, explain its supporting evidence, and allow correction. Never promote it to an approved fact automatically. |
| Unknown | Keep material missing details unresolved. A useful default may be proposed, but must remain distinguishable from user intent. |
| Accepted decision | Preserve the approved version until an explicit revision. A newer suggestion alone does not revoke it. |
| Contradiction | Surface the conflicting source and affected decision; avoid silently selecting the newest or most convenient statement. |
| Reference role | Bind assets by purpose and exact version. Distinguish how something should look from who/what it is. |
| Production consequence | Identify affected shots, records and approvals before a revision; retain existing media and history. |
| Model routing | Derive requirements from the reviewed brief, then use verified capability, pricing and payload checks. A competitor's marketing page is not routing evidence. |

### Example

A user says: “A quiet, realistic film about a father waiting at a station.”

- Explicit: film format, restrained tone, photographic style, father, station, waiting.
- Proposed interpretation: still framing and patient pacing might serve that tone. These are suggestions, not locked requirements.
- Unknown: runtime, language, location specifics, intended ending and whether dialogue is wanted.
- Preserved decision: if the user has already approved an understated tone, a proposed dramatic treatment must not replace it without an explicit revision.

A later instruction, “Make the ending hopeful,” updates that creative dimension. It does not authorize changing the character's identity, language, wardrobe, approved dialogue or budget.

## Acceptance checks for our implementation

1. Structured interpretation separates explicit, inferred and unknown fields and records supporting source information.
2. A conflicting proposal cannot overwrite an approved decision through a generic save or model result.
3. A user can inspect the current references, their roles and the decisions being carried forward.
4. Clarification is focused on material uncertainty; harmless optional choices can be offered as editable proposals.
5. A planning result remains proposed until accepted; accepting it is separate from authorizing provider cost or media generation.
6. Applying a revision versions the affected artifacts and invalidates only relevant approvals; media and historical evidence remain available.
7. Missing capability evidence yields a hold, with no silent fallback to a different output type.
8. A polished interface, reference attachment or natural-language explanation is never represented as proof that the output matches the brief.

## REA execution record and limitations

Pinned local package: `rea-agents@6.5.0`, from the existing cache at `/tmp/rea-npm-cache/_npx/ad9a3fdbcad992c6/node_modules/rea-agents`.

This agent prepared `/tmp/creative-intent-research/research.cjs` to open public pages with `ignoreHTTPSErrors: false`, expose Chromium CDP on loopback port 9331, then run REA target listing and public bundle analysis. The initial launch failed before navigation with `setsockopt: Operation not permitted` and Chromium `SIGTRAP`. A network-permission retry did not complete and was aborted; it produced no captures. No target was inspected by that attempt.

An independent target-list command was actually run:

```sh
node /tmp/rea-npm-cache/_npx/ad9a3fdbcad992c6/node_modules/rea-agents/scripts/rea.mjs list-browser-targets http://127.0.0.1:9222 --format json
```

It returned `provider_unavailable`, category `unavailable`, reason `endpoint_unreachable`. This is failure evidence, not application evidence. No successful `analyze-web-bundle` result was produced by this agent in this pass.

The October 17 captures under `/tmp/studio-ux-research` were historical homepage research using `ignoreHTTPSErrors: true`. They are excluded from this pass's current, TLS-verified observation claims. No certificate error or access restriction was bypassed in this pass.

The parent subsequently ran a fresh Chromium session on loopback port 9229 with TLS validation preserved. Pinned REA successfully listed all three requested targets, each titled “Privacy error”. All three `analyze-web-bundle` attempts returned `target_unavailable` / `target_not_allowed`. No product workspace was observed, and no restriction was bypassed. Exact commands, target identifiers and raw inventory/error files are retained in the adjacent evidence JSON. The resulting comparison relies on fresh official documentation; it is not authenticated interaction or internal architecture evidence.

## Build impact

Use this review to strengthen the existing brief, realism, reference and approval specifications. It does not introduce a new provider, endpoint, paid feature, production quality claim or competing blueprint. Relevant foundations remain the Film Studio Blueprint, Model Router Intelligence Bible and Realism Intelligence Layer.

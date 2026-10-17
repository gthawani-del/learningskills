# Film Studio Product Experience Specification Review Draft

Revision 1, 2026-10-17 UTC. Companion to the existing Film Studio and Admin Backoffice blueprints. This specifies proposed FTUE, UX and UI behavior; it is not a tested application or an architectural replacement.

## 1. Experience decision

Recommend a project-centred, board-first studio: start with an idea, develop an inspectable storyboard, approve the creative plan, then produce and edit the film. The application performs complex production work quietly. Users see results, required decisions and spending; activity appears only when opened.

Use conversation for assistance and revision, not as the only record of a film. A screenplay, character, shot, take, timeline and approval must remain directly accessible even when the conversation is long.

Audience: first-time filmmakers and experienced creators bringing scripts or references. Successful first use means a saved project and one reviewed/approved output. A first storyboard is the early milestone; a first accepted generated shot is a separate milestone. Neither is automatically a finished film.

## 2. Directions considered

| Direction | Strength | Limitation | Decision |
| --- | --- | --- | --- |
| Conversation-first | Easy idea entry | Long threads hide artifact state, comparisons and approvals | Use as a contextual assistant |
| Tool-catalog-first | Direct access for specialists | Asks novices to choose technical tools before defining a film | Place in optional advanced access |
| Project/storyboard-first | Makes sequence, decisions, references and revisions visible | Needs thoughtful empty and first-use states | Recommended primary experience |

The recommendation draws from public Krea task entry, Runway organization, Luma visual grouping and the earlier directing/reference workflows. See REFERENCE_UX_RESEARCH.md for sources and limits. This recommendation remains subject to prototype and creator testing.

## 3. First time user experience

| Step | Visible content and action | Required behavior |
| --- | --- | --- |
| Homepage | Show a short example sequence and a single Start a film action; secondary Bring a script or Explore a sample | Examples are labeled, pre-rendered and never imply a paid generation already happened |
| Entry | Choose Short film or Music video; visible secondary Import existing work | Film is the first supported production track; unreleased tracks must not pretend to be usable |
| Guided brief | Idea or script, language, approximate duration, format; optional references/style | Save progressively; ask targeted follow-ups for blocking ambiguities; skip optional tutorial |
| Review direction | Editable concise treatment and confirmed assumptions | Keep changes local until saved; surface unsupported requirements before production |
| First storyboard | Scene cards with readable purpose, frames/placeholders, duration and approval state | Explain the next decision in place; distinguish proposed text plan from generated frames |
| First creative approval | Approve a specific frame/shot contract or request a change | Version-specific creative approval; not spending authorization |
| First production | Show scope, quote/freshness, budget allowance and remaining funds | Explicit paid authorization; do not hide planning/image costs behind a promise of free setup |
| First accepted output | Preview the actual clip with sound where applicable; select take and continue | Give clear progress toward a film; preserve revisions and teach the next action contextually |

Account/authentication should preserve the draft across sign-in. Offer a pre-rendered sample workspace for exploration before a paid action. No fabricated live activity, success countdown, mandatory tutorial carousel or required model choice. A creator with an existing script can go directly to script review and reference mapping.

The guided path is not a fixed questionnaire. Maintain confirmed fields versus suggestions; surface assumptions before they lock creative or financial decisions. No automatic sound playback on entry.

## 4. Information architecture

Global: Projects, Library, optional Templates/Examples, workspace/account settings and usage. Customer routes never expose staff admin functions through navigation alone.

Project stages: Story; Cast & World; Storyboard; Production; Edit; Review & Export. Stages are navigable, not a rigid wizard; unavailable actions explain their dependencies and link to the missing approval/input.

Every stage header shows project and current artifact/version, approval status, one next required decision, save state and budget summary. Keep budget authorization separate from creative approval. An Activity button opens a scoped drawer with job/check history; it is closed by default and never opens just because a new event arrived.

Returning project cards show thumbnail, last accepted stage, actionable blocker and safe resume destination. Reopening restores the last useful selection, latest server state and unresolved decisions. Closing a browser does not cancel running jobs.

## 5. Desktop composition

At wide desktop sizes (proposed 1280 CSS px and above), use a 208–224 px project/stage rail, central artifact area and an optional 320–360 px contextual inspector. A collapsible assistant sits in the inspector area, not beside another competing permanent panel. The media preview remains prominent; no KPI strip in the creative workspace.

At intermediate widths, collapse the rail to a drawer and show preview or inspector on request. Never preserve three columns by making controls unreadable. Exact breakpoints follow content testing; these are layout proposals.

Project header contains title/breadcrumb, save state, compact spend summary and Activity. Primary stage action stays near the artifact or in a bottom decision bar, with cost when billable. No generic Generate button that conceals whether it creates a storyboard, voice take, scene clip or full batch.

## 6. Stage interaction contracts

| Stage | Main artifact | Primary action | Context and recovery |
| --- | --- | --- | --- |
| Story | Treatment/script with scene structure | Approve script version | Inline changes, visible assumptions, imported-script errors, compare prior version |
| Cast & World | Reference sheets grouped by character/location/prop | Approve selected reference version | Compare candidates, voice preview on click, use-rights/consent status, targeted rework |
| Storyboard | Ordered scene/shot cards and timed animatic | Review plan / approve scoped shots | Mandatory vs flexible requirements; reorder with buttons and drag; continuity warnings |
| Production | Actual takes and shot readiness | Generate selected approved shot(s) | Per-operation quote, authorize allowance, selected scope, queued/unknown/failed states |
| Edit | Program preview and timeline | Preview cut / save edit | Source in/out, handles, cuts, dialogue/music/SFX tracks, undo and dependency warnings |
| Review & Export | Playable cut with timecoded notes | Approve cut / export selected specification | Creative approval separate from technical validation; failure preserves inputs and cut version |

The storyboard is the main bridge from novice to expert. Show plain-language intent first. Expand Shot details for framing, camera/light intent, performance, prop/knowledge state and permitted variation. Expand Advanced only for supported model controls; unsupported controls are disabled with an explanation, not converted to invented parameters.

Take comparison supports synchronized sequential A/B playback where meaningful, matching timecode and sound state, version labels and clear selection. Side-by-side is optional for wide screens. Selecting a take does not erase alternatives. Add a neighboring-shot context preview for continuity assessment.

## 7. Mobile experience

Use distinct focused views rather than a scaled desktop editor. Proposed bottom navigation: Projects, Studio, Review and Library. Account/settings live behind the workspace menu. Inside Studio, use a stage chooser; opening a stage restores its selected scene.

A mobile shot-review screen contains project/scene/take identity, safe back navigation, playable preview, scrubber/timecode, contract summary, comparison control, comments and a sticky Approve this take / Request change action bar. Separate spending actions appear in a scoped confirmation sheet. Respect safe areas and keyboard visibility; primary actions must not cover media controls or editable text.

Users can write a brief, upload references, approve cast/boards, inspect takes with sound, compare A/B sequentially, leave timecoded comments, authorize a scoped job, check progress and download/share authorized outputs. Support simple reorder/trim and sound-level edits through dedicated sheets. Complex multitrack work is desktop-led initially; disclose limits and provide Open on desktop without losing selection or edits.

Touch controls target at least 44×44 CSS px as a product design target, with space between consequential actions. Provide buttons for every drag/swipe task. Do not require landscape orientation. Preview expands to full screen; controls remain accessible in portrait. Plan layouts for 360–430 px phones and intermediate tablets, with wrapping text and no horizontal page overflow.

Uploads show actual progress when measurable, retry/resume only where supported, and a safe leave warning during an incomplete local upload. Production continues server-side after a completed upload and accepted job. Push/email notifications are opt-in and not assumed implemented.

## 8. Shared interaction and state rules

Autosave: show Saving, Saved and Could not save. Use revision guards; save errors preserve local edits and block actions needing an unsaved version. Navigation must flush or warn about unsaved edits. Offline edits are marked local; no paid submission can be queued invisibly for later automatic execution.

Concurrent edits: reject stale writes and show compare/merge options. Do not silently last-write-win over approvals or shot contracts. Approvals and job submissions reference the saved version shown to the user.

Pause production stops new submissions in the chosen scope. Explain that already accepted provider jobs may continue and incur charges, while retrieval/reconciliation can proceed. A separate cancellation command appears only when supported, without a refund guarantee.

Budget exhaustion: keep accepted media and editing available; stop new paid work, show reserved/uncertain funds and explain finishing allowance. Never translate a service retry into an unapproved paid creative attempt.

Required states per view: first-use empty, loading with honest activity, no search results, validation error, recoverable service failure, success, stale approval, missing capability, insufficient allowance, offline/unsaved and partial production. Every error identifies the affected item and preserves unrelated work.

## 9. Progressive disclosure and control

Default: media/script results, current approval, next decision and spend. On request: creative controls and short explanations. Advanced: supported model selection, route rationale, endpoint limits and production profile. Activity: task status, reviews, known errors, costs and request references, filtered to the selected scope.

Do not expose agent conversations, internal deliberation or endpoint JSON as the normal customer experience. A readable decision explanation gives intent, selected option, relevant evidence and tradeoff. It does not reveal hidden model reasoning.

Generation authorization shows scope, selected plan version, estimated/maximum allowed spending under our controls, quote freshness, reuse, retries and what remains for finishing. Unknown provider charges remain labeled unknown. Changing scope or price beyond approval invalidates authorization; changing a creative note alone does not grant additional spending.

## 10. Worked shot contract and UI journey

Illustrative example only; no footage has been generated or accepted for this example.

Scene objective: Mara discovers an incriminating letter but conceals her discovery from Ishan. Intended start: Mara knows its contents; Ishan does not; envelope is in Mara's left hand; wardrobe is approved blue coat. Intended end: those knowledge/prop states remain unchanged, while tension rises.

Mandatory shot requirements: medium framing; approved identity and coat; envelope stays in left hand; approved line “Nothing important.”; guarded delivery that conceals the discovery. Permitted variation: minor background movement and noncritical set dressing. Acceptance evidence: played clip, dialogue/audio check and relevant frame/timecode observations. Critical failures include wrong words, hand switch, tight close-up replacing required medium framing, or revealing delivery.

Before production the UI shows this readable contract and locks its version. For audio-driven performance, select/approve the line take and measured pauses first. The adapter submits supported reference/audio inputs and descriptive direction, records exact payload and transformed prompt, and flags requirements that lack direct controls. Schema support never guarantees compliance.

Hypothetical observed output: medium framing and correct words, but envelope switches to the right hand at 00:03.200. Review records the defect/timecode and intended-vs-observed mismatch. The UI offers Request correction or Explicitly revise contract; the take cannot pass the existing contract. Subsequent shots continue using intended state, not the mistake. A correction submits only the approved affected scope under remaining allowance. If unavailable or unaffordable, the user sees the blocker and alternatives; no automatic acceptance.

For a jointly generated audio/video route, words, delivery and timing are checked afterward. For a music video, approved master audio time remains authoritative. Neighboring shots are reviewed as a sequence before the take enters the final cut.

## 11. Visual system proposal

Use neutral charcoal for the media workspace with restrained violet for selection/primary action; light neutral surfaces for document-heavy views and an optional light theme. Do not treat this palette as approved until reviewed. Amber denotes an actionable warning, red a blocking failure, and state labels/icons accompany colour.

Typography proposal: system UI stack with clear fallback, 16 px default body, 14 px standard controls, larger stage headings, tabular timecodes. Use an 8 px spacing rhythm, modest 6–8 px corner radii and fine separators. Artwork provides visual interest; avoid decorative gradients, AI motifs and excessive cards.

Use tooltips only as supplementary explanations. Persistent labels, visible focus, keyboard order, accessible dialog names/focus restoration, captions/transcripts where applicable, reduced-motion behavior and text resizing are requirements. WCAG 2.2 AA is the implementation target, not a conformance claim. Verify contrast in both themes and actual media states.

## 12. Validation and definition of ready

Before UI implementation, agree on the primary board-first direction and review anchor wireframes: homepage/entry, guided brief, first board, desktop take review, mobile take review, and interrupted/insufficient-budget recovery. These are the next design artifacts; this document is not a visual prototype.

Prototype tasks: novice reaches a saved storyboard without choosing a model; experienced creator imports a script and maps references; mobile reviewer comments at a timecode and approves the correct version; creator changes one shot without losing neighboring approvals; user returns after interruption; concurrent edit conflict preserves work; running job does not spend twice after reload; pause and budget scope are understood.

Report design review, interactive verification and real user validation separately. Current status: design specification drafted; competitor public screenshots inspected; our screen visuals, interactive behavior, accessibility and real-user usability remain unverified. Measure first-storyboard/first-accepted-shot completion, time, errors, misunderstood cost decisions and recovery success; do not invent benchmark targets or participant results.

Related execution coverage: [Functionality to Endpoint Matrix](FUNCTIONALITY_ENDPOINT_MATRIX.md), [CSV contracts](FUNCTIONALITY_ENDPOINT_MATRIX.csv), [candidate registry](TOOL_REGISTRY_CANDIDATES.json). These supersede any inference that the four initial endpoint examples covered the whole product.

Current model/tool bindings, all 105 function contracts and dated costs are consolidated in [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md). Earlier endpoint examples are historical where they differ.

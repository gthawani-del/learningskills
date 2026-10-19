# Film Studio Admin Backoffice Blueprint Review Draft

Status: proposed product and operating design for discussion. Companion to FILM_STUDIO_BLUEPRINT.md. This plan does not authorize application changes, database migrations, production access changes, paid services or deployment.

## 1. Vision and founder objective

Build the operating system for running a dependable AI film studio: understand which customers are succeeding, identify where productions fail, intervene safely, control spending and improve filmmaking quality using evidence.

The backoffice must answer five questions: Can customers finish good films? What is stopping them? What does each accepted result actually cost? Which actions are safe and authorized? What should we improve next?

Its primary surface is an actionable production queue with linked evidence, not a page of aggregate revenue counters. Every consequential action needs an owner, scope, effect, audit record and recovery path.

“Commonly overlooked” and “founder advantage” below describe design priorities, not measured claims about percentages of founders. The advantage is faster, better-informed operational decisions supported by trustworthy records.

## 2. Scope and connection to the studio

The customer studio and admin backoffice share authoritative project, asset, approval, job, timeline and cost records. They must not become separate copies of production truth.

Customer authorization, creative approval, technical success, payment settlement and internal review are distinct states. An administrator cannot make an unfinished film complete by changing a status, and internal QA approval does not substitute for a customer's creative sign-off.

Verified context from the companion blueprint: Director Supabase access works; no public tables, migrations, Edge Functions or storage buckets were returned by the scoped inventories. Vercel deployment and fal secret presence are user-reported; the current live application state and fal execution are not verified here. No production backoffice exists by virtue of this document.

The architecture remains a proposal: Vercel application, Director Supabase for identity/metadata, private media storage, durable jobs, fal adapters and a hosted media worker. Validate current infrastructure before implementing admin features.

## 3. Users and authority

| Role | Normal scope | Important boundary |
| --- | --- | --- |
| Founder/operator | Business health, priorities, operational oversight | No default entitlement to browse private films or reveal credentials |
| Production operator | Diagnose productions, reconcile jobs, schedule approved repairs | Cannot expand a customer's spending authorization |
| Creative QA reviewer | Review assigned assets, record timecoded defects and findings | Cannot silently override customer approval or alter original evidence |
| Customer support | Cases, account metadata, consented diagnostic access | Cannot impersonate customers, issue unrestricted refunds or browse all media |
| Finance operator | Reconciliation, refunds, credit adjustments and liabilities | Does not need private screenplay or video access |
| Model/knowledge editor | Draft skill, endpoint and routing changes | Publishing is a separate permission and requires evaluation evidence |
| Release/security operator | Access, deployments, incident controls and auditing | Emergency access must be bounded, recorded and reviewed |
| Service worker | Narrow machine tasks and scoped asset access | No interactive human-admin session or unrestricted client credential |

A founder may initially hold several roles. Keep permissions and actions distinct even when the same person performs them. For high-impact actions, use a second authorized reviewer when available; otherwise restrict scope and require step-up authentication, explicit acknowledgment and later review. Do not pretend a solo operator has independent two-person control.

## 4. Navigation and screen purposes

| Workspace | Primary task |
| --- | --- |
| Today | Resolve blockers and approaching operational deadlines |
| Productions | Trace any film from brief to final delivery |
| Jobs & incidents | Reconcile external requests, worker failures and outages |
| Customers & support | Understand workspace history and resolve an authorized case |
| Quality | Triage defects and compare evaluated versions |
| Models & routing | Manage verified capabilities, availability, pricing and defaults |
| Skills & knowledge | Maintain department expertise and its release history |
| Finance & unit economics | Reconcile cash, credits, provider usage and production margins |
| Assets & rights | Inspect lineage, availability, retention and permission records |
| Product & experiments | Identify friction and evaluate changes |
| Access & audit | Control staff permissions and investigate sensitive actions |
| System settings | Configure environments, operational limits and delivery specifications |

Desktop supports tables, task details and timecoded review. Mobile prioritizes alert triage, bounded pause actions and status checks; sensitive bulk operations should require the full reviewed workflow. Search uses stable IDs, customer/workspace, project, job or payment identifiers. Never place credentials in searchable fields.

## 5. Today and founder operating view

Default priority order: potential unauthorized spend or access; customers blocked from an agreed deliverable; unknown provider submissions; provider success with missing assets; approaching output expiry; payment/credit mismatches; quality/release regressions; routine work.

Each item shows impact, first occurrence, age, affected workspaces/projects, known or uncertain financial exposure, owner, evidence and the next safe action. Group correlated failures into an incident rather than sending one alert per scene.

A separate founder view shows completed/accepted productions, first-deliverable conversion, time to first reviewed export, returning creators, cost and margin distributions, unresolved liabilities, and the highest-leverage quality bottleneck. Every metric links to its definition, time window, denominator, freshness and supporting records.

A green infrastructure status cannot conceal a failed customer journey. A successful API response is not a successful film.

## 6. Production command centre

Project detail has linked views for brief/script, cast/world, storyboard, task graph, takes, timeline, review, costs, delivery and customer communications. The event timeline links each transition to actor, artifact version, task, provider request, policy/skill version and associated cost event.

Operators can inspect what is blocking the next stage: missing approval, unresolved rights, budget exhaustion, unavailable capability, failed retrieval, worker backlog or quality review. Show the precise dependency instead of a generic “processing” spinner.

Permitted interventions are explicit commands: reconcile job; retry retrieval; renew authorized download access; resume a worker task; propose a shot repair; mark a review assignment; pause new submissions; or prepare a revised estimate. Do not offer an unrestricted “rerun project” control.

Changing a script, character, voice or edit creates versions and identifies affected descendants. Preserve previous approved takes and exports. A submitted external job retains its original input snapshot even if the current scene is later edited.

## 7. Job control and failure recovery

Separate: orchestration task, provider request, generated candidate, accepted take and export. One provider request may succeed while retrieval fails; one shot can involve several billable operations.

| Failure | First action | Prohibited shortcut |
| --- | --- | --- |
| Submission response lost | Reconcile the recorded request identity and provider history | Blindly create a new paid request |
| Provider succeeded; asset missing | Retry retrieval or escalate before expiry | Regenerate the clip as the default repair |
| Worker crashed | Recover lease/checkpoint and resume idempotently | Start competing workers on the same render |
| Duplicate webhook | Record/deduplicate and acknowledge | Duplicate assets, credits or charges |
| Webhook missing | Reconcile through bounded polling | Treat silence as provider failure |
| Callback arrives after cancellation | Record actual result and billable outcome; apply retention policy | Drop evidence or assume a refund |
| Partial export failure | Retry the failed assembly/output task | Recreate accepted source footage |
| Endpoint changed | Quarantine incompatible new submissions and investigate | Guess a replacement payload |

Include a dead-letter work queue with ownership, reason, last attempt, next action and escalation. Use bounded backoff with jitter, request timeouts and per-task retry policies. Cancellation and provider refund behavior are capability-specific.

Unknown, stale and unavailable are first-class states. A state repair is a logged corrective event with supporting evidence, not an edit that erases history.

## 8. Models, router and vendor operations

Maintain exact endpoint IDs, capability/schema versions, adapter versions, reference support, task class, duration/resolution/audio constraints, pricing observations and effective dates, availability, usage restrictions and evaluated performance.

Separate vendor availability from our adapter health, credentials/permissions, quota, quality regression and output retrieval. “fal online” does not mean every model or every key scope is usable.

Routing policy is versioned by task type and production tier. Show why a route was eligible and selected. New defaults move through draft, validation, controlled rollout and promotion. Pin in-flight work to its submitted version unless a deliberate migration is approved.

Expose per-endpoint pause, tenant/project restriction, concurrency and spend caps. A model outage can queue or pause work. A fallback that changes quality, supported inputs or cost needs applicable approval rather than silent substitution.

Keep a vendor exposure view: pending jobs, unretrieved outputs, spend concentration and capabilities with no evaluated alternative. The alternative may be manual completion or an honest pause, not another provider.

## 9. Skills and departmental knowledge administration

The skill registry contains source/license, department scope, revision, author/reviewer, input/output contract, examples, counterexamples, capability assumptions, evaluation cases, change rationale and release status.

Keep filmmaking knowledge, endpoint adapters, project references and policy constraints separate but linked. Editing a camera-lighting skill should not accidentally change customer access or model pricing.

A skill release requires schema validation, representative department tests and cross-department regression cases. Track changes in creative quality, cost and manual intervention. Canary only within explicitly allowed trial/budget scope. Roll back future routing while preserving which version produced existing work.

External production-workflow and public filmmaking resources are source material to adapt with attribution and license review. Do not execute newly imported skill instructions with production privileges. Quarantine external text/metadata from privileged tool actions and release controls.

The director capability coordinates; specialist tasks produce artifacts; an independent review path checks material results. Use separate criticism where valuable, not unlimited agents or repetitive LLM judging.

## 10. Quality operations and creative defect memory

Use a shared defect taxonomy: story/causality, acting/emotion, identity, wardrobe/props, geography/eyelines, cinematography, temporal motion/physics, audio wording/pronunciation, speech sync, singing sync, edit rhythm, typography/captions and technical delivery.

A finding records severity, asset/version, timecode, check performed, evidence, confidence/limitations, reviewer, customer effect and proposed correction. Capture manual intervention minutes. Do not store only a single quality score.

Reviews can be pass, needs-human-review, fail or unverified. Technical release blockers and customer acceptance are independently visible. Automatic scores need calibration and false-pass/false-fail tracking; a weighted average cannot hide a critical defect.

The founder advantage is a searchable repair library: defect → relevant inputs/skill/endpoint → diagnosed correction → observed result → actual cost. Record unsuccessful repairs too. This creates evidence for future routing; it is not automatic model retraining.

Review difficult or novel shots before a large batch. Compare reviewers on a calibration set and retain disagreement, rather than treating consensus or model confidence as truth.

## 11. Finance, credits and reconciliation

Keep customer money, purchased/promotional credits, provider expenses, rendering/storage costs and internal support effort as related but separate ledgers. Customer credits are a product entitlement, not necessarily vendor currency or recognized revenue.

Maintain an append-only ledger with adjustments linked to originals. Do not edit a balance without a corresponding event. A refund of money, restoration of usage credits, provider refund and goodwill credit are distinct actions with distinct effects.

| Cost stage | Meaning |
| --- | --- |
| Estimate | Quote with price observation/version, scope and expiry |
| Reservation | Authorized allowance held before work starts |
| Incurred/provisional | Usage believed to be billable, with confidence/source |
| Settled/reconciled | Matched to available provider/payment records |
| Adjusted | Refund, correction or credit linked to the original event |
| Unknown | Unresolved exposure requiring reconciliation |

Show project totals including rejected takes, retries, failed billable requests, reasoning, audio/sync, rendering, storage/egress and support where attributable. Separate cash expenses from allocated estimates and show incomplete attribution.

Useful definitions:

- Accepted media cost per minute: attributable media-production cost, including rejected attempts, divided by non-duplicated accepted timeline duration in minutes. Exclude unfinished work from the denominator but show its spend separately. Do not treat repeated use of the same seconds as newly accepted content without an explicit reporting definition.
- Project contribution: net project revenue under an explicit allocation policy, less attributable variable costs. Display uncertainty and a separate version including support effort. Do not call this company profit.
- First-deliverable activation: a new workspace reaches a reviewed, playable export within the defined observation window. Separate trial, paying and internal cohorts.
- Retry burden: paid operations and cost beyond the initial approved attempt, grouped by cause. Distinguish creative revisions from platform failures.

Subscription allocations, taxes, expiry rules, refunds and financial reporting need explicit product/accounting policies. Verify provider and jurisdiction-specific obligations before implementation; this plan makes no accounting or legal determination.

## 12. Customers, support and service recovery

Workspace detail shows access roles, plan/entitlements, project progress, usage ledger, open cases and relevant incidents. Default support views show operational metadata with private media redacted.

Case-bound access is time-limited, scoped, reasoned and audited. When needed, ask for customer-authorized diagnostic access; do not silently impersonate them. Customer-visible history should distinguish their actions from support intervention.

Offer a diagnostic bundle that excludes secrets and unnecessary private material. Keep a reproducibility snapshot of the affected task and versions. Record ticket-to-defect links, root cause, repair, credits and resolution evidence.

A service-recovery action might be retrieving an already-generated clip, providing an alternate export, extending an entitlement or a bounded goodwill credit. Show expected cost and authorization scope. Do not replace a promised creative result with credits without addressing the production failure.

Refund/fraud disputes require evidence integrity, restricted access and deadlines. Do not promise a payment-provider integration or automatic dispute handling before selecting and testing it.

## 13. Assets, rights and retention

Track ownership/source, permitted uses, performer/voice permissions when applicable, license evidence, expiry, workspace, provider transmission history, object hash, durable location, derived assets and customer approvals.

An approval of creative appearance is not consent for voice cloning, public display, dataset reuse or training. Record these separately. Internal model tests and external case studies need their own permitted-use status.

Use private storage and short-lived, scope-checked links. Staff media access is logged. Logs and analytics should not leak scripts, face references, signed URLs or credentials.

Retention has states: active, archive-eligible, deletion-requested, scheduled, blocked by applicable hold, deleted and verification-pending. Show deletion propagation across originals, derived files, caches, provider copies where supported and backups under their actual retention policy. Report exceptions; do not claim immediate deletion everywhere.

Prevent deletion of a shared asset referenced by an active project without reviewing dependencies. Avoid retaining every rejected video forever; use documented customer/operational policies and measured storage cost.

## 14. Access, audit and emergency controls

Use invitation-based staff access, MFA/step-up authentication, granular permissions and separate server-side authorization for admin commands. A hidden URL or frontend role flag is not access control. Use a private permission model with narrowly privileged server actions; do not put an unrestricted Supabase service credential in the browser.

Audit actor, role, reason, workspace scope, command, before/after references, timestamp, request correlation and outcome. Protect logs from routine operator alteration, define retention and eventually support tamper-evident external archival when justified. “Append-only” is not automatically tamper-proof.

Sensitive controls include credits/refunds, access grants, routing/skill publication, deletion, bulk retry and emergency policy exceptions. Each needs a reviewable scope and effect preview. Require stronger controls for broad impact; keep harmless reads and reversible routine work simple.

Provide break-glass access with expiry, recorded justification, bounded scope and mandatory review. Emergency controls should separately stop new paid submissions, pause an endpoint, pause a tenant, stop new render tasks or revoke an access path. Stopping everything must not accidentally prevent reconciliation and recovery.

## 15. Reliability and incident management

Track user-journey objectives separately from infrastructure metrics: project save, job submission, result retrieval, playable preview and export. Set numerical service objectives only after baseline data; no uptime or recovery commitments are established here.

Incident records include impact, start/detection time, affected versions/jobs/workspaces, spend exposure, owner, mitigations, customer updates, recovery evidence and corrective tasks. Alerts require an actionable condition and owner; suppress duplicates and maintain a fallback contact path.

Runbooks cover provider outage, cost spike, uncertain submissions, lost outputs, failed export, access leakage, storage exhaustion, queue backlog, worker saturation and payment mismatch. A provider's recovery does not close our incident until affected customer work is reconciled.

Backups need restore tests covering relational metadata and media references/objects. Define desired recovery point/time and verify available service capabilities before making commitments. A database backup alone does not recreate deleted media or external provider outputs.

## 16. Founder advantage and commonly overlooked controls

| Blind spot | Proposed founder capability | Decision enabled |
| --- | --- | --- |
| Generated seconds celebrated as success | Accepted-film funnel and defect-adjusted economics | Invest in what helps customers finish |
| Revenue hides manual rescue work | Support/creative intervention cost by workflow | Fix loss-making product paths before scaling |
| API retries treated as free | Unknown-charge reconciliation and diagnosed-attempt history | Prevent duplicate spend and price revisions honestly |
| New models judged on demos | Own benchmark set, difficult cases and regression history | Promote only useful improvements |
| Model ranking ignores customers | Evaluation slices by language, style, task and reference needs | Avoid quality gains for one cohort harming another |
| Storage viewed as cheap | Retention and dependency-aware cleanup | Protect margin without deleting needed work |
| Switching vendors considered a dropdown change | Capability and continuity migration rehearsal | Know which productions survive an outage or deprecation |
| Admin privileges become invisible | Case-bound access, access expiry and sensitive-action review | Support customers without uncontrolled browsing |
| Failed work disappears from analytics | Attempt and abandonment history | Find where the promise breaks |
| Everything labeled “learning” | Separate memory, skill releases and actual training | Improve predictably with rollback |
| Approvals treated as general permission | Version/scope-bound approvals and invalidation | Prevent costly use of superseded decisions |
| Aggregate margins hide liabilities | Unfinished paid projects, reservations and expected completion cost | Understand obligations before spending cash |
| Feature requests drive the roadmap alone | Linked customer friction, defects, costs and cohort outcomes | Choose work by evidence and business impact |
| Successful customers used as training data by default | Explicit reuse permissions and clean evaluation governance | Build an ethical, usable knowledge advantage |

These capabilities are a competitive hypothesis. Their value must be measured, and they should not become a reason to collect unnecessary private customer material.

## 17. Evidence-driven product experiments

Maintain an experiment registry with hypothesis, owner, eligible cohort, treatment/version, primary outcome, quality/cost guardrails, duration and stop rule. Distinguish product experiments, routing experiments and billable creative trials.

Compare releases on complete production outcomes, not only click-through or a model's preferred score. Track time-to-first-export and repeat completed projects alongside satisfaction and contribution. Use representative failed cases and holdouts; avoid tuning every decision against the same small benchmark.

Never use private customer films for evaluation/training without applicable permission. For small cohorts, report descriptive observations and uncertainty rather than overstated causal or statistical claims.

## 18. Operating cadence

- Daily: resolve stranded paid work, unknown requests, retrieval deadlines, customer blockers, cost anomalies and incidents.
- Weekly: review completed-film funnel, top recurring defects, manual rescue effort, cohort economics and the next most valuable repair.
- Before each skill/router release: evaluate representative cases, inspect cost/quality regressions, approve rollout and confirm rollback.
- Periodically, based on risk: review staff access, restore exercises, retention, vendor terms/capabilities and unit-economics assumptions.
- After an incident or pilot: reconcile impacted work, explain the failure, confirm corrective actions and update relevant skills/runbooks.

These are proposed operating routines, not created schedules, monitors or automated jobs.

## 19. Implementation architecture and records

The backoffice consumes the same versioned domain records as the studio, with separate privileged commands. An admin API verifies staff permission and scope, records the intent, executes a bounded command and appends its outcome. Queue/worker commands use idempotency and correlation IDs.

Additional records: staff roles/permission grants; case-access grants; admin commands/audit events; support cases; incidents/impacts; reconciliation exceptions; credit adjustments; model/skill releases; benchmarks/evaluation runs; experiment definitions; retention/deletion requests; operational policies and feature flags.

Financial ledger, production event log and admin audit log have different access/retention needs; link them instead of merging them into an unrestricted log table. Customer analytics events and operational logs are also distinct. Document data classifications and access paths.

Use an explicit environment banner for development/staging/production. Test data must not trigger production providers or payments. CI checks should include permission boundaries, admin-command authorization, webhook replay handling, ledger conservation and migration compatibility. No direct arbitrary SQL editor belongs in the product backoffice.

## 20. Concrete acceptance scenarios

| Scenario | Required result |
| --- | --- |
| Lost provider response | Operator sees unknown submission, reconciles it and retains one billable request |
| Completed job with failed download | Retry retrieval recovers the same clip without generation spend |
| User requests shot revision | Accepted neighboring takes survive; new cost/approval scope is explicit |
| Refund and credit restoration | Separate ledger effects reconcile without duplicate compensation |
| Support opens private project | Access denied by default; authorized case grant expires and is audited |
| Skill release reduces consistency | Evaluation identifies regression; rollback preserves historical provenance |
| Admin endpoint pause | New submissions stop; ongoing jobs can still be reconciled and retrieved |
| Tenant deletion request | Asset dependencies, retention exceptions and deletion evidence are tracked |
| Rendering worker restart | Export resumes/retries without recreating accepted clips or duplicating delivery |
| Founder checks margin | Rejected takes, unknown costs and intervention effort are visible |
| Backup restore rehearsal | Metadata and required media are recoverable under the tested procedure |
| Duplicate callbacks or commands | Balances, artifacts and state transitions are not applied twice |

## 21. Build order and release gates

| Stage | Admin deliverable | Gate |
| --- | --- | --- |
| Foundation, alongside studio records | Staff permissions, event lineage, audit, project/job search, budget ledger and safe command layer | Tenant isolation, authorization and duplicate-action tests pass |
| Internal film pilot | Production trace, task/retrieval recovery, actual cost inspection, QA findings and manual review | Pilot can be diagnosed and repaired without unsafe DB edits |
| Before charging customers | Payment/credit reconciliation, spend limits, support workflow, refunds, access controls, retention and incident runbooks | Simulated financial/failure cases reconcile; no unknown billing behavior concealed |
| Before wider launch | Monitoring, release controls, restore rehearsal, queue capacity and vendor pause controls | Failure drills and scoped rollback succeed |
| During growth | Cohort economics, benchmark-backed routing, repair library, experiment registry and workload forecasts | Demonstrable decisions improve quality/economics without privacy regressions |
| Later, when justified | Enterprise policy variants, delegated review, advanced finance exports and evaluated learning | Real customer/operational demand and sustainable complexity |

Do not build a large polished admin dashboard before basic observability and safe commands. Conversely, do not charge customers before having the controls to understand and reconcile their paid work.

## 22. Initial decisions for discussion

Recommended launch posture: an internal operator console sharing production records; restricted staff roles even for a small team; metadata-first support with explicit media access; one auditable financial ledger; bounded shot repairs; measured quality and actual customer completion as the founder's main view.

Resolve payment/credit semantics, staff-review responsibilities, customer diagnostic-access policy, asset retention and refund/remediation allowances before paid launch. Numeric limits should be configuration with documented ownership, not invented industry standards.

Implement the foundation in the same sequence as the studio. Benchmark and repair intelligence follow observed productions. Do not defer operational evidence collection until after launch, because missing history cannot reliably be reconstructed.

## 23. Source and proposal boundaries

This design adapts the companion Film Studio Blueprint, the three uploaded review reports, specialist production handoff/recovery practices and the previously reviewed public platform workflows. The reports' proposed cost ledger, targeted repairs, versioned characters, quality gates and evidence logs are consolidated here into operating controls.

The permissions, financial controls, incident workflows, founder analytics and implementation ordering are design recommendations for this product, not claims that competitors implement them. No numerical market advantage, legal guarantee, trained predictive model or installed monitoring system is asserted.

Companion: [Film Studio Blueprint](FILM_STUDIO_BLUEPRINT.md).

## 24. Registry management and customer experience alignment

Use the database as the authoritative tool registry and the admin interface for controlled management. Adopt [Tool Registry Specification](TOOL_REGISTRY_SPEC.md), including endpoint/schema/task-binding separation, evidence states, sequence profiles, publishing permissions, atomic budget reservations and internal API contracts. Initial inspected candidates are not approved defaults or database records.

Customer activity stays closed by default under [Product Experience Specification](PRODUCT_EXPERIENCE_SPEC.md). Staff operational views remain detailed, scoped and audited. Never expose privileged admin endpoint controls as ordinary customer options.

Related execution coverage: [Functionality to Endpoint Matrix](FUNCTIONALITY_ENDPOINT_MATRIX.md), [CSV contracts](FUNCTIONALITY_ENDPOINT_MATRIX.csv), [candidate registry](TOOL_REGISTRY_CANDIDATES.json). These supersede any inference that the four initial endpoint examples covered the whole product.

Current model/tool bindings, all 105 function contracts and dated costs are consolidated in [Model Router Intelligence Bible](MODEL_ROUTER_INTELLIGENCE_BIBLE.md). Earlier endpoint examples are historical where they differ.

Current implementation, 19 October 2026: [Model Registry Architecture](MODEL_REGISTRY_ARCHITECTURE.md) and [acceptance evidence](MODEL_REGISTRY_ACCEPTANCE.md) define the owner-only draft/review/publish path for both OpenAI and fal. Provider credentials stay in Vercel; reviewed task/model/pricing/evaluation data stays in the admin/database registry. Supported adapters, unresolved-work guards, explicit customer spending and global generation pause remain separate gates. This does not complete sequence policy, automatic benchmarks, billing or the broader backoffice.

# fal pricing and blog: project knowledge update

Scanned 18 October 2026 UTC. Scope: the public pricing page's 40 rendered model rows and compute table, the blog homepage and five selected filmmaking/voice/model articles. This is not a claim to have read all five archive pages or every post. Two agents/root split the pricing and article review. No models were run, no registry routes activated and no existing prices were silently overwritten.

## Pricing findings

Sources: [public pricing](https://fal.ai/pricing), [public snapshot](evidence/FAL_PUBLIC_PRICING_SCAN_2026-10-18.json), and [15-endpoint connected pricing lookup](evidence/FAL_ACCOUNT_PRICE_OBSERVATIONS_2026-10-18.json). The connected lookup may be cached for up to five minutes; it is an observation, not a final configuration-specific quote.

| Endpoint / role | Observed rate | Source and boundary |
| --- | --- | --- |
| H3 Max reference video | $0.05 / second | Public page and connected lookup agree on the displayed base rate. Resolution/audio/settings still require verification. |
| H3 Max Turbo text-to-video | $0.025 / second public; $0.01625 / second connected lookup | Preserve both sources. The difference's cause was not verified; do not assume an enduring discount or silently use the cheaper value. |
| Kling v3 Pro image-to-video | $0.14 / second | Public and connected base-rate observations; this does not establish identical price rules for every option. |
| Nano Banana 2 edit | $0.08 / image | Public/connected base rate; validate actual image settings. |
| Flux 3 edit-image | $0.048 / megapixel | A megapixel is not an image. Explicit output dimensions and provider billing/rounding rules matter. |
| Z Image Turbo | $0.005 / megapixel | Same unit distinction; do not store this as $0.005 per image. |
| GPT Image 2 / edit | $1 / unit | “Unit” is not proven to mean one image. Requires the endpoint's actual metering/configuration rules. |
| Eleven v4 speech | $0.08 / 1,000 characters | Connected lookup; character definition, proportional/bucket billing and minimum charges need verification before a unit adapter is enabled. |
| sync-3 lip sync | $8 / minute | Connected lookup; do not replace minutes with seconds without an explicit conversion/rounding rule. |
| Flashtalk | $0.02 / second | Connected lookup; measured audio/video duration is required for an estimate. |
| Nemotron audio understanding | $0.01 / 1,000 tokens | Connected lookup; cannot be assumed to mean $0.01 per song or per audio minute. Determine actual multimodal/token accounting. |
| Sonilo / Mirelo video-conditioned sound | $0.009 / second; $0.01 / second | Connected lookup; distinguish duration, synchronization capability and final listening quality. |

The page separates hosted Model APIs from Serverless compute. For example, its H100 row shows $4.50/hour list and “as low as” $2.49/hour. These GPU rates do not become per-second film generation prices for existing hosted endpoints. Discount qualifications and deployment access remain separate.

### Changes required in our cost intelligence

- Store source, observation time, account context, endpoint version, original currency/unit, price configuration and applicable minimum/rounding rules. Keep public and account-specific observations separate; exclude account identifiers from project research files.
- Extend explicit unit adapters beyond the current simple units: megapixels, minutes, thousands of characters/tokens and model-specific “units.” Unknown units stay blocked. A numerical division does not establish the provider's actual rounding/minimum policy.
- Expire estimates when prices/configuration change and obtain renewed authorization when required. Never increase an approved spending ceiling silently.
- Forecast the complete workflow: references, semantic analysis, transcription/alignment, shots, speech/music, finishing, repairs and delivery. Include completion reserves and unknown-charge holds.
- Reconcile against request-level billing events before calculating actual margins/refunds. Public rate × requested duration is not an invoice or complete studio cost.

These are research requirements; this scan does not mark new rate configurations production-verified or enable pricing adapters automatically.

## Blog articles reviewed

| Article / publication date shown | Learning for Director | Evidence limit |
| --- | --- | --- |
| [3D-to-AI action-film pipeline](https://blog.fal.ai/from-clay-3d-render-to-a-real-action-short-a-3d-to-ai-pipeline-with-total-control/) — 13 July 2026 | Separate physical geometry/motion/camera blockout from appearance references; use overlays and staged checks before footage. A controlled-action profile could evaluate render-to-real workflows. | Blog describes `fal-ai/ltx-2.3-quality/render-to-real`, `8k+1` frames and intensity controls; exact current schema remains unverified. It used 200+ keyframe candidates and 132 videos. Those sampling volumes must not be imported into our two-attempt policy. |
| [Introducing H3 Max](https://blog.fal.ai/introducing-h3-max-by-fal/) — 27 August 2026 | Benchmark prompt adherence, aesthetics, continuity and latency separately for each production role. | Provider rankings and generation-time claims are not our measured SLA or proof of acceptable output within two attempts. First-week promotional pricing is historical. |
| [HeyGen models on fal](https://blog.fal.ai/heygen-models-are-now-available-on-fal/) — 2 March 2026 | Evaluate presenter/translation/avatar workflows as distinct routes. An end-to-end video agent is different from controlled shot-by-shot production. | Identity preservation, frame-accurate synchronization, naturalness, language support and singing remain test requirements. |
| [Kling 3.0 prompting guide](https://blog.fal.ai/kling-3-0-prompting-guide/) — 5 February 2026 | Compile stable character names, clear action/dialogue speaker bindings, speaker transitions and separate camera/subject motion. Add endpoint-specific multi-shot recipes where supported. | Article-described duration/shot limits must be checked against the exact current endpoint; prompting alone does not guarantee continuity. |
| [Inworld TTS-1.5 Max](https://blog.fal.ai/inworld-tts-1-5-max-now-available-on-fal/) — 24 March 2026 | Evaluate delivery, pronunciation, supported languages, latency and cost against existing speech candidates. Preserve voice-performance direction separately from the spoken words. | Blog price-per-minute and per-million-character figures are historical and not automatically interchangeable. Reported latency/quality gains need our benchmark. |

The homepage additionally surfaced H3 Max infrastructure/training, Seedream prompting, image-inference optimization and other posts. Only the five full articles above count as reviewed in this scan. GPU-kernel optimization posts do not imply that our hosted-model studio needs to operate its own GPU fleet.

## Intelligence-layer consequences

Use multiple production strategies rather than a universal best model:

1. Reference-driven narrative shots for character/world continuity.
2. Native audiovisual generation where the exact model supports controlled speech/sound and quality tests pass.
3. Audio-driven avatars and localization with identity/consent and articulation checks.
4. Deterministic camera/action blockout plus render-to-real for shots that need precise physical geometry or camera paths.

The prompt compiler should combine user intent, approved character/world records, shot objective, endpoint-specific syntax, measured timing and continuity constraints. The quality layer should separately check composition/geometry, identity, physical contact/motion, voice performance, audiovisual timing and story usefulness. Failing a check should trigger a scoped diagnosis rather than a generic whole-film reroll.

The blog's high-sample demonstrations do not prove our quality target. Low-cost planning and approved references can improve first-pass success, but representative pilots must measure the actual attempt count and total cost. No reviewed article establishes complete song understanding, musical beat analysis and lyric alignment in one reliable model call.

## Incorporation and next work

This note is incorporated by reference into the Model Router Intelligence Bible and build index, alongside the prior official documentation refresh. Preserve the dated observations; future changes should add new snapshots and reviewed registry releases, not rewrite historical rates. The pending routing implementation remains separate from these research findings. Generation and model promotion remain disabled until their existing verification gates pass.

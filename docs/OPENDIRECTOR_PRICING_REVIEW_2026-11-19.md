# OpenDirector public pricing review — 19 November 2026

Read-only research of public pages. No sign-in, MCP connection, checkout, or generation performed.

## What explains the low headline price

The public offer separates a monthly product subscription from metered model usage. The homepage displays regional ₹999 / $19.99 monthly pricing and lists workflows, templates, academy and MCP. Its October example prices include Seedance 2.5 720p/10s $2.31; Veo 3.1 1080p/audio/8s $3.20; Fast $1.20; Kling 3.0 audio/10s $1.26. It also promotes Claude/Codex editing, reusable formats, individual-shot regeneration and a separate SurgeGrowth editor service. These are advertised capabilities, not independently tested here. [Homepage](https://opendirector.co/)

The credit guide says one credit costs $1 plus tax, or ₹112 including GST in India; one balance pays for image, video and audio. Credits are bought separately in packs or a custom amount. It estimates $20–30 of credits for its course, and offers optional automatic top-up. No specific included monthly credit allowance was established from the reviewed public offer. Its current text no longer establishes zero markup; older search snippets still contain that claim and should not be treated as current terms. [Live credit guide](https://www.opendirector.co/learn/get-credits-for-ai-models/)

Inference: a modest software access fee plus usage billing makes the headline subscription look inexpensive without promising unlimited generation. Subscription revenue and the advertised human service are visible business channels. Actual supplier agreements, margins, profitability and any cross-subsidy are unknown.

## Upstream sanity check

| Matched configuration | OpenDirector homepage example (October) | Google public rates observed |
| --- | --- | --- |
| Veo 3.1, 1080p with audio, 8 seconds | $3.20 | $0.40/second × 8 = $3.20 |
| Veo 3.1 Fast, 1080p with audio, 8 seconds | $1.20 | $0.12/second × 8 = $0.96 |

Google Cloud's live table lists the same $0.40/$0.12 rates; Google's indexed Developer API pricing explicitly labels them per second. The Developer API page now redirects to a broader page without a Veo section, so the live Cloud table is the clearer surviving reference. These figures do not establish OpenDirector's upstream contract. Fast's older displayed example is 25% above the observed current Google public price; OpenDirector explicitly says the app shows current rates. Do not interpret that dated mismatch as proof of its current markup. [Google Cloud pricing](https://cloud.google.com/model-garden/pricing), [indexed Google Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=en)

Their generic “other platforms 2–3×” table and “cheapest” claims are seller claims, not a verified market-wide comparison. Compare identical model/version, duration, resolution, audio, retries, subscription, taxes and credits actually consumed.

## Total project cost matters

The pricing lesson (updated 26 October; rates dated 16 October) explains that settings change the price on Generate, and charging starts when Generate is pressed. It recommends inexpensive drafts and upscaling. Its 15-second phone example totals roughly seven credits, including images, music, video, upscale and a rejected draft. This is a stronger benchmark than one successful clip's advertised price. [Pricing lesson](https://www.opendirector.co/learn/ai-model-pricing-compared/)

Illustrative arithmetic, assuming a subscription is required and no included allowance: ten $3.20 clips cost $51.99 with a $19.99 monthly fee, before relevant taxes; one hundred cost $339.99. The subscription allocation falls from roughly $2 to $0.20 per clip. This is arithmetic, not a checkout quote.

## Public terms need reconciliation

The June-dated terms describe prepaid workflow credits, nonrefundability, nontransferability and forfeiture at account termination. They say expiry depends on credit type, while the newer tutorial says purchased credits never expire. Terms address a broader B2B marketing platform and provide no precise generation concurrency, storage/export allowance or monthly included credit amount for this offer. Those limits remain unverified. [Terms](https://opendirector.co/tos.html)

## Lessons for Director Studio

- Show subscription, included usage, purchased usage and taxes together before checkout.
- Put a currency estimate beside Generate and update it with model/settings; show project spending including rejected takes.
- Offer a low-cost draft path, approve storyboards/references first, preserve successful shots and regenerate only selected shots.
- Lead with finished workflows and reusable character/product/location references; expose advanced model choice when useful.
- Make credit expiry, failed-job refunds, storage/export limits and cancellation behavior consistent across UI, help and terms.
- Benchmark quality-adjusted finished projects and transparent current unit rates. Compete on control, continuity and fewer wasted takes rather than an unverified lowest-price claim.

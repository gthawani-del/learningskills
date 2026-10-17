# Public Reference Workflow Research

Checked: 2026-10-17 UTC. Purpose: inform the proposed film studio experience. These findings do not establish competitor backend implementations, generation quality or usability with actual participants.

## Evidence collection

REA 6.5.0 connected to an isolated Chromium CDP browser and analyzed captured public-page bundles for Krea, Runway and Luma. Browser DOM text, links and desktop screenshots were also collected and visually inspected. Browser navigation used an isolated context accepting the environment's untrusted certificate chain; no credentials, account creation or paid generation were used.

| Requested site and observed destination | REA evidence ID | Parsed scripts | Meaning |
| --- | --- | --- | --- |
| https://www.krea.ai/ | ev_2ce79b9ce9de4523e797dceda2dd13a759ff719fa7d7d140aa33828556009ba6 | 641 | Captured source examined, no parse failures reported |
| https://runwayml.com/ → https://runway.com/ | ev_1086db5381c04b8b95ba3d877fc898c6be8fbd90b642b0745c56b7ff76514f6a | 69 | Captured source examined, no parse failures reported |
| https://lumalabs.ai/ | ev_a1b6fa6f6fdffb54a7c1f7902da6e9a6fa4dda1fb6b4db3a3c745fb1ecdeae3d | 56 | Captured source examined, no parse failures reported |

REA's completeness status refers to captured source examination. Endpoint-looking strings do not prove network execution; private routes, server-side orchestration and signed-in workflows remain unknown. Raw research files are temporary under /tmp/studio-ux-research, not a durable product archive. Evidence IDs and observations are preserved here; no runtime service should depend on those temporary files.

## Patterns and proposed application

| Reference | Observed or documented pattern | Adopt for our studio | Avoid or qualify |
| --- | --- | --- | --- |
| Krea | Public navigation separates generation/editing/enhancement; public Apps directory; concise creation entry points | Compact, task-specific composer and contextual tools | Do not make a large model/tool catalog the first-time user's primary decision |
| Runway | Public guide documents Tools, Apps, Agent and Workflows; outputs organized into Sessions; project guides connect sessions/workflows/assets | Project continuity, take history and outcome-specific actions | Do not require a novice to choose an orchestration mode or node graph |
| Luma | Public landing page leads with an idea/task; public guide describes Boards for project grouping and Ideas for generated assets | Simple brief entry and persistent visual workspace | Boards guide is dated 2024; current app landing indicates product migration, so do not claim exact current editor behavior |
| OpenArt | Earlier reviewed public documentation describes script-to-storyboard and character reuse | Guided story-to-board and saved cast/world | Reference fidelity and complete-film quality remain to be tested |
| Higgsfield | Earlier reviewed build account describes camera/optics knowledge, reusable elements and model independence | Story-motivated shot controls and sequence visual profiles | Camera language is not necessarily an executable optical simulation |
| Hedra | Earlier reviewed Studio page documents reusable Skills/Elements and a shared creative canvas | Reusable project references and production recipes | Do not expose backend departments or complex graphs by default |
| LemonSlice | Earlier reviewed page documents image-driven live conversational avatars | Keep avatar identity, voice and performance assets reusable | Live conversation is distinct from scripted film performance and offline lip-sync |

## Sources

- https://www.krea.ai/ and https://www.krea.ai/apps — public pages inspected during this pass.
- https://help.runwayml.com/hc/en-us/articles/37425232841875-Getting-Started-with-Generative-Video — full public guide read, including entry, modes, generation and iteration.
- https://help.runwayml.com/hc/en-us/articles/52474981372563-Creating-a-Project — discovered official project reference; project details should be rechecked before treating them as an implementation contract.
- https://lumalabs.ai/ and https://app.lumalabs.ai/dream-machine — public destination inspected; the latter gives a migration entry, not editor access.
- https://lumalabs.ai/learning-hub/navigating-boards-ideas — full guide read; publication date 2024-11-18.
- https://openart.ai/features/ai-storyboard-generator/
- https://higgsfield.ai/blog/how-we-built-cinema-studio
- https://www.hedra.com/studio
- https://lemonslice.com/

The last four are prior public-documentation findings in this conversation, not newly captured REA editor sessions. Signed-in interactions, first-generation completion, cross-device resume and generation economics have not been tested on any competitor account. Mobile interaction recommendations are our proposed design, not observed competitor behavior.

## Recommendation

Use a project-centred, board-first studio with a small contextual composer, progressive controls and focused review. Conversation helps develop and revise the film, while durable artifact views hold the actual production truth. Keep the customer interface centred on creative results; use separate admin views for endpoint and production operations.

This is a design recommendation supported by relevant product patterns, not a claim of proven superiority. Validate it with our own prototype tasks and creators before a usability claim.

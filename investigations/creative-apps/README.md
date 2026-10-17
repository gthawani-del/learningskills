# Four-app investigation: public evidence and build direction

Sources reviewed: [OpenArt](https://openart.ai/), [Hedra](https://www.hedra.com/), [Hedra Studio](https://www.hedra.com/studio), [LemonSlice](https://lemonslice.com/), [Higgsfield](https://higgsfield.ai/).

## Evidence scope

Public-page text was retrieved through the web connector. These are product claims and navigation observations, not independently tested generation capabilities. REA 6.5.0 successfully connected to local Chromium through CDP and returned browser-target evidence. Direct browser navigation to all four domains failed with ERR_CERT_AUTHORITY_INVALID, leaving Privacy error pages. Those pages are not valid application captures. No authenticated UI, application bundle, internal API, model weights or backend source was inspected.

## Product patterns

| App | Publicly described workflow | Candidate implementation |
| --- | --- | --- |
| OpenArt | Image/video tools, reusable characters and chat-directed storyboards | Project with character references, shot briefs and asset history |
| Hedra Studio | Shared creative canvas, reusable Skills and saved Elements | Reusable workflow definitions and project asset records |
| LemonSlice | Image-based interactive avatar connected to voice/LLM services | Separate real-time session flow with connection and interruption states |
| Higgsfield | Image/video/audio navigation, effects presets and public project recipes | Preset selector that populates editable generation settings |

These patterns suggest an original studio with project, asset, recipe and job records. This architecture is a proposal, not a finding about the vendors' internals.

## Proposed first build

Start with a project workspace that saves briefs, references and reusable recipes, then add one authenticated media provider. Treat image/video generation jobs and live avatar sessions as separate lifecycles. Never show a simulated generation as a completed model output.

Acceptance criteria for the first implementation:

1. A project and its recipe survive reload.
2. A recipe populates editable inputs without discarding existing work silently.
3. Missing provider configuration is shown before submitting a paid job.
4. Job failures retain inputs and support an explicit retry.
5. Real output assets include provider/job provenance.
6. Avatar sessions expose connecting, active, interrupted, ended and failed states.

The requested URLs are confirmed; the choice of first feature remains open. No media model integration or generation feature has been implemented yet.

## Next evidence pass

Use a browser with valid certificate trust, open the relevant public tool routes, and run the repository inventory script against its loopback CDP endpoint. Choose one workflow per app and record inputs, validation, pending/error states and resulting assets. Capture bundles with REA only after confirming that the target is a real application page. Authentication and provider access are additional dependencies where required.

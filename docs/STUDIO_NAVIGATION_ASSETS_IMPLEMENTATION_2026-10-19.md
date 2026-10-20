# Studio navigation and Assets implementation

## Scope

Implement the agreed Runway-referenced product navigation without adding a second project store or a fourth desktop pane. The left menu contains Home, Create, Projects, Assets, Brand & characters, Usage & costs, Help, and Account / workspace.

Create exposes Movie / short film, Advertisement, Documentary, Docuseries, Microseries / drama, Music video and Talking avatar. Image, Video clip and Audio are individual-media entry points. One shared catalogue defines labels, validated format IDs and task-specific production outlines for browser drafts, cloud project validation, the brief editor and model-registry format declarations.

These are production entry points and shared project records, not a claim that every media workflow is now complete. In particular, new format declarations do not approve models, execute planning, deliver episode orchestration, or validate finished films. Existing approved routing, pricing, spending, reference and output-quality gates remain in force. No endpoint or price was guessed, and no provider request was made for this implementation.

## Layout and links

Home offers a compact creation composer with visible file upload and recent projects. The current project remains resumable while visiting studio pages. Routes support reload and browser history; typed entry text and pending attachments survive in-session studio navigation.

Desktop production reuses the existing three elements: left project/navigation rail, centre Director/creation controls, large right viewer and sequence. Standalone image, video and audio projects preview their project references without requiring a film shot; image references can be selected and audio/video can be played. Their brief handoff goes to references or storyboard as appropriate. Image direction omits runtime from the summary. Audio entry defaults to a master song only for music-video projects; other productions receive a voice reference. The briefing inspector remains a briefing inspector. Below 1000px the studio navigation becomes a drawer; the production interface uses existing focused panels. Mobile headers retain costs/account/save actions and move duplicated navigation actions into the menu. The existing footer/composer separation is preserved.

Projects reuses existing cloud and IndexedDB records. Brand & characters opens saved character references and project production libraries. Usage & costs opens the existing project quote, allowance and spending interface. Account uses the existing authentication and device-draft migration flow. Help explains the actual supported steps and limits. Backoffice remains restricted by the existing administrator check.

## Assets

The Assets page has Images, Videos, Characters and Audio tabs. Characters includes versioned character records and identity references. A character portrait is shown only when its exact referenced asset version is available; an unselected portrait is explicit, and linked identity images are not duplicated. Other media use their MIME category. Documents remain in project references. Assets are read from existing project-scoped endpoints or device IndexedDB, retaining project identity even when titles or filenames match.

The library supports search, project filtering, image previews, MP4 playback, audio controls, opening the source project and adding an asset to the selected project. Private cloud media keeps the existing session and signed-media behavior. The loader bounds concurrent reads to four projects, shows partial failures with retry, and discards obsolete asynchronous responses after navigation or account changes. No new storage bucket or database migration is required. This is not a new cross-project asset-copy or cloud character-training service.

## Verification

Use the existing `npm run qa` command for release checks. The existing runner includes `studio-navigation-browser` and six new unit cases; API checks also verify every offered format through create/read/edit and static module retrieval. Targeted checks can use `npm run qa:fast -- --changed apps/director/public/studio-shell.js apps/director/public/studio-catalog.js`.

Actual Chromium evidence is in `test-results/studio-navigation/`: desktop 1440×1000 and mobile viewport 390×844. The flow creates all ten format drafts, exercises navigation, asset categories/search/project filtering, selected-project upload, real local video playback, keyboard tabs, reload recovery and the right-hand desktop preview geometry. Console and HTTP errors are collected. First-use authentication uses the existing simulated identity fixture; it is not a live Supabase/email test.

The accompanying QA summary records the final full-suite result. No physical mobile-device, live paid-provider or production-deployment verification is implied.

## Release and rollback

Base: main `bb100bfbe39d538a053ca9281f36b0fe99c898b1`. This change includes the previously prepared first-use upload/account work because the new entry and navigation reuse it. No dependencies, credentials or deployment-security settings change.

Review the pull request and CI evidence before production promotion. After an authorised deployment, verify fresh entry, sign-in, project reopen, all four asset tabs, upload targeting and production playback on the deployed URL. If those fail, use the existing release procedure to return to the preceding deployment/revert the change; retain user projects and media. Older builds will not offer the new production-format choices, so avoid modifying or deleting those records during rollback.

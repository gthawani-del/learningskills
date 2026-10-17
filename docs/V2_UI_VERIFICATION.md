# Director v2 UI correction

Implemented the approved briefing and graphite production layouts, with responsive project navigation and Director/film brief drawers. Production includes a selected-shot viewer, playback controls, shot sequence and audio reference lanes.

The public entry supports explicitly labeled browser-device drafts while cloud configuration is incomplete. These drafts persist editable brief, story, shots, version approvals, direction notes and uploaded media in IndexedDB. They do not authorize or simulate model generation. JSON download exports project metadata, not a rendered movie. Browser storage can be cleared; this is not cloud backup.

Validation: automated API/provider/job/render suites, syntax checks and production packaging. `apps/director/tests/v2-workspace.py` exercises actual browser interactions for brief/story/shot editing, approvals, image preview, uploaded MP4 playback/pause/seek, reload persistence, direction notes, cloud availability gate, JSON download and 390px viewport drawers/overflow. Screenshots use synthetic QA media. No physical mobile device tested.

Remaining: production Supabase credentials/configuration, authenticated cloud project and asset persistence verification, validated enabled model routes and cost authorization, generation, hosted movie assembly/export. This update does not claim a complete AI filmmaking pipeline.

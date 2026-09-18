# Post Review: prompts and media coexistence

## Compact review layout (September 17)

Layout refinement only: the modal uses 94% of the viewport width (capped at 1480px), tighter padding and 92% of viewport height. Review columns appear from tablet width and stack on mobile. Prompt, generation controls and media preview appear before detailed slide/script content; slide cards and Hashtags/First Comment use paired rows on wide screens. Nested slide fields avoid duplicate borders/padding. Schedule date, time and actions share a row where space allows. Controls wrap on narrow screens; the review action footer remains outside the shared body scroll.

All original event/action callbacks, editable/disabled expressions, upload input types, media props and permission bindings were compared before/after using TypeScript AST fingerprints: all 110 bindings across the three UI modules are unchanged. No server action, lifecycle, upload or provider implementation changed for this refinement.

## Evidence and scope

This workspace has no Git metadata. The preserved `qurtiz-after-fixes-20260916.zip` backup contains the original `MediaUploader` integration, multi-file Carousel selector, individual remove/reorder, one-image preview, native video controls and the signed-upload helper. These implementations were still present in the current source; they were reused.

The later prompt/editability changes switched the uploader's `editable` prop from the workspace permission to review editability. That hid upload controls for scheduled/published states. Controls now remain visible and disabled with a state-specific explanation. Approved content requires revoking approval before media changes, consistent with the existing server guard. Prompt editing behavior is unchanged.

A separate end-to-end mismatch was confirmed through a read-only database audit: Carousel parent items can have Reel platform variants. The UI used the variant format while the upload server and publishing format guard used the parent format. Reel uploads could therefore be rejected as image-post uploads. The active variant is now included in the existing encrypted upload ticket and verified against workspace/item ownership at authorization and final attachment. Legacy callers without a variant keep their original parent-format behavior.

## Preserved functionality

- Post-level Visual Prompt, slide prompts, copy/edit/save, Master AI Prompt and visual generation remain in their existing positions and use their original actions.
- Existing signed Storage upload, byte/MIME validation, database attachment, recovery ticket, file limits and private signed previews are reused.
- Carousel ordering remains persisted as `slideIndex`. Append and reorder operate on the image family so a sibling Reel video is not counted, moved or changed. Individual removal continues to use the existing action.
- Carousel preview shows one image, previous/next controls and position indicator; Reel preview uses native video controls.
- Publishing selects the compatible media family for the active variant, with existing upload precedence, generated-slide deduplication, signing and Meta-first/Buffer-fallback routing preserved. Incompatible-only media still reaches the format error guard.
- Parent format supplies a UI fallback when variants have not loaded. Existing media lifecycle guards remain enforced.

## Regression coverage

Follow-up: a Carousel card previously opened `variants[0]`, even if that row was a legacy single-image platform variant. Initial selection now prefers the variant matching the card's format. An Add images/Upload video trigger in the existing review header opens the same media input, making uploads discoverable above long slide prompts without moving or changing any prompt field. The header trigger is disabled during upload and follows the existing media-edit lifecycle. A regression case covers single-image-first database ordering under a Carousel card and the header upload affordance appearing before slide prompts.

Post Review tests assert prompt/media coexistence for all three formats, slide prompts, Master Prompt, multiple file selection, one visible ordered image, navigation/position, remove/reorder controls, fallback format and read-only visibility. Signed-upload tests check variant authorization and finalization retry without duplicate upload. Server authorization tests cover Carousel images, MOV under a Reel variant of a Carousel parent, mismatched MIME and scheduled variants. Publishing tests verify independent ordered Carousel and Reel selection from shared media.

The broad suite retains single-image, AI output, approval, scheduling, Meta/Buffer, First Comment and media payload coverage. The existing live storage smoke script checks actual signed uploads and private preview bytes for PNG, MP4, MOV and WebM, then cleans up only its own isolated test objects.

Browser interaction and real social-provider publication must be verified on dedicated test accounts to establish live UI/publishing results; hermetic provider tests and storage smoke checks do not constitute that proof.

### Further compactness refinement (September 17)

- Topic uses an inline label at wider screen sizes; card headings and body padding are tighter without reducing body text size.
- Hashtags/First Comment and Carousel slide prompts pair at laptop widths (lg), while smaller screens retain stacked fields.
- Media previews remain one image/video at a time, with a 220px mobile / 240px desktop height cap. Empty and unavailable-preview states use 96px instead of oversized placeholders.
- Review footer buttons use consistent compact sizing (32px mobile, 28px desktop); all action labels remain available.
- AST comparison against the immediate pre-change files confirmed all 92 functional JSX bindings in the two modified components are unchanged. No backend or persistence changes.
- Existing suite: 528 tests across 42 files passed, including all 10 Post Review regressions. Typecheck passed. Browser interaction/visual verification remains separate from these automated checks.

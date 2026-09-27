# Brand Brain logo lifecycle

## Audit and root cause (2026-09-27)

Brand Brain text forms update only columns on `brands`; no text-save or AI regeneration path writes `brand_assets`. The logo is a workspace-scoped `brand_assets` row pointing to the `brand-assets` Storage bucket. The actual loss risk was `AssetUploader` calling `deleteBrandAssetAction` from the logo tile immediately, without confirmation. That action soft-deleted the row, reduced `ref_count` to zero, and queued permanent Storage deletion after 24 hours. Repeated clicks could enqueue the same asset twice. Brand Brain load and visual compositing also selected assets without checking cleanup state, so a logo pending deletion could still appear until the worker removed it.

The configured database had one uploaded logo, with an existing Storage object, marked `soft_deleted` and `ref_count=0`, plus two pending `asset_removed` cleanup entries. It was restored to `permanent` and `ref_count=1` in a transaction; both pending entries were cancelled. A fresh read found one active logo, no pending cleanup, and a Storage object. A newly generated signed URL returned HTTP 200, `image/jpeg`, and 939,533 bytes. No workspace data or other media was recreated.

## Current behavior

- Text, partial, invalid, and AI-generated Brand Brain updates do not send a logo deletion instruction. An omitted, null, or empty logo field in a generic text form does not affect the logo row.
- A new logo upload first writes a unique object to Storage. A workspace-locked DB transaction inserts the new row, then marks prior active logos for delayed cleanup. If upload or DB commit fails, the old logo remains active; the new unreferenced upload is removed on a best-effort basis.
- Remove Logo requires a browser confirmation and an explicit `removeLogo: true` argument. The server and media lifecycle reject a logo cleanup request without that flag. Repeated removal does not create another cleanup entry.
- Brand Brain loads and visual generation use only permanent, referenced assets in the active workspace. A stale cleanup entry for a permanent logo is skipped by the worker.
- Content Studio templates and AI visual finalization use the real stored logo for compositing. If a selected logo cannot be downloaded, visual generation now returns an error rather than silently omitting it. Master Prompt, Agent and Auto Run retain the instruction to reserve space and never invent a logo; the shared Brand Brain summary includes the saved-logo policy.
- Workspace ownership is enforced in asset queries and mutations. Logout, browser restart, page refresh and deployment do not change the DB/Storage reference.

## Verification

Targeted logo and media lifecycle tests: 34 passed. Full app suite: 856 passed, 1 skipped. Typecheck passed. Schema validation: 33 tables, 0 problems. Isolated production build passed with the pre-existing AI SDK dependency warnings. The new regression tests cover upload, text and invalid saves, replacement ordering, failed upload/commit, explicit removal, workspace isolation, duplicate cleanup and stale cleanup protection.

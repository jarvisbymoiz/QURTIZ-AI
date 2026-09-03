import type { PublishProvider } from "@/lib/publish/provider";

/**
 * Client-safe pure logic for the publishing-provider feature (no db imports —
 * this module is imported by client components, unlike lib/publish/provider.ts
 * which pulls in the database layer).
 */

/** True when a surface whose data comes from Meta-only APIs (analytics
 *  sync, Instagram Business Discovery competitor snapshots) should show an
 *  honest "this needs the Meta route" notice:
 *  - provider "buffer": publishing is routed to Buffer, so the user expects
 *    results from that connection — but Buffer feeds neither analytics nor
 *    competitor research, and no Meta connection was ever made;
 *  - hasBufferConnection: the user actually went down the Buffer path (the
 *    notice explains a real gap instead of duplicating the generic
 *    "no accounts connected" empty states);
 *  - hasMetaConnection false: with a Meta connection present, those surfaces
 *    keep working from Meta data regardless of the toggle (data already
 *    collected; sync stays Meta-only), so no notice is warranted. */
export function shouldShowMetaDataNotice(args: {
  provider: PublishProvider;
  hasMetaConnection: boolean;
  hasBufferConnection: boolean;
}): boolean {
  return args.provider === "buffer" && !args.hasMetaConnection && args.hasBufferConnection;
}

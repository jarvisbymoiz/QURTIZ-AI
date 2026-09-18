import { NextResponse } from "next/server";

/** Chat turns are persisted by /api/chat before generation and on stream
 * completion. Clients must never overwrite server-authored tool results. */
export async function POST() {
  return NextResponse.json({ error: "CLIENT_PERSIST_DISABLED", message: "Conversation saving is handled by the chat server. Refresh this tab." }, { status: 410 });
}
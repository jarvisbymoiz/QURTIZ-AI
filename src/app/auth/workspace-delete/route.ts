import { NextResponse, type NextRequest } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
/** Legacy email links are retired. Deletion now always requires the account password. */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(`${getPublicAppUrl(request)}/settings`);
}

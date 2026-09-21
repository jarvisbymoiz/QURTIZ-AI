import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/workspace", () => ({ requireWorkspace: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }));

import { requireWorkspace } from "@/lib/workspace";
import { getDb } from "@/db";
import AppLayout from "@/app/(app)/layout";
import NotificationsPage from "@/app/(app)/notifications/page";

afterEach(() => vi.restoreAllMocks());

describe("actual Server Component entry points", () => {
  it("handles missing workspace columns in the layout rather than redirecting to onboarding", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(requireWorkspace).mockRejectedValueOnce(new Error("query", { cause: { code: "42703" } }));
    const html = renderToStaticMarkup(await AppLayout({ children: "PRIVATE CHILD CONTENT" }));
    expect(html).toContain("Database update required");
    expect(html).not.toContain("PRIVATE CHILD CONTENT");
  });
  it("handles notifications.meta missing in the page without displaying a false empty inbox", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(requireWorkspace).mockResolvedValueOnce({ workspace: { id: "ws-1" } } as never);
    const error = new Error("select secret parameters", { cause: { code: "42703" } });
    const query = {
      from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockRejectedValue(error),
    };
    vi.mocked(getDb).mockReturnValueOnce({ select: () => query } as never);
    const html = renderToStaticMarkup(await NotificationsPage(undefined));
    expect(html).toContain("Database update required");
    expect(html).not.toContain("secret parameters");
    expect(html).not.toContain("All caught up");
  });
  it("preserves layout authentication redirects", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    vi.mocked(requireWorkspace).mockRejectedValueOnce(redirect);
    await expect(AppLayout({ children: null })).rejects.toBe(redirect);
  });
});

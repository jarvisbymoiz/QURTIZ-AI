import { PUBLIC_PAGE_PATHS } from "@/lib/public/routes";

/** Track public acquisition only. Auth callback tokens and private app paths never leave the browser. */
export function publicTrackingUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (
      ![...PUBLIC_PAGE_PATHS, "/login", "/signup"].some(
        (path) => path === url.pathname,
      ) &&
      !/^\/articles\/[a-z0-9-]+\/?$/.test(url.pathname)
    )
      return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function acquisitionClick(path: string, destination: string) {
  if (destination !== "/signup" && destination !== "/login") return null;
  return {
    name: path.startsWith("/articles/")
      ? "article_cta_clicked"
      : destination === "/login"
        ? "login_clicked"
        : "get_started_clicked",
    data: {
      source:
        path === "/"
          ? "homepage"
          : path.startsWith("/articles/")
            ? "article"
            : "public_page",
      destination: destination === "/signup" ? "signup" : "login",
    },
  };
}

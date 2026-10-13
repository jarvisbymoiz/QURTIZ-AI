export const WEBSITE_ERROR_MESSAGES = {
  invalid_url: "Save a public website URL without login credentials. The reader uses HTTPS only.",
  robots_blocked: "This website's robots.txt does not allow Qurtiz to read this page.",
  robots_unavailable: "The website's robots.txt could not be checked. Reading was stopped.",
  http_error: "The website returned an error or access challenge. No login or challenge was bypassed.",
  timeout: "The website took too long to respond. Try refreshing later.",
  network_error: "The public website could not be reached securely. Check its availability and try again later.",
  too_large: "This page exceeds the safe reading size limit.",
  unsupported_content: "This page is not readable HTML or text.",
  empty_content: "No useful public text was available. JavaScript-only pages are not rendered.",
  unsafe_destination: "The website or a redirect points to an unsupported or non-public destination.",
  redirect_limit: "The website redirects too many times.",
  crawl_delay: "The website requests a crawl delay, so only the first page was read.",
  storage_error: "Website knowledge could not be saved. Your manually entered Brand Brain remains available.",
} as const;
export type WebsiteErrorCode = keyof typeof WEBSITE_ERROR_MESSAGES;

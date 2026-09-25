import "server-only";

import { lookup as dnsLookup } from "node:dns";
import { lookup as lookupAsync } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent } from "undici";

type Address = { address: string; family: number };

/** Only globally routable IPs may receive workspace AI credentials. */
export function isPublicAiAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    const ip = parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
      ? parsed.toIPv4Address() : parsed;
    return ip.range() === "unicast";
  } catch { return false; }
}

/** Validate URL syntax and literal addresses without relying on a provider list. */
export function assertAllowedAiEndpoint(raw: string): void {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid AI endpoint URL."); }
  if (url.protocol !== "https:") throw new Error("AI endpoints must use HTTPS.");
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("AI endpoints cannot contain credentials, query strings or fragments.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || host.length > 253 || /[^a-z0-9.:-]/.test(host)) throw new Error("Invalid AI endpoint hostname.");
  if (ipaddr.isValid(host)) {
    if (!isPublicAiAddress(host)) throw new Error("AI endpoints cannot use localhost or private-network addresses.");
    return;
  }
  // DNS-only internal names cannot be valid public provider endpoints.
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|intranet|test|invalid|onion)$/.test(host) ||
      host === "metadata.google.internal" || host.split(".").some(label => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) {
    throw new Error("AI endpoints require a public DNS hostname.");
  }
}

function checkAddresses(addresses: readonly Address[]): void {
  if (!addresses.length || addresses.some(entry => !isPublicAiAddress(entry.address))) {
    throw new Error("AI endpoint DNS resolved to a non-public address.");
  }
}

/** Save-time check. Runtime repeats this in the socket lookup to prevent DNS rebinding. */
export async function assertPublicAiEndpoint(raw: string, resolve: (hostname: string, options: { all: true; verbatim: true }) => Promise<Address[]> =
  (hostname, options) => lookupAsync(hostname, options)): Promise<void> {
  assertAllowedAiEndpoint(raw);
  const hostname = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(hostname)) return;
  try { checkAddresses(await resolve(hostname, { all: true, verbatim: true })); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("AI endpoint DNS")) throw error;
    throw new Error("AI endpoint hostname could not be resolved to a public address.");
  }
}

// A dedicated agent bypasses ambient proxy configuration. Its connector checks
// every resolved address before TCP/TLS connects, preserving TLS SNI/cert checks.
const publicAiAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error, "", 0);
        try {
          checkAddresses(addresses);
          const matching = addresses.find(entry => !options.family || entry.family === options.family);
          if (!matching) return callback(new Error("AI endpoint has no address in the requested IP family."), "", 0);
          if (options.all) callback(null, [matching]);
          else callback(null, matching.address, matching.family);
        } catch (cause) { callback(cause as Error, "", 0); }
      });
    },
  },
});

/** All custom OpenAI-compatible calls use this pinned, redirect-free transport. */
export async function fetchPublicAiEndpoint(url: string, init: RequestInit): Promise<Response> {
  assertAllowedAiEndpoint(url);
  return fetch(url, { ...init, redirect: "error", dispatcher: publicAiAgent } as RequestInit & { dispatcher: Agent });
}

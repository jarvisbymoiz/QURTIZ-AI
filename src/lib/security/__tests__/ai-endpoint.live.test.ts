import { expect, it } from "vitest";
import { assertPublicAiEndpoint, fetchPublicAiEndpoint } from "../ai-endpoint";

it("resolves and connects to a public HTTPS host through the guarded AI transport", async () => {
  await assertPublicAiEndpoint("https://example.com");
  const response = await fetchPublicAiEndpoint("https://example.com", { method: "GET", signal: AbortSignal.timeout(15_000) });
  expect(response.ok).toBe(true);
  await response.arrayBuffer();
});

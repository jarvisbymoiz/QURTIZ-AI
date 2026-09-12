import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Fixed hermetic ENCRYPTION_KEY for the whole suite: the crypto layer
    // now REQUIRES a valid 64-hex key in every environment (the old dev
    // fallback was removed), so tests must not depend on .env.local or the
    // developer's shell. This is a committed test fixture, never a secret.
    env: {
      ENCRYPTION_KEY:
        process.env.ENCRYPTION_KEY ||
        "7b2c91e391ccbe7cc94dd05fadc888cc0f3bd0dc04915db1073c7df7573cdc30",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/lib/empty-stub.ts", import.meta.url)),
    },
  },
});

import { companionConfigFromEnv, createCompanionServer, listenCompanion } from "./server.mjs";
import { homedir } from "node:os";
import { join } from "node:path";

const config = companionConfigFromEnv({ ...process.env,
  QURTIZ_COMPANION_STATE_PATH: process.env.QURTIZ_COMPANION_STATE_PATH ||
    join(process.env.LOCALAPPDATA || homedir(), "QurtizCompanion", "session.json") });
const server = createCompanionServer(config);
await listenCompanion(server, config.port);
console.log("Qurtiz Companion is ready. Return to Qurtiz Settings and choose Connect ChatGPT.");
console.log("ChatGPT authentication and credentials stay on this computer.");

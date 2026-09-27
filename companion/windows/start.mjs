import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const node = resolve(root, "node.exe");
const gateway = resolve(root, "node_modules/ai-zero-token/dist/cli.js");
const companion = resolve(root, "companion/cli.mjs");
if (![node, gateway, companion].every(existsSync)) {
  console.error("Qurtiz Companion installation is incomplete. Download a fresh package.");
  process.exit(1);
}

const localHome = resolve(process.env.LOCALAPPDATA || homedir(), "QurtizCompanion");
const localEnv = { ...process.env, AI_ZERO_TOKEN_HOME: resolve(localHome, "gateway"),
  CODEX_MODELS_CACHE_PATH: resolve(localHome, "gateway", "models-cache.json"),
  QURTIZ_COMPANION_STATE_PATH: resolve(localHome, "session.json"),
  QURTIZ_IMAGE_UPSTREAM_URL: "http://127.0.0.1:8787/v1" };
const gatewayProcess = spawn(node, [gateway, "serve", "--host", "127.0.0.1", "--port", "8787"], {
  cwd: root, stdio: ["inherit", "pipe", "inherit"], env: localEnv,
});
const companionProcess = spawn(node, [companion], { cwd: root, stdio: "inherit", env: localEnv });
const children = [gatewayProcess, companionProcess];
let gatewayOutput = "";
gatewayProcess.stdout.setEncoding("utf8");
gatewayProcess.stdout.on("data", chunk => {
  gatewayOutput += chunk;
  let newline;
  while ((newline = gatewayOutput.indexOf("\n")) >= 0) {
    const line = gatewayOutput.slice(0, newline).trim();
    gatewayOutput = gatewayOutput.slice(newline + 1);
    // The upstream CLI cannot always find a browser by command name on Windows.
    // Open only its expected OpenAI OAuth URL through the OS default-browser handler.
    const match = line.match(/^授权地址:\s*(https:\/\/auth\.openai\.com\/oauth\/authorize\?\S+)$/);
    if (match) {
      const url = new URL(match[1]);
      const callback = url.searchParams.get("redirect_uri");
      if (callback === "http://localhost:1455/auth/callback") {
        const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url.toString()], { stdio: "ignore" });
        browser.on("error", () => console.error("Could not open the login browser. Set a default browser and retry Connect ChatGPT."));
      }
      continue;
    }
    // Keep prompts, conversation IDs and upstream diagnostics out of the
    // normal user's status window. Qurtiz shows actionable failures in-app.
    if (line.includes("本地网关已启动")) console.log("Local image gateway is ready.");
    else if (line.includes("开始 OpenAI Codex OAuth 登录")) console.log("Opening ChatGPT sign-in in your browser...");
    else if (line.includes("已收到授权回调")) console.log("ChatGPT callback received locally.");
    else if (line.includes("token 交换成功")) console.log("ChatGPT login completed locally.");
  }
});
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", error => { console.error(`Qurtiz Companion could not start: ${error.message}`); stop(1); });
  child.on("exit", code => { if (!stopping) { console.error("A local companion service stopped."); stop(code || 1); } });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.log("Qurtiz Companion is starting. Keep this window open, then return to Qurtiz Settings.");

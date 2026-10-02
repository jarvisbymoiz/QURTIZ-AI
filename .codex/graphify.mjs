// Development-only launcher. No imports from Qurtiz's application runtime.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = resolve(root, ".tools/graphify/venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) {
  console.error("Graphify environment missing. See docs/GRAPHIFY.md for project setup.");
  process.exit(1);
}
const args = process.argv.slice(2);
const serve = args[0] === "serve";
const child = spawn(python, serve
  ? ["-m", "graphify.serve", resolve(root, "graphify-out/graph.json")]
  : ["-m", "graphify", ...args], {
  cwd: root, stdio: "inherit", windowsHide: true,
  env: { ...process.env, PYTHONUTF8: "1", GRAPHIFY_QUERY_LOG_DISABLE: "1" },
});
child.on("error", () => { console.error("Unable to start the project Graphify environment."); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

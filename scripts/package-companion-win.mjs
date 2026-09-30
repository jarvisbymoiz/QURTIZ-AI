import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (process.platform !== "win32") throw new Error("Build the Windows package on Windows.");
const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(resolve(root, "dist/companion-build-"));
cpSync(process.execPath, resolve(output, "node.exe"));
cpSync(resolve(root, "companion"), resolve(output, "companion"), { recursive: true,
  filter: path => !path.endsWith(".test.mjs") });
cpSync(resolve(root, "companion/windows/Start Qurtiz Companion.cmd"), resolve(output, "Start Qurtiz Companion.cmd"));
cpSync(resolve(root, "companion/windows/Install Qurtiz Companion.cmd"), resolve(output, "Install Qurtiz Companion.cmd"));
cpSync(resolve(root, "companion/windows/Stop Qurtiz Companion.cmd"), resolve(output, "Stop Qurtiz Companion.cmd"));
execFileSync(process.execPath, [resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  "install", "--prefix", output, "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "ai-zero-token@2.0.15"], { stdio: "inherit" });
execFileSync(process.execPath, [resolve(root, "scripts/patch-companion-image.mjs"), output], { stdio: "inherit" });
execFileSync(process.execPath, [resolve(root, "scripts/patch-companion-context.mjs"), output], { stdio: "inherit" });
execFileSync(process.execPath, [resolve(root, "scripts/patch-companion-image-service.mjs"), output], { stdio: "inherit" });
writeFileSync(resolve(output, "README.txt"),
  "Qurtiz Companion (experimental)\r\n\r\nExtract the ZIP, then double-click Install Qurtiz Companion.cmd. This installs in your Windows user profile, starts in the background, and starts again when you sign in to Windows. On this PC, open Qurtiz Settings, choose ChatGPT Account Mode, Pair this computer, then Connect ChatGPT. ChatGPT authentication stays on this PC. After pairing, the companion polls Qurtiz cloud for image jobs submitted from desktop, mobile, or Auto Run while the PC is online. Stop Qurtiz Companion.cmd stops the background process until your next Windows sign-in; Start Qurtiz Companion.cmd restarts it. The optional unofficial web-image route may have quota and account risks.\r\n\r\nThird-party gateway: AI-Zero-Token 2.0.15 (MIT), with reviewed Qurtiz image compatibility patches. Its own LICENSE is in node_modules\\ai-zero-token.\r\n");
const zip = resolve(root, "dist/Qurtiz-Companion-Windows.zip");
execFileSync("powershell", ["-NoProfile", "-Command", "Compress-Archive -Path '" + output.replaceAll("'", "''") + "\\*' -DestinationPath '" + zip.replaceAll("'", "''") + "' -Force"], { stdio: "inherit" });
rmSync(output, { recursive: true, force: true });
console.log(`Built ${zip}`);

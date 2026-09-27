import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function patchContextSource(source) {
  const before = '  const imageService = new ImageService({\n    authService,\n    configService\n  });';
  const after = '  const imageService = new ImageService({\n    authService,\n    configService,\n    modelService\n  });';
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2) throw new Error("AI-Zero-Token context changed; review capability wiring.");
  return source.replace(before, after);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[2] || ".", "node_modules/ai-zero-token/dist/core/context.js");
  const original = readFileSync(file, "utf8");
  const patched = patchContextSource(original);
  if (patched !== original) writeFileSync(file, patched);
}

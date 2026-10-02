// Reproducible vector-first brand assets. No remote media or customer information.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import geometry from "../src/lib/public/brand.json" with { type: "json" };
const symbol = `<path fill="currentColor" d="${geometry.path}"/>`;
const svg = (color, background = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="color:${color}">${background}${symbol}</svg>`;
await mkdir("public/brand", { recursive: true });
await mkdir("public/articles", { recursive: true });
await writeFile("public/brand/symbol.svg", svg("#d7ef8b"));
await writeFile("public/brand/symbol-monochrome.svg", svg("#11120f"));
await writeFile("public/brand/symbol-inverted.svg", svg("#ffffff"));
await writeFile(
  "public/brand/navigation-lockup.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="48" viewBox="0 0 220 48"><g color="#d7ef8b">${symbol}</g><text x="58" y="32" fill="#f3f3ed" font-family="Arial,sans-serif" font-size="24">Qurtiz AI</text></svg>`,
);
await sharp(
  Buffer.from(svg("#d7ef8b", '<rect width="48" height="48" fill="#11120f"/>')),
)
  .resize(512, 512)
  .png()
  .toFile("public/brand/social-avatar.png");
await writeFile(
  "src/app/icon.svg",
  svg("#d7ef8b", '<rect width="48" height="48" rx="11" fill="#11120f"/>'),
);
for (const size of [192, 512]) {
  await sharp(
    Buffer.from(
      svg("#d7ef8b", '<rect width="48" height="48" rx="11" fill="#11120f"/>'),
    ),
  )
    .resize(size, size)
    .png()
    .toFile(`public/brand/icon-${size}.png`);
}
await sharp(
  Buffer.from(svg("#d7ef8b", '<rect width="48" height="48" fill="#11120f"/>')),
)
  .resize(180, 180)
  .png()
  .toFile("src/app/apple-icon.png");
const favicon = await sharp(
  Buffer.from(
    svg("#d7ef8b", '<rect width="48" height="48" rx="11" fill="#11120f"/>'),
  ),
)
  .resize(32, 32)
  .png()
  .toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(favicon.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("src/app/favicon.ico", Buffer.concat([header, favicon]));
const cover = (kind) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d7ef8b" opacity=".12"/></pattern><radialGradient id="glow"><stop stop-color="#303a22"/><stop offset="1" stop-color="#151811"/></radialGradient></defs><rect width="1200" height="630" fill="url(#glow)"/><rect width="1200" height="630" fill="url(#dots)"/><g transform="translate(52 45) scale(1.1)" color="#d7ef8b">${symbol}</g><text x="115" y="79" fill="#d9dfcd" font-family="Arial,sans-serif" font-size="20">Qurtiz AI / Journal</text><text x="60" y="510" fill="#e7edda" font-family="Arial,sans-serif" font-size="43" letter-spacing="-1">${kind === "agent" ? "Context. Tools. Creative momentum." : "From a brand brief to a real result."}</text><text x="60" y="556" fill="#9aa589" font-family="Arial,sans-serif" font-size="18">${kind === "agent" ? "Understanding the AI social media agent" : "Building a connected social media workflow"}</text>${kind === "agent" ? '<ellipse cx="600" cy="275" rx="320" ry="125" fill="none" stroke="#d7ef8b" stroke-opacity=".2"/><ellipse cx="600" cy="275" rx="200" ry="150" fill="none" stroke="#d7ef8b" stroke-opacity=".1"/><rect x="535" y="210" width="130" height="130" rx="25" fill="#d7ef8b"/><g transform="translate(545 217) scale(2.3)" color="#273519">' + symbol + '</g><g font-family="Arial,sans-serif" font-size="17" fill="#c5d5ad"><rect x="240" y="196" width="185" height="55" rx="8" fill="#252c1e" stroke="#465536"/><text x="275" y="230">Brand context</text><rect x="795" y="205" width="170" height="55" rx="8" fill="#252c1e" stroke="#465536"/><text x="830" y="240">Research</text><rect x="285" y="340" width="170" height="55" rx="8" fill="#252c1e" stroke="#465536"/><text x="315" y="375">Create &amp; review</text><rect x="770" y="337" width="170" height="55" rx="8" fill="#252c1e" stroke="#465536"/><text x="805" y="372">Publish</text></g>' : '<path d="M140 270H1060" stroke="#d7ef8b" stroke-opacity=".3" fill="none"/>' + ["Brand", "Research", "Create", "Review", "Publish"].map((label, i) => `<g><circle cx="${180 + i * 210}" cy="270" r="45" fill="${i === 2 ? "#d7ef8b" : "#252e1c"}" stroke="#718951"/><text x="${180 + i * 210}" y="277" text-anchor="middle" fill="${i === 2 ? "#223416" : "#d7ef8b"}" font-family="Arial,sans-serif" font-size="18">0${i + 1}</text><text x="${180 + i * 210}" y="355" text-anchor="middle" fill="#c7d5b4" font-family="Arial,sans-serif" font-size="17">${label}</text></g>`).join("")}</svg>`;
for (const [name, kind] of [
  ["agent-guide", "agent"],
  ["workflow-guide", "workflow"],
]) {
  const source = cover(kind);
  await writeFile(`public/articles/${name}.svg`, source);
  await sharp(Buffer.from(source)).png().toFile(`public/articles/${name}.png`);
}
console.log("Brand icons and editorial covers generated.");

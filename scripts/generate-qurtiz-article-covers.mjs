import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import geometry from "../src/lib/public/brand.json" with { type: "json" };

const mark = `<path d="${geometry.path}" fill="currentColor"/>`;
const text = (x, y, value, size = 15, color = "#b8c6a2", anchor = "middle") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${value}</text>`;
const tile = (x, y, label, width = 155, active = false) =>
  `<g><rect x="${x}" y="${y}" width="${width}" height="58" rx="9" fill="${active ? "#d7ef8b" : "#222b19"}" stroke="${active ? "#d7ef8b" : "#4e6036"}"/>${text(x + width / 2, y + 36, label, 15, active ? "#263519" : "#c4d4ae")}</g>`;
const covers = [
  {
    name: "qurtiz-introduction",
    label: "THE PRODUCT, CONNECTED",
    title: "Meet your AI social media workspace.",
    scene: `<ellipse cx="600" cy="270" rx="315" ry="130" stroke="#75924c" stroke-opacity=".3" fill="none"/><g transform="translate(549 213) scale(2.4)" color="#d7ef8b">${mark}</g>${tile(210, 155, "Brand Brain")}${tile(805, 160, "Research")}${tile(225, 335, "Content")}${tile(800, 340, "Publishing")}`,
  },
  {
    name: "startup-workflow",
    label: "A PRACTICAL STARTUP PLAYBOOK",
    title: "A small team. A connected process.",
    scene: `<path d="M135 338H360V258H610V178H1000" stroke="#a5bd7b" stroke-opacity=".4" fill="none"/>${tile(90, 305, "Brand brief", 170)}${tile(340, 225, "Create &amp; review", 190)}${tile(600, 145, "Schedule", 180)}${tile(850, 145, "Publish", 175, true)}${text(710, 370, "START SMALL. VERIFY THE RESULT.", 14, "#8e9f76")}`,
  },
  {
    name: "chatbot-to-agent",
    label: "ANSWERS BECOME OPERATIONS",
    title: "From a response to a real workflow.",
    scene: `<rect x="150" y="158" width="350" height="225" rx="17" fill="#1b2215" stroke="#415132"/>${text(325, 204, "CHATBOT", 12, "#8e9f76")}${text(325, 263, "A conversational answer", 22, "#c4d4ae")}${text(325, 310, "Suggested words", 15, "#8e9f76")}<path d="M530 270H660M647 260L660 270 647 280" stroke="#d7ef8b" fill="none"/>${tile(710, 157, "Context", 235)}${tile(710, 237, "Tools &amp; permissions", 235, true)}${tile(710, 317, "Saved result", 235)}`,
  },
  {
    name: "facebook-instagram-workflow",
    label: "PLATFORMS &amp; CONNECTIONS",
    title: "Create. Review. Publish. First Comment.",
    scene: `${tile(115, 225, "Qurtiz AI", 180, true)}<path d="M295 254H420M420 254V175H570M420 254V335H570M725 175H810M725 335H810" stroke="#a6bd7c" stroke-opacity=".55" fill="none"/>${tile(570, 147, "Meta Direct")}${tile(570, 307, "Buffer")}${tile(810, 147, "Facebook", 175)}${tile(810, 307, "Instagram", 175)}${text(600, 405, "ONE WORKFLOW. CONNECTED PUBLISHING.", 12, "#8e9f76")}`,
  },
  {
    name: "brand-brain-research",
    label: "BETTER INPUTS. BETTER-INFORMED IDEAS.",
    title: "Your brand is the creative starting point.",
    scene: `${tile(100, 145, "Business facts", 170)}${tile(100, 225, "Audience", 170)}${tile(100, 305, "Memory", 170)}<path d="M270 174H380L490 255M270 254H490M270 334H380L490 255M665 255H785" stroke="#a5bd7b" stroke-opacity=".4" fill="none"/>${tile(490, 225, "Brand + research", 175, true)}${tile(785, 225, "Content objective", 205)}${text(600, 394, "CONTEXT INFORMS. PEOPLE REVIEW.", 13, "#8e9f76")}`,
  },
];
await mkdir("public/articles", { recursive: true });
for (const cover of covers) {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d7ef8b" opacity=".12"/></pattern><radialGradient id="field"><stop stop-color="#303c20"/><stop offset="1" stop-color="#141810"/></radialGradient></defs><rect width="1200" height="630" fill="url(#field)"/><rect width="1200" height="630" fill="url(#grid)"/><g transform="translate(50 40) scale(1)" color="#d7ef8b">${mark}</g>${text(114, 73, "Qurtiz AI / Journal", 19, "#d8e3c8", "start")}${cover.scene}${text(60, 486, cover.label, 12, "#9ab579", "start")}${text(60, 540, cover.title, 40, "#e9efdf", "start")}${text(60, 584, "Practical guides for a brand-aware content workflow", 16, "#8e9f76", "start")}</svg>`;
  await writeFile(`public/articles/${cover.name}.svg`, source);
  await sharp(Buffer.from(source))
    .png()
    .toFile(`public/articles/${cover.name}.png`);
}
console.log("Generated five distinct Qurtiz editorial covers.");

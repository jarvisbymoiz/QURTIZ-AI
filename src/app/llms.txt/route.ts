import { absoluteUrl } from "@/lib/public/site";
import { getArticles } from "@/lib/public/articles";
export const dynamic = "force-static";
export function GET() {
  const text = `# Qurtiz AI\n\n> A workspace-based AI social media operating system. Free software with public source; third-party provider costs and configuration apply.\n\n## Product\n- [Features](${absoluteUrl("/features")}): Agent, Brand Brain, research, content, scheduling and publishing.\n- [FAQ](${absoluteUrl("/faq")}): Capabilities and requirements.\n- [Open source](${absoluteUrl("/open-source")}): Repository and license status.\n\n## Guides\n${getArticles()
    .map(
      (a) =>
        `- [${a.title}](${absoluteUrl(`/articles/${a.slug}`)}): ${a.description}`,
    )
    .join(
      "\n",
    )}\n\n## Trust\n- [Security](${absoluteUrl("/security")})\n- [Privacy draft](${absoluteUrl("/privacy")})\n- [Data deletion](${absoluteUrl("/data-deletion")})\n\nNo ranking, engagement, certification or partnership guarantees are made.\n`;
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

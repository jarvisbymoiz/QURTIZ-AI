import satori from "satori";
import fs from "node:fs";
import path from "node:path";

export const TEMPLATE_SIZES: Record<string, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

export type TemplateStyle = {
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  subline: string;
  cta: string;
  logoDataUrl: string | null;
  brandName: string;
  layout: "promo" | "statement";
};

let fontsCache: { data: Buffer }[] | null = null;

/** Inter woff files from @fontsource (satori needs TTF/OTF/WOFF, not WOFF2). */
function loadFonts(): { data: Buffer }[] {
  if (fontsCache) return fontsCache;
  const base = path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files");
  const files = [
    "inter-latin-400-normal.woff",
    "inter-latin-600-normal.woff",
    "inter-latin-700-normal.woff",
  ];
  fontsCache = files
    .map((f) => path.join(base, f))
    .filter((p) => fs.existsSync(p))
    .map((p) => ({ data: fs.readFileSync(p), name: "Inter", weight: 400, style: "normal" }));
  return fontsCache;
}

function normalizeHex(input: string | undefined | null, fallback: string): string {
  const v = (input ?? "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  return fallback;
}

function el(style: Record<string, unknown>, children: unknown[] = []) {
  // satori requires explicit display on multi-child containers; flex is our default.
  const safeStyle = { display: "flex", ...style };
  return { type: "div", props: { style: safeStyle, children: children.filter((c) => c !== null && c !== undefined) } };
}
function txt(text: string, style: Record<string, unknown>) {
  return { type: "div", props: { style: { display: "flex", ...style }, children: [text] } };
}

function buildTree(s: TemplateStyle) {
  const primary = normalizeHex(s.primaryColor, "#6366f1");
  const secondary = normalizeHex(s.secondaryColor, "#0ea5e9");
  const dark = "#0b0d12";

  const logoBlock = s.logoDataUrl
    ? el({ display: "flex", alignItems: "center", gap: 12 }, [
        { type: "img", props: { src: s.logoDataUrl, width: 72, height: 72, style: { objectFit: "contain" } } },
        txt(s.brandName, { fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.9)" }),
      ])
    : txt(s.brandName, { fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.9)" });

  const headline = txt(s.headline.slice(0, 90), {
    display: "flex",
    fontSize: s.layout === "promo" ? 76 : 64,
    fontWeight: 700,
    lineHeight: 1.08,
    color: "#ffffff",
    letterSpacing: "-0.02em",
  });

  const subline = s.subline
    ? txt(s.subline.slice(0, 160), { fontSize: 34, lineHeight: 1.35, color: "rgba(255,255,255,0.78)" })
    : null;

  const cta = s.cta
    ? el(
        {
          display: "flex",
          backgroundColor: "#ffffff",
          borderRadius: 999,
          padding: "20px 40px",
          alignSelf: "flex-start",
        },
        [txt(s.cta.slice(0, 40), { fontSize: 30, fontWeight: 700, color: dark })],
      )
    : null;

  if (s.layout === "statement") {
    return el(
      {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: dark,
        backgroundImage: `radial-gradient(circle at 85% 15%, ${primary}44, transparent 55%), radial-gradient(circle at 10% 90%, ${secondary}33, transparent 50%)`,
      },
      [
        el({ display: "flex" }, [logoBlock]),
        el({ display: "flex", flexDirection: "column", gap: 28 }, [headline, subline]),
        cta ?? el({ display: "flex" }, []),
      ],
    );
  }

  // promo: colored panel + white content card
  return el(
    {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: dark,
      padding: 56,
    },
    [
      el({ display: "flex" }, [logoBlock]),
      el(
        {
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          gap: 30,
          marginTop: 40,
          marginBottom: 40,
          borderRadius: 40,
          padding: 56,
          backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})`,
        },
        [headline, subline, cta],
      ),
    ],
  );
}

/**
 * Render a branded social graphic (PNG) with satori + resvg.
 * Deterministic, brand-safe text rendering — zero AI cost.
 */
export async function renderTemplateVisual(style: TemplateStyle, size: keyof typeof TEMPLATE_SIZES = "portrait"): Promise<Buffer> {
  const { w, h } = TEMPLATE_SIZES[size];
  const tree = buildTree(style);
  const svg = await satori(tree as never, {
    width: w,
    height: h,
    fonts: loadFonts().map((f) => ({ data: f.data, name: "Inter", weight: 400, style: "normal" })),
  });
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: w } });
  return Buffer.from(resvg.render().asPng());
}



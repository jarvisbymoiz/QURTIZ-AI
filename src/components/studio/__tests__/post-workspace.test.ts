import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/visuals", () => ({ generateVisualAction: vi.fn(), buildMasterPromptAction: vi.fn(), removeVisualUploadAction: vi.fn(), reorderVisualUploadsAction: vi.fn() }));
vi.mock("@/server/actions/schedule", () => ({ scheduleContentAction: vi.fn() }));
vi.mock("@/server/actions/content", () => ({ rejectContentAction: vi.fn(), regenerateContentAction: vi.fn(), setContentStatusAction: vi.fn(), updateVariantCaptionAction: vi.fn(), updateReviewFieldAction: vi.fn() }));
vi.mock("@/lib/media/client-upload", () => ({ uploadStudioMedia: vi.fn() }));
import { PostWorkspace } from "../post-workspace";

// This project's test compiler uses classic JSX; Next uses its own JSX runtime.
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

type Props = React.ComponentProps<typeof PostWorkspace>;
function review(format: string, withSlides = false, overrides: Partial<Props> = {}) {
  const props = {
    item: { id: "item", status: "ready_for_review", format, topic: "Review topic", caption: "Caption", visualConcept: "Existing brand visual prompt", hashtags: [], qa: {}, aiScores: {} },
    variants: [{ id: "variant", status: "ready_for_review", platform: "instagram", format, caption: "Caption", hashtags: [], slides: withSlides ? [{ index: 1, visualPrompt: "Existing slide prompt" }] : [], script: {} }],
    visuals: [{ id: "media", kind: "upload", mimeType: format === "reel" ? "video/mp4" : "image/png", storagePath: "media/path", slideIndex: 0, createdAt: new Date() }],
    visualUrls: { "media/path": "https://example.com/media" }, editable: true, aiConfigured: true, onClose: vi.fn(),
  } as unknown as Props;
  return renderToStaticMarkup(React.createElement(PostWorkspace, { ...props, ...overrides }));
}
describe("Post Review visual prompt and media coexistence", () => {
  it.each(["single_image", "carousel", "reel"])("retains the saved prompt and its actions above media controls for %s", format => {
    const html = review(format);
    expect(html).toContain("Existing brand visual prompt");
    expect(html).toContain('aria-label="Copy Visual prompt"');
    expect(html).toContain('aria-label="Edit visual prompt"');
    expect(html).toContain("Copy Master AI Prompt");
    if (format === "reel") { expect(html).not.toContain("Generate AI visual"); expect(html).toContain("Upload video"); expect(html).toContain("<video"); }
    else { expect(html).toContain("Generate AI visual"); expect(html.indexOf("Existing brand visual prompt")).toBeLessThan(html.indexOf("Generate AI visual")); }
    if (format === "carousel") { expect(html).toContain("Add images"); expect(html).toContain("<img"); }
    if (format === "single_image") { expect(html).toContain("Upload image"); expect(html).toContain("Visual preview"); }
  });
  it("keeps per-slide prompts and AI generation alongside the post-level prompt", () => {
    const html = review("carousel", true);
    expect(html).toContain("Existing slide prompt");
    expect(html).toContain("Existing brand visual prompt");
    expect(html).toContain("Carousel slides");
    expect(html).toContain("Add images");
  });
  it("opens the Carousel variant advertised by the card even when a single-image variant is returned first", () => {
    const variants=[{id:"facebook-single",platform:"facebook",format:"single_image",status:"ready_for_review",caption:"Facebook caption",hashtags:[],slides:[],script:{}},
      {id:"instagram-carousel",platform:"instagram",format:"carousel",status:"ready_for_review",caption:"Carousel caption",hashtags:[],slides:[{index:1,visualPrompt:"Existing slide prompt"}],script:{}}] as unknown as Props["variants"];
    const html=review("carousel",false,{variants});
    expect(html).toContain("Add images");expect(html).toContain('aria-label="Upload Carousel images"');expect(html).toMatch(/<input[^>]*multiple=""/);
    expect(html).toContain("Carousel caption");expect(html).toContain("Existing slide prompt");expect(html).toContain("Existing brand visual prompt");
    expect(html.indexOf("Add images")).toBeLessThan(html.indexOf("Existing slide prompt"));
    expect(html).not.toContain("Upload image</button>");
  });
  it("keeps multi-upload, individual management and a one-image ordered Carousel preview alongside prompts", () => {
    const visuals = [2, 0, 1].map(i => ({id:`media-${i}`,kind:"upload",mimeType:"image/png",storagePath:`media/${i}`,slideIndex:i,createdAt:new Date()})) as unknown as Props["visuals"];
    const html=review("carousel",true,{visuals,visualUrls:{"media/0":"https://example.com/first.png","media/1":"https://example.com/second.png","media/2":"https://example.com/third.png"}});
    expect(html).toContain('aria-label="Upload Carousel images"');expect(html).toMatch(/<input[^>]*multiple=""/);
    expect(html.match(/<img /g)).toHaveLength(1);expect(html).toContain('src="https://example.com/first.png"');
    expect(html).toContain('aria-label="Previous image"');expect(html).toContain('aria-label="Next image"');expect(html).toContain("1 / 3");
    expect(html).toContain("Move left");expect(html).toContain("Move right");expect(html).toContain("Remove");
    expect(html).toContain("Existing brand visual prompt");expect(html).toContain("Existing slide prompt");expect(html).toContain("Copy Master AI Prompt");
  });
  it.each(["carousel","reel"])("uses the parent %s format when variants have not loaded", format => {
    const html=review(format,false,{variants:[]});expect(html).toContain(format==="reel"?"Upload video":"Add images");expect(html).toContain("Existing brand visual prompt");
  });
  it.each(["carousel","reel"])("keeps upload controls and previews visible with a read-only explanation for scheduled %s posts", format => {
    const item={id:"item",status:"scheduled",format,topic:"Review topic",visualConcept:"Existing brand visual prompt",hashtags:[],qa:{},aiScores:{}} as unknown as Props["item"];
    const html=review(format,false,{item});expect(html).toContain(format==="reel"?"Upload video":"Add images");expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).toContain("Media can be changed when this post is back in review.");expect(html).toContain("Existing brand visual prompt");
  });
});

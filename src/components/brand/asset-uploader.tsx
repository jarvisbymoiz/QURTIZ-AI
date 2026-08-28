"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import type { brandAssets } from "@/db/schema";
import { deleteBrandAssetAction, uploadBrandAssetAction } from "@/server/actions/visuals";
import { Button } from "@/components/ui/button";

type Asset = typeof brandAssets.$inferSelect;

const KIND_LABELS: Record<string, { title: string; hint: string }> = {
  logo: {
    title: "Brand logo",
    hint: "PNG with transparency works best. Used verbatim on visuals — never redrawn by AI.",
  },
  avatar: {
    title: "Person avatar",
    hint: "Clear photo of the person who appears in your content. The AI keeps the same face and body when generating visuals.",
  },
  reference: {
    title: "Style reference",
    hint: "Optional extra reference image the AI should match (product shot, brand scene, etc.).",
  },
};

export function AssetUploader({
  kind,
  assets,
  signedUrls,
  editable,
}: {
  kind: "logo" | "avatar" | "reference";
  assets: Asset[];
  signedUrls: Record<string, string | null>;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = KIND_LABELS[kind];

  function upload(file: File) {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    start(async () => {
      const r = await uploadBrandAssetAction(fd);
      if (r.ok) {
        toast.success("Uploaded");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function remove(asset: Asset) {
    start(async () => {
      const r = await deleteBrandAssetAction(asset.id);
      if (r.ok) {
        toast.success("Removed");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <div className="text-sm font-medium">{meta.title}</div>
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
      </div>
      {assets.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {assets.map((a) => {
            const url = signedUrls[a.storagePath];
            return (
              <div key={a.id} className="relative">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={a.label ?? kind} className="size-24 rounded-lg border object-contain" />
                ) : (
                  <div className="flex size-24 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                    unavailable
                  </div>
                )}
                {editable ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -right-2 -top-2 size-6 rounded-full bg-background shadow"
                    onClick={() => remove(a)}
                    disabled={pending}
                    aria-label="Remove asset"
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {editable ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {assets.length > 0 ? "Add another" : "Upload"}
          </Button>
        </>
      ) : null}
    </div>
  );
}

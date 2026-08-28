"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { brandAssets, brandMemory, brands } from "@/db/schema";
import { AssetUploader } from "./asset-uploader";
import { BusinessForm } from "./business-form";
import { AudienceForm } from "./audience-form";
import { VoiceForm } from "./voice-form";
import { VisualForm } from "./visual-form";
import { RulesForm } from "./rules-form";
import { MemoryPanel } from "./memory-panel";

type Brand = typeof brands.$inferSelect | null;
type Memory = typeof brandMemory.$inferSelect;
type Asset = typeof brandAssets.$inferSelect;

export function BrandBrainTabs({
  brand,
  memories,
  assets,
  assetUrls,
  editable,
}: {
  brand: Brand;
  memories: Memory[];
  assets: Asset[];
  assetUrls: Record<string, string | null>;
  editable: boolean;
}) {
  return (
    <Tabs defaultValue="business">
      <TabsList className="flex-wrap">
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="audience">Audience</TabsTrigger>
        <TabsTrigger value="voice">Voice</TabsTrigger>
        <TabsTrigger value="visual">Visual identity</TabsTrigger>
        <TabsTrigger value="rules">Content rules</TabsTrigger>
        <TabsTrigger value="memory">Memory ({memories.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="business" className="mt-4">
        <BusinessForm brand={brand} editable={editable} />
      </TabsContent>
      <TabsContent value="audience" className="mt-4">
        <AudienceForm brand={brand} editable={editable} />
      </TabsContent>
      <TabsContent value="voice" className="mt-4">
        <VoiceForm brand={brand} editable={editable} />
      </TabsContent>
      <TabsContent value="visual" className="mt-4 space-y-4">
        <VisualForm brand={brand} editable={editable} />
        {(["logo", "avatar", "reference"] as const).map((kind) => (
          <AssetUploader
            key={kind}
            kind={kind}
            assets={assets.filter((a) => a.kind === kind)}
            signedUrls={assetUrls}
            editable={editable}
          />
        ))}
      </TabsContent>
      <TabsContent value="rules" className="mt-4">
        <RulesForm brand={brand} editable={editable} />
      </TabsContent>
      <TabsContent value="memory" className="mt-4">
        <MemoryPanel memories={memories} editable={editable} />
      </TabsContent>
    </Tabs>
  );
}


"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { brandMemory, brands } from "@/db/schema";
import { BusinessForm } from "./business-form";
import { AudienceForm } from "./audience-form";
import { VoiceForm } from "./voice-form";
import { VisualForm } from "./visual-form";
import { RulesForm } from "./rules-form";
import { MemoryPanel } from "./memory-panel";

type Brand = typeof brands.$inferSelect | null;
type Memory = typeof brandMemory.$inferSelect;

export function BrandBrainTabs({
  brand,
  memories,
  editable,
}: {
  brand: Brand;
  memories: Memory[];
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
      <TabsContent value="visual" className="mt-4">
        <VisualForm brand={brand} editable={editable} />
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

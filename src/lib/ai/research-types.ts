import { z } from "zod";

export const topicScoresSchema = z.object({
  trend: z.number().min(0).max(10),
  audience: z.number().min(0).max(10),
  search: z.number().min(0).max(10),
  competition: z.number().min(0).max(10),
  business: z.number().min(0).max(10),
  viral: z.number().min(0).max(10),
  conversion: z.number().min(0).max(10),
});
export type TopicScores = z.infer<typeof topicScoresSchema>;

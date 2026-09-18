/**
 * Zod validation for the autopilot settings shape (server-side; the client
 * never imports this module, so zod stays out of the settings page bundle —
 * the card shares constants/helpers via the zod-free lib/autopilot/logic).
 */
import { z } from "zod";
import { MAX_RUN_TIMES, RUN_TIME_RE } from "./logic";

const runTime = z
  .string()
  .regex(RUN_TIME_RE, "Run times use 24-hour HH:MM (00:00–23:59).");

/** Settings validation shared by the server action and tests. */
export const autopilotSettingsSchema = z.object({
  enabled: z.boolean(),
  requireApproval: z.boolean().default(true),
  nicheFocus: z.string().trim().max(300).optional().or(z.literal("")),
  maxPostsPerRun: z.number().int().min(1).max(3).default(1),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1).max(2).transform(v => [...new Set(v)]).default(["facebook", "instagram"]),
  formats: z.array(z.enum(["single_image", "carousel", "reel", "story", "text_post"])).min(1).max(5).transform(v => [...new Set(v)]).default(["single_image"]),
  autoSchedule: z.boolean().default(true),
  generateImages: z.boolean().default(true),
  runDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform(v => [...new Set(v)]).default([0,1,2,3,4,5,6]),
  fallbackTimes: z.array(runTime).min(1).max(6).transform(v => [...new Set(v)]).default(["09:00", "12:00", "17:00"]),
  minGapMinutes: z.number().int().min(30).max(1440).default(120),
  maxPostsPerDay: z.number().int().min(1).max(6).default(3),
  // Dedupe before the cap so repeated times collapse into one slot.
  runTimes: z
    .array(runTime)
    .transform((times) => [...new Set(times)])
    .refine((times) => times.length <= MAX_RUN_TIMES, {
      message: `Up to ${MAX_RUN_TIMES} run times per day.`,
    })
    .default([]),
});

export type AutopilotSettings = z.infer<typeof autopilotSettingsSchema>;

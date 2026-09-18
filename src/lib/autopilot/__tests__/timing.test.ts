import { describe, expect, it } from "vitest";
import { choosePostingSlot, dueOccurrence, postingTimes } from "../timing";
import { dateIsoInTz, hmInTz, parseZonedDateTime } from "@/lib/scheduling/time";
import type { MetricsRow } from "@/lib/analytics/compute";
const policy = { timezone: "Asia/Karachi", fallbackTimes: ["09:00", "12:00", "17:00"], minGapMinutes: 120, maxPostsPerDay: 3 };
const now = new Date("2026-09-16T10:00:00Z");
describe("Auto Run scheduling", () => {
  it("distributes 3 posts and another overlapping run around existing Calendar jobs", () => {
    const occupied = [parseZonedDateTime("2026-09-17", "09:30", policy.timezone)];
    const chosen: Date[] = [];
    for (let i=0; i<6; i++) { const at = choosePostingSlot(policy, policy.fallbackTimes, occupied, now); occupied.push(at); chosen.push(at); }
    expect(new Set(chosen.map(d => d.toISOString())).size).toBe(6);
    expect(hmInTz(policy.timezone, chosen[0])).toBe("12:00");
    for (let i=0; i<occupied.length; i++) for (let j=i+1; j<occupied.length; j++) expect(Math.abs(occupied[i].getTime()-occupied[j].getTime())).toBeGreaterThanOrEqual(120*60_000);
    expect(chosen.filter(d => dateIsoInTz(policy.timezone,d)==="2026-09-17")).toHaveLength(2);
  });
  it("uses custom fallback timing and per-day limits", () => {
    const p = {...policy, fallbackTimes:["14:45"], maxPostsPerDay:1};
    const a = choosePostingSlot(p,p.fallbackTimes,[],now);
    const b = choosePostingSlot(p,p.fallbackTimes,[a],now);
    expect(hmInTz(p.timezone,a)).toBe("14:45");
    expect(dateIsoInTz(p.timezone,b)).toBe("2026-09-18");
  });
  it("filters timing evidence by platform and requires repeated measured posts", () => {
    const metric = (platform: "facebook" | "instagram", hour:number, likes:number): MetricsRow => ({platform, contentItemId:null,postedAt:now,hourOfDay:hour,format:"carousel",metrics:{likes}});
    const rows = [metric("facebook",8,10),metric("facebook",8,12),metric("facebook",9,1),metric("instagram",20,100)];
    expect(postingTimes(rows,"facebook","carousel",["13:15"])).toEqual({times:["08:00"],source:"measured-post-performance"});
    expect(postingTimes(rows,"instagram","reel",["13:15"])).toEqual({times:["13:15"],source:"configured-fallback"});
  });
  it("skips nonexistent DST posting times", () => {
    const p = {...policy,timezone:"America/New_York",fallbackTimes:["02:30","10:00"]};
    const at = choosePostingSlot(p,p.fallbackTimes,[],new Date("2026-03-07T12:00:00Z"));
    expect(hmInTz(p.timezone,at)).toBe("10:00");
  });
  it("catches up a missed run after restart, honors weekdays and avoids old backlogs", () => {
    expect(dueOccurrence(["09:00","15:00"],[0,1,2,3,4,5,6],policy.timezone,now)).toBe("2026-09-16T15:00");
    expect(dueOccurrence(["09:00"],[3],policy.timezone,new Date("2026-09-16T04:05:00Z"))).toBe("2026-09-16T09:00");
    expect(dueOccurrence(["09:00"],[1],policy.timezone,now)).toBeNull();
  });
  it("recovers each unclaimed daily occurrence in order and excludes times before enabling", () => {
    const at = new Date("2026-09-16T16:00:00Z");
    const times = ["09:00","12:00","17:00"];
    let key = "2026-09-15T17:00";
    for (const expected of times) {
      key = dueOccurrence(times,[0,1,2,3,4,5,6],policy.timezone,at,{afterKey:key})!;
      expect(key).toBe(`2026-09-16T${expected}`);
    }
    expect(dueOccurrence(times,[0,1,2,3,4,5,6],policy.timezone,at,{afterKey:key})).toBeNull();
    expect(dueOccurrence(times,[0,1,2,3,4,5,6],policy.timezone,at,{afterKey:"",enabledSince:parseZonedDateTime("2026-09-16","16:00",policy.timezone)})).toBe("2026-09-16T17:00");
  });
});

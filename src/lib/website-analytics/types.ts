export type TrafficRow = { label: string; pageviews: number; visitors: number };
export type TrafficSection = { rows: TrafficRow[]; error?: string };
export type TrafficTotal =
  | { pageviews: number; visitors: number; error?: undefined }
  | { pageviews: null; visitors: null; error: string };
export type WebsiteTrafficReport = {
  projectId: string;
  environment: "production";
  refreshedAt: string;
  timezone: "UTC";
  today: TrafficTotal;
  week: TrafficTotal;
  month: TrafficTotal;
  pages: TrafficSection;
  referrers: TrafficSection;
  countries: TrafficSection;
  devices: TrafficSection;
  browsers: TrafficSection;
  trend: TrafficSection;
};

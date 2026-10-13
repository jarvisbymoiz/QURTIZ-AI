"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  TrafficSection,
  WebsiteTrafficReport,
} from "@/lib/website-analytics/types";

const number = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString();
function Breakdown({
  title,
  section,
}: {
  title: string;
  section: TrafficSection;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {section.error ? (
          <p className="text-sm text-destructive">{section.error}</p>
        ) : section.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recorded traffic in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-normal">
                    {title === "Daily traffic" ? "Day (UTC)" : "Source"}
                  </th>
                  <th className="px-2 text-right font-normal">Views</th>
                  <th className="text-right font-normal">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, index) => (
                  <tr
                    key={`${row.label}-${index}`}
                    className="border-b last:border-0"
                  >
                    <td className="max-w-64 break-all py-3 pr-3">
                      {title === "Daily traffic"
                        ? row.label.slice(0, 10)
                        : row.label}
                    </td>
                    <td className="px-2 text-right tabular-nums">
                      {number(row.pageviews)}
                    </td>
                    <td className="text-right tabular-nums">
                      {number(row.visitors)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export function WebsiteTrafficDashboard() {
  const [report, setReport] = useState<WebsiteTrafficReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const failures = useRef(0);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/website-analytics", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.redirected || response.status === 401)
        throw new Error(
          "Your session has expired. Sign in again to view website analytics.",
        );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Website analytics could not be retrieved.",
        );
      setReport(data);
      setError(null);
      failures.current = 0;
    } catch (cause) {
      if (controller.signal.aborted && !timedOut) return;
      setError(
        cause instanceof Error && cause.name !== "AbortError"
          ? cause.message
          : "The reporting request timed out or was cancelled. Retry when ready.",
      );
      failures.current++;
      if (failures.current >= 3) setPaused(true);
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      const pending = request.current;
      request.current = null;
      pending?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }, [paused, refresh]);
  const totals = [
    ["Visitors today", report?.today.visitors, report?.today.error],
    ["Page views today", report?.today.pageviews, report?.today.error],
    ["Visitors · last 7 days", report?.week.visitors, report?.week.error],
    ["Visitors · last 30 days", report?.month.visitors, report?.month.error],
  ] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Production traffic from Vercel Web Analytics. UTC calendar periods
          include today. Aggregates refresh once a minute while visible; these
          are not concurrent online-user counts.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? "Resume updates" : "Pause updates"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              failures.current = 0;
              void refresh();
            }}
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            {loading ? "Loading" : "Refresh"}
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          {error}
          {report && " Last successful data remains below."}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.map(([label, value, unavailable]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">
                {number(value)}
              </p>
              {unavailable && (
                <p className="mt-2 text-xs text-destructive">{unavailable}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {report && (
        <>
          <p className="text-xs text-muted-foreground">
            Project: {report.projectId} · Production · Last retrieved:{" "}
            {new Date(report.refreshedAt).toLocaleString()} · Breakdowns: last
            30 days
          </p>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Breakdown title="Top pages" section={report.pages} />
            <Breakdown title="Top referrers" section={report.referrers} />
            <Breakdown title="Countries" section={report.countries} />
            <Breakdown title="Devices" section={report.devices} />
            <Breakdown title="Browsers" section={report.browsers} />
            <Breakdown title="Daily traffic" section={report.trend} />
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Retention, availability and processing latency follow the Vercel plan.
        Visitors follow Vercel’s privacy-preserving definition; totals are never
        calculated by adding daily visitor counts.
      </p>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/workspace";
import { canViewWebsiteAnalytics } from "@/lib/website-analytics/access";
import { PageHeader } from "@/components/layout/page-header";
import { WebsiteTrafficDashboard } from "@/components/analytics/website-traffic-dashboard";

export const metadata = {
  title: "Website visitors",
  robots: { index: false, follow: false },
};
export default async function WebsiteVisitorsPage() {
  const user = await getSessionUser();
  if (!user || !canViewWebsiteAnalytics(user.id)) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Website visitors"
        description="Private acquisition metrics for Qurtiz operators."
      />
      <WebsiteTrafficDashboard />
    </div>
  );
}

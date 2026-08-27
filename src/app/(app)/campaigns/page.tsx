import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "campaigns" };

export default function Page() {
  return (
    <ComingSoon
      section="campaigns"
      milestone="M3"
      description="Campaign builder: goal-driven multi-day campaign plans with generated assets for every day."
    />
  );
}

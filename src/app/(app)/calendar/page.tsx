import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "calendar" };

export default function Page() {
  return (
    <ComingSoon
      section="calendar"
      milestone="M3"
      description="Month/week/day calendar with drag-and-drop rescheduling, bulk generation, and the approval center."
    />
  );
}

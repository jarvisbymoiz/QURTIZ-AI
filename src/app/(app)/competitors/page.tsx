import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "competitors" };

export default function Page() {
  return (
    <ComingSoon
      section="competitors"
      milestone="M6"
      description="Competitor tracking via official APIs where available, with honest data-availability states."
    />
  );
}

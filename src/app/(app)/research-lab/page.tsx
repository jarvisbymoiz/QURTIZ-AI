import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "research lab" };

export default function Page() {
  return (
    <ComingSoon
      section="research lab"
      milestone="M2"
      description="Sourced topic research with AI-estimated opportunity scores. Real sources only — no fabricated trend data."
    />
  );
}

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "content studio" };

export default function Page() {
  return (
    <ComingSoon
      section="content studio"
      milestone="M2"
      description="The full content engine: generation, platform adaptation, QA, and the content lifecycle (draft → review → approved)."
    />
  );
}

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "connections" };

export default function Page() {
  return (
    <ComingSoon
      section="connections"
      milestone="M4"
      description="Official Facebook and Instagram connections via Meta OAuth, with token management and real connection status."
    />
  );
}

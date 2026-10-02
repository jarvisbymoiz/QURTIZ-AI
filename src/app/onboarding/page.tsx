import { QurtizMark } from "@/components/brand/mark";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/workspace";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Create workspace",
};

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <QurtizMark className="size-9" />
        <span className="text-lg font-semibold tracking-tight">QURTIZ AI</span>
      </div>
      <OnboardingForm userEmail={user.email} />
    </div>
  );
}

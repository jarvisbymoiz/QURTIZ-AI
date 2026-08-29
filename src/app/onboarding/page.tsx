import { redirect } from "next/navigation";
import { getSessionUser, getUserWorkspaces } from "@/lib/workspace";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Create workspace" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");


  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-foreground">
          Q
        </div>
        <span className="text-lg font-semibold tracking-tight">QURTIZ AI</span>
      </div>
      <OnboardingForm userEmail={user.email} />
    </div>
  );
}

import { Construction } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "./page-header";

/**
 * Honest placeholder for sections that ship in later milestones.
 * Clearly labeled — never pretends to be functional.
 */
export function ComingSoon({
  section,
  milestone,
  description,
}: {
  section: string;
  milestone: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={section} description={`Planned for ${milestone}.`} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Construction className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">
                Not built yet — {milestone}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">Coming soon</Badge>
          <p className="mt-3 text-sm text-muted-foreground">
            This section is part of the approved roadmap but has not been implemented
            yet. Nothing here will pretend to work — when it ships, it will be fully
            functional and connected to real data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, Loader2 } from "lucide-react";
import { markAllNotificationsReadAction } from "@/server/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await markAllNotificationsReadAction();
          if (r.ok) {
            toast.success(`Marked ${count} as read`);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CheckCheck className="size-3.5" aria-hidden />}
      Mark all read ({count})
    </Button>
  );
}

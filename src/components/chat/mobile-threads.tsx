"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadList } from "@/components/chat/thread-list";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Mobile drawer wrapper for the chat thread list (desktop shows the static aside). */
export function MobileThreads({ activeThreadId }: { activeThreadId: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" aria-label="Open chat history" />}>
        <Menu className="size-4" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-3">
        <SheetHeader>
          <SheetTitle>Chats</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100dvh-6rem)] overflow-y-auto">
          <ThreadList activeThreadId={activeThreadId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { refreshBrandWebsiteAction } from "@/server/actions/brand-website";
import type { WebsiteKnowledgeView } from "@/lib/brand-website/knowledge";
import { WEBSITE_ERROR_MESSAGES } from "@/lib/brand-website/messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WebsiteKnowledgeCard({website,knowledge,editable}:{
  website:string | null | undefined;knowledge:WebsiteKnowledgeView | null;editable:boolean;
}) {
  const router=useRouter();
  const [pending,start]=useTransition();
  function refresh() {
    start(async()=>{
      try {
        const result=await refreshBrandWebsiteAction();
        if (!result.ok) toast.error(result.error);
        else if (result.knowledge.status==="reading") toast.info("A website read is already in progress. Refresh this page shortly.");
        else toast.success(result.knowledge.status==="partial"?"Website knowledge available with some unread pages":"Website knowledge is available");
        router.refresh();
      } catch {toast.error("Website reading could not finish. Try again later.");}
    });
  }
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base"><Globe className="size-4 text-primary" aria-hidden />Website knowledge</CardTitle>
          <CardDescription>Public website information used by AI Chat, Content Studio and Auto Run. Your saved business details take priority.</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!editable || !website || pending} onClick={refresh}>
          {pending?<Loader2 className="size-4 animate-spin" aria-hidden />:<RefreshCw className="size-4" aria-hidden />}
          {pending?"Reading…":"Read / refresh website"}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        {!website?"Save a website above to enable reading.":!knowledge?"Not read yet. Save Business information or refresh here; the Agent will also read it when relevant.":
          knowledge.status==="reading"?"A read is in progress. Reopen or refresh this page shortly.":
          knowledge.status==="failed"?"The latest read failed. Any older source text below is cached and may be outdated.":
          `${knowledge.pages.length} public page${knowledge.pages.length===1?"":"s"} read${knowledge.status==="partial"?"; some pages were unavailable":""}.`}
      </p>
      {knowledge?.fetchedAt?<p className="text-xs text-muted-foreground">Last successful read: <time dateTime={knowledge.fetchedAt}>{knowledge.fetchedAt.slice(0,16).replace("T"," ")} UTC</time></p>:null}
      {knowledge?.warnings.map(code=><p key={code} className="text-xs text-muted-foreground">{WEBSITE_ERROR_MESSAGES[code]}</p>)}
      {knowledge?.pages.length?<div className="space-y-2">{knowledge.pages.map(page=><details key={page.url} className="rounded-lg border p-3">
        <summary className="cursor-pointer break-words font-medium">{page.title || "Public website page"}</summary>
        <div className="mt-2 space-y-2">
          <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 break-all text-xs text-primary">{page.url}<ExternalLink className="size-3 shrink-0" aria-hidden /></a>
          <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{page.text}</p>
        </div>
      </details>)}</div>:null}
      <p className="text-xs text-muted-foreground">Reads up to four public pages, respects robots.txt and caches them for 24 hours. Manual refreshes are at least five minutes apart. Login, private and JavaScript-only pages are not read.</p>
    </CardContent>
  </Card>;
}

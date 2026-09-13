"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  CircleAlert,
  HelpCircle,
  Instagram,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  saveSelectedMetaAccountsAction,
  dismissMetaDiscoveryAction,
  type ClientMetaDiscovery,
} from "@/server/actions/connections";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MetaAccountSelectionDialog({
  discovery,
  open,
  onOpenChange,
}: {
  discovery: ClientMetaDiscovery | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Selected IDs
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedIgUserId, setSelectedIgUserId] = useState<string | null>(null);

  // Auto-select first eligible page and IG account if available
  useEffect(() => {
    if (!discovery) return;

    const firstEligiblePage = discovery.pages.find((p) => p.canPost);
    if (firstEligiblePage) {
      setSelectedPageId(firstEligiblePage.id);
      if (firstEligiblePage.instagramAccount?.isEligible) {
        setSelectedIgUserId(firstEligiblePage.instagramAccount.id);
      }
    } else if (discovery.pages.length > 0) {
      setSelectedPageId(discovery.pages[0].id);
    }
  }, [discovery]);

  // When a page is selected, if it has an eligible IG, auto-select it; otherwise retain or clear
  function handleSelectPage(pageId: string) {
    setSelectedPageId(pageId);
    const page = discovery?.pages.find((p) => p.id === pageId);
    if (page?.instagramAccount?.isEligible) {
      setSelectedIgUserId(page.instagramAccount.id);
    }
  }

  function handleSave() {
    if (!selectedPageId && !selectedIgUserId) {
      toast.error("Please select at least one Facebook Page or Instagram account.");
      return;
    }

    start(async () => {
      const res = await saveSelectedMetaAccountsAction({
        pageId: selectedPageId,
        igUserId: selectedIgUserId,
      });

      if (res.ok) {
        const fbHealthy = res.facebookHealth?.ok;
        const igHealthy = res.instagramHealth?.ok;

        if (fbHealthy !== false && igHealthy !== false) {
          toast.success("Meta accounts connected and verified!");
        } else {
          toast.warning("Accounts saved. Check connection health status below.");
        }

        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCancel() {
    start(async () => {
      await dismissMetaDiscoveryAction();
      onOpenChange(false);
      router.refresh();
    });
  }

  if (!discovery) return null;

  const pages = discovery.pages;
  const eligiblePages = pages.filter((p) => p.canPost);
  const igAccounts = pages
    .map((p) => ({
      page: p,
      ig: p.instagramAccount,
    }))
    .filter((item) => item.ig !== null);

  const eligibleIgs = igAccounts.filter((item) => item.ig?.isEligible);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Select Meta Accounts to Connect
          </DialogTitle>
          <DialogDescription>
            Choose which Facebook Page and Instagram Professional account this workspace will publish to.
          </DialogDescription>
        </DialogHeader>

        {/* Authorized User and Scopes summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" aria-hidden />
              <span>
                Authorized as{" "}
                <span className="font-semibold text-foreground">
                  {discovery.authorizedUser?.name || "Facebook User"}
                </span>{" "}
                {discovery.authorizedUser?.id ? `(ID: ${discovery.authorizedUser.id})` : ""}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
              Long-Lived 60-Day Token
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <span className="font-medium">Permissions:</span>
            {discovery.grantedScopes.slice(0, 5).map((s) => (
              <span key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {s}
              </span>
            ))}
            {discovery.grantedScopes.length > 5 ? (
              <span className="text-muted-foreground">+{discovery.grantedScopes.length - 5} more</span>
            ) : null}
          </div>
        </div>

        {/* Facebook Pages Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>1. Facebook Page</span>
              <Badge variant="secondary" className="text-xs font-normal">
                {eligiblePages.length} eligible of {pages.length}
              </Badge>
            </h3>
            {selectedPageId ? (
              <button
                type="button"
                onClick={() => setSelectedPageId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </button>
            ) : null}
          </div>

          {pages.length === 0 ? (
            <Alert variant="destructive">
              <CircleAlert className="size-4" aria-hidden />
              <AlertTitle>No Facebook Pages found</AlertTitle>
              <AlertDescription className="text-xs">
                Your Facebook user does not currently manage any Facebook Pages. Create a Page at{" "}
                <a
                  href="https://www.facebook.com/pages/create"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium"
                >
                  facebook.com/pages/create
                </a>
                , ensure your account has full control or content creation access, and reconnect.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {pages.map((page) => {
                const isSelected = selectedPageId === page.id;
                const canSelect = page.canPost;

                return (
                  <div
                    key={page.id}
                    onClick={() => canSelect && handleSelectPage(page.id)}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : canSelect
                          ? "hover:border-foreground/30 bg-card"
                          : "opacity-60 bg-muted/40 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`mt-0.5 size-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected ? <Check className="size-2.5 stroke-[3]" /> : null}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{page.name}</span>
                        {page.category ? (
                          <span className="text-xs text-muted-foreground shrink-0">{page.category}</span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Page ID: {page.id}</span>
                        {!canSelect && page.unavailableReason ? (
                          <span className="text-destructive font-medium">{page.unavailableReason}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Instagram Accounts Selection */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Instagram className="size-4 text-pink-600" aria-hidden />
              <span>2. Instagram Professional Account</span>
              <Badge variant="secondary" className="text-xs font-normal">
                {eligibleIgs.length} eligible
              </Badge>
            </h3>
            {selectedIgUserId ? (
              <button
                type="button"
                onClick={() => setSelectedIgUserId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </button>
            ) : null}
          </div>

          {igAccounts.length === 0 ? (
            <Alert>
              <HelpCircle className="size-4" aria-hidden />
              <AlertTitle>No Instagram accounts linked to your Pages</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>
                  To publish to Instagram via the official Meta API, your Instagram account must be a{" "}
                  <strong>Professional (Business or Creator)</strong> account and linked to your Facebook Page.
                </p>
                <p className="text-muted-foreground">
                  Open <strong>Meta Business Suite</strong> → <strong>Page Settings</strong> →{" "}
                  <strong>Linked Accounts</strong> → <strong>Connect Instagram</strong>, then reconnect here.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {igAccounts.map(({ page, ig }) => {
                if (!ig) return null;
                const isSelected = selectedIgUserId === ig.id;
                const canSelect = ig.isEligible;

                return (
                  <div
                    key={ig.id}
                    onClick={() => canSelect && setSelectedIgUserId(ig.id)}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : canSelect
                          ? "hover:border-foreground/30 bg-card"
                          : "opacity-75 bg-muted/30 cursor-not-allowed border-amber-500/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 size-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected ? <Check className="size-2.5 stroke-[3]" /> : null}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {ig.username ? `@${ig.username}` : ig.name || "Instagram Account"}
                          </span>
                          {ig.isEligible ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] font-normal">
                              Professional
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] font-normal">
                              {ig.status === "ineligible_personal" ? "Personal Account" : "Action Needed"}
                            </Badge>
                          )}
                        </div>

                        {typeof ig.followersCount === "number" ? (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {ig.followersCount.toLocaleString()} followers
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Linked via Page: <span className="text-foreground">{page.name}</span>
                      </p>

                      {!canSelect && ig.unavailableReason ? (
                        <div className="rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                          {ig.unavailableReason}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={pending}>
            Dismiss
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={pending || (!selectedPageId && !selectedIgUserId)}
            className="gap-2"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" />}
            Connect Selected Accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  BarChart3,
  Brain,
  CalendarDays,
  ChevronDown,
  FlaskConical,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PenSquare,
  Plug,
  Settings,
  Target,
  LogOut,
  Plus,
} from "lucide-react";
import { switchWorkspaceAction } from "@/server/actions/workspace";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_MAIN = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/content-studio", label: "Content Studio", icon: PenSquare, soon: "M2" },
  { href: "/research-lab", label: "Research Lab", icon: FlaskConical, soon: "M2" },
  { href: "/calendar", label: "Content Calendar", icon: CalendarDays, soon: "M3" },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, soon: "M3" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, soon: "M5" },
  { href: "/competitors", label: "Competitors", icon: Target, soon: "M6" },
  { href: "/brand-brain", label: "Brand Brain", icon: Brain },
  { href: "/connections", label: "Connections", icon: Plug, soon: "M4" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export type SidebarWorkspace = {
  id: string;
  name: string;
};

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  activeWorkspaceName,
  userEmail,
  role,
}: {
  workspaces: SidebarWorkspace[];
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  userEmail: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSwitching, startSwitch] = useTransition();

  function switchTo(workspaceId: string) {
    startSwitch(async () => {
      const result = await switchWorkspaceAction(workspaceId);
      if (result.ok) {
        router.push("/");
        router.refresh();
      }
    });
  }

  function signOut() {
    // Full-page POST to /auth/signout (server route clears the session).
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-foreground">
          Q
        </div>
        <div className="font-semibold tracking-tight">QURTIZ AI</div>
      </div>

      {/* Workspace switcher */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className="w-full justify-between font-normal"
                disabled={isSwitching}
              />
            }
          >
            <span className="truncate">{activeWorkspaceName}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => w.id !== activeWorkspaceId && switchTo(w.id)}
                className={cn(
                  "justify-between",
                  w.id === activeWorkspaceId && "font-medium",
                )}
              >
                <span className="truncate">{w.name}</span>
                {w.id === activeWorkspaceId ? (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/onboarding" />}>
              <Plus className="size-4" aria-hidden />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3" aria-label="Main">
        {NAV_MAIN.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.soon ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {item.soon}
                </span>
              ) : null}
            </Link>
          );
          return item.soon ? (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent>Planned for milestone {item.soon}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <Separator />

      {/* User */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="w-full justify-start gap-2 px-2 font-normal" />}
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs uppercase">
                {userEmail.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="w-full truncate text-sm">{userEmail}</span>
              <span className="text-xs text-muted-foreground capitalize">{role}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} variant="destructive">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

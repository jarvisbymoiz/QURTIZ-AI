"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginWithPasswordAction } from "@/server/actions/auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function LoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/";
  // Prevent redirect loops back to login/signup
  const next =
    rawNext.startsWith("/login") || rawNext.startsWith("/signup")
      ? "/"
      : rawNext.startsWith("/")
        ? rawNext
        : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicMode, setMagicMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }

    // Auto-redirect if already signed in
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          window.location.href = next;
        }
      });
    } catch {
      // Ignore initial auth probe error
    }
  }, [next]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      // 1. Authenticate via Server Action so Set-Cookie response headers are dispatched
      const serverRes = await loginWithPasswordAction(email, password);
      if (!serverRes.ok) {
        toast.error(serverRes.error ?? "Invalid email or password.");
        setBusy(false);
        return;
      }

      // 2. Also hydrate browser client storage
      try {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({ email, password });
      } catch {
        // Non-blocking if browser storage write fails; server cookies are already set
      }

      toast.success("Signed in successfully! Loading workspace…");
      // 3. Full document navigation ensures fresh server rendering with authentication cookies
      window.location.href = next;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Login failed. Check your configuration.",
      );
      setBusy(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const origin = getPublicAppUrl();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Magic link sent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send magic link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          {magicMode
            ? "We'll email you a one-time sign-in link."
            : "Sign in to your QURTIZ AI workspace."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inIframe ? (
          <div className="mb-4 rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Running in embedded preview?</span>
            <a
              href={typeof window !== "undefined" ? window.location.href : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              Open in new tab
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        <form onSubmit={magicMode ? handleMagicLink : handlePasswordLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {!magicMode ? (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : magicMode ? "Send magic link" : "Sign in"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setMagicMode((v) => !v)}
        >
          {magicMode ? "Use password instead" : "Sign in with a magic link"}
        </Button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-4">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

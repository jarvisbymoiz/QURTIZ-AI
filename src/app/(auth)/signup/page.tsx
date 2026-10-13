"use client";

import { signupOutcome } from "@/lib/supabase/signup-result";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getPublicAppUrl } from "@/lib/app-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signupError, setSignupError] = useState<{ message: string; existing: boolean } | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setSignupError(null);
    try {
      const supabase = createClient();
      const origin = getPublicAppUrl();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      const outcome = signupOutcome({ data, error });
      if (outcome.kind === "error" || outcome.kind === "existing") {
        setSignupError({ message: outcome.message, existing: outcome.kind === "existing" });
        toast.error(outcome.message);
        return;
      }
      if (outcome.kind === "signed-in") {
        window.location.href = "/dashboard";
        return;
      }
      setEmailSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed.";
      setSignupError({ message, existing: false });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (emailSent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Check your inbox</CardTitle>
          <CardDescription>
            Check <strong>{email.trim()}</strong> for a confirmation link, including
            your spam folder. If you already have an account, sign in instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} variant="outline" className="w-full" render={<Link href="/login" />}>Back to sign in</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>One account manages all your brand workspaces.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSignupError(null); }}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setSignupError(null); }}
              placeholder="At least 8 characters"
            />
          </div>
          {signupError && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p>{signupError.message}</p>
              {signupError.existing && <Link href="/login" className="mt-2 inline-block font-medium underline underline-offset-4">Sign in to your account</Link>}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}



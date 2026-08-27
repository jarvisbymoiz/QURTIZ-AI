import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link href="/login" className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-foreground">
          Q
        </div>
        <span className="text-lg font-semibold tracking-tight">QURTIZ AI</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

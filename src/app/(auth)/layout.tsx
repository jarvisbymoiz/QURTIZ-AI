import Link from "next/link";
import { QurtizMark } from "@/components/brand/mark";
export const metadata = { robots: { index: false, follow: false } };
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link
        href="/"
        className="flex items-center gap-2"
        aria-label="Qurtiz AI home"
      >
        <QurtizMark className="size-10" />
        <span className="text-lg font-semibold tracking-tight">Qurtiz AI</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/">Home</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </p>
    </div>
  );
}

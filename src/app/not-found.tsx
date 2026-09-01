import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "QURTIZ AI";

/** Root 404: honest page for unknown routes, with a way back into the app. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist on {APP_NAME} or may have moved.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}

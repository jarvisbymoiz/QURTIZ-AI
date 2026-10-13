import type { Metadata } from "next";
import { siteUrl } from "@/lib/public/site";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VercelTelemetry } from "@/components/analytics/vercel-telemetry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  verification: {
    google: "uNRhRaNFcUyNF5E9fRHijDH2IX4RYdz54P2oTjE-dko",
  },
  referrer: "strict-origin",
  metadataBase: new URL(siteUrl()),
  manifest: "/manifest.webmanifest",
  applicationName: "Qurtiz AI",
  openGraph: { siteName: "Qurtiz AI" },
  title: {
    default: "Qurtiz AI — Social Media Agent",
    template: "%s · Qurtiz AI",
  },
  description:
    "An agent-first social media operating system: research, strategy, content, visuals, scheduling, publishing and analytics for every brand you manage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
        {process.env.VERCEL === "1" && <VercelTelemetry />}
      </body>
    </html>
  );
}


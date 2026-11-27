import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import SiteNavigation from "./site-navigation";
import SiteVisitTracker from "./site-visit-tracker";
import AccountActivityTracker from "./account-activity-tracker";
import CurrentTheme from "./current-theme";
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
  title: "Never Say Goodbye",
  description:
    "Build it today. Leave it forever. Preserve your presence. Share your moments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Suspense fallback={null}><CurrentTheme /></Suspense>
        <Suspense fallback={null}><SiteVisitTracker /></Suspense>
        <Suspense fallback={null}><AccountActivityTracker /></Suspense>
        <SiteNavigation />
        {children}
        <footer className="mt-auto bg-[color:var(--nsg-background)] px-6 py-4 text-center">
          <nav aria-label="Footer navigation" className="flex flex-wrap justify-center gap-x-6">
            <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">
              Need more Moment Maker™ tools?
            </Link>
            <Link href="/help" className="inline-flex min-h-11 items-center text-sm text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">
              Help Center
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}

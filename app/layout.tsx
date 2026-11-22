import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import SiteNavigation from "./site-navigation";
import SiteVisitTracker from "./site-visit-tracker";
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
        <Suspense fallback={null}><SiteVisitTracker /></Suspense>
        <SiteNavigation />
        {children}
        <footer className="mt-auto bg-[#0F172A] px-6 py-4 text-center">
          <nav aria-label="Footer navigation">
            <Link href="/help" className="inline-flex min-h-11 items-center text-sm text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]">
              Help Center
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}

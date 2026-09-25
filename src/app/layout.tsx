import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, UnofficialBanner } from "@/components/site-header";
import { copy } from "@/lib/copy";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: `${copy.siteName} — TUM exam statistics`,
    template: `%s · ${copy.siteName}`,
  },
  description: copy.tagline,
};

// Privacy-friendly analytics are opt-in: only loaded when a Plausible domain is configured.
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <UnofficialBanner />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {plausibleDomain ? (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        ) : null}
      </body>
    </html>
  );
}

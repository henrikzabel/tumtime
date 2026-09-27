import type { Metadata } from "next";
import { Cal_Sans, Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteSidebar, UnofficialBanner } from "@/components/site-header";
import { copy } from "@/lib/copy";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const calSans = Cal_Sans({ subsets: ["latin"], weight: "400", variable: "--font-cal-sans" });

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
    <html lang="en" className={`${inter.variable} ${calSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full font-sans">
        <SiteSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <UnofficialBanner />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        {plausibleDomain ? (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        ) : null}
      </body>
    </html>
  );
}

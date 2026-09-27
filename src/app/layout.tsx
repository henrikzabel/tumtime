import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";

import { copy } from "@/lib/copy";
import "./globals.css";

// Cal Sans v2 (OFL, github.com/calcom/sans): variable weight 400–700 with optical sizes for UI text and headlines.
const calSans = localFont({
  src: "./fonts/CalSansVF.woff2",
  weight: "400 700",
  variable: "--font-cal-sans",
  display: "swap",
});

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
    <html lang="en" className={`${calSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        {plausibleDomain ? (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        ) : null}
      </body>
    </html>
  );
}

import { BrandLogo } from "@/components/brand-mark";
import "./globals.css";
import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import { Preferences } from "@/components/preferences";
const geist = localFont({
  src: "../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});
export const metadata: Metadata = {
  title: "LOVEscan · Good food. Less waiting.",
  description: "Scan, order and enjoy. Restaurant ordering, made simple.",
  icons: { icon: "/lovescan-mark.svg", apple: "/icon-192.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LOVEscan" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#245b47",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body>
        <Preferences>{children}</Preferences>
        <footer className="site-credit no-print"><a href="/" className="credit-brand"><BrandLogo /></a><small>made with LOVE by Vashik Technologies</small></footer>
      </body>
    </html>
  );
}

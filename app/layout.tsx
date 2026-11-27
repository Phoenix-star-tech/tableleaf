import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Preferences } from "@/components/preferences";
export const metadata: Metadata = {
  title: "Tableleaf · Good food. Less waiting.",
  description: "Scan, order and enjoy. Restaurant ordering, made simple.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tableleaf" },
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <Preferences>{children}</Preferences>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Archivo, Geist } from "next/font/google";
import "./globals.css";

// Interface text.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// The dial's voice: condensed widths for the wordmark and every hour numeral.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const description =
  "A living globe of anonymous strangers, each at their own hour. Tap a dot, ask to talk, and if they say yes you're connected. No account, nothing kept.";

// Absolute URLs for the share image: the production domain on Vercel.
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Pulse · strangers awake right now",
  description,
  applicationName: "Pulse",
  openGraph: {
    type: "website",
    siteName: "Pulse",
    title: "Pulse · strangers awake right now",
    description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0f1b33",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request: each page view carries a fresh CSP nonce (proxy.ts),
  // which a page prerendered at build time could not.
  await connection();
  return (
    <html lang="en" className={`${geist.variable} ${archivo.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

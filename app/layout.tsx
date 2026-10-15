import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: "Pulse · strangers awake right now",
  description:
    "A living globe of anonymous strangers, each at their own hour. Tap a dot, ask to talk, and if they say yes you're connected. No account, nothing kept.",
  applicationName: "Pulse",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0f1b33",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${archivo.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: { default: "Ambang — Latihan SKD & Excel", template: "%s · Ambang" },
  description: "Latihan SKD & Excel sampai lewat ambang batas.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece9e1" },
    { media: "(prefers-color-scheme: dark)", color: "#020202" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${space.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

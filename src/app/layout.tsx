import type { Metadata, Viewport } from "next";
import { EB_Garamond, DM_Mono } from "next/font/google";
import "./globals.css";
import { FloatingNav } from "@/components/FloatingNav";

// EB Garamond — the main face. Classical serif, body + display. Reads
// editorial / contract / financial-document.
const eb = EB_Garamond({
  variable: "--font-eb",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// DM Mono — the secondary face. Used for labels, numerics, addresses, chart
// axes, the wordmark — anything where character-cell alignment carries
// meaning. Ships at 300/400/500.
const dm = DM_Mono({
  variable: "--font-dm",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "crypt — parametric SLA escrow on Stellar",
  description:
    "Operators lock USDC into a Trustless Work escrow. If the protected API goes dark past the threshold, the escrow auto-pays the subscriber. No lawyers. No disputes.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${eb.variable} ${dm.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <FloatingNav />
      </body>
    </html>
  );
}

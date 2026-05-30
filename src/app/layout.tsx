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
    <html
      lang="en"
      className={`${eb.variable} ${dm.variable} h-full antialiased`}
    >
      <head>
        <meta
          name="talentapp:project_verification"
          content="205ffe4147215c48424222082063fbd450d5d12fed38374dcaabbffcd2baa52d6c899dbc4103e09f6ffab9394ef03f574c422ac44cd64bf1d75997c17ca24f72"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <FloatingNav />
      </body>
    </html>
  );
}

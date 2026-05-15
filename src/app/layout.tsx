import type { Metadata } from "next";
import { Azeret_Mono, Nova_Mono } from "next/font/google";
import "./globals.css";

const azeret = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const nova = Nova_Mono({
  variable: "--font-nova",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "tilt — parametric SLA escrow on Stellar",
  description:
    "Operators lock USDC into a Trustless Work escrow. If the protected API goes dark past the threshold, the escrow auto-pays the subscriber. No lawyers. No disputes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${azeret.variable} ${nova.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// One mono family across the whole app. JetBrains Mono trades the typewriter
// stiffness of Azeret/Nova for a humanist, much-more-readable hand at every
// size — same operator-console vibe, fewer "is that a 0 or O" moments.
const jb = JetBrains_Mono({
  variable: "--font-jb",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
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
      className={`${jb.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

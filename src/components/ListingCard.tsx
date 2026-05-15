"use client";

import Link from "next/link";
import type { Listing } from "@/lib/types";

/**
 * Ledger-row layout. Hairline divider, monospace fields, hover advances the
 * row indicator (the trailing "›"). No card, no shadow, no radius.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block border-t border-[var(--rule-0)] last:border-b last:border-b-[var(--rule-0)]
                 hover:bg-[var(--ink-1)] transition-colors"
    >
      <div className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(5rem,_auto)_1.5rem]
                      items-center gap-6 px-4 py-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="label">
            {listing.provider_wallet.slice(0, 6)}…{listing.provider_wallet.slice(-4)}
          </span>
          <span className="text-[15px] text-[var(--fg-0)] truncate">{listing.title}</span>
          <span className="numeric text-[11px] text-[var(--fg-2)] truncate">
            {listing.api_url}
          </span>
        </div>

        <Cell label="their deposit" accent>
          {Number(listing.guarantee_usdc).toFixed(2)}
        </Cell>
        <Cell label="your deposit">
          {Number(listing.subscription_fee_usdc).toFixed(2)}
        </Cell>
        <Cell label="check every">{listing.oracle_period_sec}s</Cell>

        <span
          className="text-lg text-[var(--fg-3)] group-hover:text-[var(--amber)] transition-colors"
          aria-hidden
        >
          ›
        </span>
      </div>
    </Link>
  );
}

function Cell({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="label">{label}</span>
      <span
        className="numeric text-sm"
        style={{ color: accent ? "var(--amber)" : "var(--fg-0)" }}
      >
        {children}
      </span>
    </div>
  );
}

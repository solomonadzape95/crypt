"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/Panel";
import type { Listing } from "@/lib/types";

type ListingWithCount = Listing & { subscriberCount: number };

export default function ProviderPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.authenticated) {
        router.replace("/login?next=/provider");
        return;
      }
      setAddress(me.address);

      const supabase = getBrowserClient();
      const { data: rows } = await supabase
        .from("listings")
        .select("*")
        .eq("provider_wallet", me.address)
        .order("created_at", { ascending: false });
      const base = (rows as Listing[] | null) ?? [];
      const counted: ListingWithCount[] = await Promise.all(
        base.map(async (l) => {
          const { count } = await supabase
            .from("vaults")
            .select("*", { count: "exact", head: true })
            .eq("listing_id", l.id);
          return { ...l, subscriberCount: count ?? 0 };
        })
      );
      setListings(counted);
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "provider" }, { label: "offers" }]}
        address={address}
        rightLinks={[
          { href: "/vaults", label: "my coverage" },
          { href: "/marketplace", label: "marketplace" },
        ]}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-3">
            <span className="label">your offers</span>
            <h1 className="display" style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)" }}>
              Open offers.
            </h1>
            <p className="text-[13px] text-[var(--fg-1)] max-w-[58ch]">
              Each offer is open. Anyone can subscribe — you put up a deposit for each
              one.
            </p>
          </div>
          <Link
            href="/provider/listings/new"
            className="h-11 px-5 text-sm font-medium border border-[var(--amber)]
                       bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                       hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                       flex items-center"
          >
            + new offer
          </Link>
        </div>

        {loading ? (
          <Panel label="offers · loading">
            <p className="label px-4 py-6 text-[var(--fg-3)]">loading…</p>
          </Panel>
        ) : listings.length === 0 ? (
          <Panel label="offers · 0">
            <div className="px-4 py-8 flex flex-col gap-3">
              <p className="text-[14px] text-[var(--fg-1)]">No offers yet.</p>
              <p className="text-[13px] text-[var(--fg-2)]">
                Publish one — subscribers will see it in the marketplace.
              </p>
            </div>
          </Panel>
        ) : (
          <Panel label={`offers · ${listings.length}`}>
            <div
              className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(7rem,_auto)]
                         items-stretch divide-x divide-[var(--rule-0)]
                         bg-[var(--ink-2)] border-b border-[var(--rule-0)]"
            >
              <div className="px-4 py-2 label">title</div>
              <div className="px-4 py-2 label text-right">your deposit</div>
              <div className="px-4 py-2 label text-right">their deposit</div>
              <div className="px-4 py-2 label text-right">subscribers</div>
            </div>
            <ul className="flex flex-col">
              {listings.map((l) => (
                <li key={l.id}>
                  <ListingRow listing={l} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
    </main>
  );
}

function ListingRow({ listing }: { listing: ListingWithCount }) {
  return (
    <Link
      href={`/provider/listings/${listing.id}`}
      className="group block border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
    >
      <div className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(7rem,_auto)]
                      items-stretch divide-x divide-[var(--rule-0)]">
        <div className="flex flex-col gap-1 min-w-0 px-4 py-4 justify-center">
          <span className="label">
            {listing.active ? (
              <span style={{ color: "var(--signal-ok)" }}>● live</span>
            ) : (
              <span style={{ color: "var(--fg-3)" }}>○ paused</span>
            )}
          </span>
          <span className="text-[14px] text-[var(--fg-0)] truncate">{listing.title}</span>
          <span className="numeric text-[11px] text-[var(--fg-2)] truncate">
            {listing.api_url}
          </span>
        </div>
        <Cell label="your deposit" accent>
          {Number(listing.guarantee_usdc).toFixed(2)}
        </Cell>
        <Cell label="their deposit">
          {Number(listing.subscription_fee_usdc).toFixed(2)}
        </Cell>
        <Cell label="subscribers">{listing.subscriberCount}</Cell>
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
    <div className="flex flex-col items-end gap-1 px-4 py-4 justify-center">
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

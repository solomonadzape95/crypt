"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { ListingCard } from "@/components/ListingCard";
import { Panel } from "@/components/Panel";
import type { Listing } from "@/lib/types";

export default function MarketplacePage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.authenticated) {
        router.replace("/login?next=/marketplace");
        return;
      }
      setAddress(me.address);

      const supabase = getBrowserClient();
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setListings((data as Listing[] | null) ?? []);
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "marketplace" }]}
        address={address}
        rightLinks={[
          { href: "/vaults", label: "my subs" },
          { href: "/provider", label: "provider" },
        ]}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8 items-end">
          <div className="flex flex-col gap-3">
            <span className="label">open offers</span>
            <h1 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
              Pick coverage.
              <br />
              Lock in the deal.
              <br />
              <span style={{ color: "var(--amber)" }}>Sleep through 3am.</span>
            </h1>
          </div>
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed">
            Pick a coverage offer. We lock both deposits on Stellar — when the API stays
            down past the limit, you get paid the full amount automatically.
          </p>
        </div>

        {loading ? (
          <Loading />
        ) : listings.length === 0 ? (
          <Empty />
        ) : (
          <Panel label={`offers · ${listings.length}`}>
            <div
              className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(5rem,_auto)]
                         items-stretch divide-x divide-[var(--rule-0)]
                         bg-[var(--ink-2)] border-b border-[var(--rule-0)]"
            >
              <div className="px-4 py-2 label">provider · title</div>
              <div className="px-4 py-2 label text-right">their deposit</div>
              <div className="px-4 py-2 label text-right">your deposit</div>
              <div className="px-4 py-2 label text-right">check every</div>
            </div>
            <ul className="flex flex-col">
              {listings.map((l) => (
                <li key={l.id}>
                  <ListingCard listing={l} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
    </main>
  );
}

function Loading() {
  return (
    <Panel label="offers · loading">
      <p className="label px-4 py-6 text-[var(--fg-3)]">loading…</p>
    </Panel>
  );
}

function Empty() {
  return (
    <Panel label="offers · 0">
      <div className="px-4 py-8 flex flex-col gap-3">
        <p className="text-[14px] text-[var(--fg-1)]">No offers yet.</p>
        <Link
          href="/provider/listings/new"
          className="label text-[var(--amber)] hover:underline w-fit"
        >
          publish the first one
        </Link>
      </div>
    </Panel>
  );
}

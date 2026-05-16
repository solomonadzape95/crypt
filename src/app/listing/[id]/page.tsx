"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SLATermsCard } from "@/components/SLATermsCard";
import { SubscribeDialog } from "@/components/SubscribeDialog";
import { Panel, MetricRow } from "@/components/Panel";
import type { Listing, Vault } from "@/lib/types";

type Params = { id: string };

export default function ListingDetailPage(props: { params: Promise<Params> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [showSubscribe, setShowSubscribe] = useState(false);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.authenticated) {
        router.replace(`/login?next=/listing/${id}`);
        return;
      }
      setAddress(me.address);

      const res = await fetch(`/api/listing/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { listing: Listing };
      setListing(data.listing);
    })();
  }, [id, router]);

  if (!listing) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="label">loading listing…</span>
      </main>
    );
  }

  const previewVault = {
    sla_target_pct: listing.sla_target_pct,
    failure_threshold: listing.failure_threshold,
    oracle_period_sec: listing.oracle_period_sec,
    guarantee_usdc: listing.guarantee_usdc,
    subscription_fee_usdc: listing.subscription_fee_usdc,
  } as Vault;

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[
          { label: "marketplace", href: "/marketplace" },
          { label: listing.title },
        ]}
        address={address}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="label numeric text-[var(--fg-2)]">
                provider {listing.provider_wallet.slice(0, 8)}…{listing.provider_wallet.slice(-6)}
              </span>
              <h1
                className="display"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                {listing.title}
              </h1>
              <p className="numeric text-[13px] text-[var(--fg-2)] break-all">
                {listing.api_url}
              </p>
            </div>
            {listing.description && (
              <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-[68ch]">
                {listing.description}
              </p>
            )}
            <SLATermsCard vault={previewVault} />
          </div>

          <aside className="flex flex-col gap-6">
            <Panel label="coverage">
              <MetricRow
                label="provider deposit"
                accent="amber"
                value={`${Number(listing.guarantee_usdc).toFixed(2)} USDC`}
              />
              <MetricRow
                label="your deposit"
                accent="amber"
                value={`${Number(listing.subscription_fee_usdc).toFixed(2)} USDC`}
              />
              <MetricRow label="check every" value={`${listing.oracle_period_sec}s`} />
              <MetricRow
                label="payout after"
                value={`${listing.failure_threshold} failed checks in a row`}
              />
              <MetricRow
                label="uptime promised"
                value={`${Number(listing.sla_target_pct).toFixed(2)}%`}
              />
            </Panel>

            {showSubscribe ? (
              <SubscribeDialog
                listingId={listing.id}
                signedInWallet={address}
                baseFeeUsdc={Number(listing.subscription_fee_usdc)}
                periodOptions={listing.period_options}
                payoutMode={listing.payout_mode}
                guaranteeUsdc={Number(listing.guarantee_usdc)}
                coverageRatioX={
                  listing.coverage_ratio_x != null
                    ? Number(listing.coverage_ratio_x)
                    : null
                }
                onSubscribed={(vaultId) => router.push(`/vault/${vaultId}`)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowSubscribe(true)}
                disabled={!listing.active}
                className="h-12 px-6 border border-[var(--amber)] bg-[var(--amber)]
                           text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                           transition-colors uppercase tracking-[0.12em] text-sm font-medium
                           disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
              >
                {listing.active ? "subscribe" : "listing paused"}
              </button>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

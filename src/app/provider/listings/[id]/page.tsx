"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Panel, MetricRow, LabeledRule } from "@/components/Panel";
import { PoolPanel } from "@/components/PoolPanel";
import { SLATermsCard } from "@/components/SLATermsCard";
import { timeUntil, periodDaysLabel } from "@/lib/time";
import type { Listing, Vault, VaultStatus } from "@/lib/types";

type Params = { id: string };

const GROUPS: { status: VaultStatus; label: string }[] = [
  { status: "under_threat", label: "failing" },
  { status: "locked", label: "active" },
  { status: "funding", label: "waiting on funds" },
  { status: "disbursed", label: "paid out" },
  { status: "expired", label: "closed" },
];

export default function ProviderListingPage(props: { params: Promise<Params> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData.authenticated) {
        router.replace(`/login?next=/provider/listings/${id}`);
        return;
      }
      setMe(meData.address);

      const supabase = getBrowserClient();
      const { data: l } = await supabase.from("listings").select("*").eq("id", id).single();
      setListing(l as Listing | null);

      const { data: vs } = await supabase
        .from("vaults")
        .select("*")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      setVaults((vs as Vault[] | null) ?? []);
    })();
  }, [id, router]);

  if (!listing) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="label">loading offer…</span>
      </main>
    );
  }

  if (me && me !== listing.provider_wallet) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <span className="label">this isn&apos;t your offer</span>
        <Link href="/provider" className="label text-[var(--amber)] underline">
          back to your offers
        </Link>
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
          { label: "provider", href: "/provider" },
          { label: listing.title },
        ]}
        address={me}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="label">
                {listing.active ? (
                  <span style={{ color: "var(--signal-ok)" }}>● live</span>
                ) : (
                  <span style={{ color: "var(--fg-3)" }}>○ paused</span>
                )}
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
              {listing.description && (
                <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-[68ch] mt-2">
                  {listing.description}
                </p>
              )}
            </div>

            <SLATermsCard vault={previewVault} />
          </div>

          <aside className="flex flex-col gap-6">
            {listing.payout_mode === "pool" && (
              <PoolPanel listing={listing} vaults={vaults} />
            )}
            <Panel
              label={
                listing.payout_mode === "pool"
                  ? "subscriber terms"
                  : "deposits · per subscriber"
              }
            >
              {listing.payout_mode === "per_vault" && (
                <MetricRow
                  label="your deposit"
                  accent="amber"
                  value={`${Number(listing.guarantee_usdc).toFixed(2)} USDC`}
                />
              )}
              <MetricRow
                label="subscriber deposit · per week"
                accent="amber"
                value={`${Number(listing.subscription_fee_usdc).toFixed(2)} USDC`}
              />
              {listing.payout_mode === "pool" && listing.coverage_ratio_x != null && (
                <MetricRow
                  label="coverage ratio"
                  value={`${Number(listing.coverage_ratio_x)}× claim per fee`}
                />
              )}
              <MetricRow label="check every" value={`${listing.oracle_period_sec}s`} />
              <MetricRow
                label="payout after"
                value={`${listing.failure_threshold} failed checks in a row`}
              />
              <MetricRow
                label="payout wallet"
                value={
                  <span className="numeric">
                    {listing.provider_payout_target.slice(0, 6)}…
                    {listing.provider_payout_target.slice(-4)}
                  </span>
                }
              />
            </Panel>
          </aside>
        </div>

        <LabeledRule
          label={`subscribers · ${vaults.length}`}
          trailing={vaults.length === 0 ? "share the marketplace link" : undefined}
        />

        {vaults.length === 0 ? (
          <Panel label="no subscribers yet">
            <p className="label px-4 py-6 text-[var(--fg-3)]">
              share the marketplace link to get your first subscriber
            </p>
          </Panel>
        ) : (
          <div className="flex flex-col gap-6">
            {GROUPS.map(({ status, label }) => {
              const group = vaults.filter((v) => v.status === status);
              if (group.length === 0) return null;
              return (
                <Panel key={status} label={`${label} · ${group.length}`}>
                  <ul className="flex flex-col">
                    {group.map((v) => (
                      <li key={v.id}>
                        <SubscriberRow vault={v} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SubscriberRow({ vault }: { vault: Vault }) {
  const needsProviderFund = vault.status === "funding" && !vault.guarantee_funded_at;
  return (
    <Link
      href={`/vault/${vault.id}`}
      className="group block border-t border-[var(--rule-0)] first:border-t-0 hover:bg-[var(--ink-2)] transition-colors"
    >
      <div className="grid grid-cols-[1fr_auto] items-stretch divide-x divide-[var(--rule-0)]">
        <div className="flex flex-col gap-1 min-w-0 px-4 py-3 justify-center">
          <span className="numeric text-[12px] text-[var(--fg-1)]">
            sub {vault.subscriber_wallet.slice(0, 6)}…{vault.subscriber_wallet.slice(-4)}
          </span>
          <FundedRow vault={vault} />
          {vault.expires_at && vault.status !== "disbursed" && vault.status !== "expired" && (
            <span className="label text-[var(--fg-3)]">
              {periodDaysLabel(vault.period_days)} · {timeUntil(vault.expires_at)}
            </span>
          )}
        </div>
        <span
          className="label flex items-center px-4 py-3"
          style={{
            color: needsProviderFund ? "var(--amber)" : "var(--fg-2)",
          }}
        >
          {needsProviderFund ? "fund your deposit" : "open"}
        </span>
      </div>
    </Link>
  );
}

function FundedRow({ vault }: { vault: Vault }) {
  const g = !!vault.guarantee_funded_at;
  const s = !!vault.subscription_funded_at;
  return (
    <div className="flex items-center gap-3 label">
      <span
        style={{ color: g ? "var(--amber)" : "var(--fg-3)" }}
        title="your deposit"
      >
        yours {g ? "✓" : "·"}
      </span>
      <span className="text-[var(--fg-3)]">/</span>
      <span
        style={{ color: s ? "var(--amber)" : "var(--fg-3)" }}
        title="subscriber deposit"
      >
        theirs {s ? "✓" : "·"}
      </span>
    </div>
  );
}

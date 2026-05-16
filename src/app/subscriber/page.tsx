"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Panel, MetricRow } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { vaultUiStatus } from "@/lib/vault-state";
import { timeUntil, periodDaysLabel } from "@/lib/time";
import type { Vault } from "@/lib/types";

/**
 * Subscriber dashboard. Mirrors the provider dashboard's shape: identity card
 * at top, then the role-specific list (your coverage). Uses the same Panel /
 * StatusBadge / row primitives as the rest of the app.
 */
export default function SubscriberDashboardPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.authenticated) {
        router.replace("/login?next=/subscriber");
        return;
      }
      setAddress(me.address);

      const supabase = getBrowserClient();
      const { data } = await supabase
        .from("vaults")
        .select("*")
        .eq("subscriber_wallet", me.address)
        .order("created_at", { ascending: false });
      setVaults((data as Vault[]) ?? []);
      setLoading(false);
    })();
  }, [router]);

  // "Active" = currently engaged. Funding counts because the subscriber is
  // committed to it (the per-vault deposits may still be landing on chain).
  const isActive = (v: Vault) =>
    v.status === "funding" || v.status === "locked" || v.status === "under_threat";
  const live = vaults.filter(isActive).length;
  const totalCovered = vaults
    .filter(isActive)
    .reduce((s, v) => s + Number(v.guarantee_usdc), 0);
  // Lifetime sum of payouts the subscriber has received from breaches.
  // Only counts subscriber-favourable resolutions; the legacy direct-settle
  // path (no dispute) is also subscriber-favourable.
  const lifetimePaidOut = vaults
    .filter(
      (v) =>
        v.status === "disbursed" &&
        (v.dispute_status === "resolved_subscriber" || v.dispute_status === "none"),
    )
    .reduce(
      (s, v) => s + Number(v.guarantee_usdc) + Number(v.subscription_fee_usdc),
      0,
    );

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "subscriber" }, { label: "dashboard" }]}
        address={address}
        rightLinks={[
          { href: "/marketplace", label: "marketplace" },
          { href: "/demo", label: "demo" },
        ]}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-3">
            <span className="label">subscriber dashboard</span>
            <h1
              className="hero-display"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)" }}
            >
              Your coverage.
            </h1>
            <p className="text-[13px] text-[var(--fg-1)] max-w-[58ch]">
              Each vault is backed by USDC from a provider. If a covered API
              stays down past its limit, the vault pays you out automatically.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="h-11 px-5 text-sm font-medium border border-[var(--amber)]
                       bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                       hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                       flex items-center"
          >
            browse marketplace
          </Link>
        </div>

        {/* identity strip */}
        <Panel label="identity">
          <div className="flex flex-col">
            <MetricRow
              label="wallet"
              value={address ? <span className="break-all">{address}</span> : "—"}
            />
            <MetricRow label="active coverage" value={`${live}`} />
            <MetricRow
              label="total covered"
              value={`${totalCovered.toFixed(2)} USDC`}
              accent="amber"
            />
            {lifetimePaidOut > 0 && (
              <MetricRow
                label="lifetime paid out"
                value={`${lifetimePaidOut.toFixed(2)} USDC`}
                accent="ok"
              />
            )}
          </div>
        </Panel>

        {loading ? (
          <Panel label="coverage · loading">
            <p className="label px-4 py-6 text-[var(--fg-3)]">querying…</p>
          </Panel>
        ) : vaults.length === 0 ? (
          <Panel label="coverage · 0">
            <div className="px-4 py-8 flex flex-col gap-3">
              <p className="text-[14px] text-[var(--fg-1)]">No coverage yet.</p>
              <p className="text-[13px] text-[var(--fg-2)]">
                Pick something from the{" "}
                <Link
                  href="/marketplace"
                  className="underline text-[var(--fg-1)]"
                >
                  marketplace
                </Link>
                .
              </p>
            </div>
          </Panel>
        ) : (
          <Panel label={`coverage · ${vaults.length}`}>
            <div
              className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(8rem,_auto)]
                         items-stretch divide-x divide-[var(--rule-0)]
                         bg-[var(--ink-2)] border-b border-[var(--rule-0)]"
            >
              <div className="px-4 py-2 label">provider · api</div>
              <div className="px-4 py-2 label text-right">their deposit</div>
              <div className="px-4 py-2 label text-right">your deposit</div>
              <div className="px-4 py-2 label text-right">status</div>
            </div>
            <ul className="flex flex-col">
              {vaults.map((v) => (
                <li key={v.id}>
                  <VaultRow vault={v} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
    </main>
  );
}

function VaultRow({ vault }: { vault: Vault }) {
  return (
    <Link
      href={`/vault/${vault.id}`}
      className="group block border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
    >
      <div
        className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(8rem,_auto)]
                   items-stretch divide-x divide-[var(--rule-0)]"
      >
        <div className="flex flex-col gap-1 min-w-0 px-4 py-4 justify-center">
          <span className="label">
            provider {vault.provider_wallet.slice(0, 6)}…
            {vault.provider_wallet.slice(-4)}
          </span>
          <span className="numeric text-[13px] text-[var(--fg-0)] truncate">
            {vault.api_url}
          </span>
          {vault.expires_at && vault.status !== "disbursed" && vault.status !== "expired" && (
            <span className="label text-[var(--fg-3)]">
              {periodDaysLabel(vault.period_days)} · {timeUntil(vault.expires_at)}
            </span>
          )}
        </div>
        <Cell label="their deposit" accent>
          {Number(vault.guarantee_usdc).toFixed(2)}
        </Cell>
        <Cell label="your deposit">
          {Number(vault.subscription_fee_usdc).toFixed(2)}
        </Cell>
        <div className="flex justify-end items-center px-4 py-4">
          <StatusBadge status={vaultUiStatus(vault)} />
        </div>
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

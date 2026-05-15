"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import type { Vault } from "@/lib/types";

export default function VaultsPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.authenticated) {
        router.replace("/login?next=/vaults");
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

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "your coverage" }]}
        address={address}
        rightLinks={[
          { href: "/marketplace", label: "marketplace" },
          { href: "/provider", label: "provider →" },
        ]}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-3">
            <span className="label">your coverage</span>
            <h1 className="display" style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)" }}>
              Your coverage.
            </h1>
            <p className="text-[13px] text-[var(--fg-1)] max-w-[58ch]">
              Your active coverage. If a covered API stays down past the limit, you
              get paid automatically.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="h-11 px-5 text-sm font-medium border border-[var(--amber)]
                       bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                       hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                       flex items-center"
          >
            browse marketplace →
          </Link>
        </div>

        {loading ? (
          <Panel label="coverage · loading">
            <p className="label px-4 py-6 text-[var(--fg-3)]">querying…</p>
          </Panel>
        ) : vaults.length === 0 ? (
          <Panel label="coverage · 0">
            <div className="px-4 py-8 flex flex-col gap-3">
              <p className="text-[14px] text-[var(--fg-1)]">No coverage yet.</p>
              <p className="text-[13px] text-[var(--fg-2)]">
                Pick one from the{" "}
                <Link href="/marketplace" className="underline text-[var(--fg-1)]">
                  marketplace
                </Link>
                , or{" "}
                <Link href="/provider" className="underline text-[var(--fg-1)]">
                  switch to provider mode
                </Link>{" "}
                if you run an API.
              </p>
            </div>
          </Panel>
        ) : (
          <Panel
            label={`coverage · ${vaults.length}`}
            trailing="provider · their deposit · your deposit · status"
          >
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
      <div className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(8rem,_auto)_1.5rem]
                      items-center gap-6 px-4 py-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="label">
            provider {vault.provider_wallet.slice(0, 6)}…{vault.provider_wallet.slice(-4)}
          </span>
          <span className="numeric text-[13px] text-[var(--fg-0)] truncate">
            {vault.api_url}
          </span>
        </div>
        <Cell label="their deposit" accent>
          {Number(vault.guarantee_usdc).toFixed(2)}
        </Cell>
        <Cell label="your deposit">
          {Number(vault.subscription_fee_usdc).toFixed(2)}
        </Cell>
        <div className="flex justify-end">
          <StatusBadge status={vault.status} />
        </div>
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

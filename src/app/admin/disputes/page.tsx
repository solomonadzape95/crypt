"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/Panel";
import type { Vault } from "@/lib/types";

export default function AdminDisputesPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/admin/me");
      const me = (await meRes.json()) as { admin: boolean; address?: string };
      if (!me.admin) {
        if (!me.address) {
          router.replace("/login?next=/admin/disputes");
          return;
        }
        setAddress(me.address);
        setForbidden(true);
        setLoading(false);
        return;
      }
      setAddress(me.address ?? null);
      const r = await fetch("/api/admin/disputes");
      if (r.ok) {
        const data = (await r.json()) as { vaults: Vault[] };
        setVaults(data.vaults);
      }
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "admin" }, { label: "disputes" }]}
        address={address}
      />
      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-2 rise">
          <span className="label">admin · dispute queue</span>
          <h1
            className="hero-display"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)" }}
          >
            Open disputes.
          </h1>
        </div>

        {forbidden ? (
          <Panel label="not an admin">
            <p className="px-4 py-6 text-[13px] text-[var(--fg-1)] leading-relaxed">
              Your wallet isn&apos;t in <code className="numeric">ADMIN_WALLETS</code>.
              Ask whoever runs this deployment to add you.
            </p>
          </Panel>
        ) : loading ? (
          <Panel label="loading">
            <p className="label px-4 py-6 text-[var(--fg-3)]">querying…</p>
          </Panel>
        ) : vaults.length === 0 ? (
          <Panel label="no open disputes">
            <p className="px-4 py-6 text-[13px] text-[var(--fg-1)] leading-relaxed">
              Nothing in the queue. Great. ☕
            </p>
          </Panel>
        ) : (
          <Panel label={`in_review · ${vaults.length}`}>
            <div
              className="grid grid-cols-[1fr_minmax(7rem,_auto)_minmax(8rem,_auto)]
                         items-stretch divide-x divide-[var(--rule-0)]
                         bg-[var(--ink-2)] border-b border-[var(--rule-0)]"
            >
              <div className="px-4 py-2 label">provider · evidence</div>
              <div className="px-4 py-2 label text-right">opened</div>
              <div className="px-4 py-2 label text-right">deposits</div>
            </div>
            <ul className="flex flex-col">
              {vaults.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/admin/disputes/${v.id}`}
                    className="group block border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
                  >
                    <div className="grid grid-cols-[1fr_minmax(7rem,_auto)_minmax(8rem,_auto)] items-stretch divide-x divide-[var(--rule-0)]">
                      <div className="flex flex-col gap-1 min-w-0 px-4 py-4 justify-center">
                        <span className="label">
                          provider {v.provider_wallet.slice(0, 6)}…
                          {v.provider_wallet.slice(-4)}
                        </span>
                        <span className="numeric text-[13px] text-[var(--fg-0)] truncate">
                          {v.api_url}
                        </span>
                        <span className="text-[12px] text-[var(--fg-2)] line-clamp-2">
                          {(v.dispute_evidence ?? "").slice(0, 200)}
                          {(v.dispute_evidence ?? "").length > 200 ? "…" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-1 px-4 py-4">
                        <span className="label">opened</span>
                        <span className="numeric text-sm text-[var(--fg-0)]">
                          {v.dispute_opened_at
                            ? new Date(v.dispute_opened_at).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-1 px-4 py-4">
                        <span className="label">deposits</span>
                        <span className="numeric text-sm text-[var(--amber)]">
                          {Number(v.guarantee_usdc).toFixed(2)} +{" "}
                          {Number(v.subscription_fee_usdc).toFixed(2)} USDC
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
    </main>
  );
}

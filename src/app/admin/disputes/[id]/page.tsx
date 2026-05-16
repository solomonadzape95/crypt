"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HeartbeatMonitor } from "@/components/HeartbeatMonitor";
import { Panel, MetricRow } from "@/components/Panel";
import { getBrowserClient } from "@/lib/supabase";
import type { CheckRow, Vault } from "@/lib/types";

type Params = { id: string };

export default function AdminDisputeDetailPage(props: { params: Promise<Params> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [busy, setBusy] = useState<"provider" | "subscriber" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/admin/me");
      const me = (await meRes.json()) as { admin: boolean; address?: string };
      if (!me.admin) {
        if (!me.address) {
          router.replace(`/login?next=/admin/disputes/${id}`);
          return;
        }
        setAddress(me.address);
        setForbidden(true);
        return;
      }
      setAddress(me.address ?? null);
      const supa = getBrowserClient();
      const { data: v } = await supa.from("vaults").select("*").eq("id", id).single();
      setVault(v as Vault | null);
      const { data: cs } = await supa
        .from("checks")
        .select("*")
        .eq("vault_id", id)
        .order("ts", { ascending: false })
        .limit(50);
      setChecks((cs as CheckRow[]) ?? []);
    })();
  }, [id, router]);

  async function resolve(winner: "provider" | "subscriber") {
    if (busy) return;
    setBusy(winner);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/dispute/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "resolve failed");
      }
      router.replace("/admin/disputes");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "resolve failed");
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <main className="flex-1 flex flex-col">
        <AppHeader crumbs={[{ label: "admin" }]} address={address} />
        <section className="max-w-2xl mx-auto px-6 py-12">
          <Panel label="not an admin">
            <p className="px-4 py-6 text-[13px] text-[var(--fg-1)]">
              Your wallet isn&apos;t in <code className="numeric">ADMIN_WALLETS</code>.
            </p>
          </Panel>
        </section>
      </main>
    );
  }
  if (!vault) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="label">loading dispute…</span>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[
          { label: "admin", href: "/admin/disputes" },
          { label: "disputes", href: "/admin/disputes" },
          { label: vault.id.slice(0, 8) },
        ]}
        address={address}
      />
      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="label">in_review</span>
          <h1 className="hero-display" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)" }}>
            Resolve dispute.
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="flex flex-col gap-6">
            <Panel label="provider's evidence">
              <div className="px-4 py-4">
                <p className="text-[13px] text-[var(--fg-0)] leading-relaxed whitespace-pre-wrap">
                  {vault.dispute_evidence ?? "—"}
                </p>
              </div>
            </Panel>

            <Panel label="heartbeat (last 50)">
              <div className="px-4 py-4">
                <HeartbeatMonitor checks={checks} />
              </div>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel label="vault">
              <MetricRow label="api" value={<span className="break-all">{vault.api_url}</span>} />
              <MetricRow
                label="provider"
                value={
                  <span className="break-all numeric">{vault.provider_wallet}</span>
                }
              />
              <MetricRow
                label="subscriber"
                value={
                  <span className="break-all numeric">{vault.subscriber_wallet}</span>
                }
              />
              <MetricRow
                label="deposits"
                accent="amber"
                value={`${Number(vault.guarantee_usdc).toFixed(2)} + ${Number(
                  vault.subscription_fee_usdc
                ).toFixed(2)} USDC`}
              />
              <MetricRow
                label="opened"
                value={
                  vault.dispute_opened_at
                    ? new Date(vault.dispute_opened_at).toLocaleString()
                    : "—"
                }
              />
              <MetricRow
                label="proof"
                value={
                  <Link
                    href={`/vault/${vault.id}/proof`}
                    target="_blank"
                    className="underline text-[var(--amber)]"
                  >
                    public audit trail
                  </Link>
                }
              />
            </Panel>

            <Panel label="ruling">
              <div className="px-4 py-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => resolve("provider")}
                  disabled={!!busy}
                  className="h-11 px-4 border border-[var(--rule-0)] text-[var(--fg-0)]
                             hover:border-[var(--signal-ok)] hover:text-[var(--signal-ok)]
                             transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                             disabled:opacity-40 flex items-center justify-between"
                >
                  <span>resolve in favour of provider</span>
                  <span className="label text-[var(--fg-3)] normal-case tracking-normal">
                    both deposits → provider
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => resolve("subscriber")}
                  disabled={!!busy}
                  className="h-11 px-4 border border-[var(--amber)] bg-[var(--amber)]
                             text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                             transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                             disabled:opacity-40 flex items-center justify-between"
                >
                  <span>resolve in favour of subscriber</span>
                  <span className="label text-[var(--ink-0)] normal-case tracking-normal opacity-70">
                    both deposits → subscriber
                  </span>
                </button>
                {busy && (
                  <p className="label text-[var(--amber)]">
                    settling on Stellar · ~30s
                  </p>
                )}
                {err && (
                  <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">
                    {err}
                  </p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/AppHeader";
import { HeartbeatMonitor } from "@/components/HeartbeatMonitor";
import { Panel, MetricRow, LabeledRule } from "@/components/Panel";
import { getServiceClient } from "@/lib/supabase-server";
import { disputeLabel } from "@/lib/dispute-labels";
import type { CheckRow, Vault } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { id: string };

const explorer =
  process.env.NEXT_PUBLIC_STELLAR_EXPLORER ?? "https://stellar.expert/explorer/testnet";

export default async function VaultProofPage(props: { params: Promise<Params> }) {
  const { id } = await props.params;
  const svc = getServiceClient();
  const { data: vault } = await svc.from("vaults").select("*").eq("id", id).single();
  if (!vault) notFound();
  const v = vault as Vault;
  const { data: checks } = await svc
    .from("checks")
    .select("*")
    .eq("vault_id", id)
    .order("ts", { ascending: false })
    .limit(200);
  const checkRows = (checks ?? []) as CheckRow[];

  const breachAt = v.triggered_at
    ? new Date(v.triggered_at).toLocaleString()
    : null;
  const settledAt = v.dispute_resolved_at
    ? new Date(v.dispute_resolved_at).toLocaleString()
    : null;

  return (
    <main className="flex-1 flex flex-col">
      <header className="relative border-b border-[var(--rule-0)] bg-[var(--ink-0)]">
        <span
          className="absolute top-0 left-0 h-px"
          style={{ background: "var(--amber)", width: "clamp(40px, 6vw, 88px)" }}
        />
        <div className="max-w-[88rem] mx-auto w-full pl-4 md:pl-6 pr-3 md:pr-6 h-14 flex items-stretch justify-between">
          <div className="flex items-stretch min-w-0">
            <Link
              href="/"
              className="flex items-center gap-3 pr-5 border-r border-[var(--rule-0)] h-14"
            >
              <Wordmark />
            </Link>
            <span className="hidden sm:flex items-center px-4 border-r border-[var(--rule-0)] h-14 label text-[var(--fg-3)]">
              audit trail · {v.id.slice(0, 8)}
            </span>
          </div>
          <nav className="flex items-stretch">
            <Link
              href="/"
              className="flex items-center px-4 border-l border-[var(--rule-0)] h-14
                         label hover:text-[var(--fg-0)] hover:bg-[var(--ink-2)] transition-colors"
            >
              home
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-3 rise">
          <span className="label">public audit trail</span>
          <h1 className="hero-display" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
            Receipts.
          </h1>
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-[64ch]">
            Every step is on Stellar. This page is read-only and shareable.
          </p>
        </div>

        <Panel label="identity">
          <MetricRow label="vault id" value={<span className="numeric break-all">{v.id}</span>} />
          <MetricRow label="api watched" value={<span className="break-all">{v.api_url}</span>} />
          <MetricRow
            label="coverage"
            value={
              v.period_days
                ? `${v.period_days} days · ${Number(v.guarantee_usdc).toFixed(2)} + ${Number(
                    v.subscription_fee_usdc,
                  ).toFixed(2)} USDC`
                : `${Number(v.guarantee_usdc).toFixed(2)} + ${Number(
                    v.subscription_fee_usdc,
                  ).toFixed(2)} USDC`
            }
            accent="amber"
          />
          <MetricRow
            label="status"
            value={
              v.dispute_status === "none"
                ? v.status
                : `${v.status} · ${disputeLabel(v.dispute_status)}`
            }
          />
        </Panel>

        <LabeledRule label="01 · escrows on chain" />
        <Panel label="lockboxes">
          {v.guarantee_escrow_contract_id ? (
            <ProofLink
              label="provider lockbox"
              value={v.guarantee_escrow_contract_id}
              href={`${explorer}/contract/${v.guarantee_escrow_contract_id}`}
            />
          ) : (
            <MetricRow label="provider lockbox" value="—" />
          )}
          {v.subscription_escrow_contract_id ? (
            <ProofLink
              label="subscriber lockbox"
              value={v.subscription_escrow_contract_id}
              href={`${explorer}/contract/${v.subscription_escrow_contract_id}`}
            />
          ) : (
            <MetricRow label="subscriber lockbox" value="—" />
          )}
          {v.guarantee_fund_tx_hash && (
            <ProofLink
              label="provider funded"
              value={v.guarantee_fund_tx_hash}
              href={`${explorer}/tx/${v.guarantee_fund_tx_hash}`}
            />
          )}
          {v.subscription_fund_tx_hash && (
            <ProofLink
              label="subscriber funded"
              value={v.subscription_fund_tx_hash}
              href={`${explorer}/tx/${v.subscription_fund_tx_hash}`}
            />
          )}
        </Panel>

        <LabeledRule label={`02 · heartbeat (last ${checkRows.length})`} />
        <Panel label="checks">
          <div className="px-4 py-4">
            <HeartbeatMonitor checks={checkRows} />
          </div>
        </Panel>

        {(v.dispute_status !== "none" || breachAt) && (
          <>
            <LabeledRule label="03 · trigger + dispute" />
            <Panel label="dispute trail">
              <MetricRow label="breach detected" value={breachAt ?? "—"} />
              {v.dispute_status !== "none" && (
                <MetricRow
                  label="dispute status"
                  value={disputeLabel(v.dispute_status)}
                  accent="amber"
                />
              )}
              {v.dispute_evidence && (
                <div className="px-4 py-4 border-b border-[var(--rule-0)] flex flex-col gap-2">
                  <span className="label">provider's evidence</span>
                  <p className="text-[13px] text-[var(--fg-0)] leading-relaxed whitespace-pre-wrap">
                    {v.dispute_evidence}
                  </p>
                </div>
              )}
              {v.dispute_resolved_by && (
                <MetricRow
                  label="resolved by"
                  value={
                    <span className="numeric">{v.dispute_resolved_by}</span>
                  }
                />
              )}
              {settledAt && <MetricRow label="ruled at" value={settledAt} />}
            </Panel>
          </>
        )}

        {(v.guarantee_payout_tx_hash || v.subscription_payout_tx_hash) && (
          <>
            <LabeledRule label="04 · settlement on chain" />
            <Panel label="payouts">
              {v.guarantee_payout_tx_hash && (
                <ProofLink
                  label="provider deposit released"
                  value={v.guarantee_payout_tx_hash}
                  href={`${explorer}/tx/${v.guarantee_payout_tx_hash}`}
                />
              )}
              {v.subscription_payout_tx_hash && (
                <ProofLink
                  label="subscriber deposit released"
                  value={v.subscription_payout_tx_hash}
                  href={`${explorer}/tx/${v.subscription_payout_tx_hash}`}
                />
              )}
            </Panel>
          </>
        )}
      </section>
    </main>
  );
}

function ProofLink({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-[var(--rule-0)] last:border-b-0">
      <span className="label">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="numeric text-[12px] text-[var(--amber)] underline break-all text-right"
      >
        {value}
      </a>
    </div>
  );
}

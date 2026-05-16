"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, MetricRow } from "./Panel";
import type { Listing, Vault } from "@/lib/types";

type Props = {
  listing: Listing;
  vaults: Vault[];
};

const explorer =
  process.env.NEXT_PUBLIC_STELLAR_EXPLORER ?? "https://stellar.expert/explorer/testnet";

/**
 * Provider-side dashboard panel for a pool listing. Surfaces the live
 * reserved/available math + a link to the on-chain pool contract. Doesn't
 * hit TW for the actual on-chain balance (that'd block render); the
 * server-tracked pool_amount_usdc is the source of truth for now.
 */
export function PoolPanel({ listing, vaults }: Props) {
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);
  const [recoverErr, setRecoverErr] = useState<string | null>(null);

  async function onRecover() {
    setRecovering(true);
    setRecoverErr(null);
    try {
      const res = await fetch(`/api/listing/${listing.id}/pool/recover`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      setRecoverErr(e instanceof Error ? e.message : "recover failed");
    } finally {
      setRecovering(false);
    }
  }

  const reserved = vaults
    .filter(
      (v) =>
        v.claim_amount_usdc != null &&
        (v.status === "funding" ||
          v.status === "locked" ||
          v.status === "under_threat"),
    )
    .reduce((s, v) => s + Number(v.claim_amount_usdc ?? 0), 0);
  const total = Number(listing.pool_amount_usdc ?? 0);
  const available = Math.max(0, total - reserved);
  const utilisation = total > 0 ? Math.min(100, (reserved / total) * 100) : 0;

  if (!listing.pool_funded_at) {
    return (
      <Panel label="pool" trailing="● not funded">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
            This listing isn&apos;t accepting subscribers yet. You need to
            deposit the pool first.
          </p>
          <Link
            href={`/provider/listings/${listing.id}/fund-pool`}
            className="h-10 px-4 border border-[var(--amber)] bg-[var(--amber)]
                       text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                       transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                       w-fit flex items-center"
          >
            fund pool
          </Link>
        </div>
      </Panel>
    );
  }

  // Recovery state: a breach-time re-deploy failed. Platform still holds
  // the remainder USDC; provider can retry.
  if (!listing.pool_contract_id && listing.pool_error) {
    return (
      <Panel label="pool" trailing="● recovery needed">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
            A breach payout fired but the new pool couldn&apos;t be redeployed
            (TW indexer was likely slow). The remaining{" "}
            <span className="numeric text-[var(--amber)]">
              {Number(listing.pool_amount_usdc ?? 0).toFixed(2)} USDC
            </span>{" "}
            is held by the platform wallet. Retry to re-issue the pool.
          </p>
          <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">
            {listing.pool_error}
          </p>
          <button
            type="button"
            onClick={onRecover}
            disabled={recovering}
            className="h-10 px-4 border border-[var(--amber)] bg-[var(--amber)]
                       text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                       transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                       w-fit flex items-center disabled:opacity-50"
          >
            {recovering ? "retrying…" : "retry redeploy"}
          </button>
          {recoverErr && (
            <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">
              {recoverErr}
            </p>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel label="pool" trailing={`${listing.coverage_ratio_x ?? 10}× coverage`}>
      <div className="px-4 py-4 flex flex-col gap-3 border-b border-[var(--rule-0)]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label">utilisation · {Math.round(utilisation)}%</span>
          <span className="numeric text-sm text-[var(--fg-2)]">
            {reserved.toFixed(2)} reserved · {available.toFixed(2)} free
          </span>
        </div>
        {/* Two-segment bar: amber fill on the left, dimmer "free" track on
            the right, so the structure is always visible even at 0%. */}
        <div className="grid h-1.5" style={{ gridTemplateColumns: `${utilisation}fr ${100 - utilisation}fr` }}>
          <div className="bg-[var(--amber)]" />
          <div className="bg-[var(--ink-2)] border-l border-[var(--rule-0)]" />
        </div>
      </div>
      <MetricRow label="total pool" value={`${total.toFixed(2)} USDC`} />
      <MetricRow
        label="reserved · active subs"
        value={`${reserved.toFixed(2)} USDC`}
      />
      <MetricRow
        label="available · new subs"
        value={`${available.toFixed(2)} USDC`}
        accent="amber"
      />
      {listing.pool_contract_id && (
        <MetricRow
          label="contract"
          value={
            <a
              href={`${explorer}/contract/${listing.pool_contract_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="numeric underline text-[var(--amber)] break-all"
            >
              {listing.pool_contract_id.slice(0, 16)}…
            </a>
          }
        />
      )}
      {listing.pool_error && (
        <div className="px-4 py-3 border-t border-[var(--rule-0)]">
          <span className="label text-[var(--signal-fail)]">pool error</span>
          <p className="numeric text-[11px] text-[var(--signal-fail)] mt-1 break-all">
            {listing.pool_error}
          </p>
        </div>
      )}
    </Panel>
  );
}

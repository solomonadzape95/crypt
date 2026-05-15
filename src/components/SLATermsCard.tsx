"use client";

import type { Vault } from "@/lib/types";
import { Panel } from "./Panel";

export function SLATermsCard({ vault }: { vault: Vault }) {
  const windowSec = vault.failure_threshold * vault.oracle_period_sec;
  const windowLabel =
    windowSec >= 60
      ? `${Math.round(windowSec / 60)} consecutive minute${windowSec >= 120 ? "s" : ""}`
      : `${windowSec} consecutive seconds`;
  return (
    <Panel label="coverage terms">
      <div className="px-4 py-4 flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-[var(--fg-0)] max-w-prose">
          If uptime drops below{" "}
          <span className="numeric text-[var(--fg-0)]">
            {Number(vault.sla_target_pct).toFixed(2)}%
          </span>{" "}
          for{" "}
          <span className="numeric text-[var(--fg-0)]">{windowLabel}</span>, the
          subscriber is paid from the{" "}
          <span className="numeric" style={{ color: "var(--amber)" }}>
            {Number(vault.guarantee_usdc).toFixed(2)} USDC
          </span>{" "}
          provider deposit. The provider keeps the{" "}
          <span className="numeric" style={{ color: "var(--amber)" }}>
            {Number(vault.subscription_fee_usdc).toFixed(2)} USDC
          </span>{" "}
          subscriber deposit only when the API stays up.
        </p>
        <div className="grid grid-cols-3 border-t border-[var(--rule-0)] -mx-4 -mb-4">
          <Term label="check every" value={`${vault.oracle_period_sec}s`} />
          <Term label="failed checks" value={`${vault.failure_threshold} in a row`} />
          <Term label="failure window" value={windowLabel} />
        </div>
      </div>
    </Panel>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 border-r border-[var(--rule-0)] last:border-r-0">
      <span className="label">{label}</span>
      <span className="numeric text-sm text-[var(--fg-0)]">{value}</span>
    </div>
  );
}

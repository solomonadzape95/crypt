"use client";

import { motion } from "framer-motion";
import type { VaultUiStatus } from "@/lib/vault-state";

const META: Record<VaultUiStatus, { label: string; color: string; pulse: boolean }> = {
  funding:      { label: "waiting on deposits", color: "var(--fg-2)",        pulse: true },
  locked:       { label: "active",              color: "var(--signal-ok)",   pulse: true },
  under_threat: { label: "failing",             color: "var(--signal-wait)", pulse: true },
  // Synthetic state: threshold breached, settle txs are in flight.
  settling:     { label: "settling…",           color: "var(--amber)",       pulse: true },
  // disbursed = the protocol fired the way it was supposed to. Green, not red.
  disbursed:    { label: "paid out",            color: "var(--signal-ok)",   pulse: false },
  expired:      { label: "closed",              color: "var(--fg-3)",        pulse: false },
};

/**
 * Square LED + tracked-uppercase label inside a hairline frame. No tinted
 * background — the LED is the entire signal. Operator-console look.
 */
export function StatusBadge({ status }: { status: VaultUiStatus }) {
  const m = META[status];
  return (
    <div className="inline-flex items-center gap-3 border border-[var(--rule-0)] bg-[var(--ink-1)] h-8 px-3">
      <motion.span
        className="block h-2 w-2"
        style={{ background: m.color }}
        animate={m.pulse ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
        transition={
          m.pulse ? { duration: 1.2, repeat: Infinity, ease: "linear" } : undefined
        }
      />
      <span className="label" style={{ color: m.color }}>
        {m.label}
      </span>
    </div>
  );
}

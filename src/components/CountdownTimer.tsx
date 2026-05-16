"use client";

import { motion } from "framer-motion";
import type { Vault } from "@/lib/types";

export function CountdownTimer({ vault }: { vault: Vault }) {
  if (vault.status !== "under_threat") return null;
  // Once the threshold is hit, SettlingPanel takes over the same UI slot.
  if (vault.consecutive_failures >= vault.failure_threshold) return null;
  const remaining = Math.max(0, vault.failure_threshold - vault.consecutive_failures);
  const lastCheck = remaining <= 1;
  const color = lastCheck ? "var(--signal-fail)" : "var(--amber)";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border bg-[var(--ink-1)] flex items-stretch"
      style={{ borderColor: color }}
    >
      <div
        className="w-2 self-stretch"
        style={{ background: color }}
      />
      <div className="flex-1 flex items-center justify-between gap-6 px-4 py-4">
        <div className="flex flex-col">
          <span className="label" style={{ color }}>
            payout triggers in
          </span>
          <span
            className="numeric font-medium tracking-tight"
            style={{ color, fontSize: "1.75rem", lineHeight: 1 }}
          >
            {remaining} check{remaining === 1 ? "" : "s"}
          </span>
        </div>
        <motion.span
          className="label numeric"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          {vault.oracle_period_sec}s each
        </motion.span>
      </div>
    </motion.div>
  );
}

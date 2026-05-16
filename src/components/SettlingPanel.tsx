"use client";

import { motion } from "framer-motion";

/**
 * Renders between "threshold breached" and "paid out". Replaces the otherwise-
 * stagnant under_threat countdown so the user sees that work IS happening on
 * Stellar — not just that the same failure count is sitting there.
 */
export function SettlingPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="border bg-[var(--ink-1)] flex items-stretch"
      style={{ borderColor: "var(--amber)" }}
    >
      <div className="w-2 self-stretch" style={{ background: "var(--amber)" }} />
      <div className="flex-1 flex items-center justify-between gap-6 px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="label" style={{ color: "var(--amber)" }}>
            payout in flight
          </span>
          <span className="text-[13px] text-[var(--fg-1)] leading-snug max-w-[60ch]">
            Releasing both deposits to the subscriber. Two Stellar transactions
            usually land in 5–30 seconds.
          </span>
        </div>
        <Pulse />
      </div>
    </motion.div>
  );
}

function Pulse() {
  return (
    <span className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5"
          style={{ background: "var(--amber)" }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import type { Vault } from "@/lib/types";

type Props = {
  vault: Vault;
  isProvider: boolean;
  onChanged: () => void;
};

/**
 * Dispute lifecycle UI. Renders nothing when there's no active dispute.
 * Modes:
 *   pending  + provider:    challenge CTA + countdown
 *   pending  + subscriber:  awaiting-provider notice
 *   in_review:              both sides see the under-review banner
 *   resolved_*:             final ruling banner (kept until status flips)
 */
export function DisputePanel({ vault, isProvider, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (vault.dispute_status === "none") return null;

  if (vault.dispute_status === "pending") {
    const startIso = vault.triggered_at;
    const endIso = vault.dispute_window_ends_at;
    if (!isProvider) {
      return (
        <Panel label="dispute window open" trailing="provider can challenge">
          <div className="px-4 py-4 flex flex-col gap-4">
            {startIso && endIso && (
              <DisputeCountdown startIso={startIso} endIso={endIso} />
            )}
            <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
              The provider has up to 5 minutes to challenge this breach. If
              they don&apos;t, both deposits release to your wallet
              automatically.
            </p>
          </div>
        </Panel>
      );
    }
    return (
      <Panel label="dispute window open" trailing="your move">
        <div className="px-4 py-4 flex flex-col gap-4">
          {startIso && endIso && (
            <DisputeCountdown startIso={startIso} endIso={endIso} />
          )}
          <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
            The oracle reported a breach. If you believe this is wrong (e.g.
            our checker had a network blip, your status page shows the API
            was up), challenge it before the window closes.
          </p>
          {!open ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="h-10 px-4 border border-[var(--amber)] bg-[var(--amber)]
                           text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                           transition-colors uppercase tracking-[0.12em] text-[12px] font-medium"
              >
                challenge breach
              </button>
              <span className="label flex items-center text-[var(--fg-3)]">
                or do nothing — payout fires when window closes
              </span>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setErr(null);
                setSubmitting(true);
                try {
                  const res = await fetch(`/api/vault/${vault.id}/dispute`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ evidence }),
                  });
                  if (!res.ok) {
                    const t = await res.text();
                    throw new Error(t || "could not submit");
                  }
                  setOpen(false);
                  onChanged();
                } catch (ex) {
                  setErr(ex instanceof Error ? ex.message : "submit failed");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <textarea
                required
                minLength={10}
                maxLength={2000}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="What actually happened? Attach links to your status page, monitoring screenshots, etc. An admin will review."
                className="min-h-[8rem] bg-[var(--ink-0)] border border-[var(--rule-0)]
                           focus:border-[var(--amber)] focus:outline-none px-3 py-2 text-sm
                           leading-relaxed resize-y"
              />
              <div className="flex gap-3 items-center">
                <button
                  type="submit"
                  disabled={submitting || evidence.trim().length < 10}
                  className="h-10 px-4 border border-[var(--amber)] bg-[var(--amber)]
                             text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                             transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? "submitting…" : "submit dispute"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="label text-[var(--fg-2)] hover:text-[var(--fg-0)] transition-colors"
                >
                  cancel
                </button>
                <span className="label numeric text-[var(--fg-3)] ml-auto">
                  {evidence.length}/2000
                </span>
              </div>
              {err && (
                <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">
                  {err}
                </p>
              )}
            </form>
          )}
        </div>
      </Panel>
    );
  }

  if (vault.dispute_status === "in_review") {
    const opened = vault.dispute_opened_at
      ? new Date(vault.dispute_opened_at).toLocaleString()
      : "just now";
    return (
      <Panel label="under admin review" trailing={`opened ${opened}`}>
        <div className="px-4 py-4 flex items-center gap-3">
          <motion.span
            className="h-2 w-2 bg-[var(--amber)]"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
            An admin is reviewing the provider&apos;s evidence. Both deposits stay
            locked until they rule. You&apos;ll see the outcome here as soon as
            it lands.
          </p>
        </div>
      </Panel>
    );
  }

  // Resolved — short banner; final settle txns appear in PayoutCard.
  const winner =
    vault.dispute_status === "resolved_provider" ? "provider" : "subscriber";
  return (
    <Panel label="dispute resolved" trailing={`in favor of ${winner}`}>
      <div className="px-4 py-4 text-[13px] text-[var(--fg-1)] leading-relaxed">
        Settling on Stellar — both deposits release to the {winner}.
      </div>
    </Panel>
  );
}

/**
 * Live MM:SS countdown for the dispute window. Ticks every second; renders
 * a thin amber progress bar that drains as time runs out. Goes red under 30s
 * and stays at 00:00 once expired (the next oracle tick will settle).
 */
function DisputeCountdown({
  startIso,
  endIso,
}: {
  startIso: string;
  endIso: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const endMs = new Date(endIso).getTime();
  const startMs = new Date(startIso).getTime();
  const totalMs = Math.max(1, endMs - startMs);
  const remainingMs = Math.max(0, endMs - now);
  const pct = Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));
  const m = Math.floor(remainingMs / 60_000);
  const s = Math.floor((remainingMs % 60_000) / 1000);
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const expired = remainingMs <= 0;
  const urgent = !expired && remainingMs < 30_000;
  const color = expired || urgent ? "var(--signal-fail)" : "var(--amber)";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="label">time remaining</span>
        <span
          className="numeric font-medium tabular-nums"
          style={{ fontSize: "2.25rem", color, lineHeight: 1 }}
        >
          {mmss}
        </span>
      </div>
      <div className="h-px bg-[var(--rule-0)] relative overflow-hidden">
        <motion.div
          className="absolute top-0 bottom-0 left-0"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "linear" }}
          style={{ background: color }}
        />
      </div>
      <span className="label text-[var(--fg-3)]">
        {expired
          ? "window closed — payout firing on next oracle tick"
          : urgent
            ? "last 30 seconds"
            : "5-minute window · provider can challenge"}
      </span>
    </div>
  );
}

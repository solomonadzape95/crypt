"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";

type Props = {
  listingId: string;
  signedInWallet: string | null;
  onSubscribed: (vaultId: string) => void;
};

type Step = "review" | "deploying" | "done" | "error";

export function SubscribeDialog({ listingId, signedInWallet, onSubscribed }: Props) {
  const [useSignedIn, setUseSignedIn] = useState(true);
  const [payoutTarget, setPayoutTarget] = useState("");
  const [step, setStep] = useState<Step>("review");
  const [err, setErr] = useState<string | null>(null);

  async function onConfirm() {
    setErr(null);
    setStep("deploying");
    try {
      const res = await fetch(`/api/listing/${listingId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberPayoutTarget: useSignedIn ? undefined : payoutTarget.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "subscribe failed");
      const { vaultId } = (await res.json()) as { vaultId: string };
      setStep("done");
      onSubscribed(vaultId);
    } catch (e) {
      setStep("error");
      setErr(e instanceof Error ? e.message : "Could not subscribe.");
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Panel label="subscribe">
        <div className="px-4 py-5 flex flex-col gap-5">
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-prose">
            Subscribing locks two deposits on Stellar — one from the provider, one
            from you. We&apos;ll prompt your wallet for yours on the next screen.
          </p>

          <div className="flex flex-col gap-2">
            <span className="label">payout wallet</span>
            <label className="flex items-center gap-2 text-[14px] text-[var(--fg-1)]">
              <input
                type="checkbox"
                checked={useSignedIn}
                onChange={(e) => setUseSignedIn(e.target.checked)}
                className="h-4 w-4 accent-[var(--amber)]"
              />
              <span>
                use my signed-in wallet
                {signedInWallet && (
                  <span className="numeric text-[var(--fg-2)] ml-2 text-xs">
                    {signedInWallet.slice(0, 6)}…{signedInWallet.slice(-4)}
                  </span>
                )}
              </span>
            </label>
            {!useSignedIn && (
              <input
                type="text"
                value={payoutTarget}
                onChange={(e) => setPayoutTarget(e.target.value.toUpperCase())}
                placeholder="G..."
                className="h-10 bg-[var(--ink-0)] border border-[var(--rule-0)] px-3 text-sm
                           focus:outline-none focus:border-[var(--amber)] numeric"
              />
            )}
            <span className="label text-[var(--fg-3)]">
              where you receive USDC if the API fails
            </span>
          </div>

          {step === "review" && (
            <button
              type="button"
              onClick={onConfirm}
              className="h-11 px-5 text-sm font-medium border border-[var(--amber)]
                         bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                         hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]"
            >
              create coverage →
            </button>
          )}
          {step === "deploying" && (
            <div className="flex items-center gap-3 h-11 px-3 border border-[var(--rule-0)]">
              <motion.span
                className="h-2 w-2 bg-[var(--amber)]"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
              <span className="label text-[var(--amber)]">
                creating coverage on Stellar · ~40s
              </span>
            </div>
          )}
          {step === "done" && (
            <span className="label text-[var(--signal-ok)]">
              ● subscribed — opening dashboard…
            </span>
          )}
          {step === "error" && (
            <button
              type="button"
              onClick={() => setStep("review")}
              className="h-11 px-5 text-sm font-medium border border-[var(--rule-0)]
                         text-[var(--fg-0)] uppercase tracking-[0.12em]"
            >
              try again
            </button>
          )}
          {err && (
            <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">{err}</p>
          )}
        </div>
      </Panel>
    </motion.div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signXDR } from "@/lib/wallet";
import { TW_COMMISSION_RATE, grossWithTwFee } from "@/lib/tw-fee";
import type { EscrowSide } from "@/lib/types";
import { Panel } from "./Panel";

type Props = {
  vaultId: string;
  side: EscrowSide;
  amount: number;
  apiUrl: string;
  counterparty: string;
  contractId: string | null;
  onFunded: () => void;
};

type Step = "review" | "preparing" | "signing" | "submitting" | "done" | "error";

const COPY: Record<EscrowSide, {
  panel: string;
  unit: string;
  cta: string;
  counter: string;
}> = {
  guarantee: {
    panel: "fund your deposit",
    unit: "you stake on staying up",
    cta: "sign deposit →",
    counter: "paid to subscriber if API fails",
  },
  subscription: {
    panel: "fund your deposit",
    unit: "you pay for this coverage period",
    cta: "sign deposit →",
    counter: "kept by provider if API stays up",
  },
};

export function VaultFundDialog({
  vaultId,
  side,
  amount,
  apiUrl,
  counterparty,
  contractId,
  onFunded,
}: Props) {
  const [step, setStep] = useState<Step>("review");
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const copy = COPY[side];
  const gross = grossWithTwFee(amount);
  const feePct = (TW_COMMISSION_RATE * 100).toFixed(1);

  async function onConfirm() {
    setErr(null);
    try {
      setStep("preparing");
      const xdrRes = await fetch(`/api/vault/${vaultId}/fund-xdr?side=${side}`, {
        method: "POST",
      });
      if (!xdrRes.ok) throw new Error(await xdrRes.text());
      const { unsignedXDR } = await xdrRes.json();

      setStep("signing");
      const signed = await signXDR(unsignedXDR);

      setStep("submitting");
      const submit = await fetch(`/api/vault/${vaultId}/submit-fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXDR: signed, side }),
      });
      if (!submit.ok) throw new Error(await submit.text());
      const data = await submit.json();
      setTxHash(data.txHash);
      setStep("done");
      setTimeout(onFunded, 700);
    } catch (e) {
      setStep("error");
      setErr(e instanceof Error ? e.message : "Could not fund vault.");
    }
  }

  return (
    <Panel label={copy.panel} trailing={vaultId.slice(0, 8)}>
      <div className="px-4 py-5 flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <span
            className="numeric font-medium tracking-tight"
            style={{ fontSize: "2.75rem", lineHeight: 1, color: "var(--amber)" }}
          >
            {gross.toFixed(4)}
          </span>
          <div className="flex flex-col items-end pb-1">
            <span className="label">to deposit</span>
            <span className="label text-[var(--fg-1)]">USDC · testnet</span>
          </div>
        </div>
        <p className="label text-[var(--fg-1)]">{copy.unit}</p>

        <div className="flex flex-col border-t border-[var(--rule-0)] -mx-4">
          <Row label="locked + paid out" value={`${amount.toFixed(2)} USDC`} mono />
          <Row label={`TW fee (${feePct}%)`} value={`${(gross - amount).toFixed(4)} USDC`} mono />
          <Row label="API watched" value={apiUrl} mono />
          <Row label={copy.counter} value={shorten(counterparty)} mono />
          {contractId && <Row label="lockbox" value={shorten(contractId)} mono />}
        </div>

        {step !== "review" && <StepIndicator step={step} txHash={txHash} />}

        {step === "review" && (
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 px-5 text-sm font-medium border border-[var(--amber)]
                       bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                       hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]"
          >
            {copy.cta}
          </button>
        )}

        {err && (
          <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">{err}</p>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-[var(--rule-0)] last:border-b-0">
      <span className="label">{label}</span>
      <span
        className={(mono ? "numeric" : "") + " text-[12px] text-[var(--fg-0)] truncate ml-3"}
        style={{ maxWidth: "60%" }}
      >
        {value}
      </span>
    </div>
  );
}

function StepIndicator({ step, txHash }: { step: Step; txHash: string | null }) {
  const explorer =
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER ?? "https://stellar.expert/explorer/testnet";
  return (
    <ol className="flex flex-col gap-2 border border-[var(--rule-0)] p-3 bg-[var(--ink-0)]">
      <Line active={step === "preparing"} done={["signing", "submitting", "done"].includes(step)}>
        preparing deposit
      </Line>
      <Line active={step === "signing"} done={["submitting", "done"].includes(step)}>
        approve in your wallet
      </Line>
      <Line active={step === "submitting"} done={step === "done"}>
        sending to Stellar
      </Line>
      {step === "done" && txHash && (
        <a
          href={`${explorer}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="label text-[var(--amber)] underline numeric"
        >
          deposit locked — view on Stellar Expert ↗
        </a>
      )}
    </ol>
  );
}

function Line({
  active,
  done,
  children,
}: {
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <motion.span
        className="h-1.5 w-1.5"
        style={{
          background: done
            ? "var(--signal-ok)"
            : active
              ? "var(--amber)"
              : "var(--rule-1)",
        }}
        animate={active ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
        transition={active ? { duration: 1.2, repeat: Infinity, ease: "linear" } : undefined}
      />
      <span
        className="label"
        style={{
          color: done ? "var(--fg-0)" : active ? "var(--amber)" : "var(--fg-3)",
        }}
      >
        {children}
      </span>
    </li>
  );
}

function shorten(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

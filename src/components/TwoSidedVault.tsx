"use client";

import { motion } from "framer-motion";
import type { Vault } from "@/lib/types";

type Props = {
  vault: Vault;
  /** Connected wallet. Used to label which pillar is "yours". */
  me: string | null;
};

/**
 * Operator-console pillar layout for the two-sided vault.
 *
 * Two columns, hard rectangles, a thin status rail between them. Funded
 * columns get a single hot amber edge — no glow, no rounded corners.
 */
export function TwoSidedVault({ vault, me }: Props) {
  const guaranteeFunded = !!vault.guarantee_funded_at;
  const subscriptionFunded = !!vault.subscription_funded_at;
  const isProvider = me === vault.provider_wallet;
  const isSubscriber = me === vault.subscriber_wallet;

  const providerDepositLabel = isProvider ? "your deposit · provider" : "provider deposit";
  const subscriberDepositLabel = isSubscriber ? "your deposit · subscriber" : "subscriber deposit";

  return (
    <section className="border border-[var(--rule-0)] bg-[var(--ink-1)]">
      <header className="flex items-center justify-between px-4 h-9 border-b border-[var(--rule-0)] bg-[var(--ink-2)]">
        <span className="label">deposits</span>
        <FundedTrace
          left={guaranteeFunded}
          right={subscriptionFunded}
          status={vault.status}
          isProvider={isProvider}
          isSubscriber={isSubscriber}
        />
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr]">
        <Pillar
          depositLabel={providerDepositLabel}
          isMe={isProvider}
          address={vault.provider_wallet}
          payoutTarget={vault.provider_payout_target}
          amount={Number(vault.guarantee_usdc)}
          funded={guaranteeFunded}
          fundedAt={vault.guarantee_funded_at}
        />
        <Bridge status={vault.status} />
        <Pillar
          depositLabel={subscriberDepositLabel}
          isMe={isSubscriber}
          address={vault.subscriber_wallet}
          payoutTarget={vault.subscriber_payout_target}
          amount={Number(vault.subscription_fee_usdc)}
          funded={subscriptionFunded}
          fundedAt={vault.subscription_funded_at}
        />
      </div>
    </section>
  );
}

function Pillar({
  depositLabel,
  isMe,
  address,
  payoutTarget,
  amount,
  funded,
  fundedAt,
}: {
  depositLabel: string;
  isMe: boolean;
  address: string;
  payoutTarget: string | null;
  amount: number;
  funded: boolean;
  fundedAt: string | null;
}) {
  return (
    <motion.div
      animate={{ opacity: funded ? 1 : 0.55 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative p-6 flex flex-col gap-2"
    >
      {funded && (
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute top-0 left-0 right-0 h-px origin-left"
          style={{ background: "var(--amber)" }}
        />
      )}
      {/* Header: deposit label (left) + lock status (right) — directly above the amount */}
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="label"
          style={{ color: isMe ? "var(--amber)" : "var(--fg-2)" }}
        >
          {depositLabel}
        </span>
        <span
          className="label"
          style={{ color: funded ? "var(--amber)" : "var(--fg-3)" }}
        >
          {funded ? "● locked" : "○ unfunded"}
        </span>
      </div>
      {/* The amount — first thing under the label */}
      <span
        className="numeric font-medium tracking-tight text-4xl mt-2"
        style={{ color: funded ? "var(--fg-0)" : "var(--fg-2)" }}
      >
        {amount.toFixed(2)}
        <span className="text-sm text-[var(--fg-2)]"> USDC</span>
      </span>
      <div className="flex flex-col gap-1 pt-3 border-t border-[var(--rule-0)] mt-2">
        <Line label="wallet" value={address} />
        {payoutTarget && payoutTarget !== address && (
          <Line label="paid to →" value={payoutTarget} accent />
        )}
        {funded && fundedAt && (
          <Line label="locked at" value={new Date(fundedAt).toLocaleTimeString()} />
        )}
      </div>
    </motion.div>
  );
}

function Line({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const short =
    value.length > 18 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label">{label}</span>
      <span
        className="numeric text-[11px]"
        style={{ color: accent ? "var(--amber)" : "var(--fg-1)" }}
      >
        {short}
      </span>
    </div>
  );
}

function Bridge({ status }: { status: Vault["status"] }) {
  const label =
    status === "funding"
      ? "waiting"
      : status === "locked"
        ? "watching"
        : status === "under_threat"
          ? "payout pending"
          : status === "disbursed"
            ? "paid out"
            : "—";
  const labelColor =
    status === "disbursed"
      ? "var(--signal-ok)"
      : status === "under_threat"
        ? "var(--signal-wait)"
        : status === "locked"
          ? "var(--signal-ok)"
          : "var(--fg-2)";
  const glyphColor = status === "disbursed" ? "var(--signal-ok)" : "var(--fg-2)";
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-2 border-x border-[var(--rule-0)] bg-[var(--ink-2)] min-w-[10rem]">
      <span className="label" style={{ color: labelColor }}>
        {label}
      </span>
      <span className="text-2xl numeric" style={{ color: glyphColor }}>
        ⟷
      </span>
    </div>
  );
}

function statusLabel(s: Vault["status"]): string {
  switch (s) {
    case "funding":      return "waiting on deposits";
    case "locked":       return "active";
    case "under_threat": return "failing";
    case "disbursed":    return "paid out";
    case "expired":      return "closed";
  }
}

function FundedTrace({
  left,
  right,
  status,
  isProvider,
  isSubscriber,
}: {
  left: boolean;
  right: boolean;
  status: Vault["status"];
  isProvider: boolean;
  isSubscriber: boolean;
}) {
  const leftLabel = isProvider ? "you" : "provider";
  const rightLabel = isSubscriber ? "you" : "subscriber";
  return (
    <div className="flex items-center gap-2">
      <span
        className="label"
        style={{ color: left ? "var(--amber)" : "var(--fg-3)" }}
        title="provider deposit"
      >
        {leftLabel} {left ? "✓" : "·"}
      </span>
      <span className="label text-[var(--fg-3)]">/</span>
      <span
        className="label"
        style={{ color: right ? "var(--amber)" : "var(--fg-3)" }}
        title="subscriber deposit"
      >
        {rightLabel} {right ? "✓" : "·"}
      </span>
      <span className="label text-[var(--fg-3)] ml-3">{statusLabel(status)}</span>
    </div>
  );
}

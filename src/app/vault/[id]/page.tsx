"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CountdownTimer } from "@/components/CountdownTimer";
import { DisputePanel } from "@/components/DisputePanel";
import { FundsAnimation } from "@/components/FundsAnimation";
import { HeartbeatMonitor } from "@/components/HeartbeatMonitor";
import { IncidentLog } from "@/components/IncidentLog";
import { KillSwitch } from "@/components/KillSwitch";
import { Panel, MetricRow, LabeledRule } from "@/components/Panel";
import { SettlingPanel } from "@/components/SettlingPanel";
import { SLATermsCard } from "@/components/SLATermsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TwoSidedVault } from "@/components/TwoSidedVault";
import { VaultFundDialog } from "@/components/VaultFundDialog";
import { getBrowserClient } from "@/lib/supabase";
import type { CheckRow, EscrowSide, Vault } from "@/lib/types";
import { oraclePaused, vaultUiStatus } from "@/lib/vault-state";
import { timeUntil, periodDaysLabel } from "@/lib/time";

type Params = { id: string };

/**
 * Merge two check lists, dedup by id, keep newest 50 by timestamp.
 * Used by both the realtime INSERT handler and the manual refresh so a
 * stale-snapshot refresh can't clobber a newer realtime row (and vice
 * versa).
 */
function mergeChecks(prev: CheckRow[], incoming: CheckRow[]): CheckRow[] {
  const map = new Map<number, CheckRow>();
  for (const r of prev) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  return Array.from(map.values())
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 50);
}

export default function VaultPage(props: { params: Promise<Params> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [vault, setVault] = useState<Vault | null>(null);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [lastEventTs, setLastEventTs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prevStatus = useRef<Vault["status"] | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/vault/${id}`);
    if (res.status === 401) {
      router.replace("/login?next=/vault/" + id);
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { vault: Vault; checks: CheckRow[] };
    setVault(data.vault);
    // Merge with any realtime rows already in state — a refresh that lands
    // after a realtime INSERT would otherwise clobber the newer row.
    setChecks((cur) => mergeChecks(cur, data.checks));
    setLoading(false);
    setLastEventTs(Date.now());
    if (
      prevStatus.current &&
      prevStatus.current !== "disbursed" &&
      data.vault.status === "disbursed"
    ) {
      setAnimationKey((k) => k + 1);
    }
    prevStatus.current = data.vault.status;
  }, [id, router]);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (meData.authenticated) setMe(meData.address);
    })();
  }, []);

  // Initial paint: one HTTP fetch. After that, Supabase realtime pushes
  // updates — no setInterval polling. Falls back to nothing if realtime
  // isn't enabled (caller will see a stale page until next manual refresh,
  // and a console.warn fires after 30s of no events).
  useEffect(() => {
    void refresh();
    const supa = getBrowserClient();
    let gotEvent = false;

    const channel = supa
      .channel(`vault:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vaults", filter: `id=eq.${id}` },
        (payload) => {
          gotEvent = true;
          setLastEventTs(Date.now());
          const next = payload.new as Vault;
          setVault((cur) => {
            if (cur && cur.status !== "disbursed" && next.status === "disbursed") {
              setAnimationKey((k) => k + 1);
            }
            prevStatus.current = next.status;
            return { ...cur, ...next };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checks", filter: `vault_id=eq.${id}` },
        (payload) => {
          gotEvent = true;
          setLastEventTs(Date.now());
          const row = payload.new as CheckRow;
          // Dedupe — Supabase realtime can replay events on reconnect, and
          // the initial refresh + first realtime tick race to insert the
          // same row. Either case produced duplicate React keys.
          setChecks((cur) => mergeChecks(cur, [row]));
        }
      )
      .subscribe();

    const warnTimer = setTimeout(() => {
      if (!gotEvent) {
        console.warn(
          `[vault realtime] no events in 30s for vault ${id}. ` +
            `If updates aren't landing, the vaults/checks tables may not be in the supabase_realtime publication. ` +
            `Run: ALTER PUBLICATION supabase_realtime ADD TABLE vaults, checks;`
        );
      }
    }, 30_000);

    return () => {
      clearTimeout(warnTimer);
      void supa.removeChannel(channel);
    };
  }, [id, refresh]);

  // Drive the realtime pill — recompute every 5s without re-fetching.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Latest-vault ref so the tick callback can read fresh status without
  // forcing the effect to re-run on every refresh (which would spam ticks).
  const vaultRef = useRef<Vault | null>(null);
  useEffect(() => {
    vaultRef.current = vault;
  }, [vault]);

  const oraclePeriodSec = vault?.oracle_period_sec ?? null;
  const tickable =
    vault?.status === "locked" || vault?.status === "under_threat" ? 1 : 0;

  useEffect(() => {
    if (!oraclePeriodSec || !tickable) return;
    const periodMs = Math.max(5, oraclePeriodSec) * 1000;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const current = vaultRef.current;
      if (!current) return;
      if (current.status !== "locked" && current.status !== "under_threat") return;
      await fetch(`/api/vault/${id}/check`, { method: "POST" });
      void refresh();
    };
    void tick();
    const t = setInterval(tick, periodMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, oraclePeriodSec, tickable, refresh]);

  if (loading || !vault) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="label">loading vault…</span>
      </main>
    );
  }

  const isProvider = me === vault.provider_wallet;
  const isSubscriber = me === vault.subscriber_wallet;
  const guaranteeFunded = !!vault.guarantee_funded_at;
  const subscriptionFunded = !!vault.subscription_funded_at;
  const uiStatus = vaultUiStatus(vault);
  const isSettling = uiStatus === "settling";
  const heartbeatPaused = oraclePaused(vault);

  const explorer =
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER ?? "https://stellar.expert/explorer/testnet";

  const homeHref = isProvider
    ? vault.listing_id
      ? `/provider/listings/${vault.listing_id}`
      : "/provider"
    : "/subscriber";
  const homeLabel = isProvider ? "listing" : "subscriptions";

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[
          { label: homeLabel, href: homeHref },
          { label: vault.id.slice(0, 8) },
        ]}
        address={me}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-10 flex flex-col gap-8">
        {/* Status rail — operator console header */}
        <div className="border border-[var(--rule-0)] bg-[var(--ink-1)]">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] items-stretch divide-y md:divide-y-0 md:divide-x divide-[var(--rule-0)]">
            <RailCell
              label="API being watched"
              value={vault.api_url}
              mono
            />
            <RailCell
              label="failed checks"
              value={`${vault.consecutive_failures} / ${vault.failure_threshold}`}
              accent={vault.consecutive_failures > 0 ? "amber" : undefined}
            />
            <RailCell
              label={vault.expires_at ? `coverage · ${periodDaysLabel(vault.period_days)}` : "check every"}
              value={
                vault.expires_at && vault.status !== "disbursed" && vault.status !== "expired"
                  ? timeUntil(vault.expires_at, now)
                  : `${vault.oracle_period_sec}s`
              }
            />
            <RealtimeCell lastEventTs={lastEventTs} now={now} onRefresh={refresh} />
            <div className="flex items-center justify-end px-4 py-3">
              <StatusBadge status={uiStatus} />
            </div>
          </div>
        </div>

        {vault.settle_error && (
          <Panel label="payout couldn't complete" trailing="trying again">
            <p className="numeric text-[12px] text-[var(--signal-fail)] px-4 py-3 break-all">
              {vault.settle_error}
            </p>
          </Panel>
        )}

        <DisputePanel vault={vault} isProvider={isProvider} onChanged={refresh} />

        {isSettling ? <SettlingPanel /> : <CountdownTimer vault={vault} />}

        <SLATermsCard vault={vault} />

        {/* Funds animation overlay sits above the two-sided pillars */}
        <div className="relative">
          <FundsAnimation
            key={animationKey}
            active={animationKey > 0 && vault.status === "disbursed"}
            direction="to-subscriber"
          />
          <TwoSidedVault vault={vault} me={me} />
        </div>

        {vault.status === "funding" && (
          <>
            <LabeledRule
              label={
                vault.claim_amount_usdc != null
                  ? "subscriber deposit to start"
                  : "both deposits needed to start"
              }
              trailing="lockbox ready"
            />
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vault.claim_amount_usdc != null ? (
                <PoolReservedSlot vault={vault} />
              ) : (
                <FundSlot
                  label={isProvider ? "your deposit" : "provider deposit"}
                  funded={guaranteeFunded}
                  allowed={isProvider}
                  vault={vault}
                  side="guarantee"
                  counterparty={vault.subscriber_wallet}
                  onFunded={refresh}
                />
              )}
              <FundSlot
                label={isSubscriber ? "your deposit" : "subscriber deposit"}
                funded={subscriptionFunded}
                allowed={isSubscriber}
                vault={vault}
                side="subscription"
                counterparty={vault.provider_wallet}
                onFunded={refresh}
              />
            </section>
          </>
        )}

        {vault.status !== "funding" && (
          <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <div className="flex flex-col gap-6">
              <HeartbeatMonitor
                checks={checks}
                paused={heartbeatPaused}
                settled={vault.status === "disbursed" || vault.status === "expired"}
              />
              <IncidentLog checks={checks} />
            </div>

            <div className="flex flex-col gap-6">
              {isProvider && (
                <Panel label="demo · pretend the API is down" trailing="provider only">
                  <div className="px-4 py-4 flex flex-col gap-3">
                    <KillSwitch
                      vaultId={vault.id}
                      active={vault.kill_active}
                      disabled={vault.status === "disbursed"}
                      onToggled={refresh}
                    />
                    <p className="label text-[var(--fg-2)] normal-case tracking-normal text-[12px] leading-relaxed">
                      {vault.kill_active
                        ? `Marking every check as failed. ${vault.failure_threshold} in a row triggers payout.`
                        : `Pretends the API is down. ${vault.failure_threshold} failed checks in a row triggers payout.`}
                    </p>
                  </div>
                </Panel>
              )}

              {vault.status === "disbursed" && (
                <PayoutCard vault={vault} explorer={explorer} isSubscriber={isSubscriber} />
              )}

              <OnChainLinks
                vault={vault}
                explorer={explorer}
                isProvider={isProvider}
                isSubscriber={isSubscriber}
              />
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function RailCell({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "amber";
}) {
  return (
    <div className="flex flex-col justify-center gap-1 px-4 py-3 min-w-0">
      <span className="label">{label}</span>
      <span
        className={(mono ? "numeric truncate" : "") + " text-sm"}
        style={{ color: accent === "amber" ? "var(--amber)" : "var(--fg-0)" }}
      >
        {value}
      </span>
    </div>
  );
}

function RealtimeCell({
  lastEventTs,
  now,
  onRefresh,
}: {
  lastEventTs: number | null;
  now: number;
  onRefresh: () => void;
}) {
  const elapsed = lastEventTs == null ? null : now - lastEventTs;
  const state =
    elapsed == null
      ? "connecting"
      : elapsed < 30_000
        ? "live"
        : elapsed < 60_000
          ? "stale"
          : "offline";
  const colour =
    state === "live"
      ? "var(--signal-ok)"
      : state === "stale"
        ? "var(--amber)"
        : state === "offline"
          ? "var(--signal-fail)"
          : "var(--fg-3)";
  const glyph =
    state === "live" ? "●" : state === "offline" ? "×" : "○";
  return (
    <div className="flex flex-col justify-center gap-1 px-4 py-3 min-w-0">
      <span className="label">realtime</span>
      <div className="flex items-center gap-2">
        <span className="numeric text-sm" style={{ color: colour }}>
          {glyph} {state}
        </span>
        {state === "offline" && (
          <button
            type="button"
            onClick={onRefresh}
            className="label text-[var(--amber)] hover:underline"
          >
            refresh
          </button>
        )}
      </div>
    </div>
  );
}

function PoolReservedSlot({ vault }: { vault: Vault }) {
  const amount = Number(vault.claim_amount_usdc ?? 0);
  return (
    <Panel label="provider coverage" trailing="● from shared pool">
      <div className="px-4 py-6 flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <span
            className="numeric font-medium tracking-tight"
            style={{ fontSize: "2.25rem", color: "var(--amber)" }}
          >
            {amount.toFixed(2)}
          </span>
          <span className="label text-[var(--amber)]">USDC · reserved</span>
        </div>
        <span className="label text-[var(--fg-3)] normal-case tracking-normal text-[12px] leading-relaxed">
          Drawn from the provider&apos;s shared pool on breach. You don&apos;t
          need a separate deposit from the provider for this vault.
        </span>
      </div>
    </Panel>
  );
}

function FundSlot({
  label,
  funded,
  allowed,
  vault,
  side,
  counterparty,
  onFunded,
}: {
  label: string;
  funded: boolean;
  allowed: boolean;
  vault: Vault;
  side: EscrowSide;
  counterparty: string;
  onFunded: () => void;
}) {
  const amount =
    side === "guarantee"
      ? Number(vault.guarantee_usdc)
      : Number(vault.subscription_fee_usdc);
  const contractId =
    side === "guarantee"
      ? vault.guarantee_escrow_contract_id
      : vault.subscription_escrow_contract_id;

  if (funded) {
    return (
      <Panel label={label} trailing="● locked">
        <div className="px-4 py-6 flex items-end justify-between">
          <span
            className="numeric font-medium tracking-tight"
            style={{ fontSize: "2.25rem", color: "var(--fg-0)" }}
          >
            {amount.toFixed(2)}
          </span>
          <span className="label text-[var(--signal-ok)]">USDC · locked in</span>
        </div>
      </Panel>
    );
  }

  if (!allowed) {
    return (
      <Panel label={label} trailing="waiting on the other side">
        <div className="px-4 py-6 flex items-end justify-between">
          <span
            className="numeric font-medium tracking-tight"
            style={{ fontSize: "2.25rem", color: "var(--fg-3)" }}
          >
            {amount.toFixed(2)}
          </span>
          <span className="label text-[var(--fg-3)]">USDC · waiting</span>
        </div>
      </Panel>
    );
  }

  return (
    <VaultFundDialog
      vaultId={vault.id}
      side={side}
      amount={amount}
      apiUrl={vault.api_url}
      counterparty={counterparty}
      contractId={contractId}
      onFunded={onFunded}
    />
  );
}

function PayoutCard({
  vault,
  explorer,
  isSubscriber,
}: {
  vault: Vault;
  explorer: string;
  isSubscriber: boolean;
}) {
  const total = Number(vault.guarantee_usdc) + Number(vault.subscription_fee_usdc);
  const dest = vault.subscriber_payout_target ?? vault.subscriber_wallet;
  const subscriptionTxLabel = isSubscriber ? "your deposit tx" : "subscriber deposit tx";
  return (
    <Panel label="paid out" trailing="settled on Stellar">
      <div className="px-4 py-5 flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <span
            className="numeric font-medium tracking-tight"
            style={{ fontSize: "2.5rem", color: "var(--signal-ok)", lineHeight: 1 }}
          >
            {total.toFixed(2)}
          </span>
          <span className="label text-[var(--signal-ok)]">USDC sent</span>
        </div>
        <div className="border-t border-[var(--rule-0)] pt-3 flex flex-col gap-2">
          <span className="label">paid to</span>
          <span className="numeric text-[12px] text-[var(--fg-0)] break-all">
            {dest}
          </span>
        </div>
        <div className="flex flex-col gap-1 pt-2 border-t border-[var(--rule-0)]">
          {vault.guarantee_payout_tx_hash && (
            <a
              href={`${explorer}/tx/${vault.guarantee_payout_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="numeric text-[11px] text-[var(--amber)] underline break-all"
            >
              provider deposit tx {vault.guarantee_payout_tx_hash.slice(0, 10)}…
            </a>
          )}
          {vault.subscription_payout_tx_hash && (
            <a
              href={`${explorer}/tx/${vault.subscription_payout_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="numeric text-[11px] text-[var(--amber)] underline break-all"
            >
              {subscriptionTxLabel} {vault.subscription_payout_tx_hash.slice(0, 10)}…
            </a>
          )}
        </div>
      </div>
    </Panel>
  );
}

function OnChainLinks({
  vault,
  explorer,
  isProvider,
  isSubscriber,
}: {
  vault: Vault;
  explorer: string;
  isProvider: boolean;
  isSubscriber: boolean;
}) {
  const providerTarget = vault.provider_payout_target ?? vault.provider_wallet;
  const subscriberTarget = vault.subscriber_payout_target ?? vault.subscriber_wallet;
  const providerLockboxLabel = isProvider ? "your lockbox" : "provider lockbox";
  const subscriberLockboxLabel = isSubscriber ? "your lockbox" : "subscriber lockbox";
  const providerFundedLabel = isProvider ? "you funded" : "provider funded";
  const subscriberFundedLabel = isSubscriber ? "you funded" : "subscriber funded";
  const providerWalletLabel = isProvider ? "you" : "provider";
  const subscriberWalletLabel = isSubscriber ? "you" : "subscriber";
  const entries: Array<{ label: string; href: string }> = [];
  if (vault.guarantee_escrow_contract_id) {
    entries.push({
      label: `${providerLockboxLabel} · ${vault.guarantee_escrow_contract_id.slice(0, 10)}…`,
      href: `${explorer}/contract/${vault.guarantee_escrow_contract_id}`,
    });
  }
  if (vault.subscription_escrow_contract_id) {
    entries.push({
      label: `${subscriberLockboxLabel} · ${vault.subscription_escrow_contract_id.slice(0, 10)}…`,
      href: `${explorer}/contract/${vault.subscription_escrow_contract_id}`,
    });
  }
  if (vault.guarantee_fund_tx_hash) {
    entries.push({
      label: `${providerFundedLabel} · ${vault.guarantee_fund_tx_hash.slice(0, 10)}…`,
      href: `${explorer}/tx/${vault.guarantee_fund_tx_hash}`,
    });
  }
  if (vault.subscription_fund_tx_hash) {
    entries.push({
      label: `${subscriberFundedLabel} · ${vault.subscription_fund_tx_hash.slice(0, 10)}…`,
      href: `${explorer}/tx/${vault.subscription_fund_tx_hash}`,
    });
  }
  return (
    <Panel
      label="on Stellar"
      trailing={
        <Link
          href={`/vault/${vault.id}/proof`}
          target="_blank"
          className="label text-[var(--amber)] hover:underline"
        >
          public proof
        </Link>
      }
    >
      <div className="flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--rule-0)] flex flex-col gap-2">
          <span className="label">payout wallets</span>
          <div className="flex flex-col gap-1 numeric text-[11px] text-[var(--fg-1)]">
            <span className="break-all">
              <span className="text-[var(--fg-3)]">{subscriberWalletLabel}</span> {subscriberTarget}
            </span>
            <span className="break-all">
              <span className="text-[var(--fg-3)]">{providerWalletLabel}</span> {providerTarget}
            </span>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="label px-4 py-4 text-[var(--fg-3)]">nothing on chain yet</p>
        ) : (
          entries.map((e) => (
            <a
              key={e.href}
              href={e.href}
              target="_blank"
              rel="noopener noreferrer"
              className="numeric text-[12px] text-[var(--amber)] underline break-all
                         px-4 py-2 border-b border-[var(--rule-0)] last:border-b-0
                         hover:bg-[var(--ink-2)] transition-colors"
            >
              {e.label}
            </a>
          ))
        )}
      </div>
    </Panel>
  );
}

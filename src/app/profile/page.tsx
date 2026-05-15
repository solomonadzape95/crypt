"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Panel, MetricRow } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import type { Listing, Vault } from "@/lib/types";

type ListingWithCount = Listing & { subscriberCount: number };

export default function ProfilePage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingWithCount[]>([]);
  const [providerVaults, setProviderVaults] = useState<Vault[]>([]);
  const [subscriberVaults, setSubscriberVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.authenticated) {
        router.replace("/login?next=/profile");
        return;
      }
      setAddress(me.address);

      const supabase = getBrowserClient();
      const [listingsRes, providerVaultsRes, subscriberVaultsRes] =
        await Promise.all([
          supabase
            .from("listings")
            .select("*")
            .eq("provider_wallet", me.address)
            .order("created_at", { ascending: false }),
          supabase
            .from("vaults")
            .select("*")
            .eq("provider_wallet", me.address)
            .order("created_at", { ascending: false }),
          supabase
            .from("vaults")
            .select("*")
            .eq("subscriber_wallet", me.address)
            .order("created_at", { ascending: false }),
        ]);

      const baseListings = (listingsRes.data as Listing[] | null) ?? [];
      const providerVs = (providerVaultsRes.data as Vault[] | null) ?? [];
      const subscriberVs = (subscriberVaultsRes.data as Vault[] | null) ?? [];

      const counted: ListingWithCount[] = baseListings.map((l) => ({
        ...l,
        subscriberCount: providerVs.filter((v) => v.listing_id === l.id).length,
      }));

      setListings(counted);
      setProviderVaults(providerVs);
      setSubscriberVaults(subscriberVs);
      setLoading(false);
    })();
  }, [router]);

  const isProvider = listings.length > 0 || providerVaults.length > 0;
  const isSubscriber = subscriberVaults.length > 0;

  const memberSince = pickEarliest([
    ...listings.map((l) => l.created_at),
    ...providerVaults.map((v) => v.created_at),
    ...subscriberVaults.map((v) => v.created_at),
  ]);

  const providerPayoutTarget =
    listings[0]?.provider_payout_target ??
    providerVaults.find((v) => v.provider_payout_target)
      ?.provider_payout_target ??
    address;
  const subscriberPayoutTarget =
    subscriberVaults.find((v) => v.subscriber_payout_target)
      ?.subscriber_payout_target ?? address;

  const totalGuaranteeAtStake = providerVaults
    .filter(
      (v) =>
        v.status === "funding" ||
        v.status === "locked" ||
        v.status === "under_threat",
    )
    .reduce((sum, v) => sum + Number(v.guarantee_usdc), 0);
  const totalCoverage = subscriberVaults
    .filter((v) => v.status === "locked" || v.status === "under_threat")
    .reduce((sum, v) => sum + Number(v.guarantee_usdc), 0);

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "profile" }]}
        address={address}
        rightLinks={[
          { href: "/marketplace", label: "marketplace" },
          { href: "/vaults", label: "my coverage" },
          { href: "/provider", label: "my offers" },
        ]}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <span className="label">profile</span>
          <h1
            className="display"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)" }}
          >
            {loading
              ? "Loading…"
              : isProvider && isSubscriber
                ? "Both sides of the desk."
                : isProvider
                  ? "You're a provider."
                  : isSubscriber
                    ? "You're a subscriber."
                    : "Welcome."}
          </h1>
          <p className="text-[13px] text-[var(--fg-1)] max-w-[58ch]">
            Your wallet identity on crypt. Anything you have on the line —
            offered or covered — shows up below.
          </p>
        </div>

        <IdentityCard
          address={address}
          memberSince={memberSince}
          isProvider={isProvider}
          isSubscriber={isSubscriber}
          providerPayoutTarget={
            isProvider ? (providerPayoutTarget ?? null) : null
          }
          subscriberPayoutTarget={
            isSubscriber ? (subscriberPayoutTarget ?? null) : null
          }
          totalGuaranteeAtStake={totalGuaranteeAtStake}
          totalCoverage={totalCoverage}
        />

        {loading ? (
          <Panel label="loading">
            <p className="label px-4 py-6 text-[var(--fg-3)]">querying…</p>
          </Panel>
        ) : (
          <>
            {isProvider && (
              <ProviderSection listings={listings} vaults={providerVaults} />
            )}
            {isSubscriber && <SubscriberSection vaults={subscriberVaults} />}
            {!isProvider && !isSubscriber && <EmptyState />}
          </>
        )}
      </section>
    </main>
  );
}

function IdentityCard({
  address,
  memberSince,
  isProvider,
  isSubscriber,
  providerPayoutTarget,
  subscriberPayoutTarget,
  totalGuaranteeAtStake,
  totalCoverage,
}: {
  address: string | null;
  memberSince: string | null;
  isProvider: boolean;
  isSubscriber: boolean;
  providerPayoutTarget: string | null;
  subscriberPayoutTarget: string | null;
  totalGuaranteeAtStake: number;
  totalCoverage: number;
}) {
  return (
    <Panel label="identity">
      <div className="flex flex-col">
        <MetricRow
          label="wallet"
          value={<span className="break-all">{address ?? "—"}</span>}
        />
        <MetricRow
          label="member since"
          value={memberSince ? new Date(memberSince).toLocaleDateString() : "—"}
        />
        <MetricRow
          label="role"
          value={
            isProvider && isSubscriber
              ? "provider · subscriber"
              : isProvider
                ? "provider"
                : isSubscriber
                  ? "subscriber"
                  : "—"
          }
          accent="amber"
        />
        {isProvider && providerPayoutTarget && (
          <MetricRow
            label="provider payouts to"
            value={<span className="break-all">{providerPayoutTarget}</span>}
          />
        )}
        {isSubscriber && subscriberPayoutTarget && (
          <MetricRow
            label="subscriber payouts to"
            value={<span className="break-all">{subscriberPayoutTarget}</span>}
          />
        )}
        {isProvider && (
          <MetricRow
            label="guarantee at stake"
            value={`${totalGuaranteeAtStake.toFixed(2)} USDC`}
            accent="amber"
          />
        )}
        {isSubscriber && (
          <MetricRow
            label="coverage held"
            value={`${totalCoverage.toFixed(2)} USDC`}
            accent="ok"
          />
        )}
      </div>
    </Panel>
  );
}

function ProviderSection({
  listings,
  vaults,
}: {
  listings: ListingWithCount[];
  vaults: Vault[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="label">provider</span>
          <h2 className="text-[20px] text-[var(--fg-0)]">
            Offers you've published.
          </h2>
        </div>
        <Link
          href="/provider/listings/new"
          className="h-10 px-4 text-[13px] font-medium border border-[var(--amber)]
                     bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                     hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                     flex items-center"
        >
          + new offer
        </Link>
      </div>

      {listings.length === 0 ? (
        <Panel label="offers · 0">
          <p className="label px-4 py-6 text-[var(--fg-3)]">
            No offers yet. Publish one — subscribers will see it in the
            marketplace.
          </p>
        </Panel>
      ) : (
        <Panel
          label={`offers · ${listings.length}`}
          trailing="title · your deposit · their deposit · subscribers"
        >
          <ul className="flex flex-col">
            {listings.map((l) => (
              <li key={l.id}>
                <ProviderListingRow listing={l} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        label={`provider vaults · ${vaults.length}`}
        trailing="api · their deposit · status"
      >
        {vaults.length === 0 ? (
          <p className="label px-4 py-6 text-[var(--fg-3)]">
            No live vaults — no one's subscribed to your offers yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {vaults.map((v) => (
              <li key={v.id}>
                <ProviderVaultRow vault={v} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function SubscriberSection({ vaults }: { vaults: Vault[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="label">subscriber</span>
          <h2 className="text-[20px] text-[var(--fg-0)]">
            APIs you've covered.
          </h2>
        </div>
        <Link
          href="/marketplace"
          className="h-10 px-4 text-[13px] font-medium border border-[var(--amber)]
                     text-[var(--amber)] hover:bg-[var(--amber)] hover:text-[var(--ink-0)]
                     transition-colors uppercase tracking-[0.12em] flex items-center"
        >
          browse marketplace →
        </Link>
      </div>

      <Panel
        label={`coverage · ${vaults.length}`}
        trailing="provider · their deposit · your deposit · status"
      >
        {vaults.length === 0 ? (
          <p className="label px-4 py-6 text-[var(--fg-3)]">No coverage yet.</p>
        ) : (
          <ul className="flex flex-col">
            {vaults.map((v) => (
              <li key={v.id}>
                <SubscriberVaultRow vault={v} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function EmptyState() {
  return (
    <Panel label="nothing yet">
      <div className="px-4 py-8 flex flex-col gap-4">
        <p className="text-[14px] text-[var(--fg-1)]">
          This wallet hasn't published an offer or covered an API yet.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/provider/listings/new"
            className="h-10 px-4 text-[13px] font-medium border border-[var(--amber)]
                       bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                       hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                       flex items-center"
          >
            create your first offer
          </Link>
          <Link
            href="/marketplace"
            className="h-10 px-4 text-[13px] font-medium border border-[var(--rule-1)]
                       text-[var(--fg-0)] hover:border-[var(--amber)] hover:text-[var(--amber)]
                       transition-colors uppercase tracking-[0.12em] flex items-center"
          >
            browse marketplace
          </Link>
        </div>
      </div>
    </Panel>
  );
}

function ProviderListingRow({ listing }: { listing: ListingWithCount }) {
  return (
    <Link
      href={`/provider/listings/${listing.id}`}
      className="group block border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
    >
      <div
        className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(7rem,_auto)_1.5rem]
                      items-center gap-6 px-4 py-4"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="label">
            {listing.active ? (
              <span style={{ color: "var(--signal-ok)" }}>● live</span>
            ) : (
              <span style={{ color: "var(--fg-3)" }}>○ paused</span>
            )}
          </span>
          <span className="text-[14px] text-[var(--fg-0)] truncate">
            {listing.title}
          </span>
          <span className="numeric text-[11px] text-[var(--fg-2)] truncate">
            {listing.api_url}
          </span>
        </div>
        <Cell label="your deposit" accent>
          {Number(listing.guarantee_usdc).toFixed(2)}
        </Cell>
        <Cell label="their deposit">
          {Number(listing.subscription_fee_usdc).toFixed(2)}
        </Cell>
        <Cell label="subscribers">{listing.subscriberCount}</Cell>
        <span
          className="text-lg text-[var(--fg-3)] group-hover:text-[var(--amber)] transition-colors"
          aria-hidden
        >
          ›
        </span>
      </div>
    </Link>
  );
}

function ProviderVaultRow({ vault }: { vault: Vault }) {
  return (
    <Link
      href={`/vault/${vault.id}`}
      className="group block border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
    >
      <div
        className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_1.5rem]
                      items-center gap-6 px-4 py-4"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="label">
            subscriber {vault.subscriber_wallet.slice(0, 6)}…
            {vault.subscriber_wallet.slice(-4)}
          </span>
          <span className="numeric text-[13px] text-[var(--fg-0)] truncate">
            {vault.api_url}
          </span>
        </div>
        <Cell label="your deposit" accent>
          {Number(vault.guarantee_usdc).toFixed(2)}
        </Cell>
        <div className="flex justify-end">
          <StatusBadge status={vault.status} />
        </div>
        <span
          className="text-lg text-[var(--fg-3)] group-hover:text-[var(--amber)] transition-colors"
          aria-hidden
        >
          ›
        </span>
      </div>
    </Link>
  );
}

function SubscriberVaultRow({ vault }: { vault: Vault }) {
  return (
    <Link
      href={`/vault/${vault.id}`}
      className="group block border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
    >
      <div
        className="grid grid-cols-[1fr_minmax(8rem,_auto)_minmax(8rem,_auto)_minmax(8rem,_auto)_1.5rem]
                      items-center gap-6 px-4 py-4"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="label">
            provider {vault.provider_wallet.slice(0, 6)}…
            {vault.provider_wallet.slice(-4)}
          </span>
          <span className="numeric text-[13px] text-[var(--fg-0)] truncate">
            {vault.api_url}
          </span>
        </div>
        <Cell label="their deposit" accent>
          {Number(vault.guarantee_usdc).toFixed(2)}
        </Cell>
        <Cell label="your deposit">
          {Number(vault.subscription_fee_usdc).toFixed(2)}
        </Cell>
        <div className="flex justify-end">
          <StatusBadge status={vault.status} />
        </div>
        <span
          className="text-lg text-[var(--fg-3)] group-hover:text-[var(--amber)] transition-colors"
          aria-hidden
        >
          ›
        </span>
      </div>
    </Link>
  );
}

function Cell({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="label">{label}</span>
      <span
        className="numeric text-sm"
        style={{ color: accent ? "var(--amber)" : "var(--fg-0)" }}
      >
        {children}
      </span>
    </div>
  );
}

function pickEarliest(dates: string[]): string | null {
  const valid = dates.filter(Boolean).sort();
  return valid[0] ?? null;
}

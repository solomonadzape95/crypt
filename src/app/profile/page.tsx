"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Panel, MetricRow } from "@/components/Panel";
import type { Listing, Vault } from "@/lib/types";

/**
 * Slim profile: identity card + sign-out only. The role-specific lists used
 * to live here too, but they now sit under /provider and /subscriber so the
 * "what's my role this session?" mental model isn't muddied by a single page
 * that mixes both.
 */
export default function ProfilePage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [stats, setStats] = useState({
    listings: 0,
    providerVaults: 0,
    subscriberVaults: 0,
    memberSince: null as string | null,
  });
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
            .select("created_at")
            .eq("provider_wallet", me.address),
          supabase
            .from("vaults")
            .select("created_at")
            .eq("provider_wallet", me.address),
          supabase
            .from("vaults")
            .select("created_at")
            .eq("subscriber_wallet", me.address),
        ]);

      const ls = (listingsRes.data as Listing[] | null) ?? [];
      const pv = (providerVaultsRes.data as Vault[] | null) ?? [];
      const sv = (subscriberVaultsRes.data as Vault[] | null) ?? [];

      const memberSince = pickEarliest([
        ...ls.map((l) => l.created_at),
        ...pv.map((v) => v.created_at),
        ...sv.map((v) => v.created_at),
      ]);

      setStats({
        listings: ls.length,
        providerVaults: pv.length,
        subscriberVaults: sv.length,
        memberSince,
      });
      setLoading(false);
    })();
  }, [router]);

  async function onSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const isProvider = stats.listings > 0 || stats.providerVaults > 0;
  const isSubscriber = stats.subscriberVaults > 0;
  const role =
    isProvider && isSubscriber
      ? "provider · subscriber"
      : isProvider
        ? "provider"
        : isSubscriber
          ? "subscriber"
          : "—";

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[{ label: "profile" }]}
        address={address}
        rightLinks={[
          { href: "/subscriber", label: "subscriber" },
          { href: "/provider", label: "provider" },
        ]}
      />

      <section className="max-w-[64rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <span className="label">profile</span>
          <h1
            className="hero-display"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
          >
            {loading ? "Loading…" : "Your wallet on crypt."}
          </h1>
          <p className="text-[13px] text-[var(--fg-1)] max-w-[58ch]">
            One wallet, one identity. Your role-specific dashboards live at{" "}
            <Link href="/subscriber" className="underline text-[var(--fg-0)]">
              /subscriber
            </Link>{" "}
            and{" "}
            <Link href="/provider" className="underline text-[var(--fg-0)]">
              /provider
            </Link>
            .
          </p>
        </div>

        <Panel label="identity">
          <div className="flex flex-col">
            <MetricRow
              label="wallet"
              value={
                address ? <span className="break-all">{address}</span> : "—"
              }
            />
            <MetricRow
              label="member since"
              value={
                stats.memberSince
                  ? new Date(stats.memberSince).toLocaleDateString()
                  : "—"
              }
            />
            <MetricRow label="role this wallet has played" value={role} accent="amber" />
          </div>
        </Panel>

        <Panel label="dashboards">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <DashLink
              href="/subscriber"
              label="subscriber dashboard"
              detail={`${stats.subscriberVaults} vault${stats.subscriberVaults === 1 ? "" : "s"} you've covered`}
            />
            <DashLink
              href="/provider"
              label="provider dashboard"
              detail={`${stats.listings} listing${stats.listings === 1 ? "" : "s"} you've published`}
              border
            />
          </div>
        </Panel>

        <button
          type="button"
          onClick={onSignOut}
          className="self-start h-11 px-5 text-sm font-medium border border-[var(--rule-0)]
                     text-[var(--fg-0)] hover:border-[var(--signal-fail)]
                     hover:text-[var(--signal-fail)] transition-colors uppercase
                     tracking-[0.12em]"
        >
          sign out
        </button>
      </section>
    </main>
  );
}

function DashLink({
  href,
  label,
  detail,
  border,
}: {
  href: string;
  label: string;
  detail: string;
  border?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "group block px-4 py-5 hover:bg-[var(--ink-2)] transition-colors " +
        (border ? "md:border-l border-[var(--rule-0)]" : "")
      }
    >
      <span className="label group-hover:text-[var(--fg-0)] transition-colors">
        {label}
      </span>
      <p className="text-[12px] text-[var(--fg-2)] mt-1">{detail}</p>
    </Link>
  );
}

function pickEarliest(dates: string[]): string | null {
  const valid = dates.filter(Boolean).sort();
  return valid[0] ?? null;
}

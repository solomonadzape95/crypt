"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { Panel, MetricRow } from "@/components/Panel";
import { signXDR } from "@/lib/wallet";
import { getBrowserClient } from "@/lib/supabase";
import type { Listing } from "@/lib/types";

type Params = { id: string };

type Step = "loading" | "ready" | "deploying" | "signing" | "submitting" | "done" | "error";

export default function FundPoolPage(props: { params: Promise<Params> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData.authenticated) {
        router.replace(`/login?next=/provider/listings/${id}/fund-pool`);
        return;
      }
      setMe(meData.address);
      const supa = getBrowserClient();
      const { data } = await supa.from("listings").select("*").eq("id", id).single();
      setListing(data as Listing | null);
      setStep("ready");
    })();
  }, [id, router]);

  async function onFund() {
    if (!listing) return;
    setErr(null);
    try {
      // Step 1: deploy (idempotent) + get unsigned fund XDR.
      setStep("deploying");
      const setupRes = await fetch(`/api/listing/${id}/pool/setup`, {
        method: "POST",
      });
      if (!setupRes.ok) throw new Error(await setupRes.text());
      const { unsignedXDR } = await setupRes.json();

      // Step 2: provider's wallet signs the fund tx.
      setStep("signing");
      const signed = await signXDR(unsignedXDR);

      // Step 3: server submits + verifies on-chain.
      setStep("submitting");
      const submitRes = await fetch(`/api/listing/${id}/pool/submit-fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXDR: signed }),
      });
      if (!submitRes.ok) throw new Error(await submitRes.text());
      const { txHash: hash } = await submitRes.json();
      setTxHash(hash);
      setStep("done");
      setTimeout(() => router.replace(`/provider/listings/${id}`), 1500);
    } catch (e) {
      setStep("error");
      setErr(e instanceof Error ? e.message : "fund failed");
    }
  }

  if (!listing) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="label">loading…</span>
      </main>
    );
  }
  if (listing.payout_mode !== "pool") {
    return (
      <main className="flex-1 flex flex-col">
        <AppHeader
          crumbs={[{ label: "provider", href: "/provider" }, { label: "fund pool" }]}
          address={me}
        />
        <section className="max-w-2xl mx-auto px-6 py-12">
          <Panel label="not a pool listing">
            <p className="px-4 py-6 text-[13px] text-[var(--fg-1)]">
              This listing isn&apos;t in pool mode.
            </p>
          </Panel>
        </section>
      </main>
    );
  }

  const explorer =
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER ?? "https://stellar.expert/explorer/testnet";

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[
          { label: "provider", href: "/provider" },
          { label: listing.title, href: `/provider/listings/${id}` },
          { label: "fund pool" },
        ]}
        address={me}
      />
      <section className="max-w-2xl mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-3 rise">
          <span className="label">fund the pool</span>
          <h1
            className="hero-display"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
          >
            One deposit, many payouts.
          </h1>
          <p className="text-[14px] text-[var(--fg-1)] max-w-[58ch] leading-relaxed">
            This pool covers every breach payout for{" "}
            <span className="numeric">{listing.title}</span>. Each subscriber&apos;s
            claim comes out of this balance; on each breach we drain to the
            subscriber and re-issue a fresh pool with the remainder.
          </p>
        </div>

        <Panel label="pool" trailing={listing.pool_funded_at ? "● funded" : "● not funded"}>
          <MetricRow
            label="amount"
            accent="amber"
            value={`${Number(listing.pool_amount_usdc ?? 0).toFixed(2)} USDC`}
          />
          <MetricRow
            label="coverage ratio"
            value={`${Number(listing.coverage_ratio_x ?? 0)}× per subscriber`}
          />
          <MetricRow label="api watched" value={<span className="break-all">{listing.api_url}</span>} />
          {listing.pool_contract_id && (
            <MetricRow
              label="contract"
              value={
                <a
                  href={`${explorer}/contract/${listing.pool_contract_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="numeric underline text-[var(--amber)] break-all"
                >
                  {listing.pool_contract_id.slice(0, 16)}…
                </a>
              }
            />
          )}
        </Panel>

        {!listing.pool_funded_at && (
          <button
            type="button"
            onClick={onFund}
            disabled={step === "deploying" || step === "signing" || step === "submitting"}
            className="h-12 w-full px-6 border border-[var(--amber)] bg-[var(--amber)]
                       text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                       transition-colors uppercase tracking-[0.12em] text-sm font-medium
                       disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <span>
              {step === "deploying" && "deploying pool…"}
              {step === "signing" && "sign in your wallet"}
              {step === "submitting" && "submitting on-chain…"}
              {step === "done" && "pool funded ✓"}
              {(step === "ready" || step === "error") && "deposit pool"}
              {step === "loading" && "loading…"}
            </span>
            {(step === "deploying" || step === "signing" || step === "submitting") && (
              <motion.span
                className="h-2 w-2 bg-[var(--ink-0)]"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
            )}
          </button>
        )}

        {txHash && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="numeric text-[12px] text-[var(--amber)] underline break-all"
          >
            fund tx · {txHash.slice(0, 16)}…
          </a>
        )}
        {err && (
          <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">{err}</p>
        )}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/Panel";
import { AmountField } from "@/components/AmountField";

const GUARANTEES = [1, 5, 10] as const;
const SUB_FEES = [5, 20, 100] as const;
const PERIODS = [15, 60, 300] as const;
const POOL_SIZES = [100, 500, 1000] as const;
const COVERAGE_RATIOS = [5, 10, 20] as const;

type PayoutMode = "per_vault" | "pool";

// Coverage period options. Multipliers are fixed: 7d ×1, 30d ×4, 90d ×11.
// Provider picks which of these to offer; subscribers pick among the offered.
const COVERAGE_OPTIONS = [
  { days: 7, label: "1 week", multiplier: 1 },
  { days: 30, label: "1 month", multiplier: 4 },
  { days: 90, label: "3 months", multiplier: 11 },
] as const;

export default function NewListingPage() {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [title, setTitle] = useState("Acme Status API");
  const [description, setDescription] = useState("");
  const [apiUrl, setApiUrl] = useState("http://localhost:4000");
  const [payoutMode, setPayoutMode] = useState<PayoutMode>("per_vault");
  const [guarantee, setGuarantee] = useState<number>(1);
  const [poolAmount, setPoolAmount] = useState<number>(500);
  const [coverageRatio, setCoverageRatio] = useState<number>(10);
  const [subscriptionFee, setSubscriptionFee] = useState<number>(5);
  const [oraclePeriod, setOraclePeriod] = useState<number>(60);
  const [coverageDays, setCoverageDays] = useState<number[]>([7, 30, 90]);
  const [useSignedInWallet, setUseSignedInWallet] = useState(true);
  const [payoutTarget, setPayoutTarget] = useState("");
  const [expectBodyRegex, setExpectBodyRegex] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/auth/me");
      const d = await r.json();
      if (!d.authenticated) {
        router.replace("/login?next=/provider/listings/new");
        return;
      }
      setMe(d.address);
    })();
  }, [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (coverageDays.length === 0) {
      setErr("Pick at least one coverage period to offer.");
      return;
    }
    setBusy(true);
    setErr(null);

    const res = await fetch("/api/listing/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description.trim() || undefined,
        apiUrl,
        oraclePeriodSec: oraclePeriod,
        // For pool mode, guarantee_usdc is the headline "max claim" hint —
        // a 1-week subscriber's payout. The real payout math is on the server.
        guaranteeUsdc:
          payoutMode === "pool" ? subscriptionFee * coverageRatio : guarantee,
        subscriptionFeeUsdc: subscriptionFee,
        providerPayoutTarget: useSignedInWallet ? undefined : payoutTarget.trim(),
        expectBodyRegex: expectBodyRegex.trim() || null,
        coverageDays: [...coverageDays].sort((a, b) => a - b),
        payoutMode,
        ...(payoutMode === "pool"
          ? { poolAmountUsdc: poolAmount, coverageRatioX: coverageRatio }
          : {}),
      }),
    });
    if (!res.ok) {
      setErr((await res.text()) || "Could not create listing.");
      setBusy(false);
      return;
    }
    const data = (await res.json()) as {
      listingId: string;
      needsPoolFunding?: boolean;
    };
    if (data.needsPoolFunding) {
      router.push(`/provider/listings/${data.listingId}/fund-pool`);
    } else {
      router.push(`/provider/listings/${data.listingId}`);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <AppHeader
        crumbs={[
          { label: "provider", href: "/provider" },
          { label: "new offer" },
        ]}
        address={me}
      />

      <section className="max-w-[88rem] mx-auto w-full px-6 md:px-12 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-3 rise">
          <span className="label">create offer</span>
          <h1
            className="hero-display"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.6rem)" }}
          >
            Publish an offer.
          </h1>
          <p className="text-[14px] text-[var(--fg-1)] max-w-[64ch] leading-relaxed">
            Anyone can subscribe. Every subscriber gets their own lockbox — you
            put up a deposit for each one.
          </p>
        </div>

        <form
          onSubmit={onCreate}
          className="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch gap-6"
        >
          {/* Left column: about + payout stacked. Wrapping in a flex-col lets
              CSS-grid stretch it to match the deposits panel on the right;
              payout gets flex-1 so it absorbs the leftover space and the two
              columns visually bottom-out together. */}
          <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1 min-h-0">
          <Panel label="about your API">
            <Field label="title" hint="what subscribers see in the marketplace">
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="description" hint="optional · one-line pitch">
              <textarea
                maxLength={800}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
            <Field label="API URL" hint="the endpoint we'll watch">
              <input
                type="url"
                required
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.yourservice.com/health"
                className="numeric"
              />
            </Field>
            <Field
              label="body must match (regex)"
              hint="optional · status 200 alone is healthy if blank"
              last
            >
              <input
                type="text"
                value={expectBodyRegex}
                onChange={(e) => setExpectBodyRegex(e.target.value)}
                placeholder='e.g. "ok":\s*true'
                className="numeric"
              />
            </Field>
          </Panel>

          <Panel label="payout wallet" className="flex-1">
            <div className="px-4 py-4 flex flex-col gap-3 h-full">
              <label className="flex items-center gap-2 text-[13px] text-[var(--fg-1)]">
                <input
                  type="checkbox"
                  checked={useSignedInWallet}
                  onChange={(e) => setUseSignedInWallet(e.target.checked)}
                  className="h-4 w-4 accent-[var(--amber)]"
                />
                <span>
                  use signed-in wallet
                  {me && (
                    <span className="numeric text-[var(--fg-2)] ml-2 text-[11px]">
                      {me.slice(0, 6)}…{me.slice(-4)}
                    </span>
                  )}
                </span>
              </label>
              {!useSignedInWallet && (
                <input
                  type="text"
                  required
                  value={payoutTarget}
                  onChange={(e) => setPayoutTarget(e.target.value.toUpperCase())}
                  placeholder="G..."
                  className="h-10 w-full bg-[var(--ink-0)] border border-[var(--rule-0)] px-3 text-sm
                             focus:outline-none focus:border-[var(--amber)] numeric"
                />
              )}
              <span className="label text-[var(--fg-3)]">
                where you receive USDC when the API stays up
              </span>
            </div>
          </Panel>
          </div>

          <Panel
            label={
              payoutMode === "pool"
                ? "deposits · shared pool"
                : "deposits · per subscriber"
            }
            className="lg:col-start-2 lg:row-start-1"
          >
            <PayoutModeToggle value={payoutMode} onChange={setPayoutMode} />
            {payoutMode === "per_vault" ? (
              <AmountField
                label="your deposit"
                hint="USDC you stake on staying up · subscriber gets it if the API fails"
                presets={GUARANTEES.map((v) => ({ value: v, display: `${v} USDC` }))}
                value={guarantee}
                onChange={setGuarantee}
                min={0.5}
                max={100}
                step={0.5}
              />
            ) : (
              <>
                <AmountField
                  label="pool size"
                  hint="one-time deposit · pays out across many subscribers' breaches"
                  presets={POOL_SIZES.map((v) => ({ value: v, display: `${v} USDC` }))}
                  value={poolAmount}
                  onChange={setPoolAmount}
                  min={50}
                  max={10000}
                  step={10}
                />
                <CoverageRatioField
                  value={coverageRatio}
                  onChange={setCoverageRatio}
                  baseFee={subscriptionFee}
                />
              </>
            )}
            <AmountField
              label="subscriber deposit · per week"
              hint="base price for 7 days · scales ×4 for 1mo, ×11 for 3mo"
              presets={SUB_FEES.map((v) => ({ value: v, display: `${v} USDC` }))}
              value={subscriptionFee}
              onChange={setSubscriptionFee}
              min={0.5}
              max={500}
              step={0.5}
            />
            <CoverageTogglesField
              selected={coverageDays}
              onToggle={(days) =>
                setCoverageDays((cur) =>
                  cur.includes(days) ? cur.filter((d) => d !== days) : [...cur, days],
                )
              }
              baseFee={subscriptionFee}
            />
            <PresetField
              label="check every"
              hint="how often we test the API"
              presets={PERIODS.map((v) => ({
                value: v,
                display: v >= 60 ? `${v / 60}m` : `${v}s`,
              }))}
              value={oraclePeriod}
              onChange={setOraclePeriod}
              last
            />
          </Panel>

          {/* Submit row spans both columns on lg+ */}
          <div className="lg:col-span-2 lg:row-start-2 flex flex-col gap-3">
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full px-6 border border-[var(--amber)] bg-[var(--amber)]
                         text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                         transition-colors uppercase tracking-[0.12em] text-sm font-medium
                         disabled:opacity-50 flex items-center justify-center"
            >
              {busy ? "creating…" : "publish offer"}
            </button>
            {err && (
              <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">
                {err}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col gap-2 px-4 py-4 " +
        (last ? "" : "border-b border-[var(--rule-0)]")
      }
    >
      <span className="label">{label}</span>
      <FieldChildren>{children}</FieldChildren>
      {hint && <span className="label text-[var(--fg-3)]">{hint}</span>}
    </div>
  );
}

function FieldChildren({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        [&_input]:h-10 [&_input]:w-full [&_input]:bg-[var(--ink-0)] [&_input]:border [&_input]:border-[var(--rule-0)]
        [&_input]:px-3 [&_input]:text-sm
        [&_input:focus]:outline-none [&_input:focus]:border-[var(--amber)]
        [&_textarea]:w-full [&_textarea]:bg-[var(--ink-0)] [&_textarea]:border [&_textarea]:border-[var(--rule-0)]
        [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm [&_textarea]:resize-none
        [&_textarea:focus]:outline-none [&_textarea:focus]:border-[var(--amber)]
      "
    >
      {children}
    </div>
  );
}

function PayoutModeToggle({
  value,
  onChange,
}: {
  value: PayoutMode;
  onChange: (v: PayoutMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 border-b border-[var(--rule-0)]">
      <span className="label">payout mode</span>
      <div className="grid grid-cols-2">
        {(["per_vault", "pool"] as const).map((m) => {
          const active = value === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className="h-10 border text-sm transition-colors numeric"
              style={{
                borderColor: active ? "var(--amber)" : "var(--rule-0)",
                background: active ? "var(--amber-bg)" : "var(--ink-0)",
                color: active ? "var(--amber)" : "var(--fg-2)",
                marginLeft: m === "pool" ? "-1px" : 0,
              }}
            >
              {m === "per_vault" ? "per subscriber" : "shared pool"}
            </button>
          );
        })}
      </div>
      <span className="label text-[var(--fg-3)]">
        {value === "per_vault"
          ? "you deposit X for each subscriber individually"
          : "you deposit one pool that pays out across many breaches"}
      </span>
    </div>
  );
}

function CoverageRatioField({
  value,
  onChange,
  baseFee,
}: {
  value: number;
  onChange: (v: number) => void;
  baseFee: number;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 border-b border-[var(--rule-0)]">
      <span className="label">coverage ratio</span>
      <div className="grid grid-cols-3 gap-2">
        {COVERAGE_RATIOS.map((r) => {
          const active = r === value;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onChange(r)}
              className="h-10 border text-sm transition-colors numeric"
              style={{
                borderColor: active ? "var(--amber)" : "var(--rule-0)",
                background: active ? "var(--amber-bg)" : "var(--ink-0)",
                color: active ? "var(--amber)" : "var(--fg-2)",
              }}
            >
              {r}×
            </button>
          );
        })}
      </div>
      <span className="label text-[var(--fg-3)]">
        a 7d subscriber paying {baseFee.toFixed(2)} → gets{" "}
        {(baseFee * value).toFixed(2)} USDC on breach
      </span>
    </div>
  );
}

function CoverageTogglesField({
  selected,
  onToggle,
  baseFee,
}: {
  selected: number[];
  onToggle: (days: number) => void;
  baseFee: number;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 border-b border-[var(--rule-0)]">
      <span className="label">coverage offered</span>
      <div className="grid grid-cols-3 gap-2">
        {COVERAGE_OPTIONS.map((opt) => {
          const active = selected.includes(opt.days);
          const fee = baseFee * opt.multiplier;
          return (
            <button
              key={opt.days}
              type="button"
              onClick={() => onToggle(opt.days)}
              className="h-16 border text-sm transition-colors numeric flex flex-col items-center justify-center gap-1"
              style={{
                borderColor: active ? "var(--amber)" : "var(--rule-0)",
                background: active ? "var(--amber-bg)" : "var(--ink-0)",
                color: active ? "var(--amber)" : "var(--fg-2)",
              }}
            >
              <span className="text-[13px]">
                {opt.label} <span className="text-[var(--fg-3)]">×{opt.multiplier}</span>
              </span>
              <span className="text-[11px] text-[var(--fg-3)]">{fee.toFixed(2)} USDC</span>
            </button>
          );
        })}
      </div>
      <span className="label text-[var(--fg-3)]">
        which periods subscribers can pick · at least one
      </span>
    </div>
  );
}

function PresetField<T extends number>({
  label,
  hint,
  presets,
  value,
  onChange,
  last,
}: {
  label: string;
  hint?: string;
  presets: Array<{ value: T; display: string }>;
  value: T;
  onChange: (v: T) => void;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col gap-2 px-4 py-4 " +
        (last ? "" : "border-b border-[var(--rule-0)]")
      }
    >
      <span className="label">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => {
          const active = p.value === value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className="h-10 border text-sm transition-colors numeric"
              style={{
                borderColor: active ? "var(--amber)" : "var(--rule-0)",
                background: active ? "var(--amber-bg)" : "var(--ink-0)",
                color: active ? "var(--amber)" : "var(--fg-1)",
              }}
            >
              {p.display}
            </button>
          );
        })}
      </div>
      {hint && <span className="label text-[var(--fg-3)]">{hint}</span>}
    </div>
  );
}

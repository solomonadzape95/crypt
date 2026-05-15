"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/Panel";

const GUARANTEES = [1, 5, 10] as const;
const SUB_FEES = [5, 20, 100] as const;
const PERIODS = [15, 60, 300] as const;

export default function NewListingPage() {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [title, setTitle] = useState("Acme Status API");
  const [description, setDescription] = useState("");
  const [apiUrl, setApiUrl] = useState("http://localhost:4000");
  const [guarantee, setGuarantee] = useState<number>(1);
  const [subscriptionFee, setSubscriptionFee] = useState<number>(5);
  const [oraclePeriod, setOraclePeriod] = useState<number>(60);
  const [useSignedInWallet, setUseSignedInWallet] = useState(true);
  const [payoutTarget, setPayoutTarget] = useState("");
  const [boundlessUrl, setBoundlessUrl] = useState("");
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
        guaranteeUsdc: guarantee,
        subscriptionFeeUsdc: subscriptionFee,
        providerPayoutTarget: useSignedInWallet ? undefined : payoutTarget.trim(),
        boundlessUrl: boundlessUrl.trim() || null,
      }),
    });
    if (!res.ok) {
      setErr((await res.text()) || "Could not create listing.");
      setBusy(false);
      return;
    }
    const { listingId } = (await res.json()) as { listingId: string };
    router.push(`/provider/listings/${listingId}`);
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

      <section className="max-w-2xl mx-auto w-full px-6 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <span className="label">create offer</span>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 3.5vw, 2.75rem)" }}>
            Publish an offer.
          </h1>
          <p className="text-[13px] text-[var(--fg-1)] max-w-[58ch] leading-relaxed">
            Anyone can subscribe. Every subscriber gets their own lockbox — you put up
            a deposit for each one.
          </p>
        </div>

        <form onSubmit={onCreate} className="flex flex-col gap-6">
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
            <Field label="API URL" hint="the endpoint we'll watch" last>
              <input
                type="url"
                required
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.yourservice.com/health"
                className="numeric"
              />
            </Field>
          </Panel>

          <Panel label="deposits · per subscriber">
            <PresetField
              label="your deposit"
              hint="USDC you stake on staying up · subscriber gets it if the API fails"
              presets={GUARANTEES.map((v) => ({ value: v, display: `${v} USDC` }))}
              value={guarantee}
              onChange={setGuarantee}
            />
            <PresetField
              label="subscriber deposit"
              hint="USDC the subscriber pays · refunded if the API fails, you keep it otherwise"
              presets={SUB_FEES.map((v) => ({ value: v, display: `${v} USDC` }))}
              value={subscriptionFee}
              onChange={setSubscriptionFee}
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

          <Panel label="payout wallet">
            <div className="px-4 py-4 flex flex-col gap-3 border-b border-[var(--rule-0)]">
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
                  className="h-10 bg-[var(--ink-0)] border border-[var(--rule-0)] px-3 text-sm
                             focus:outline-none focus:border-[var(--amber)] numeric"
                />
              )}
              <span className="label text-[var(--fg-3)]">
                where you receive USDC when the API stays up
              </span>
            </div>
            <Field label="Boundless campaign" hint="optional · shown on each subscriber's dashboard" last>
              <input
                type="url"
                value={boundlessUrl}
                onChange={(e) => setBoundlessUrl(e.target.value)}
                placeholder="https://app.boundlessfi.xyz/projects/..."
                className="numeric"
              />
            </Field>
          </Panel>

          <button
            type="submit"
            disabled={busy}
            className="h-12 px-6 border border-[var(--amber)] bg-[var(--amber)]
                       text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                       transition-colors uppercase tracking-[0.12em] text-sm font-medium
                       disabled:opacity-50 flex items-center justify-between"
          >
            <span>{busy ? "creating…" : "publish offer"}</span>
            <span>→</span>
          </button>

          {err && (
            <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">{err}</p>
          )}
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
        [&_input]:h-10 [&_input]:bg-[var(--ink-0)] [&_input]:border [&_input]:border-[var(--rule-0)]
        [&_input]:px-3 [&_input]:text-sm
        [&_input:focus]:outline-none [&_input:focus]:border-[var(--amber)]
        [&_textarea]:bg-[var(--ink-0)] [&_textarea]:border [&_textarea]:border-[var(--rule-0)]
        [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm [&_textarea]:resize-none
        [&_textarea:focus]:outline-none [&_textarea:focus]:border-[var(--amber)]
      "
    >
      {children}
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

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { connectWallet, signLoginMessage, WalletError } from "@/lib/wallet";
import { BarsMarkPattern } from "@/components/brand/BarsMarkPattern";
import { CryptBarsMark } from "@/components/brand/CryptBarsMark";

type Step = "idle" | "connecting" | "signing" | "verifying" | "done" | "error";
type Role = "subscriber" | "provider";

const ROLE_DEFAULT_NEXT: Record<Role, string> = {
  subscriber: "/subscriber",
  provider: "/provider",
};

const ROLE_COPY: Record<Role, { eyebrow: string; body: string }> = {
  subscriber: {
    eyebrow: "I'm covering an API",
    body: "Your provider locks USDC alongside yours. If the API drops past the SLA, the lockbox pays you out automatically — no claim form, no waiting.",
  },
  provider: {
    eyebrow: "I'm running an API",
    body: "Stake on your own uptime. Subscribers post a fee, you post a guarantee. Stay up and you keep both. Drop and the subscriber gets both.",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const explicitNext = params.get("next");
  const router = useRouter();
  const [role, setRole] = useState<Role>("subscriber");
  const [step, setStep] = useState<Step>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // If there's an explicit ?next= and it matches a role's home, default the
  // tab to that role so the page doesn't fight the link the user clicked.
  useEffect(() => {
    if (explicitNext === "/provider" || explicitNext?.startsWith("/provider/")) {
      setRole("provider");
    } else if (explicitNext === "/subscriber" || explicitNext?.startsWith("/subscriber/")) {
      setRole("subscriber");
    }
  }, [explicitNext]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.authenticated) {
          router.replace(explicitNext ?? ROLE_DEFAULT_NEXT[role]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router, explicitNext, role]);

  async function onSignIn() {
    setErr(null);
    try {
      setStep("connecting");
      const wallet = await connectWallet();
      setAddress(wallet.address);

      const chRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      if (!chRes.ok) throw new Error(await chRes.text());
      const { message } = (await chRes.json()) as { nonce: string; message: string };

      setStep("signing");
      const signatureB64 = await signLoginMessage(message, wallet.address);

      setStep("verifying");
      const loginRes = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address, signatureB64 }),
      });
      if (!loginRes.ok) throw new Error(await loginRes.text());

      setStep("done");
      router.replace(explicitNext ?? ROLE_DEFAULT_NEXT[role]);
    } catch (e) {
      setStep("error");
      const msg =
        e instanceof WalletError ? e.message : e instanceof Error ? e.message : "Could not sign in.";
      setErr(msg);
    }
  }

  const copy = ROLE_COPY[role];

  return (
    <LoginShell>
      <div className="flex flex-col gap-8">
        {/* Role tabs */}
        <div role="tablist" className="grid grid-cols-2 border border-[var(--rule-0)]">
          {(["subscriber", "provider"] as const).map((r) => {
            const active = r === role;
            return (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRole(r)}
                className="relative h-11 label flex items-center justify-center transition-colors"
                style={{
                  background: active ? "var(--ink-2)" : "transparent",
                  color: active ? "var(--fg-0)" : "var(--fg-2)",
                }}
              >
                {r === "subscriber" ? "I'm a subscriber" : "I'm a provider"}
                {active && (
                  <motion.span
                    layoutId="role-tab-underline"
                    className="absolute left-0 right-0 bottom-0 h-px"
                    style={{ background: "var(--amber)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Role-aware copy */}
        <div className="flex flex-col gap-3">
          <span className="label" style={{ color: "var(--amber)" }}>{copy.eyebrow}</span>
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed">{copy.body}</p>
        </div>

        {/* Connect button */}
        <button
          type="button"
          onClick={onSignIn}
          disabled={step === "connecting" || step === "signing" || step === "verifying"}
          className="h-12 px-5 text-sm font-medium border border-[var(--amber)]
                     bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                     hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <span>
            {step === "idle" && "connect wallet"}
            {step === "connecting" && "opening wallet picker…"}
            {step === "signing" && "sign message in wallet"}
            {step === "verifying" && "verifying signature…"}
            {step === "done" && "signed in ✓"}
            {step === "error" && "try again"}
          </span>
          <BusyIndicator step={step} />
        </button>

        {address && step !== "done" && (
          <p className="numeric text-[11px] text-[var(--fg-2)]">
            attempting: {address.slice(0, 8)}…{address.slice(-8)}
          </p>
        )}
        {err && (
          <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">{err}</p>
        )}

        {/* Helpers */}
        <div className="border-t border-[var(--rule-0)] pt-5 flex flex-col gap-3 text-[12px] text-[var(--fg-2)] leading-relaxed">
          <p>
            Pick any Stellar wallet — Freighter, Albedo, xBull, Lobstr. Sign one message.
            No transaction, no fee.
          </p>
          <p>
            New to Stellar? Grab{" "}
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--fg-1)] hover:text-[var(--fg-0)]"
            >
              Freighter
            </a>
            , switch to testnet, fund with{" "}
            <a
              href="https://friendbot.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--fg-1)] hover:text-[var(--fg-0)]"
            >
              friendbot
            </a>
            .
          </p>
        </div>
      </div>
    </LoginShell>
  );
}

/** Busy LED only — no chevron, no decorative arrow. */
function BusyIndicator({ step }: { step: Step }) {
  const busy = step === "connecting" || step === "signing" || step === "verifying";
  if (!busy) return null;
  return (
    <motion.span
      className="h-2 w-2 bg-[var(--ink-0)] inline-block"
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
    />
  );
}

/**
 * Full-screen split: brand + pattern on the left, sign-in form on the right.
 * Single-column on small screens (brand collapses to a top-strip).
 */
function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-0px)]">
      {/* LEFT — brand */}
      <aside className="relative bg-[var(--ink-1)] border-r border-[var(--rule-0)] overflow-hidden flex flex-col">
        {/* amber beacon hairline */}
        <span
          className="absolute top-0 left-0 h-px"
          style={{ background: "var(--amber)", width: "clamp(48px, 8vw, 120px)" }}
        />

        {/* Bars-mark pattern fills the panel — sits behind everything else.
            Nudged right so the marks don't crowd the brand wordmark. */}
        <div className="absolute inset-0 pointer-events-none">
          <BarsMarkPattern
            tile={64}
            opacity={0.06}
            spacing={1.1}
            offsetX={-32}
            offsetY={-28}
          />
        </div>

        {/* brand block */}
        <div className="relative flex-1 flex flex-col justify-between px-8 md:px-12 py-10">
          <Link href="/" className="flex items-center gap-3 select-none w-fit">
            <CryptBarsMark variant="amber-on-ink" size={36} />
            <span className="wordmark text-[28px] tracking-[-0.02em] text-[var(--fg-0)]">
              crypt
            </span>
          </Link>

          <div className="flex flex-col gap-4 max-w-[34rem]">
            <h1
              className="hero-display"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.4rem)" }}
            >
              Every promise
              <br />
              <span style={{ color: "var(--amber)" }}>should pay itself out.</span>
            </h1>
            <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[44ch]">
              Sign in with your Stellar wallet. We never see your keys — only that
              the address signed a one-time message.
            </p>
          </div>

          <div className="flex items-center justify-between text-[var(--fg-3)]">
            <Link href="/" className="label hover:text-[var(--fg-1)] transition-colors">
              back
            </Link>
            <Link href="/demo" className="label hover:text-[var(--fg-1)] transition-colors">
              see the demo
            </Link>
          </div>
        </div>
      </aside>

      {/* RIGHT — sign-in */}
      <section className="bg-[var(--ink-0)] flex items-center justify-center px-6 md:px-12 py-12">
        <div className="w-full max-w-[28rem]">{children}</div>
      </section>
    </main>
  );
}

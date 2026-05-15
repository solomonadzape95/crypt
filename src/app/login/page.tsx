"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { connectWallet, signLoginMessage, WalletError } from "@/lib/wallet";
import { Panel } from "@/components/Panel";
import { Wordmark } from "@/components/AppHeader";

type Step = "idle" | "connecting" | "signing" | "verifying" | "done" | "error";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/marketplace";
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.authenticated) router.replace(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router, next]);

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
      router.replace(next);
    } catch (e) {
      setStep("error");
      const msg =
        e instanceof WalletError ? e.message : e instanceof Error ? e.message : "Could not sign in.";
      setErr(msg);
    }
  }

  return (
    <LoginShell>
      <Panel label="sign in with a stellar wallet">
        <div className="px-4 py-5 flex flex-col gap-5">
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed">
            Pick any Stellar wallet — Freighter, Albedo, xBull, Lobstr. Sign one
            message to prove the address is yours. No transaction, no fee.
          </p>

          <button
            type="button"
            onClick={onSignIn}
            disabled={step === "connecting" || step === "signing" || step === "verifying"}
            className="h-11 px-5 text-sm font-medium border border-[var(--amber)]
                       bg-[var(--amber)] text-[var(--ink-0)] hover:bg-transparent
                       hover:text-[var(--amber)] transition-colors uppercase tracking-[0.12em]
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
          >
            <span>
              {step === "idle" && "connect wallet"}
              {step === "connecting" && "opening wallet picker…"}
              {step === "signing" && "sign message in wallet"}
              {step === "verifying" && "verifying signature…"}
              {step === "done" && "signed in ✓"}
              {step === "error" && "try again"}
            </span>
            <Indicator step={step} />
          </button>

          {address && step !== "done" && (
            <p className="numeric text-[11px] text-[var(--fg-2)]">
              attempting: {address.slice(0, 8)}…{address.slice(-8)}
            </p>
          )}
          {err && (
            <p className="numeric text-[11px] text-[var(--signal-fail)] break-all">{err}</p>
          )}
        </div>
      </Panel>
    </LoginShell>
  );
}

function Indicator({ step }: { step: Step }) {
  const busy = step === "connecting" || step === "signing" || step === "verifying";
  if (!busy) return <span className="text-[var(--ink-0)]">→</span>;
  return (
    <motion.span
      className="h-2 w-2 bg-[var(--ink-0)] inline-block"
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
    />
  );
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col">
      <header className="relative border-b border-[var(--rule-0)] bg-[var(--ink-1)]">
        <span
          className="absolute top-0 left-0 h-px"
          style={{ background: "var(--amber)", width: "clamp(40px, 6vw, 88px)" }}
        />
        <div className="max-w-[88rem] mx-auto w-full px-6 md:px-12 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-3">
            <Wordmark />
            <span className="label hidden sm:inline-flex">sign in</span>
          </Link>
          <Link href="/" className="label hover:text-[var(--fg-0)] transition-colors">
            ← back
          </Link>
        </div>
      </header>

      <section className="flex-1 px-6 py-16 max-w-md mx-auto w-full flex flex-col gap-8">
        {children}

        <div className="border-t border-[var(--rule-0)] pt-6 flex flex-col gap-3 text-[12px] text-[var(--fg-2)] leading-relaxed">
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
          <p>
            Funds live in a lockbox contract on Stellar — we can&apos;t take them or
            send them anywhere else.{" "}
            <Link href="/trust" className="underline text-[var(--fg-1)] hover:text-[var(--fg-0)]">
              How it works →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

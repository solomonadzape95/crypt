import Link from "next/link";
import { Wordmark } from "@/components/AppHeader";
import { BarsMarkPattern } from "@/components/brand/BarsMarkPattern";

export default function Home() {
  return (
    <main className="relative flex flex-col flex-1 min-h-0">
      {/* Brand pattern sits behind the whole page, sparse + subtle. */}
      <div className="absolute inset-0 pointer-events-none">
        <BarsMarkPattern tile={96} opacity={0.07} spacing={1.4} offsetX={64} />
      </div>

      <div className="relative z-10">
        <TopRail />
      </div>

      <section
        className="relative z-10 flex-1 px-6 md:px-12 py-12 md:py-16 max-w-[88rem] mx-auto w-full
                   grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] gap-10 lg:gap-20
                   items-center"
      >
        <div className="flex flex-col gap-8">
          <h1
            className="hero-display rise"
            style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)" }}
          >
            Every promise
            <br />
            <span style={{ color: "var(--amber)" }}>should pay itself out.</span>
          </h1>

          <p className="text-[15px] leading-relaxed text-[var(--fg-1)] max-w-[54ch] rise rise-delay-1">
            Two sides lock USDC into a contract. If the promise breaks, the
            contract pays — no claim form, no lawyer, no waiting.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-1 rise rise-delay-2">
            <Link
              href="/login?next=/subscriber"
              className="h-11 px-5 border border-[var(--amber)] bg-[var(--amber)]
                         text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                         transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                         flex items-center"
            >
              browse coverage
            </Link>
            <Link
              href="/login?next=/provider"
              className="h-11 px-5 border border-[var(--rule-0)] text-[var(--fg-0)]
                         hover:border-[var(--fg-0)] transition-colors
                         uppercase tracking-[0.12em] text-[12px] font-medium flex items-center"
            >
              i&apos;m a provider
            </Link>
            <Link
              href="/demo"
              className="h-11 px-5 text-[var(--fg-2)] hover:text-[var(--fg-0)]
                         transition-colors uppercase tracking-[0.12em] text-[12px]
                         flex items-center"
            >
              see the demo
            </Link>
          </div>
        </div>

        <aside className="lg:border-l lg:border-[var(--rule-0)] lg:pl-10 flex flex-col gap-8">
          <Spec n="01" label="lock"   value="both sides post USDC" />
          <Spec n="02" label="watch"  value="an oracle watches the trigger" />
          <Spec n="03" label="settle" value="auto-payout the moment it fires" />
        </aside>
      </section>
    </main>
  );
}

function TopRail() {
  return (
    <header className="relative border-b border-[var(--rule-0)] bg-[var(--ink-0)]">
      <span
        className="absolute top-0 left-0 h-px"
        style={{ background: "var(--amber)", width: "clamp(40px, 6vw, 88px)" }}
      />
      <div className="max-w-[88rem] mx-auto w-full pl-4 md:pl-6 pr-3 md:pr-6 h-14 flex items-stretch justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 pr-5 border-r border-[var(--rule-0)] h-14"
        >
          <Wordmark />
        </Link>
        <nav className="flex items-stretch">
          <Link
            href="/trust"
            className="hidden md:flex items-center px-4 border-l border-[var(--rule-0)] h-14
                       label hover:text-[var(--fg-0)] hover:bg-[var(--ink-2)] transition-colors"
          >
            how it works
          </Link>
          <Link
            href="/login"
            className="flex items-center px-4 border-l border-[var(--rule-0)] h-14
                       label hover:text-[var(--amber)] hover:bg-[var(--ink-2)] transition-colors"
          >
            sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Spec({
  n,
  label,
  value,
}: {
  n: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-5">
      <span className="label numeric text-[var(--fg-3)] text-[15px]">{n}</span>
      <div className="flex flex-col gap-2">
        <span className="label text-[13px]">{label}</span>
        <span className="text-[18px] text-[var(--fg-0)] leading-snug">
          {value}
        </span>
      </div>
    </div>
  );
}

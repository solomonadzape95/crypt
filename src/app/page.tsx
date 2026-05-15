import Link from "next/link";
import { Hairline, LabeledRule } from "@/components/Panel";
import { Wordmark } from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="flex flex-col flex-1">
      <TopRail />

      <section className="flex-1 px-6 md:px-12 py-16 md:py-24 max-w-[88rem] mx-auto w-full
                          grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-10 lg:gap-20">
        <div className="flex flex-col gap-10">
          <LabeledRule label="live coverage" trailing="Stellar testnet" />

          <h1
            className="display"
            style={{ fontSize: "clamp(2.4rem, 7vw, 5.5rem)" }}
          >
            your API
            <br />
            provider goes
            <br />
            <span style={{ color: "var(--amber)" }}>down at 3am.</span>
            <br />
            get the money
            <br />
            back automatically.
          </h1>

          <p className="text-[14px] leading-relaxed text-[var(--fg-1)] max-w-[58ch]">
            Locks a deposit from both you and the API operator. We watch the API. If it
            stays down past the limit, you get both deposits — paid out automatically on
            Stellar. No lawyers, no claim forms, no waiting.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login?next=/marketplace"
              className="h-12 px-6 border border-[var(--amber)] bg-[var(--amber)]
                         text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                         transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                         flex items-center"
            >
              browse coverage →
            </Link>
            <Link
              href="/login?next=/provider"
              className="h-12 px-6 border border-[var(--rule-0)] text-[var(--fg-0)]
                         hover:border-[var(--fg-0)] transition-colors
                         uppercase tracking-[0.12em] text-[12px] font-medium flex items-center"
            >
              i&apos;m a provider
            </Link>
            <Link
              href="/trust"
              className="h-12 px-6 text-[var(--fg-2)] hover:text-[var(--fg-0)]
                         transition-colors uppercase tracking-[0.12em] text-[12px] flex items-center"
            >
              how it works →
            </Link>
          </div>
        </div>

        <aside className="lg:border-l lg:border-[var(--rule-0)] lg:pl-10 flex flex-col gap-8">
          <Spec label="paid in"     value="USDC"     hint="dollar-pegged stablecoin" />
          <Spec label="settles on"  value="Stellar"  hint="fast, low-fee blockchain" />
          <Spec label="when"        value="parametric" hint="we trigger as soon as the API fails enough times in a row" />
          <Spec label="custody"     value="non-custodial" hint="funds live in an on-chain lockbox, not with us" />
          <Hairline />
          <div className="flex flex-col gap-2">
            <span className="label">built for</span>
            <p className="numeric text-[11px] text-[var(--fg-1)] leading-relaxed">
              Boundless × Trustless Work hackathon
            </p>
          </div>
        </aside>
      </section>

      <BottomRail />
    </main>
  );
}

function TopRail() {
  return (
    <header className="relative border-b border-[var(--rule-0)] bg-[var(--ink-1)]">
      <span
        className="absolute top-0 left-0 h-px"
        style={{ background: "var(--amber)", width: "clamp(40px, 6vw, 88px)" }}
      />
      <div className="max-w-[88rem] mx-auto w-full px-6 md:px-12 h-14 flex items-center justify-between gap-8">
        <Link href="/" className="flex items-baseline gap-3">
          <Wordmark />
          <span className="label hidden sm:inline-flex">automatic uptime insurance</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/trust" className="label hover:text-[var(--fg-0)] transition-colors">
            how it works
          </Link>
          <Link
            href="/login?next=/marketplace"
            className="label hover:text-[var(--amber)] transition-colors"
          >
            sign in →
          </Link>
        </nav>
      </div>
    </header>
  );
}

function BottomRail() {
  return (
    <footer className="border-t border-[var(--rule-0)] mt-auto">
      <div className="max-w-[88rem] mx-auto w-full px-6 md:px-12 h-12 flex items-center justify-between text-[var(--fg-3)]">
        <span className="label">tilt · Boundless × Trustless Work</span>
        <span className="label numeric">Stellar testnet · play money</span>
      </div>
    </footer>
  );
}

function Spec({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className="numeric text-lg text-[var(--fg-0)]">{value}</span>
      <span className="text-[11px] text-[var(--fg-2)] leading-snug">{hint}</span>
    </div>
  );
}

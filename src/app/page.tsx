import Link from "next/link";
import { Wordmark } from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="flex flex-col flex-1 min-h-0">
      <TopRail />

      <section
        className="flex-1 px-6 md:px-12 py-10 md:py-14 max-w-[88rem] mx-auto w-full
                   grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-8 lg:gap-16
                   items-center"
      >
        <div className="flex flex-col gap-6">
          <h1
            className="display"
            style={{ fontSize: "clamp(2.2rem, 6vw, 4.5rem)" }}
          >
            API goes dark.
            <br />
            <span style={{ color: "var(--amber)" }}>You get paid.</span>
          </h1>

          <p className="text-[14px] leading-relaxed text-[var(--fg-1)] max-w-[52ch]">
            Both sides lock USDC on Stellar. If the API stays down past the
            limit, the escrow pays the subscriber out automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href="/login?next=/marketplace"
              className="h-11 px-5 border border-[var(--amber)] bg-[var(--amber)]
                         text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                         transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                         flex items-center"
            >
              browse coverage →
            </Link>
            <Link
              href="/login?next=/provider"
              className="h-11 px-5 border border-[var(--rule-0)] text-[var(--fg-0)]
                         hover:border-[var(--fg-0)] transition-colors
                         uppercase tracking-[0.12em] text-[12px] font-medium flex items-center"
            >
              i&apos;m a provider
            </Link>
          </div>
        </div>

        <aside className="lg:border-l lg:border-[var(--rule-0)] lg:pl-10 flex flex-col gap-5">
          <Spec n="01" label="lock" value="both sides post USDC" />
          <Spec n="02" label="watch" value="oracle pings the API" />
          <Spec n="03" label="settle" value="auto-payout on breach" />
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
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/trust"
            className="label hover:text-[var(--fg-0)] transition-colors"
          >
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
      <div className="max-w-[88rem] mx-auto w-full px-6 md:px-12 h-11 flex items-center justify-between text-[var(--fg-3)]">
        <Link
          href="/"
          className="label hover:text-[var(--fg-1)] transition-colors"
        >
          crypt
        </Link>
        <Link
          href="/trust"
          className="label hover:text-[var(--fg-1)] transition-colors"
        >
          how it works →
        </Link>
      </div>
    </footer>
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
    <div className="flex items-baseline gap-4">
      <span className="label numeric text-[var(--fg-3)]">{n}</span>
      <div className="flex flex-col gap-1">
        <span className="label">{label}</span>
        <span className="text-[13px] text-[var(--fg-0)] leading-snug">
          {value}
        </span>
      </div>
    </div>
  );
}

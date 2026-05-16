"use client";

import Link from "next/link";
import { CryptBarsMark } from "@/components/brand/CryptBarsMark";
import { SlideDeck, type Slide } from "@/components/SlideDeck";
import { Panel, MetricRow } from "@/components/Panel";
import { HeartbeatMonitor } from "@/components/HeartbeatMonitor";
import { BarsMarkPattern } from "@/components/brand/BarsMarkPattern";
import type { CheckRow } from "@/lib/types";

/**
 * Per-slide BarsMarkPattern variations. First and last slides get the BIG
 * geometric shapes; middle slides get small accents that don't compete with
 * the panels. Each unmounts on slide change so the tile-cascade entry
 * animation re-runs every time.
 *
 * Slide 1 (intro) is a self-referential brand moment: the silhouette is the
 * crypt bars-mark (5 stacked bars at logo proportions) and each bar is
 * itself tiled with the small bars-mark pattern. Mark made of marks.
 */
// Logo bar proportions inside the 48×48 source mark — converted to %.
const LOGO_BARS = [
  { topPct: 16.27, hPct: 25.85 }, // 7.809/48, 12.408/48 — the thick top bar
  { topPct: 45.66, hPct: 9.16 },  // 21.915, 4.395
  { topPct: 58.35, hPct: 7.54 },  // 28.007, 3.619
  { topPct: 69.42, hPct: 5.93 },  // 33.323, 2.844
  { topPct: 78.88, hPct: 4.85 },  // 37.864, 2.327
];

const PATTERNS = {
  // Slide 1 — giant brand mark on the right, each bar filled with the
  // small-mark pattern. The 5 bars share the same staggerMs but each gets a
  // small base delay so the bars themselves cascade in top → bottom on
  // arrival, creating a "bars settle, then fill" effect.
  intro: (
    <div className="absolute right-0 top-0 bottom-0 w-[52%]">
      {LOGO_BARS.map((b, i) => (
        <div
          key={i}
          className="absolute left-[16%] right-[16%] overflow-hidden"
          style={{
            top: `${b.topPct}%`,
            height: `${b.hPct}%`,
            // Stagger each bar's fade-in slightly. The pattern itself also
            // cascades, so this layers two animations.
            animation: `crypt-rise 320ms cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both`,
          }}
        >
          <BarsMarkPattern
            tile={44}
            opacity={0.13}
            spacing={1.05}
            offsetX={-12}
            offsetY={-12}
            staggerMs={16}
            fadeMs={200}
          />
        </div>
      ))}
    </div>
  ),
  // Slide 2 — thin tall band on the right edge.
  lockbox: (
    <div className="absolute right-0 top-0 bottom-0 w-32">
      <BarsMarkPattern
        tile={64}
        opacity={0.07}
        spacing={1.4}
        offsetX={-20}
        offsetY={-20}
        staggerMs={26}
        fadeMs={220}
      />
    </div>
  ),
  // Slide 3 — small block in the top-left corner.
  watch: (
    <div className="absolute left-0 top-0 w-44 h-44">
      <BarsMarkPattern
        tile={56}
        opacity={0.07}
        spacing={1.25}
        offsetX={-14}
        offsetY={-14}
        staggerMs={24}
        fadeMs={200}
      />
    </div>
  ),
  // Slide 4 — two facing accent blocks (provider ↔ admin), one on each side.
  // The gap between them IS the moment-of-decision the slide is about.
  dispute: (
    <>
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-48"
        style={{
          animation: "crypt-rise 320ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <BarsMarkPattern
          tile={56}
          opacity={0.075}
          spacing={1.2}
          offsetX={-14}
          offsetY={-14}
          staggerMs={22}
          fadeMs={200}
        />
      </div>
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-48"
        style={{
          animation: "crypt-rise 320ms cubic-bezier(0.16,1,0.3,1) 100ms both",
        }}
      >
        <BarsMarkPattern
          tile={56}
          opacity={0.075}
          spacing={1.2}
          offsetX={-14}
          offsetY={-14}
          staggerMs={22}
          fadeMs={200}
        />
      </div>
    </>
  ),
  // Slide 5 — wide thin band along the bottom.
  payout: (
    <div className="absolute left-0 right-0 bottom-0 h-28">
      <BarsMarkPattern
        tile={48}
        opacity={0.06}
        spacing={1.35}
        offsetX={-12}
        offsetY={-12}
        staggerMs={18}
        fadeMs={200}
      />
    </div>
  ),
  // Slide 5 — three stair-step blocks descending from the top-right corner.
  // Discrete blocks (rather than one continuous shape) make the blocky
  // aesthetic obvious. Each block animates the bar cascade independently.
  cta: (
    <>
      <div
        className="absolute right-0 top-0 w-[42%] h-[36%]"
        style={{
          animation: "crypt-rise 320ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <BarsMarkPattern
          tile={80}
          opacity={0.10}
          spacing={1.05}
          offsetX={-18}
          offsetY={-18}
          staggerMs={20}
          fadeMs={220}
        />
      </div>
      <div
        className="absolute right-[16%] top-[42%] w-[32%] h-[26%]"
        style={{
          animation: "crypt-rise 320ms cubic-bezier(0.16,1,0.3,1) 90ms both",
        }}
      >
        <BarsMarkPattern
          tile={64}
          opacity={0.085}
          spacing={1.15}
          offsetX={-14}
          offsetY={-14}
          staggerMs={22}
          fadeMs={200}
        />
      </div>
      <div
        className="absolute right-[32%] top-[74%] w-[24%] h-[22%]"
        style={{
          animation: "crypt-rise 320ms cubic-bezier(0.16,1,0.3,1) 180ms both",
        }}
      >
        <BarsMarkPattern
          tile={52}
          opacity={0.075}
          spacing={1.2}
          offsetX={-12}
          offsetY={-12}
          staggerMs={24}
          fadeMs={200}
        />
      </div>
    </>
  ),
};

export default function DemoPage() {
  const slides: Slide[] = [
    {
      id: "intro",
      eyebrow: "what crypt is",
      pattern: PATTERNS.intro,
      body: (
        <div className="flex flex-col items-start gap-6">
          <div className="flex items-center gap-4 rise">
            <CryptBarsMark variant="amber-on-ink" size={56} />
            <span className="wordmark text-[44px] tracking-[-0.02em] text-[var(--fg-0)]">
              crypt
            </span>
          </div>
          <h1
            className="hero-display rise rise-delay-1"
            style={{ fontSize: "clamp(2.4rem, 6vw, 4.4rem)" }}
          >
            Promises that
            <br />
            <span style={{ color: "var(--amber)" }}>pay themselves out.</span>
          </h1>
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-[60ch] rise rise-delay-2">
            Two parties lock USDC into a contract. If the promise breaks, the
            contract pays — no claim form, no lawyer, no waiting.
          </p>
        </div>
      ),
    },
    {
      id: "lockbox",
      eyebrow: "01 — the two-sided lockbox",
      pattern: PATTERNS.lockbox,
      body: (
        <div className="flex flex-col gap-6">
          <h2
            className="hero-display"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            Both sides post USDC.
          </h2>
          <MockTwoSidedVault />
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[64ch]">
            The lockbox is a Trustless Work escrow on Stellar. Neither side can
            grab the funds — only the contract releases them, and only when the
            trigger fires.
          </p>
        </div>
      ),
    },
    {
      id: "watch",
      eyebrow: "02 — the watch",
      pattern: PATTERNS.watch,
      body: (
        <div className="flex flex-col gap-6">
          <h2
            className="hero-display"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            An oracle watches the trigger.
          </h2>
          <HeartbeatMonitor checks={mockChecks()} />
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[64ch]">
            A cheap, frequent ping. Three failures in a row and the contract
            trips. APIs are the demo case — the same wire works for any
            trigger you can express programmatically.
          </p>
        </div>
      ),
    },
    {
      id: "dispute",
      eyebrow: "03 — the challenge window",
      pattern: PATTERNS.dispute,
      body: (
        <div className="flex flex-col gap-6">
          <h2
            className="hero-display"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            5 minutes to challenge.
          </h2>
          <MockDisputePanel />
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[64ch]">
            When the watch trips, the contract pauses for 5 minutes. The
            provider can challenge the call with evidence — a status-page
            snapshot, a monitoring graph, an internal log. An admin reviews
            and rules. No challenge, no problem: payout fires automatically
            when the window closes.
          </p>
        </div>
      ),
    },
    {
      id: "payout",
      eyebrow: "04 — auto-payout",
      pattern: PATTERNS.payout,
      body: (
        <div className="flex flex-col gap-6">
          <h2
            className="hero-display"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            Settled on Stellar in seconds.
          </h2>
          <Panel label="paid out" trailing="settled on Stellar">
            <div className="px-4 py-5 flex flex-col gap-4">
              <div className="flex items-end justify-between">
                <span
                  className="numeric font-medium tracking-tight"
                  style={{
                    fontSize: "2.5rem",
                    color: "var(--signal-ok)",
                    lineHeight: 1,
                  }}
                >
                  6.00
                </span>
                <span className="label text-[var(--signal-ok)]">USDC sent</span>
              </div>
              <div className="border-t border-[var(--rule-0)] pt-3 flex flex-col gap-2">
                <span className="label">paid to</span>
                <span className="numeric text-[12px] text-[var(--fg-0)] break-all">
                  GBPGSCXLCTWVJJIJSBEOTCIZE2LKA2IX3QHJ4PBVV6A63V7XD3GGNFMB
                </span>
              </div>
            </div>
          </Panel>
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[64ch]">
            No claim form. No human in the loop. Both deposits land in the
            subscriber's wallet within a minute of the breach.
          </p>
        </div>
      ),
    },
    {
      id: "cta",
      eyebrow: "ready to try it",
      pattern: PATTERNS.cta,
      body: (
        <div className="flex flex-col gap-8 items-start">
          <h2
            className="hero-display"
            style={{ fontSize: "clamp(2.4rem, 6vw, 4.4rem)" }}
          >
            Lock the promise.
            <br />
            <span style={{ color: "var(--amber)" }}>Walk away.</span>
          </h2>
          <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-[58ch]">
            Sign in with any Stellar wallet. Testnet — play money, real chain.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login?next=/subscriber"
              className="h-11 px-5 border border-[var(--amber)] bg-[var(--amber)]
                         text-[var(--ink-0)] hover:bg-transparent hover:text-[var(--amber)]
                         transition-colors uppercase tracking-[0.12em] text-[12px] font-medium
                         flex items-center"
            >
              sign in as subscriber
            </Link>
            <Link
              href="/login?next=/provider"
              className="h-11 px-5 border border-[var(--rule-0)] text-[var(--fg-0)]
                         hover:border-[var(--fg-0)] transition-colors
                         uppercase tracking-[0.12em] text-[12px] font-medium flex items-center"
            >
              sign in as provider
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="flex-1 flex flex-col min-h-[100vh]">
      <header className="relative border-b border-[var(--rule-0)] bg-[var(--ink-0)]">
        <span
          className="absolute top-0 left-0 h-px"
          style={{
            background: "var(--amber)",
            width: "clamp(40px, 6vw, 88px)",
          }}
        />
        <div className="max-w-[88rem] mx-auto w-full pl-4 md:pl-6 pr-3 md:pr-6 h-14 flex items-stretch justify-between">
          <div className="flex items-stretch min-w-0">
            <Link
              href="/"
              className="flex items-center gap-3 pr-5 border-r border-[var(--rule-0)] h-14 select-none"
            >
              <CryptBarsMark variant="amber-on-ink" size={28} />
              <span className="wordmark text-[20px] tracking-[-0.02em] text-[var(--fg-0)]">
                crypt
              </span>
            </Link>
            <span className="hidden sm:flex items-center px-4 border-r border-[var(--rule-0)] h-14 label text-[var(--fg-3)]">
              demo
            </span>
          </div>
          <nav className="flex items-stretch">
            <Link
              href="/"
              className="flex items-center px-4 border-l border-[var(--rule-0)] h-14
                         label hover:text-[var(--fg-0)] hover:bg-[var(--ink-2)] transition-colors"
            >
              back
            </Link>
          </nav>
        </div>
      </header>

      <SlideDeck slides={slides} />
    </main>
  );
}

function MockTwoSidedVault() {
  return (
    <section className="border border-[var(--rule-0)] bg-[var(--ink-1)]">
      <header className="flex items-center justify-between px-4 h-9 border-b border-[var(--rule-0)] bg-[var(--ink-2)]">
        <span className="label">deposits</span>
        <span className="label text-[var(--fg-3)]">
          provider ✓ / subscriber ✓ — locked
        </span>
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <MockPillar label="provider deposit" amount="1.00" />
        <div className="flex flex-col items-center justify-center px-2 border-x border-[var(--rule-0)] bg-[var(--ink-2)] min-w-[10rem]">
          <span className="label">watching</span>
          <span className="text-2xl numeric text-[var(--fg-2)]">⟷</span>
        </div>
        <MockPillar label="subscriber deposit" amount="5.00" />
      </div>
    </section>
  );
}

function MockDisputePanel() {
  return (
    <section className="border border-[var(--rule-0)] bg-[var(--ink-1)]">
      <header className="flex items-center justify-between px-4 h-9 border-b border-[var(--rule-0)] bg-[var(--ink-2)]">
        <span className="label">dispute window open</span>
        <span className="label numeric text-[var(--amber)]">closes in 04:21</span>
      </header>
      <div className="px-4 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4">
        <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
          The oracle reported a breach. If you believe this is wrong (status
          page shows the API was up, our checker hit a network blip), challenge
          it before the window closes.
        </p>
        <div className="flex gap-2">
          <span
            className="h-9 px-4 border border-[var(--amber)] bg-[var(--amber)]
                       text-[var(--ink-0)] uppercase tracking-[0.12em] text-[12px]
                       font-medium flex items-center"
          >
            challenge breach
          </span>
          <span className="label flex items-center text-[var(--fg-3)]">
            or do nothing
          </span>
        </div>
      </div>
    </section>
  );
}

function MockPillar({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="relative p-6 flex flex-col gap-2">
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "var(--amber)" }}
      />
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="label text-[var(--amber)]">● locked</span>
      </div>
      <span
        className="numeric font-medium tracking-tight text-4xl mt-2"
        style={{ color: "var(--fg-0)" }}
      >
        {amount}
        <span className="text-sm text-[var(--fg-2)]"> USDC</span>
      </span>
    </div>
  );
}

function mockChecks(): CheckRow[] {
  // 12 healthy ticks then 3 reds, newest-first (matches the API).
  const now = Date.now();
  const out: CheckRow[] = [];
  for (let i = 0; i < 3; i++) {
    out.push({
      id: 1000 + i,
      vault_id: "demo",
      ts: new Date(now - i * 15_000).toISOString(),
      signal: i === 0 ? "timeout" : "error",
      status_code: i === 0 ? null : 502,
      response_ms: i === 0 ? 5000 : 380,
    });
  }
  for (let i = 0; i < 12; i++) {
    out.push({
      id: 800 + i,
      vault_id: "demo",
      ts: new Date(now - (i + 3) * 15_000).toISOString(),
      signal: "healthy",
      status_code: 200,
      response_ms: 90 + Math.round(Math.sin(i * 0.7) * 80 + Math.random() * 60),
    });
  }
  return out;
}


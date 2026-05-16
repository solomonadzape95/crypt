import Link from "next/link";
import { Panel, MetricRow, LabeledRule } from "@/components/Panel";
import { Wordmark } from "@/components/AppHeader";

export default function TrustPage() {
  return (
    <main className="flex-1 flex flex-col">
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
              className="flex items-center gap-3 pr-5 border-r border-[var(--rule-0)] h-14"
            >
              <Wordmark />
            </Link>
            <span className="hidden sm:flex items-center px-4 border-r border-[var(--rule-0)] h-14 label text-[var(--fg-0)]">
              how it works
            </span>
          </div>
          <nav className="flex items-stretch">
            <Link
              href="/subscriber"
              className="flex items-center px-4 border-l border-[var(--rule-0)] h-14
                         label hover:text-[var(--fg-0)] hover:bg-[var(--ink-2)] transition-colors"
            >
              dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-3xl mx-auto w-full px-6 py-16 flex flex-col gap-12">
        <div className="flex flex-col gap-3 rise">
          <span className="label">how this stays safe</span>
          <h1
            className="hero-display"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)" }}
          >
            how crypt works.
          </h1>
          <p className="text-[15px] text-[var(--fg-1)] leading-relaxed max-w-[68ch]">
            Two people put money into a lockbox on Stellar. A bot watches an
            API. If the API stays down past the limit, the money goes to the
            subscriber. If it stays up, the money goes to the provider. Nobody
            decides — the contract does, based on what the bot saw.
          </p>
        </div>

        <LabeledRule label="01 · what you sign" />
        <Panel label="signatures">
          <Step
            n="01"
            head="sign in"
            body="One message that proves you control your wallet address. No transaction, no fee."
          />
          <Step
            n="02"
            head="deposit"
            body="One transaction per side. Locks your USDC into a lockbox contract on Stellar testnet."
          />
          <Step
            n="03"
            head="watch"
            body="After both sides deposit, no more wallet prompts. The contract handles payout."
          />
        </Panel>

        <LabeledRule label="02 · what the bot does" />
        <Panel label="check cycle">
          <Bullet text="Calls the API at the interval the provider chose (every 15s, 60s, 5min, etc.) with a 5-second timeout." />
          <Bullet text="If it answers normally — log a healthy check, reset the failure counter." />
          <Bullet text="If it errors or times out — log a failed check, increment the counter." />
          <Bullet text="When the counter hits the failure limit (3 by default), the contract pays the subscriber both deposits — automatically." />
        </Panel>

        <LabeledRule label="03 · what we can and can't do" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel label="we can">
            <MetricRow label="run the API check" value="yes" />
            <MetricRow label="declare a failure" value="yes" />
            <MetricRow label="trigger the payout" value="yes" />
          </Panel>
          <Panel label="we can't">
            <MetricRow label="take more than the deposits" value="no" />
            <MetricRow label="send funds anywhere else" value="no" />
            <MetricRow label="touch your wallet's keys" value="no" />
          </Panel>
        </div>
        <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[68ch]">
          The amounts are locked into the contract at deposit time. The contract
          only knows two addresses — the provider's payout wallet and the
          subscriber's payout wallet. We can decide which one wins, but we can't
          change either address or take a cut.
        </p>

        <LabeledRule label="04 · what's next" />
        <p className="text-[14px] text-[var(--fg-1)] leading-relaxed max-w-[68ch]">
          Today we run the API check ourselves — you have to trust we report
          honestly. Next we'll have multiple independent checkers agreeing
          before a payout triggers. After that, a math-based proof that the
          checkers agreed, verified by the contract itself. The goal: nobody —
          us included — can decide who gets paid. The math does.
        </p>
      </section>
    </main>
  );
}

function Step({
  n,
  head,
  body,
}: {
  n: string;
  head: string;
  body: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 px-4 py-4 border-b border-[var(--rule-0)] last:border-b-0">
      <span className="label text-[var(--amber)] numeric self-start mt-[2px]">
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] text-[var(--fg-0)]">{head}</h3>
        <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <p className="text-[13px] text-[var(--fg-1)] leading-relaxed px-4 py-3 border-b border-[var(--rule-0)] last:border-b-0">
      {text}
    </p>
  );
}

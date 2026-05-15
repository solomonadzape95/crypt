import type { ReactNode } from "react";

type PanelProps = {
  label?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Operator-console panel: hairline border, optional tabular label strip up top.
 * The label strip is the recognisable chrome of every section — uppercase
 * mono, tracked, with a thin rule under it.
 */
export function Panel({ label, trailing, children, className }: PanelProps) {
  return (
    <section
      className={[
        "border border-[var(--rule-0)] bg-[var(--ink-1)] flex flex-col",
        className ?? "",
      ].join(" ")}
    >
      {label && (
        <header className="flex items-center justify-between gap-3 px-4 h-9 border-b border-[var(--rule-0)] bg-[var(--ink-2)]">
          <span className="label">{label}</span>
          {trailing && <span className="label text-[var(--fg-1)]">{trailing}</span>}
        </header>
      )}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/**
 * Two-column metric row with a mono label on the left and a numeric value on
 * the right. Drop-in inside a Panel body for stat dumps.
 */
export function MetricRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: "amber" | "ok" | "fail";
}) {
  const color =
    accent === "amber"
      ? "var(--amber)"
      : accent === "ok"
        ? "var(--signal-ok)"
        : accent === "fail"
          ? "var(--signal-fail)"
          : "var(--fg-0)";
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-[var(--rule-0)] last:border-b-0">
      <span className="label">{label}</span>
      <span className="numeric text-sm" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/** Horizontal full-bleed hairline rule. */
export function Hairline({ className }: { className?: string }) {
  return (
    <div
      className={["h-px w-full bg-[var(--rule-0)]", className ?? ""].join(" ")}
    />
  );
}

/**
 * Section divider with an inline label — a thin horizontal rule with the
 * label sitting on it, used between major regions of a page.
 */
export function LabeledRule({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-[var(--rule-0)]" />
      {trailing && <span className="label text-[var(--fg-1)]">{trailing}</span>}
    </div>
  );
}

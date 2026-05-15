"use client";

import {
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CheckRow, CheckSignal } from "@/lib/types";
import { Panel } from "./Panel";

type Props = {
  checks: CheckRow[];
};

const SIGNAL_COLOR: Record<CheckSignal, string> = {
  healthy:     "var(--signal-ok)",
  error:       "var(--signal-fail)",
  timeout:     "var(--signal-fail)",
  manual_kill: "var(--amber)",
};

const SLOW_MS = 1000; // a "still healthy, but feeling sluggish" reference line

/**
 * One bar per check, colored by signal, height = response_ms (failures plotted
 * at SLOW_MS so they're visible without skewing the scale). A dashed reference
 * line marks the slow threshold. Stats strip in the trailing slot tells you
 * the spread at a glance without hovering.
 */
export function HeartbeatMonitor({ checks }: Props) {
  // recharts wants chronological order (oldest → newest); the DB returns desc.
  const ordered = checks.slice().reverse();
  const data = ordered.map((c) => {
    const isFail = c.signal !== "healthy";
    const ms = c.response_ms ?? 0;
    return {
      t: c.ts,
      label: new Date(c.ts).toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      ms,
      // Failures plotted at SLOW_MS so they show up against a healthy scale.
      // The color does the heavy lifting for signal type.
      bar: isFail ? SLOW_MS : ms,
      signal: c.signal,
      status: c.status_code,
    };
  });

  const healthyMs = ordered
    .filter((c) => c.signal === "healthy" && typeof c.response_ms === "number")
    .map((c) => c.response_ms as number);
  const min = healthyMs.length ? Math.min(...healthyMs) : null;
  const max = healthyMs.length ? Math.max(...healthyMs) : null;
  const avg = healthyMs.length
    ? Math.round(healthyMs.reduce((a, b) => a + b, 0) / healthyMs.length)
    : null;
  const healthyCount = ordered.filter((c) => c.signal === "healthy").length;

  // y-axis ceiling: at least 1.5× SLOW_MS so the reference line sits nicely.
  const dataMax = Math.max(...data.map((d) => d.bar), 0);
  const yMax = Math.max(SLOW_MS * 1.5, dataMax * 1.2);

  return (
    <Panel
      label="heartbeat"
      trailing={<HeartbeatStats min={min} avg={avg} max={max} total={ordered.length} healthy={healthyCount} />}
    >
      <div className="px-2 pt-3 pb-2">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 4 }} barCategoryGap={2}>
            <XAxis dataKey="label" hide />
            <YAxis domain={[0, yMax]} hide />
            <ReferenceLine
              y={SLOW_MS}
              stroke="var(--rule-1)"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: `${SLOW_MS}ms`,
                position: "right",
                fill: "var(--fg-3)",
                fontSize: 10,
                fontFamily: "var(--font-jb)",
              }}
            />
            <Bar dataKey="bar" radius={0} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={SIGNAL_COLOR[d.signal as CheckSignal]}
                  fillOpacity={d.signal === "healthy" ? 0.9 : 1}
                />
              ))}
            </Bar>
            <Tooltip
              cursor={{ fill: "var(--ink-2)", fillOpacity: 0.6 }}
              content={<HeartbeatTooltip />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

type HeartbeatDatum = {
  label: string;
  ms: number;
  signal: CheckSignal;
  status: number | null;
};

function HeartbeatTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HeartbeatDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = SIGNAL_COLOR[d.signal];
  const line =
    d.signal === "healthy" ? `${d.ms}ms · ${d.status ?? "—"}` : d.signal.replace("_", " ");
  return (
    <div
      style={{
        background: "var(--ink-0)",
        border: "1px solid var(--rule-0)",
        borderRadius: 0,
        fontSize: 11,
        padding: "6px 10px",
        fontFamily: "var(--font-jb), ui-monospace, monospace",
      }}
    >
      <div style={{ color: "var(--fg-3)", marginBottom: 2 }}>{d.label}</div>
      <div style={{ color }}>{line}</div>
    </div>
  );
}

function HeartbeatStats({
  min,
  avg,
  max,
  total,
  healthy,
}: {
  min: number | null;
  avg: number | null;
  max: number | null;
  total: number;
  healthy: number;
}) {
  if (total === 0) {
    return <span className="text-[var(--fg-3)]">no pings yet</span>;
  }
  const failCount = total - healthy;
  return (
    <span className="flex items-center gap-3 text-[var(--fg-1)]">
      {avg != null && (
        <span>
          <span className="text-[var(--fg-3)]">avg</span> {avg}ms
        </span>
      )}
      {min != null && max != null && (
        <span className="text-[var(--fg-3)]">
          {min}–{max}ms
        </span>
      )}
      <span style={{ color: failCount > 0 ? "var(--signal-fail)" : "var(--signal-ok)" }}>
        {healthy}/{total} ok
      </span>
    </span>
  );
}

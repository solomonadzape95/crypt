"use client";

import {
  Area,
  ComposedChart,
  Line,
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
  /**
   * Hint that the oracle has stopped probing (e.g. settle in flight). When
   * true, the panel header switches to the "paused" state instead of
   * counting incoming pings.
   */
  paused?: boolean;
  /**
   * Vault is fully closed (disbursed or expired). Dims the chart and shows
   * a "settled" trailing label so the panel reads as historic, not live.
   */
  settled?: boolean;
};

const SIGNAL_COLOR: Record<CheckSignal, string> = {
  healthy:     "var(--signal-ok)",
  error:       "var(--signal-fail)",
  timeout:     "var(--signal-fail)",
  manual_kill: "var(--amber)",
};

const SLOW_MS = 1000;

export function HeartbeatMonitor({ checks, paused = false, settled = false }: Props) {
  const ordered = checks.slice().reverse();
  const data: HeartbeatDatum[] = ordered.map((c) => ({
    label: new Date(c.ts).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    // Failures plot at SLOW_MS so they're visible against a healthy y-scale,
    // and the dot color tells the real story.
    ms: c.signal === "healthy" ? c.response_ms ?? 0 : SLOW_MS,
    signal: c.signal,
    status: c.status_code,
  }));

  const healthyMs = ordered
    .filter((c) => c.signal === "healthy" && typeof c.response_ms === "number")
    .map((c) => c.response_ms as number);
  const min = healthyMs.length ? Math.min(...healthyMs) : null;
  const max = healthyMs.length ? Math.max(...healthyMs) : null;
  const avg = healthyMs.length
    ? Math.round(healthyMs.reduce((a, b) => a + b, 0) / healthyMs.length)
    : null;
  const healthyCount = ordered.filter((c) => c.signal === "healthy").length;

  const dataMax = data.reduce((m, d) => Math.max(m, d.ms), 0);
  const yMax = Math.max(SLOW_MS * 1.5, dataMax * 1.2);

  return (
    <Panel
      label="heartbeat"
      trailing={
        <HeartbeatStats
          min={min}
          avg={avg}
          max={max}
          total={ordered.length}
          healthy={healthyCount}
          paused={paused}
          settled={settled}
        />
      }
    >
      <div
        className="px-2 pt-3 pb-2 transition-opacity"
        style={{ opacity: settled ? 0.45 : 1 }}
      >
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 8, left: 8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="heartbeat-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="var(--amber)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
              </linearGradient>
            </defs>

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
                fontFamily: "var(--font-dm)",
              }}
            />

            {/* Filled amber underlay — purely decorative, hugs the line. */}
            <Area
              type="monotone"
              dataKey="ms"
              stroke="none"
              fill="url(#heartbeat-fill)"
              isAnimationActive={false}
            />

            {/* Main line — thin amber, with a per-point colored dot driven by
             * the row's signal so failures pop without breaking the line. */}
            <Line
              type="monotone"
              dataKey="ms"
              stroke="var(--amber)"
              strokeWidth={1.5}
              isAnimationActive={false}
              dot={renderDot}
              activeDot={renderActiveDot}
            />

            <Tooltip
              cursor={{ stroke: "var(--rule-1)", strokeDasharray: "2 2" }}
              content={<HeartbeatTooltip />}
            />
          </ComposedChart>
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

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: HeartbeatDatum;
};

function renderDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={2.25}
      fill={SIGNAL_COLOR[payload.signal]}
      stroke="none"
    />
  );
}

function renderActiveDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={SIGNAL_COLOR[payload.signal]}
      stroke="var(--ink-0)"
      strokeWidth={1.5}
    />
  );
}

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
    d.signal === "healthy"
      ? `${d.ms}ms · ${d.status ?? "—"}`
      : d.signal.replace("_", " ");
  return (
    <div
      style={{
        background: "var(--ink-0)",
        border: "1px solid var(--rule-0)",
        borderRadius: 0,
        fontSize: 11,
        padding: "6px 10px",
        fontFamily: "var(--font-dm), ui-monospace, monospace",
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
  paused,
  settled,
}: {
  min: number | null;
  avg: number | null;
  max: number | null;
  total: number;
  healthy: number;
  paused: boolean;
  settled: boolean;
}) {
  if (settled) {
    // Once the vault closes, stats become historic and the panel reads
    // "settled". Keep the ok-count visible as a quick recap.
    if (total === 0) {
      return <span className="text-[var(--fg-3)]">● settled · no pings</span>;
    }
    return (
      <span className="flex items-center gap-3 text-[var(--fg-2)]">
        <span className="text-[var(--fg-3)]">{healthy}/{total} ok</span>
        <span className="text-[var(--amber)]">● settled</span>
      </span>
    );
  }
  if (total === 0) {
    return (
      <span className="text-[var(--fg-3)]">
        {paused ? "oracle paused" : "no pings yet"}
      </span>
    );
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
      {paused && (
        <span className="text-[var(--amber)]">· paused — settling</span>
      )}
    </span>
  );
}

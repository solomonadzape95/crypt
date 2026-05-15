"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { CheckRow } from "@/lib/types";
import { Panel } from "./Panel";

type Props = {
  checks: CheckRow[];
};

export function HeartbeatMonitor({ checks }: Props) {
  // recharts wants chronological order (oldest → newest); the DB returns desc.
  const data = checks
    .slice()
    .reverse()
    .map((c) => ({
      t: new Date(c.ts).toLocaleTimeString(),
      ms: c.signal === "healthy" ? c.response_ms ?? 0 : 0,
      signal: c.signal,
    }));

  const latest = checks[0]?.signal ?? "healthy";
  const stroke =
    latest === "healthy" ? "var(--signal-ok)" : "var(--signal-fail)";
  const lastMs = checks[0]?.response_ms;

  return (
    <Panel
      label="heartbeat · response_ms"
      trailing={`${checks.length} pings${lastMs != null ? ` · last ${lastMs}ms` : ""}`}
    >
      <div className="px-2 pt-2 pb-1">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <Line
              type="linear"
              dataKey="ms"
              stroke={stroke}
              strokeWidth={1.5}
              dot={{ fill: stroke, r: 1.5, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, "dataMax + 100"]} hide />
            <Tooltip
              contentStyle={{
                background: "var(--ink-0)",
                border: "1px solid var(--rule-0)",
                borderRadius: 0,
                fontSize: 11,
                fontFamily: "var(--font-jetbrains)",
                padding: "4px 8px",
              }}
              labelStyle={{ color: "var(--fg-2)", fontFamily: "var(--font-jetbrains)" }}
              cursor={{ stroke: "var(--rule-1)", strokeDasharray: "2 2" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CheckRow } from "@/lib/types";
import { Panel } from "./Panel";

const ICON: Record<string, { glyph: string; color: string }> = {
  healthy:     { glyph: "OK", color: "var(--signal-ok)" },
  error:       { glyph: "ER", color: "var(--signal-fail)" },
  timeout:     { glyph: "TO", color: "var(--signal-fail)" },
  manual_kill: { glyph: "KL", color: "var(--signal-fail)" },
};

export function IncidentLog({ checks }: { checks: CheckRow[] }) {
  return (
    <Panel label="incident log" trailing={`${checks.length} rows`}>
      {checks.length === 0 ? (
        <p className="label px-4 py-6 text-[var(--fg-3)]">no pings yet · awaiting first tick</p>
      ) : (
        <ul className="flex flex-col max-h-72 overflow-y-auto">
          <AnimatePresence initial={false}>
            {checks.map((c) => {
              const icon = ICON[c.signal] ?? { glyph: "?", color: "var(--fg-3)" };
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="grid grid-cols-[2rem_1fr_3.5rem_4rem_5rem] items-center
                             gap-3 px-4 py-2 border-b border-[var(--rule-0)] last:border-b-0
                             text-[11px] numeric"
                >
                  <span
                    className="font-medium"
                    style={{ color: icon.color, letterSpacing: "0.1em" }}
                  >
                    {icon.glyph}
                  </span>
                  <span className="text-[var(--fg-0)] capitalize">
                    {c.signal.replace("_", " ")}
                  </span>
                  <span className="text-[var(--fg-2)] text-right">
                    {c.status_code ?? "—"}
                  </span>
                  <span className="text-[var(--fg-2)] text-right">
                    {c.response_ms != null ? `${c.response_ms}ms` : "—"}
                  </span>
                  <span className="text-[var(--fg-3)] text-right">
                    {new Date(c.ts).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  );
}

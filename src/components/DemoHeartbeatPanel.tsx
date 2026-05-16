"use client";

import { useEffect, useState } from "react";
import { Panel } from "./Panel";

/**
 * Provider-side toggle for the demo heartbeat endpoint at
 * /api/demo/heartbeat. Use this on prod walkthroughs: paste the URL into a
 * listing's API URL field, subscribe, then flip this to "killed" to
 * trigger a breach in real time.
 */
export function DemoHeartbeatPanel() {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/heartbeat")
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { alive?: boolean };
        return body.alive ?? r.ok;
      })
      .then((v) => {
        if (!cancelled) setAlive(v);
      })
      .catch(() => {
        if (!cancelled) setAlive(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (alive == null || pending) return;
    setPending(true);
    try {
      const r = await fetch("/api/demo/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alive: !alive }),
      });
      if (!r.ok) throw new Error(await r.text());
      const body = (await r.json()) as { alive: boolean };
      setAlive(body.alive);
    } finally {
      setPending(false);
    }
  }

  const trailing =
    alive == null ? "checking…" : alive ? "● alive · 200" : "● killed · 503";

  return (
    <Panel label="demo heartbeat" trailing={trailing}>
      <div className="px-4 py-4 flex flex-col gap-3">
        <p className="text-[13px] text-[var(--fg-1)] leading-relaxed">
          Paste{" "}
          <span className="numeric text-[var(--amber)]">
            /api/demo/heartbeat
          </span>{" "}
          into a listing&apos;s API URL when you create it, then flip this
          toggle during the walkthrough to trigger a breach live.
        </p>
        <button
          type="button"
          onClick={toggle}
          disabled={alive == null || pending}
          className="h-10 px-4 border w-fit uppercase tracking-[0.12em] text-[12px]
                     font-medium transition-colors disabled:opacity-50"
          style={{
            borderColor: alive ? "var(--signal-fail)" : "var(--amber)",
            background: alive ? "transparent" : "var(--amber)",
            color: alive ? "var(--signal-fail)" : "var(--ink-0)",
          }}
        >
          {pending ? "flipping…" : alive ? "kill heartbeat" : "revive heartbeat"}
        </button>
      </div>
    </Panel>
  );
}

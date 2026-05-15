"use client";

import { useState } from "react";

type Props = {
  vaultId: string;
  active: boolean;
  disabled?: boolean;
  onToggled: (active: boolean) => void;
};

export function KillSwitch({ vaultId, active, disabled, onToggled }: Props) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (disabled) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vault/${vaultId}/kill-toggle`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onToggled(Boolean(data.kill_active));
      }
    } finally {
      setBusy(false);
    }
  }

  const color = active ? "var(--signal-fail)" : "var(--amber)";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || disabled}
      className="h-11 px-5 text-sm font-medium border transition-colors disabled:opacity-40
                 uppercase tracking-[0.12em]"
      style={{
        borderColor: color,
        color: active ? "var(--ink-0)" : color,
        background: active ? color : "transparent",
      }}
    >
      {active ? "● armed · cancel" : "○ trigger the demo"}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  address: string;
};

/**
 * Header wallet cell: click to open a dropdown with the full address (copy),
 * a profile link, and sign out. Sits in the same border grid as the other
 * header cells — no rounding, no shadow.
 */
export function WalletMenu({ address }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard blocked; silent — the user can long-press to copy
    }
  }

  async function onLogout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const short = `${address.slice(0, 4)}…${address.slice(-4)}`;

  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-4 border-l border-[var(--rule-0)] h-14
                   numeric text-[11px] text-[var(--fg-1)]
                   hover:bg-[var(--ink-2)] hover:text-[var(--fg-0)] transition-colors"
      >
        <span className="text-[var(--fg-3)]">wallet</span>
        <span>{short}</span>
        <span
          className="text-[10px] text-[var(--fg-3)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 min-w-[18rem]
                     border border-[var(--rule-0)] bg-[var(--ink-1)]
                     shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          <button
            type="button"
            onClick={copyAddress}
            className="w-full text-left px-4 py-3 border-b border-[var(--rule-0)]
                       hover:bg-[var(--ink-2)] transition-colors flex flex-col gap-1"
          >
            <span className="label flex items-center justify-between">
              <span>wallet address</span>
              <span className="text-[var(--amber)]">
                {copied ? "copied ✓" : "copy"}
              </span>
            </span>
            <span className="numeric text-[11px] text-[var(--fg-0)] break-all">
              {address}
            </span>
          </button>

          <Link
            href="/subscriber"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="block px-4 py-3 border-b border-[var(--rule-0)]
                       label hover:bg-[var(--ink-2)] hover:text-[var(--fg-0)]
                       transition-colors"
          >
            subscriber dashboard
          </Link>

          <Link
            href="/provider"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="block px-4 py-3 border-b border-[var(--rule-0)]
                       label hover:bg-[var(--ink-2)] hover:text-[var(--fg-0)]
                       transition-colors"
          >
            provider dashboard
          </Link>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="block px-4 py-3 border-b border-[var(--rule-0)]
                       label hover:bg-[var(--ink-2)] hover:text-[var(--fg-0)]
                       transition-colors"
          >
            profile
          </Link>

          <button
            type="button"
            onClick={onLogout}
            role="menuitem"
            className="w-full text-left px-4 py-3
                       label hover:bg-[var(--ink-2)] hover:text-[var(--signal-fail)]
                       transition-colors"
          >
            sign out
          </button>
        </div>
      )}
    </div>
  );
}

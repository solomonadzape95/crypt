"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Role = "provider" | "subscriber";

type Item = { href: string; label: string; hint?: string };

const PROVIDER_ITEMS: Item[] = [
  { href: "/provider", label: "your offers", hint: "the listings you publish" },
  { href: "/provider/listings/new", label: "new offer", hint: "publish coverage" },
  { href: "/vaults", label: "active coverage", hint: "vaults watching your APIs" },
  { href: "/marketplace", label: "marketplace", hint: "browse other listings" },
  { href: "/demo", label: "demo", hint: "walkthrough of the flow" },
];

const SUBSCRIBER_ITEMS: Item[] = [
  { href: "/subscriber", label: "your coverage", hint: "vaults you've subscribed to" },
  { href: "/marketplace", label: "marketplace", hint: "find APIs to cover" },
  { href: "/vaults", label: "all vaults", hint: "everything you're a party to" },
  { href: "/demo", label: "demo", hint: "walkthrough of the flow" },
];

/**
 * Floating role-aware nav. Always visible at bottom-right when signed in.
 * Opens a sheet with the pages relevant to the role; tap-outside / Esc
 * closes. On mobile the trigger sits above the safe-area inset; the sheet
 * stretches near-full-width so labels never wrap awkwardly.
 *
 * Why floating (not in TopRail): the marketplace, vault, and proof pages
 * each have bespoke headers, so a shared nav cell would have to thread
 * through five layouts. Bolting it to the body keeps the surface stable
 * and gets us a one-tap "switch context" on every page.
 */
export function FloatingNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Self-detect role; re-run whenever the route changes so sign-in /
  // sign-out flows refresh the nav without a hard reload.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/role")
      .then((r) => r.json())
      .then((data: { authenticated: boolean; address?: string; role?: Role }) => {
        if (cancelled) return;
        if (data.authenticated && data.role) {
          setRole(data.role);
          setAddress(data.address ?? null);
        } else {
          setRole(null);
          setAddress(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRole(null);
          setAddress(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const items = role === "provider" ? PROVIDER_ITEMS : SUBSCRIBER_ITEMS;

  // Don't show on the proof page — it's deliberately a clean public
  // artifact for sharing, no app chrome. Also hide on login/landing
  // when signed out so the surface doesn't flash empty.
  const hideForRoute =
    (pathname?.startsWith("/vault/") && pathname?.endsWith("/proof")) ||
    pathname === "/login";
  const hide = hideForRoute || !role;

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      // Ignore mousedown on the trigger itself — the button's own onClick
      // handles toggling. Without this guard the outside-click closes the
      // sheet on mousedown and then the click re-opens it (net no-op).
      if (triggerRef.current?.contains(target)) return;
      if (sheetRef.current && !sheetRef.current.contains(target)) {
        setOpen(false);
      }
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

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function onLogout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  if (hide) return null;

  return (
    <>
      {/* Spacer so fixed nav doesn't sit on top of the last page row. */}
      <div aria-hidden className="h-20 md:h-0 shrink-0" />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "close menu" : "open menu"}
        aria-expanded={open}
        className="fixed z-[60] bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4
                   md:bottom-6 md:right-6
                   h-12 w-12 flex items-center justify-center
                   border border-[var(--amber)] bg-[var(--amber)] text-[var(--ink-0)]
                   hover:bg-transparent hover:text-[var(--amber)] transition-colors
                   shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
      >
        <span
          aria-hidden
          className="block transition-transform"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
        >
          {/* + glyph that rotates to ×. Drawn with two lines, monospace. */}
          <span className="relative block h-4 w-4">
            <span
              className="absolute left-0 top-1/2 h-px w-full bg-current"
              style={{ transform: "translateY(-50%)" }}
            />
            <span
              className="absolute top-0 left-1/2 w-px h-full bg-current"
              style={{ transform: "translateX(-50%)" }}
            />
          </span>
        </span>
      </button>

      {open && (
        <div
          ref={sheetRef}
          role="menu"
          className="fixed z-[55] bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4
                     md:bottom-24 md:right-6
                     w-[calc(100vw-2rem)] max-w-[22rem]
                     border border-[var(--rule-0)] bg-[var(--ink-1)]
                     shadow-[0_12px_40px_rgba(0,0,0,0.6)]
                     flex flex-col max-h-[70vh] overflow-y-auto"
        >
          <div className="px-4 py-3 border-b border-[var(--rule-0)] flex items-baseline justify-between gap-3">
            <span className="label">signed in as {role}</span>
            {address && (
              <span className="numeric text-[10px] text-[var(--fg-3)]">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            )}
          </div>
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="px-4 py-3 border-b border-[var(--rule-0)]
                           hover:bg-[var(--ink-2)] transition-colors flex flex-col gap-1"
                style={{
                  background: active ? "var(--ink-2)" : undefined,
                }}
              >
                <span
                  className="label"
                  style={{ color: active ? "var(--amber)" : undefined }}
                >
                  {item.label}
                </span>
                {item.hint && (
                  <span className="text-[12px] text-[var(--fg-2)]">
                    {item.hint}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/profile"
            role="menuitem"
            className="px-4 py-3 border-b border-[var(--rule-0)]
                       hover:bg-[var(--ink-2)] transition-colors label"
          >
            profile
          </Link>
          <button
            type="button"
            onClick={onLogout}
            role="menuitem"
            className="px-4 py-3 text-left label
                       hover:bg-[var(--ink-2)] hover:text-[var(--signal-fail)]
                       transition-colors"
          >
            sign out
          </button>
        </div>
      )}
    </>
  );
}

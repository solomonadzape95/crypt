"use client";

import Link from "next/link";
import { TiltLogo } from "./brand/TiltLogo";
import { WalletMenu } from "./WalletMenu";

type Crumb = { label: string; href?: string };

type Props = {
  crumbs?: Crumb[];
  address?: string | null;
  rightLinks?: Array<{ href: string; label: string }>;
};

export function AppHeader({ crumbs = [], address, rightLinks = [] }: Props) {
  return (
    <header className="relative border-b border-[var(--rule-0)] bg-[var(--ink-1)]">
      {/* Top status hairline — amber, a single px, the operator beacon. */}
      <span
        className="absolute top-0 left-0 h-px"
        style={{
          background: "var(--amber)",
          width: "clamp(40px, 6vw, 88px)",
        }}
      />

      <div className="max-w-[88rem] mx-auto w-full pl-4 md:pl-6 pr-3 md:pr-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-stretch min-w-0">
          {/* Wordmark cell */}
          <Link
            href="/"
            className="flex items-center gap-3 pr-5 border-r border-[var(--rule-0)] h-14 group"
          >
            <Wordmark />
          </Link>

          {/* Crumb cells */}
          <div className="flex items-stretch min-w-0">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <div
                  key={i}
                  className={`flex items-center px-4 border-r border-[var(--rule-0)] min-w-0 ${
                    last ? "" : ""
                  }`}
                >
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="label hover:text-[var(--fg-0)] transition-colors truncate"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="label text-[var(--fg-0)] truncate">{c.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <nav className="flex items-stretch">
          {rightLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hidden md:flex items-center px-4 border-l border-[var(--rule-0)] h-14
                         label hover:text-[var(--fg-0)] hover:bg-[var(--ink-2)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {address && <WalletMenu address={address} />}
        </nav>
      </div>
    </header>
  );
}

/** Header wordmark — amber block slashes replace i and l. */
export function Wordmark() {
  return (
    <span className="flex items-center select-none text-foreground">
      <TiltLogo height={26} />
    </span>
  );
}

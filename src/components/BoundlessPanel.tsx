"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";

type Props = {
  url: string | null;
};

export function BoundlessPanel({ url }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!url) return;
    setBlocked(false);
    // Heuristic: if the iframe never reaches `load` within 3s, assume X-Frame-Options
    // or CSP frame-ancestors blocked it.
    const t = setTimeout(() => setBlocked(true), 3000);
    const onLoad = () => clearTimeout(t);
    const node = iframeRef.current;
    node?.addEventListener("load", onLoad);
    return () => {
      clearTimeout(t);
      node?.removeEventListener("load", onLoad);
    };
  }, [url]);

  return (
    <Panel
      label="community fund"
      trailing={
        url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--amber)] underline"
          >
            open ↗
          </a>
        ) : undefined
      }
    >
      {!url ? (
        <p className="label px-4 py-4 text-[var(--fg-2)] normal-case tracking-normal text-[12px] leading-relaxed">
          No community fund linked. Subscribers can chip in together on{" "}
          <a
            href="https://app.boundlessfi.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--fg-1)]"
          >
            Boundless
          </a>{" "}
          to top up future deposits.
        </p>
      ) : blocked ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-4 border-t border-[var(--rule-0)] hover:bg-[var(--ink-2)] transition-colors"
        >
          <span className="label">community fund</span>
          <p className="numeric text-[12px] text-[var(--fg-0)] mt-1 break-all">{url}</p>
        </a>
      ) : (
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full h-72 border-t border-[var(--rule-0)]"
          referrerPolicy="no-referrer"
        />
      )}
    </Panel>
  );
}

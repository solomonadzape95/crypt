"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type Slide = {
  id: string;
  /** Optional eyebrow label (uppercase, tracked). */
  eyebrow?: string;
  /** Slide body — typically a heading + visual + caption. */
  body: ReactNode;
  /**
   * Optional decorative layer rendered behind the body inside the slide
   * stage. Use for per-slide BarsMarkPattern variations. Re-mounts on every
   * slide change, so the pattern's entry animation re-runs naturally.
   */
  pattern?: ReactNode;
};

type Props = {
  slides: Slide[];
  /** Index to start on. */
  initial?: number;
};

/**
 * Generic slide deck. Borders/cells match the operator-console aesthetic
 * (no rounded corners, hairline borders, amber accents on the active dot).
 *
 * Controls: ‹ prev / next › buttons in the bottom rail; left/right arrow
 * keys; spacebar advances. The framer-motion AnimatePresence handles the
 * slide-in/slide-out transition (X-axis, 0.25s ease-out).
 */
export function SlideDeck({ slides, initial = 0 }: Props) {
  const [i, setI] = useState(initial);
  const [dir, setDir] = useState<1 | -1>(1);

  const go = useCallback(
    (delta: number) => {
      setI((cur) => {
        const next = Math.max(0, Math.min(slides.length - 1, cur + delta));
        if (next !== cur) setDir(delta > 0 ? 1 : -1);
        return next;
      });
    },
    [slides.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") {
        setDir(-1);
        setI(0);
      } else if (e.key === "End") {
        setDir(1);
        setI(slides.length - 1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, slides.length]);

  const slide = slides[i];
  const atStart = i === 0;
  const atEnd = i === slides.length - 1;
  const counter = `${pad(i + 1)} / ${pad(slides.length)}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* slide stage */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slide.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * 32 }}
            transition={{ duration: 0.25, ease: [0.45, 0, 0.55, 1] }}
            className="absolute inset-0 px-6 md:px-12 py-10"
          >
            {slide.pattern && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {slide.pattern}
              </div>
            )}
            <div className="relative z-10 h-full flex items-center justify-center">
              <div className="w-full max-w-[68rem] flex flex-col gap-6">
                {slide.eyebrow && (
                  <span className="label" style={{ color: "var(--amber)" }}>
                    {slide.eyebrow}
                  </span>
                )}
                {slide.body}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* control rail */}
      <div className="border-t border-[var(--rule-0)] bg-[var(--ink-1)]">
        <div className="max-w-[88rem] mx-auto w-full grid grid-cols-[auto_1fr_auto] items-stretch h-12">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={atStart}
            className="px-5 border-r border-[var(--rule-0)] label
                       hover:bg-[var(--ink-2)] hover:text-[var(--fg-0)]
                       transition-colors disabled:opacity-30
                       disabled:cursor-not-allowed flex items-center"
          >
            ‹ prev
          </button>

          <Dots count={slides.length} active={i} onPick={(n) => {
            setDir(n > i ? 1 : -1);
            setI(n);
          }} />

          <div className="flex items-stretch">
            <span className="px-5 border-l border-r border-[var(--rule-0)]
                             label numeric text-[var(--fg-2)] flex items-center">
              {counter}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={atEnd}
              className="px-5 label
                         hover:bg-[var(--ink-2)] hover:text-[var(--fg-0)]
                         transition-colors disabled:opacity-30
                         disabled:cursor-not-allowed flex items-center"
            >
              next ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dots({
  count,
  active,
  onPick,
}: {
  count: number;
  active: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: count }).map((_, i) => {
        const on = i === active;
        return (
          <button
            key={i}
            type="button"
            aria-label={`go to slide ${i + 1}`}
            onClick={() => onPick(i)}
            className="h-1.5 transition-all"
            style={{
              width: on ? 18 : 6,
              background: on ? "var(--amber)" : "var(--rule-1)",
            }}
          />
        );
      })}
    </div>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

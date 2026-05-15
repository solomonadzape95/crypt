"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type Direction = "to-subscriber" | "to-provider";

type Props = {
  active: boolean;
  direction: Direction;
};

const TOKEN_COUNT = 10;

/**
 * Mechanical fund-routing animation. Tokens read as machined chevron markers
 * that slam along a horizontal rail toward the winning pillar. Easing is
 * linear/ease-out — no spring, no bounce. Decays in ~2.4s.
 */
export function FundsAnimation({ active, direction }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [active]);

  const goingRight = direction === "to-subscriber";
  const xDelta = goingRight ? 380 : -380;
  const startLeft = goingRight ? "10%" : "90%";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {show &&
          Array.from({ length: TOKEN_COUNT }).map((_, i) => {
            const delay = i * 0.05;
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: 0, scaleX: 0.4 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: [0, xDelta * 0.55, xDelta],
                  scaleX: [0.4, 1, 1, 0.4],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.4,
                  delay,
                  ease: [0.45, 0, 0.55, 1],
                }}
                className="absolute top-1/2 numeric"
                style={{
                  left: startLeft,
                  color: "var(--amber)",
                  fontSize: "1rem",
                  letterSpacing: "-0.05em",
                }}
              >
                {goingRight ? "›››" : "‹‹‹"}
              </motion.span>
            );
          })}
      </AnimatePresence>
    </div>
  );
}

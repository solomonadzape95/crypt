"use client";

import { motion } from "framer-motion";

type Props = {
  className?: string;
  height?: number;
  pulse?: boolean;
};

/**
 * Compact wordmark: t + small \ + large \ + amber dot + t
 * (backward slashes replace i and l).
 */
export function TiltLogo({ className, height = 20, pulse = true }: Props) {
  const scale = height / 20;
  const w = 47 * scale;
  const h = 28 * scale;

  const Dot = pulse ? motion.circle : "circle";
  const dotProps = pulse
    ? {
        animate: { opacity: [1, 0.3, 1] },
        transition: { duration: 2.2, repeat: Infinity, ease: "linear" as const },
      }
    : {};

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 47 28"
      width={w}
      height={h}
      fill="none"
      className={className}
      role="img"
      aria-label="tilt"
    >
      <text x="0" y="21" className="wordmark" fontSize="20" fill="currentColor">
        t
      </text>
      <line
        x1="13"
        y1="12"
        x2="16"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
      <line
        x1="16.25"
        y1="6"
        x2="24.5"
        y2="22"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
      <Dot
        cx={26}
        cy={19}
        r={2.5}
        style={{ fill: "var(--amber)" }}
        {...dotProps}
      />
      <text x="35" y="21" className="wordmark" fontSize="20" fill="currentColor">
        t
      </text>
    </svg>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  className?: string;
  /** Side length of one tile (px). Larger = more sparse. */
  tile?: number;
  /** Per-tile fill opacity. Keep low — lives behind type. */
  opacity?: number;
  /** Centre-to-centre tile spacing as a multiple of `tile`. ≥1; >1 = gaps. */
  spacing?: number;
  /** Pixel offset of the tile origin. Negative shifts the grid off-canvas. */
  offsetX?: number;
  offsetY?: number;
  /** Per-diagonal stagger step (ms) for the entry animation. */
  staggerMs?: number;
  /** Per-tile fade duration (ms). */
  fadeMs?: number;
};

/**
 * Procedural background — tiles the crypt bars-mark across the surface as a
 * low-contrast amber pattern. Each tile is its own `<g>` so they can stagger
 * in: CSS `@keyframes crypt-tile-in` (in globals.css) fades opacity 0→1, with
 * a per-diagonal animation-delay so the pattern fills diagonally on mount.
 */
export function BarsMarkPattern({
  className,
  tile = 96,
  opacity = 0.07,
  spacing = 1.4,
  offsetX = 0,
  offsetY = 0,
  staggerMs = 22,
  fadeMs = 220,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ w: Math.ceil(width), h: Math.ceil(height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Source mark is 48×48 with bars at x=7.68. Scale to the tile size.
  const s = tile / 48;
  const x = 7.68 * s;
  const w = 32.64 * s;
  const bars = [
    { y: 7.809 * s, h: 12.408 * s },
    { y: 21.915 * s, h: 4.395 * s },
    { y: 28.007 * s, h: 3.619 * s },
    { y: 33.323 * s, h: 2.844 * s },
    { y: 37.864 * s, h: 2.327 * s },
  ];

  const cell = tile * spacing;
  const cols = dims.w > 0 ? Math.ceil((dims.w - offsetX) / cell) + 2 : 0;
  const rows = dims.h > 0 ? Math.ceil((dims.h - offsetY) / cell) + 2 : 0;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        role="img"
        aria-hidden
        style={{ display: "block" }}
      >
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const tx = c * cell + offsetX;
            const ty = r * cell + offsetY;
            const delay = (r + c) * staggerMs;
            return (
              <g
                key={`${r}-${c}`}
                transform={`translate(${tx} ${ty})`}
                style={{
                  opacity: 0,
                  animation: `crypt-tile-in ${fadeMs}ms ease-out ${delay}ms forwards`,
                }}
              >
                {bars.map((b, i) => (
                  <rect
                    key={i}
                    x={x}
                    y={b.y}
                    width={w}
                    height={b.h}
                    style={{ fill: "var(--amber)", fillOpacity: opacity }}
                  />
                ))}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

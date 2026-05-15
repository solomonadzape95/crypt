/** Relative bar heights (top → bottom), matching reference proportions. */
const REL_HEIGHTS = [0.48, 0.17, 0.14, 0.11, 0.09] as const;
const GAP_RATIO = 0.052;

export type BarsVariant =
  | "amber-on-ink"
  | "white-on-ink"
  | "ink-on-amber"
  | "amber-on-white"
  | "ink-on-white"
  | "white-on-amber";

export type BarsColors = {
  bar: string;
  bg: string;
  text: string;
};

/** Header / panel surface — matches AppHeader `bg-[var(--ink-1)]`. */
export const SURFACE_INK = "var(--ink-1)";

/** Hex for static SVG export (oklch(0.16 0.008 250)). */
export const SURFACE_INK_HEX = "#252a31";

/** Hex for static SVG export (oklch(0.8 0.18 75) — matches `--amber`). */
export const ACCENT_AMBER_HEX = "#ffa900";

/** Hex for static SVG export (oklch(0.97 0.005 250) — matches `--fg-0`). */
export const FG_HEX = "#f3f5f8";

/** CSS-token colors for in-app SVG. */
export const BAR_VARIANTS: Record<BarsVariant, BarsColors> = {
  "amber-on-ink": {
    bar: "var(--amber)",
    bg: SURFACE_INK,
    text: "var(--fg-0)",
  },
  "white-on-ink": {
    bar: "var(--fg-0)",
    bg: SURFACE_INK,
    text: "var(--fg-0)",
  },
  "ink-on-amber": {
    bar: SURFACE_INK,
    bg: "var(--amber)",
    text: SURFACE_INK,
  },
  "amber-on-white": {
    bar: "var(--amber)",
    bg: "#ffffff",
    text: SURFACE_INK,
  },
  "ink-on-white": {
    bar: SURFACE_INK,
    bg: "#ffffff",
    text: SURFACE_INK,
  },
  "white-on-amber": {
    bar: "var(--fg-0)",
    bg: "var(--amber)",
    text: "var(--fg-0)",
  },
};

/** Hex colors for exported static SVGs. */
export const BAR_VARIANTS_HEX: Record<BarsVariant, BarsColors> = {
  "amber-on-ink": { bar: ACCENT_AMBER_HEX, bg: SURFACE_INK_HEX, text: FG_HEX },
  "white-on-ink": { bar: FG_HEX, bg: SURFACE_INK_HEX, text: FG_HEX },
  "ink-on-amber": { bar: SURFACE_INK_HEX, bg: ACCENT_AMBER_HEX, text: SURFACE_INK_HEX },
  "amber-on-white": { bar: ACCENT_AMBER_HEX, bg: "#ffffff", text: SURFACE_INK_HEX },
  "ink-on-white": { bar: SURFACE_INK_HEX, bg: "#ffffff", text: SURFACE_INK_HEX },
  "white-on-amber": { bar: FG_HEX, bg: ACCENT_AMBER_HEX, text: FG_HEX },
};

export const ALL_BAR_VARIANTS = Object.keys(BAR_VARIANTS) as BarsVariant[];

/** Square canvas for logo marks (viewBox units). */
export const MARK_SQUARE = 48;

export function barRects(width: number, height: number): Array<{ x: number; y: number; w: number; h: number }> {
  const gap = height * GAP_RATIO;
  const barArea =
    height - gap * (REL_HEIGHTS.length - 1);
  const heights = REL_HEIGHTS.map((r) => r * barArea);
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  let y = 0;
  for (let i = 0; i < heights.length; i++) {
    rects.push({ x: 0, y, w: width, h: heights[i] });
    y += heights[i] + gap;
  }
  return rects;
}

/** Bar stack centered inside a square (bg fills the full square). */
export function barRectsInSquare(squareSize: number = MARK_SQUARE): Array<{
  x: number;
  y: number;
  w: number;
  h: number;
}> {
  const pad = squareSize * 0.16;
  const inner = squareSize - pad * 2;
  const rects = barRects(inner, inner);
  const last = rects[rects.length - 1]!;
  const stackHeight = last.y + last.h;
  const offsetX = (squareSize - inner) / 2;
  const offsetY = (squareSize - stackHeight) / 2;
  return rects.map((r) => ({
    x: r.x + offsetX,
    y: r.y + offsetY,
    w: r.w,
    h: r.h,
  }));
}

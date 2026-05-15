import {
  ALL_BAR_VARIANTS,
  BAR_VARIANTS,
  MARK_SQUARE,
  type BarsVariant,
  barRectsInSquare,
} from "./bars";

type Props = {
  variant?: BarsVariant;
  className?: string;
  /** Square side length in px. */
  size?: number;
  /** Omit background fill (e.g. header on matching surface). */
  transparentBg?: boolean;
};

/** Stacked-bar logo mark inside a square (5 bars, thick top → thin bottom). */
export function CryptBarsMark({
  variant = "amber-on-ink",
  className,
  size = MARK_SQUARE,
  transparentBg = false,
}: Props) {
  const colors = BAR_VARIANTS[variant];
  const rects = barRectsInSquare(MARK_SQUARE);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${MARK_SQUARE} ${MARK_SQUARE}`}
      width={size}
      height={size}
      fill="none"
      className={className}
      role="img"
      aria-hidden
    >
      {!transparentBg && (
        <rect
          width={MARK_SQUARE}
          height={MARK_SQUARE}
          style={{ fill: colors.bg }}
        />
      )}
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          style={{ fill: colors.bar }}
        />
      ))}
    </svg>
  );
}

export { ALL_BAR_VARIANTS };

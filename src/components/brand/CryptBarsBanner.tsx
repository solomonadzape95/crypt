import {
  BAR_VARIANTS,
  MARK_SQUARE,
  type BarsVariant,
  barRectsInSquare,
} from "./bars";

type Props = {
  variant?: BarsVariant;
  className?: string;
  width?: number;
};

const VIEW_W = 240;
const VIEW_H = 56;
const MARK_GAP = 6;
const MARK_DISPLAY = VIEW_H;
const TEXT_SIZE = 34;
/** Approximate width of "crypt" at TEXT_SIZE in DM Mono. */
const TEXT_WIDTH = 110;
const CONTENT_W = MARK_DISPLAY + MARK_GAP + TEXT_WIDTH;
const OFFSET_X = (VIEW_W - CONTENT_W) / 2;
const TEXT_X = OFFSET_X + MARK_DISPLAY + MARK_GAP;

/** Banner: square bar mark + "crypt" wordmark, centered as a group. */
export function CryptBarsBanner({
  variant = "amber-on-ink",
  className,
  width = 480,
}: Props) {
  const colors = BAR_VARIANTS[variant];
  const height = (width / VIEW_W) * VIEW_H;
  const rects = barRectsInSquare(MARK_SQUARE);
  const markScale = MARK_DISPLAY / MARK_SQUARE;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={height}
      fill="none"
      className={className}
      role="img"
      aria-label="crypt"
    >
      <rect width={VIEW_W} height={VIEW_H} style={{ fill: colors.bg }} />

      <g transform={`translate(${OFFSET_X}, 0)`}>
        <g transform={`scale(${markScale})`}>
          <rect
            width={MARK_SQUARE}
            height={MARK_SQUARE}
            style={{ fill: colors.bg }}
          />
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
        </g>

        <text
          x={TEXT_X - OFFSET_X}
          y={VIEW_H / 2}
          className="wordmark"
          fontSize={TEXT_SIZE}
          dominantBaseline="middle"
          style={{ fill: colors.text }}
          letterSpacing="-0.02em"
        >
          crypt
        </text>
      </g>
    </svg>
  );
}

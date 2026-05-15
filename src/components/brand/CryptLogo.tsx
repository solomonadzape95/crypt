import { flatBottomSlashPoints } from "./slash";

type Props = {
  className?: string;
  /** Cap height in px; design baseline is 20. */
  height?: number;
};

const BASE = 20;

/**
 * Compact crypt wordmark: two escalating amber block slashes as a brand
 * prefix, then "crypt" in the wordmark face. The slashes carry the same
 * Adidas-style escalation as the stacked bar mark.
 */
export function CryptLogo({ className, height = 26 }: Props) {
  const s = height / BASE;
  const fontSize = BASE * s;
  const textY = 21 * s;
  const cutY = 21.5 * s;
  const viewW = 88 * s;
  const viewH = 28 * s;

  // Slash pair lives in the leading 18 design units; wordmark follows.
  const smallSlash = flatBottomSlashPoints(
    2 * s,
    11.5 * s,
    5.5 * s,
    24 * s,
    2.75 * s,
    cutY,
  );
  const largeSlash = flatBottomSlashPoints(
    7 * s,
    5.5 * s,
    15 * s,
    24 * s,
    3.5 * s,
    cutY,
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={viewW}
      height={viewH}
      fill="none"
      className={className}
      role="img"
      aria-label="crypt"
    >
      <polygon points={smallSlash} style={{ fill: "var(--amber)" }} />
      <polygon points={largeSlash} style={{ fill: "var(--amber)" }} />
      <text
        x={20 * s}
        y={textY}
        className="wordmark"
        fontSize={fontSize}
        fill="currentColor"
      >
        crypt
      </text>
    </svg>
  );
}

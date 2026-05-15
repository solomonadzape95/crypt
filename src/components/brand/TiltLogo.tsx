import { flatBottomSlashPoints } from "./slash";

type Props = {
  className?: string;
  /** Cap height in px; design baseline is 20. */
  height?: number;
};

const BASE = 20;

/** Compact wordmark: t + small \ + large \ + t (amber block slashes, flat bottoms). */
export function TiltLogo({ className, height = 26 }: Props) {
  const s = height / BASE;
  const fontSize = BASE * s;
  const textY = 21 * s;
  const cutY = 21.5 * s;
  const viewW = 40 * s;
  const viewH = 28 * s;

  const smallSlash = flatBottomSlashPoints(13 * s, 11.5 * s, 16.5 * s, 24 * s, 2.75 * s, cutY);
  const largeSlash = flatBottomSlashPoints(17 * s, 5.5 * s, 25 * s, 24 * s, 3.5 * s, cutY);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={viewW}
      height={viewH}
      fill="none"
      className={className}
      role="img"
      aria-label="tilt"
    >
      <text x="0" y={textY} className="wordmark" fontSize={fontSize} fill="currentColor">
        t
      </text>
      <polygon points={smallSlash} style={{ fill: "var(--amber)" }} />
      <polygon points={largeSlash} style={{ fill: "var(--amber)" }} />
      <text x={28 * s} y={textY} className="wordmark" fontSize={fontSize} fill="currentColor">
        t
      </text>
    </svg>
  );
}

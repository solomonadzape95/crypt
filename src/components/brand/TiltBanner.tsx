import { flatBottomSlashPoints } from "./slash";

type Props = {
  className?: string;
  width?: number;
};

/** Wide banner: full "tilt" with amber block slashes (flat bottoms) as separate marks. */
export function TiltBanner({ className, width = 640 }: Props) {
  const height = (width / 640) * 160;
  const cutY = 108;

  const smallSlash = flatBottomSlashPoints(310, 68, 330, 125, 9, cutY);
  const largeSlash = flatBottomSlashPoints(332, 48, 380, 125, 11.5, cutY);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 160"
      width={width}
      height={height}
      fill="none"
      className={className}
      role="img"
      aria-label="tilt"
    >
      <rect width="640" height="160" style={{ fill: "var(--ink-1)" }} />
      <rect x="0" y="0" width="88" height="1" style={{ fill: "var(--amber)" }} />
      <rect x="0" y="159" width="640" height="1" style={{ fill: "var(--rule-0)" }} />

      <text
        x="40"
        y="102"
        className="wordmark"
        fontSize="72"
        fill="currentColor"
        letterSpacing="-2.2"
      >
        tilt
      </text>

      <polygon points={smallSlash} style={{ fill: "var(--amber)" }} />
      <polygon points={largeSlash} style={{ fill: "var(--amber)" }} />
    </svg>
  );
}

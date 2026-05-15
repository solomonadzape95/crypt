type Props = {
  className?: string;
  width?: number;
};

/**
 * Wide banner: full "tilt" wordmark with small \, large \, and dot as separate marks.
 */
export function TiltBanner({ className, width = 640 }: Props) {
  const height = (width / 640) * 160;

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

      <line
        x1="308"
        y1="72"
        x2="328"
        y2="112"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <line
        x1="330"
        y1="52"
        x2="378"
        y2="118"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <circle cx="392" cy="108" r="7" style={{ fill: "var(--amber)" }} />
    </svg>
  );
}

import { flatBottomSlashPoints } from "./slash";

type Props = {
  className?: string;
  width?: number;
};

/** Wide banner: two amber block slashes as brand prefix, then "crypt". */
export function CryptBanner({ className, width = 640 }: Props) {
  const height = (width / 640) * 160;
  const cutY = 108;

  // Slashes sit as a prefix on the left, wordmark follows.
  const smallSlash = flatBottomSlashPoints(40, 68, 60, 125, 9, cutY);
  const largeSlash = flatBottomSlashPoints(62, 48, 110, 125, 11.5, cutY);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 160"
      width={width}
      height={height}
      fill="none"
      className={className}
      role="img"
      aria-label="crypt"
    >
      <rect width="640" height="160" style={{ fill: "var(--ink-1)" }} />
      <rect
        x="0"
        y="0"
        width="88"
        height="1"
        style={{ fill: "var(--amber)" }}
      />
      <rect
        x="0"
        y="159"
        width="640"
        height="1"
        style={{ fill: "var(--rule-0)" }}
      />

      <polygon points={smallSlash} style={{ fill: "var(--amber)" }} />
      <polygon points={largeSlash} style={{ fill: "var(--amber)" }} />

      <text
        x="140"
        y="102"
        className="wordmark"
        fontSize="72"
        fill="currentColor"
        letterSpacing="-2.2"
      >
        crypt
      </text>
    </svg>
  );
}

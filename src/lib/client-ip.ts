/**
 * Best-effort client IP. Returns null when no header is present (typical for
 * direct localhost dev). Used to bind SIWS challenges so a stolen nonce can't
 * be replayed from a different network.
 */
export function clientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  return null;
}

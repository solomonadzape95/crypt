/**
 * Compact "time-from-now" formatter for vault expiry strips.
 *
 * Returns:
 *   - "expired"        when target ≤ now
 *   - "in 47s"         < 1 min
 *   - "in 6m"          < 1 h
 *   - "in 4h 12m"      < 1 day
 *   - "in 4d 6h"       ≥ 1 day
 */
export function timeUntil(target: string | Date | null, now = Date.now()): string {
  if (!target) return "—";
  const t = target instanceof Date ? target.getTime() : new Date(target).getTime();
  const diff = t - now;
  if (diff <= 0) return "expired";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM ? `in ${h}h ${remM}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `in ${d}d ${remH}h` : `in ${d}d`;
}

export function periodDaysLabel(days: number | null | undefined): string {
  if (!days) return "";
  if (days >= 30 && days % 30 === 0) return `${days / 30}mo`;
  if (days % 7 === 0) return `${days / 7}wk`;
  return `${days}d`;
}

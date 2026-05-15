type Point = [number, number];

function intersectAtY(a: Point, b: Point, y: number): Point {
  const dy = b[1] - a[1];
  if (Math.abs(dy) < 1e-6) return [b[0], y];
  const t = (y - a[1]) / dy;
  return [a[0] + t * (b[0] - a[0]), y];
}

/** Block backward slash (\) with a flat horizontal cut at the baseline (Adidas-style). */
export function flatBottomSlashPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  cutY: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * (thickness / 2);
  const oy = (dx / len) * (thickness / 2);

  const topLeft: Point = [x1 - ox, y1 - oy];
  const topRight: Point = [x1 + ox, y1 + oy];
  const bottomRight: Point = [x2 + ox, y2 + oy];
  const bottomLeft: Point = [x2 - ox, y2 - oy];

  const rightFoot = intersectAtY(topRight, bottomRight, cutY);
  const leftFoot = intersectAtY(topLeft, bottomLeft, cutY);

  return [topLeft, topRight, rightFoot, leftFoot]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

/** @deprecated Use flatBottomSlashPoints */
export function blockSlashPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
): string {
  return flatBottomSlashPoints(x1, y1, x2, y2, thickness, y2);
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0,
      hi = 1,
      mid = x;
    for (let i = 0; i < 16; i++) {
      mid = (lo + hi) / 2;
      if (sampleX(mid) < x) lo = mid;
      else hi = mid;
    }
    return sampleY(mid);
  };
}

const easeEmblem = bezier(0.22, 0.08, 0.18, 1);
export function emblemMotion(elapsed) {
  const front = easeEmblem(clamp01(elapsed / 420));
  const follower = easeEmblem(clamp01((elapsed - 85) / 420));
  return { front, tail: lerp(front, follower, 0.78) };
}

// Browsers expose no reliable free-GPU-memory query. Use conservative bounds on
// touch/Android and low-memory devices, including high-DPR phones.
export const constrainedRendering =
  matchMedia('(pointer: coarse)').matches ||
  /Android/i.test(navigator.userAgent) ||
  (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4);

export function canvasDensity(width, height, maxEdge = 1800) {
  const edge = constrainedRendering ? Math.min(maxEdge, 1024) : maxEdge;
  const pixels = constrainedRendering ? 700_000 : 2_400_000;
  return Math.min(
    devicePixelRatio || 1,
    constrainedRendering ? 1 : 1.5,
    edge / Math.max(width, height),
    Math.sqrt(pixels / (width * height)),
  );
}

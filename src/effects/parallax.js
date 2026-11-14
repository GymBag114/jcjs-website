export function createParallax(planes, reducedMotion) {
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let paused = reducedMotion.matches;
  let frame = 0;
  let lastTime = 0;

  function paint() {
    for (const { element, depth } of planes) {
      element.style.transform = `translate3d(${(-current.x * 40 * depth).toFixed(3)}px, ${(-current.y * 22 * depth).toFixed(3)}px, 0)`;
    }
  }

  function animate(time) {
    frame = 0;
    const dt = lastTime ? Math.min(time - lastTime, 64) : 16.67;
    lastTime = time;
    // Time-based damping behaves consistently on 60Hz and 120Hz displays.
    const blend = 1 - Math.exp(-dt / 115);
    current.x += (target.x - current.x) * blend;
    current.y += (target.y - current.y) * blend;
    if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) < 0.0002) {
      current.x = target.x;
      current.y = target.y;
      lastTime = 0;
    } else {
      frame = requestAnimationFrame(animate);
    }
    paint();
  }

  function wake() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function reset(immediate = false) {
    target.x = target.y = 0;
    if (immediate || paused) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      current.x = current.y = 0;
      paint();
    } else wake();
  }

  return {
    reset,
    wake,
    target,
    get paused() {
      return paused;
    },
    setPaused(value) {
      paused = value;
      reset(true);
    },
  };
}

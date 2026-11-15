import { canvasDensity, constrainedRendering } from '../core/render-budget.js';

// Dust carries the pigment and alpha of its point of origin in the tower.
export function createTowerDust(tower) {
  const monochrome = new Image();
  const canvas = tower.querySelector('canvas');
  const width = 756,
    height = 1133,
    bleed = 224;
  const cell = 12,
    sprite = constrainedRendering ? 8 : 16;
  const columns = Math.ceil(width / cell),
    rows = Math.ceil(height / cell);
  let atlas,
    erosion,
    coverage,
    ctx,
    damage,
    damageInk,
    last,
    frame = 0,
    clock = 0;
  let settleStart = null;
  let grains = [],
    eddies = [];
  // Keep a short burst for the first sweep, then spread births over time.
  // A live grain owns its slot until the end of its fade.
  const maxGrains = 650, burst = 84, birthsPerSecond = 430;
  let birthCredit = burst, lastBudgetTime = 0, birthSequence = 0;
  let lastRelease = -Infinity;
  const recoveryDelay = 500,
    recoveryDuration = 2200;

  function damageOpacity(now) {
    const t = Math.max(0, Math.min(1, (now - lastRelease - recoveryDelay) / recoveryDuration));
    return 1 - t * t * (3 - 2 * t);
  }

  function resumeDamage(now) {
    // Bake the currently visible damage before adding another stroke. A new
    // gesture can deepen it, but can never reset old damage to full strength.
    const opacity = damageOpacity(now);
    if (opacity < 1) {
      damageInk.globalCompositeOperation = 'destination-in';
      damageInk.globalAlpha = opacity;
      damageInk.fillRect(0, 0, width, height);
      damageInk.globalCompositeOperation = 'source-over';
      damageInk.globalAlpha = 1;
    }
    lastRelease = now;
  }

  function surface(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Smooth noise bends the stock into little filaments before it is lifted.
  const noise = Float32Array.from({ length: 64 * 64 }, () => Math.random());
  function weave(x, y) {
    const i = Math.floor(x),
      j = Math.floor(y);
    let u = x - i,
      v = y - j;
    u *= u * (3 - 2 * u);
    v *= v * (3 - 2 * v);
    const a = noise[(j & 63) * 64 + (i & 63)],
      b = noise[(j & 63) * 64 + ((i + 1) & 63)];
    const c = noise[((j + 1) & 63) * 64 + (i & 63)],
      d = noise[((j + 1) & 63) * 64 + ((i + 1) & 63)];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  function brushTexture(size, forErosion) {
    const tip = surface(size, size),
      ink = tip.getContext('2d');
    const pixels = ink.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        const warp = weave(u * 4.6, v * 4.6);
        const fiber = weave(u * 7 + warp * 4, v * 17 + warp * 5);
        const edge = Math.max(0, 1 - Math.hypot((u - 0.5) * 2, (v - 0.5) * 2));
        const density = forErosion
          ? Math.min(1, edge * 2.7) *
            Math.min(1, Math.max(0, fiber * 2.3 - 0.5)) *
            (0.6 + 0.4 * Math.random())
          : edge * edge * (0.14 + 1.65 * fiber * fiber);
        pixels.data[(y * size + x) * 4 + 3] = Math.min(255, 255 * density);
      }
    }
    ink.putImageData(pixels, 0, 0);
    return tip;
  }

  function prepare() {
    if (atlas) return true;
    if (!monochrome.src) {
      monochrome.src = new URL('../../assets/images/tower-monochrome.webp', import.meta.url).href;
    }
    if (!monochrome.complete || !monochrome.naturalWidth) return false;
    // The resting masonry and every dust tile share the baked monochrome plate.
    const thumb = surface(columns, rows),
      sample = thumb.getContext('2d');
    sample.drawImage(monochrome, 0, 0, columns, rows);
    try {
      coverage = sample.getImageData(0, 0, columns, rows).data;
    } catch {
      /* Local files can draw the same transparent tiles without readback. */
    }
    atlas = surface(columns * sprite, rows * sprite);
    const ink = atlas.getContext('2d');
    ink.imageSmoothingEnabled = false;
    ink.drawImage(thumb, 0, 0, atlas.width, atlas.height);
    ink.globalCompositeOperation = 'destination-in';
    ink.fillStyle = ink.createPattern(brushTexture(sprite, false), 'repeat');
    ink.fillRect(0, 0, atlas.width, atlas.height);
    thumb.width = thumb.height = 1;
    erosion = brushTexture(96, true);
    damage = surface(width, height);
    damageInk = damage.getContext('2d');
    const density = Math.min(1, canvasDensity(width + bleed * 2, height + bleed * 2));
    canvas.width = Math.round((width + bleed * 2) * density);
    canvas.height = Math.round((height + bleed * 2) * density);
    canvas.style.width = width + bleed * 2 + 'px';
    canvas.style.height = height + bleed * 2 + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / (width + bleed * 2), canvas.height / (height + bleed * 2));
    ctx.translate(bleed, bleed);
    return true;
  }

  // A stroke sheds counter-rotating eddies on its two sides. Neighbouring
  // grains share the flow; fine ash follows it longer than heavy fragments.
  function release(x, y, dx, dy, speed, radius, now, quota) {
    let hits = 0;
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * 2 * Math.PI,
        spread = radius * Math.sqrt(Math.random());
      const px = x + Math.cos(angle) * spread,
        py = y + Math.sin(angle) * spread;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const col = Math.floor((px / width) * columns),
        row = Math.floor((py / height) * rows);
      if (coverage && coverage[(row * columns + col) * 4 + 3] < 12) continue;
      hits++;
      // A covered brush still erodes the tower when all particle slots are busy.
      if (quota === 0) break;
      quota--;
      birthCredit--;
      const mist = birthSequence++ % 3 === 0;
      const thrust = (70 + 200 * speed) * (0.66 + Math.random() * 0.35);
      grains.push({
        x: px,
        y: py,
        sx: col * sprite,
        sy: row * sprite,
        vx: dx * thrust,
        vy: dy * thrust * 0.78 - 18,
        mist,
        size: mist ? radius * (0.105 + Math.random() * 0.13) : 2 + Math.random() * 4.7,
        lift: 35 + Math.random() * 38,
        born: now,
        life: mist ? 1450 + Math.random() * 800 : 480 + Math.random() * 700,
      });
    }
    if (!hits) return;
    resumeDamage(now);
    damageInk.globalAlpha = 0.24;
    damageInk.drawImage(erosion, x - radius, y - radius, radius * 2, radius * 2);
    damageInk.globalAlpha = 1;
    const previous = eddies[eddies.length - 1];
    if (previous && now - previous.born < 46) return;
    for (const sign of [-1, 1]) {
      eddies.push({
        x: x - dy * radius * 0.54 * sign,
        y: y + dx * radius * 0.54 * sign,
        vx: dx * (24 + 38 * speed),
        vy: dy * 22 - 31,
        born: now,
        spin: sign * radius * (88 + speed * 70),
        core: radius * radius * 0.36,
        reach: radius * radius * 5.5,
      });
    }
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    grains.length = eddies.length = 0;
    birthCredit = burst;
    lastBudgetTime = birthSequence = 0;
    damageInk?.clearRect(0, 0, width, height);
    lastRelease = -Infinity;
    last = null;
    clock = 0;
    settleStart = null;
    tower.classList.remove('dusting', 'dust-settling');
    tower.style.removeProperty('--dust-return');
    canvas.hidden = true;
  }

  function draw(now) {
    const dt = Math.min(0.04, Math.max(0, (now - clock) / 1000));
    clock = now;
    grains = grains.filter((p) => now - p.born < p.life);
    eddies = eddies.filter((e) => now - e.born < 1200);
    if (settleStart !== null) {
      const t = Math.min(1, Math.max(0, (now - settleStart) / 480));
      if (t === 1) {
        stop();
        return;
      }
      tower.style.setProperty('--dust-return', t * t * (3 - 2 * t));
    } else if (!grains.length && damageOpacity(now) === 0) {
      stop();
      return;
    }
    ctx.clearRect(-bleed, -bleed, width + bleed * 2, height + bleed * 2);
    ctx.drawImage(monochrome, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = damageOpacity(now);
    ctx.drawImage(damage, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    for (const e of eddies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.strength = e.spin * (1 - (now - e.born) / 1200);
    }
    const airTime = now * 0.00045;
    const drag = Math.exp(-2.1 * dt);
    for (const p of grains) {
      const age = Math.max(0, (now - p.born) / p.life);
      let vx = 20 * Math.sin(p.y * 0.028 + airTime) + 9;
      let vy = -p.lift + 13 * Math.cos(p.x * 0.025 - airTime);
      for (const e of eddies) {
        const x = p.x - e.x,
          y = p.y - e.y;
        const d = x * x + y * y;
        if (d > e.reach) continue;
        const swirl = (e.strength * (1 - d / e.reach)) / (d + e.core);
        vx -= y * swirl;
        vy += x * swirl;
      }
      p.vx = p.vx * drag + vx * (1 - drag);
      p.vy = p.vy * drag + vy * (1 - drag);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const fade = Math.min(1, age * 14 + 0.12) * (1 - age) * (1 - age);
      ctx.globalAlpha = fade * (p.mist ? 0.59 : 0.96);
      const size = p.size * (p.mist ? 1 + 2.9 * age : 1 - 0.5 * age);
      // Stretch the vapor down its streamline, then let it open as it slows.
      const heading = Math.atan2(p.vy, p.vx);
      const length = p.mist ? size * (1.8 + 0.8 * (1 - age)) : size;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(heading);
      ctx.drawImage(atlas, p.sx, p.sy, sprite, sprite, -length * 0.5, -size * 0.5, length, size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    frame = requestAnimationFrame(draw);
  }

  function brush(event) {
    if (settleStart !== null) return;
    const bounds = tower.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) * width) / bounds.width;
    const y = ((event.clientY - bounds.top) * height) / bounds.height;
    const now = performance.now();
    const previous = last;
    if (!previous || now - previous.time > 180) {
      last = { x, y, time: now };
      return;
    }
    const dx = x - previous.x,
      dy = y - previous.y,
      distance = Math.hypot(dx, dy);
    if (distance < 10) return;
    last = { x, y, time: now };
    const steps = Math.min(12, Math.ceil(distance / 20));
    const speed = Math.min(1, distance / Math.max(8, now - previous.time) / 2);
    // Size the brush in screen pixels, then map it into the tower's own coordinates.
    const screenRadius = Math.min(110, Math.max(65, innerWidth * 0.067)) * (0.84 + 0.42 * speed);
    const radius = Math.min(width * 0.34, (screenRadius * width) / bounds.width);
    if (
      Math.max(previous.x, x) < -radius ||
      Math.min(previous.x, x) > width + radius ||
      Math.max(previous.y, y) < -radius ||
      Math.min(previous.y, y) > height + radius ||
      !prepare()
    )
      return;
    birthCredit = Math.min(burst, birthCredit + ((now - lastBudgetTime) * birthsPerSecond) / 1000);
    lastBudgetTime = now;
    const available = Math.min(Math.floor(birthCredit), maxGrains - grains.length, steps * 28);
    for (let i = 1; i <= steps; i++) {
      // Share even a small allowance along the whole pointer segment.
      const quota = Math.floor((i * available) / steps) - Math.floor(((i - 1) * available) / steps);
      release(
        previous.x + (dx * i) / steps,
        previous.y + (dy * i) / steps,
        dx / distance,
        dy / distance,
        speed,
        radius,
        now,
        quota,
      );
    }
    if (eddies.length > 16) eddies.splice(0, eddies.length - 16);
    if (!frame && lastRelease === now) {
      canvas.hidden = false;
      tower.classList.add('dusting');
      clock = now;
      draw(now);
    }
  }
  function settle() {
    last = null;
    if (!frame || settleStart !== null) return;
    settleStart = performance.now();
    tower.classList.add('dust-settling');
  }
  return {
    brush,
    stop,
    settle,
    endStroke() {
      last = null;
    },
  };
}

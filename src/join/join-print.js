import { makeJoinSheet } from './join-artwork.js';

// Register the seven printed marks as bands of a single ink plate.
export function createJoinPrint(ctx, scene, union, emblemMotion, repaint, reducedMotion) {
  const impression = scene.querySelector('.join-impression');
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const mix = (from, to, t) => from + (to - from) * t;
  let layout;
  let playhead = 0,
    target = 0,
    raf = 0,
    last = 0,
    hovered = false;
  let panning = false;
  let active = false,
    phase = 0,
    lastPaint = 0,
    exitPlayhead = 0;
  const duration = 690;

  // All letters and the arrow share a 100-unit master and one uniform scale.
  const j = new Path2D('M6 71C6 88 15 96 29 96S51 85 51 67V4');
  const suffix = new Path2D(
    'M5 4V96 M27 96V4L91 96V4 M122 4V63C122 86 134 96 152 96S182 85 182 63V4 M259 23C250 8 238 4 225 4C207 4 197 13 197 26C197 40 210 45 228 50C249 56 262 62 262 77C262 90 250 97 232 97C216 97 203 90 195 78',
  );
  const arrow = new Path2D('M0 45H54L34 25L41 18L73 50L41 82L34 75L54 55H0Z');
  const oStart = 66,
    radius = 46,
    pad = 10;
  const suffixAfterCap = radius + 12,
    arrowAfterSuffix = 262 + 27,
    arrowWidth = 73;
  function eased(t) {
    const x = clamp(t);
    return x * x * x * (10 + x * (-15 + 6 * x));
  }

  function lettering(width, height, viewport) {
    const capScale = (height * 0.86) / 100;
    const overhang = suffixAfterCap + arrowAfterSuffix + arrowWidth;
    const fit = Math.min(1, (viewport * 0.94) / (width + overhang * capScale));
    const scale = capScale * fit;
    // The right semicircle starts exactly at the final plate edge. Both
    // tangents and both semicircles are baked once, before the first frame.
    const cap = width / capScale - pad;
    const word = new Path2D(j);
    const oval = new Path2D();
    oval.moveTo(oStart + radius, 4);
    oval.lineTo(cap, 4);
    oval.arc(cap, 50, radius, -Math.PI / 2, Math.PI / 2);
    oval.lineTo(oStart + radius, 96);
    oval.arc(oStart + radius, 50, radius, Math.PI / 2, 1.5 * Math.PI);
    oval.closePath();
    word.addPath(oval);
    word.addPath(suffix, new DOMMatrix().translate(cap + suffixAfterCap, 0));
    const arrowX = cap + suffixAfterCap + arrowAfterSuffix;
    return { word, scale, fit, arrowX, totalWidth: width * fit + overhang * scale };
  }

  function lockupBounds(box) {
    const { scale, fit, arrowX, totalWidth } = box.type;
    const travel = eased(playhead);
    const bw = mix(box.width, box.width * fit, travel),
      bh = mix(box.height, box.height * fit, travel);
    const left = mix(box.left, (box.w - totalWidth) / 2, travel);
    const top = (box.h - bh) / 2,
      right = left + bw;
    const pen = left + (pad - arrowX * (1 - travel)) * scale;
    const boundRight = Math.max(right, pen + (arrowX + arrowWidth) * scale);
    return { left, top, bw, bh, right, pen, boundRight };
  }

  function printLockup(box, bounds, reveal, bands) {
    const { left, top, bw, bh, right, boundRight } = bounds;
    const { word, scale, arrowX } = box.type;
    const pen = bounds.pen - (1 - reveal) * 35 * scale;
    function print(color, x, width, mode = 'source-over') {
      if (width <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = mode;
      ctx.beginPath();
      ctx.rect(x, top, width, bh);
      ctx.clip();
      ctx.translate(pen, box.h / 2 - 50 * scale);
      ctx.scale(scale, scale);
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.stroke(word);
      ctx.translate(arrowX, 0);
      ctx.fill(arrow);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.save();
    if (bands) ctx.clip(bands);
    print('#eee9df', left, bw);
    ctx.restore();
    print('#faf8f2', right, boundRight - right, 'difference');
    ctx.restore();
  }

  function measure(w, h) {
    if (layout?.w === w && layout.h === h) return layout;
    const originalWidth = Math.min(w * (w < h ? 0.86 : 0.67), h * 1.42);
    const originalHeight = Math.min(originalWidth / (w < h ? 1.85 : 2.48), h * 0.46);
    const pins = union.pinGeometry(1, w, h).sort((a, b) => a.y - b.y);
    const stackedHeight = pins.reduce((total, pin) => total + pin.height, 0);
    const span = Math.max(...pins.map((pin) => pin.y + pin.height)) - pins[0].y;
    const aspect = originalWidth / originalHeight;
    const height = Math.min(
      originalHeight * 0.78,
      span,
      stackedHeight,
      w < h ? (w * 0.52) / aspect : Infinity,
    );
    const width = height * aspect;
    const left = w * (w < h ? 0.39 : 0.5) - width / 2,
      top = (h - height) / 2;
    let preceding = 0;
    for (const pin of pins) {
      pin.restY = top + (preceding / (stackedHeight - pin.height)) * (height - pin.height);
      preceding += pin.height;
    }
    layout = {
      w,
      h,
      width,
      height,
      left,
      top,
      pins,
      type: lettering(width, height, w),
      sheet: makeJoinSheet(ctx.canvas, w, h, left + width, emblemMotion),
    };
    Object.assign(impression.style, {
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px',
    });
    return layout;
  }

  function draw(clock, sheet, w, h, pan = 0) {
    const box = measure(w, h);
    const density = ctx.canvas.height / h;
    const edge = Math.round((1 - sheet) * h * density) / density;
    ctx.save();
    ctx.translate(-pan, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, edge, w + pan, h - edge);
    ctx.clip();
    box.sheet.draw(ctx, clock, emblemMotion(playhead * 420).front, phase, pan);
    ctx.restore();
    const bounds = lockupBounds(box);
    if (clock === 1) {
      const { left, top, bw, bh, boundRight } = bounds;
      // Keep the original target under a stationary pointer during travel.
      if (box.lastHitPlayhead !== playhead) {
        box.lastHitPlayhead = playhead;
        Object.assign(impression.style, {
          left: left + 'px',
          top: box.top + 'px',
          width: Math.max(box.left + box.width, boundRight) - left + 'px',
          height: box.height + 'px',
        });
      }
      ctx.fillStyle = '#161616';
      ctx.fillRect(left, top, bw, bh);
      printLockup(box, bounds, 1);
      ctx.restore();
      return;
    }
    const bands = new Path2D();
    box.pins.forEach((pin, row) => {
      const lane = pin.x + pin.width / 2 - w / 2;
      const delay = Math.abs(row - 3) * 0.017;
      const spread = emblemMotion(clamp((clock - delay) / 0.94) * 505);
      const left = mix(pin.x, bounds.left, lane <= 0 ? spread.front : spread.tail);
      const right = mix(pin.x + pin.width, bounds.right, lane >= 0 ? spread.front : spread.tail);
      const scaleY = bounds.bh / box.height;
      const restY = bounds.top + (pin.restY - box.top) * scaleY;
      bands.rect(
        left,
        mix(pin.y, restY, spread.front),
        right - left,
        mix(pin.height, pin.height * scaleY, spread.front),
      );
    });
    ctx.fillStyle = '#faf5ec';
    ctx.fill(bands);
    ctx.beginPath();
    ctx.rect(0, edge, w, h - edge);
    ctx.clip();
    ctx.fillStyle = '#161616';
    ctx.fill(bands);
    const revealStart = exitPlayhead ? 0.45 : 0.7;
    if (clock > revealStart)
      printLockup(box, bounds, eased((clock - revealStart) / (1 - revealStart)), bands);
    ctx.restore();
  }

  function updateHover() {
    target = !impression.hidden && (hovered || impression.matches(':focus-visible')) ? 1 : 0;
    if (reducedMotion.matches) {
      cancelAnimationFrame(raf);
      raf = 0;
      playhead = target;
      phase = 0;
      repaint();
    } else wake();
  }
  function wake() {
    if (!raf && active && !reducedMotion.matches && !document.hidden) {
      last = performance.now();
      lastPaint = 0;
      raf = requestAnimationFrame(advance);
    }
  }
  function advance(now) {
    raf = 0;
    if (!active || document.hidden || reducedMotion.matches) return;
    const moving = playhead !== target;
    const elapsed = Math.max(0, now - last);
    const step = Math.min(Math.abs(target - playhead), elapsed / duration);
    playhead += Math.sign(target - playhead) * step;
    phase += Math.min(elapsed, 64);
    last = now;
    // Cached paper and ink passes keep the ambient engraving at 30 fps.
    if (now - lastPaint >= 32 || moving) {
      lastPaint = now;
      repaint();
    }
    if (!panning || playhead !== target) raf = requestAnimationFrame(advance);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  });
  impression.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') {
      hovered = true;
      updateHover();
    }
  });
  impression.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') {
      hovered = false;
      updateHover();
    }
  });
  impression.addEventListener('focus', updateHover);
  impression.addEventListener('blur', updateHover);
  reducedMotion.addEventListener('change', updateHover);

  function setInteractive(enabled, clock = 1) {
    if (clock === 0) exitPlayhead = 0;
    if (!active) {
      // Sample the outgoing hover on the wipe clock, including skipped frames.
      playhead = Math.min(playhead, exitPlayhead * clamp(1 - (1 - clock) / 0.72));
    }
    if (enabled === active) return;
    active = enabled;
    impression.hidden = !active || panning;
    if (!active) {
      cancelAnimationFrame(raf);
      raf = 0;
      exitPlayhead = playhead;
      target = 0;
      hovered = false;
    } else wake();
  }

  function setPanning(value) {
    if (panning === value) return;
    panning = value;
    impression.hidden = !active || panning;
    if (panning) {
      hovered = false;
    }
    updateHover();
  }
  return { draw, setInteractive, setPanning };
}

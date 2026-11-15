import { drawPrintStock } from '../artwork/paper.js';

// Cache the print passes; only the limb registration and ray geometry move.
export function makeJoinSheet(canvas, w, h, plateRight, emblemMotion) {
  const y = h / 2;
  const r = Math.min(h * 0.158, w * 0.152, (w - plateRight) * 0.48);
  const moon = Math.max(w * 0.838, plateRight + r + 1);
  const cx = Math.min(w - r - 1, moon);
  const source = w * 0.494;
  const hair = Math.max(0.47, Math.min(0.95, w / 950));
  const densityX = canvas.width / w,
    densityY = canvas.height / h;
  // Keep the same pixel grid as the visible sheet. Transparent margins around
  // the orbit and satellite would otherwise cost two full high-DPI canvases.
  function layer(left = 0, top = 0, right = w, bottom = h) {
    const x = Math.max(0, Math.floor(left * densityX));
    const y = Math.max(0, Math.floor(top * densityY));
    const plate = document.createElement('canvas');
    plate.width = Math.max(1, Math.min(canvas.width, Math.ceil(right * densityX)) - x);
    plate.height = Math.max(1, Math.min(canvas.height, Math.ceil(bottom * densityY)) - y);
    const ink = plate.getContext('2d');
    ink.setTransform(densityX, 0, 0, densityY, -x, -y);
    return {
      ink,
      draw(ctx, offset = 0) {
        ctx.drawImage(
          plate,
          offset + x / densityX,
          y / densityY,
          plate.width / densityX,
          plate.height / densityY,
        );
      },
    };
  }
  const ringReach = r * 1.68 + 2;
  const paper = layer();
  const orbits = layer(cx - ringReach, y - ringReach, cx + ringReach, y + ringReach);
  const satellite = layer(cx - r - 2, y - r - 2, cx + r + 2, y + r + 2);
  let g = paper.ink;
  drawPrintStock(g, w, h, true);
  function line(x0, y0, x1, y1, color, width = hair) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  function circle(x, cy, radius, color, width = hair) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.arc(x, cy, radius, 0, 2 * Math.PI);
    g.stroke();
  }
  // A very large elliptical limb gives the boundary its shallow curvature.
  // Keep even the faint leading edge to the right of the resting rectangle.
  const rim = cx - r * 0.39,
    softness = Math.min(w * 0.15, (rim - plateRight) * 0.93);
  const sag = Math.min(w * 0.125, (rim - plateRight) * 0.48);
  const rx = w * 1.85,
    ry = y / Math.sqrt(1 - (1 - sag / rx) ** 2);
  const dark = layer();
  g = dark.ink;
  g.save();
  g.translate(rim - rx, y);
  g.scale(rx, ry);
  const field = g.createRadialGradient(0, 0, 0, 0, 0, 1.22);
  const stops = [
    [0, 'rgba(25,23,22,0)'],
    [1 - softness / rx, 'rgba(25,23,22,0)'],
    [1 - (softness / rx) * 0.64, 'rgba(29,28,27,.18)'],
    [1 - (softness / rx) * 0.28, 'rgba(18,18,18,.57)'],
    [1, 'rgba(6,6,6,.94)'],
    [1 + (softness / rx) * 0.21, '#050505'],
  ];
  for (const [pos, color] of stops) field.addColorStop(pos / 1.22, color);
  g.fillStyle = field;
  g.fillRect(-1, -2, 5, 4);
  g.restore();

  // Sparse offset-printed specks around the left datum and in the black sky.
  let seed = 1939;
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let i = 0; i < 202; i++) {
    const right = i > 176,
      x = right ? cx + (rand() - 0.22) * r * 1.8 : w * (0.257 + (rand() + rand() - 1) * 0.12);
    const py = rand() * h,
      size = hair * (0.6 + rand() * 1.55);
    g = right ? dark.ink : paper.ink;
    g.fillStyle = right ? 'rgba(245,241,231,.53)' : 'rgba(44,40,36,' + (0.18 + rand() * 0.4) + ')';
    g.fillRect(x, py, size, size);
  }
  g = paper.ink;
  const rule = '#514d4480',
    faint = '#5c554c50';
  line(w * 0.294, 0, w * 0.294, h, rule);
  line(w * 0.14, y, w * 0.295, y, faint);
  line(w * 0.14, y, w * 0.493, h * 0.946, faint);
  line(w * 0.49, h * 0.031, w * 0.49, h * 0.97, faint);
  for (const [level, gridY] of [
    [0.206, 0.2],
    [0.794, 0.735],
  ]) {
    const py = level * h,
      stem = w * 0.573;
    line(stem, py, w, py, '#8e8a817c');
    line(stem, py, stem, y, faint);
    const gridSize = Math.min(w * 0.089, h * 0.085);
    const x = w * 0.5 - gridSize * 0.5,
      gy = h * gridY;
    for (let col = 0; col <= 5; col++)
      line(x + (col * gridSize) / 5, gy, x + (col * gridSize) / 5, gy + gridSize * 1.32, faint);
    for (let row = 0; row <= 8; row++)
      line(
        x,
        gy + (row * gridSize * 1.32) / 8,
        x + gridSize,
        gy + (row * gridSize * 1.32) / 8,
        faint,
      );
    g.strokeStyle = rule;
    g.strokeRect(stem - gridSize * 0.16, py - gridSize * 0.13, gridSize * 0.32, gridSize * 0.26);
  }
  for (const py of [h * 0.06, h * 0.941]) {
    const cap = Math.min(w * 0.02, h * 0.025);
    g.strokeStyle = rule;
    g.strokeRect(w * 0.499 - cap / 2, py - h * 0.028, cap, h * 0.056);
    line(w * 0.499, py, w * 0.592, y, faint);
  }

  // Lines on the dark side are light ink, as in the photographic reference.
  g = orbits.ink;
  const wire = g.createLinearGradient(source, 0, cx, 0);
  wire.addColorStop(0, '#403b37b5');
  wire.addColorStop(0.57, '#4a4641a8');
  wire.addColorStop(1, '#c4bfb5a8');
  for (const size of [1.18, 1.42, 1.68]) circle(cx, y, r * size, wire);
  g = satellite.ink;
  g.save();
  g.beginPath();
  g.arc(cx, y, r, 0, 2 * Math.PI);
  g.clip();
  const shade = g.createLinearGradient(cx - r, 0, cx + r, 0);
  for (const [stop, color] of [
    [0, '#242424'],
    [0.17, '#4e4e4e'],
    [0.33, '#9e9d98'],
    [0.393, '#d3d1ca'],
    [0.395, '#faf8f0'],
    [1, '#fcfaf3'],
  ])
    shade.addColorStop(stop, color);
  g.fillStyle = shade;
  g.fillRect(cx - r, y - r, 2 * r, 2 * r);
  g.translate(cx, y);
  g.scale(r, r);
  g.lineWidth = hair / r;
  g.strokeStyle = '#34312db8';
  for (const [x, py, ww, hh] of [
    [-0.21, -1, 0.43, 0.24],
    [-0.21, -0.78, 0.97, 0.38],
    [-0.21, 0.39, 0.97, 0.36],
    [-0.2, 0.76, 0.44, 0.23],
  ])
    g.strokeRect(x, py, ww, hh);
  for (const dy of [-0.15, -0.063, -0.012, 0.05, 0.106, 0.164])
    line(-0.22, dy, 1.08, dy + 0.012, '#38352fc0', hair / r);
  for (const xx of [-0.23, 0.0, 0.25, 0.38])
    line(xx, -0.91, xx + 0.029, 0.67, '#6a655a99', hair / r);
  g.restore();
  circle(cx, y, r, '#44413c80');
  g = paper.ink;
  circle(source, y, r * 0.103, '#b3a89c70');
  circle(source, y, r * 0.148, '#b3a89c55');
  g.fillStyle = '#211e1c';
  g.beginPath();
  g.arc(source, y, r * 0.097, 0, Math.PI * 2);
  g.fill();
  const slopes = [-1.16, -0.83, -0.58, -0.36, -0.2, -0.08, 0, 0.08, 0.2, 0.36, 0.58, 0.83, 1.16];
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const ease = (n) => {
    const t = clamp(n);
    return t * t * t * (10 + t * (-15 + 6 * t));
  };
  return {
    draw(ctx, clock, fold, phase = 0, extension = 0) {
      // The broad pass leads; the satellite and engraving catch up on the
      // same front/tail curve as the site emblem, rather than sliding rigidly.
      const registration = emblemMotion(clamp(clock / 0.9) * 505);
      const satelliteMove = emblemMotion(clamp((clock - 0.06) / 0.94) * 505);
      const offset = (w - rim + softness) * (1 - registration.front);
      const orbitOffset = (w - rim + softness) * 0.48 * (1 - satelliteMove.tail);
      if (extension > 0) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(w - 1, 0, extension + 2, h);
      }
      paper.draw(ctx);
      dark.draw(ctx, offset);
      ctx.save();
      ctx.globalAlpha = ease((clock - 0.08) / 0.84);
      orbits.draw(ctx, orbitOffset);
      if (extension > 0) {
        // The rings were cached to one viewport. Engrave their remaining
        // arcs on the adjoining black stock as the camera crosses its edge.
        ctx.beginPath();
        ctx.rect(w, 0, extension, h);
        ctx.clip();
        ctx.strokeStyle = wire;
        ctx.lineWidth = hair;
        for (const size of [1.18, 1.42, 1.68]) {
          ctx.beginPath();
          ctx.arc(cx, y, r * size, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
      ctx.restore();
      // The rays stay straight. Their angular aperture closes around the
      // source, rather than bending or translating the whole background.
      const emission = emblemMotion(clamp((clock - 0.06) / 0.94) * 505);
      const reach = emission.front;
      const aperture = emission.tail * (1 - fold);
      const end = source + (w + extension - source) * reach;
      const ink = ctx.createLinearGradient(source, 0, cx, 0);
      ink.addColorStop(0, '#403b37b5');
      ink.addColorStop(0.57, '#4a4641a8');
      ink.addColorStop(1, '#c4bfb5a8');
      ctx.strokeStyle = ink;
      ctx.lineWidth = hair;
      ctx.beginPath();
      for (const slope of slopes) {
        ctx.moveTo(source, y);
        ctx.lineTo(end, y + slope * (end - source) * aperture);
      }
      ctx.stroke();
      // Small ink signals travel outwards on alternating rays. They move in
      // depth along the existing lines; no oscillation disturbs the engraving.
      if (clock === 1 && phase > 0) {
        const length = w - source;
        for (let i = 0; i < slopes.length; i += 2) {
          const t = (phase / 3800 + i * 0.137) % 1;
          const envelope = Math.sin(Math.PI * t) ** 2 * (1 - fold);
          const start = source + length * t,
            tail = Math.max(source, start - length * 0.055);
          ctx.globalAlpha = envelope * 0.48;
          ctx.strokeStyle = ink;
          ctx.lineWidth = hair * 1.8;
          ctx.beginPath();
          ctx.moveTo(tail, y + slopes[i] * (tail - source) * aperture);
          ctx.lineTo(start, y + slopes[i] * (start - source) * aperture);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      satellite.draw(ctx, (w - rim + softness) * 0.65 * (1 - satelliteMove.front));
    },
  };
}

import { drawPrintStock } from './paper.js';

// The same scanlines first stretch out of the print, then bend into strands.
// Every position follows the page clock, so reversing retraces the same artwork.
export function createUnionArtwork(ctx, emblemMotion) {
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const ease = (n) => {
    const t = clamp(n);
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const noise = (n) => {
    const x = Math.sin(127.1 * n + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  // Each column has a neck and a pin end, measured in viewport heights.
  const necks = [0.43, 0.38, 0.48, 0.55, 0.46, 0.4, 0.44];
  const ends = [0.64, 0.57, 0.69, 0.755, 0.67, 0.59, 0.63];
  const pinX = (lane, w, h) =>
    w * 0.5 + (lane - 3) * Math.min(w * (w < h ? 0.053 : 0.038), h * 0.052);
  const strands = new Map();
  let towerOutline, stock;
  // Sample the exact crop before it is printed on the opaque paper tile.
  function sampleTower(image, x, y, crop) {
    const mask = document.createElement('canvas');
    mask.width = mask.height = 512;
    const g = mask.getContext('2d');
    g.drawImage(image, x, y, crop, crop, 0, 0, 512, 512);
    let pixels;
    try {
      pixels = g.getImageData(0, 0, 512, 512).data;
    } catch {
      return;
    }
    towerOutline = new Int16Array(512).fill(-1);
    const bottom = Math.floor(256 + 256 / 1.12);
    for (let col = 0; col < 512; col++) {
      let run = 0;
      for (let row = bottom; row >= 512 - bottom; row--) {
        run = pixels[(row * 512 + col) * 4 + 3] >= 60 ? run + 1 : 0;
        if (run === 4) {
          towerOutline[col] = row;
          break;
        }
      }
    }
  }

  function fibers(i, tile, aspect) {
    if (strands.has(i)) return strands.get(i);
    const hero = i === 29,
      count = hero ? 196 : 56;
    const sampleHeight = Math.min(512, 512 * aspect);
    let pixels;
    const cropTop = (512 - sampleHeight) / 2;
    const bottom = Math.min(511, Math.floor(cropTop + sampleHeight - 1));
    try {
      pixels = tile.getContext('2d').getImageData(0, hero ? 0 : bottom, 512, hero ? 512 : 1).data;
    } catch {
      /* File previews can prohibit pixel reads. */
    }
    const rows = [];
    for (let j = 0; j < count; j++) {
      const seed = i * 203 + j,
        column = (j + 0.5) / count;
      const col = Math.floor(512 * column);
      const py = hero ? (towerOutline?.[col] ?? bottom) : bottom;
      if (py < cropTop) continue;
      const off = 4 * (hero ? py * 512 + col : col);
      const ink = pixels ? Array.from(pixels.subarray(off, off + 3)) : [154, 130, 116];
      const light = 0.2126 * ink[0] + 0.7152 * ink[1] + 0.0722 * ink[2];
      const tint = noise(seed + 7),
        tone = 105 + light * 0.46 + tint * 26;
      rows.push({
        column,
        origin: (py - cropTop) / sampleHeight,
        ink,
        count,
        silk: tint > 0.94 ? [165, 91, 106] : [tone + 3, tone, tone + 9],
        spread: noise(seed + 5),
        crossing: noise(seed + 13),
      });
    }
    strands.set(i, rows);
    return rows;
  }

  const chalk = '#eae3d7',
    vermilion = '#b74733';
  const flare = new Path2D(
    'M-1 0C-.27 -.035 -.09 -.11 0 -.86C.05 -.24 .12 -.055 1 0C.27 .04 .07 .12 0 .84C-.06 .25 -.18 .045 -1 0Z',
  );

  // The print above the lettering occupies the same field at every aspect ratio.
  function wordHeight(w, h) {
    const sx = (w - 2 * Math.max(2, Math.min(w, h) * 0.006)) / wordWidth;
    return Math.min(h * 0.315, Math.max(sx * 100, h * 0.18));
  }

  function engrave(g, w, h, clock) {
    const field = h - wordHeight(w, h);
    const mobile = w < h;
    const cx = w * 0.5;
    const cy = field * (mobile ? 0.54 : 0.435);
    const unit = Math.min(w / 1100, field / 410);
    const arrival = emblemMotion(clamp((clock - 0.14) / 0.86) * 505);

    function line(x1, y1, x2, y2) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }

    // The leading ends leave the centre first. The trailing ends open the gaps.
    // Every distance is in screen pixels, so the fan retains its angles on phones.
    const rays = mobile ? 28 : 62;
    const inner = mobile ? w * 0.34 : Math.min(w * 0.19, field * 0.43);
    const bands = [
      [inner, inner * 1.85],
      [inner * 2.06, Infinity],
    ];
    const emissions = bands.map((_, band) =>
      emblemMotion(clamp((clock - 0.08 - band * 0.065) / (0.92 - band * 0.065)) * 505),
    );
    g.save();
    g.translate(cx, cy);
    for (let i = 0; i < rays; i++) {
      const angle = (i * 2 * Math.PI) / rays + 0.055;
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      // Keep the dense upper centre for the gallery fibres and their needle ends.
      const quiet = mobile && dy < 0.3 ? 0.45 : 1;
      const edgeX = (dx > 0 ? w - cx : cx) / Math.abs(dx);
      const edgeY = (dy > 0 ? h - cy : cy) / Math.abs(dy);
      const edge = Math.min(edgeX, edgeY) + 4;
      g.lineWidth = mobile ? 0.65 : 0.82;
      bands.forEach(([start, end], band) => {
        const stop = Math.min(end, edge);
        if (start >= stop) return;
        const { front, tail } = emissions[band];
        const lead = stop * front;
        g.strokeStyle = i % 5 === 0 ? '#d9dbe0' : '#b9bdc4';
        g.globalAlpha = (mobile ? 0.23 : 0.31) * quiet;
        line(dx * start * tail, dy * start * tail, dx * lead, dy * lead);
        // A short pale leading stroke makes the outward travel legible.
        g.strokeStyle = '#f1ede3';
        g.globalAlpha = Math.min(0.65, (front - tail) * 2.8) * quiet;
        const head = Math.max(start * tail, lead - 14);
        line(dx * head, dy * head, dx * lead, dy * lead);
      });
    }
    g.restore();

    // Orbit arcs unfurl in both directions, at a slower depth than the rays.
    const orbit = emblemMotion(clamp((clock - 0.24) / 0.76) * 505);
    g.save();
    g.globalAlpha = orbit.front * 0.36;
    g.strokeStyle = '#a7a9a9';
    g.lineWidth = 0.7;
    if (mobile) {
      const radius = Math.max(w * 0.78, field * 0.35);
      for (const [x, y, angle] of [
        [w * 0.12 - radius, field * 0.4, 0],
        [w * 0.88 + radius, field * 0.71, Math.PI],
      ]) {
        const ox = mix(cx, x, orbit.front);
        const oy = mix(cy, y, orbit.front);
        const r = radius * orbit.front;
        g.beginPath();
        g.arc(ox, oy, r, angle - orbit.tail * 1.18, angle + orbit.tail * 1.18);
        g.stroke();
      }
    } else {
      g.beginPath();
      g.ellipse(
        w * 0.493,
        -field * 0.15,
        w * 0.374 * orbit.front,
        field * 0.8 * orbit.front,
        0,
        0,
        Math.PI * orbit.tail,
      );
      g.stroke();
      g.beginPath();
      g.ellipse(
        w * 0.49,
        field * 0.86,
        w * 0.37 * orbit.front,
        field * 0.79 * orbit.front,
        -0.05,
        -Math.PI / 2,
        -Math.PI / 2 + 2 * Math.PI * orbit.tail,
      );
      g.stroke();
    }
    g.restore();

    // A sparse edge register gives tall screens a calm centre and a clear bottom.
    g.save();
    g.globalAlpha = arrival.tail * 0.37;
    g.strokeStyle = '#a3a4a4';
    g.lineWidth = 0.65;
    const pitch = mobile ? Math.max(64, w * 0.2) : w / 12;
    for (let col = 0; col * pitch < w; col++) {
      for (let row = 0; row * pitch < field; row++) {
        const x = (col + 0.44) * pitch,
          y = (row + 0.44) * pitch;
        if (mobile && x > w * 0.22 && x < w * 0.78) continue;
        const px = mix(cx, x, arrival.tail),
          py = mix(cy, y, arrival.tail);
        line(px - 1.8, py, px + 1.8, py);
        line(px, py - 1.8, px, py + 1.8);
      }
    }
    g.restore();

    // Spot-ink figures stay on the periphery of the foreground fibre bundle.
    const flight = mobile
      ? [
          [0.1, 0.3, 7, -0.44, 0],
          [0.9, 0.66, 9, -0.3, 0],
          [0.08, 0.75, 4, -0.35, 1],
          [0.93, 0.35, 4, -0.46, 1],
        ]
      : [
          [0.11, 0.71, 8, -0.48, 1],
          [0.19, 0.66, 16, -0.23, 0],
          [0.24, 0.62, 22, -0.4, 0],
          [0.29, 0.58, 9, 0.28, 1],
          [0.76, 0.36, 13, -0.88, 0],
          [0.82, 0.29, 20, 0.43, 0],
          [0.9, 0.22, 8, -0.42, 1],
        ];
    flight.forEach(([x, y, r, angle, pass]) => {
      g.save();
      g.translate(mix(cx, x * w, arrival.front), mix(cy, y * field, arrival.front));
      g.rotate(angle);
      g.globalAlpha = (pass === 0 ? 0.48 : 0.58) * arrival.front;
      const radius = r * (mobile ? Math.min(w / 390, 1.25) : unit) * arrival.front;
      if (radius > 0) {
        g.scale(radius, radius * 0.79);
        g.fillStyle = pass ? vermilion : chalk;
        g.fill(flare);
        if (!pass) {
          g.clip(flare);
          g.fillStyle = '#34302c';
          for (let n = -10; n < 12; n++) {
            g.beginPath();
            g.moveTo(-1, n * 0.1);
            g.lineTo(0.72, n * 0.1 - 0.63);
            g.lineTo(0.72, n * 0.1 - 0.606);
            g.lineTo(-1, n * 0.1 + 0.026);
            g.fill();
          }
        }
      }
      g.restore();
    });

    g.save();
    g.globalAlpha = arrival.tail * 0.65;
    g.fillStyle = '#87888a';
    const barHeight = mobile ? Math.min(42, field * 0.09) : field * 0.4;
    g.fillRect(w * (mobile ? 0.065 : 0.19), field * 0.08, mobile ? 2 : w * 0.013, barHeight);
    g.fillStyle = vermilion;
    const stamp = mobile ? 6 : Math.max(9, 20 * unit);
    g.fillRect(w * 0.085, field * 0.79, stamp, stamp);
    g.fillStyle = chalk;
    const tickCount = mobile ? 9 : 21;
    const tickPitch = mobile ? w * 0.01 : Math.max(2, 4 * unit);
    const tickX = w * (mobile ? 0.82 : 0.281);
    for (let i = 0; i < tickCount; i++) {
      g.fillRect(
        tickX + i * tickPitch,
        field * (mobile ? 0.1 : 0.21),
        0.7,
        mobile ? 4 : Math.max(6, 10 * unit),
      );
    }
    g.restore();
  }

  function paper(sheet, clock, w, h) {
    if (!sheet) return;
    if (!stock) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 256;
      drawPrintStock(tile.getContext('2d'), 256, 256);
      stock = ctx.createPattern(tile, 'repeat');
    }
    ctx.save();
    ctx.globalAlpha = 1;
    // The stock rises from below while its engraved rays travel out from the centre.
    ctx.beginPath();
    ctx.rect(0, h * (1 - sheet), w, h * sheet);
    ctx.clip();
    ctx.fillStyle = stock;
    ctx.fillRect(0, 0, w, h);
    engrave(ctx, w, h, clock);
    ctx.restore();
  }

  function trail(t, w, h, f, i, tile, dy) {
    const rows = fibers(i, tile, f.h / f.w);
    const fiberHeight = (h - wordHeight(w, h)) * 1.12;
    ctx.save();
    for (const s of rows) {
      const x = f.x + (s.column - 0.5) * f.w;
      const origin = f.y + (s.origin - 0.5) * f.h;
      const y0 = Math.max(-h * 0.06, origin - dy);
      const release = Math.max(0.35, (origin + h * 0.06) / (dy / t));
      const progress = clamp((t - release) / (1 - release));
      const gather = 1 - (1 - progress) ** 3;
      // Hold the top at the sampled column. Only the lower end travels inward.
      const lane = Math.round(6 * clamp(((0.66 * x) / w + 0.34 * s.crossing - 0.1) / 0.8));
      const tip = pinX(lane, w, h);
      const tx = mix(x, tip, gather);
      const ty = mix(origin, fiberHeight * necks[lane], gather);
      const length = ty - y0;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(
        mix(x, tx, 0.12 + 0.24 * s.spread),
        y0 + length * (0.19 + 0.22 * s.crossing),
        tx,
        y0 + length * (0.48 + 0.16 * s.spread),
        tx,
        ty,
      );
      ctx.lineWidth = mix(Math.max(0.75, (f.w / s.count) * 1.08), 0.42 + 0.47 * s.spread, gather);
      ctx.globalAlpha = f.alpha * mix(0.94, 0.32 + 0.34 * s.spread, gather);
      ctx.strokeStyle =
        'rgb(' + s.ink.map((c, k) => Math.round(mix(c, s.silk[k], gather))).join(',') + ')';
      ctx.stroke();
    }
    ctx.restore();
  }

  // The white slugs are also the seven moving pieces of the next sheet.
  function pinGeometry(t, w, h) {
    const field = (h - wordHeight(w, h)) * 1.12;
    return ends.map((end, lane) => {
      const grow = ease((t - 0.62 - Math.abs(3 - lane) * 0.017) / 0.31);
      const x = pinX(lane, w, h),
        neck = field * necks[lane];
      const length = field * (end - necks[lane]) * grow;
      return {
        x: x - 1.3,
        y: neck + length * 0.56,
        width: 2.6,
        height: length * 0.23,
        neck,
        length,
        grow,
      };
    });
  }

  function pins(t, w, h, drawSlugs) {
    ctx.save();
    for (const pin of pinGeometry(t, w, h)) {
      if (!pin.grow) continue;
      ctx.globalAlpha = pin.grow;
      const fade = ctx.createLinearGradient(0, pin.neck, 0, pin.neck + pin.length);
      fade.addColorStop(0, '#f3eeeb');
      fade.addColorStop(1, '#c2b8bf55');
      ctx.fillStyle = fade;
      ctx.fillRect(pin.x + 0.8, pin.neck, 1, pin.length);
      if (drawSlugs) {
        ctx.fillStyle = '#faf5ec';
        ctx.fillRect(pin.x, pin.y, pin.width, pin.height);
      }
    }
    ctx.restore();
  }

  // A single printing master for both the solid face and its three impressions.
  // The broad shoulders and narrow counters share a 64-unit cap height.
  const masters = {
    U: [94, 'M0 0H26V36Q26 45 36 45H58Q68 45 68 36V0H94V39Q94 64 66 64H28Q0 64 0 39Z'],
    N: [102, 'M0 64V0H28L76 36V0H102V64H75L26 27V64Z'],
    I: [28, 'M0 0H28V64H0Z'],
    O: [
      104,
      'M29 0H75Q104 0 104 26V38Q104 64 75 64H29Q0 64 0 38V26Q0 0 29 0Z M35 20Q26 20 26 29V35Q26 44 35 44H69Q78 44 78 35V29Q78 20 69 20Z',
    ],
  };
  const paths = Object.fromEntries(
    Object.entries(masters).map(([letter, [, d]]) => [letter, new Path2D(d)]),
  );
  const tracking = 3.5;
  let wordWidth = -tracking;
  const letters = Array.from('UNION', (letter) => {
    const left = wordWidth + tracking;
    wordWidth = left + masters[letter][0];
    return { left, path: paths[letter] };
  });

  const word = new Path2D();
  for (const { left, path } of letters) word.addPath(path, new DOMMatrix().translate(left, 0));
  // The gaps between impressions are 20, 11 and 5 units from front to back.
  const impressions = [
    { offset: 36, depth: 1, stroke: '#c97255' },
    { offset: 31, depth: 0.76, stroke: '#dda58d' },
    { offset: 20, depth: 0.44, stroke: '#e9d6c0' },
    { offset: 0, depth: 0 },
  ];

  function drawWord(clock, w, h) {
    const travel = clamp((clock - 0.15) / 0.85);
    if (!travel) return;
    const { front, tail } = emblemMotion(travel * 505);
    const margin = Math.max(2, Math.min(w, h) * 0.006);
    const sx = (w - 2 * margin) / wordWidth;
    const sy = wordHeight(w, h) / 100;
    const base = h - margin - 100 * sy;
    for (const { offset, depth, stroke } of impressions) {
      const lift = mix(front, tail, depth);
      const perspective = mix(0.79 + depth * 0.12, 1, lift);
      const y = mix(h + sy * 8, base + sy * offset, lift);
      ctx.save();
      ctx.translate(w / 2, y);
      ctx.scale(perspective, mix(0.53 + depth * 0.13, 1, lift));
      if (!stroke) drawAnd(travel, w, h);
      ctx.scale(sx, sy);
      ctx.translate(-wordWidth / 2, 0);
      ctx.fillStyle = stroke ? '#292622' : '#efe7d8';
      ctx.fill(word, 'evenodd');
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(0.62, 1 / sx);
        ctx.stroke(word);
      } else {
        const redHeight = 64 * (1 - ease((travel - 0.12) / 0.57));
        ctx.beginPath();
        ctx.rect(0, 0, wordWidth, redHeight);
        ctx.clip();
        ctx.fillStyle = '#c64c35';
        ctx.fill(word, 'evenodd');
      }
      ctx.restore();
    }
  }

  function drawAnd(progress, w, h) {
    if (!progress) return;
    const field = h - wordHeight(w, h);
    const em = Math.min(54, Math.max(22, w * 0.024), field * 0.095);
    const y = -Math.max(6, em * 0.28);
    const text = 'AND',
      cipher = '/+?X#:%';
    ctx.save();
    ctx.font = em + 'px Didot, Georgia, serif';
    ctx.fillStyle = '#f2ece0';
    let pen = -ctx.measureText(text).width / 2;
    for (let i = 0; i < text.length; i++) {
      const phase = clamp(progress * 3.7 - i * 0.89);
      if (!phase) break;
      const letter =
        phase === 1 ? text[i] : cipher[(Math.floor(phase * 4) + i * 3) % cipher.length];
      ctx.fillText(letter, pen, y);
      pen += ctx.measureText(text[i]).width;
    }
    if (progress < 1) {
      ctx.fillStyle = vermilion;
      ctx.fillRect(pen + 2, y - em * 0.68, Math.max(2, em * 0.063), em * 0.72);
    }
    ctx.restore();
  }

  function type(t, clock, w, h, drawSlugs = true) {
    if (!clock) return;
    ctx.save();
    ctx.globalAlpha = 1;
    pins(t, w, h, drawSlugs);
    drawWord(clock, w, h);
    ctx.restore();
  }
  return { paper, trail, type, pinGeometry, sampleTower };
}

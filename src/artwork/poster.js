import { constrainedRendering, printDensity } from '../core/render-budget.js';
import { printGrain, getPaperGrain } from './paper.js';

// Two ink passes let the broad shapes settle before the fine engraving appears.
const towerPrint = (() => {
  const ink = '#292622',
    red = '#a32b20',
    paper = '#eee9df';
  const stone = document.querySelector('.stones img');
  const facade = document.querySelector('.tower img');
  const landscape = document.querySelector('.sky img');
  const masses = document.querySelector('.print-masses');
  const spear = document.querySelector('.print-blade canvas');
  const band = document.querySelector('.print-band');
  const overprint = document.querySelector('.print-overprint');
  const orbits = document.querySelector('.print-orbits');
  const meridians = document.querySelector('.print-meridians');
  const dots = document.querySelector('.print-dots');
  const satellitesLayer = document.querySelector('.print-satellites');
  const rings = document.querySelectorAll('.print-ring');
  let grain;
  const photoCache = new WeakMap();

  function prepare(canvas, width, height, density) {
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(((canvas.width / width) * height) / 900, 0, 0, canvas.height / 900, 0, 0);
    return ctx;
  }

  function prepareBand(width, height, portrait) {
    // The band only paints this narrow strip. A full-viewport transparent
    // backing store wastes memory and does not contribute to the artwork.
    const top = portrait ? 715 : 409;
    const stripHeight = portrait ? 68 : 106;
    const screenHeight = (stripHeight * height) / 900;
    const density = printDensity(width, screenHeight, false);
    band.width = Math.max(1, Math.round(width * density));
    band.height = Math.max(1, Math.round(screenHeight * density));
    band.style.cssText = `top:${top / 9}%;height:${stripHeight / 9}%`;
    const ctx = band.getContext('2d');
    ctx.setTransform(band.width / ((900 * width) / height), 0, 0, band.height / stripHeight, 0, 0);
    ctx.translate(0, -top);
    return ctx;
  }

  function photo(ctx, image, x, y, w, h, alpha) {
    if (!image.naturalWidth) return;
    let plate = photoCache.get(image);
    if (!plate) {
      plate = document.createElement('canvas');
      const scale = Math.min(
        1,
        (constrainedRendering ? 800 : 1600) / Math.max(image.naturalWidth, image.naturalHeight),
      );
      plate.width = Math.round(image.naturalWidth * scale);
      plate.height = Math.round(image.naturalHeight * scale);
      const ink = plate.getContext('2d');
      ink.filter = 'grayscale(1)';
      ink.drawImage(image, 0, 0, plate.width, plate.height);
      photoCache.set(image, plate);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    // Match the opening scene's cover layout: crop the photograph, never
    // change its aspect ratio when the print reflows to another viewport.
    const cover = Math.max(w / plate.width, h / plate.height);
    const sourceWidth = w / cover,
      sourceHeight = h / cover;
    ctx.drawImage(
      plate,
      (plate.width - sourceWidth) / 2,
      (plate.height - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      x,
      y,
      w,
      h,
    );
    ctx.restore();
  }

  function disc(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function architecturalRing(ctx, x, y, radius, thickness) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.arc(x, y, radius - thickness, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    ctx.fillStyle = '#a5a198';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    photo(ctx, stone, x - radius, y - radius, radius * 2, radius * 2, 0.52);
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function bladePoints(w, cx, cy, r) {
    // Four cardinal tips and four concave corners share one rotated axis.
    // All lengths use the same units so the star retains its geometry on phones.
    const portrait = w < 720;
    const longAxis = portrait ? w * 0.92 : Math.min(w * 0.65, 990);
    const shortAxis = portrait ? w * 0.78 : 650;
    const waist = portrait ? w * 0.15 : r * 0.3;
    const points = [
      [longAxis, 0],
      [waist, waist],
      [0, shortAxis],
      [-waist, waist],
      [-longAxis, 0],
      [-waist, -waist],
      [0, -shortAxis],
      [waist, -waist],
    ];
    const angle = -Math.PI / 7;
    return points.map(([x, y]) => [
      cx + x * Math.cos(angle) - y * Math.sin(angle),
      cy + x * Math.sin(angle) + y * Math.cos(angle),
    ]);
  }

  function broadPass(ctx, w, portrait) {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, 900);
    photo(ctx, landscape, 0, 0, w, 900, 0.075);
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(0, 0, w, 900);
    // Short calibrated marks act as the edges of the physical print.
    const count = portrait ? 9 : 17;
    ctx.fillStyle = ink;
    for (const y of [51, 849]) {
      for (let i = 0; i < count; i++) {
        if (y > 800 && Math.abs(i / (count - 1) - 0.5) < 0.105) continue;
        ctx.fillRect(21 + ((w - 46) * i) / (count - 1), y, 4, 4);
      }
    }
    ctx.strokeStyle = 'rgba(101,62,48,.35)';
    ctx.lineWidth = 0.7;
    for (const y of [266, 636]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function spearPass(w, height, cx, cy, r) {
    const points = bladePoints(w, cx, cy, r);
    const left = Math.floor(Math.min(...points.map(([x]) => x))) - 2;
    const top = Math.floor(Math.min(...points.map(([, y]) => y))) - 2;
    const right = Math.ceil(Math.max(...points.map(([x]) => x))) + 2;
    const bottom = Math.ceil(Math.max(...points.map(([, y]) => y))) + 2;
    const plateWidth = right - left,
      plateHeight = bottom - top;
    const density = printDensity((plateWidth * height) / 900, (plateHeight * height) / 900, false);
    spear.width = Math.ceil(((plateWidth * height) / 900) * density);
    spear.height = Math.ceil(((plateHeight * height) / 900) * density);
    spear.style.cssText = `left:${(left / w) * 100}%;top:${top / 9}%;width:${(plateWidth / w) * 100}%;height:${plateHeight / 9}%`;
    const ctx = spear.getContext('2d');
    ctx.scale(spear.width / plateWidth, spear.height / plateHeight);
    ctx.translate(-left, -top);
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = red;
    ctx.fillRect(left, top, plateWidth, plateHeight);
    ctx.globalCompositeOperation = 'luminosity';
    photo(ctx, landscape, 0, -30, w, 950, 0.27);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(left, top, plateWidth, plateHeight);
  }

  // Give the rings their complete image bounds. The portion originally outside
  // the viewport becomes visible as the camera passes it.
  function ringLayout(w, portrait) {
    const radius = portrait ? w * 0.74 : 440;
    const centers = portrait
      ? [
          [-0.33, 150],
          [1.33, 690],
        ]
      : [
          [0.035, 110],
          [0.965, 790],
        ];
    return centers.map(([x, y]) => ({ x, y, radius }));
  }

  function paintRing(ring, { x, y, radius }, w, height) {
    const diameter = 2 * radius;
    const pixels = Math.ceil(
      ((diameter * height) / 900) *
        printDensity((diameter * height) / 900, (diameter * height) / 900, false),
    );
    ring.width = ring.height = Math.min(1800, pixels);
    ring.style.cssText = `left:${(x - radius / w) * 100}%;top:${(y - radius) / 9}%;width:${(diameter / w) * 100}%;height:${diameter / 9}%`;
    const ctx = ring.getContext('2d');
    ctx.scale(ring.width / diameter, ring.height / diameter);
    architecturalRing(ctx, radius, radius, radius, radius * 0.31);
  }

  function bandPass(ctx, w, portrait) {
    const top = portrait ? 715 : 409,
      height = portrait ? 68 : 106;
    ctx.fillStyle = ink;
    ctx.fillRect(0, top, w, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, w, height);
    ctx.clip();
    photo(ctx, facade, -w * 0.14, top - 358, w * 0.58, 630, 0.27);
    photo(ctx, facade, w * 0.64, top - 267, w * 0.48, 518, 0.33);
    ctx.restore();
    ctx.fillStyle = red;
    ctx.fillRect(0, top, w * 0.016, height);
    ctx.fillRect(w * 0.984, top, w * 0.016, height);
    printGrain(ctx, 0, top, w, height);
  }

  function finePass(ctx, w, cx, cy, r, portrait) {
    const tau = Math.PI * 2;
    ctx.strokeStyle = 'rgba(255,249,232,.53)';
    ctx.lineWidth = 0.75;
    for (let i = 0; i < 84; i++) {
      const a = (i * tau) / 84;
      const reach = portrait || i % 3 ? r * 1.14 : w + 900;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25);
      ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
      ctx.stroke();
    }
    for (const [scale, width, dash] of [
      [1.17, 1.7, [1, 4]],
      [1.105, 1.25, []],
      [0.89, 0.65, []],
    ]) {
      ctx.strokeStyle = red;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, tau);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 60; i++) {
      const a = (i * tau) / 60 - Math.PI / 2;
      const x = Math.cos(a),
        y = Math.sin(a);
      ctx.strokeStyle = ink;
      ctx.lineWidth = i % 5 ? 0.7 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + x * r * 1.105, cy + y * r * 1.105);
      const end = i % 5 ? 1.122 : 1.145;
      ctx.lineTo(cx + x * r * end, cy + y * r * end);
      ctx.stroke();
    }
  }

  function placeGeometry(w, cx, cy, r, portrait) {
    for (const layer of [meridians, dots, satellitesLayer]) layer.replaceChildren();
    function shape(layer, className, x, y, width, height) {
      const element = document.createElement('i');
      element.className = className;
      element.style.cssText = `left:${(x / w) * 100}%;top:${y / 9}%;width:${(width / w) * 100}%;height:${height / 9}%`;
      layer.append(element);
    }
    const half = portrait ? 2 : 7;
    for (let i = -half; i <= half; i++) {
      const offset = i / half;
      const rx = w * (0.038 + 0.142 * offset * offset);
      shape(meridians, 'print-meridian', cx + offset * w * 0.385 - rx, 4, rx * 2, 892);
    }
    for (let i = 0; i < 36; i++) {
      const angle = ((i + 0.5) * Math.PI * 2) / 36;
      const radius = r * 0.033;
      shape(
        dots,
        'print-dot',
        cx + Math.cos(angle) * r - radius,
        cy + Math.sin(angle) * r - radius,
        radius * 2,
        radius * 2,
      );
    }
    const satellites = portrait
      ? [
          [0.88, 95, 28],
          [0.12, 680, 22],
        ]
      : [
          [0.33, -16, 58],
          [0.72, 26, 57],
          [0.84, 214, 68],
          [0.81, 721, 58],
          [0.27, 920, 73],
        ];
    satellites.forEach(([x, y, radius]) =>
      shape(satellitesLayer, 'print-satellite', w * x - radius, y - radius, radius * 2, radius * 2),
    );
  }

  function bakeEndcap(w, portrait) {
    // Bake the endcap at band height, with the same ink and grain as its source.
    const stripHeight = portrait ? 68 : 106;
    overprint.width = band.width;
    overprint.height = band.height;
    const cap = overprint.getContext('2d');
    cap.scale(overprint.width / w, overprint.height / stripHeight);
    cap.fillStyle = red;
    cap.fillRect(0, 0, w, stripHeight);
    printGrain(cap, 0, 0, w, stripHeight);
  }

  function geometryLayout(width, height) {
    const w = (900 * width) / height,
      cx = w / 2,
      cy = 456;
    const portrait = width / height <= 0.8;
    return { w, cx, cy, portrait, r: Math.min(277, w * 0.445) };
  }

  let geometryWidth = 0,
    geometryHeight = 0;
  function place(width, height) {
    if (!width || !height || (width === geometryWidth && height === geometryHeight)) return;
    geometryWidth = width;
    geometryHeight = height;
    const { w, cx, cy, r, portrait } = geometryLayout(width, height);
    placeGeometry(w, cx, cy, r, portrait);
  }

  function* stages(width, height) {
    if (!width || !height) return;
    grain ||= getPaperGrain();
    const { w, cx, cy, r, portrait } = geometryLayout(width, height);
    broadPass(prepare(masses, width, height, printDensity(width, height, false)), w, portrait);
    yield;
    // One ring per slice: either ring is a large canvas of its own.
    const layout = ringLayout(w, portrait);
    for (let i = 0; i < rings.length; i++) {
      paintRing(rings[i], layout[i], w, height);
      yield;
    }
    spearPass(w, height, cx, cy, r);
    yield;
    bandPass(prepareBand(width, height, portrait), w, portrait);
    yield;
    bakeEndcap(w, portrait);
    yield;
    finePass(prepare(orbits, width, height, printDensity(width, height)), w, cx, cy, r, portrait);
  }

  function draw(width, height) {
    place(width, height);
    const bake = stages(width, height);
    while (!bake.next().done);
  }

  return { draw, stages, place };
})();

// drawTowerPrint stays the one-shot entry point; stageTowerPrint exposes the
// same bake as resumable slices for the idle prewarm.
export const drawTowerPrint = towerPrint.draw;
export const stageTowerPrint = towerPrint.stages;
export const placeTowerGeometry = towerPrint.place;

import { drawSloganPrint } from '../artwork/slogan-prints.js';
import { printDensity } from '../core/render-budget.js';
import { createUnionArtwork } from '../artwork/union.js';
import { createJoinPrint } from '../join/join-print.js';

// Each opaque tile has the same staggered 1.6px dots. Recording their four
// covered pixels on all 256 background levels preserves the browser's own
// edge blending, including the rounding on translucent ink.
function dotColors(color) {
  const strip = document.createElement('canvas');
  strip.width = 512;
  strip.height = 2;
  const ctx = strip.getContext('2d', { willReadFrequently: true });
  const ramp = ctx.createImageData(512, 2);
  for (let i = 0; i < ramp.data.length; i += 4) {
    ramp.data.fill((i >> 3) & 255, i, i + 3);
    ramp.data[i + 3] = 255;
  }
  ctx.putImageData(ramp, 0, 0);
  ctx.fillStyle = color;
  for (let x = 0; x < 512; x += 2) ctx.fillRect(x, 0, 1.6, 1.6);
  return ctx.getImageData(0, 0, 512, 2).data;
}

function applyDots(ctx, colors) {
  const { width, height } = ctx.canvas;
  const pixels = ctx.getImageData(0, 0, width, height);
  const rgba = pixels.data;
  for (let y = 1; y < height; y += 7) {
    for (let x = (y % 2) * 3; x < width; x += 7) {
      for (let row = 0; row < 2 && y + row < height; row++) {
        for (let col = 0; col < 2 && x + col < width; col++) {
          const dst = ((y + row) * width + x + col) * 4;
          const edge = (row * 512 + col) * 4;
          for (let c = 0; c < 3; c++) rgba[dst + c] = colors[rgba[dst + c] * 8 + edge + c];
        }
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

// Positions are in viewport widths along a single horizontal exhibition.
export function createGallery(scene, reducedMotion, emblemMotion, sheetEase, onChange) {
  const canvas = scene.querySelector('.gallery');
  const ctx = canvas.getContext('2d');
  const poster = scene.querySelector('.poster');
  const towerPlane = scene.querySelector('.tower');
  const overprint = scene.querySelector('.print-overprint');
  // The eight print layers that travel with the camera. Offsets are written
  // straight onto them so no inherited property invalidates the poster subtree.
  const ringFar = poster.querySelector('.ring-far');
  const ringNear = poster.querySelector('.ring-near');
  const blade = poster.querySelector('.print-blade');
  const dots = poster.querySelector('.print-dots');
  const orbitLayer = poster.querySelector('.print-orbits');
  const satellites = poster.querySelector('.print-satellites');
  const band = poster.querySelector('.print-band');
  const title = poster.querySelector('.print-title');
  const sky = scene.querySelector('.sky img');
  const ground = scene.querySelector('.ground img');
  const tower = scene.querySelector('.tower img');
  const logo = scene.querySelector('.print-title img');
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const smooth = (n) => {
    const t = clamp(n);
    return t * t * (3 - 2 * t);
  };
  // The first gallery composition sits at camera zero; the poster is one
  // approach to its left. Wheel, touch and keys all move on this same track.
  const approach = 1.34;
  let end = 2.55;
  const nodes = [
    [0.12, 0.66, 0.14],
    [0.21, 0.26, 0.11],
    [0.29, 0.46, 0.08],
    [0.34, 0.72, 0.17],
    [0.43, 0.35, 0.14],
    [0.49, 0.19, 0.1],
    [0.57, 0.63, 0.17],
    [0.65, 0.79, 0.1],
    [0.7, 0.27, 0.18],
    [0.79, 0.51, 0.16],
    [0.89, 0.72, 0.1],
    [0.93, 0.3, 0.12],
    [1.11, 0.44, 0.21],
    [1.25, 0.68, 0.12],
    [1.38, 0.25, 0.15],
    [1.51, 0.53, 0.18],
    [1.65, 0.74, 0.1],
    [1.77, 0.3, 0.2],
    [1.91, 0.57, 0.13],
    [2.05, 0.77, 0.15],
    [2.17, 0.26, 0.11],
    [2.28, 0.5, 0.18],
    [2.4, 0.69, 0.1],
    [2.5, 0.24, 0.13],
    [2.66, 0.65, 0.14],
    [2.91, 0.77, 0.06],
    [3.0, 0.22, 0.06],
    [3.1, 0.53, 0.07],
    [3.19, 0.33, 0.05],
    [3.32, 0.55, 0.31],
    [3.49, 0.72, 0.065],
    [3.18, 0.74, 0.029],
    [3.08, 0.67, 0.041],
    [2.91, 0.57, 0.032],
    [3.05, 0.38, 0.034],
  ];
  // Larger prints sit nearer the viewer. Render them over the smaller ones.
  const depths = nodes.map(([, , size]) => 0.78 + Math.min(size, 0.23) * 2.55);
  const paintOrder = nodes.map((_, index) => index).sort((a, b) => depths[a] - depths[b]);
  const labels = new Map([
    [3, '团结'],
    [12, '平等'],
    [21, '秩序'],
  ]);
  // Original tile IDs also identify the matching UNION trails.
  const narrowNodes = new Map([
    [0, [0.15, 0.26, 0.14]],
    [3, [0.51, 0.49, 0.63]],
    [6, [0.88, 0.73, 0.17]],
    [10, [1.22, 0.36, 0.13]],
    [12, [1.63, 0.55, 0.61]],
    [15, [1.98, 0.26, 0.18]],
    [18, [2.26, 0.67, 0.15]],
    [21, [2.69, 0.45, 0.64]],
    [24, [3.06, 0.72, 0.18]],
    [27, [3.45, 0.31, 0.12]],
    [29, [3.96, 0.55, 0.57]],
    [30, [4.36, 0.77, 0.13]],
  ]);
  const desktopIds = nodes.map((_, i) => i);
  const narrowIds = [...narrowNodes.keys()];
  let narrow = false;
  const tiles = new Map();
  const dotInks = new Map();
  const union = createUnionArtwork(ctx, emblemMotion);
  const unionPage = 1.62;
  const joinPage = 2,
    limit = 3;
  const footer = scene.querySelector('.join-footer');
  let footerPosition = 0,
    footerWidth = 0;
  const pageDuration = 820;
  const wipeDuration = 720;
  let unionStill;
  let pageTime = 0;
  const join = createJoinPrint(ctx, scene, union, emblemMotion, render, reducedMotion);
  const finalTime = pageDuration + wipeDuration;
  const goalTime = () => (target >= joinPage ? finalTime : target === unionPage ? pageDuration : 0);
  let width,
    height,
    paperWidth,
    portrait,
    pos = 0,
    target = 0,
    raf = 0,
    last = 0;

  function getTile(i, label) {
    const key = label || i;
    if (tiles.has(key)) return tiles.get(key);
    const img = [tower, sky, ground, tower][i % 4];
    if (!img.naturalWidth || (label && !tower.naturalWidth)) return;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 512;
    const g = tile.getContext('2d', { willReadFrequently: true });
    const light = i % 3 === 0;
    if (label) drawSloganPrint(g, label, tower);
    else {
      g.fillStyle = light ? '#e5dfd2' : i % 3 === 1 ? '#9b3029' : '#302d28';
      g.fillRect(0, 0, 512, 512);
      const crop = Math.min(img.naturalWidth, img.naturalHeight) * (0.48 + (i % 4) * 0.12);
      g.globalAlpha = light ? 0.78 : 0.72;
      g.globalCompositeOperation = light ? 'multiply' : 'luminosity';
      const sx = (img.naturalWidth - crop) * ((i * 0.37) % 1),
        sy = (img.naturalHeight - crop) * ((i * 0.23 + 0.4) % 1);
      if (i === 3) union.sampleTower(img, sx, sy, crop);
      g.drawImage(img, sx, sy, crop, crop, 0, 0, 512, 512);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      if (i % 3 === 1) {
        g.fillStyle = '#211c1988';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(210, 0);
        g.lineTo(0, 400);
        g.fill();
      }
    }
    const color = light ? '#372a2036' : '#eee6cc38';
    if (!dotInks.has(color)) dotInks.set(color, dotColors(color));
    applyDots(g, dotInks.get(color));
    tiles.set(key, tile);
    return tile;
  }

  function nodeTile(i) {
    return getTile((i === 29 ? 3 : i === 24 ? 6 : i) % 12, labels.get(i));
  }

  let nextTile = 0;
  function warmNextTile() {
    if (nextTile === nodes.length) return false;
    if (![sky, ground, tower].every((image) => image.complete && image.naturalWidth)) return false;
    nodeTile(nextTile++);
    return nextTile < nodes.length;
  }

  let lastPosterDistance;

  function size() {
    lastPosterDistance = undefined;
    width = scene.clientWidth;
    height = scene.clientHeight;
    portrait = width / height <= 0.8;
    narrow = width < height;
    end = narrow ? 3.42 : 2.55;
    scene.classList.toggle('join-portrait', narrow);
    const wasHidden = footer.hidden;
    footer.hidden = false;
    footerWidth = parseFloat(getComputedStyle(footer).width);
    footer.hidden = wasHidden;
    paperWidth = width / Math.max(width / 2560, height / 1440);
    unionStill = null;
    if (pos || target) render();
  }

  function allocateCanvas() {
    const d = printDensity(width, height);
    const w = Math.max(1, Math.round(width * d));
    const h = Math.max(1, Math.round(height * d));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
  }

  function movePoster(distance) {
    if (lastPosterDistance === distance) return;
    lastPosterDistance = distance;
    const t = Math.min(distance / approach, 2.15);
    // A custom property on the poster would inherit into every print layer and
    // restyle the whole subtree on every frame of the pan.
    // On return to the poster the class-based rules used to disappear, so the
    // inline value must be cleared; inside the gallery every layer keeps a
    // resolved length, `0px` rather than `none`, because a resolved zero keeps
    // the layer's transform node and its clip-path antialiasing identical.
    const slide = (element, widths) => {
      element.style.translate = t === 0 ? '' : -widths * width + 'px 0';
    };
    slide(ringFar, t * 0.74);
    slide(ringNear, t * (portrait ? 1.91 : 1.31));
    slide(blade, t * 1.09);
    slide(dots, t * 1.31);
    slide(orbitLayer, t * 1.31);
    slide(satellites, t * 1.52);
    towerPlane.style.translate = -t * (paperWidth * 1.36 + 200) + 'px 0';
    towerPlane.style.setProperty('--tower-lift', 1 + 0.045 * Math.min(t, 1));

    // The right endcap overprints the lettering. Its bevel opens and closes
    // with the two strokes of the emblem, before the ink strip clears left.
    const { front, tail } = emblemMotion(clamp(t / 0.235) * 505);
    const lip = 98.4 * (1 - front);
    const bevel = (front - tail) * Math.min(13, (17 * height) / width);
    overprint.style.clipPath = `polygon(${lip}% 0,100% 0,100% 100%,${lip + bevel}% 100%)`;
    const strip = smooth((t - 0.15) / 0.65) * 1.015;
    slide(band, strip);
    slide(title, strip);
    slide(overprint, strip);
  }

  function render() {
    const distance = pos * (approach + end);
    const joinClock = clamp((pageTime - pageDuration) / wipeDuration);
    if (pos) allocateCanvas();
    footer.hidden = footerPosition === 0;
    // The opaque black pass and the light paper beneath it end on the same
    // backing pixel. Subpixel translation would blend both edges into a line.
    const densityX = narrow ? canvas.height / height : canvas.width / width;
    const pan = Math.round(footerPosition * footerWidth * densityX) / densityX;
    if (!footer.hidden) {
      const remaining = footerPosition === 1 ? 0 : footerWidth - pan;
      footer.style.transform = 'translateX(' + remaining + 'px)';
    }
    join.setInteractive(joinClock === 1 && target >= joinPage, joinClock);
    join.setPanning(footerPosition > 0 || target > joinPage);
    const clock = clamp(pageTime / pageDuration);
    const finale = emblemMotion(clock * 420).front;
    const camera = distance - approach;
    const unit = Math.min(width, height * (portrait ? 0.94 : 1.65));
    const endpoint = smooth((camera - end + 0.47) / 0.47);
    canvas.hidden = !pos;
    scene.classList.toggle('in-gallery', !!pos);
    movePoster(distance);
    if (!pos) {
      // Release the hidden backing store on return to the poster.
      canvas.width = canvas.height = 1;
      return;
    }
    if (joinClock === 1) {
      join.draw(1, 1, width, height, pan);
      return;
    }
    if (joinClock && unionStill) {
      ctx.drawImage(unionStill, 0, 0, width, height);
      join.draw(joinClock, sheetEase(joinClock), width, height);
      return;
    }
    if (!joinClock) unionStill = null;
    ctx.clearRect(0, 0, width, height);
    // At camera zero and at the endpoint the frames land on their composed
    // coordinates. Between them, closer frames cross the lens faster.
    const parallax = camera <= 0 ? camera : (end / Math.PI) * Math.sin((Math.PI * camera) / end);
    const frames = nodes.map((node, i) => {
      const placement = narrow ? narrowNodes.get(i) : node;
      if (!placement) return null;
      const [nx, ny, size] = placement;
      const depth = depths[i];
      const x = (nx - camera - (depth - 1) * parallax * (narrow ? 0.28 : 1)) * width;
      let y = ny * height;
      const shrink = smooth((x / width + 0.075) / 0.24);
      const appear = smooth((1.18 - x / width) / 0.19);
      // Incoming prints open away from the horizon as they reach the lens.
      y = height * 0.5 + (y - height * 0.5) * (1 - (1 - appear) * depth * 0.17);
      const scale = (0.05 + 0.95 * shrink) * (0.72 + 0.28 * appear);
      const side = size * unit * scale;
      if (i === 25) return { x, y, w: side * 3.1, h: side * 0.51, alpha: shrink * appear };
      return { x, y, w: side * (i === 29 ? 1.12 : 1), h: side, alpha: shrink * appear };
    });
    // The sheet rises behind the moving prints and their fibres.
    if (clock) {
      const sheet = sheetEase(clamp(clock / 0.48));
      union.paper(sheet, clock, width, height);
    }
    const shift = (i) => height * finale * (1.35 + 0.32 * depths[i]);
    // Links meet the moving centers and share the frames' depth falloff.
    ctx.strokeStyle = '#63564c';
    ctx.lineWidth = 0.7;
    const linkIds = narrow ? narrowIds : desktopIds;
    for (let j = 0; j < linkIds.length; j++) {
      const i = linkIds[j];
      const a = frames[i];
      if (a.x < -0.55 * width || a.x > width * 1.1) continue;
      for (const offset of narrow ? [1] : [1, 3]) {
        const next = linkIds[j + offset];
        const b = frames[next];
        if (!b) continue;
        ctx.globalAlpha = 0.46 * (1 - smooth(finale / 0.32)) * Math.min(a.alpha, b.alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - shift(i));
        ctx.lineTo(b.x, b.y - shift(next));
        ctx.stroke();
      }
    }
    for (const i of paintOrder) {
      const f = frames[i];
      if (!f || !f.alpha || f.x + f.w / 2 < 0 || f.x - f.w / 2 > width) continue;
      const x = f.x - f.w / 2,
        y = f.y - f.h / 2 - shift(i);
      ctx.globalAlpha = f.alpha;
      const tile = nodeTile(i);
      if (finale && tile && i !== 29) union.trail(finale, width, height, f, i, tile, shift(i));
      if (tile && y + f.h >= 0) {
        const cropHeight = Math.min(tile.height, (tile.width * f.h) / f.w);
        ctx.drawImage(
          tile,
          0,
          (tile.height - cropHeight) / 2,
          tile.width,
          cropHeight,
          x,
          y,
          f.w,
          f.h,
        );
        ctx.strokeStyle = '#31282070';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x, y, f.w, f.h);
      }
      if (finale && tile && i === 29) union.trail(finale, width, height, f, i, tile, shift(i));
    }
    if (endpoint) {
      ctx.globalAlpha = endpoint * (1 - smooth(finale / 0.38));
      const hero = frames[29];
      const x = narrow ? hero.x - hero.w / 2 : width * (0.075 + (1 - endpoint) * 0.36);
      const y = narrow
        ? hero.y - hero.h / 2 - width * 0.13 - height * finale
        : height * (0.35 - finale * 0.95);
      const em = Math.min(width * (narrow ? 0.134 : 0.082), height * 0.17);
      ctx.fillStyle = '#25201c';
      ctx.font = 'italic ' + em * 0.62 + 'px Didot, Georgia, serif';
      ctx.fillText('This is', x, y);
      if (logo.complete && logo.naturalWidth) {
        const logoWidth = Math.min(width * (narrow ? 0.46 : 0.29), em * 4.2);
        ctx.drawImage(logo, x, y + em * 0.3, logoWidth, logoWidth / 7);
      }
      if (clock) union.type(finale, clock, width, height, !joinClock);
    }
    ctx.globalAlpha = 1;
    if (joinClock && !unionStill) {
      unionStill = document.createElement('canvas');
      unionStill.width = canvas.width;
      unionStill.height = canvas.height;
      unionStill.getContext('2d').drawImage(canvas, 0, 0);
      join.draw(joinClock, sheetEase(joinClock), width, height);
    }
  }

  let lastPageFrame = 0;
  const wheelDampingMs = 95;
  const glideDampingMs = 150;
  let dampingMs = wheelDampingMs;
  function approachTarget(current, goal, distance, decay) {
    const gap = (current - goal) * decay;
    return Math.abs(gap * distance) < 0.25 ? goal : goal + gap;
  }

  function tick(now) {
    const dt = last ? now - last : 16;
    last = now;
    const decay = Math.exp(-dt / dampingMs);
    const destination = goalTime();
    const cameraTarget = destination > 0 || pageTime > 0 ? 1 : target;
    pos = approachTarget(pos, cameraTarget, width * (approach + end), decay);
    const footerGoal = pageTime === finalTime ? clamp(target - joinPage) : 0;
    footerPosition = approachTarget(footerPosition, footerGoal, footerWidth, decay);
    if (pos === 1 && (destination === finalTime || footerPosition === 0)) {
      const elapsed = lastPageFrame ? now - lastPageFrame : 0;
      // Rewind the same clock so every layer retraces its entry timing.
      pageTime +=
        Math.sign(destination - pageTime) * Math.min(elapsed, Math.abs(destination - pageTime));
      lastPageFrame = now;
    } else lastPageFrame = 0;
    render();
    if (
      pos !== Math.min(target, 1) ||
      pageTime !== destination ||
      footerPosition !== clamp(target - joinPage)
    )
      raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      last = 0;
      lastPageFrame = 0;
    }
  }
  function finish() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    lastPageFrame = 0;
    pos = Math.min(target, 1);
    footerPosition = clamp(target - joinPage);
    pageTime = goalTime();
    render();
  }
  function seek(value, damping = wheelDampingMs) {
    dampingMs = damping;
    const previous = target;
    target = value >= joinPage ? Math.min(value, limit) : value > 1 ? unionPage : clamp(value);
    if (target === previous) return;
    if (previous < joinPage || target < joinPage) join.setInteractive(false);
    if (!width) size();
    onChange(target);
    if (reducedMotion.matches) finish();
    else if (!raf) raf = requestAnimationFrame(tick);
  }
  function turning() {
    return pageTime !== goalTime();
  }
  function canPan(delta) {
    if (turning() || !delta) return false;
    if (target >= joinPage) return delta > 0 ? target < limit : target > joinPage;
    return target <= 1 && (delta > 0 ? target < 1 : target > 0);
  }

  function pan(pixels, direct = false, damping = wheelDampingMs) {
    const footerTrack = target >= joinPage;
    const start = footerTrack ? joinPage : 0;
    const travel = footerTrack ? footerWidth : width * (approach + end);
    const before = target - start;
    const progress = clamp(before + pixels / travel);
    if (direct) {
      if (footerTrack) footerPosition = progress;
      else pos = progress;
    }
    seek(start + progress, damping);
    return pixels - (progress - before) * travel;
  }

  function panWheel(delta) {
    const footerTrack = target >= joinPage;
    const travel = footerTrack ? footerWidth : width * (approach + end);
    const painted = footerTrack ? joinPage + footerPosition : pos;
    // Bound how far a burst can run ahead of the picture. This budget is
    // shared by all packets until the next paint, regardless of device.
    const lead = (target - painted) * travel * Math.sign(delta);
    const budget = Math.min(width * 0.5, travel * 0.6);
    const pixels = Math.min(Math.abs(delta) * 0.72, Math.max(0, budget - lead));
    pan(Math.sign(delta) * pixels);
  }

  function grab() {
    if (turning()) return;
    if (target >= joinPage) seek(joinPage + footerPosition);
    else if (target <= 1) seek(pos);
  }

  function release(speed) {
    if (!reducedMotion.matches && canPan(speed)) {
      const reach = Math.min(Math.abs(speed) * glideDampingMs, width * 0.85);
      pan(Math.sign(speed) * reach, false, glideDampingMs);
    }
  }
  // Scrub the same UNION/JOIN clock used by wheel and keyboard turns.
  function beginWipe(direction) {
    const stops = [1, unionPage, joinPage];
    const from = stops.indexOf(target);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= stops.length || turning()) return null;
    const times = [0, pageDuration, finalTime];
    cancelAnimationFrame(raf);
    raf = last = lastPageFrame = 0;
    pos = 1;
    return {
      preview(progress) {
        if (reducedMotion.matches) return;
        pageTime = times[from] + (times[to] - times[from]) * progress;
        render();
      },
      settle(commit) {
        if (commit) seek(stops[to]);
        if (reducedMotion.matches) finish();
        else if (!raf) raf = requestAnimationFrame(tick);
      },
    };
  }

  function reverseWipe(direction) {
    if (!turning() || direction === Math.sign(goalTime() - pageTime)) return false;
    if (direction > 0) seek(pageTime <= pageDuration ? unionPage : joinPage);
    else seek(pageTime >= pageDuration ? unionPage : 1);
    return true;
  }
  function step(forward) {
    if (turning()) return;
    if (target > joinPage) seek(forward ? limit : joinPage);
    else if (target === joinPage) seek(forward ? limit : unionPage);
    else if (target === unionPage) seek(forward ? joinPage : 1);
    else if (target === 1 && forward) seek(unionPage);
    else
      seek(
        forward && !target ? approach / (approach + end) : clamp(target + (forward ? 0.18 : -0.18)),
      );
  }
  return {
    size,
    warmNextTile,
    beginWipe,
    reverseWipe,
    seek,
    step,
    finish,
    turning,
    canPan,
    pan,
    panWheel,
    grab,
    release,
    limit,
    joinPage,
    unionPage,
    get active() {
      return pos > 0 || target > 0;
    },
    get target() {
      return target;
    },
  };
}

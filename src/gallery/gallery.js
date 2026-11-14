import { createUnionArtwork } from '../artwork/union.js';
import { createJoinPrint } from '../join/join-print.js';

// Positions are in viewport widths along a single horizontal exhibition.
export function createGallery(scene, reducedMotion, emblemMotion, sheetEase, onChange) {
  const canvas = scene.querySelector('.gallery');
  const ctx = canvas.getContext('2d');
  const poster = scene.querySelector('.poster');
  const towerPlane = scene.querySelector('.tower');
  const overprint = scene.querySelector('.print-overprint');
  const sky = scene.querySelector('.sky img');
  const ground = scene.querySelector('.ground img');
  const tower = scene.querySelector('.tower img');
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const smooth = (n) => {
    const t = clamp(n);
    return t * t * (3 - 2 * t);
  };
  // The first gallery composition sits at camera zero; the poster is one
  // approach to its left. Wheel, touch and keys all move on this same track.
  const approach = 1.34,
    end = 2.55;
  const overview = approach / (approach + end);
  let velocity = 0;
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
  const tiles = [];
  const union = createUnionArtwork(ctx, emblemMotion);
  const unionPage = 1.62;
  const joinPage = 2,
    limit = 3;
  const footer = scene.querySelector('.join-footer');
  let footerPosition = 0,
    footerVelocity = 0,
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

  function prepareTiles() {
    if (tiles.length || ![sky, ground, tower].every((img) => img.complete && img.naturalWidth))
      return;
    for (let i = 0; i < 12; i++) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 512;
      const g = tile.getContext('2d', { willReadFrequently: true });
      const light = i % 3 === 0;
      g.fillStyle = light ? '#e5dfd2' : i % 3 === 1 ? '#9b3029' : '#302d28';
      g.fillRect(0, 0, 512, 512);
      const img = [tower, sky, ground, tower][i % 4];
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
      g.fillStyle = light ? '#372a2036' : '#eee6cc38';
      for (let y = 1; y < 512; y += 7)
        for (let x = (y % 2) * 3; x < 512; x += 7) g.fillRect(x, y, 1.6, 1.6);
      tiles.push(tile);
    }
  }

  function size() {
    footerWidth = 0;
    width = scene.clientWidth;
    height = scene.clientHeight;
    portrait = width / height <= 0.8;
    paperWidth = width / Math.max(width / 2560, height / 1440);
    const d = Math.min(devicePixelRatio || 1, 1.5, 2100 / Math.max(width, height));
    canvas.width = Math.round(width * d);
    canvas.height = Math.round(height * d);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    unionStill = null;
    if (pos || target) render();
  }

  function movePoster(distance) {
    const t = Math.min(distance / approach, 2.15);
    const shift = (name, widths) => poster.style.setProperty(name, -widths * paperWidth + 'px');
    shift('--far-ring-x', t * 0.74);
    shift('--near-ring-x', t * (portrait ? 1.91 : 1.31));
    shift('--blade-x', t * 1.09);
    shift('--orbit-x', t * 1.31);
    shift('--satellite-x', t * 1.52);
    towerPlane.style.translate = -t * (paperWidth * 1.36 + 200) + 'px 0';
    towerPlane.style.setProperty('--tower-lift', 1 + 0.045 * Math.min(t, 1));

    // The right endcap overprints the lettering. Its bevel opens and closes
    // with the two strokes of the emblem, before the ink strip clears left.
    const { front, tail } = emblemMotion(clamp(t / 0.235) * 505);
    const lip = 98.4 * (1 - front);
    const bevel = (front - tail) * Math.min(13, (17 * height) / width);
    overprint.style.clipPath = `polygon(${lip}% 0,100% 0,100% 100%,${lip + bevel}% 100%)`;
    shift('--strip-x', smooth((t - 0.15) / 0.65) * 1.015);
  }

  function render() {
    const distance = pos * (approach + end);
    const joinClock = clamp((pageTime - pageDuration) / wipeDuration);
    footer.hidden = footerPosition === 0;
    if (!footer.hidden && !footerWidth) footerWidth = footer.offsetWidth;
    const pan = footerPosition * footerWidth;
    if (pan > 0) {
      footer.style.transform = 'translateX(' + (footerWidth - pan) + 'px)';
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
    if (!pos) return;
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
    prepareTiles();
    // At camera zero and at the endpoint the frames land on their composed
    // coordinates. Between them, closer frames cross the lens faster.
    const parallax = camera <= 0 ? camera : (end / Math.PI) * Math.sin((Math.PI * camera) / end);
    const frames = nodes.map(([nx, ny, size], i) => {
      const depth = depths[i];
      let x = (nx - camera - (depth - 1) * parallax) * width;
      let y = ny * height;
      if (portrait && i >= 24) {
        if (i === 29) {
          x -= width * 0.1 * endpoint;
          y += height * 0.09 * endpoint;
        }
        if (i === 24) y -= height * 0.12 * endpoint;
        if (i === 26) x += width * 0.34 * endpoint;
      }
      const shrink = smooth((x / width + 0.075) / 0.24);
      const appear = smooth((1.18 - x / width) / 0.19);
      // Incoming prints open away from the horizon as they reach the lens.
      y = height * 0.5 + (y - height * 0.5) * (1 - (1 - appear) * depth * 0.17);
      const scale = (0.05 + 0.95 * shrink) * (0.72 + 0.28 * appear);
      const side = size * unit * (portrait ? 1.43 : 1) * scale;
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
    for (let i = 0; i < frames.length; i++) {
      const a = frames[i];
      if (a.x < -0.55 * width || a.x > width * 1.1) continue;
      for (const offset of [1, 3]) {
        const b = frames[i + offset];
        if (!b) continue;
        ctx.globalAlpha = 0.46 * (1 - smooth(finale / 0.32)) * Math.min(a.alpha, b.alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - shift(i));
        ctx.lineTo(b.x, b.y - shift(i + offset));
        ctx.stroke();
      }
    }
    for (const i of paintOrder) {
      const f = frames[i];
      if (!f.alpha || f.x + f.w / 2 < 0 || f.x - f.w / 2 > width) continue;
      const x = f.x - f.w / 2,
        y = f.y - f.h / 2 - shift(i);
      ctx.globalAlpha = f.alpha;
      const tile = tiles[(i === 29 ? 3 : i === 24 ? 6 : i) % 12];
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
      const x = width * (0.075 + (1 - endpoint) * 0.36),
        y = height * ((portrait ? 0.25 : 0.35) - finale * 0.95);
      const em = Math.min(width * (portrait ? 0.134 : 0.082), height * 0.17);
      ctx.fillStyle = '#25201c';
      ctx.font = 'italic ' + em * 0.5 + 'px Didot, Georgia, serif';
      ctx.fillText('The Unfinished', x, y);
      ctx.font = em + 'px Didot, Georgia, serif';
      ctx.fillText('Tower', x, y + em * 0.85);
      ctx.fillStyle = '#8e3025';
      ctx.font = '500 ' + Math.max(13, em * 0.17) + 'px "Songti SC", serif';
      ctx.fillText('未 竟 之 塔', x, y + em * 1.28);
      if (clock) union.type(finale, clock, width, height, !joinClock);
    }
    ctx.globalAlpha = 1;
    if (joinClock) {
      unionStill = document.createElement('canvas');
      unionStill.width = canvas.width;
      unionStill.height = canvas.height;
      unionStill.getContext('2d').drawImage(canvas, 0, 0);
      join.draw(joinClock, sheetEase(joinClock), width, height);
    }
  }

  let lastPageFrame = 0;
  function tick(now) {
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const seconds = dt / 1000;
    const rate = 9,
      decay = Math.exp(-rate * seconds);
    const destination = goalTime();
    const open = destination > 0;
    const cameraTarget = open || pageTime > 0 ? 1 : target;
    const gap = pos - cameraTarget,
      slope = velocity + rate * gap;
    pos = cameraTarget + (gap + slope * seconds) * decay;
    velocity = (velocity - rate * slope * seconds) * decay;
    if (Math.abs(cameraTarget - pos) < 0.00003 && Math.abs(velocity) < 0.00035) {
      pos = cameraTarget;
      velocity = 0;
    }
    // The footer is a continuation of the fourth sheet. Its camera follows
    // the scroll target with the same damped response as the gallery.
    const footerGoal = pageTime === finalTime ? clamp(target - joinPage) : 0;
    const footerGap = footerPosition - footerGoal;
    const footerSlope = footerVelocity + rate * footerGap;
    footerPosition = clamp(footerGoal + (footerGap + footerSlope * seconds) * decay);
    footerVelocity = (footerVelocity - rate * footerSlope * seconds) * decay;
    if (Math.abs(footerPosition - footerGoal) < 0.00003 && Math.abs(footerVelocity) < 0.00035) {
      footerPosition = footerGoal;
      footerVelocity = 0;
    }
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
      velocity ||
      pageTime !== destination ||
      footerPosition !== clamp(target - joinPage) ||
      footerVelocity
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
    velocity = 0;
    footerPosition = clamp(target - joinPage);
    footerVelocity = 0;
    pageTime = goalTime();
    render();
  }
  function seek(value) {
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
  function scroll(delta, gestureDistance) {
    if (turning()) return true;
    if (target >= joinPage && (target > joinPage || delta > 0)) {
      const distance = 150 * Math.asinh(delta / 150);
      seek(joinPage + clamp(target - joinPage + distance / Math.max(320, height * 0.95)));
      return target === joinPage && delta < 0;
    }
    if ((target === 1 && delta > 0) || target > 1) {
      if (Math.abs(gestureDistance) < 26) return false;
      step(delta > 0);
      return true;
    }
    const distance = 150 * Math.asinh(delta / 150);
    seek(clamp(target + distance / (Math.max(480, height) * 3.45)));
    return target === 1 || target === 0;
  }
  function step(forward) {
    if (turning()) return;
    if (target > joinPage) seek(forward ? limit : joinPage);
    else if (target === joinPage) seek(forward ? limit : unionPage);
    else if (target === unionPage) seek(forward ? joinPage : 1);
    else if (target === 1 && forward) seek(unionPage);
    else seek(forward && !target ? overview : clamp(target + (forward ? 0.18 : -0.18)));
  }
  return {
    size,
    seek,
    step,
    finish,
    prepareTiles,
    scroll,
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

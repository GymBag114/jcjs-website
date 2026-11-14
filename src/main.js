import { createParallax } from './effects/parallax.js';
import { createGallery } from './gallery/gallery.js';
import { createTowerDust } from './effects/tower-dust.js';
import { drawTowerPrint } from './artwork/poster.js';
import { createIntro } from './intro/intro.js';
import { bezier, emblemMotion } from './core/motion.js';

const scene = document.querySelector('.scene');
const world = document.querySelector('.world');
const viewport = document.querySelector('.scene-viewport');
const planes = [...document.querySelectorAll('[data-depth]')].map((element) => ({
  element,
  depth: Number(element.dataset.depth),
}));
const pageButton = document.querySelector('.page-turn');
const notice = document.querySelector('.notice');
const themeColor = document.querySelector('meta[name="theme-color"]');
let onPrint = false;
let lockedUntil = 0;
let printWidth = 0,
  printHeight = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const towerDust = createTowerDust(document.querySelector('.tower'));
const gallery = createGallery(
  scene,
  reducedMotion,
  emblemMotion,
  bezier(0.4, 0, 0.6, 1),
  (value) => {
    if (value > 0) towerDust.settle();
    const label =
      value > gallery.joinPage
        ? '第四页 · 页脚'
        : value === gallery.joinPage
          ? '第四页 · JOIN US'
          : value > 1
            ? 'And · UNION'
            : value === 1
              ? '未竟之塔 · 画廊终点'
              : value
                ? '未竟之塔 · 横向画廊'
                : '未竟之塔 · Introducing JCJS';
    const changed = scene.getAttribute('aria-label') !== label;
    scene.setAttribute('aria-label', label);
    if (changed) notice.textContent = label;
    pageButton.textContent =
      value === gallery.limit
        ? '返回 JOIN US'
        : value >= gallery.joinPage
          ? '查看页脚'
          : value === gallery.unionPage
            ? '进入 JOIN US'
            : value === 1
              ? '进入 And · UNION'
              : value
                ? '向右浏览画廊'
                : '进入横向画廊';
  },
);
const parallax = createParallax(planes, reducedMotion);

const intro = createIntro({
  scene,
  world,
  viewport,
  pageButton,
  reducedMotion,
  onReset: () => reset(true),
  onFinish() {
    pageButton.textContent = '进入第二页 · 未竟之塔';
    if (window.requestIdleCallback) requestIdleCallback(preparePrint);
    else setTimeout(preparePrint, 0);
  },
});

/* ------------------------------------------------------------- parallax */
function resize() {
  // Cover without stretching. Coordinates and movement stay in artwork pixels.
  const scale = Math.max(scene.clientWidth / 2560, scene.clientHeight / 1440);
  scene.style.setProperty('--scene-scale', String(scale));
  const height = scene.clientHeight / scale;
  scene.style.setProperty('--paper-w', scene.clientWidth / scale + 'px');
  scene.style.setProperty('--paper-h', height + 'px');
  scene.style.setProperty('--crop-y', (1440 - height) / 2 + 'px');
  if (onPrint) preparePrint();
  gallery.size();
  // The mark is a lockup, not scenery: it keeps 93.75% of the visible width
  // (exactly 2400 artwork px at 16:9) and stays centred, so a narrow window
  // can never crop it or make it look oversized.
  const mark = Math.min(2400, (scene.clientWidth * 0.9375) / scale);
  scene.style.setProperty('--emblem-width', mark.toFixed(2) + 'px');
  intro.resize(mark * scale);
  reset();
}

function reset(immediate = false) {
  if (onPrint || performance.now() < lockedUntil) return;
  parallax.reset(immediate);
}

function preparePrint() {
  const width = scene.clientWidth,
    height = scene.clientHeight;
  if (width === printWidth && height === printHeight) return;
  drawTowerPrint(width, height);
  printWidth = width;
  printHeight = height;
}

function turnPage(toPrint) {
  if (intro.active || toPrint === onPrint || performance.now() < lockedUntil) return;
  if (toPrint) {
    preparePrint();
    if (window.requestIdleCallback) requestIdleCallback(gallery.prepareTiles);
  }
  towerDust.settle();
  // Start centering from the last painted depth offsets on the wipe frame.
  reset(reducedMotion.matches);
  onPrint = toPrint;
  lockedUntil = performance.now() + (reducedMotion.matches ? 0 : 980);
  scene.dataset.page = toPrint ? 'print' : 'landscape';
  scene.setAttribute('aria-label', toPrint ? '未竟之塔 · Introducing JCJS' : '异境');
  themeColor.content = toPrint ? '#eee9df' : '#e5ddd1';
  pageButton.textContent = toPrint ? '进入横向画廊' : '进入第二页 · 未竟之塔';
  notice.textContent = toPrint ? '第二页，未竟之塔' : '第一页，异境';
}

function navigate(forward) {
  if (intro.active || performance.now() < lockedUntil) return;
  if (onPrint && (forward || gallery.active)) {
    gallery.step(forward);
  } else turnPage(forward);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else notice.textContent = '当前浏览器不支持全屏，可使用浏览器的全屏模式';
  } catch {
    notice.textContent = '无法进入全屏，请使用浏览器的全屏模式';
  }
}

let gesture;
scene.addEventListener('pointerdown', (event) => {
  if (event.isPrimary && event.pointerType === 'touch') {
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastY: event.clientY,
      gallery: gallery.active,
    };

    gesture.link = event.target.closest('a[href]');
    if (!gesture.link) scene.setPointerCapture(event.pointerId);
  }
});

scene.addEventListener(
  'pointermove',
  (event) => {
    if (intro.active || performance.now() < lockedUntil || event.target.closest('button')) return;
    if (gesture?.link && gesture.id === event.pointerId) {
      // Keep native tap activation until the finger starts a drag.
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 9) return;
      scene.setPointerCapture(event.pointerId);
      gesture.link = null;
    }
    if (
      onPrint &&
      gesture &&
      gesture.id === event.pointerId &&
      !gesture.gallery &&
      gesture.y - event.clientY > Math.max(8, Math.abs(event.clientX - gesture.x))
    ) {
      gesture.gallery = true;
    }
    if (gesture?.gallery && gesture.id === event.pointerId) {
      if (
        !gesture.used &&
        Math.abs(event.clientY - gesture.y) > Math.abs(event.clientX - gesture.x)
      ) {
        gesture.used = gallery.scroll(
          (gesture.lastY - event.clientY) * 1.8,
          gesture.y - event.clientY,
        );
      }
      gesture.lastY = event.clientY;
      return;
    }
    if (onPrint) {
      if (!gallery.active && !reducedMotion.matches && event.isPrimary) towerDust.brush(event);
      return;
    }
    if (parallax.paused) return;
    if (gesture && Math.abs(event.clientY - gesture.y) > Math.abs(event.clientX - gesture.x))
      return;
    const bounds = scene.getBoundingClientRect();
    parallax.target.x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    parallax.target.y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    parallax.wake();
  },
  { passive: true },
);

scene.addEventListener('pointerup', (event) => {
  if (event.pointerId !== gesture?.id) return;
  const dy = event.clientY - gesture.y,
    dx = event.clientX - gesture.x;
  const scrubbed = gesture.gallery;
  gesture = null;
  towerDust.endStroke();
  if (!scrubbed && Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx)) navigate(dy < 0);
  reset();
});
scene.addEventListener('pointercancel', () => {
  gesture = null;
  towerDust.endStroke();
  reset();
});

let wheelDelta = 0,
  lastWheel = -Infinity,
  wheelUsed = false;
scene.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 180 || Math.sign(event.deltaY) !== Math.sign(wheelDelta)) {
      wheelDelta = 0;
      wheelUsed = false;
    }
    lastWheel = now;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scene.clientHeight : 1;
    wheelDelta += event.deltaY * unit;
    if (onPrint && (gallery.active || event.deltaY > 0) && !wheelUsed && now >= lockedUntil) {
      wheelUsed = gallery.scroll(event.deltaY * unit, wheelDelta);
      return;
    }
    if (!wheelUsed && Math.abs(wheelDelta) >= 26 && !intro.active && now >= lockedUntil) {
      navigate(wheelDelta > 0);
      wheelUsed = true;
    }
  },
  { passive: false },
);
scene.addEventListener('pointerleave', () => {
  towerDust.endStroke();
  reset();
});
window.addEventListener('blur', () => reset(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    towerDust.stop();
    if (intro.active) intro.finish();
    reset(true);
  }
});
window.addEventListener('resize', resize, { passive: true });
reducedMotion.addEventListener('change', () => {
  parallax.setPaused(reducedMotion.matches);
  if (reducedMotion.matches && intro.active) intro.finish();
  reset(true);
  if (reducedMotion.matches) {
    towerDust.stop();
    if (gallery.active) gallery.finish();
    lockedUntil = 0;
  }
});
pageButton.addEventListener('click', () => {
  if (intro.active) intro.finish();
  else if (gallery.target === gallery.limit) gallery.step(false);
  else navigate(true);
});
document.addEventListener('fullscreenchange', resize);
document.addEventListener('keydown', (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (intro.active) {
    if (event.key === 'Escape') {
      event.preventDefault();
      intro.finish();
    }
    return;
  }
  if (['ArrowDown', 'PageDown', 'End', 'ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
    event.preventDefault();
    if (onPrint && event.key === 'End' && performance.now() >= lockedUntil) {
      gallery.seek(gallery.limit);
    } else if (gallery.active && event.key === 'Home') gallery.seek(0);
    else navigate(['ArrowDown', 'PageDown', 'End'].includes(event.key));
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  } else if (!onPrint && performance.now() >= lockedUntil) {
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      intro.start();
    } else if (event.code === 'Space' && !event.target.closest('button')) {
      event.preventDefault();
      parallax.setPaused(!parallax.paused);
      reset(true);
    } else if (event.key === 'Escape') reset(true);
  }
});

for (const image of document.querySelectorAll('.plane img')) {
  image.addEventListener(
    'error',
    () => {
      notice.textContent = '部分图片未能加载，请刷新页面重试';
    },
    { once: true },
  );
  image.addEventListener(
    'load',
    () => {
      printWidth = 0;
      if (onPrint) preparePrint();
      if (gallery.active) gallery.size();
    },
    { once: true },
  );
}
resize();

if (new URLSearchParams(location.search).get('page') === 'join') {
  intro.finish();
  turnPage(true);
  gallery.seek(gallery.joinPage);
  gallery.finish();
  lockedUntil = 0;
} else {
  intro.start();
}

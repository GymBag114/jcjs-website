import { constrainedRendering } from './core/render-budget.js';
import { createParallax } from './effects/parallax.js';
import { createGallery } from './gallery/gallery.js';
import { bindNavigation } from './gallery/navigation.js';
import { createTowerDust } from './effects/tower-dust.js';
import { placeTowerGeometry, stageTowerPrint } from './artwork/poster.js';
import { createIntro } from './intro/intro.js';
import { bezier, emblemMotion } from './core/motion.js';

const scene = document.querySelector('.scene');
scene.classList.toggle('render-constrained', constrainedRendering);
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
let printReady = false;
let printStages = null;
let warmIdle = 0;
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
    if (scene.getAttribute('aria-label') !== label) {
      scene.setAttribute('aria-label', label);
      notice.textContent = label;
    }
    const action =
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
    if (pageButton.textContent !== action) pageButton.textContent = action;
  },
);
const parallax = createParallax(planes, reducedMotion);

const intro = createIntro({
  scene,
  viewport,
  pageButton,
  reducedMotion,
  onReset: () => reset(true),
  onFinish() {
    pageButton.textContent = '进入第二页 · 未竟之塔';
    scheduleWarmup();
  },
});

let measuredWidth = 0,
  measuredHeight = 0,
  measuredDpr = 0;
/* ------------------------------------------------------------- parallax */
function resize() {
  if (
    scene.clientWidth === measuredWidth &&
    scene.clientHeight === measuredHeight &&
    devicePixelRatio === measuredDpr
  )
    return;
  measuredWidth = scene.clientWidth;
  measuredHeight = scene.clientHeight;
  measuredDpr = devicePixelRatio;
  // Cover without stretching. Coordinates and movement stay in artwork pixels.
  const scale = Math.max(scene.clientWidth / 2560, scene.clientHeight / 1440);
  scene.style.setProperty('--scene-scale', String(scale));
  const height = scene.clientHeight / scale;
  scene.style.setProperty('--paper-h', height + 'px');
  scene.style.setProperty('--crop-y', (1440 - height) / 2 + 'px');
  invalidatePrint();
  if (onPrint) preparePrint();
  else scheduleWarmup();
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

// The iterator writes into the displayed canvases. Any change of inputs
// invalidates both the finished print and partially drawn layers together.
function invalidatePrint() {
  printReady = false;
  printStages = null;
}

function advancePrint() {
  printStages ||= stageTowerPrint(measuredWidth, measuredHeight);
  if (printStages.next().done) {
    printReady = true;
    printStages = null;
  }
}

function canWarm() {
  return !constrainedRendering && !document.hidden && !onPrint && !intro.active;
}

function scheduleWarmup() {
  if (warmIdle || !canWarm()) return;
  if (typeof requestIdleCallback === 'function')
    warmIdle = requestIdleCallback(warmNext, { timeout: 250 });
  else warmIdle = setTimeout(warmNext, 32);
}

function warmNext(deadline) {
  warmIdle = 0;
  if (!canWarm() || !measuredWidth || !measuredHeight) return;
  do {
    if (!printReady) advancePrint();
    else if (!gallery.warmNextTile()) return;
  } while (deadline && deadline.timeRemaining() > 4);
  scheduleWarmup();
}

function preparePrint() {
  if (!measuredWidth || !measuredHeight) return;
  placeTowerGeometry(measuredWidth, measuredHeight);
  while (!printReady) advancePrint();
}

function turnPage(toPrint) {
  if (intro.active || toPrint === onPrint || performance.now() < lockedUntil) return;
  if (toPrint) {
    // Some browsers defer resolution/resize events until the next interaction.
    resize();
    preparePrint();
  }
  towerDust.settle();
  // Start centering from the last painted depth offsets on the wipe frame.
  reset(reducedMotion.matches);
  onPrint = toPrint;
  lockedUntil = performance.now() + (reducedMotion.matches ? 0 : 980);
  scene.dataset.page = toPrint ? 'print' : 'landscape';
  if (!toPrint) scheduleWarmup();
  scene.setAttribute('aria-label', toPrint ? '未竟之塔 · Introducing JCJS' : '异境');
  themeColor.content = toPrint ? '#eee9df' : '#e5ddd1';
  pageButton.textContent = toPrint ? '进入横向画廊' : '进入第二页 · 未竟之塔';
  notice.textContent = toPrint ? '第二页，未竟之塔' : '第一页，异境';
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

const navigation = bindNavigation(scene, gallery, {
  onPrint: () => onPrint,
  introActive: () => intro.active,
  busy: () => intro.active || performance.now() < lockedUntil,
  turnPage,
  brush: (event) => {
    if (!reducedMotion.matches) towerDust.brush(event);
  },
  endTouch: () => {
    towerDust.endStroke();
    reset();
  },
});

scene.addEventListener(
  'pointermove',
  (event) => {
    if (
      event.pointerType === 'touch' ||
      intro.active ||
      performance.now() < lockedUntil ||
      event.target.closest('button')
    )
      return;
    if (onPrint) {
      if (!gallery.active && !reducedMotion.matches && event.isPrimary) towerDust.brush(event);
      return;
    }
    if (parallax.paused || event.pointerType !== 'mouse') return;
    const bounds = scene.getBoundingClientRect();
    parallax.target.x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    parallax.target.y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    parallax.target.x = Math.sin((parallax.target.x * Math.PI) / 2);
    parallax.target.y = Math.sin((parallax.target.y * Math.PI) / 2);
    parallax.wake();
  },
  { passive: true },
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
  } else scheduleWarmup();
});
window.addEventListener('resize', resize, { passive: true });
// Moving the window to another display can change DPR without a CSS resize.
function watchPixelRatio() {
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
    'change',
    () => {
      resize();
      watchPixelRatio();
    },
    { once: true },
  );
}
watchPixelRatio();
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
  else if (performance.now() >= lockedUntil) navigation.step(true);
});
document.addEventListener('fullscreenchange', resize);
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (intro.active) {
    if (event.key === 'Escape') {
      event.preventDefault();
      intro.finish();
    }
    return;
  }
  if (
    [
      'ArrowDown',
      'ArrowRight',
      'ArrowUp',
      'ArrowLeft',
      'PageDown',
      'PageUp',
      'Home',
      'End',
    ].includes(event.key)
  ) {
    event.preventDefault();
    navigation.key(event);
  } else if (event.repeat) return;
  else if (event.key.toLowerCase() === 'f') {
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
      // A photograph that arrives late changes the print it is inked from.
      invalidatePrint();
      if (onPrint) preparePrint();
      else scheduleWarmup();
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

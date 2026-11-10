(() => {
  'use strict';

  const scene = document.querySelector('.scene');
  const world = document.querySelector('.world');
  const viewport = document.querySelector('.scene-viewport');
  const planes = [...document.querySelectorAll('[data-depth]')].map(element => ({
    element, depth: Number(element.dataset.depth),
  }));
  const motionButton = document.querySelector('.motion-toggle');
  const fullscreenButton = document.querySelector('.fullscreen-toggle');
  const hint = document.querySelector('.hint');
  const notice = document.querySelector('.notice');
  const controls = document.querySelector('.controls');
  const replayButton = document.querySelector('.intro-replay');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let paused = reducedMotion.matches;
  let frame = 0;
  let lastTime = 0;
  let uiTimer;
  let noticeTimer;

  /* ------------------------------------------------------------ opening */
  const intro = document.querySelector('.intro');
  const skipButton = document.querySelector('.intro-skip');
  const outline = document.querySelector('.intro-stroke');
  const hudLabels = [...document.querySelectorAll('.intro-hud span')];
  const emblem = document.querySelector('.emblem-mark');
  const parts = Object.fromEntries([...emblem.querySelectorAll('[data-emblem-part]')]
    .map(node => [node.dataset.emblemPart, node]));

  // One clock, one pure renderer. Every value below is a function of t, so the
  // sequence can be frozen, replayed, resized or scrubbed frame by frame.
  const TL = {
    penEnd: 410, imageIn: 245, imageReady: 460,
    expand: 335, full: 990,
    emblemStart: 990, end: 1520,
  };
  const geom = { w: 0, h: 0, s: 160, scale: 1, markWidth: 2400 };
  const state = { active: false, playing: false, time: 0, start: 0, raf: 0, run: 0, timeout: 0 };

  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = t => ((ax * t + bx) * t + cx) * t;
    const sampleY = t => ((ay * t + by) * t + cy) * t;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, mid = x;
      for (let i = 0; i < 16; i++) {
        mid = (lo + hi) / 2;
        if (sampleX(mid) < x) lo = mid; else hi = mid;
      }
      return sampleY(mid);
    };
  }

  const easeWindow = bezier(.40, 0, .22, 1);
  const easePen = bezier(.28, .22, .32, 1);
  const easeEmblem = bezier(.22, .08, .18, 1);
  const progress = (t, start, end) => clamp01((t - start) / (end - start));

  function measure() {
    geom.w = scene.clientWidth;
    geom.h = scene.clientHeight;
    geom.scale = Math.max(geom.w / 2560, geom.h / 1440) || 1;
    // The pen square keeps the reference framing: 12% of the width, ~21% of
    // the height, never smaller than a thumb nail on a phone.
    geom.s = geom.w < 620
      ? Math.max(78, geom.w * 0.22)
      : Math.min(geom.w * 0.1203, geom.h * 0.214);
    geom.s = Math.max(72, Math.min(geom.s, 264));
  }

  // A stem joins two rigid pieces. Its leading edge arrives first and its
  // trailing edge catches up. Both edges finish at the original SVG vertices.
  function renderEmblem(t) {
    const elapsed = t - TL.emblemStart;
    emblem.style.visibility = elapsed < 0 ? 'hidden' : 'visible';
    if (elapsed < 0) return;

    // Convert the screen margin to the original 35-unit logo coordinate space.
    const margin = (geom.w / geom.markWidth - 1) * 17.5 + 0.1;
    const lead = 1 - easeEmblem(clamp01(elapsed / 420));
    const delayed = 1 - easeEmblem(clamp01((elapsed - 85) / 420));
    const tail = lerp(lead, delayed, 0.78);
    const leftDistance = -23 - margin;
    const rightDistance = 17 + margin; // The lower arm of the X starts at x=18.
    const left = leftDistance * lead;
    const leftTail = leftDistance * tail;
    const right = rightDistance * lead;
    const rightTail = rightDistance * tail;

    // In the left stem x=12 follows the front and x=11 follows the tail.
    // In the right stem x=23 leads and x=24 follows.
    parts['left-front'].setAttribute('transform', `translate(${left} 0)`);
    parts['left-tail'].setAttribute('transform', `translate(${leftTail} 0)`);
    parts['left-stem'].setAttribute('transform',
      `translate(${12 + left} 0) scale(${1 + left - leftTail} 1) translate(-12 0)`);
    parts['right-front'].setAttribute('transform', `translate(${right} 0)`);
    parts['right-stem'].setAttribute('transform',
      `translate(${23 + right} 0) scale(${1 + rightTail - right} 1) translate(-23 0)`);
    parts['right-tail'].setAttribute('transform', `translate(${rightTail} 0)`);
  }

  function scrub(t) {
    const { w, h, s, scale } = geom;
    const opening = easeWindow(progress(t, TL.expand, TL.full));
    const insetX = (w - s) * (1 - opening) / 2;
    const insetY = (h - s) * (1 - opening) / 2;

    // The ink and the image share one aperture throughout the reveal.
    outline.setAttribute('d', `M ${w - insetX} ${h - insetY} V ${insetY} H ${insetX} V ${h - insetY} Z`);
    outline.style.strokeDashoffset = String(1 - easePen(progress(t, 0, TL.penEnd)));
    outline.style.opacity = String(1 - opening);
    viewport.style.clipPath = `inset(${insetY}px ${insetX}px)`;
    viewport.style.opacity = String(easeWindow(progress(t, TL.imageIn, TL.imageReady)));
    world.style.setProperty('--intro-zoom', String(lerp(s / (1440 * scale), 1, opening)));

    const hud = progress(t, 0, 100) * (1 - progress(t, TL.imageIn, TL.imageReady));
    for (const label of hudLabels) label.style.opacity = String(0.8 * hud);
    renderEmblem(t);
  }

  function clearIntroStyles() {
    viewport.style.opacity = '';
    viewport.style.clipPath = '';
    world.style.removeProperty('--intro-zoom');
    outline.style.opacity = '';
    outline.style.strokeDashoffset = '';
    for (const label of hudLabels) label.style.opacity = '';
    emblem.style.visibility = '';
    for (const part of Object.values(parts)) part.removeAttribute('transform');
  }

  function finishIntro() {
    const restoreFocus = document.activeElement === skipButton;
    ++state.run;
    state.active = false;
    state.playing = false;
    cancelAnimationFrame(state.raf);
    clearTimeout(state.timeout);
    clearTimeout(window.introSafetyTimer);
    document.documentElement.classList.remove('intro-pending');
    intro.hidden = true;
    controls.inert = false;
    replayButton.disabled = false;
    clearIntroStyles();
    reset(true);
    showUI(3400);
    if (restoreFocus) replayButton.focus({ preventScroll: true });
  }

  function prepareIntro() {
    reset(true);
    clearTimeout(uiTimer);
    scene.classList.remove('show-ui');
    document.documentElement.classList.add('intro-pending');
    intro.hidden = false;
    controls.inert = true;
    replayButton.disabled = true;
    measure();
    state.time = 0;
    scrub(0);
  }

  function tick(now) {
    if (!state.playing) return;
    const t = now - state.start;
    state.time = t;
    scrub(t);
    if (t >= TL.end) { finishIntro(); return; }
    state.raf = requestAnimationFrame(tick);
  }

  async function startIntro() {
    if (state.active) return;
    if (reducedMotion.matches) { finishIntro(); return; }
    state.active = true;
    const run = ++state.run;
    prepareIntro();
    state.timeout = setTimeout(finishIntro, 12000);

    // Decode before opening the window, with a deadline for slow or broken assets.
    let decodeTimeout;
    await Promise.race([
      Promise.all([...document.querySelectorAll('.plane img')].map(image => image.decode().catch(() => {}))),
      new Promise(resolve => { decodeTimeout = setTimeout(resolve, 650); }),
    ]);
    clearTimeout(decodeTimeout);
    if (!state.active || run !== state.run) return;
    measure();
    scrub(0);
    state.playing = true;
    state.start = performance.now();
    state.raf = requestAnimationFrame(tick);
  }

  /* Deterministic hook for design review and QA: freeze the sequence on any
     millisecond and the frame is exactly reproducible. */
  window.__introDuration = TL.end;
  window.__introSeek = ms => {
    state.playing = false;
    cancelAnimationFrame(state.raf);
    if (intro.hidden) { state.active = true; prepareIntro(); }
    const t = Math.max(0, Math.min(Number(ms) || 0, TL.end));
    state.time = t;
    scrub(t);
    if (t >= TL.end) finishIntro();
    return t;
  };
  window.__introState = () => ({ active: state.active, playing: state.playing, time: state.time });

  /* ------------------------------------------------------------- parallax */
  function resize() {
    // Cover without stretching. Coordinates and movement stay in artwork pixels.
    const scale = Math.max(scene.clientWidth / 2560, scene.clientHeight / 1440);
    scene.style.setProperty('--scene-scale', String(scale));
    // The mark is a lockup, not scenery: it keeps 93.75% of the visible width
    // (exactly 2400 artwork px at 16:9) and stays centred, so a narrow window
    // can never crop it or make it look oversized.
    const mark = Math.min(2400, (scene.clientWidth * 0.9375) / scale);
    geom.markWidth = mark * scale;
    scene.style.setProperty('--emblem-width', mark.toFixed(2) + 'px');
    measure();
    if (state.active) scrub(state.time);
    reset();
  }

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

  function showUI(duration = 2400) {
    scene.classList.add('show-ui');
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => scene.classList.remove('show-ui'), duration);
  }

  function updateMotionButton() {
    const label = paused ? '开启视差' : '暂停视差';
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', label);
    motionButton.title = `${label}（空格）`;
  }

  function toggleMotion() {
    paused = !paused;
    reset(true);
    updateMotionButton();
    showUI();
  }

  function announce(message) {
    notice.textContent = message;
    notice.classList.add('visible');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove('visible'), 2600);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else announce('当前浏览器不支持全屏，可使用浏览器的全屏模式');
    } catch {
      announce('无法进入全屏，请使用浏览器的全屏模式');
    }
    showUI();
  }

  scene.addEventListener('pointermove', event => {
    if (!state.active && event.clientY > scene.clientHeight - 100) showUI(1600);
    if (state.active || paused || event.target.closest('button')) return;
    const bounds = scene.getBoundingClientRect();
    target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    wake();
  }, { passive: true });
  scene.addEventListener('pointerdown', event => {
    if (!state.active && event.pointerType === 'touch') showUI();
  }, { passive: true });
  scene.addEventListener('pointerleave', () => reset());
  scene.addEventListener('pointerup', event => { if (event.pointerType === 'touch') reset(); });
  scene.addEventListener('pointercancel', () => reset());
  window.addEventListener('blur', () => reset(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state.active) finishIntro(); reset(true); } });
  window.addEventListener('resize', resize, { passive: true });
  reducedMotion.addEventListener('change', () => {
    paused = reducedMotion.matches;
    if (reducedMotion.matches && state.active) finishIntro();
    reset(true);
    updateMotionButton();
  });
  skipButton.addEventListener('click', finishIntro);
  replayButton.addEventListener('click', startIntro);
  motionButton.addEventListener('click', toggleMotion);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? '退出全屏' : '进入全屏';
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.title = `${label}（F）`;
    resize();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (state.active) {
      if (event.key === 'Escape') { event.preventDefault(); finishIntro(); }
      return;
    }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); startIntro(); return; }
    if (event.code === 'Space' && !event.target.closest('button')) {
      event.preventDefault();
      toggleMotion();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key === 'Escape') {
      reset(true);
    } else if (event.key === 'Tab') showUI(4000);
  });

  if (coarsePointer.matches) hint.innerHTML = '轻触并拖动，探索异境 <span aria-hidden="true">↗</span>';
  for (const image of document.querySelectorAll('.plane img')) {
    image.addEventListener('error', () => announce('部分图片未能加载，请刷新页面重试'), { once: true });
  }
  updateMotionButton();
  resize();

  // ?intro-seek=1 holds the first frame for frame-by-frame review instead of
  // playing, which keeps screenshots comparable across runs.
  if (new URLSearchParams(location.search).has('intro-seek')) {
    if (!reducedMotion.matches) { state.active = true; prepareIntro(); }
  } else {
    startIntro();
  }
})();

import { bezier, clamp01, lerp } from '../core/motion.js';

// BLUE at 30 fps, in reference pixels. Track the E's right edge and the
// stretched L's left edge. Index 0 is a pre-roll frame with the mark hidden.
const frameMs = 1000 / 30;
const frontEdge = [0, 10, 32, 74, 232, 392, 434, 456, 470];
const stemEdge = [-260, -260, -260, -260, -260, -260, -240, -136, 0, 122, 172, 194, 204, 208, 210];

// The negative stem positions continue the motion behind the screen edge.
// Monotone cubic interpolation passes through each sample at any refresh rate
// and flattens at rest without overshooting short, nearly stationary segments.
function edgePosition(samples, frame) {
  const i = Math.floor(frame);
  if (i >= samples.length - 1) return samples[samples.length - 1];
  const u = frame - i;
  const delta = samples[i + 1] - samples[i];
  if (delta === 0) return samples[i];
  const tangent = (adjacent) => adjacent > 0 ? 2 * adjacent * delta / (adjacent + delta) : 0;
  const before = i > 0 ? samples[i] - samples[i - 1] : 0;
  const after = i + 2 < samples.length ? samples[i + 2] - samples[i + 1] : 0;
  return samples[i] + u * (
    delta * u * (3 - 2 * u) +
    (1 - u) * ((1 - u) * tangent(before) - u * tangent(after))
  );
}

export function createIntro({
  scene,
  viewport,
  pageButton,
  reducedMotion,
  onReset,
  onFinish,
}) {
  const intro = document.querySelector('.intro');
  const outline = document.querySelector('.intro-stroke');
  const emblem = document.querySelector('.emblem-mark');
  const parts = Object.fromEntries(
    [...emblem.querySelectorAll('[data-emblem-part]')].map((node) => [
      node.dataset.emblemPart,
      node,
    ]),
  );

  // One clock, one pure renderer. Every value below is a function of t, so the
  // sequence can be replayed or resized without accumulating offsets.
  const TL = {
    penEnd: 410,
    imageIn: 245,
    imageReady: 460,
    expand: 335,
    full: 990,
    emblemStart: 990,
  };
  const geom = { w: 0, h: 0, s: 160, scale: 1, markWidth: 2400 };
  const state = { active: false, playing: false, time: 0, start: 0, raf: 0, run: 0, timeout: 0 };

  const easeWindow = bezier(0.4, 0, 0.22, 1);
  const easePen = bezier(0.28, 0.22, 0.32, 1);
  const progress = (t, start, end) => clamp01((t - start) / (end - start));

  function measure() {
    geom.w = scene.clientWidth;
    geom.h = scene.clientHeight;
    geom.scale = Math.max(geom.w / 2560, geom.h / 1440) || 1;
    // The pen square keeps the reference framing: 12% of the width, ~21% of
    // the height, never smaller than a thumb nail on a phone.
    geom.s = geom.w < 620 ? Math.max(78, geom.w * 0.22) : Math.min(geom.w * 0.1203, geom.h * 0.214);
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
    const frame = elapsed / frameMs;
    const lead = 1 - edgePosition(frontEdge, frame) / frontEdge[frontEdge.length - 1];
    const tail = 1 - edgePosition(stemEdge, frame) / stemEdge[stemEdge.length - 1];
    const leftDistance = -23 - margin;
    const rightDistance = 17 + margin; // The lower arm of the X starts at x=18.
    const left = leftDistance * lead;
    // The outer edges of the stems are at x=11 and x=24, equally far from
    // their screen edges. At the reference edge crossing, the fronts are home.
    const leftTail = -(11 + margin) * tail;
    const right = rightDistance * lead;
    const rightTail = -leftTail;

    // In the left stem x=12 follows the front and x=11 follows the tail.
    // In the right stem x=23 leads and x=24 follows.
    parts['left-front'].setAttribute('transform', `translate(${left} 0)`);
    parts['left-tail'].setAttribute('transform', `translate(${leftTail} 0)`);
    parts['left-stem'].setAttribute(
      'transform',
      `translate(${12 + left} 0) scale(${1 + left - leftTail} 1) translate(-12 0)`,
    );
    parts['right-front'].setAttribute('transform', `translate(${right} 0)`);
    parts['right-stem'].setAttribute(
      'transform',
      `translate(${23 + right} 0) scale(${1 + rightTail - right} 1) translate(-23 0)`,
    );
    parts['right-tail'].setAttribute('transform', `translate(${rightTail} 0)`);
  }

  function scrub(t) {
    const { w, h, s, scale } = geom;
    const opening = easeWindow(progress(t, TL.expand, TL.full));
    const insetX = ((w - s) * (1 - opening)) / 2;
    const insetY = ((h - s) * (1 - opening)) / 2;

    // The ink and the image share one aperture throughout the reveal.
    outline.setAttribute(
      'd',
      `M ${w - insetX} ${h - insetY} V ${insetY} H ${insetX} V ${h - insetY} Z`,
    );
    outline.style.strokeDashoffset = String(1 - easePen(progress(t, 0, TL.penEnd)));
    outline.style.opacity = String(1 - opening);
    viewport.style.clipPath = `inset(${insetY}px ${insetX}px)`;
    viewport.style.opacity = String(easeWindow(progress(t, TL.imageIn, TL.imageReady)));
    viewport.style.setProperty('--intro-zoom', String(lerp(s / (1440 * scale), 1, opening)));

    renderEmblem(t);
  }

  function clearIntroStyles() {
    viewport.style.opacity = '';
    viewport.style.clipPath = '';
    viewport.style.removeProperty('--intro-zoom');
    outline.style.opacity = '';
    outline.style.strokeDashoffset = '';
    emblem.style.visibility = '';
    for (const part of Object.values(parts)) part.removeAttribute('transform');
  }

  function finish() {
    ++state.run;
    state.active = false;
    state.playing = false;
    cancelAnimationFrame(state.raf);
    clearTimeout(state.timeout);
    clearTimeout(window.introSafetyTimer);
    document.documentElement.classList.remove('intro-pending');
    intro.hidden = true;
    scene.classList.remove('intro-running');
    clearIntroStyles();
    onReset();
    onFinish();
  }

  function prepareIntro() {
    onReset();
    scene.classList.add('intro-running');
    pageButton.textContent = '跳过开场';
    document.documentElement.classList.add('intro-pending');
    intro.hidden = false;
    measure();
    state.time = 0;
    scrub(0);
  }

  function tick(now) {
    if (!state.playing) return;
    const t = now - state.start;
    state.time = t;
    scrub(t);
    if (t >= TL.emblemStart + (stemEdge.length - 1) * frameMs) {
      finish();
      return;
    }
    state.raf = requestAnimationFrame(tick);
  }

  async function start() {
    if (state.active) return;
    if (reducedMotion.matches) {
      finish();
      return;
    }
    state.active = true;
    const run = ++state.run;
    prepareIntro();
    state.timeout = setTimeout(finish, 12000);

    // Decode before opening the window, with a deadline for slow or broken assets.
    let decodeTimeout;
    await Promise.race([
      Promise.all(
        [...document.querySelectorAll('.plane img')].map((image) => image.decode().catch(() => {})),
      ),
      new Promise((resolve) => {
        decodeTimeout = setTimeout(resolve, 650);
      }),
    ]);
    clearTimeout(decodeTimeout);
    if (!state.active || run !== state.run) return;
    measure();
    scrub(0);
    state.playing = true;
    state.start = performance.now();
    state.raf = requestAnimationFrame(tick);
  }

  return {
    start,
    finish,
    get active() {
      return state.active;
    },
    resize(markWidth) {
      geom.markWidth = markWidth;
      measure();
      if (state.active) scrub(state.time);
    },
  };
}

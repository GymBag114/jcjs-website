// Page turns use the authored timelines. Within either horizontal track,
// wheel, drag and keyboard distances are all expressed in CSS pixels.
export function bindNavigation(
  scene,
  gallery,
  { onPrint, busy, introActive, turnPage, beginLandscapeWipe, hitTower, brush, endTouch },
) {
  const blocked = () => busy() || gallery.turning();
  function step(forward) {
    if (onPrint() && (forward || gallery.active)) gallery.step(forward);
    else turnPage(forward);
  }

  let drag;
  let pending = null;
  let pendingFrame = 0;
  function clearPending() {
    pending = null;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
  }
  function moveKey({ direction, page, repeat }) {
    if (!repeat && gallery.target >= gallery.joinPage) {
      gallery.step(direction > 0);
    } else if (onPrint() && gallery.canPan(direction)) {
      const fraction = page ? 0.95 : repeat ? 0.055 : 0.48;
      gallery.pan(direction * scene.clientWidth * fraction);
    } else step(direction > 0);
  }
  function mustWait(direction) {
    return blocked() || (direction < 0 && gallery.target === 0 && gallery.active);
  }
  function flush() {
    pendingFrame = 0;
    if (!pending) return;
    if (mustWait(pending.direction)) pendingFrame = requestAnimationFrame(flush);
    else {
      const { move } = pending;
      pending = null;
      move();
    }
  }
  function key(event) {
    cancelDrag();
    const { key, repeat } = event;
    if (key === 'Home' || key === 'End') {
      clearPending();
      if (key === 'Home' && gallery.active) gallery.seek(0);
      else if (key === 'End' && onPrint()) gallery.seek(gallery.limit);
      else if (!repeat) step(key === 'End');
      return;
    }
    const direction = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(key) ? 1 : -1;
    schedule(direction, () => moveKey({ direction, page: key.startsWith('Page'), repeat }), repeat);
  }
  function schedule(direction, move, repeat = false) {
    if (!repeat) clearPending();
    if (introActive()) return;
    if (!repeat && gallery.reverseWipe(direction)) return;
    if (!repeat && busy() && !gallery.active && direction > 0 !== onPrint()) {
      turnPage(direction > 0);
      return;
    }
    if (mustWait(direction)) {
      if (!repeat) {
        pending = { direction, move };
        pendingFrame = requestAnimationFrame(flush);
      }
    } else move();
  }

  let lastWheel = -Infinity,
    lastDelta = 0,
    wheelDistance = 0;
  let consumed = false;
  let wheelTurnLocked = false;
  scene.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || zoomed()) return;
      const mode = event.deltaMode;
      const dx = event.deltaX * (mode === 2 ? scene.clientWidth : mode === 1 ? 16 : 1);
      const dy = event.deltaY * (mode === 2 ? scene.clientHeight : mode === 1 ? 16 : 1);
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal && !onPrint()) return;
      const delta = horizontal ? dx : dy;
      if (!delta) return;
      event.preventDefault();
      const now = event.timeStamp;
      const gap = now - lastWheel;
      const reversed = delta * lastDelta < 0;
      lastWheel = now;
      lastDelta = delta;
      // Wheel has no portable end-of-gesture marker. Keep the turn locked
      // through the wipe, then require a quiet gap before the next burst.
      if (gallery.turning() || (drag?.mode === 'wipe' && gallery.active)) {
        wheelTurnLocked = true;
        wheelDistance = 0;
        return;
      }
      if (wheelTurnLocked && gap <= 220) return;
      wheelTurnLocked = false;
      cancelDrag();
      // A same-direction wheel burst owns one track or turn. A later
      // momentum packet must not open the next turn at a track boundary.
      if (gap > 140 || reversed) {
        wheelDistance = 0;
        consumed = false;
      }
      if (consumed) return;
      if (introActive()) return;
      if (onPrint() && reversed) gallery.grab();
      if (!blocked() && onPrint() && gallery.canPan(delta)) {
        clearPending();
        gallery.panWheel(delta);
        if (gallery.canPan(delta)) return;
      } else {
        wheelDistance += delta;
        if (Math.abs(wheelDistance) < 26) return;
        const distance = wheelDistance;
        schedule(Math.sign(delta), () => {
          if (onPrint() && gallery.canPan(distance)) {
            gallery.panWheel(distance);
            return;
          }
          const from = gallery.target;
          step(distance > 0);
          if (
            from !== gallery.target &&
            (from === gallery.unionPage || gallery.target === gallery.unionPage)
          )
            wheelTurnLocked = true;
        });
      }
      consumed = true;
      wheelDistance = 0;
    },
    { passive: false },
  );

  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01;
  window.visualViewport?.addEventListener('resize', () => {
    scene.classList.toggle('zoomed', zoomed());
    if (zoomed()) cancelDrag(true);
  });

  scene.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) {
      cancelDrag(true);
      clearPending();
      return;
    }
    if (
      introActive() ||
      gallery.turning() ||
      zoomed() ||
      event.button !== 0 ||
      event.target.closest('button')
    )
      return;
    clearPending();
    if (onPrint() && !blocked()) gallery.grab();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      last: 0,
      time: event.timeStamp,
      speed: 0,
      start: gallery.target,
      axis: null,
      mode: null,
      wipe: null,
      origin: 0,
      progress: 0,
      panned: false,
      waiting: blocked(),
      tower:
        event.pointerType === 'touch' &&
        onPrint() &&
        !gallery.active &&
        hitTower(event.clientX, event.clientY),
    };
  });

  function startWipe(direction, origin) {
    const wipe = gallery.active ? gallery.beginWipe(direction) : beginLandscapeWipe(direction);
    if (!wipe) return false;
    drag.mode = 'wipe';
    drag.wipe = wipe;
    drag.direction = direction;
    drag.origin = origin;
    drag.span = Math.max(140, (drag.axis === 'x' ? scene.clientWidth : scene.clientHeight) * 0.7);
    return true;
  }

  function movePointer(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = drag.x - event.clientX,
      dy = drag.y - event.clientY;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      const distance = drag.axis === 'x' ? dx : dy;
      if (drag.waiting) drag.mode = 'waiting';
      else if (drag.tower && drag.axis === 'x') {
        drag.mode = 'brush';
        brush({ clientX: drag.x, clientY: drag.y });
      } else if (onPrint() && gallery.canPan(distance)) drag.mode = 'pan';
      else {
        drag.mode = 'idle';
        if (onPrint() || drag.axis === 'y') startWipe(Math.sign(distance), 0);
      }
      if (scene.hasPointerCapture(event.pointerId) || event.type !== 'pointerup')
        scene.setPointerCapture(event.pointerId);
    }
    const distance = drag.axis === 'x' ? dx : dy;
    const delta = distance - drag.last;
    if (!delta) return;
    if (drag.mode === 'pan') {
      drag.panned = true;
      const excess = gallery.pan(delta, true);
      if (Math.abs(excess) > 0.01) startWipe(Math.sign(excess), distance - excess);
    }
    if (drag.mode === 'wipe') {
      const travel = (distance - drag.origin) * drag.direction;
      drag.progress = Math.max(0, Math.min(1, travel / drag.span));
      drag.wipe.preview(drag.progress);
      if (travel < 0 && onPrint() && gallery.canPan(-drag.direction)) {
        drag.wipe.settle(false);
        drag.wipe = null;
        drag.mode = 'pan';
        gallery.pan(distance - drag.origin, true);
      }
    } else if (drag.mode === 'brush') brush(event);
    const dt = Math.max(1, event.timeStamp - drag.time);
    drag.speed += (delta / dt - drag.speed) * (1 - Math.exp(-dt / 35));
    drag.last = distance;
    drag.time = event.timeStamp;
  }
  scene.addEventListener('pointermove', movePointer, { passive: true });
  scene.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    movePointer(event);
    const { mode, last, speed, time, direction, origin, progress, wipe } = drag;
    drag = null;
    const releaseSpeed = event.timeStamp - time < 100 ? speed : 0;
    if (mode === 'pan') gallery.release(releaseSpeed);
    if (mode === 'wipe') {
      const travel = (last - origin) * direction;
      if (gallery.active) {
        wheelTurnLocked = true;
        lastWheel = event.timeStamp;
        wheelDistance = 0;
      }
      wipe.settle(
        progress >= 0.5 ||
          (releaseSpeed * direction >= -0.2 &&
            (travel >= 64 || (travel >= 18 && releaseSpeed * direction > 0.32))),
      );
    }
    if (mode === 'waiting' && Math.abs(last) >= 32) {
      schedule(Math.sign(last), () => {
        if (onPrint() && gallery.canPan(last)) gallery.pan(last);
        else step(last > 0);
      });
    }
    endTouch();
  });

  function cancelDrag(restore = false) {
    if (!drag) return;
    drag.wipe?.settle(false);
    if (restore && drag.panned) {
      gallery.seek(drag.start);
      gallery.finish();
    }
    if (scene.hasPointerCapture(drag.id)) scene.releasePointerCapture(drag.id);
    drag = null;
    endTouch();
  }
  scene.addEventListener('pointercancel', (event) => {
    if (event.pointerId === drag?.id) cancelDrag(true);
  });
  scene.addEventListener('lostpointercapture', (event) => {
    if (event.target === scene && event.pointerId === drag?.id) cancelDrag();
  });
  window.addEventListener('blur', () => {
    clearPending();
    cancelDrag();
  });
  return { key, step };
}

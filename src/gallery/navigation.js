// Page turns use the authored timelines. Within either horizontal track,
// wheel, drag and keyboard distances are all expressed in CSS pixels.
export function bindNavigation(
  scene,
  gallery,
  { onPrint, busy, introActive, turnPage, brush, endTouch },
) {
  const blocked = () => busy() || gallery.turning();
  function step(forward) {
    if (onPrint() && (forward || gallery.active)) gallery.step(forward);
    else turnPage(forward);
  }

  let drag;
  const pending = [];
  let pendingFrame = 0;
  function clearPending() {
    pending.length = 0;
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
    while (pending.length && !mustWait(pending[0].direction)) {
      pending.shift().move();
    }
    if (pending.length) pendingFrame = requestAnimationFrame(flush);
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
    if (pending.length && pending[0].direction !== direction) clearPending();
    if (mustWait(direction) || pending.length) {
      // Remember deliberate inputs made during a wipe. Held keys resume
      // on the next system repeat, without building a backlog after keyup.
      if (!repeat) pending.push({ direction, move });
      if (pending.length && !pendingFrame) pendingFrame = requestAnimationFrame(flush);
    } else move();
  }

  let lastWheel = -Infinity,
    lastDelta = 0,
    wheelDistance = 0;
  let consumed = false,
    consumedAt = 0,
    peak = 0;
  scene.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) return;
      const mode = event.deltaMode;
      const dx = event.deltaX * (mode === 2 ? scene.clientWidth : mode === 1 ? 16 : 1);
      const dy = event.deltaY * (mode === 2 ? scene.clientHeight : mode === 1 ? 16 : 1);
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal && !onPrint()) return;
      const delta = horizontal ? dx : dy;
      if (!delta) return;
      event.preventDefault();
      cancelDrag();
      const now = event.timeStamp;
      const gap = now - lastWheel;
      const amount = Math.abs(delta);
      const previous = Math.abs(lastDelta);
      const reversed = delta * lastDelta < 0;
      lastWheel = now;
      lastDelta = delta;
      if (blocked()) {
        if (consumed) peak = Math.max(peak, amount);
        return;
      }
      // Momentum packets keep arriving after a trackpad flick. Another
      // detent, deliberate acceleration or sustained pressure can continue.
      if (
        gap > 140 ||
        reversed ||
        (consumed &&
          (amount > previous * 1.4 + 2 ||
            (gap > 45 && amount >= Math.max(4, previous)) ||
            (now - consumedAt > 180 && amount >= Math.max(4, peak))))
      ) {
        wheelDistance = 0;
        consumed = false;
      }
      if (consumed) return;
      clearPending();
      if (onPrint() && reversed) gallery.grab();
      if (onPrint() && gallery.canPan(delta)) {
        gallery.panWheel(delta);
        if (gallery.canPan(delta)) return;
      } else {
        wheelDistance += delta;
        if (Math.abs(wheelDistance) < 26) return;
        schedule(Math.sign(delta), () => step(delta > 0));
      }
      consumed = true;
      peak = amount;
      consumedAt = now;
      wheelDistance = 0;
    },
    { passive: false },
  );

  scene.addEventListener('pointerdown', (event) => {
    if (
      introActive() ||
      !event.isPrimary ||
      event.pointerType !== 'touch' ||
      event.target.closest('button')
    )
      return;
    clearPending();
    lastWheel = -Infinity;
    if (onPrint() && !blocked()) gallery.grab();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      last: 0,
      time: event.timeStamp,
      speed: 0,
      mode: null,
      axis: null,
    };
  });

  function moveTouch(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = drag.x - event.clientX,
      dy = drag.y - event.clientY;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 5 || blocked()) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      const direction = drag.axis === 'x' ? dx : dy;
      if (onPrint() && gallery.canPan(direction)) drag.mode = 'pan';
      else if (!gallery.active && drag.axis === 'x') drag.mode = 'brush';
      else drag.mode = 'turn';
      // Native pointer capture on the anchor preserves a tap. Transfer
      // capture only once dragging starts so its release cannot open JOIN US.
      scene.setPointerCapture(event.pointerId);
    }
    const distance = drag.axis === 'x' ? dx : dy;
    const delta = distance - drag.last;
    if (!delta) return;
    if (drag.mode === 'pan') {
      gallery.pan(delta, true);
      const dt = Math.max(1, event.timeStamp - drag.time);
      const blend = 1 - Math.exp(-dt / 35);
      drag.speed += (delta / dt - drag.speed) * blend;
    } else if (drag.mode === 'brush' && onPrint()) brush(event);
    drag.last = distance;
    drag.time = event.timeStamp;
  }
  scene.addEventListener('pointermove', moveTouch, { passive: true });
  scene.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    moveTouch(event);
    const { mode, last, speed, time, x, y } = drag;
    drag = null;
    if (mode === 'pan' && event.timeStamp - time < 80) gallery.release(speed);
    if (mode === 'turn' && Math.abs(last) >= 42) step(last > 0);
    if (!mode && blocked()) {
      // A complete new swipe can fit inside a page wipe. Apply it when
      // the next sheet arrives, using its own track and measured width.
      const dx = x - event.clientX,
        dy = y - event.clientY;
      const distance = onPrint() && Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(distance) >= 42)
        schedule(Math.sign(distance), () => {
          if (onPrint() && gallery.canPan(distance)) gallery.pan(distance);
          else step(distance > 0);
        });
    }
    endTouch();
  });
  function cancelDrag() {
    if (!drag) return;
    drag = null;
    endTouch();
  }
  function cancelTouch(event) {
    if (event.pointerId === drag?.id) cancelDrag();
  }
  scene.addEventListener('pointercancel', cancelTouch);
  scene.addEventListener('lostpointercapture', (event) => {
    if (event.target === scene) cancelTouch(event);
  });
  window.addEventListener('blur', () => {
    clearPending();
    cancelDrag();
  });
  return { key, step };
}

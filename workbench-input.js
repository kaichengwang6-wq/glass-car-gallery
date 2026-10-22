// Route direct manipulation before OrbitControls sees the pointer. Geometry and
// committed assembly state remain owned by the workbench, never by this adapter.
export function initWorkbenchInput(host) {
  const { canvas, camera, orbit, projectPoint, setRay, raycaster, invalidate } = host;
  let gesture = null;
  const held = new Set();
  let blocked = false;
  const active = () => host.getWorkbench();
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const syncUI = () => { host.sync(); invalidate(); };
  const release = current => {
    if (current?.surface.hasPointerCapture(current.pointerId)) current.surface.releasePointerCapture(current.pointerId);
    canvas.style.cursor = '';
    orbit.enabled = host.canOrbit();
  };
  const cancel = () => {
    const current = gesture;
    gesture = null;
    if (current) {
      if (current.kind === 'part') current.workbench.cancelDrag();
      // Trial angles are committed immediately, like the accessible range input;
      // cancelling a pointer stops manipulation without undoing a viewed cycle.
      release(current); syncUI();
    }
  };
  const coordinates = workbench => {
    const state = workbench.getState(), points = workbench.getDragWorldPoints(state.selected);
    return { selected: state.selected, ...(points ? Object.fromEntries(Object.entries(points).map(([key, point]) => [key, projectPoint(point)])) : {}), crank: projectPoint(workbench.getCrankWorldPoint()) };
  };
  const down = event => {
    if (event.button !== 0 || blocked || held.size > 1) return;
    const workbench = active();
    if (!workbench || workbench.getState().inspecting) return;
    const state = workbench.getState();
    const crank = event.currentTarget.id === 'workbench-crank-handle';
    const handle = event.currentTarget.id === 'workbench-drag-handle';
    if (state.trial !== crank) return;
    if (!handle && !crank) {
      setRay(event);
      if (workbench.pick(raycaster) !== state.selected) return;
    }
    stop(event);
    host.cancelCamera();
    orbit.enabled = false;
    const origin = { x: event.clientX, y: event.clientY };
    if (crank) {
      // The ring is a screen-space control anchored to the actual crank end.
      const rect = event.currentTarget.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      gesture = { workbench, kind: 'crank', surface: event.currentTarget, pointerId: event.pointerId, origin, center,
        previousAngle: Math.atan2(origin.y - center.y, origin.x - center.x), initialAngle: state.trialAngle, angle: state.trialAngle, distance: 0 };
    } else {
      const result = workbench.beginDrag(state.selected);
      if (!result.ok) { orbit.enabled = host.canOrbit(); syncUI(); return; }
      const points = coordinates(workbench), dx = points.end.x - points.start.x, dy = points.end.y - points.start.y;
      const length = Math.hypot(dx, dy), startProgress = state.modules.find(module => module.id === state.selected)?.removed ? 1 : 0;
      gesture = { workbench, kind: 'part', surface: event.currentTarget, pointerId: event.pointerId, origin, startProgress,
        axis: length < 20 ? { x: 0, y: -1 } : { x: dx / length, y: dy / length }, length: Math.max(length, 80), distance: 0 };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing'; syncUI();
  };
  const move = event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    stop(event);
    if (active() !== gesture.workbench) { cancel(); return; }
    const g = gesture, dx = event.clientX - g.origin.x, dy = event.clientY - g.origin.y;
    g.distance = Math.max(g.distance, Math.hypot(dx, dy));
    if (g.kind === 'part') {
      g.workbench.updateDrag(g.startProgress + (dx * g.axis.x + dy * g.axis.y) / g.length);
    } else {
      const angle = Math.atan2(event.clientY - g.center.y, event.clientX - g.center.x);
      let delta = angle - g.previousAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      // Ignore the unstable centre of the ring, keeping phase continuous.
      if (Math.hypot(event.clientX - g.center.x, event.clientY - g.center.y) >= 12) {
        g.angle = Math.min(720, Math.max(0, g.angle + delta * 180 / Math.PI));
        g.workbench.setTrialAngle(g.angle);
      }
      g.previousAngle = angle;
    }
    syncUI();
  };
  const up = event => {
    held.delete(event.pointerId);
    if (!held.size) blocked = false;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    move(event);
    const current = gesture;
    if (!current) return;
    gesture = null;
    if (current.kind === 'part') {
      if (current.distance < 6) current.workbench.cancelDrag();
      else current.workbench.endDrag();
    }
    release(current); syncUI();
  };
  const interrupted = event => {
    held.delete(event.pointerId);
    if (!held.size) blocked = false;
    if (gesture?.pointerId === event.pointerId) cancel();
  };
  window.addEventListener('pointerdown', event => {
    held.add(event.pointerId);
    if (gesture && event.pointerId !== gesture.pointerId) { blocked = true; cancel(); stop(event); }
    else if (blocked) stop(event);
  }, true);
  window.addEventListener('pointermove', move, { capture: true, passive: false });
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', interrupted, true);
  window.addEventListener('lostpointercapture', interrupted, true);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gesture) { stop(event); cancel(); }
  }, true);
  const leave = () => { cancel(); held.clear(); blocked = false; };
  window.addEventListener('blur', leave);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
  canvas.addEventListener('webglcontextlost', leave);
  for (const surface of [canvas, document.getElementById('workbench-drag-handle'), document.getElementById('workbench-crank-handle')].filter(Boolean)) {
    surface.addEventListener('pointerdown', down, { capture: true, passive: false });
  }
  const dragHandle = document.getElementById('workbench-drag-handle');
  dragHandle?.addEventListener('click', event => {
    if (event.detail !== 0 || !active()) return;
    const workbench = active(), state = workbench.getState();
    const removed = state.modules.find(module => module.id === state.selected)?.removed;
    workbench[removed ? 'install' : 'remove'](state.selected); syncUI();
  });
  document.getElementById('workbench-crank-handle')?.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !active()?.getState().trial) return;
    stop(event);
    const workbench = active(), angle = workbench.getState().trialAngle;
    workbench.setTrialAngle(event.key === 'Home' ? 0 : event.key === 'End' ? 720 : angle + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 10 : -10)); syncUI();
  });
  return {
    cancel,
    sync() { if (gesture && (active() !== gesture.workbench || gesture.kind === 'part' && !gesture.workbench.getState().dragging)) cancel(); },
    getState: () => ({ kind: gesture?.kind || null, pointerId: gesture?.pointerId ?? null, blocked, orbitEnabled: orbit.enabled }),
    points: () => active() ? { ...coordinates(active()), camera: camera.position.toArray(), orbitTarget: orbit.target.toArray() } : null
  };
}

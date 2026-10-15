// Keep this query aligned with mobile.css and mobile-topics.css.
export const COMPACT_QUERY = '(max-width: 900px), (max-width: 1100px) and (pointer: coarse)';
const compact = window.matchMedia(COMPACT_QUERY);
export const isCompactLayout = () => compact.matches;
let initialized = false;

export function initMobileUI() {
  if (initialized) return;
  initialized = true;
  const body = document.body;
  const toggle = document.getElementById('mobile-panel-toggle');
  const hint = document.getElementById('mobile-gesture-hint');
  const views = document.getElementById('view-controls');
  const controls = document.getElementById('controls');
  const performance = document.getElementById('vehicle-performance');
  const performanceHome = document.createComment('desktop performance card');
  performance.before(performanceHome);
  const heading = document.getElementById('exhibit-heading');
  const topics = document.getElementById('experience-nav');
  const syncPerformanceLayout = () => {
    if (!compact.matches && body.dataset.mode === 'exhibit' && body.dataset.section === 'car') {
      topics.style.top = `${Math.ceil(heading.getBoundingClientRect().bottom) + 12}px`;
    } else topics.style.removeProperty('top');
  };
  const home = document.createComment('desktop view controls');
  views.before(home);
  const panels = { car: controls, history: document.getElementById('story-panel'), engine: document.getElementById('engine-panel'), lab: document.getElementById('lab-panel') };
  const names = { car: '操作区', history: '故事讲解', engine: '发动机面板', lab: '玩法面板' };
  let section = '', mode = '';
  const sync = () => {
    const focused = document.activeElement;
    const focusedView = views.contains(focused);
    const isCompact = compact.matches;
    const nextSection = body.dataset.section || 'car';
    const nextMode = body.dataset.mode;
    if (section !== nextSection || mode !== nextMode || !isCompact) body.dataset.panelCollapsed = 'false';
    section = nextSection; mode = nextMode;
    // Reparent the existing controls; listeners and selected view survive rotation.
    if (isCompact && views.parentNode !== controls) controls.append(views);
    else if (!isCompact && views.parentNode === controls) home.after(views);
    if (isCompact && performance.parentNode !== controls) controls.prepend(performance);
    else if (!isCompact && performance.parentNode === controls) performanceHome.after(performance);
    const active = panels[section] || controls;
    const collapsed = isCompact && body.dataset.panelCollapsed === 'true';
    for (const panel of Object.values(panels)) panel.inert = isCompact && (collapsed || panel !== active || mode !== 'exhibit');
    toggle.hidden = !isCompact || mode !== 'exhibit';
    toggle.setAttribute('aria-controls', active.id);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.firstElementChild.textContent = `${collapsed ? '展开' : '收起'}${names[section] || names.car}`;
    toggle.lastElementChild.textContent = collapsed ? '⌃' : '⌄';
    hint.hidden = !isCompact || !['gallery', 'exhibit'].includes(mode);
    hint.textContent = mode === 'gallery' ? '左右滑动切换 · 轻点拉出车盒' : '单指旋转 · 双指缩放';
    body.dataset.compact = String(isCompact);
    syncPerformanceLayout();
    const visible = element => element?.isConnected && !element.closest('[hidden],[inert]') && element.getClientRects().length > 0;
    if (focusedView && visible(focused)) focused.focus({ preventScroll: true });
    else if (focused && focused !== body && !visible(focused)) {
      const destination = mode === 'exhibit'
        ? document.querySelector(`#experience-nav [data-section="${section}"]`) || document.getElementById('return-button')
        : document.getElementById('brand-home');
      if (visible(destination)) destination.focus({ preventScroll: true });
    }
  };
  toggle.addEventListener('click', () => {
    toggle.focus({ preventScroll: true });
    body.dataset.panelCollapsed = String(body.dataset.panelCollapsed !== 'true');
    sync();
  });
  new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['data-mode', 'data-section'] });
  compact.addEventListener('change', sync);
  new ResizeObserver(syncPerformanceLayout).observe(heading);
  sync();
}

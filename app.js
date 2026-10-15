import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CarRig } from './rig.js';
import { VehicleExperience } from './vehicle-experience.js';
import { catalog, vehicleIds, galleryRows, galleryLayout } from './vehicle-catalog.js';
import { isCompactLayout, initMobileUI } from './mobile-ui.js';
import { renderPerformance, performanceSummaryHTML } from './vehicle-performance.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const vec = a => new THREE.Vector3(...a);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const partNames = { driver_door: '驾驶侧车门', passenger_door: '副驾侧车门', hood: '前行李舱', engine_cover: '发动机舱盖' };
let mode = 'gallery', selected = null, browseId = 'f430', progress = 0, transition = null, cameraMove = null;
let rig = null, fullModel = null, experience = null, loadEpoch = 0, ready = false, renderer, scene, camera, orbit;
let dirty = true, framePending = false, renderFrames = 0, noticeTimer, hovered = null, pointer = null, currentView = 'hero';
let previewEpoch = 0, layoutMobile = isCompactLayout(), cabinet, keyLight, resizeFrame = 0, lastScrolledBrowse = null, carFramingKey = '', orbitGesture = false;
const cases = new Map();
const rigEnvelopes = new WeakMap();
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const mobile = isCompactLayout;
const reduced = () => motionPreference.matches;
const visibleIds = () => mobile() ? [browseId] : vehicleIds;
const viewport = () => renderer.domElement.getBoundingClientRect();
const stageSize = () => { const rect = $('#stage').getBoundingClientRect(); return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }; };
const pixelRatio = () => Math.min(devicePixelRatio || 1, mobile() ? (stageSize().width <= 480 ? 1.25 : 1.35) : 1.65);

function projectPoint(point) {
  const rect = viewport(), p = point.clone().project(camera);
  return { x: rect.left + (p.x * .5 + .5) * rect.width, y: rect.top + (-p.y * .5 + .5) * rect.height };
}
function objectBounds(object) {
  const bounds = new THREE.Box3();
  if (!object) return bounds;
  object.updateWorldMatrix(true, true);
  // Hidden teaching geometry and helper groups must not shrink the real subject.
  object.traverseVisible(node => {
    if (!node.isMesh || !node.geometry) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  return bounds;
}
function exhibitBounds() {
  const entry = cases.get(selected || browseId);
  const bounds = objectBounds(fullModel || entry?.preview);
  const drawerPosition = entry?.drawer.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3();
  if (bounds.isEmpty()) bounds.set(vec([-1.60, .34, -.87]).add(drawerPosition), vec([1.60, 1.26, .87]).add(drawerPosition));
  // Opening may still be moving the drawer. Fit its final resting location.
  bounds.translate(drawerPosition.clone().negate());
  // Keep the complete visible pedestal in frame as well as the vehicle body.
  bounds.union(new THREE.Box3(vec([-1.79, .05, -1.02]), vec([1.79, .31, 1.02])));
  if (rig) {
    const envelopes = measureRigEnvelopes(rig, drawerPosition);
    for (const [id, part] of rig.parts) if (part.target > 0 || part.progress > 0) bounds.union(envelopes.get(id));
  }
  return bounds.translate(vec([0, .05, 1.80]));
}
function measureRigEnvelopes(carRig, drawerPosition) {
  if (rigEnvelopes.has(carRig)) return rigEnvelopes.get(carRig);
  const envelopes = new Map(), snapshot = carRig.getState().parts, onChange = carRig.onChange;
  carRig.onChange = () => {};
  try {
    for (const id of carRig.parts.keys()) {
      carRig.restoreState(snapshot);
      const bounds = new THREE.Box3();
      for (const progress of [0, .25, .5, .75, 1]) {
        carRig.setProgress(id, progress);
        bounds.union(objectBounds(carRig.model));
      }
      envelopes.set(id, bounds.translate(drawerPosition.clone().negate()).expandByScalar(.035));
    }
  } finally { carRig.restoreState(snapshot); carRig.onChange = onChange; }
  rigEnvelopes.set(carRig, envelopes);
  return envelopes;
}
function fitCamera(preset, objectOrBounds, { padding = 1.16, target: focalTarget, force = false } = {}) {
  if (!mobile() && !force) return preset;
  const bounds = objectOrBounds?.isBox3 ? objectOrBounds.clone() : objectOrBounds ? objectBounds(objectOrBounds) : exhibitBounds();
  if (bounds.isEmpty()) return preset;
  const target = focalTarget?.clone() || bounds.getCenter(new THREE.Vector3());
  const direction = preset.position.clone().sub(preset.target).normalize();
  if (!direction.lengthSq()) direction.set(0, .3, 1).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  if (!right.lengthSq()) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const size = stageSize(), tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanX = tanY * size.width / size.height;
  const horizontalRoom = mobile() ? 1 : Math.max(.30, (size.width - 780) / size.width);
  const verticalRoom = mobile() ? 1 : Math.max(.60, (size.height - 230) / size.height);
  let distance = 1.35;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const offset = vec([x, y, z]).sub(target), depth = offset.dot(direction);
    distance = Math.max(distance, depth + Math.abs(offset.dot(right)) * padding / (tanX * horizontalRoom), depth + Math.abs(offset.dot(up)) * padding / (tanY * verticalRoom), depth + camera.near + .05);
  }
  return { position: target.clone().addScaledVector(direction, distance), target };
}

function buildGalleryUI() {
  $('#case-labels').replaceChildren(...vehicleIds.map((id, i) => {
    const b = document.createElement('button'), car = catalog[id];
    b.className = 'case-label'; b.dataset.car = id; b.setAttribute('aria-label', `拉出 ${car.brand} ${car.name} 车盒`);
    b.innerHTML = `<span class="case-number">${String(i + 1).padStart(2, '0')} / ${car.brand}</span><strong>${car.name}</strong>${performanceSummaryHTML(id)}<span class="case-action">拉出车盒 <i>↗</i></span>`;
    return b;
  }));
  $('.mobile-picker').replaceChildren(...vehicleIds.map((id, i) => {
    const b = document.createElement('button'); b.dataset.browse = id;
    b.innerHTML = `${String(i + 1).padStart(2, '0')} <span>${catalog[id].name}</span>`;
    return b;
  }));
  $('#footer-count').textContent = `${String(vehicleIds.length).padStart(2, '0')} PIECES`;
  $('.collection-count b').textContent = String(vehicleIds.length).padStart(2, '0');
}
function layoutCases() {
  for (const [id, entry] of cases) {
    const p = mobile() ? { x: 0, y: 0, z: 0 } : galleryLayout[id];
    entry.x = p.x; entry.y = p.y; entry.z = p.z;
    entry.home.position.set(p.x, p.y, p.z);
  }
}
function syncGalleryUI() {
  const ids = visibleIds();
  $$('[data-car]').forEach(b => { b.hidden = !ids.includes(b.dataset.car); b.disabled = !ready; b.classList.toggle('located', b.dataset.car === browseId); });
  $$('[data-browse]').forEach(b => { const active = b.dataset.browse === browseId; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', String(active)); });
  $('#gallery-paging').hidden = !mobile();
  $('#page-status').textContent = `${String(vehicleIds.indexOf(browseId) + 1).padStart(2, '0')} / ${String(vehicleIds.length).padStart(2, '0')}`;
  $('#page-prev').disabled = browseId === vehicleIds[0];
  $('#page-next').disabled = browseId === vehicleIds.at(-1);
  $('#mobile-car-name').textContent = catalog[browseId].name;
  $('#mobile-pull').setAttribute('aria-label', `拉出 ${catalog[browseId].name} 车盒`);
  $('#mobile-pull').disabled = !ready;
  if (mobile() && lastScrolledBrowse !== browseId) {
    lastScrolledBrowse = browseId;
    requestAnimationFrame(() => $(`[data-browse="${browseId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'instant' : 'smooth' }));
  }
}
async function browseCar(id, { focus = false } = {}) {
  if (mode !== 'gallery' || !cases.has(id)) return false;
  browseId = id; hovered = id; pointer = null;
  layoutCases(); syncGalleryUI();
  if (mobile()) moveCamera(galleryCamera(), 460);
  invalidate();
  const ok = mobile() ? await loadPreviews() : ready;
  if (focus && ok) $(`[data-browse="${id}"]`)?.focus({ preventScroll: true });
  return ok;
}
function turnPage(step) {
  if (mode !== 'gallery') return;
  const index = vehicleIds.indexOf(browseId) + step;
  if (index >= 0 && index < vehicleIds.length) browseCar(vehicleIds[index], { focus: !mobile() });
}

function invalidate() {
  dirty = true;
  if (!framePending && renderer) { framePending = true; requestAnimationFrame(frame); }
}
function loading(show, text = '', percentage = '') {
  $('#loading').hidden = !show;
  if (text) $('#loading-text').textContent = text;
  $('#loading-progress').textContent = percentage;
}
function notice(text) {
  clearTimeout(noticeTimer);
  $('#notice').textContent = text;
  $('#notice').classList.add('visible');
  noticeTimer = setTimeout(() => $('#notice').classList.remove('visible'), 2800);
}
function setMode(value) {
  mode = value;
  orbit.maxDistance = 64;
  document.body.dataset.mode = value;
  $('#intro').inert = value !== 'gallery';
  $('#case-labels').inert = value !== 'gallery';
  $('.mobile-picker').inert = value !== 'gallery';
  $('#gallery-paging').inert = value !== 'gallery';
  $('#mobile-pull').inert = value !== 'gallery';
  $('#exhibit-heading').hidden = value === 'gallery';
  $('#controls').hidden = value !== 'exhibit';
  $('#view-controls').hidden = value !== 'exhibit';
  $('#gesture-hint').textContent = value === 'gallery' ? (mobile() ? '左右滑动选车 · 轻点或向下拉出车盒' : '点击车盒，或按住向前拉出') : value === 'exhibit' ? (mobile() ? '单指旋转 · 双指缩放 · 轻点车门与舱盖' : '拖动旋转 · 滚轮缩放 · 点击车门与舱盖') : '车盒正在移动';
  renderer.domElement.style.cursor = value === 'exhibit' ? 'grab' : 'default';
  experience?.sync();
}
function box(w, h, d, material, parent, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function createCabinet() {
  cabinet = new THREE.Group(); scene.add(cabinet);
  const shelfMat = new THREE.MeshStandardMaterial({ color: '#171f1b', metalness: .58, roughness: .34 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#7d7865', metalness: .78, roughness: .35 });
  for (const [index, row] of galleryRows.entries()) {
    const width = (row.length - 1) * 4.2 + 4.45, y = galleryLayout[row[0]].y - .12, z = galleryLayout[row[0]].z;
    box(width, .10, 2.2, shelfMat, cabinet, 0, y, z).receiveShadow = true;
    box(width, .018, .025, trimMat, cabinet, 0, y + .015, z + 1.105);
  }
  const support = (Math.max(...galleryRows.map(row => row.length)) - 1) * 2.1 + .05;
  for (const x of [-support, support]) {
    box(.065, 4.72, .07, trimMat, cabinet, x, 2.23, -1.11);
  }
}
function createCase(id, x) {
  const home = new THREE.Group(); home.position.x = x; scene.add(home);
  const baseMat = new THREE.MeshStandardMaterial({ color: '#222622', roughness: .30, metalness: .74 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#68716d', roughness: .28, metalness: .9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#b4a58b', roughness: .29, metalness: .8 });
  box(3.58, .07, 2.04, baseMat, home, 0, -.01).receiveShadow = true;
  [-1.17, 1.17].forEach(rx => box(.055, .10, 1.85, railMat, home, rx, .075));
  const drawer = new THREE.Group(); home.add(drawer);
  const base = box(3.50, .22, 1.92, baseMat, drawer, 0, .16); base.castShadow = true; base.receiveShadow = true;
  box(3.48, .008, 1.90, accentMat, drawer, 0, .278);
  box(3.34, .016, 1.76, new THREE.MeshStandardMaterial({ color: '#292e2b', roughness: .74, metalness: .15 }), drawer, 0, .29).receiveShadow = true;
  const handle = box(.7, .033, .035, accentMat, drawer, 0, .175, .984);
  [-.28, .28].forEach(hx => box(.025, .025, .05, accentMat, drawer, hx, .175, .966));
  const carrier = new THREE.Group(); carrier.position.y = .31; carrier.scale.setScalar(.60); drawer.add(carrier);
  const cover = new THREE.Group(); cover.position.y = .31; drawer.add(cover);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#d2e4dc', transparent: true, opacity: .065, roughness: .13, metalness: .08, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
  const surfaces = [
    [3.32, 1.06, [0, .53, .87], [0, 0, 0]], [3.32, 1.06, [0, .53, -.87], [0, Math.PI, 0]],
    [1.74, 1.06, [-1.66, .53, 0], [0, Math.PI / 2, 0]], [1.74, 1.06, [1.66, .53, 0], [0, -Math.PI / 2, 0]],
    [3.32, 1.74, [0, 1.06, 0], [-Math.PI / 2, 0, 0]]
  ];
  for (const [w,h,p,r] of surfaces) { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h), glassMat); mesh.position.fromArray(p); mesh.rotation.set(...r); cover.add(mesh); }
  const edgeMat = new THREE.LineBasicMaterial({ color: '#d7e8de', transparent: true, opacity: .34, depthWrite: false });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.32, 1.06, 1.74)), edgeMat); edges.position.y = .53; cover.add(edges);
  // A thin highlight on the front upper edge makes the glass volume legible.
  box(3.32, .009, .009, new THREE.MeshBasicMaterial({ color: '#a1b5aa', transparent: true, opacity: .32 }), cover, 0, 1.06, .87);
  const hitbox = box(3.5, 1.35, 1.94, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), drawer, 0, .69);
  hitbox.userData.car = id;
  const entry = { id, x, y: 0, z: 0, home, drawer, carrier, cover, glassMat, edgeMat, handle, hitbox, preview: null, hover: 0, hoverMotion: null, color: catalog[id].colors[0][1] };
  cases.set(id, entry); return entry;
}
function configureModel(model, id) {
  const materials = new Set();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (materials.has(material)) continue;
      materials.add(material);
      material.envMapIntensity = .48;
      if (material.name === catalog[id].paint) {
        material.color.set(cases.get(id).color);
        material.roughness = .26; material.metalness = .38;
      }
      if (/glass/i.test(material.name)) { material.transparent = true; material.depthWrite = false; material.opacity = .35; material.roughness = .14; }
    }
  });
}
function disposeModel(model) {
  if (!model) return;
  const materials = new Set(), geometries = new Set(), textures = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
  });
  materials.forEach(m => { Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); }); m.dispose(); });
  textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); model.removeFromParent();
}
function galleryCamera() {
  if (mobile()) {
    const entry = cases.get(browseId), target = vec([entry.x, entry.y + .70, entry.z]);
    const bounds = new THREE.Box3(vec([entry.x - 1.79, entry.y - .05, entry.z - 1.02]), vec([entry.x + 1.79, entry.y + 1.40, entry.z + 1.02]));
    return fitCamera({ position: vec([-4.1, 2.48, 6.7]).add(target), target }, bounds, { padding: 1.14 });
  }
  const { width, height } = stageSize();
  const target = vec([0, 3.0, 0]), direction = vec([-.035, .30, 1]).normalize();
  const probe = new THREE.PerspectiveCamera(camera.fov, width / height, .05, 80);
  const points = vehicleIds.flatMap(id => {
    const home = galleryLayout[id];
    return [-1.79, 1.79].flatMap(x => [-.05, 1.37].flatMap(y => [-1.02, 1.02].map(z => vec([x + home.x, y + home.y, z + home.z]))));
  });
  // Fit the complete cabinet into the space between the introduction and shortcuts.
  // Using the projected case corners also handles wide and compact desktop windows.
  let distance = 14;
  const top = Math.min(200, height * .26), bottom = height - 245;
  const midpoint = (top + bottom) / 2, tanFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  for (let i = 0; i < 350; i++, distance += .1) {
    target.set(0, 3.0, 0);
    // Center the cabinet in its available viewport, leaving room below each shelf for data.
    for (let align = 0; align < 4; align++) {
      probe.position.copy(target).addScaledVector(direction, distance); probe.lookAt(target); probe.updateMatrixWorld(true);
      const ys = points.map(point => (-point.clone().project(probe).y * .5 + .5) * height);
      const shift = (midpoint - (Math.min(...ys) + Math.max(...ys)) / 2) * 2 * distance * tanFov / height;
      target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 1), shift);
    }
    probe.position.copy(target).addScaledVector(direction, distance); probe.lookAt(target); probe.updateMatrixWorld(true);
    if (points.every(point => {
      const p = point.clone().project(probe), x = (p.x * .5 + .5) * width, y = (-p.y * .5 + .5) * height;
      return x >= 45 && x <= width - 45 && y >= top && y <= bottom;
    })) break;
  }
  return { position: target.clone().addScaledVector(direction, distance), target };
}
function exhibitCamera(view = 'hero') {
  const center = new THREE.Vector3(0, .48, 1.80);
  const presets = {
    hero: { p: [-3.8, 2.4, 5.7], t: [0, .15, 0] },
    side: { p: [0, 1.25, 5.3], t: [0, .25, 0] },
    rear: { p: [3.8, 1.6, 3.5], t: [.3, .16, 0] },
    engine: { p: [2.8, 3.3, 2.4], t: [.7, .42, 0] },
    cabin: { p: [-1.4, 2.25, 2.9], t: [-.25, .38, 0] }
  };
  const spec = presets[view];
  const target = vec(spec.t).add(center), position = vec(spec.p).add(center);
  if (mobile() || !experience || experience.section === 'car') return fitCamera({ position, target }, exhibitBounds(), { padding: 1.18, force: true });
  target.x += .34; position.x += .34;
  return { position, target };
}
function moveCamera(preset, duration = 650) {
  cameraMove = { from: camera.position.clone(), fromTarget: orbit.target.clone(), to: preset.position, toTarget: preset.target, start: performance.now(), duration: reduced() ? 0 : duration };
  invalidate();
}
function applyCamera(preset) { camera.position.copy(preset.position); orbit.target.copy(preset.target); orbit.update(); }
function fillHeading(id) {
  const car = catalog[id];
  $('#car-brand').textContent = car.brand;
  $('#car-title').textContent = car.name;
  $('#car-description').textContent = car.subtitle;
  $('#car-facts').innerHTML = `<div><dt>引擎布局</dt><dd>${car.engine}</dd></div><div><dt>原车长度 / mm</dt><dd>${car.length}</dd></div><div><dt>车门形式</dt><dd>${car.opening}</dd></div>`;
  renderPerformance(id, $('#vehicle-performance'));
  $('#controls').scrollTop = 0;
  $('#paint-controls').replaceChildren(...car.colors.map(([name, color]) => {
    const button = document.createElement('button'); button.className = 'paint-swatch'; button.style.setProperty('--paint', color); button.style.backgroundColor = color;
    button.title = name; button.setAttribute('aria-label', name); button.setAttribute('aria-pressed', String(cases.get(id).color === color));
    button.onclick = () => changePaint(color); return button;
  }));
}
function syncPartUI() {
  if (!rig) return;
  const state = rig.getState();
  $$('#part-controls button').forEach(button => {
    const open = !!state.parts[button.dataset.part]?.target;
    button.setAttribute('aria-pressed', String(open)); button.querySelector('i').textContent = open ? '−' : '+';
  });
  $('#light-toggle').setAttribute('aria-pressed', String(state.lights));
  const allOpen = [...rig.parts].filter(([, p]) => !p.definition.labOnly).every(([id]) => state.parts[id].target === 1);
  $('#open-all').textContent = allOpen ? '全部合上 ↙' : '全部打开 ↗';
  syncCarFraming();
  syncMotionUI();
  invalidate();
}
function syncCarFraming() {
  if (!rig || mode !== 'exhibit' || experience?.section !== 'car' || orbitGesture) return;
  const key = [...rig.parts].filter(([, part]) => part.target > 0 || part.progress > 0).map(([id]) => id).join(',');
  if (key === carFramingKey) return;
  carFramingKey = key;
  // Preserve the chosen angle; slider movement inside the same envelope is inert.
  const preset = { position: cameraMove?.to || camera.position, target: cameraMove?.toTarget || orbit.target };
  moveCamera(fitCamera(preset, exhibitBounds(), { padding: 1.18, force: true }), 360);
}
function syncMotionUI() {
  const part = rig?.parts.get($('#motion-part').value); if (!part) return;
  $('#motion-progress').value = part.progress * 100;
  $('#motion-value').textContent = `${Math.round(part.progress * 100)}%`;
  $('#motion-progress').setAttribute('aria-valuetext', `${part.definition.label} ${Math.round(part.progress * 100)}%`);
}
function makePartUI(manifest) {
  const parts = manifest.parts.filter(part => !part.labOnly);
  $('#motion-details').open = false;
  $('#motion-part').replaceChildren(...parts.map(part => Object.assign(document.createElement('option'), { value: part.id, textContent: part.label })));
  $('#part-controls').replaceChildren(...parts.map(part => {
    const button = document.createElement('button'); button.dataset.part = part.id; button.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span'); label.textContent = partNames[part.id] || part.label || part.id;
    const mark = document.createElement('i'); mark.textContent = '+'; button.append(label, mark);
    button.onclick = () => { $('#motion-part').value = part.id; rig?.toggle(part.id); invalidate(); }; return button;
  }));
  syncPartUI();
}
function changePaint(color) {
  if (!selected) return;
  const entry = cases.get(selected); entry.color = color;
  for (const model of [entry.preview, fullModel]) model?.traverse(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material.name === catalog[selected].paint) material.color.set(color);
  });
  $$('#paint-controls button').forEach((b, index) => b.setAttribute('aria-pressed', String(catalog[selected].colors[index][1] === color)));
  invalidate();
}
async function loadDetailed(id) {
  const epoch = ++loadEpoch;
  loading(true, `正在唤醒 ${catalog[id].name}`);
  $('#scene-error').hidden = true;
  let loadedModel;
  try {
    const response = await fetch(`./assets/cars/${id}/interaction.json`);
    if (!response.ok) throw new Error(`互动数据 ${response.status}`);
    const manifest = await response.json();
    if (epoch !== loadEpoch) return;
    const gltf = await loader.loadAsync(`./assets/cars/${id}/model.glb`, e => {
      if (epoch === loadEpoch && e.total) loading(true, `正在唤醒 ${catalog[id].name}`, `${Math.round(e.loaded / e.total * 100)}%`);
    });
    loadedModel = gltf.scene;
    if (epoch !== loadEpoch || selected !== id || mode === 'closing') { disposeModel(loadedModel); return; }
    configureModel(loadedModel, id);
    const entry = cases.get(id); entry.carrier.add(loadedModel);
    const candidateRig = new CarRig(loadedModel, manifest, { reducedMotion: reduced(), onChange: syncPartUI });
    fullModel = loadedModel; rig = candidateRig; carFramingKey = '';
    if (entry.preview) entry.preview.visible = false;
    if (mobile() && transition?.to === 1) transition.toCam = exhibitCamera();
    makePartUI(manifest); loading(false); finishOpening(); invalidate();
  } catch (error) {
    if (loadedModel && loadedModel !== fullModel) disposeModel(loadedModel);
    if (epoch !== loadEpoch) return;
    ++loadEpoch;
    console.error('Detailed model load failed', error);
    loading(false); $('#scene-error').hidden = false;
    $('#error-text').textContent = '请检查网络后重试，也可以先放回车盒。';
  }
}
function finishOpening() {
  if (mode === 'opening' && progress === 1 && rig) {
    setMode('exhibit'); orbit.enabled = true;
    if (mobile()) moveCamera(exhibitCamera(currentView), 280);
    $('#return-button').focus({ preventScroll: true });
    notice(catalog[selected].hint || (selected === 'svj' ? '试着打开剪刀门，或点击舱盖' : '试着点击车门，打开这份收藏'));
  }
}
async function openCar(id) {
  if (mode !== 'gallery' || !cases.has(id)) return;
  if (!visibleIds().includes(id) || !cases.get(id).preview) {
    if (!await browseCar(id) || mode !== 'gallery' || browseId !== id) return;
  }
  if (!ready) return;
  // Continue from the hand-dragged position on the same path as automatic motion.
  const slide = clamp(cases.get(id).drawer.position.z / 1.80);
  let low = 0, high = 1;
  for (let i = 0; i < 18; i++) { const middle = (low + high) / 2; if (smooth(middle) < slide) low = middle; else high = middle; }
  progress = .58 * (low + high) / 2;
  selected = id; browseId = id; currentView = 'hero'; fillHeading(id); setMode('opening'); orbit.enabled = false;
  hovered = null; pointer = null; $('#pull-cue').hidden = true;
  $$('#view-controls button').forEach(b => { b.classList.toggle('selected', b.dataset.view === 'hero'); b.setAttribute('aria-pressed', String(b.dataset.view === 'hero')); });
  transition = { from: progress, to: 1, start: performance.now(), duration: reduced() ? 0 : 1550, fromCam: camera.position.clone(), fromTarget: orbit.target.clone(), toCam: exhibitCamera() };
  cameraMove = null; loadDetailed(id); invalidate();
}
function returnCar() {
  if (!selected || mode === 'closing') return;
  experience?.reset();
  ++loadEpoch; loading(false); $('#scene-error').hidden = true; $('#notice').classList.remove('visible');
  rig?.reset({ instant: true }); rig?.update(); orbit.enabled = false;
  setMode('closing'); cameraMove = null;
  transition = { from: progress, to: 0, start: performance.now(), duration: reduced() ? 0 : Math.max(500, progress * 1300), fromCam: camera.position.clone(), fromTarget: orbit.target.clone(), toCam: galleryCamera() };
  invalidate();
}
function finishClosing() {
  const old = selected;
  rig?.dispose(); rig = null; disposeModel(fullModel); fullModel = null;
  if (cases.get(old).preview) cases.get(old).preview.visible = true;
  selected = null; progress = 0; setMode('gallery');
  for (const entry of cases.values()) { entry.drawer.position.set(0, 0, 0); entry.hoverMotion = null; entry.home.visible = visibleIds().includes(entry.id); }
  syncGalleryUI();
  $$('[data-browse]').forEach(b => { b.classList.toggle('selected', b.dataset.browse === browseId); b.setAttribute('aria-pressed', String(b.dataset.browse === browseId)); });
  const button = mobile() ? $('#mobile-pull') : $(`[data-car="${old}"]`); button.focus({ preventScroll: true });
  if ([...cases].some(([id, entry]) => Boolean(entry.preview) !== visibleIds().includes(id))) loadPreviews();
}
function updateCaseState() {
  cabinet.visible = !mobile() && (!selected || progress < .32) && !experience?.stageVisible;
  for (const entry of cases.values()) {
    for (const child of entry.home.children) if (child !== entry.drawer) child.visible = !selected || progress < .36;
    if (entry.id === selected) {
      const slide = smooth(progress / .58), center = smooth((progress - .44) / .56), lift = smooth((progress - .50) / .50);
      entry.drawer.position.set(-entry.x * center, (.05 - entry.y) * center, 1.80 * slide - entry.z * center);
      entry.cover.position.y = .31 + 2.0 * lift;
      const alpha = 1 - smooth((progress - .65) / .32);
      entry.cover.visible = alpha > .001;
      entry.glassMat.opacity = .065 * alpha; entry.edgeMat.opacity = .34 * alpha;
      entry.home.visible = true;
    } else {
      entry.home.visible = visibleIds().includes(entry.id) && (!selected || progress < .32);
      entry.cover.position.y = .31; entry.cover.visible = true;
      const located = entry.id === browseId ? .12 : 0;
      entry.glassMat.opacity = .065 + entry.hover * .025; entry.edgeMat.opacity = .34 + located + entry.hover * .30;
    }
    if (experience?.stageVisible) entry.home.visible = false;
  }
}
function updateLabels() {
  if (mode !== 'gallery' || mobile()) return;
  for (const [id, entry] of cases) {
    if (!visibleIds().includes(id)) continue;
    // A label belongs to the cabinet slot, so hovering or pulling the drawer
    // cannot move its click target out from underneath the pointer.
    const position = projectPoint(entry.home.localToWorld(new THREE.Vector3(0, -.25, 1.30)));
    const label = $(`[data-car="${id}"]`);
    label.style.left = `${position.x}px`;
    label.style.top = `${position.y}px`;
  }
}
function updateCaseHover(entry, now) {
  const target = hovered === entry.id ? 1 : 0, targetZ = target * .08;
  const dragging = pointer?.id === entry.id;
  if (entry.hover === target && (dragging || entry.drawer.position.z === targetZ)) {
    entry.hoverMotion = null;
    return false;
  }
  let motion = entry.hoverMotion;
  if (!motion || motion.target !== target || motion.dragging !== dragging) {
    motion = entry.hoverMotion = { target, dragging, start: now, fromHover: entry.hover, fromZ: entry.drawer.position.z };
  }
  // Wall-clock duration bounds hover and cancelled-drag return even at low frame rates.
  // Pointer dragging owns its position until release; only the glass highlight can animate.
  const t = reduced() ? 1 : clamp((now - motion.start) / 200), e = smooth(t);
  entry.hover = t === 1 ? target : THREE.MathUtils.lerp(motion.fromHover, target, e);
  if (!dragging) entry.drawer.position.z = t === 1 ? targetZ : THREE.MathUtils.lerp(motion.fromZ, targetZ, e);
  dirty = true;
  if (t === 1) entry.hoverMotion = null;
  return t < 1;
}
function frame(now) {
  framePending = false;
  let active = false;
  if (transition) {
    const t = transition.duration ? clamp((now - transition.start) / transition.duration) : 1;
    const e = smooth(t);
    progress = THREE.MathUtils.lerp(transition.from, transition.to, e);
    camera.position.lerpVectors(transition.fromCam, transition.toCam.position, e);
    orbit.target.lerpVectors(transition.fromTarget, transition.toCam.target, e);
    dirty = true; active = t < 1;
    if (t === 1) { const closed = transition.to === 0; transition = null; if (closed) finishClosing(); else finishOpening(); }
  } else if (cameraMove) {
    const t = cameraMove.duration ? clamp((now - cameraMove.start) / cameraMove.duration) : 1;
    camera.position.lerpVectors(cameraMove.from, cameraMove.to, smooth(t)); orbit.target.lerpVectors(cameraMove.fromTarget, cameraMove.toTarget, smooth(t));
    dirty = true; active = t < 1; if (t === 1) cameraMove = null;
  }
  if (mode === 'gallery') {
    for (const entry of cases.values()) if (updateCaseHover(entry, now)) active = true;
  }
  if (rig?.update(now)) { dirty = true; if ($('#motion-details').open) syncMotionUI(); }
  syncCarFraming();
  if (rig?.isAnimating) active = true;
  if (experience?.update(now)) dirty = true;
  if (experience?.isAnimating) active = true;
  if (orbit.update()) dirty = true;
  if (dirty) { camera.updateMatrixWorld(); updateCaseState(); updateLabels(); experience?.projectLabels(); renderer.render(scene, camera); renderFrames++; dirty = false; }
  if (active && !framePending) { framePending = true; requestAnimationFrame(frame); }
}
function pickCase(event) {
  setRay(event);
  return raycaster.intersectObjects([...cases.values()].filter(c => c.home.visible).map(c => c.hitbox), false)[0]?.object.userData.car || null;
}
function setRay(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointerNDC, camera);
}
function initPointers() {
  const canvas = renderer.domElement;
  const activePointers = new Set();
  let multiple = false, suppressTapUntil = 0;
  const clearPointer = () => { pointer = null; $('#pull-cue').hidden = true; invalidate(); };
  const releasePointer = event => {
    activePointers.delete(event.pointerId);
    if (!activePointers.size && multiple) { multiple = false; suppressTapUntil = performance.now() + 450; }
  };
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { multiple = true; clearPointer(); return; }
    if (multiple || performance.now() < suppressTapUntil) return;
    if (pointer) { clearPointer(); return; }
    cameraMove = null;
    if (mode === 'gallery') {
      const id = pickCase(event); if (!id && !mobile()) return;
      pointer = { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, distance: 0, axis: null };
      canvas.setPointerCapture(event.pointerId);
    } else if (mode === 'exhibit') pointer = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, distance: 0 };
  });
  canvas.addEventListener('pointermove', event => {
    if (multiple || activePointers.size > 1) return;
    if (pointer && pointer.pointerId === event.pointerId) {
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer.distance = Math.max(pointer.distance, Math.hypot(dx, dy));
      if (!pointer.axis && pointer.distance >= 10) pointer.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (mode === 'gallery' && pointer.id && pointer.axis === 'y') {
        const amount = clamp(dy / 130);
        cases.get(pointer.id).drawer.position.z = amount * .75;
        $('#pull-cue').hidden = pointer.distance < 6;
        $('#pull-cue span').style.transform = `scaleX(${amount})`;
        invalidate();
      }
    } else if (mode === 'gallery' && ready && event.pointerType !== 'touch') {
      const id = pickCase(event);
      if (id !== hovered) { hovered = id; canvas.style.cursor = id ? 'grab' : 'default'; invalidate(); }
    }
  });
  canvas.addEventListener('pointerup', event => {
    const blocked = multiple || activePointers.size > 1 || performance.now() < suppressTapUntil;
    releasePointer(event);
    if (blocked) { clearPointer(); return; }
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const start = pointer; pointer = null; $('#pull-cue').hidden = true;
    start.distance = Math.max(start.distance, Math.hypot(event.clientX - start.x, event.clientY - start.y));
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (mode === 'gallery') {
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (mobile() && start.axis !== 'y' && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.35) turnPage(dx < 0 ? 1 : -1);
      else if (start.id && (start.distance < 7 || (start.axis === 'y' && dy > 55))) openCar(start.id);
      invalidate();
    } else if (mode === 'exhibit' && start.distance < 6 && rig) {
      setRay(event);
      if (experience?.section === 'engine') experience.pick(raycaster);
      else if (experience?.section === 'lab') experience.pick(raycaster);
      else if (experience?.section === 'car') { const part = rig.pick(raycaster); if (part && !rig.parts.get(part).definition.labOnly) { $('#motion-part').value = part; rig.toggle(part); invalidate(); } }
    }
  });
  canvas.addEventListener('pointercancel', event => { releasePointer(event); suppressTapUntil = performance.now() + 450; clearPointer(); });
  canvas.addEventListener('lostpointercapture', event => { if (pointer?.pointerId === event.pointerId) clearPointer(); releasePointer(event); });
  canvas.addEventListener('click', event => { if (multiple || performance.now() < suppressTapUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  window.addEventListener('blur', () => { activePointers.clear(); multiple = false; suppressTapUntil = performance.now() + 450; clearPointer(); });
  canvas.addEventListener('pointerleave', () => { hovered = null; invalidate(); });
}
function bindUI() {
  $$('.case-label').forEach(button => {
    button.onclick = () => openCar(button.dataset.car);
    button.onpointerenter = () => { hovered = button.dataset.car; invalidate(); };
    button.onpointerleave = () => { hovered = null; invalidate(); };
    button.onfocus = button.onpointerenter; button.onblur = button.onpointerleave;
  });
  $$('[data-browse]').forEach(button => button.onclick = () => browseCar(button.dataset.browse));
  $('#page-prev').onclick = () => turnPage(-1);
  $('#page-next').onclick = () => turnPage(1);
  $('#mobile-pull').onclick = () => openCar(browseId);
  $('#return-button').onclick = returnCar;
  $('#brand-home').onclick = event => { event.preventDefault(); returnCar(); };
  $('#reset-car').onclick = () => { rig?.reset(); setView('hero'); invalidate(); };
  $('#light-toggle').onclick = () => { if (rig) rig.setLights(!rig.lights); };
  $('#open-all').onclick = () => { if (rig) { const parts = [...rig.parts].filter(([, p]) => !p.definition.labOnly); const open = !parts.every(([, p]) => p.target === 1); for (const [id] of parts) rig.set(id, open); } };
  $('#motion-part').onchange = syncMotionUI;
  $('#motion-details').ontoggle = syncMotionUI;
  $('#motion-pause').onclick = () => rig?.pause($('#motion-part').value);
  $('#motion-progress').oninput = e => rig?.setProgress($('#motion-part').value, Number(e.target.value) / 100);
  $$('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
  $('#about-button').onclick = () => $('#about-dialog').showModal();
  $('#close-about').onclick = () => $('#about-dialog').close();
  $('#about-dialog').addEventListener('click', event => { if (event.target === $('#about-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
  document.addEventListener('keydown', event => {
    if ($('#about-dialog').open) return;
    if (event.key === 'Escape' && selected) returnCar();
    if (mode === 'gallery' && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); turnPage(event.key === 'ArrowRight' ? 1 : -1); }
      else if (event.key === 'Enter' && event.target === document.body) { event.preventDefault(); openCar(browseId); }
    }
  });
  $('#retry-button').onclick = () => selected ? loadDetailed(selected) : loadPreviews();
  motionPreference.addEventListener('change', () => { if (rig) rig.reducedMotion = reduced(); if (reduced()) { if (transition) transition.duration = 0; if (cameraMove) cameraMove.duration = 0; } invalidate(); });
}
function setView(view) {
  if (mode !== 'exhibit' || experience?.section !== 'car') return;
  currentView = view;
  if (view === 'engine') { const part = [...rig.parts].find(([id, part]) => !part.definition.labOnly && /^(?:engine_lid|engine_cover|rear_clamshell)$/.test(id)); if (part) rig.set(part[0], true); }
  if (view === 'cabin') rig.set('driver_door', true);
  $$('[data-view]').forEach(b => { b.classList.toggle('selected', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
  moveCamera(exhibitCamera(view));
}
async function loadPreviews() {
  const epoch = ++previewEpoch, ids = visibleIds();
  ready = false; loading(true, '正在陈列车盒'); $('#scene-error').hidden = true;
  syncGalleryUI();
  $('#retry-button').disabled = true;
  for (const [id, entry] of cases) if (!ids.includes(id) && id !== selected && entry.preview) { disposeModel(entry.preview); entry.preview = null; }
  try {
    const results = await Promise.allSettled(ids.map(async id => {
      const entry = cases.get(id);
      if (entry.preview) return;
      const gltf = await loader.loadAsync(`./assets/cars/${id}/preview.glb`);
      if (epoch !== previewEpoch || !visibleIds().includes(id)) { disposeModel(gltf.scene); return; }
      configureModel(gltf.scene, id); entry.preview = gltf.scene; entry.carrier.add(gltf.scene); invalidate();
    }));
    if (epoch !== previewEpoch) return false;
    const failure = results.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    ready = true; loading(false); document.body.classList.add('ready'); syncGalleryUI(); invalidate(); return true;
  } catch (error) {
    if (epoch !== previewEpoch) return false;
    console.error('Gallery load failed', error); loading(false);
    $('#scene-error').hidden = false; $('#error-text').textContent = '模型文件没有完整载入，请检查网络后重试。';
    return false;
  } finally { if (epoch === previewEpoch) $('#retry-button').disabled = false; }
}
function resizeScene() {
  const { width, height } = stageSize(), compact = mobile(), layoutChanged = layoutMobile !== compact;
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(width, height, false);
  orbit.enablePan = !compact;
  if (layoutChanged) {
    layoutMobile = compact; lastScrolledBrowse = null; layoutCases(); updateCaseState(); syncGalleryUI();
    if (mode === 'gallery') loadPreviews();
    else {
      // The selected preview is needed when the detailed vehicle returns to its box.
      for (const [id, entry] of cases) if (compact && id !== selected && entry.preview) { disposeModel(entry.preview); entry.preview = null; }
    }
    const shadowSize = compact ? 1024 : 2048;
    if (keyLight.shadow.mapSize.x !== shadowSize) { keyLight.shadow.mapSize.set(shadowSize, shadowSize); keyLight.shadow.map?.dispose(); keyLight.shadow.map = null; }
  }
  if (transition) {
    const now = performance.now(), remaining = Math.max(0, transition.duration - (now - transition.start));
    transition = { ...transition, from: progress, start: now, duration: remaining, fromCam: camera.position.clone(), fromTarget: orbit.target.clone(), toCam: transition.to === 0 ? galleryCamera() : exhibitCamera(currentView) };
  } else if (mode === 'gallery') { cameraMove = null; applyCamera(galleryCamera()); }
  else if (mode === 'exhibit') {
    if (experience.section === 'car') {
      const oldMove = cameraMove;
      const preset = compact && !layoutChanged ? fitCamera({ position: oldMove?.to || camera.position, target: oldMove?.toTarget || orbit.target }, exhibitBounds(), { padding: 1.18 }) : exhibitCamera(currentView);
      if (oldMove) moveCamera(preset, Math.max(0, oldMove.duration - (performance.now() - oldMove.start)));
      else applyCamera(preset);
    } else { cameraMove = null; experience.resize(); }
  }
  invalidate();
}
function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resizeScene(); });
}
function init() {
  initMobileUI();
  const { width, height } = stageSize();
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '拖动车模可旋转，交互也可通过按钮操作');
  $('#stage').append(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#111613'); scene.fog = new THREE.FogExp2('#111613', .024);
  const pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; pmrem.dispose(); room.dispose();
  camera = new THREE.PerspectiveCamera(37, width / height, .05, 80);
  orbit = new OrbitControls(camera, renderer.domElement); orbit.enabled = false; orbit.enableDamping = false; orbit.enablePan = !mobile();
  orbit.touches.ONE = THREE.TOUCH.ROTATE; orbit.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  orbit.minDistance = 1.35; orbit.maxDistance = 64; orbit.maxPolarAngle = Math.PI / 2 - .025;
  orbit.addEventListener('change', invalidate);
  orbit.addEventListener('start', () => { orbitGesture = true; cameraMove = null; });
  orbit.addEventListener('end', () => { orbitGesture = false; invalidate(); });
  scene.add(new THREE.HemisphereLight('#ede9d9', '#15251c', .68));
  const key = keyLight = new THREE.DirectionalLight('#fff0df', 2.0); key.position.set(-3, 7, 5); key.castShadow = true;
  const shadowSize = mobile() ? 1024 : 2048;
  key.shadow.mapSize.set(shadowSize, shadowSize); key.shadow.camera.left = -11; key.shadow.camera.right = 11; key.shadow.camera.top = 9; key.shadow.camera.bottom = -8; key.shadow.normalBias = .035; key.shadow.bias = -.0001; scene.add(key);
  const rim = new THREE.DirectionalLight('#d4e7ff', 1.5); rim.position.set(5, 5, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight('#e3efd4', .6); fill.position.set(-6, 2, -1); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#111812', roughness: 1, metalness: 0, envMapIntensity: .04 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.09; floor.receiveShadow = true; scene.add(floor);
  createCabinet(); vehicleIds.forEach(id => createCase(id, 0)); layoutCases(); buildGalleryUI(); syncGalleryUI();
  experience = new VehicleExperience({ scene, camera, orbit, getMode: () => mode, getSelected: () => selected, getRig: () => rig, mobile, reduced, invalidate, moveCamera, applyCamera, exhibitCamera, fitCamera, viewport, disposeModel });
  applyCamera(galleryCamera()); bindUI(); initPointers();
  new ResizeObserver(scheduleResize).observe($('#stage'));
  addEventListener('resize', scheduleResize);
  addEventListener('orientationchange', scheduleResize);
  window.visualViewport?.addEventListener('resize', scheduleResize);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); loading(false); $('#scene-error').hidden = false; $('#error-text').textContent = '图形环境暂时中断，请重新载入页面。'; $('#retry-button').onclick = () => location.reload(); });
  window.galleryApp = {
    open: openCar, close: returnCar, browse: browseCar, page: turnPage, view: setView, experience: section => experience.show(section),
    getState: () => ({ mode, selected, browseId, page: 0, pageIds: visibleIds(), galleryLayout: mobile() ? 'single' : 'all', vehicleCount: vehicleIds.length, ready, progress, reducedMotion: reduced(), rig: rig?.getState() || null, experience: experience.getState(), camera: { position: camera.position.toArray(), target: orbit.target.toArray() }, renderer: { frames: renderFrames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), width: renderer.domElement.width, height: renderer.domElement.height, viewport: { left: viewport().left, top: viewport().top, width: viewport().width, height: viewport().height } }, cases: [...cases.values()].map(c => ({ id: c.id, position: c.drawer.position.toArray(), home: c.home.position.toArray(), world: c.drawer.getWorldPosition(new THREE.Vector3()).toArray(), row: galleryLayout[c.id].row, visible: c.home.visible, preview: c.preview?.visible ?? false, color: c.color, modelCount: c.carrier.children.length, visibleModelCount: c.carrier.children.filter(m => m.visible).length })) }),
    projectCase: id => projectPoint(cases.get(id).drawer.localToWorld(new THREE.Vector3(0, .6, .2))),
    projectCaseBounds: id => {
      const c = cases.get(id), points = [-1.79, 1.79].flatMap(x => [-.05, 1.37].flatMap(y => [-1.02, 1.02].map(z => projectPoint(c.drawer.localToWorld(new THREE.Vector3(x, y, z))))));
      return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
    },
    projectPart: id => { const part = rig?.parts.get(id); const mesh = part?.definition.meshes?.[0] || part?.tracks?.[0]?.definition.meshes?.[0]; if (!mesh) return null; return projectPoint(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())); }
  };
  invalidate(); loadPreviews();
}
try { init(); } catch (error) {
  console.error('Unable to start gallery', error); loading(false); $('#scene-error').hidden = false;
  $('#error-text').textContent = '当前浏览器无法启动三维展示，请开启硬件加速，或换用支持 WebGL 的浏览器。'; $('#retry-button').onclick = () => location.reload();
}

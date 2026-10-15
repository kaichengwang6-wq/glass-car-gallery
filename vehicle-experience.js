import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
import { vehicleProfiles } from './vehicle-content.js';

export class VehicleExperience {
  constructor(host) {
    this.host = host; this.section = 'car'; this.engineMode = 'exterior'; this.chapter = 0;
    this.hotspot = 'intake'; this.epoch = 0; this.modeEpoch = 0; this.loading = false; this.error = null;
    this.stage = null; this.exterior = null; this.engine = null; this.manifest = null; this.snapshot = null;
    this.assembly = null; this.AssemblyClass = null; this.lab = null; this.labModules = new Map(); this.labEpoch = 0; this.labLoading = false; this.labError = false;
    this.meshCategories = new Map(); this.materialBases = new Map(); this.loader = new GLTFLoader();
    this.classes = new Map(); this.profile = vehicleProfiles.f430; this.configure('f430'); this.bind(); this.sync();
  }
  get stageVisible() { return (this.section === 'engine' && !!this.stage) || (this.section === 'lab' && !!this.lab && !this.vehicleLab); }
  get vehicleLab() { return (this.labProfile?.presentation || this.profile.labPresentation) === 'vehicle'; }
  get capabilities() { return this.profile.capabilities || ['car', 'history', 'engine', 'lab']; }
  get isAnimating() { return this.section === 'lab' ? !!this.lab?.isAnimating : this.section === 'engine' && (this.engineMode === 'assembly' ? !!this.assembly?.isAnimating : this.engineMode === 'internal' && !!this.engine?.isAnimating); }
  bind() {
    $$('#experience-nav [data-section]').forEach(b => b.onclick = () => this.show(b.dataset.section));
    $$('.engine-mode-tabs [data-engine-mode]').forEach(b => b.onclick = () => this.setEngineMode(b.dataset.engineMode));
    $('#engine-home-view').onclick = () => this.host.moveCamera(this.engineCamera());
    $('#engine-retry').onclick = () => this.stage ? this.setEngineMode(this.engineMode, true) : this.loadExterior();
    $('#engine-play').onclick = () => { if (!this.engine) return; this.engine.setPlaying(!this.engine.getState().playing); this.syncEngine(); this.host.invalidate(); };
    $('#engine-speed').onchange = e => { this.engine?.setSpeed(e.target.value); this.host.invalidate(); };
    $('#engine-angle').oninput = e => { if (!this.engine) return; this.engine.setPlaying(false); this.engine.setAngle(Number(e.target.value)); this.syncEngine(); this.host.invalidate(); };
    $$('#aero-controls button').forEach(b => b.onclick = () => this.setAero(b.dataset.aero));
    $('#assembly-remove').onclick = () => this.assemblyAction('remove');
    $('#assembly-install').onclick = () => this.assemblyAction('install');
    $('#assembly-reset').onclick = () => { this.assembly?.reset(); this.assemblyDirection = 'remove'; this.syncAssembly(); this.host.invalidate(); };
    $('#assembly-spread').oninput = e => { this.assembly?.setSpread(Number(e.target.value) / 100); this.syncAssembly(); this.host.invalidate(); };
    $('#assembly-test').onclick = async () => {
      if (!this.assembly?.getState().canRun) return;
      await this.setEngineMode('internal');
      if (this.section === 'engine' && this.engineMode === 'internal' && this.engine) { this.engine.setPlaying(true); this.syncEngine(); this.host.invalidate(); }
    };
    $('#lab-home-view').onclick = () => this.host.moveCamera(this.labCamera());
    $('#lab-retry').onclick = () => this.loadLab(true);
    $('#lab-play').onclick = () => { if (this.lab) this.lab.setPlaying(!this.lab.getState().playing); this.syncLab(); this.host.invalidate(); };
    $('#lab-reset').onclick = () => { this.lab?.reset(); this.syncLab(); this.host.invalidate(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.engine?.setPlaying(false); this.lab?.setPlaying(false); this.syncEngine(); this.syncLab(); } });
  }
  configure(id) {
    if (!vehicleProfiles[id]) return;
    this.profile = vehicleProfiles[id]; this.chapter = 0; this.hotspot = 'intake'; this.aeroMode = 'drag';
    if (!this.capabilities.includes(this.section)) this.section = 'car';
    document.body.dataset.vehicle = id;
    $('#experience-nav').style.setProperty('--topic-count', this.capabilities.length);
    $$('#experience-nav [data-section]').forEach(button => {
      button.hidden = !this.capabilities.includes(button.dataset.section);
      if (button.dataset.section === 'lab') button.textContent = this.profile.labTitle ? '专属玩法' : '专属实验';
    });
    $('#experience-nav').setAttribute('aria-label', `${this.profile.name} 探索方式`);
    $('#story-panel').setAttribute('aria-label', `${this.profile.name} 车型故事`);
    $('#story-panel > .eyebrow').textContent = this.profile.eyebrow || '';
    $('#engine-panel').setAttribute('aria-label', `${this.profile.name} 发动机专题`);
    $('#lab-panel').setAttribute('aria-label', `${this.profile.name} 专属实验`);
    $('.engine-mode-tabs [data-engine-mode="internal"]').textContent = this.profile.engineName ? `${this.profile.engineName} 工作原理` : '工作原理';
    $('.engine-specs').textContent = this.profile.specs || '';
    $('#engine-caption .eyebrow').textContent = this.profile.engineName ? `ENGINE STUDY / ${this.profile.engineName}` : '';
    $('.engine-learning').open = false;
    $('.engine-learning').replaceChildren(Object.assign(document.createElement('summary'), { textContent: this.profile.engineName ? `读懂这台 ${this.profile.engineName}` : '' }), ...(this.profile.learning || []).map(copy => Object.assign(document.createElement('p'), { textContent: copy })));
    this.sourceLinks($('.engine-sources'), this.profile.engineSources);
    $('#engine-speed').value = 'normal';
    $('#story-tabs').replaceChildren(...(this.profile.chapters || []).map((c, i) => {
      const b = document.createElement('button'); b.dataset.chapter = i; b.innerHTML = `<span>0${i + 1}</span><span>${c.label}</span>`;
      b.onclick = () => this.setChapter(i); return b;
    }));
    $('#story-next').onclick = () => { if (this.profile.chapters?.length) this.setChapter((this.chapter + 1) % this.profile.chapters.length); };
    for (const selector of ['#engine-hotspot-list', '#engine-labels']) {
      $(selector).replaceChildren(...(this.profile.hotspots || []).map((h, i) => {
        const b = document.createElement('button'); b.dataset.hotspot = h.id; b.innerHTML = `<b>0${i + 1}</b><span>${h.label}</span>`;
        b.setAttribute('aria-label', `0${i + 1} · ${h.label}`);
        b.onclick = () => this.selectHotspot(h.id); return b;
      }));
    }
    this.buildCylinderButtons();
    $('#story-aero').hidden = true;
  }
  buildCylinderButtons() {
    const engineState = this.engine?.getState();
    const groups = engineState?.cylinderGroups || this.profile.cylinderGroups || ['L', 'R'].map(bank => ({
      id: bank, cylinders: Array.from({ length: (this.profile.cylinderCount || 0) / 2 }, (_, i) => `${bank}${i + 1}`)
    }));
    const rows = groups.map(group => {
      const row = document.createElement('div'); row.className = 'cylinder-bank';
      row.setAttribute('role', 'group'); row.setAttribute('aria-label', group.label || `${group.id} 列气缸`);
      const label = document.createElement('span'); label.className = 'cylinder-bank-label'; label.textContent = `${group.id} 列`; label.title = group.label || label.textContent;
      const buttons = (group.cylinders || []).map(cylinder => {
        const id = typeof cylinder === 'string' ? cylinder : cylinder.id;
        const b = document.createElement('button'); b.dataset.cylinder = id; b.dataset.bank = group.id || group.label || '';
        b.append(document.createElement('i'), document.createTextNode(id));
        b.onclick = () => { this.engine?.selectCylinder(id); this.syncEngine(); this.host.invalidate(); }; return b;
      });
      row.append(label, ...buttons); return row;
    });
    $('#cylinder-buttons').replaceChildren(...rows);
    $('#cylinder-buttons').style.setProperty('--cylinder-columns', Math.max(1, ...groups.map(group => group.cylinders?.length || 0)));
    $('.cylinder-heading span:last-child').textContent = groups.length > 2 ? `${groups.map(group => group.id).join(' / ')} 四列` : '左列 / 右列';
  }
  sourceLinks(element, sources) {
    element.replaceChildren(...(sources || []).map(([text, href]) => Object.assign(document.createElement('a'), { textContent: `${text} ↗`, href, target: '_blank', rel: 'noopener' })));
  }
  setAero(mode) {
    const detail = this.profile.aeroModes?.[mode]; if (!detail) return;
    this.aeroMode = mode; $('#story-aero').dataset.aeroMode = mode;
    $$('#aero-controls button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.aero === mode)));
    $('#aero-title').textContent = detail.title; $('#aero-copy').textContent = detail.copy;
    $('#aero-diagram').setAttribute('aria-label', `${detail.title}。${detail.copy}`);
    $('#aero-state').textContent = mode === 'drag' ? '气路打开 · 减少下压力' : mode === 'downforce' ? '气路关闭 · 提高下压力' : '左右气路独立调节';
    this.host.invalidate();
  }
  sync() {
    const selected = this.host.getSelected();
    if (vehicleProfiles[selected] && this.profile.id !== selected) this.configure(selected);
    const available = this.host.getMode() === 'exhibit' && !!vehicleProfiles[selected];
    document.body.dataset.section = available ? this.section : 'car';
    document.body.dataset.engineMode = this.engineMode;
    document.body.dataset.labPresentation = this.vehicleLab ? 'vehicle' : 'stage';
    $('#experience-nav').hidden = !available;
    $('#story-panel').hidden = !available || this.section !== 'history';
    $('#engine-panel').hidden = !available || this.section !== 'engine';
    $('#lab-panel').hidden = !available || this.section !== 'lab';
    $('#lab-caption').hidden = !available || this.section !== 'lab' || !this.lab;
    $('#engine-labels').hidden = !available || this.section !== 'engine' || !this.stage || this.engineMode !== 'exterior';
    $('#engine-caption').hidden = !available || this.section !== 'engine' || !this.stage;
    $('#controls').hidden = this.host.getMode() !== 'exhibit' || this.section !== 'car';
    $('#view-controls').hidden = this.host.getMode() !== 'exhibit' || this.section !== 'car';
    $$('#experience-nav button').forEach(b => { b.hidden = !this.capabilities.includes(b.dataset.section); b.setAttribute('aria-pressed', String(b.dataset.section === this.section)); });
    $$('.engine-mode-tabs [data-engine-mode]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.engineMode === this.engineMode)); b.disabled = !this.stage; });
    $('#engine-exterior-info').hidden = this.engineMode !== 'exterior' || !this.stage;
    $('#engine-internal-info').hidden = this.engineMode !== 'internal' || !this.engine || this.loading || !!this.error;
    $('#engine-assembly-info').hidden = this.engineMode !== 'assembly' || !this.assembly || this.loading || !!this.error;
    $('#lab-topic-loading').hidden = !this.labLoading;
    $('#lab-topic-error').hidden = !this.labError;
    $('#lab-ready').hidden = !this.lab || this.labLoading || this.labError;
    $('#lab-home-view').disabled = !this.lab;
    $('#engine-topic-loading').hidden = !this.loading;
    $('#engine-topic-error').hidden = !this.error;
    $('#engine-home-view').disabled = !this.stage;
    if (available && this.section !== 'car') $('#gesture-hint').textContent = this.section === 'history' ? '选择章节，跟随视角探索' : this.section === 'lab' ? '拖动旋转 · 调节参数，观察变化' : '拖动旋转 · 滚轮缩放 · 点选部件';
    else if (this.host.getMode() === 'exhibit') $('#gesture-hint').textContent = '拖动旋转 · 滚轮缩放 · 点击车门与舱盖';
    this.host.invalidate();
  }
  capture() {
    if (this.snapshot) return;
    this.snapshot = { position: this.host.camera.position.clone(), target: this.host.orbit.target.clone(), parts: this.host.getRig().getState().parts, width: innerWidth, height: innerHeight };
  }
  restoreParts() {
    const rig = this.host.getRig(); if (!this.snapshot || !rig) return;
    if (rig.restoreState) { rig.restoreState(this.snapshot.parts); return; }
    for (const [id, part] of Object.entries(this.snapshot.parts)) {
      if (!rig.parts.has(id)) continue;
      if (rig.setProgress) rig.setProgress(id, part.progress);
      // Legacy rigs only have binary endpoints; continuous rigs restore the exact pose above.
      if (!rig.setProgress || part.target !== part.progress) rig.set(id, part.target, { instant: part.target === part.progress });
    }
  }
  show(section) {
    if (this.host.getMode() !== 'exhibit' || !vehicleProfiles[this.host.getSelected()] || !this.capabilities.includes(section) || section === this.section) return;
    if (this.section === 'car') this.capture();
    $('#notice').classList.remove('visible');
    this.releaseEngine(); this.releaseLab(); this.restoreParts(); this.section = section;
    if (section === 'car') {
      if (this.snapshot) this.host.moveCamera(this.snapshot.width === innerWidth && this.snapshot.height === innerHeight ? this.snapshot : this.host.exhibitCamera());
      this.snapshot = null;
    } else if (section === 'history') this.setChapter(this.chapter);
    else if (section === 'lab') {
      $('#lab-panel').scrollTop = 0; $('#lab-title').textContent = this.profile.labTitle || `${this.profile.name} 专属实验`;
      $('#lab-intro').textContent = '载入模型与讲解。'; this.loadLab();
    } else {
      $('#engine-panel').scrollTop = 0;
      this.engineMode = 'exterior';
      const entryPart = this.profile.engineEntryPart === undefined ? 'engine_lid' : this.profile.engineEntryPart;
      if (entryPart && this.host.getRig()?.parts.has(entryPart)) this.host.getRig().set(entryPart, true);
      this.host.moveCamera(this.host.exhibitCamera('engine')); this.loadExterior();
    }
    this.sync();
  }
  setChapter(index) {
    const c = this.profile.chapters?.[index]; if (!c) return; this.chapter = index;
    $('#story-panel').scrollTop = 0;
    $('#story-year').textContent = c.year; $('#story-counter').textContent = `0${index + 1} / ${String(this.profile.chapters.length).padStart(2, '0')}`;
    $('#story-title').textContent = c.title; $('#story-copy').textContent = c.copy;
    $$('#story-tabs button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.chapter) === index)));
    $('#story-sources').replaceChildren(...c.sources.map(([text, href]) => { const a = document.createElement('a'); a.textContent = `${text} ↗`; a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }));
    $('#story-family').hidden = index !== 2;
    $('#story-family').replaceChildren(...(this.profile.family || []).flatMap((node, i) => {
      const box = document.createElement('div'); box.className = `family-node${node.current ? ' current' : ''}`;
      box.append(Object.assign(document.createElement('b'), { textContent: node.name }), Object.assign(document.createElement('small'), { textContent: node.caption }));
      return i ? [Object.assign(document.createElement('span'), { className: 'family-arrow', textContent: node.fromPrevious || '→' }), box] : [box];
    }));
    $('#story-aero').hidden = !(this.profile.aeroModes && index === 1);
    if (!$('#story-aero').hidden) this.setAero(this.aeroMode);
    $('#story-next').textContent = index === 2 ? '回到起点 ↺' : '下一章 →';
    if (this.section === 'history') { this.restoreParts(); for (const id of c.parts || []) this.host.getRig()?.set(id, true); this.host.moveCamera(this.storyCamera()); }
    this.host.invalidate();
  }
  storyCamera() {
    const preset = this.host.exhibitCamera(this.profile.chapters[this.chapter].view);
    return this.host.mobile() ? this.host.fitCamera?.(preset) || preset : preset;
  }
  engineFramingBounds() {
    const root = this.engineMode === 'exterior' ? this.exterior : this.engine?.root;
    if (!root) return null;
    const framingRoot = this.stage || root;
    framingRoot.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    framingRoot.traverseVisible(mesh => {
      if (!mesh.isMesh || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    // Assembly modules already record their collapsed bounds and maximum travel
    // in engine-root coordinates. Reserve both endpoints before any animation,
    // keeping every row and removed module in view without moving the camera
    // while the user scrubs the spread slider.
    if (this.engineMode === 'assembly') for (const module of this.assembly?._modules || []) {
      bounds.union(module.bounds.clone().applyMatrix4(root.matrixWorld));
      bounds.union(module.bounds.clone().translate(module.axis).applyMatrix4(root.matrixWorld));
    }
    return bounds.isEmpty() ? null : bounds;
  }
  engineCamera() {
    const preset = this.profile.engineCamera?.[this.engineMode];
    const target = preset?.target ? new THREE.Vector3(...preset.target) : new THREE.Vector3(.25, this.engineMode === 'assembly' ? 1.40 : 1.05, 1.8);
    const position = preset?.position ? new THREE.Vector3(...preset.position) : this.engineMode === 'internal' ? new THREE.Vector3(-3.0, 3.1, 6.0) : new THREE.Vector3(-3.5, 3.2, 6.3);
    if (!preset && this.engineMode === 'assembly') position.sub(target).multiplyScalar(1.18).add(target);
    const camera = { position, target };
    const bounds = this.host.mobile() ? this.engineFramingBounds() : null;
    return bounds ? this.host.fitCamera?.(camera, bounds, { padding: this.engineMode === 'exterior' ? 1.22 : 1.16 }) || camera : camera;
  }
  async loadExterior() {
    if (!this.capabilities.includes('engine') || this.section !== 'engine') return;
    const epoch = ++this.epoch; this.loading = true; this.error = null; this.sync();
    const entryPart = this.profile.engineEntryPart === undefined ? 'engine_lid' : this.profile.engineEntryPart;
    let model, candidateStage;
    try {
      const results = await Promise.allSettled([
        fetch(`./assets/cars/${this.profile.id}/engine-exterior.json`).then(r => { if (!r.ok) throw Error(`Engine manifest ${r.status}`); return r.json(); }),
        this.loader.loadAsync(`./assets/cars/${this.profile.id}/engine-exterior.glb`),
        new Promise(resolve => {
          const check = () => {
            const part = entryPart ? this.host.getRig()?.getState().parts[entryPart] : null;
            if (epoch !== this.epoch || this.section !== 'engine' || !part || part.progress === 1) resolve();
            else requestAnimationFrame(check);
          };
          check();
        })
      ]);
      if (results[1].status === 'fulfilled') model = results[1].value.scene;
      const failure = results.find(r => r.status === 'rejected');
      if (epoch !== this.epoch || this.section !== 'engine') { this.host.disposeModel(model); return; }
      if (failure) throw failure.reason;
      const manifest = results[0].value;
      const validVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
      if (!validVector(manifest.bounds?.min) || !validVector(manifest.bounds?.max) || !Array.isArray(manifest.hotspots) || !this.profile.hotspots.every(h => manifest.hotspots.some(m => m.id === h.id && Array.isArray(m.meshes) && validVector(m.position)))) throw Error('Invalid engine manifest');
      candidateStage = new THREE.Group(); candidateStage.name = `${this.profile.id}-engine-topic`; candidateStage.position.z = 1.8;
      const { width = 2.85, depth = 2.55 } = this.profile.engineStage || {};
      const base = new THREE.Mesh(new THREE.BoxGeometry(width, .13, depth), new THREE.MeshStandardMaterial({ color: '#1b251e', metalness: .55, roughness: .38 }));
      base.position.y = .40; base.receiveShadow = true; candidateStage.add(base);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(width + .01, .009, depth + .01), new THREE.MeshStandardMaterial({ color: '#9a8966', metalness: .75, roughness: .32 })); trim.position.y = .468; candidateStage.add(trim);
      const top = new THREE.Mesh(new THREE.BoxGeometry(width - .04, .009, depth - .04), new THREE.MeshStandardMaterial({ color: '#1c251f', metalness: .15, roughness: .78 })); top.position.y = .477; top.receiveShadow = true; candidateStage.add(top);
      const b = manifest.bounds, scale = this.profile.exteriorScale;
      model.scale.setScalar(scale); model.position.set(-(b.min[0] + b.max[0]) / 2 * scale, .51 - b.min[1] * scale, -(b.min[2] + b.max[2]) / 2 * scale);
      this.meshCategories.clear(); this.materialBases.clear();
      for (const h of manifest.hotspots) for (const name of h.meshes) this.meshCategories.set(name, h.id);
      const oldMaterials = new Set();
      model.traverse(mesh => {
        if (!mesh.isMesh) return; mesh.castShadow = true; mesh.receiveShadow = true;
        const clone = m => { oldMaterials.add(m); const n = m.clone(); n.envMapIntensity = .65; this.materialBases.set(n, { emissive: n.emissive?.clone(), intensity: n.emissiveIntensity }); return n; };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
      });
      oldMaterials.forEach(m => m.dispose()); candidateStage.add(model);
      this.manifest = manifest; this.exterior = model; this.stage = candidateStage; this.host.scene.add(this.stage);
      this.loading = false; this.selectHotspot(this.hotspot); this.sync(); this.host.moveCamera(this.engineCamera());
    } catch (error) {
      this.host.disposeModel(model); this.host.disposeModel(candidateStage);
      if (epoch !== this.epoch) return;
      this.stage = null; this.exterior = null; this.manifest = null; this.materialBases.clear(); this.meshCategories.clear();
      this.loading = false; this.error = 'exterior'; this.sync();
    }
  }
  async setEngineMode(mode, retry = false) {
    if (this.section !== 'engine' || !this.stage || !['exterior', 'internal', 'assembly'].includes(mode) || (mode === this.engineMode && !retry)) return;
    const epoch = this.epoch, modeEpoch = ++this.modeEpoch, profile = this.profile;
    const current = () => epoch === this.epoch && modeEpoch === this.modeEpoch && this.section === 'engine';
    $('#engine-panel').scrollTop = 0;
    this.assembly?.dispose(); this.assembly = null;
    this.engine?.setPlaying(false); this.engineMode = mode; this.error = null; this.loading = false;
    this.exterior.visible = mode === 'exterior'; if (this.engine) this.engine.root.visible = mode !== 'exterior';
    if (mode !== 'exterior') {
      this.loading = true; this.sync();
      try {
        if (!this.engine) {
          // A failed module request needs a new URL so the browser can actually retry.
          const EngineClass = this.classes.get(profile.id) || (await import(retry ? `${profile.module}?retry=${Date.now()}` : profile.module))[profile.exportName];
          this.classes.set(profile.id, EngineClass);
          if (!current()) return;
          this.engine = new EngineClass(); this.engine.root.scale.setScalar(profile.internalScale); this.engine.root.position.y = profile.internalHeight;
          this.stage.add(this.engine.root); this.engine.setPlaying(false); this.engine.setSpeed($('#engine-speed').value);
          this.buildCylinderButtons();
        }
        if (mode === 'assembly') {
          this.AssemblyClass ||= (await import(retry ? `./engine-assembly.js?retry=${Date.now()}` : './engine-assembly.js')).EngineAssembly;
          if (!current()) return;
          this.assembly = new this.AssemblyClass(this.engine, { reducedMotion: this.host.reduced() });
          this.assemblyDirection = 'remove'; this.assembly.setSpread(0); this.buildAssembly(); this.syncAssembly();
        }
        this.engine.root.position.y = profile.internalHeight + (mode === 'assembly' ? (profile.assemblyHeight ?? (profile.cylinderCount === 8 ? .57 : .38)) : 0);
        this.loading = false;
      } catch (error) { if (!current()) return; this.loading = false; this.error = mode; }
    }
    this.syncEngine(); this.sync(); this.host.moveCamera(this.engineCamera());
  }
  buildAssembly() {
    $('#assembly-modules').replaceChildren(...this.assembly.getState().modules.map(module => {
      const button = document.createElement('button'); button.dataset.module = module.id;
      button.append(Object.assign(document.createElement('b'), { textContent: module.label }), document.createElement('small'));
      button.onclick = () => { this.assembly?.select(module.id); this.syncAssembly(); this.host.invalidate(); }; return button;
    }));
  }
  assemblyAction(action) {
    if (!this.assembly) return;
    const result = this.assembly[action](this.assembly.getState().selected);
    if (result.ok) this.assemblyDirection = action;
    this.syncAssembly(); this.host.invalidate();
  }
  syncAssembly() {
    if (!this.assembly) return;
    const state = this.assembly.getState(), selected = state.modules.find(m => m.id === state.selected);
    for (const module of state.modules) {
      const b = $(`#assembly-modules [data-module="${module.id}"]`);
      b.setAttribute('aria-pressed', String(state.selected === module.id)); b.dataset.removed = String(module.removed);
      b.querySelector('small').textContent = module.removed ? '已拆下 · 可观察' : '已安装';
    }
    $('#assembly-count').textContent = `${state.removedCount} / ${state.modules.length} 已拆下`;
    const installing = state.removedCount > 0 && (this.assemblyDirection === 'install' || !state.nextRemove);
    const next = state.modules.find(m => m.id === (installing ? state.nextInstall : state.nextRemove));
    $('#assembly-next').textContent = next ? `${installing ? '装回' : '下一拆卸'}：${next.label}` : '已全部拆开';
    $('#assembly-title').textContent = selected?.label || '';
    $('#assembly-copy').textContent = selected?.description || '';
    $('#assembly-message').textContent = state.message || (state.canRun ? '机构完整，可以试转；也可以选择模块开始拆卸。' : '先按顺序装回部件，再把展开滑杆收回到 0%。');
    $('#assembly-remove').disabled = !!selected?.removed;
    $('#assembly-install').disabled = !selected?.removed;
    $('#assembly-spread').value = Math.round(state.spread * 100);
    $('#assembly-spread-value').textContent = `${Math.round(state.spread * 100)}%`;
    $('#assembly-test').disabled = !state.canRun;
  }
  labCamera() {
    if (this.vehicleLab) {
      const preset = this.host.exhibitCamera(this.profile.id === 'huayra' ? 'hero' : 'side');
      return this.host.mobile() ? this.host.fitCamera?.(preset) || preset : preset;
    }
    const target = new THREE.Vector3(.15, .60, 1.8), position = new THREE.Vector3(-3.5, 4.5, 6.2);
    const camera = { position, target };
    return this.host.mobile() && this.lab?.root ? this.host.fitCamera?.(camera, this.lab.root, { padding: 1.16 }) || camera : camera;
  }
  async loadLab(retry = false) {
    if (!this.capabilities.includes('lab') || this.section !== 'lab') return;
    const epoch = ++this.labEpoch, profile = this.profile;
    this.labLoading = true; this.labError = false; this.sync();
    let candidate = null;
    try {
      const path = profile.labModule || './vehicle-lab.js';
      const module = this.labModules.get(path) || await import(retry ? `${path}?retry=${Date.now()}` : path);
      this.labModules.set(path, module);
      if (epoch !== this.labEpoch || this.section !== 'lab' || this.profile.id !== profile.id) return;
      const LabClass = module[profile.labExportName || 'VehicleLab'];
      const labProfile = module[profile.labProfilesExport || 'labProfiles']?.[profile.id];
      if (!LabClass || !labProfile) throw Error('车型玩法配置缺失');
      candidate = new LabClass(profile.id, {
        rig: this.host.getRig(), model: this.host.getRig()?.model,
        onChange: () => { if (epoch === this.labEpoch) this.host.invalidate(); },
        focusPart: id => { if (epoch === this.labEpoch) this.focusLabPart(id); }
      });
      candidate.setPlaying(false);
      this.lab = candidate; this.labProfile = labProfile;
      if (!this.vehicleLab && this.lab.root) { this.lab.root.position.z = 1.8; this.host.scene.add(this.lab.root); }
      this.buildLab(); this.syncLab(); this.labLoading = false;
      this.sync(); this.host.moveCamera(this.labCamera());
    } catch (error) {
      candidate?.dispose(); candidate?.root?.removeFromParent();
      if (epoch !== this.labEpoch) return;
      this.lab = null; this.labProfile = null; this.restoreParts(); this.labLoading = false; this.labError = true; this.sync();
    }
  }
  focusLabPart(id) {
    if (this.section !== 'lab' || !this.vehicleLab) return;
    const part = this.host.getRig()?.parts.get(id); if (!part) return;
    const target = part.pivot.getWorldPosition(new THREE.Vector3());
    const fallback = this.labCamera(), direction = fallback.position.clone().sub(fallback.target).normalize();
    const position = target.clone().addScaledVector(direction, 2.8);
    const preset = { position, target };
    part.pivot.updateWorldMatrix(true, true);
    const bounds = this.host.mobile() ? new THREE.Box3().setFromObject(part.pivot).expandByScalar(.35) : null;
    this.host.moveCamera(bounds ? this.host.fitCamera?.(preset, bounds, { padding: 1.2 }) || preset : preset);
  }
  buildLab() {
    const profile = this.labProfile;
    this.labSyncKey = null;
    $('#lab-eyebrow').textContent = `${profile.eyebrow} · 教学示意`; $('#lab-title').textContent = profile.title; $('#lab-intro').textContent = profile.copy;
    $('#lab-caption .eyebrow').textContent = this.vehicleLab ? 'VEHICLE MECHANISM / STUDY' : 'SCHEMATIC CHASSIS / STUDY';
    this.sourceLinks($('#lab-sources'), profile.sources);
    $('#lab-controls').replaceChildren(...profile.controls.map(control => {
      const group = document.createElement('fieldset'); group.className = 'lab-control';
      if (control.type === 'choice') {
        group.append(Object.assign(document.createElement('legend'), { textContent: control.label }));
        const choices = document.createElement('div'); choices.className = 'lab-choices';
        for (const option of control.options) {
          const b = document.createElement('button'); b.dataset.labControl = control.key; b.dataset.value = option.value; b.textContent = option.label;
          b.onclick = () => this.setLabControl(control.key, option.value); choices.append(b);
        } group.append(choices);
      } else if (control.type === 'action') {
        const button = document.createElement('button'); button.className = 'lab-action-button'; button.dataset.labControl = control.key;
        button.dataset.controlType = 'action'; button.textContent = control.label;
        button.onclick = () => this.setLabControl(control.key, 'activate'); group.append(button);
        if (control.description) group.append(Object.assign(document.createElement('p'), { className: 'lab-control-description', textContent: control.description }));
      } else if (control.type === 'range') {
        const heading = document.createElement('div'); heading.className = 'lab-range-heading';
        const label = Object.assign(document.createElement('label'), { textContent: control.label, htmlFor: `lab-${control.key}` });
        const output = document.createElement('output'); output.dataset.labOutput = control.key; output.htmlFor = `lab-${control.key}`;
        heading.append(label, output);
        const slider = Object.assign(document.createElement('input'), { id: `lab-${control.key}`, type: 'range', min: control.min, max: control.max, step: control.step, className: 'engine-angle' });
        slider.dataset.labControl = control.key; slider.oninput = () => this.setLabControl(control.key, Number(slider.value)); group.append(heading, slider);
      }
      return group;
    }));
  }
  setLabControl(key, value) { this.lab?.setControl(key, value); this.syncLab(); this.host.invalidate(); }
  syncLab() {
    if (!this.lab) return;
    const state = this.lab.getState();
    const key = JSON.stringify([state.values, state.readouts, state.title, state.summary, state.note, state.playing, state.canPlay, state.disabledControls]);
    if (key === this.labSyncKey) return;
    this.labSyncKey = key;
    $$('button[data-lab-control]').forEach(b => {
      if (b.dataset.controlType !== 'action') b.setAttribute('aria-pressed', String(String(state.values[b.dataset.labControl]) === b.dataset.value));
      b.disabled = !!state.disabledControls?.includes(b.dataset.labControl);
    });
    $$('input[data-lab-control]').forEach(slider => {
      const value = state.values[slider.dataset.labControl]; slider.value = value;
      const control = this.labProfile.controls.find(control => control.key === slider.dataset.labControl);
      const percentage = control.format === 'percent' || (!control.format && !control.unit && Number(control.max) <= 1);
      const text = percentage ? `${Math.round(value * 100)}%` : `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${control.unit ? ` ${control.unit.trim()}` : ''}`;
      slider.setAttribute('aria-valuetext', `${control.label} ${text}`);
      slider.disabled = !!state.disabledControls?.includes(slider.dataset.labControl);
      $(`[data-lab-output="${slider.dataset.labControl}"]`).textContent = text;
    });
    $('#lab-readouts').replaceChildren(...state.readouts.map(readout => {
      const row = document.createElement('div'); row.append(Object.assign(document.createElement('dt'), { textContent: readout.label }), Object.assign(document.createElement('dd'), { textContent: readout.value })); return row;
    }));
    $('#lab-result-title').textContent = state.title; $('#lab-result-copy').textContent = state.summary;
    $('#lab-note').textContent = state.note || this.labProfile.note;
    $('#lab-play').hidden = state.canPlay === false;
    $('#lab-play').textContent = state.playing ? 'Ⅱ 暂停运动' : '▶ 观察运动'; $('#lab-play').setAttribute('aria-pressed', String(state.playing));
  }
  selectHotspot(id) {
    const h = this.profile.hotspots?.find(h => h.id === id); if (!h) return; this.hotspot = id;
    $('#hotspot-title').textContent = h.title; $('#hotspot-copy').textContent = h.copy;
    $$('[data-hotspot]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hotspot === id)));
    this.exterior?.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const base = this.materialBases.get(m); if (!base?.emissive) continue;
        m.emissive.copy(base.emissive); m.emissiveIntensity = base.intensity;
        if (this.meshCategories.get(mesh.name) === id) { m.emissive.set('#8d7844'); m.emissiveIntensity = .18; }
      }
    }); this.host.invalidate();
  }
  syncEngine() {
    if (!this.engine) return; const state = this.engine.getState();
    $('#engine-play').textContent = state.playing ? 'Ⅱ 暂停演示' : '▶ 开始演示'; $('#engine-play').setAttribute('aria-pressed', String(state.playing));
    $('#engine-angle').value = state.angle; $('#engine-angle-value').textContent = `${Math.round(state.angle)}° / 720°`;
    $('#engine-angle').setAttribute('aria-valuetext', `曲轴 ${Math.round(state.angle)} 度`);
    if (state.cylinders.some(c => !$(`[data-cylinder="${c.id}"]`))) this.buildCylinderButtons();
    for (const c of state.cylinders) { const b = $(`[data-cylinder="${c.id}"]`); if (b) { b.setAttribute('aria-pressed', String(c.id === state.selectedCylinder)); b.style.setProperty('--stage-color', c.stageColor); } }
    const c = state.cylinders.find(c => c.id === state.selectedCylinder);
    if (!c) return;
    $('#cycle-dot').style.setProperty('--stage-color', c.stageColor); $('#cycle-title').textContent = `${c.id} · ${c.stage}`;
    $('#cycle-phase').textContent = `${Math.round(c.phase)}° / 720°`; $('#cycle-copy').textContent = c.description;
    $('.teaching-note').textContent = `教学缸号与示例点火顺序：${state.firingOrder.join(' → ')}。每 ${720 / state.cylinders.length}° 依次做功，非原车精确配气仿真。`;
  }
  update(now) {
    if (this.section === 'lab') { const changed = this.lab?.update(now / 1000); if (changed) this.syncLab(); return !!changed; }
    if (!this.stageVisible) return false;
    if (this.engineMode === 'assembly') {
      if (this.assembly) this.assembly.reducedMotion = this.host.reduced();
      const changed = this.assembly?.update(now); if (changed) this.syncAssembly(); return !!changed;
    }
    if (this.engineMode !== 'internal') return false;
    const changed = this.engine?.update(now); if (changed) this.syncEngine(); return !!changed;
  }
  projectLabels() {
    if (this.section !== 'engine' || !this.stage || this.engineMode !== 'exterior') return;
    this.stage.updateMatrixWorld(true);
    const placed = [], desktop = !this.host.mobile();
    const viewport = this.host.viewport?.() || { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
    const right = desktop ? $('#engine-panel').getBoundingClientRect().left - 16 : viewport.right - 6;
    const left = desktop ? 16 : viewport.left + 6, top = desktop ? 88 : viewport.top + 6, bottom = desktop ? innerHeight - 65 : viewport.bottom - 6;
    const hotspots = desktop ? this.manifest.hotspots : [...this.manifest.hotspots].sort((a, b) => Number(b.id === this.hotspot) - Number(a.id === this.hotspot));
    for (const h of hotspots) {
      const p = this.exterior.localToWorld(new THREE.Vector3(...h.position)).project(this.host.camera), b = $(`#engine-labels [data-hotspot="${h.id}"]`);
      b.hidden = p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      if (b.hidden) continue;
      const anchorX = viewport.left + (p.x * .5 + .5) * viewport.width, anchorY = viewport.top + (-p.y * .5 + .5) * viewport.height;
      let x = anchorX, y = anchorY;
      {
        const width = b.offsetWidth, height = b.offsetHeight;
        if (right - left < width || bottom - top < height) { b.hidden = true; continue; }
        const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
        // Keep real surface anchors. Only the label moves; a leader connects it
        // back to its component when nearby parts project to the same place.
        // Compact layouts use the actual free canvas rectangle, so the numbered
        // touch targets and their leaders cannot cover the topic panel.
        const offsets = desktop ? [-2, -1, 0, 1, 2] : [-4, -3, -2, -1, 0, 1, 2, 3, 4];
        const candidates = [-3, -2, -1, 0, 1, 2, 3].flatMap(row => offsets.map(column => {
          const cx = clamp(anchorX + column * (width + 12), left + width / 2, right - width / 2);
          const cy = clamp(anchorY + row * (height + 12), top + height / 2, bottom - height / 2);
          return { x:cx, y:cy, width, height, cost:(cx - anchorX) ** 2 + (cy - anchorY) ** 2 };
        })).sort((a, b) => a.cost - b.cost);
        const hit = candidates.find(c => placed.every(other => Math.abs(c.x - other.x) >= (c.width + other.width) / 2 + 8 || Math.abs(c.y - other.y) >= (c.height + other.height) / 2 + 8)) || (desktop ? candidates[0] : null);
        // If zooming leaves too little room, the full accessible panel list
        // remains available instead of stacking tiny or overlapping targets.
        if (!hit) { b.hidden = true; continue; }
        x = hit.x; y = hit.y; placed.push(hit);
      }
      const dx = anchorX - x, dy = anchorY - y, distance = Math.hypot(dx, dy);
      b.style.left = `${x}px`; b.style.top = `${y}px`;
      b.style.setProperty('--leader-length', `${distance > 12 ? distance : 0}px`);
      b.style.setProperty('--leader-angle', `${Math.atan2(dy, dx)}rad`);
      b.style.setProperty('--leader-dx', `${dx}px`); b.style.setProperty('--leader-dy', `${dy}px`);
      b.style.setProperty('--leader-opacity', distance > 12 ? '1' : '0');
    }
  }
  pick(raycaster) {
    if (this.section === 'lab') { this.lab?.pick?.(raycaster); this.syncLab(); this.host.invalidate(); return; }
    if (this.section !== 'engine' || !this.stage) return;
    if (this.engineMode === 'assembly') { const id = this.assembly?.pick(raycaster); if (id) { this.assembly.select(id); this.syncAssembly(); this.host.invalidate(); } return; }
    if (this.engineMode === 'internal') { const id = this.engine?.pick(raycaster); if (id) { this.engine.selectCylinder(id); this.syncEngine(); this.host.invalidate(); } }
    else { const hit = raycaster.intersectObject(this.exterior, true)[0]; if (hit) this.selectHotspot(this.meshCategories.get(hit.object.name)); }
  }
  resize() { if (this.section === 'history') this.host.applyCamera(this.storyCamera()); else if (this.section === 'engine' && this.stage) this.host.applyCamera(this.engineCamera()); else if (this.section === 'lab' && this.lab) this.host.applyCamera(this.labCamera()); }
  releaseEngine() {
    ++this.epoch; ++this.modeEpoch; this.assembly?.dispose(); this.assembly = null; this.engine?.setPlaying(false); this.engine?.dispose(); this.engine = null;
    if (this.stage) this.host.disposeModel(this.stage); this.stage = null; this.exterior = null; this.manifest = null;
    this.materialBases.clear(); this.meshCategories.clear(); this.loading = false; this.error = null;
  }
  releaseLab() { ++this.labEpoch; this.lab?.setPlaying(false); this.lab?.dispose(); this.lab?.root?.removeFromParent(); this.lab = null; this.labProfile = null; this.labLoading = false; this.labError = false; }
  reset() { this.releaseEngine(); this.releaseLab(); this.restoreParts(); this.snapshot = null; this.section = 'car'; this.engineMode = 'exterior'; this.sync(); }
  getState() { return { vehicle: this.profile.id, capabilities: [...this.capabilities], labPresentation: this.vehicleLab ? 'vehicle' : 'stage', aeroMode: this.aeroMode, section: this.section, engineMode: this.engineMode, chapter: this.chapter, hotspot: this.hotspot, loading: this.loading, error: this.error, stageVisible: this.stageVisible, engine: this.engine?.getState() || null, assembly: this.assembly?.getState() || null, lab: this.lab?.getState() || null, labLoading: this.labLoading, labError: this.labError }; }
}

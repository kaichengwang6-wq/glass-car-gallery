import * as THREE from 'three';
import { EngineAssembly } from './engine-assembly.js';

const SNAP = .15;
const EPS = 1e-7;
const IDS = ['intake', 'intercoolers', 'turbos', 'valvetrain', 'pistons-left', 'pistons-right', 'crankshaft'];
const clamp = value => Math.max(0, Math.min(1, value));

/** Direct manipulation over the same seven original assembly groups. */
export class F40Workbench extends EngineAssembly {
  constructor(engine, { reducedMotion = false, snapshot = null } = {}) {
    if (engine?.assemblyModules?.map(module => module.id).join() !== IDS.join()) throw new Error('F40 动手拆装台需要加载完整的七组总成，请重试发动机加载。');
    super(engine, { reducedMotion });
    this.dragging = null;
    this.inspecting = null;
    this.trial = false;
    this.trialAngle = 0;
    this.task = { active: false, complete: false, cycleDegrees: 0 };
    this._freeSnapshot = null;
    this._dimMaterials = new Map();
    this._table = new THREE.Group(); this._table.name = 'f40_workbench_parking';
    this._tableResources = new Set();
    this.root.updateWorldMatrix(true, true);
    const mechanismBounds = this._modules.reduce((bounds, module) => bounds.union(module.bounds), new THREE.Box3());
    // Pack by authored bounds rather than equal spacing: the exterior pipe groups
    // are almost a metre deep, while an individual piston bank is much smaller.
    const sizes = this._modules.map(module => module.bounds.getSize(new THREE.Vector3()));
    const parking = new Map(), gap = .09;
    const packRow = (indices, behind) => {
      const depth = Math.max(...indices.map(index => sizes[index].z));
      const width = indices.reduce((total, index) => total + sizes[index].x, 0) + gap * (indices.length - 1);
      const z = behind ? mechanismBounds.min.z - gap - depth / 2 : mechanismBounds.max.z + gap + depth / 2;
      let x = -width / 2;
      for (const index of indices) { parking.set(index, [x + sizes[index].x / 2, z]); x += sizes[index].x + gap; }
      return z + depth / 2;
    };
    packRow([0, 1, 2], true);
    const front = packRow([3, 4, 5], false);
    parking.set(6, [0, front + gap + sizes[6].z / 2]);
    for (const [index, module] of this._modules.entries()) {
      const size = sizes[index];
      const [x, z] = parking.get(index);
      // Every module floats just above its thin tray, retaining its installation orientation.
      module.axis.set(x - module.center.x, -.095 - module.bounds.min.y, z - module.center.z);
      const below = module.id === 'crankshaft';
      const clearance = below ? mechanismBounds.min.y - .055 - module.bounds.max.y : mechanismBounds.max.y + .055 - module.bounds.min.y;
      const extract = new THREE.Vector3(0, clearance, 0);
      // Pistons first move up along their 90-degree V-bank, clearing the stationary sleeves.
      if (module.id === 'pistons-left') extract.z = -clearance;
      if (module.id === 'pistons-right') extract.z = clearance;
      module.pathOffsets = [new THREE.Vector3(), extract, new THREE.Vector3(module.axis.x, clearance, module.axis.z), module.axis.clone()];
      module.pathDistances = [0];
      for (let segment = 1; segment < module.pathOffsets.length; segment++) module.pathDistances.push(module.pathDistances.at(-1) + module.pathOffsets[segment].distanceTo(module.pathOffsets[segment - 1]));
      // The same polyline drives position and visible guide; no interpolated straight-line shortcut.
      module.tether.geometry.dispose();
      module.tether.geometry = new THREE.BufferGeometry().setFromPoints(module.pathOffsets.map(offset => module.center.clone().add(offset)));
      module.tether.geometry.setAttribute('lineDistance', new THREE.Float32BufferAttribute(module.pathDistances, 1));
      for (const record of module.wrappers) {
        const rootToParent = new THREE.Matrix4().multiplyMatrices(record.parent.matrixWorld.clone().invert(), this.root.matrixWorld);
        record.localAxis.copy(module.axis).applyMatrix4(rootToParent).sub(new THREE.Vector3().applyMatrix4(rootToParent));
        record.pathTransform = rootToParent;
      }
      const width = Math.max(.16, size.x + .035), depth = Math.max(.14, size.z + .035);
      const geometry = new THREE.BoxGeometry(width, .008, depth);
      const material = new THREE.MeshStandardMaterial({ color: '#17382f', metalness: .5, roughness: .47, transparent: true, opacity: .8 });
      const tray = new THREE.Mesh(geometry, material); tray.position.set(x, -.107, z); tray.name = `f40_tray_${module.id}`;
      const outlineGeometry = new THREE.EdgesGeometry(geometry);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: module.color, transparent: true, opacity: .46, depthWrite: false });
      const border = new THREE.LineSegments(outlineGeometry, outlineMaterial); tray.add(border);
      this._table.add(tray); module.tray = tray;
      for (const resource of [geometry, material, outlineGeometry, outlineMaterial]) this._tableResources.add(resource);
    }
    this.root.add(this._table);
    this.message = '选中总成，沿手柄箭头拖向停放位；也可用拆下／装回按钮。安装位置与停放位附近 15% 范围可吸附。';
    if (snapshot) this._restoreSession(snapshot);
    this._retarget(); this._settle(); this._applyHighlight();
  }

  get canRun() { return super.canRun && !this.dragging && !this.inspecting; }

  _applyHighlight() {
    super._applyHighlight();
    if ((!this.inspecting && !this.trial) || !this._dimMaterials) return;
    const inspected = new Set(this._byId.get(this.inspecting)?.meshes || []);
    const exterior = this.trial ? new Set(this._modules.filter(module => module.assemblyOnly).flatMap(module => module.meshes)) : null;
    for (const [mesh, original] of this._originalMaterials) {
      if (this.trial ? !exterior.has(mesh) : inspected.has(mesh)) { mesh.material = original; continue; }
      const dim = material => {
        let copy = this._dimMaterials.get(material);
        if (!copy) {
          copy = material.clone(); copy.transparent = true; copy.opacity = Math.min(material.opacity, .12); copy.depthWrite = false;
          if (copy.emissive) copy.emissive.set(0);
          this._dimMaterials.set(material, copy);
        }
        return copy;
      };
      mesh.material = Array.isArray(original) ? original.map(dim) : dim(original);
    }
  }

  _applyOffset(module) {
    if (!module.pathOffsets) { super._applyOffset(module); return; }
    const offset = this._pathOffset(module, module.amount);
    for (const record of module.wrappers) record.wrapper.position.copy(offset).applyMatrix4(record.pathTransform).sub(new THREE.Vector3().applyMatrix4(record.pathTransform));
    const dragging = this.dragging?.id === module.id;
    const guideVisible = !this.inspecting && !this.trial && this.selected === module.id && (module.removed || dragging);
    module.outline.visible = guideVisible;
    module.outline.material.opacity = this.selected === module.id ? .36 : .14;
    module.tether.visible = guideVisible;
    module.tether.material.opacity = this.selected === module.id ? .70 : .20;
    if (module.tray) {
      module.tray.children[0].material.opacity = this.selected === module.id ? .75 : .18;
      module.tray.visible = !this.inspecting || this.inspecting === module.id;
    }
  }

  _pathOffset(module, progress) {
    const distance = clamp(progress) * module.pathDistances.at(-1);
    for (let index = 1; index < module.pathOffsets.length; index++) {
      const start = module.pathDistances[index - 1], end = module.pathDistances[index];
      if (distance <= end || index === module.pathOffsets.length - 1) return module.pathOffsets[index - 1].clone().lerp(module.pathOffsets[index], end > start ? (distance - start) / (end - start) : 1);
    }
    return module.axis.clone();
  }

  _retarget() {
    for (const module of this._modules) {
      const target = module.removed ? 1 : .48 * this.spread;
      if (module.target === target) continue;
      module.from = module.amount; module.target = target; module.elapsed = 0;
      if (this.reducedMotion) module.amount = target;
      this._applyOffset(module);
    }
    this._lastTime = null; this._dirty = true;
    this.root.updateWorldMatrix(true, true); this._syncVolumes();
  }

  _settle() {
    for (const module of this._modules) { module.amount = module.target; module.from = module.target; module.elapsed = 0; this._applyOffset(module); }
    this._lastTime = null; this._dirty = true;
    this.root.updateWorldMatrix(true, true); this._syncVolumes();
  }

  _guard() {
    if (this._disposed) return '拆装台已关闭。';
    if (this.trial) return '请先退出手动试转，再拆装总成。';
    if (this.inspecting) return '请先返回工作视角，再拆装总成。';
    if (this.dragging) return '请先完成或取消当前拖动。';
    if (this.isAnimating) return '请等待总成到位。';
    if (this.spread !== 0) return '请先将展开预览收至 0。';
    return null;
  }

  beginDrag(id = this.selected) {
    const blocked = this._guard(); if (blocked) return this._result(false, blocked);
    const module = this._byId.get(id);
    if (!module) return this._result(false, '请先选择一个总成。');
    const expected = module.removed ? this._byId.get(this._removed.at(-1)) : this._modules[this._removed.length];
    if (module !== expected) return this._result(false, `请先${module.removed ? '装回' : '拆下'}${expected.label}，再操作${module.label}。`);
    this._pauseAndFreeze(); this.select(id);
    const progress = module.removed ? 1 : 0;
    this.dragging = { id, progress, committed: progress, canCommit: true };
    this._applyOffset(module); this._syncVolumes();
    return this._result(true, `${module.label}：沿箭头拖向${module.removed ? '安装位置' : '停放位'}，接近端点后松手。`);
  }

  updateDrag(value) {
    if (!Number.isFinite(value)) return this._result(false, '拖动进度必须是有限数值。');
    if (!this.dragging || this._disposed) return this._result(false, '尚未开始拖动。');
    const progress = clamp(value), module = this._byId.get(this.dragging.id);
    this.dragging.progress = progress; this.dragging.canCommit = progress <= SNAP || progress >= 1 - SNAP;
    module.amount = progress; module.target = progress; module.from = progress;
    this._applyOffset(module); this.root.updateWorldMatrix(true, true); this._dirty = true;
    return this._result(true, this.dragging.canCommit ? '已进入吸附范围，可以松手。' : '继续拖向端点；中途松手会回到原位置。');
  }

  endDrag() {
    if (!this.dragging || this._disposed) return this._result(false, '尚未开始拖动。');
    const { id, progress, committed } = this.dragging;
    if (progress > SNAP && progress < 1 - SNAP) { this.cancelDrag(); return this._result(false, '未到达吸附范围，已回到拖动前的位置。'); }
    const destination = progress <= SNAP ? 0 : 1, module = this._byId.get(id);
    this.dragging = null;
    if (destination === committed) {
      module.target = committed; this._settle();
      return this._result(true, '已回到原位置。');
    }
    // Delegate committed ordering and stack mutations to the original assembly controller.
    const result = destination ? super.remove(id) : super.install(id);
    this._invalidateCompletion(); this._applyOffset(module); return result;
  }

  cancelDrag() {
    if (!this.dragging) return this._result(true, '没有未提交的拖动。');
    const { id, committed } = this.dragging; this.dragging = null;
    const module = this._byId.get(id); module.target = committed; module.amount = committed; module.from = committed;
    this._applyOffset(module); this.root.updateWorldMatrix(true, true); this._syncVolumes();
    return this._result(true, '已取消拖动，回到原位置。');
  }

  remove(id = this.selected) {
    const blocked = this._guard(); if (blocked) return this._result(false, blocked);
    const result = super.remove(id); if (result.ok) this._invalidateCompletion(); return result;
  }

  install(id = this.selected) {
    const blocked = this._guard(); if (blocked) return this._result(false, blocked);
    const result = super.install(id); if (result.ok) this._invalidateCompletion(); return result;
  }

  _invalidateCompletion() {
    if (this.task?.active) { this.task.complete = false; this.task.cycleDegrees = 0; }
  }

  setSpread(value) {
    if (!Number.isFinite(value)) throw new Error('展开程度必须是有限数值');
    if (this.trial || this.inspecting || this.dragging || this._disposed) return this;
    return super.setSpread(value);
  }

  getDragWorldPoints(id = this.selected) {
    const module = this._byId.get(id); if (!module || this._disposed) return null;
    this.root.updateWorldMatrix(true, true);
    const start = this.root.localToWorld(module.center.clone());
    const end = this.root.localToWorld(module.center.clone().add(module.axis));
    const point = this.root.localToWorld(module.center.clone().add(this._pathOffset(module, module.amount)));
    return { start, end, point };
  }

  getFramingBounds() {
    if (this._disposed) return null;
    this.root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    for (const module of this._modules) for (const offset of module.pathOffsets) bounds.union(module.bounds.clone().translate(offset).applyMatrix4(this.root.matrixWorld));
    bounds.union(new THREE.Box3().setFromObject(this._table));
    return bounds;
  }

  getModuleBounds(id = this.selected) {
    const module = this._byId.get(id); if (!module || this._disposed) return null;
    this.root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    for (const mesh of module.meshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    }
    return bounds;
  }

  getCrankWorldPoint() {
    if (this._disposed) return null;
    this.root.updateWorldMatrix(true, true);
    const crank = this._byId.get('crankshaft');
    const point = crank.center.clone(); point.x = crank.bounds.max.x + .035;
    return this.root.localToWorld(point);
  }

  setInspection(id) {
    if (this._disposed) return this._result(false, '拆装台已关闭。');
    if (id !== null && !this._byId.has(id)) return this._result(false, '未找到需要观察的总成。');
    if (id !== null && (this.dragging || this.isAnimating || this.trial)) return this._result(false, '请先结束拖动或试转，并等待总成到位。');
    this.inspecting = id;
    if (id !== null) { this._pauseAndFreeze(); this.select(id); }
    this._applyHighlight(); for (const module of this._modules) this._applyOffset(module);
    this._syncVolumes();
    return this._result(true, id ? `${this._byId.get(id).label}：旋转和缩放观察，返回后继续拆装。` : '已返回工作视角。');
  }

  setTrial(value) {
    if (this._disposed) return this._result(false, '拆装台已关闭。');
    if (!value) {
      this.trial = false; this.trialAngle = 0; this._pauseAndFreeze(); this._applyHighlight();
      this._table.visible = true;
      for (const module of this._modules) this._applyOffset(module);
      return this._result(true, '已退出手动试转，机构恢复装配基准姿态。');
    }
    if (!this.canRun) return this._result(false, '请先装回七组总成、返回工作视角，并等待全部归位。');
    if (!this.trial) { this.trialAngle = 0; this.engine.setAngle(0); if (this.task.active && !this.task.complete) this.task.cycleDegrees = 0; }
    this.trial = true; this.engine.setPlaying(false); this._applyHighlight();
    this._table.visible = false;
    for (const module of this._modules) this._applyOffset(module);
    return this._result(true, '拖动旋转手柄或角度滑杆，手动完成 0～720° 的四冲程循环。');
  }

  setTrialAngle(value) {
    if (!this.trial || !this.canRun || this._disposed) return this._result(false, '请先进入手动试转。');
    if (!Number.isFinite(value)) return this._result(false, '曲轴角必须是有限数值。');
    this.trialAngle = Math.max(0, Math.min(720, value));
    this.engine.setPlaying(false); this.engine.setAngle(this.trialAngle);
    if (this.task.active) {
      this.task.cycleDegrees = this.trialAngle;
      if (this.trialAngle >= 720 - EPS) this.task.complete = true;
    }
    this._dirty = true;
    return this._result(true, this.task.complete ? '装配任务完成：七组总成归位，V8 已完成一个 720° 教学循环。' : `手动试转 ${Math.round(this.trialAngle)}° / 720°。`);
  }

  setPlaying(value) { return this.setTrial(Boolean(value)); }

  _stableSnapshot() { return { removed: [...this._removed], selected: this.selected }; }

  _restoreStable(snapshot) {
    const valid = snapshot && Array.isArray(snapshot.removed) && snapshot.removed.length <= IDS.length && snapshot.removed.every((id, index) => id === IDS[index]);
    const removed = valid ? snapshot.removed : [];
    this._removed = [...removed]; this.spread = 0;
    for (const module of this._modules) module.removed = removed.includes(module.id);
    this.selected = this._byId.has(snapshot?.selected) ? snapshot.selected : IDS[0];
    this._retarget(); this._settle(); this._applyHighlight();
  }

  startTask() {
    if (this._disposed) return this._result(false, '拆装台已关闭。');
    this.cancelDrag(); this.setInspection(null); this.setTrial(false); this._settle();
    if (!this.task.active) this._freeSnapshot = this._stableSnapshot();
    this.task = { active: true, complete: false, cycleDegrees: 0 };
    this._restoreStable({ removed: IDS, selected: 'crankshaft' });
    return this._result(true, '装配任务开始：七组总成已放上台面。先找到曲轴与飞轮，将它装回，再逐组恢复发动机。');
  }

  exitTask() {
    if (this._disposed) return this._result(false, '拆装台已关闭。');
    if (!this.task.active) return this._result(false, '当前没有装配任务。');
    this.cancelDrag(); this.setInspection(null); this.setTrial(false);
    const previous = this._freeSnapshot;
    this.task = { active: false, complete: false, cycleDegrees: 0 }; this._freeSnapshot = null;
    this._restoreStable(previous);
    return this._result(true, '已退出任务，恢复进入任务前的自由探索状态。');
  }

  hint() {
    if (this._disposed) return this._result(false, '拆装台已关闭。');
    const id = this._removed.at(-1);
    if (!id) return this._result(true, this.task.complete ? '任务已完成，可以重玩或退出任务。' : '七组总成已装回。进入手动试转，把曲轴转至 720°。');
    this.select(id);
    return this._result(true, `下一步：装回${this._byId.get(id).label}。沿手柄箭头拖动，将部件移回发动机上的同色安装轮廓。`);
  }

  reset() {
    if (this._disposed) return this;
    this.cancelDrag(); this.setInspection(null); this.setTrial(false);
    if (this.task.active) { this.startTask(); return this; }
    super.reset(); return this;
  }

  exportSession() {
    if (this._disposed) return null;
    // Only a stable pose is persisted; a hidden pointer or inspection camera must never resume.
    this.cancelDrag(); this.setInspection(null); this.setTrial(false); this._settle();
    return { version: 1, ...this._stableSnapshot(), task: { ...this.task, cycleDegrees: this.task.complete ? 720 : 0 }, free: this._freeSnapshot ? { removed: [...this._freeSnapshot.removed], selected: this._freeSnapshot.selected } : null };
  }

  _restoreSession(snapshot) {
    if (snapshot?.version !== 1) return;
    this._restoreStable(snapshot);
    this.task = { active: Boolean(snapshot.task?.active), complete: Boolean(snapshot.task?.active && snapshot.task?.complete && this._removed.length === 0), cycleDegrees: 0 };
    if (this.task.complete) this.task.cycleDegrees = 720;
    const free = snapshot.free;
    this._freeSnapshot = this.task.active && Array.isArray(free?.removed) && free.removed.every((id, index) => id === IDS[index]) ? { removed: [...free.removed], selected: free.selected } : null;
    this.message = this.task.active ? '已恢复装配任务进度，可继续安装或查看提示。' : '已恢复本次访问的自由拆装进度。';
  }

  update(now = performance.now()) {
    if (this._disposed) return false;
    if (this.engine.playing) this.engine.setPlaying(false);
    return super.update(now);
  }

  getState() {
    const state = super.getState();
    return { ...state, workbench: true, dragging: this.dragging ? { id: this.dragging.id, progress: this.dragging.progress, canCommit: this.dragging.canCommit } : null,
      inspecting: this.inspecting, trial: this.trial, trialAngle: this.trialAngle,
      task: { ...this.task, installed: this._modules.length - this._removed.length, total: this._modules.length } };
  }

  dispose() {
    if (this._disposed) return;
    this.cancelDrag(); this.setInspection(null); this.setTrial(false);
    this._table.removeFromParent(); this._table.clear();
    for (const resource of this._tableResources) resource.dispose();
    for (const material of this._dimMaterials.values()) material.dispose();
    this._tableResources.clear(); this._dimMaterials.clear();
    super.dispose();
  }
}

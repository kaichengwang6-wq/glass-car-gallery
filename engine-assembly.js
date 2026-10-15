import * as THREE from 'three';

const EPSILON = 1e-5;
const DURATION = 420;
const ACTIVE_ENGINES = new WeakSet();
const LESSON_NOTE = '教学分组拆装：省略紧固件逐件拆卸、正时校准、轴承盖分离及实际维修工序，不作为维修指导。';
const MODULES = [
  { id: 'valvetrain', label: '配气与缸盖总成', color: '#efbc72', axis: [0, .100, 0], description: '四根凸轮轴、气门弹簧、气门与开放式缸盖支承共同上移，露出气缸内部。' },
  { id: 'pistons-left', label: '左列活塞与连杆', color: '#78bce6', axis: [0, .040, -.105], description: '左列活塞、活塞销和连杆按一个教学模块移出；透明缸套留在原位。' },
  { id: 'pistons-right', label: '右列活塞与连杆', color: '#ae9be3', axis: [0, .040, .105], description: '右列活塞、活塞销和连杆移出后，可完整观察共用曲柄销和曲轴。' },
  { id: 'crankshaft', label: '曲轴与飞轮', color: '#8bd0ae', axis: [0, -.100, 0], description: '两列活塞连杆移开后，曲轴、平衡块与飞轮作为最后一个模块向下移出。' }
];

const visible = object => {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
};

/**
 * Reversible teaching overlay for complete teaching engines. Every native object keeps
 * its local transform; an identity parent supplies only the exploded translation.
 * The host continues to call engine.update(now), then assembly.update(now).
 * Only an assembled, collapsed, stationary overlay permits a running engine.
 */
export class EngineAssembly {
  constructor(engine, { reducedMotion = false } = {}) {
    if (!engine?.root?.isObject3D || !engine.crank || !engine._cylinders?.length || !engine._cams?.length) {
      throw new Error('拆装模式需要完整的教学发动机');
    }
    if (ACTIVE_ENGINES.has(engine)) throw new Error('此发动机已处于拆装模式');
    this.engine = engine;
    this.root = engine.root;
    this.reducedMotion = Boolean(reducedMotion);
    const specs = engine.assemblyModules || MODULES;
    if (!Array.isArray(specs) || !specs.length || new Set(specs.map(spec => spec.id)).size !== specs.length || !specs.some(spec => spec.id === 'valvetrain') || !specs.some(spec => spec.id === 'crankshaft')) throw new Error('发动机拆装分组配置不完整');
    this.selected = specs[0].id;
    this.spread = 0;
    this.message = `先选择${specs[0].label}，再点击拆下。${LESSON_NOTE}`;
    this._entryAngle = engine.angle;
    this._entryPlaying = engine.playing;
    this._disposed = false;
    this._dirty = true;
    this._lastTime = null;
    this._removed = [];
    this._wrappers = [];
    this._parentChildren = new Map();
    this._originalMaterials = new Map();
    this._highlightMaterials = new Map();
    this._meshModule = new Map();
    this._workingVolumes = engine._cylinders.flatMap(c => [c.gas, c.spark]);
    this._originalVisibility = new Map(this._workingVolumes.map(mesh => [mesh, mesh.visible]));
    this._guides = new THREE.Group();
    this._guides.name = 'assembly_installation_guides';
    this._modules = specs.map(spec => ({ ...spec, axis: new THREE.Vector3(...spec.axis), nodes: [...(spec.nodes || [])], meshes: [], wrappers: [], amount: 0, from: 0, target: 0, elapsed: 0, removed: false }));
    this._byId = new Map(this._modules.map(module => [module.id, module]));

    // Discover all groups before changing any hierarchy. Names refer to stable
    // model features, not a particular cylinder count or a firing-order index.
    const valveNodes = new Set(engine._cams);
    for (const cylinder of engine._cylinders) {
      const pistonModule = this._byId.get(cylinder.assemblyGroup || (cylinder.bank === 'L' ? 'pistons-left' : 'pistons-right'));
      if (!pistonModule) throw new Error(`气缸 ${cylinder.id} 的拆装分组不存在`);
      pistonModule.nodes.push(cylinder.piston, cylinder.rod);
      for (const { valve, spring } of cylinder.valves) { valveNodes.add(valve); valveNodes.add(spring); }
    }
    for (const mesh of engine._meshes) {
      if (/open_cylinder_head_rail|camshaft_stationary_bearing|camshaft_bearing_pedestal|open_head_seat|head_fastener|spark_plug|ignition_terminal|_(?:intake|exhaust)_valve_seat/.test(mesh.name)) valveNodes.add(mesh);
    }
    this._byId.get('valvetrain').nodes = [...valveNodes];
    this._byId.get('crankshaft').nodes = [engine.crank];
    if (this._modules.some(module => module.nodes.length === 0 || module.nodes.some(node => !node?.parent))) {
      throw new Error('发动机模块层级不完整，无法开始拆装');
    }
    // Optional model-specific exterior modules are visible only at the assembly
    // table. Their prior visibility is restored with the rest of the overlay.
    for (const module of this._modules) if (module.assemblyOnly) for (const node of module.nodes) {
      this._originalVisibility.set(node, node.visible); node.visible = true;
    }
    ACTIVE_ENGINES.add(engine);
    this._pauseAndFreeze();
    this.root.updateWorldMatrix(true, true);
    const inverseRoot = this.root.matrixWorld.clone().invert();
    for (const module of this._modules) {
      module.bounds = new THREE.Box3();
      for (const node of module.nodes) {
        node.traverse(child => {
          if (!child.isMesh) return;
          module.meshes.push(child);
          this._meshModule.set(child, module.id);
          this._originalMaterials.set(child, child.material);
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const matrix = new THREE.Matrix4().multiplyMatrices(inverseRoot, child.matrixWorld);
          module.bounds.union(child.geometry.boundingBox.clone().applyMatrix4(matrix));
        });
        const parent = node.parent;
        if (!this._parentChildren.has(parent)) this._parentChildren.set(parent, [...parent.children]);
        // Convert a vector in engine-root coordinates to the original parent's
        // coordinates. This also works under a rotated/scaled showroom root.
        const rootToParent = new THREE.Matrix4().multiplyMatrices(parent.matrixWorld.clone().invert(), this.root.matrixWorld);
        const localAxis = module.axis.clone().applyMatrix4(rootToParent).sub(new THREE.Vector3().applyMatrix4(rootToParent));
        const wrapper = new THREE.Group();
        wrapper.name = `assembly_${module.id}_offset`;
        parent.add(wrapper);
        wrapper.add(node);
        const record = { node, parent, wrapper, localAxis };
        module.wrappers.push(record);
        this._wrappers.push(record);
      }
      module.center = module.bounds.getCenter(new THREE.Vector3());
      this._createGuide(module);
    }
    this.root.add(this._guides);
    this._applyHighlight();
    this.root.updateWorldMatrix(true, true);
  }

  _createGuide(module) {
    const color = new THREE.Color(module.color);
    const outline = new THREE.Box3Helper(module.bounds.clone(), color);
    outline.name = `assembly_${module.id}_vacancy`;
    outline.material.transparent = true;
    outline.material.opacity = .22;
    outline.material.depthWrite = false;
    outline.visible = false;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    geometry.setAttribute('lineDistance', new THREE.Float32BufferAttribute([0, 0], 1));
    const material = new THREE.LineDashedMaterial({ color, transparent: true, opacity: .55, depthWrite: false, dashSize: .008, gapSize: .005 });
    const tether = new THREE.Line(geometry, material);
    tether.name = `assembly_${module.id}_installation_axis`;
    tether.visible = false;
    this._guides.add(outline, tether);
    module.outline = outline;
    module.tether = tether;
  }

  _pauseAndFreeze() {
    this.engine.setPlaying(false);
    if (this.engine.angle !== 0) this.engine.setAngle(0);
  }

  _applyHighlight() {
    for (const [mesh, material] of this._originalMaterials) mesh.material = material;
    const module = this._byId.get(this.selected);
    if (!module) return;
    const highlight = original => {
      const key = `${module.id}:${original.uuid}`;
      let material = this._highlightMaterials.get(key);
      if (!material) {
        material = original.clone();
        if (material.emissive) { material.emissive.set(module.color); material.emissiveIntensity = .32; }
        else if (material.color) material.color.lerp(new THREE.Color(module.color), .38);
        this._highlightMaterials.set(key, material);
      }
      return material;
    };
    for (const mesh of module.meshes) {
      const original = this._originalMaterials.get(mesh);
      mesh.material = Array.isArray(original) ? original.map(highlight) : highlight(original);
    }
  }

  _applyOffset(module) {
    for (const { wrapper, localAxis } of module.wrappers) wrapper.position.copy(localAxis).multiplyScalar(module.amount);
    const guideVisible = module.removed && module.amount > EPSILON;
    module.outline.visible = guideVisible;
    module.outline.material.opacity = this.selected === module.id ? .36 : .14;
    module.tether.visible = guideVisible;
    module.tether.material.opacity = this.selected === module.id ? .70 : .28;
    if (guideVisible) {
      const positions = module.tether.geometry.attributes.position;
      positions.setXYZ(0, module.center.x, module.center.y, module.center.z);
      positions.setXYZ(1, module.center.x + module.axis.x * module.amount, module.center.y + module.axis.y * module.amount, module.center.z + module.axis.z * module.amount);
      positions.needsUpdate = true;
      module.tether.geometry.attributes.lineDistance.setX(1, module.axis.length() * module.amount);
      module.tether.geometry.attributes.lineDistance.needsUpdate = true;
      module.tether.geometry.computeBoundingSphere();
    }
  }

  _retarget() {
    for (const module of this._modules) {
      // Even at the minimum slider value a removed part stays visibly removed.
      // Attached parts move only for an explicit exploded-view preview.
      const target = module.removed ? .64 + .36 * this.spread : .48 * this.spread;
      if (module.target === target) continue;
      module.from = module.amount;
      module.target = target;
      module.elapsed = 0;
      if (this.reducedMotion) module.amount = target;
      this._applyOffset(module);
    }
    this._lastTime = null;
    this._dirty = true;
    this.root.updateWorldMatrix(true, true);
    this._syncVolumes();
  }

  _syncVolumes() {
    const separated = !this.canRun;
    for (const cylinder of this.engine._cylinders) {
      cylinder.gas.visible = separated ? false : this._originalVisibility.get(cylinder.gas);
      cylinder.spark.visible = separated ? false : Boolean(cylinder.sparkOn);
    }
  }

  _result(ok, message) {
    this.message = message;
    this._dirty = true;
    return { ok, message };
  }

  get canRun() { return !this._disposed && this._removed.length === 0 && this.spread === 0 && !this.isAnimating; }
  get isAnimating() { return !this._disposed && this._modules.some(module => module.amount !== module.target); }

  setSpread(value) {
    if (!Number.isFinite(value)) throw new Error('展开程度必须是有限数值');
    if (this._disposed) return this;
    const next = Math.max(0, Math.min(1, value));
    if (next === this.spread) return this;
    this._pauseAndFreeze();
    this.spread = next;
    this._retarget();
    this.message = next > EPSILON ? '展开预览已暂停发动机；按顺序拆装，收拢并装回全部模块后可试转。' : '已收拢展开预览；拆下的模块仍保留在外侧，需按逆序装回。';
    return this;
  }

  select(id) {
    if (this._disposed) return this;
    if (id !== null && !this._byId.has(id)) throw new Error(`未知拆装模块：${id}`);
    if (id === this.selected) return this;
    this.selected = id;
    this._applyHighlight();
    for (const module of this._modules) this._applyOffset(module);
    this._dirty = true;
    return this;
  }

  remove(id = this.selected) {
    if (this._disposed) return { ok: false, message: '拆装模式已关闭。' };
    const module = this._byId.get(id);
    if (!module) return this._result(false, '请先选择一个拆装模块。');
    this.engine.setPlaying(false);
    if (module.removed) return this._result(false, `${module.label}已经拆下，请选择下一模块或按逆序装回。`);
    const expected = this._modules[this._removed.length];
    if (module !== expected) return this._result(false, `次序不正确：请先拆下${expected.label}，再拆${module.label}。`);
    this._pauseAndFreeze();
    module.removed = true;
    this._removed.push(id);
    this.select(id);
    this._retarget();
    const next = this._modules[this._removed.length];
    return this._result(true, next ? `已拆下${module.label}。下一步：${next.label}。` : `${this._modules.length === 4 ? '四' : this._modules.length}个模块已全部拆下。按相反次序，从曲轴与飞轮开始装回。`);
  }

  install(id = this.selected) {
    if (this._disposed) return { ok: false, message: '拆装模式已关闭。' };
    const module = this._byId.get(id);
    if (!module) return this._result(false, '请先选择需要装回的模块。');
    this.engine.setPlaying(false);
    if (!module.removed) return this._result(false, `${module.label}已经装在原位。`);
    const expected = this._byId.get(this._removed[this._removed.length - 1]);
    if (module !== expected) return this._result(false, `装回次序不正确：请先装回${expected.label}，再装${module.label}。`);
    this._pauseAndFreeze();
    module.removed = false;
    this._removed.pop();
    this.select(id);
    this._retarget();
    const next = this._byId.get(this._removed[this._removed.length - 1]);
    return this._result(true, next ? `已装回${module.label}。下一步：装回${next.label}。` : this.spread > EPSILON ? '全部模块已装回。将展开程度收至 0，待模块归位后即可试转。' : '全部模块已装回，待模块归位后即可试转。');
  }

  setPlaying(value) {
    if (this._disposed) return { ok: false, message: '拆装模式已关闭。' };
    if (!value) { this.engine.setPlaying(false); return this._result(true, '试转已暂停。'); }
    if (!this.canRun) { this.engine.setPlaying(false); return this._result(false, '请先逆序装回全部模块、将展开程度收至 0，并等待模块归位。'); }
    this.engine.setPlaying(true);
    return this._result(true, '装配完整，开始教学试转。');
  }

  reset() {
    if (this._disposed) return this;
    this._pauseAndFreeze();
    this.spread = 0;
    this._removed.length = 0;
    for (const module of this._modules) module.removed = false;
    this.select(this._modules[0].id);
    this._retarget();
    this.message = '已重置为完整装配；待模块归位后，可重新拆装或试转。';
    return this;
  }

  update(now = performance.now()) {
    if (this._disposed) return false;
    const wasAnimating = this.isAnimating;
    if (!this.canRun && (this.engine.playing || this.engine.angle !== 0)) this._pauseAndFreeze();
    const elapsed = Number.isFinite(now) && this._lastTime !== null ? Math.max(0, now - this._lastTime) : 0;
    if (Number.isFinite(now)) this._lastTime = now;
    for (const module of this._modules) {
      if (module.amount === module.target) continue;
      module.elapsed += elapsed;
      const t = this.reducedMotion ? 1 : Math.min(1, module.elapsed / DURATION);
      const ease = 1 - (1 - t) ** 3;
      module.amount = t === 1 ? module.target : module.from + (module.target - module.from) * ease;
      this._applyOffset(module);
    }
    this._syncVolumes();
    const dirty = this._dirty || wasAnimating;
    if (dirty) this.root.updateWorldMatrix(true, true);
    this._dirty = false;
    return dirty;
  }

  getState() {
    return {
      selected: this.selected, spread: this.spread, removedCount: this._removed.length,
      complete: this._removed.length === 0, canRun: this.canRun,
      nextRemove: this._modules[this._removed.length]?.id || null,
      nextInstall: this._removed[this._removed.length - 1] || null,
      modules: this._modules.map((module, index) => ({ id: module.id, label: module.label, removed: module.removed, description: module.description, color: module.color, step: index + 1, selected: module.id === this.selected })),
      message: this.message, note: LESSON_NOTE
    };
  }

  pick(raycaster) {
    if (this._disposed) return null;
    this.root.updateWorldMatrix(true, true);
    const hits = raycaster.intersectObjects([...this._meshModule.keys()], false);
    const hit = hits.find(result => visible(result.object));
    return hit ? this._meshModule.get(hit.object) : null;
  }

  dispose() {
    if (this._disposed) return;
    this.engine.setPlaying(false);
    // Restore only resources and hierarchy owned by this overlay. The live root
    // position/scale/visibility remain under showroom-controller ownership.
    for (const [mesh, material] of this._originalMaterials) mesh.material = material;
    for (const { node, parent, wrapper } of this._wrappers) {
      parent.add(node);
      wrapper.removeFromParent();
    }
    this._guides.removeFromParent();
    for (const [parent, children] of this._parentChildren) {
      const known = new Set(children);
      // Preserve independently added host children, but restore all old siblings
      // to their exact original order (important for repeat entry and picking).
      parent.children.splice(0, parent.children.length, ...children, ...parent.children.filter(child => !known.has(child)));
    }
    for (const module of this._modules) {
      module.outline.geometry.dispose(); module.outline.material.dispose();
      module.tether.geometry.dispose(); module.tether.material.dispose();
    }
    for (const material of this._highlightMaterials.values()) material.dispose();
    this._guides.clear();
    this.engine.setAngle(this._entryAngle);
    for (const [mesh, state] of this._originalVisibility) mesh.visible = state;
    this.engine.setPlaying(this._entryPlaying);
    ACTIVE_ENGINES.delete(this.engine);
    this.root.updateWorldMatrix(true, true);
    this._wrappers.length = 0;
    this._meshModule.clear();
    this._highlightMaterials.clear();
    this._disposed = true;
    this._dirty = false;
  }
}

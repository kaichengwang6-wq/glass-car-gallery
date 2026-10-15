import * as THREE from 'three';

const clamp = x => Math.max(0, Math.min(1, x));
const groups = [
  ['front_shell', '前部外壳', '前部外壳让位于冷却、轮组和悬架的空间；在此沿教学方向移开，观察它与承力车架的分工。'],
  ['rear_shell', '后部外壳', '后部外壳与大型尾翼覆盖动力总成。实车尾罩可开启；此处的整体平移是分解示意，与真实开启轨迹不同。'],
  ['cockpit_shell', '座舱外壳', '座舱外壳界定驾驶空间，车门和风挡围绕乘员布置。此处上移只为揭示内部，不表示实车可一键拆顶。'],
  ['chassis', '钢管车架', '钢管车架与复合材料共同组成承力结构。移开外壳后，可辨认纵梁、横梁和支撑关系；节点和管径为展示近似。'],
  ['powertrain', '动力总成', '中置纵向双涡轮 V8 与后部传动构成动力总成。选择机械之心，可进一步观察八缸运转与发动机模块拆装。'],
  ['cabin', '座舱内饰', '座椅、仪表台与驾驶操作件围绕乘员布置。用分层视角观察座舱与外壳、车架之间的空间关系。'],
  ['wheels', '轮组与制动', '四个轮组和制动部件留在底部，帮助辨认车架与前后轴的关系。支架、盘片与轮胎的细节服务于结构观察。'],
];
const note = '基于当前 F40 公路版车模的真实分件展示。位移、顺序、接口和结构尺寸均为教学示意；胶接外壳不等于实车可快速拆卸，不作为维修步骤。';
export const f40LabProfiles = {
  f40: {
    presentation: 'vehicle', title: '外壳、骨架与动力，各自承担什么？', eyebrow: 'F40 / STRUCTURE EXPLORER',
    copy: '拖动进度逐层移开整车部件，点选部件或下方名称查看用途。可以暂停、反向播放，再沿同一路径装回。',
    controls: [
      { key: 'progress', label: '结构分解进度', type: 'range', min: 0, max: 1, step: .001, value: 0, format: 'percent' },
      { key: 'selected', label: '观察结构', type: 'choice', value: 'chassis', options: groups.map(([value, label]) => ({ value, label })) },
      { key: 'direction', label: '播放方向', type: 'choice', value: 'forward', options: [{ value: 'forward', label: '逐层拆开' }, { value: 'reverse', label: '逐层装回' }] },
    ],
    sources: [['Ferrari · 钢管与复合材料结构', 'https://www.ferrari.com/en-HU/history/moments/1987/enzos-dream/more'], ['Ferrari · F40 技术回顾', 'https://www.ferrari.com/ko-KR/magazine/articles/the-ferrari-f40-revisited']], note,
  },
};

/** The lab temporarily offsets the actual meshes, including meshes reparented
 * by CarRig. It never clones or disposes the car's geometries/textures. */
export class F40StructureLab {
  constructor(id, { rig, model = rig?.model, onChange = () => {} } = {}) {
    if (id !== 'f40' || !rig || !model) throw new Error('F40 车辆结构尚未准备完成');
    this.profileId = id; this.rig = rig; this.model = model; this.onChange = onChange;
    this.profile = f40LabProfiles.f40; this.root = new THREE.Group(); this.root.name = 'f40_structure_lab';
    this.values = { progress: 0, selected: 'chassis', direction: 'forward' };
    this.playing = false; this._disposed = false; this._dirty = true; this._anchorTime = null;
    const definitions = rig.manifest.structuralGroups;
    if (!Array.isArray(definitions) || definitions.length !== groups.length) throw new Error('F40 结构分组缺失');
    const names = new Map(); model.traverse(node => { if (node.isMesh) names.set(node.name, node); });
    const claimed = new Set();
    this._groups = groups.map(([groupId, label, description], index) => {
      const def = definitions.find(d => d.id === groupId);
      if (!def?.meshes?.length || !Array.isArray(def.offset) || def.offset.length !== 3 || !def.offset.every(Number.isFinite)) throw new Error(`F40 结构无效：${groupId}`);
      const meshes = def.meshes.map(name => {
        const mesh = names.get(name);
        if (!mesh || claimed.has(name)) throw new Error(`F40 结构网格无效：${name}`);
        claimed.add(name); return mesh;
      });
      return { id: groupId, label, description, index, meshes, offset: new THREE.Vector3(...def.offset) };
    });
    if (claimed.size !== names.size) throw new Error('F40 存在未归类的结构网格');
    this._rigSnapshot = rig.getState().parts;
    for (const partId of rig.parts.keys()) rig.setProgress(partId, 0);
    model.updateWorldMatrix(true, true);
    this._materials = new Set(); this._items = []; this._meshGroups = new Map();
    for (const group of this._groups) {
      const cache = new Map();
      const clone = original => {
        if (!cache.has(original)) { const copy = original.clone(); cache.set(original, { copy, color: copy.emissive?.clone(), intensity: copy.emissiveIntensity || 0 }); this._materials.add(copy); }
        return cache.get(original);
      };
      group.materials = cache;
      for (const mesh of group.meshes) {
        const original = mesh.material;
        const copies = (Array.isArray(original) ? original : [original]).map(clone);
        mesh.material = Array.isArray(original) ? copies.map(c => c.copy) : copies[0].copy;
        this._items.push({ mesh, group, original, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone() });
        this._meshGroups.set(mesh, group.id);
      }
    }
    this._apply();
  }
  _fraction(group, progress = this.values.progress) {
    const start = { front_shell: 0, rear_shell: .08, cockpit_shell: .18, chassis: 0, powertrain: .42, cabin: .32, wheels: 0 }[group.id];
    const t = clamp((progress - start) / (1 - start)); return t * t * (3 - 2 * t);
  }
  _offsetInParent(item, progress) {
    const transform = new THREE.Matrix4().copy(item.mesh.parent.matrixWorld).invert().multiply(this.model.matrixWorld);
    const zero = new THREE.Vector3().applyMatrix4(transform);
    return item.group.offset.clone().multiplyScalar(this._fraction(item.group, progress)).applyMatrix4(transform).sub(zero);
  }
  _apply() {
    this.model.updateWorldMatrix(true, true);
    for (const item of this._items) item.mesh.position.copy(item.position).add(this._offsetInParent(item, this.values.progress));
    for (const group of this._groups) for (const entry of group.materials.values()) {
      if (!entry.copy.emissive) continue;
      entry.copy.emissive.copy(entry.color);
      entry.copy.emissiveIntensity = entry.intensity;
      if (group.id === this.values.selected) { entry.copy.emissive.set('#8b5c1f'); entry.copy.emissiveIntensity = Math.max(.22, entry.intensity); }
    }
    this.model.updateMatrixWorld(true); this._dirty = true;
  }
  getFramingBounds() {
    const bounds = new THREE.Box3(); this.model.updateWorldMatrix(true, true);
    for (const item of this._items) {
      item.mesh.geometry.computeBoundingBox(); const geometryBounds = item.mesh.geometry.boundingBox;
      if (!geometryBounds) continue;
      for (const progress of [0, 1]) {
        const local = new THREE.Matrix4().compose(item.position.clone().add(this._offsetInParent(item, progress)), item.quaternion, item.scale);
        bounds.union(geometryBounds.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(item.mesh.parent.matrixWorld, local)));
      }
    }
    return bounds;
  }
  get isAnimating() { return this.playing && !this._disposed; }
  _notify() { this._dirty = true; this.onChange(this.getState(), this); }
  setControl(key, value) {
    if (this._disposed) return false;
    if (key === 'progress') { value = Number(value); if (!Number.isFinite(value)) return false; value = clamp(value); this.playing = false; }
    else if (key === 'selected') { if (!this._groups.some(g => g.id === value)) return false; }
    else if (key === 'direction') { if (!['forward', 'reverse'].includes(value)) return false; }
    else return false;
    this.values[key] = value; this._anchorTime = null; this._apply(); this._notify(); return true;
  }
  setPlaying(value) { if (!this._disposed) { this.playing = Boolean(value); this._anchorTime = null; this._notify(); } }
  update(nowSeconds = 0) {
    if (this._disposed) return false;
    let changed = this._dirty;
    if (this.playing && Number.isFinite(nowSeconds)) {
      if (this._anchorTime === null || nowSeconds < this._anchorTime) { this._anchorTime = nowSeconds; this._anchorProgress = this.values.progress; }
      const sign = this.values.direction === 'reverse' ? -1 : 1;
      this.values.progress = clamp(this._anchorProgress + sign * (nowSeconds - this._anchorTime) / 10);
      this._apply(); if (this.values.progress === (sign > 0 ? 1 : 0)) this.playing = false; changed = true;
    }
    this._dirty = false; return changed;
  }
  pick(raycaster) {
    if (this._disposed) return null;
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    const hit = raycaster.intersectObjects([...this._meshGroups.keys()], false).find(h => visible(h.object));
    const id = hit && this._meshGroups.get(hit.object); if (id) this.setControl('selected', id); return id || null;
  }
  reset() { if (!this._disposed) { this.values = { progress: 0, selected: 'chassis', direction: 'forward' }; this.playing = false; this._anchorTime = null; this._apply(); this._notify(); } }
  getState() {
    const selected = this._groups.find(g => g.id === this.values.selected);
    return { profileId: 'f40', presentation: 'vehicle', title: selected.label, summary: selected.description, note,
      playing: this.playing, canPlay: true, values: { ...this.values },
      readouts: [{ label: '结构分解', value: `${Math.round(this.values.progress * 100)}%` }, { label: '当前观察', value: selected.label }, { label: '模型分层', value: '7 个结构组' }, { label: '展示方式', value: '原车模分件 · 教学位移' }],
      mechanism: { source: 'actual-vehicle-meshes', groups: this._groups.map(g => ({ id: g.id, meshCount: g.meshes.length, fraction: this._fraction(g), offset: g.offset.toArray() })), repairProcedure: false },
    };
  }
  dispose() {
    if (this._disposed) return;
    this.playing = false; this._disposed = true;
    for (const item of this._items) { item.mesh.position.copy(item.position); item.mesh.quaternion.copy(item.quaternion); item.mesh.scale.copy(item.scale); item.mesh.material = item.original; }
    for (const material of this._materials) material.dispose(); this._materials.clear();
    this.rig.restoreState(this._rigSnapshot); this.model.updateMatrixWorld(true);
    this._items.length = 0; this._meshGroups.clear(); this.root.clear(); this.root.removeFromParent(); this.onChange = () => {};
  }
}

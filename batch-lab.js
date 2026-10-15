import * as THREE from 'three';

// Phase-one teaching exhibits. Nose is -X, Y is up, dimensions are metres.
// All flow strengths, mechanism geometry and timing are illustrative.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const V = a => new THREE.Vector3(...a);
const FLAPS = ['front_left', 'front_right', 'rear_left', 'rear_right'];
const FLAP_LABELS = ['左前襟翼', '右前襟翼', '左后襟翼', '右后襟翼'];
const onOff = [{ value: 'off', label: '关闭' }, { value: 'on', label: '开启' }];
const direction = { key: 'direction', label: '播放方向', type: 'choice', value: 'forward', options: [{ value: 'forward', label: '展开' }, { value: 'reverse', label: '收回' }] };
const progress = { key: 'progress', label: '机构进度', type: 'range', min: 0, max: 1, step: .001, value: 0, format: 'percent' };
const teaching = '独立结构教学示意；几何尺寸、流量、动作时间与颜色强度不是原厂标定。';

export const batchLabProfiles = {
  mclaren720s: {
    presentation: 'vehicle', title: '一片硬顶，如何藏进车身？', eyebrow: '720S SPIDER / RETRACTABLE HARDTOP',
    copy: '拖动进度观察顶盖、支架和后部收纳空间的关系。播放可随时暂停或反向；透明观察只影响车顶周围的遮挡部件。',
    controls: [{ ...progress, label: '硬顶开合进度' }, { ...direction, options: [{ value: 'forward', label: '开篷' }, { value: 'reverse', label: '关篷' }] }, { key: 'transparent', label: '局部透明观察', type: 'choice', value: 'off', options: onOff }],
    sources: [['迈凯伦 · 720S Spider', 'https://www.mclaren.com/cars/gl_en/legacy/720s-spider']],
    note: '全电动可收折硬顶与上掀车门依据原厂介绍。内部支架尺寸、轨迹和播放时长为教学近似，不是维修或原厂机构仿真。',
  },
  porsche918: {
    presentation: 'stage', title: '三种情景，追踪每一条能量路径。', eyebrow: '918 SPYDER / HYBRID ENERGY',
    copy: '青色为电能，金色为发动机的机械动力，绿色为制动回收。前电机独立驱动前轴，V8 与后电机作用于后轴。',
    controls: [
      { key: 'scenario', label: '教学情景 · 非原车模式菜单', type: 'choice', value: 'electric', options: [{ value: 'electric', label: '纯电驱动' }, { value: 'combined', label: '协同加速' }, { value: 'regen', label: '制动回收' }] },
      { key: 'throttle', label: '油门请求', type: 'range', min: 0, max: 1, step: .01, value: .6, format: 'percent' },
      { key: 'brake', label: '制动请求', type: 'range', min: 0, max: 1, step: .01, value: .4, format: 'percent' },
    ],
    sources: [['保时捷 · 918 Spyder 混合动力架构', 'https://newsroom.porsche.eu/en/press-kits/Media-Drive-Cayenne-E-Performance/10-Jahre-Porsche-918-Spyder.html']],
    note: `${teaching} 三个情景不是实车的五种驾驶模式；制动情景仅展示可回收部分，不模拟电池限值、摩擦制动分配或效率。`,
  },
  huayra: {
    presentation: 'vehicle', title: '四片襟翼，四个可观察的支点。', eyebrow: 'HUAYRA COUPÉ / FOUR ACTIVE FLAPS',
    copy: '点选车上的襟翼或下方名称，再拖动进度。联动模式让四片一起运动，方便观察前后机构；靠近支点可看清翻转关系。',
    controls: [
      { key: 'selected', label: '观察部件', type: 'choice', value: FLAPS[0], options: FLAPS.map((value, i) => ({ value, label: FLAP_LABELS[i] })) },
      { ...progress, label: '所选襟翼展开进度' },
      { key: 'linked', label: '四片联动', type: 'choice', value: 'off', options: onOff }, direction,
      { key: 'focus', label: '靠近所选支点', type: 'action' },
    ],
    sources: [['帕加尼 · Huayra 原版 Coupé', 'https://www.pagani.com/huayra/']],
    note: '四片外部活动襟翼为实车特征。这里是手动机构观察；角度与轨迹为教学示意，不表示驾驶员可逐片操控，也不推测实车转弯时的自动控制规则。',
  },
  chiron: {
    presentation: 'stage', title: '先两颗，再让第二对加入。', eyebrow: 'CHIRON / TWO-STAGE TURBOCHARGING',
    copy: '拖动发动机转速，观察第二对涡轮在约 3,800 rpm 加入。蓝色是进气，橙红色是排气；四颗涡轮尺寸相同，气路并联。',
    controls: [{ key: 'rpm', label: '教学发动机转速', type: 'range', min: 1000, max: 6700, step: 10, value: 2200, unit: ' rpm' }],
    sources: [['布加迪 · Chiron 2016 原厂发布资料', 'https://newsroom.bugatti.com/press-releases/geneva-international-motor-show-2016']],
    note: `${teaching} 约 3,800 rpm 的第二对接入点依据原厂资料；不模拟增压值、负载依赖、阀门滞后或涡轮转速。不是四颗逐一启动，也不是大小涡轮串联。`,
  },
  jesko: {
    presentation: 'stage', title: '从七挡，直接到四挡。', eyebrow: 'JESKO ATTACK / LST + UPOD',
    copy: '两个按钮模拟拨片的两级行程：浅按逐挡降挡，深按进入 UPOD 教学示例。复位到 7 挡后，可清楚看到 7 → 4 不经过 6、5 挡。',
    controls: [
      { key: 'sequential_down', label: '浅按 · 降一挡', type: 'action' },
      { key: 'upod', label: '深按 · UPOD 7 → 4（示例）', type: 'action' },
      { key: 'sequential_up', label: '浅按 · 升一挡', type: 'action' },
      { key: 'example_reset', label: '复位 7 → 4 示例', type: 'action' },
    ],
    sources: [['科尼赛克 · LST / UPOD', 'https://www.koenigsegg.com/lst'], ['科尼赛克 · Jesko Attack', 'https://www.koenigsegg.com/model/jesko-attack']],
    note: 'LST 有 9 个前进挡和 7 个湿式多片离合器。这里用抽象路径说明选挡，不复原齿轮布局、各挡离合器组合或结合时序；4 挡只对应本教学工况，不代表任意车速下的最优挡位。',
  },
};

export class BatchVehicleLab {
  constructor(profileId, { rig = null, model = null, onChange = () => {}, focusPart = () => {} } = {}) {
    this.profileId = profileId; this.profile = batchLabProfiles[profileId];
    if (!this.profile) throw new Error(`未知专题：${profileId}`);
    this.rig = rig; this.model = model || rig?.model; this.onChange = onChange; this.focusPart = focusPart;
    this.root = new THREE.Group(); this.root.name = `${profileId}_teaching_exhibit`;
    this.values = this._defaults(); this.playing = false; this._disposed = false; this._dirty = true;
    this._anchorTime = null; this._anchorPhase = 0; this._phase = 0; this._anchorProgress = 0;
    this._geometries = new Set(); this._materials = new Set(); this._textures = new Set();
    this._streams = []; this._rotors = []; this._transparentMaterials = []; this._gearHistory = [7]; this._gear = 7;
    this._flapPositions = Object.fromEntries(FLAPS.map(id => [id, 0]));
    if (this.profile.presentation === 'vehicle') {
      if (!rig) throw new Error('车辆机构尚未准备完成');
      const required = profileId === 'huayra' ? FLAPS : ['roof'];
      for (const id of required) if (!rig.parts.has(id)) throw new Error(`缺少专题机构：${id}`);
      if (profileId === 'mclaren720s') this._prepareTransparency();
    } else {
      this._makeMaterials(); this._makePlinth();
      if (profileId === 'porsche918') this._makeHybrid();
      if (profileId === 'chiron') this._makeTurbo();
      if (profileId === 'jesko') this._makeTransmission();
    }
    this._apply();
  }

  _defaults() { return Object.fromEntries(this.profile.controls.filter(c => c.type !== 'action').map(c => [c.key, c.value])); }
  _notify() { this._dirty = true; this.onChange(this.getState(), this); }
  get isAnimating() { return !this._disposed && this.playing; }
  setControl(key, value) {
    if (this._disposed) return false;
    const control = this.profile.controls.find(c => c.key === key); if (!control) return false;
    if (control.type === 'action') {
      if (key === 'upod' && this._gear !== 7) return false;
      if (key === 'focus') this.focusPart(this.values.selected);
      else this._shift(key);
    } else {
      if (control.type === 'range') { value = Number(value); if (!Number.isFinite(value)) return false; value = clamp(value, control.min, control.max); }
      if (control.type === 'choice' && !control.options.some(o => o.value === value)) return false;
      this.values[key] = value;
      if (key === 'progress') this.playing = false;
      if (this.profileId === 'huayra') {
        if (key === 'selected') { this.values.progress = this._flapPositions[value]; this.focusPart(value); }
        else if (key === 'progress' || (key === 'linked' && value === 'on')) this._setFlaps(this.values.progress);
      }
    }
    this._anchorTime = null; this._apply(); this._notify(); return true;
  }
  setPlaying(value) {
    if (this._disposed) return;
    this.playing = Boolean(value); this._anchorTime = null; this._notify();
  }
  _setFlaps(value) {
    for (const id of FLAPS) if (this.values.linked === 'on' || id === this.values.selected) this._flapPositions[id] = value;
  }
  _seek(id, value) { if (this.rig.parts.get(id)?.progress !== value || this.rig.parts.get(id)?.target !== value) this.rig.setProgress(id, value); }
  _prepareTransparency() {
    const names = new Set(this.rig.manifest.inspectionMeshes || []);
    this.model?.traverse(mesh => {
      if (!mesh.isMesh || !names.has(mesh.name)) return;
      const original = mesh.material;
      const materials = (Array.isArray(original) ? original : [original]).map(m => { const copy = m.clone(); this._materials.add(copy); return { copy, opacity: copy.opacity, transparent: copy.transparent, depthWrite: copy.depthWrite }; });
      this._transparentMaterials.push({ mesh, original, materials });
      mesh.material = Array.isArray(original) ? materials.map(x => x.copy) : materials[0].copy;
    });
  }
  _apply() {
    if (this.profileId === 'mclaren720s') {
      this._seek('roof', this.values.progress);
      for (const item of this._transparentMaterials) for (const m of item.materials) {
        const on = this.values.transparent === 'on';
        m.copy.opacity = on ? Math.min(.16, m.opacity) : m.opacity; m.copy.transparent = on || m.transparent; m.copy.depthWrite = on ? false : m.depthWrite;
        m.copy.needsUpdate = true;
      }
      this._mechanism = { roofProgress: this.values.progress, transparent: this.values.transparent === 'on', direction: this.values.direction };
      this._summary = this.values.progress === 0 ? '硬顶闭合。拖动进度，开始观察收纳动作。' : this.values.progress === 1 ? '硬顶收纳完成。选择「关篷」可沿相同轨迹恢复闭合。' : '顶盖与支架由同一进度驱动；反向拖动沿原路径返回。';
      this._readouts = [{ label: '硬顶进度', value: `${Math.round(this.values.progress * 100)}%` }, { label: '观察方式', value: this.values.transparent === 'on' ? '局部透明' : '正常外观' }];
    } else if (this.profileId === 'huayra') {
      for (const id of FLAPS) this._seek(id, this._flapPositions[id]);
      this._mechanism = { flaps: { ...this._flapPositions }, selected: this.values.selected, linked: this.values.linked === 'on', automaticControl: false };
      this._summary = `${FLAP_LABELS[FLAPS.indexOf(this.values.selected)]} · ${this.values.linked === 'on' ? '四片跟随同一进度' : '仅操作所选襟翼'}。这是手动机构演示。`;
      this._readouts = FLAPS.map((id, i) => ({ label: FLAP_LABELS[i], value: `${Math.round(this._flapPositions[id] * 100)}%` }));
    } else if (this.profileId === 'porsche918') this._applyHybrid();
    else if (this.profileId === 'chiron') this._applyTurbo();
    else this._applyTransmission();
    this._updateMarkers();
  }
  _material(color, extras = {}) { const m = new THREE.MeshStandardMaterial({ color, roughness: .36, metalness: .65, ...extras }); this._materials.add(m); return m; }
  _makeMaterials() {
    this.mat = { silver: this._material(0xaabecb), dark: this._material(0x172832), black: this._material(0x11191d, { roughness: .8, metalness: .1 }), blue: this._material(0x65cbf5), gold: this._material(0xe5b166), red: this._material(0xec8860), green: this._material(0x7ce0ad), glass: this._material(0x729cab, { transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }) };
  }
  _mesh(name, geometry, mat, parent = this.root) { this._geometries.add(geometry); const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; parent.add(mesh); return mesh; }
  _box(name, size, position, mat = this.mat.silver, parent) { const m = this._mesh(name, new THREE.BoxGeometry(...size), mat, parent); m.position.set(...position); return m; }
  _cylinder(name, r, h, position, mat = this.mat.silver, parent) { const m = this._mesh(name, new THREE.CylinderGeometry(r, r, h, 24), mat, parent); m.position.set(...position); return m; }
  _rod(name, a, b, radius = .017, mat = this.mat.silver, parent) { const v = V(b).sub(V(a)); const m = this._cylinder(name, radius, v.length(), V(a).add(V(b)).multiplyScalar(.5).toArray(), mat, parent); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return m; }
  _badge(text, position, width = .65, color = '#d1e6ee') {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 108;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#10232e'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#466575'; ctx.strokeRect(2, 2, 764, 104);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 39px sans-serif'; ctx.fillText(text, 384, 54);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this._textures.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }); this._materials.add(mat);
    const mesh = this._mesh(`label_${text}`, new THREE.PlaneGeometry(width, width * 108 / 768), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(...position); return mesh;
  }
  _makePlinth() {
    this._box('exhibit_base', [3.3, .065, 1.85], [0, .04, 0], this.mat.dark);
    this._box('exhibit_glass', [3.26, .04, 1.81], [0, .095, 0], this.mat.glass);
    for (const z of [-.9, .9]) this._rod('edge_inlay', [-1.6, .13, z], [1.6, .13, z], .005, this.mat.silver);
  }
  _stream(name, points, color, radius = .022) {
    const curve = new THREE.CatmullRomCurve3(points.map(V));
    const mat = this._material(color, { transparent: true, opacity: .8, emissive: color, emissiveIntensity: .18 });
    const line = this._mesh(name, new THREE.TubeGeometry(curve, 40, radius, 8, false), mat);
    const tipMat = this._material(color, { emissive: color, emissiveIntensity: .7 });
    const markers = [0, 1, 2].map(i => this._mesh(`${name}_arrow_${i}`, new THREE.ConeGeometry(.045, .10, 8), tipMat));
    const stream = { name, curve, line, markers, active: false, reverse: false, strength: 0 };
    this._streams.push(stream); return stream;
  }
  _flow(name, active, strength = 1, reverse = false) {
    const s = this._streams.find(x => x.name === name); if (!s) return;
    s.active = active && strength > 0; s.strength = strength; s.reverse = reverse;
    s.line.material.opacity = s.active ? .4 + .5 * strength : .10;
  }
  _updateMarkers() {
    for (const s of this._streams) for (let i = 0; i < s.markers.length; i++) {
      const m = s.markers[i]; m.visible = s.active;
      const u = ((this._phase * .25 + i / s.markers.length) % 1 + 1) % 1;
      const t = s.reverse ? 1 - u : u;
      m.position.copy(s.curve.getPointAt(t)); const tangent = s.curve.getTangentAt(t).multiplyScalar(s.reverse ? -1 : 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    }
    for (const rotor of this._rotors) rotor.group.rotation[rotor.axis || 'z'] = this._phase * rotor.speed;
  }
  _makeWheels() {
    for (const x of [-1.12, 1.12]) for (const z of [-.71, .71]) {
      const tyre = this._mesh('tyre', new THREE.TorusGeometry(.17, .055, 9, 28), this.mat.black); tyre.position.set(x, .34, z);
      const rim = this._cylinder('wheel_rim', .14, .11, [x, .34, z], this.mat.silver); rim.rotation.x = Math.PI / 2;
    }
    for (const x of [-1.12, 1.12]) this._rod('axle', [x, .34, -.72], [x, .34, .72], .027);
    this._badge('车头 ←', [-1.35, .14, .3], .35);
  }
  _motor(name, x, color) {
    const mat = this._material(color, { emissive: color, emissiveIntensity: .12 });
    const motor = this._cylinder(name, .16, .32, [x, .40, 0], mat); motor.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const band = this._mesh(`${name}_cooling_ring`, new THREE.TorusGeometry(.167, .008, 6, 32), this.mat.silver); band.position.set(x, .40, -.12 + i * .06); }
    return motor;
  }
  _makeHybrid() {
    this._makeWheels();
    this._box('central_battery_case', [.65, .22, .69], [-.1, .28, 0], this.mat.dark);
    for (let x = 0; x < 5; x++) for (let z = 0; z < 4; z++) this._cylinder('battery_cell', .042, .13, [-.34 + x * .12, .44, -.23 + z * .15], this.mat.green);
    this._frontMotor = this._motor('independent_front_motor', -1.12, 0x65cbf5); this._rearMotor = this._motor('rear_hybrid_motor', 1.12, 0x65cbf5);
    this._box('V8_crankcase', [.55, .17, .38], [.58, .35, 0], this.mat.silver);
    for (const z of [-1, 1]) { const cover = this._box('V8_cylinder_bank', [.58, .15, .2], [.57, .53, z * .19], this.mat.gold); cover.rotation.x = z * .40; }
    this._box('V8_intake', [.4, .11, .18], [.57, .66, 0], this.mat.dark);
    this._stream('battery_front', [[-.4, .53, -.24], [-.75, .53, -.38], [-1.12, .53, -.19]], 0x65cbf5);
    this._stream('battery_rear', [[.2, .53, -.24], [.65, .64, -.5], [1.12, .53, -.19]], 0x65cbf5);
    this._stream('v8_rear', [[.8, .48, .18], [.97, .48, .27], [1.12, .48, .18]], 0xe5b166);
    this._stream('regen_front', [[-1.12, .55, .19], [-.76, .55, .46], [-.35, .5, .25]], 0x7ce0ad);
    this._stream('regen_rear', [[1.12, .55, .19], [.73, .68, .5], [.18, .5, .25]], 0x7ce0ad);
    for (const [name, x, color] of [['前电机', -1.13, '#65cbf5'], ['动力电池', -.1, '#7ce0ad'], ['4.6L V8', .58, '#e5b166'], ['后电机', 1.17, '#65cbf5']]) this._badge(name, [x, .145, -.69], .57, color);
    this._badge('前后轴之间没有机械传动轴', [0, .145, .74], 1.7);
  }
  _applyHybrid() {
    const { scenario, throttle, brake } = this.values;
    const driving = scenario !== 'regen', request = driving ? throttle : brake;
    this._flow('battery_front', driving, request); this._flow('battery_rear', driving, request);
    this._flow('v8_rear', scenario === 'combined', request);
    this._flow('regen_front', !driving, request); this._flow('regen_rear', !driving, request);
    const flows = this._streams.filter(s => s.active).map(s => s.name);
    this._mechanism = { scenario, request, flows, frontIndependent: true, engineActive: scenario === 'combined' && request > 0, frontMotor: request ? driving ? 'motor' : 'generator' : 'idle', rearMotor: request ? driving ? 'motor' : 'generator' : 'idle', battery: request ? driving ? 'discharging' : 'charging' : 'idle', mechanicalFrontDrive: false };
    this._summary = scenario === 'electric' ? '电池向前后电机供电；V8 不输出动力。' : scenario === 'combined' ? 'V8 与后电机共同驱动后轴；前电机独立驱动前轴。' : '车轮带动前后电机发电，能量流回电池。此情景油门不参与计算。';
    if (request === 0) this._summary = '当前请求为零，暂无能量流动。提高本情景有效的油门或制动请求，可观察动力路径。';
    this._readouts = [{ label: 'V8', value: this._mechanism.engineActive ? '驱动后轴' : '无动力输出' }, { label: '前 / 后电机', value: request ? driving ? '电动 / 电动' : '发电 / 发电' : '待机 / 待机' }, { label: '动力电池', value: request ? driving ? '输出电能' : '回收电能' : '无能量流动' }, { label: driving ? '有效油门请求' : '有效制动请求', value: `${Math.round(request * 100)}%` }];
  }
  _makeTurbo() {
    this._box('W16_crankcase', [1.15, .18, .57], [0, .31, 0], this.mat.silver);
    for (let bank = 0; bank < 4; bank++) {
      const cover = this._box('W16_four_bank_cover', [1.07, .14, .13], [0, .49 + (bank === 1 || bank === 2 ? .07 : 0), -.29 + bank * .195], this.mat.dark); cover.rotation.x = bank < 2 ? -.2 : .2;
      for (let cylinder = 0; cylinder < 4; cylinder++) this._cylinder('cylinder_location_marker', .043, .018, [-.4 + cylinder * .265, .61, -.29 + bank * .195], this.mat.silver);
    }
    this._turbos = [];
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? .77 : -.77, z = i < 2 ? -.61 : .61, pair = i % 2;
      const group = new THREE.Group(); group.name = `turbo_${i + 1}`; group.position.set(x, .44, z); this.root.add(group);
      const shell = this._mesh('compressor_housing', new THREE.TorusGeometry(.135, .047, 12, 32), this.mat.silver, group); shell.rotation.x = Math.PI / 2;
      const rotor = new THREE.Group(); group.add(rotor);
      for (let blade = 0; blade < 8; blade++) { const angle = blade * Math.PI / 4; const vane = this._box('turbine_blade', [.12, .018, .027], [Math.cos(angle) * .065, 0, Math.sin(angle) * .065], this.mat.blue, rotor); vane.rotation.y = -angle + .35; }
      this._cylinder('turbine_hub', .028, .08, [0, 0, 0], this.mat.gold, group);
      const indicator = this._material(0x65cbf5, { emissive: 0x65cbf5, emissiveIntensity: .5 });
      this._box('activation_indicator', [.23, .025, .025], [0, -.19, 0], indicator, group);
      this._turbos.push({ group, rotor, indicator, pair }); this._rotors.push({ group: rotor, axis: 'y', speed: pair ? 0 : 3 });
      this._stream(`intake_${i}`, [[x * 1.65, .28, z], [x, .4, z], [x * .58, .66, z * .5], [x * .35, .66, z * .12]], 0x65cbf5, .018);
      this._stream(`exhaust_${i}`, [[x * .4, .35, z * .45], [x, .33, z], [x * 1.55, .21, z]], 0xec8860, .018);
      this._badge(`${pair ? '第二对' : '第一对'} · ${z < 0 ? '右' : '左'}`, [x, .145, z < 0 ? -.82 : .82], .66, pair ? '#b8c9d1' : '#65cbf5');
    }
    this._badge('8.0L W16 · 四涡轮并联气路', [0, .145, 0], 1.35);
  }
  _applyTurbo() {
    const activeCount = this.values.rpm >= 3800 ? 4 : 2;
    this._turbos.forEach((t, i) => { const active = t.pair === 0 || activeCount === 4; t.indicator.emissiveIntensity = active ? .8 : 0; t.indicator.color.setHex(active ? 0x65cbf5 : 0x34434c); this._rotors[i].speed = active ? 2 + this.values.rpm / 1200 : 0; this._flow(`intake_${i}`, active); this._flow(`exhaust_${i}`, active); });
    this._mechanism = { rpm: this.values.rpm, threshold: 3800, activeCount, active: this._turbos.map(t => t.pair === 0 || activeCount === 4), arrangement: 'parallel-equal-size', flowDirections: { intake: 'air-to-engine', exhaust: 'engine-to-outlet' } };
    this._summary = activeCount === 2 ? '第一对工作，第二对尚未接入；继续提高转速，观察约 3,800 rpm 的变化。' : '第二对已接入，四颗共同工作。四条进气路径通向发动机，排气路径离开发动机。';
    this._readouts = [{ label: '教学发动机转速', value: `${Math.round(this.values.rpm).toLocaleString()} rpm` }, { label: '工作涡轮', value: `${activeCount} / 4` }, { label: '第二对接入点', value: '约 3,800 rpm' }, { label: '气路关系', value: '同尺寸 · 并联' }];
  }
  _makeTransmission() {
    this._box('LST_transparent_boundary', [2.75, .10, 1.22], [0, .22, 0], this.mat.glass);
    this._rod('input_rail', [-1.35, .43, -.46], [1.35, .43, -.46], .035, this.mat.gold);
    this._rod('output_rail', [-1.35, .43, .46], [1.35, .43, .46], .035, this.mat.blue);
    this._gearMaterials = []; this._gearRotors = [];
    for (let gear = 1; gear <= 9; gear++) {
      const x = -1.15 + (gear - 1) * .2875;
      const material = this._material(0x617786, { emissive: 0x65cbf5, emissiveIntensity: 0 }); this._gearMaterials.push(material);
      const group = new THREE.Group(); group.position.set(x, .43, 0); this.root.add(group);
      const wheel = this._cylinder(`abstract_gear_${gear}`, .098, .055, [0, 0, 0], material, group); wheel.rotation.x = Math.PI / 2;
      for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6; const tooth = this._box('gear_tooth', [.035, .035, .06], [Math.cos(a) * .105, Math.sin(a) * .105, 0], material, group); tooth.rotation.z = a; }
      this._rotors.push({ group, speed: 0 }); this._gearRotors.push(group);
      this._stream(`gear_${gear}`, [[x, .43, -.46], [x, .59, -.22], [x, .59, .22], [x, .43, .46]], 0x65cbf5, .012);
      this._badge(`${gear} 挡`, [x, .145, .68], .25);
    }
    this._badge('动力输入 →', [-.96, .145, -.77], .66, '#e5b166'); this._badge('输出到车轮 →', [.89, .145, -.77], .87, '#65cbf5');
    this._badge('选挡逻辑示意 · 非 LST 实际内部布局', [0, .145, .86], 1.9);
  }
  _shift(action) {
    const before = this._gear;
    if (action === 'example_reset') { this._gear = 7; this._gearHistory = [7]; this._lastShift = null; return; }
    if (action === 'sequential_down') this._gear = Math.max(1, this._gear - 1);
    else if (action === 'sequential_up') this._gear = Math.min(9, this._gear + 1);
    else if (action === 'upod') this._gear = 4;
    if (before !== this._gear) this._gearHistory.push(this._gear);
    this._lastShift = { kind: action === 'upod' ? 'UPOD-example' : 'sequential', from: before, to: this._gear, visited: before === this._gear ? [before] : [before, this._gear] };
  }
  _applyTransmission() {
    this._gearMaterials.forEach((m, i) => { const selected = i + 1 === this._gear; m.emissiveIntensity = selected ? .9 : 0; m.color.setHex(selected ? 0x8be5ef : 0x617786); this._rotors[i].speed = selected ? 2 : 0; this._flow(`gear_${i + 1}`, selected); });
    this._mechanism = { gear: this._gear, forwardGears: 9, wetClutches: 7, history: [...this._gearHistory], lastShift: this._lastShift ? { ...this._lastShift, visited: [...this._lastShift.visited] } : null, clutchTimingSimulated: false, exampleTarget: 4 };
    this._summary = this._lastShift ? `${this._lastShift.from} → ${this._lastShift.to} 挡 · ${this._lastShift.kind === 'UPOD-example' ? '直接选定示例目标挡位，不逐个经过中间挡。' : '一次浅按改变一个挡位。'}` : '示例起点为 7 挡。浅按先到 6 挡；复位后深按，直接到 4 挡。';
    this._readouts = [{ label: '当前挡位', value: `${this._gear} / 9` }, { label: '操作轨迹', value: this._gearHistory.slice(-6).join(' → ') }, { label: '当前工况目标', value: '4 挡 · 教学示例' }, { label: '示意层级', value: '选挡与动力路径' }];
  }
  pick(raycaster) {
    if (this._disposed || this.profileId !== 'huayra') return null;
    const id = this.rig.pick(raycaster); if (!FLAPS.includes(id)) return null;
    this.setControl('selected', id); return id;
  }
  update(nowSeconds = 0) {
    if (this._disposed) return false;
    let changed = this._dirty;
    if (this.playing) {
      const now = Number.isFinite(nowSeconds) ? nowSeconds : 0;
      if (this._anchorTime === null || now < this._anchorTime) { this._anchorTime = now; this._anchorPhase = this._phase; this._anchorProgress = this.values.progress || 0; }
      const elapsed = now - this._anchorTime; this._phase = this._anchorPhase + elapsed;
      if (this.profile.presentation === 'vehicle') {
        const speed = this.profileId === 'mclaren720s' ? 1 / 12 : 1 / 4;
        const sign = this.values.direction === 'reverse' ? -1 : 1;
        this.values.progress = clamp(this._anchorProgress + sign * elapsed * speed);
        if (this.profileId === 'huayra') this._setFlaps(this.values.progress);
        this._apply();
        if (this.values.progress === (sign > 0 ? 1 : 0)) this.playing = false;
      } else this._updateMarkers();
      changed = true;
    }
    this._dirty = false; return changed;
  }
  reset() {
    if (this._disposed) return;
    this.values = this._defaults(); this.playing = false; this._phase = 0; this._anchorTime = null;
    this._gear = 7; this._gearHistory = [7]; this._lastShift = null;
    this._flapPositions = Object.fromEntries(FLAPS.map(id => [id, 0]));
    this._apply(); this._notify();
  }
  getState() {
    const disabledControls = this.profileId === 'porsche918' ? [this.values.scenario === 'regen' ? 'throttle' : 'brake'] : this.profileId === 'jesko' && this._gear !== 7 ? ['upod'] : [];
    return { profileId: this.profileId, title: this.profile.title, presentation: this.profile.presentation, playing: this.playing, disabledControls, values: { ...this.values }, summary: this._summary, note: this.profile.note, readouts: (this._readouts || []).map(r => ({ ...r })), feedback: [], mechanism: JSON.parse(JSON.stringify(this._mechanism || {})) };
  }
  dispose() {
    if (this._disposed) return;
    this._disposed = true; this.playing = false;
    for (const item of this._transparentMaterials) item.mesh.material = item.original;
    this._transparentMaterials.length = 0;
    this.root.removeFromParent(); this.root.clear();
    for (const geometry of this._geometries) geometry.dispose(); for (const material of this._materials) material.dispose(); for (const texture of this._textures) texture.dispose();
    this._geometries.clear(); this._materials.clear(); this._textures.clear(); this._streams.length = this._rotors.length = 0;
    this.onChange = () => {}; this.focusPart = () => {};
  }
}

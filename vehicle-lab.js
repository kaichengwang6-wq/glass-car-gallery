import * as THREE from 'three';

// Independent teaching chassis, metres, Y up, nose along -X.
// All response coefficients, steering angles, trajectories and colour strengths
// below are illustrative normalized assumptions, never production calibration.
const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const V = a => new THREE.Vector3(...a);
const C = { steel: 0x8998a5, dark: 0x17232b, carbon: 0x27343a, cyan: 0x6be9e4, amber: 0xf2b76b, blue: 0x78aef4, red: 0xf47873 };
const ferrariSource = 'https://www.ferrari.com/en-MG/history/garage/2004/f430';
const ferrariBrochure = 'https://kurumacatalog.com/wp-content/uploads/2021/01/2005_Ferrari_F430_catalog.pdf';
const svjSource = 'https://www.lamborghini.com/en-en/history/aventador-svj';
const note = '独立教学底盘，非原厂底盘复原。颜色、箭头、转角、流量及 0–1 数值均为教学假设；不代表实车标定或性能测量。';

export const labProfiles = {
  f430: {
    title: '把动力，送到有抓地力的一侧。', eyebrow: 'F430 / E-DIFF LAB',
    copy: '调整 manettino、路面和油门，观察电子差速器与两只后轮的示意反馈。青色代表左轮，金色代表右轮；车头朝左。',
    controls: [
      { key: 'mode', label: 'manettino 驾驶模式', type: 'choice', value: 'sport', options: [{ value: 'ice', label: 'ICE' }, { value: 'lowgrip', label: 'LOW GRIP' }, { value: 'sport', label: 'SPORT' }, { value: 'race', label: 'RACE' }, { value: 'cstoff', label: 'CST OFF' }] },
      { key: 'surface', label: '教学路况', type: 'choice', value: 'dry', options: [{ value: 'dry', label: '干地' }, { value: 'wet', label: '湿地' }, { value: 'split', label: '左湿 / 右干' }] },
      { key: 'throttle', label: '油门输入 · 归一化', type: 'range', min: 0, max: 1, step: .01, value: .65, unit: '' }
    ],
    sources: [['法拉利 · F430 历史档案', ferrariSource], ['F430 原厂宣传册镜像 · E-Diff / manettino', ferrariBrochure], ['法拉利 · E-Diff 技术介绍', 'https://www.ferrari.com/ja-JP/magazine/articles/great-ferrari-innovations-the-e-diff-and-side-slip-control']], note,
  },
  svj: {
    title: '让四只车轮，与空气一起转弯。', eyebrow: 'SVJ / STEERING + ALA 2.0',
    copy: '低速看后轮反向，高速看后轮同向。再切换直线、制动和弯道，观察固定尾翼内部的左右气路。青色为左侧，金色为右侧；车头朝左。',
    controls: [
      { key: 'speed', label: '四轮转向情景', type: 'choice', value: 'low', options: [{ value: 'low', label: '低速 · 反向' }, { value: 'high', label: '高速 · 同向' }] },
      { key: 'steer', label: '方向盘输入 · 左 + / 右 −', type: 'range', min: -1, max: 1, step: .01, value: .65, unit: '' },
      { key: 'scenario', label: 'ALA 气路情景', type: 'choice', value: 'corner', options: [{ value: 'straight', label: '直线 · 低阻力' }, { value: 'brake', label: '制动 · 下压力' }, { value: 'corner', label: '弯道 · 左右分配' }] },
    ],
    sources: [['兰博基尼 · SVJ / 四轮转向', svjSource], ['兰博基尼 · ALA 2.0 技术介绍', 'https://www.lamborghini.com/en-en/news/aventador-svj-ala'], ['原厂技术资料镜像 · ALA 气动矢量控制', 'https://preview.thenewsmarket.com/Previews/lamb/DocumentAssets/540422.pdf']], note,
  },
};

const MODES = {
  ice: { label: 'ICE', response: .45, coupling: .58, intervention: 1, text: '冰雪取向的情景；采用最温和的示例动力请求。' },
  lowgrip: { label: '低附着', response: .63, coupling: .68, intervention: .92, text: '更温和的示例动力请求，较早的稳定辅助提示。' },
  sport: { label: 'SPORT', response: .82, coupling: .76, intervention: .68, text: '日常运动取向；示意动力请求与稳定辅助协同。' },
  race: { label: 'RACE', response: 1, coupling: .9, intervention: .28, text: '更直接的示例动力请求，允许更明显的滑移提示。' },
  cstoff: { label: 'CST OFF', response: 1, coupling: .9, intervention: 0, text: '关闭稳定与牵引控制的情景；E-Diff 仍工作。' },
};
const SURFACES = { dry: { label: '干地', grip: [.92, .92] }, wet: { label: '湿地', grip: [.3, .3] }, split: { label: '左湿 / 右干', grip: [.22, .92] } };

export class VehicleLab {
  constructor(profileId) {
    if (!labProfiles[profileId]) throw new Error(`Unknown vehicle lab: ${profileId}`);
    this.profileId = profileId;
    this.profile = labProfiles[profileId];
    this.root = new THREE.Group();
    this.root.name = `${profileId}_independent_teaching_chassis`;
    this.values = Object.fromEntries(this.profile.controls.map(c => [c.key, c.value]));
    this.playing = false;
    this._disposed = false;
    this._dirty = true;
    this._lastTime = null;
    this._phase = 0;
    this._geometries = new Set();
    this._materials = new Set();
    this._textures = new Set();
    this._wheels = [];
    this._streams = [];
    this._paths = [];
    this._makeMaterials();
    this._makeChassis();
    if (profileId === 'f430') this._makeDiff(); else this._makeAero();
    this._apply();
  }

  _material(color, extras = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .7, ...extras });
    this._materials.add(m); return m;
  }

  _makeMaterials() {
    this.mat = {
      frame: this._material(C.steel), carbon: this._material(C.carbon, { roughness: .7 }),
      dark: this._material(C.dark), rubber: this._material(0x10171c, { roughness: .9, metalness: .05 }),
      silver: this._material(0xd1dce3, { roughness: .23 }), gold: this._material(0xc38c51),
      cyan: this._material(C.cyan, { emissive: C.cyan, emissiveIntensity: .35 }),
      amber: this._material(C.amber, { emissive: C.amber, emissiveIntensity: .35 }),
      glass: this._material(0x83a8bd, { transparent: true, opacity: .13, depthWrite: false, roughness: .2, metalness: .3 }),
      case: this._material(0x96b6c3, { transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide, roughness: .3 }),
    };
  }

  _mesh(geometry, material, name, parent = this.root) {
    this._geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  _box(name, size, pos, mat = this.mat.frame, parent) {
    const m = this._mesh(new THREE.BoxGeometry(...size), mat, name, parent); m.position.set(...pos); return m;
  }

  _rod(name, a, b, radius = .018, mat = this.mat.frame, parent) {
    const m = this._mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), mat, name, parent);
    this._placeRod(m, a, b); return m;
  }

  _placeRod(mesh, a, b) {
    const av = Array.isArray(a) ? V(a) : a, bv = Array.isArray(b) ? V(b) : b;
    const d = bv.clone().sub(av); mesh.position.copy(av).add(bv).multiplyScalar(.5);
    mesh.scale.y = d.length(); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }

  _tube(name, points, radius, mat, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map(V));
    return this._mesh(new THREE.TubeGeometry(curve, 40, radius, 7, false), mat, name, parent);
  }

  _arrow(name, origin, direction, length, color, parent = this.root) {
    const material = this._material(color, { emissive: color, emissiveIntensity: .45, transparent: true, opacity: .9 });
    const group = new THREE.Group(); group.name = name; group.position.set(...origin);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(direction).normalize()); parent.add(group);
    const shaft = this._mesh(new THREE.CylinderGeometry(.014, .014, .7, 8), material, `${name}_shaft`, group); shaft.position.y = .35;
    const head = this._mesh(new THREE.ConeGeometry(.045, .17, 14), material, `${name}_head`, group); head.position.y = .785;
    group.scale.y = length / .87; return group;
  }

  _badge(text, pos, width, height, color = '#c7d6df') {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 96;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = 'rgba(12,24,32,.93)'; ctx.fillRect(0, 0, 640, 96);
    ctx.strokeStyle = '#426170'; ctx.strokeRect(1, 1, 638, 94);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 37px sans-serif'; ctx.fillStyle = color; ctx.fillText(text, 320, 49);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this._textures.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false }); this._materials.add(mat);
    const mesh = this._mesh(new THREE.PlaneGeometry(width, height), mat, `badge_${text}`); mesh.rotation.x = -Math.PI / 2; mesh.position.set(...pos);
  }

  _makeChassis() {
    this._box('glass_teaching_plinth', [3.2, .075, 1.7], [0, .08, 0], this.mat.glass);
    this._box('floating_dark_plinth', [3.1, .045, 1.6], [0, .025, 0], this.mat.dark);
    for (const z of [-.79, .79]) this._rod('plinth_edge_inlay', [-1.5, .12, z], [1.5, .12, z], .007, this.mat.silver);
    this._box('carbon_central_tub', [1.48, .09, .83], [-.05, .34, 0], this.mat.carbon);
    for (const z of [-.45, .45]) {
      this._rod('longitudinal_alloy_rail', [-1.17, .34, z], [1.17, .34, z], .035);
      this._rod('side_sill_upper', [-.7, .48, z], [.63, .48, z], .022);
      this._rod('side_sill_diagonal', [-.7, .34, z], [-.35, .48, z], .016);
      this._rod('side_sill_diagonal', [.63, .34, z], [.27, .48, z], .016);
    }
    for (const x of [-1.02, -.7, .66, 1.02]) this._rod('transverse_crossmember', [x, .33, -.46], [x, .33, .46], .027);
    for (const [a, b] of [[[-.7, .4, -.4], [.65, .4, .4]], [[-.7, .4, .4], [.65, .4, -.4]]]) this._rod('tub_diagonal_reinforcement', a, b, .014, this.mat.dark);
    this._arrow('nose_direction', [-1.07, .43, 0], [-1, 0, 0], .38, C.steel);
    this._badge('教学底盘 · TEACHING CHASSIS', [-.12, .125, -.63], 1.36, .15);
    this._badge('FRONT  ←', [-1.26, .125, .01], .45, .12);
    for (const axle of ['front', 'rear']) for (const side of ['left', 'right']) {
      const x = axle === 'front' ? -1.02 : 1.02, z = side === 'left' ? .67 : -.67;
      const pivot = new THREE.Group(); pivot.name = `${axle}_${side}_steering_pivot`; pivot.position.set(x, .35, z); this.root.add(pivot);
      const spin = new THREE.Group(); spin.name = `${axle}_${side}_wheel_spin`; pivot.add(spin);
      const tyre = this._mesh(new THREE.TorusGeometry(.205, .065, 9, 40), this.mat.rubber, `${axle}_${side}_tyre`, spin); tyre.scale.z = 1.4;
      const rim = this._mesh(new THREE.CylinderGeometry(.16, .16, .13, 32), this.mat.dark, `${axle}_${side}_rim`, spin); rim.rotation.x = Math.PI / 2;
      const rimRing = this._mesh(new THREE.TorusGeometry(.16, .012, 6, 36), this.mat.silver, 'forged_rim_edge', spin); rimRing.position.z = Math.sign(z) * .075;
      const disc = this._mesh(new THREE.CylinderGeometry(.125, .125, .012, 32), this.mat.frame, 'ventilated_brake_disc', pivot); disc.rotation.x = Math.PI / 2;
      this._box('brake_caliper', [.065, .12, .09], [.11, 0, 0], this.mat.gold, pivot);
      for (let n = 0; n < 5; n++) {
        const a = n * TAU / 5, r = .093;
        const spoke = this._box('wheel_spoke', [.145, .021, .023], [Math.cos(a) * r, Math.sin(a) * r, Math.sign(z) * .083], this.mat.silver, spin); spoke.rotation.z = a;
      }
      for (let n = 0; n < 12; n++) {
        const a = n * TAU / 12;
        this._box('tyre_tread_groove', [.023, .009, .16], [Math.cos(a) * .268, Math.sin(a) * .268, 0], this.mat.dark, spin).rotation.z = a - Math.PI / 2;
      }
      const inner = z * .59;
      for (const dx of [-.2, .2]) {
        this._rod('lower_wishbone', [x + dx, .26, inner], [x, .3, z * .9], .013);
        this._rod('upper_wishbone', [x + dx * .7, .43, inner], [x, .42, z * .9], .011);
      }
      this._rod('damper_body', [x, .28, z * .83], [x + .1, .52, z * .5], .026, this.mat.gold);
      this._rod('damper_piston', [x, .26, z * .87], [x + .08, .46, z * .58], .01, this.mat.silver);
      const tie = this._rod(`${axle}_${side}_steering_tie_rod`, [x + .15, .36, inner], [x + .15, .36, z], .012, this.mat.silver);
      const heading = this._arrow(`${axle}_${side}_wheel_heading`, [-.28, -.175, 0], [-1, 0, 0], .25, side === 'left' ? C.cyan : C.amber, pivot);
      heading.visible = this.profileId === 'svj';
      this._wheels.push({ axle, side, x, z, pivot, spin, tie, heading });
    }
  }

  _makeDiff() {
    this._box('gearbox_casting', [.47, .22, .29], [.44, .51, 0], this.mat.frame);
    for (let i = 0; i < 7; i++) this._box('gearbox_cooling_rib', [.019, .25, .32], [.23 + i * .065, .51, 0], this.mat.silver);
    this._rod('propeller_shaft', [.64, .5, 0], [1.02, .5, 0], .047, this.mat.gold);
    this._box('E_Diff_translucent_housing', [.4, .35, .49], [1.02, .48, 0], this.mat.case);
    const crown = this._mesh(new THREE.TorusGeometry(.13, .029, 7, 32), this.mat.gold, 'E_Diff_crown_gear'); crown.position.set(1.02, .48, 0); this._crown = crown;
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16;
      this._box('crown_gear_tooth', [.036, .026, .065], [1.02 + Math.cos(a) * .15, .48 + Math.sin(a) * .15, 0], this.mat.silver).rotation.z = a;
    }
    this._rod('differential_cross_pin', [.94, .48, 0], [1.1, .48, 0], .025, this.mat.silver);
    this._coupling = [];
    this._torqueArrows = [];
    this._torqueBars = [];
    this._gripPatches = [];
    this._slipRings = [];
    for (const [i, sign] of [[0, 1], [1, -1]]) {
      for (let n = 0; n < 4; n++) {
        const ring = this._mesh(new THREE.TorusGeometry(.09, .012, 6, 28), i === 0 ? this.mat.cyan : this.mat.amber, 'E_Diff_clutch_pack'); ring.position.set(1.02, .48, sign * (.07 + n * .022)); this._coupling.push(ring);
      }
      this._rod('rear_driven_halfshaft', [1.02, .35, sign * .12], [1.02, .35, sign * .66], .027, this.mat.silver);
      this._torqueArrows.push(this._arrow(`${i ? 'right' : 'left'}_delivered_torque`, [1.02, .67, sign * .13], [0, 0, sign], .42, i ? C.amber : C.cyan));
      const mat = this._material(i ? C.amber : C.cyan, { transparent: true, opacity: .8, emissive: i ? C.amber : C.cyan, emissiveIntensity: .25 });
      const bar = this._box(`${i ? 'right' : 'left'}_normalized_torque_meter`, [.055, .013, .45], [.68, .145, sign * .39], mat); this._torqueBars.push(bar);
      const patch = this._box(`${i ? 'right' : 'left'}_road_grip_patch`, [.58, .012, .31], [1.02, .135, sign * .65], this._material(0x3d5459, { roughness: .9, metalness: .1 })); this._gripPatches.push(patch);
      const slip = this._mesh(new THREE.TorusGeometry(.286, .014, 5, 32), this._material(C.red, { transparent: true, opacity: 0, emissive: C.red, emissiveIntensity: .4, depthWrite: false }), 'rear_wheel_slip_warning'); slip.position.set(1.02, .153, sign * .65); slip.rotation.x = -Math.PI / 2; slip.scale.y = .56; this._slipRings.push(slip);
    }
    this._inTorque = this._arrow('engine_torque_input', [.13, .7, 0], [1, 0, 0], .58, C.steel);
    this._box('electronic_control_teaching_module', [.32, .09, .26], [-.25, .47, 0], this.mat.dark);
    this._supportRing = this._mesh(new THREE.TorusGeometry(.105, .013, 7, 32), this._material(C.cyan, { emissive: C.cyan, transparent: true, opacity: .85 }), 'CST_normalized_support_indicator');
    this._supportRing.position.set(-.25, .53, 0); this._supportRing.rotation.x = -Math.PI / 2;
    this._supportNeedle = this._box('CST_normalized_support_needle', [.1, .012, .014], [-.25, .54, 0], this.mat.silver);
    this._tube('electronic_differential_control_wire', [[-.1, .48, -.14], [.13, .47, -.23], [.67, .48, -.25], [.91, .5, -.12]], .008, this.mat.cyan);
    this._badge('CST · 辅助示意', [-.25, .14, -.3], .64, .12);
    this._badge('E-DIFF · 后轴电子差速器', [.65, .71, 0], 1.08, .14);
    this._badge('前轮 · 非驱动', [-.7, .14, 0], .57, .13);
    this._makeStream('torque_left', [[.3, .72, 0], [.72, .72, 0], [1.02, .7, .14], [1.02, .7, .55]], C.cyan);
    this._makeStream('torque_right', [[.3, .72, 0], [.72, .72, 0], [1.02, .7, -.14], [1.02, .7, -.55]], C.amber);
  }

  _makeStream(name, points, color) {
    const curve = new THREE.CatmullRomCurve3(points.map(V));
    const mat = this._material(color, { transparent: true, opacity: .5, emissive: color, emissiveIntensity: .4, depthWrite: false });
    const line = this._mesh(new THREE.TubeGeometry(curve, 36, .009, 6, false), mat, `${name}_channel`);
    const dots = [];
    for (let i = 0; i < 4; i++) dots.push(this._mesh(new THREE.SphereGeometry(.023, 8, 6), mat, `${name}_flow_marker`));
    this._streams.push({ name, curve, line, dots, active: true });
  }

  _makeAero() {
    this._box('front_fixed_splitter', [.28, .045, 1.21], [-1.28, .24, 0], this.mat.carbon);
    this._box('fixed_rear_wing', [.3, .055, 1.46], [1.3, .89, 0], this.mat.carbon);
    for (const z of [-.72, .72]) this._box('fixed_wing_endplate', [.32, .16, .018], [1.3, .9, z], this.mat.dark);
    this._flaps = []; this._downforce = [];
    for (const [i, sign] of [[0, 1], [1, -1]]) {
      const color = i ? C.amber : C.cyan, mat = i ? this.mat.amber : this.mat.cyan;
      this._rod('hollow_wing_pylon', [1.12, .43, sign * .23], [1.26, .87, sign * .23], .045, this.mat.case);
      this._box('engine_cover_air_duct', [.58, .11, .2], [.56, .52, sign * .23], this.mat.case);
      this._tube('visible_air_duct_shell', [[.39, .58, sign * .23], [.85, .58, sign * .23], [1.1, .65, sign * .23], [1.26, .86, sign * .23], [1.38, .89, sign * .48]], .041, this.mat.case);
      const flap = this._box(`${i ? 'right' : 'left'}_internal_air_flap`, [.095, .012, .16], [.45, .59, sign * .23], mat); this._flaps.push(flap);
      this._makeStream(`aero_${i ? 'right' : 'left'}`, [[.2, .61, sign * .23], [.7, .61, sign * .23], [1.09, .67, sign * .23], [1.26, .89, sign * .23], [1.4, .92, sign * .55]], color);
      const down = this._arrow(`${i ? 'right' : 'left'}_rear_downforce`, [1.3, .84, sign * .53], [0, -1, 0], .3, color); this._downforce.push(down);
      const pressure = this._box(`${i ? 'right' : 'left'}_wing_pressure_highlight`, [.31, .008, .6], [1.3, .923, sign * .35], this._material(color, { transparent: true, opacity: .4, emissive: color, emissiveIntensity: .25, depthWrite: false }));
      this._flaps[i].userData.pressure = pressure;
      this._makeStream(`front_${i ? 'right' : 'left'}`, [[-1.49, .29, sign * .4], [-1.29, .29, sign * .4], [-1.13, .32, sign * .4], [-.89, .35, sign * .4]], color);
    }
    this._badge('ALA 2.0 · 固定尾翼 / 内部气路', [.26, .14, 0], 1.4, .15);
    for (const w of this._wheels) {
      const positions = new Float32Array(49 * 3);
      const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(positions, 3)); this._geometries.add(geom);
      const mat = new THREE.LineDashedMaterial({ color: w.side === 'left' ? C.cyan : C.amber, transparent: true, opacity: .8, dashSize: .042, gapSize: .028 }); this._materials.add(mat);
      const path = new THREE.Line(geom, mat); path.name = `${w.axle}_${w.side}_illustrative_trajectory`; this.root.add(path); this._paths.push({ wheel: w, path });
    }
  }

  setControl(key, value) {
    if (this._disposed) return false;
    const definition = this.profile.controls.find(c => c.key === key);
    if (!definition) return false;
    if (definition.type === 'range') {
      const number = Number(value); if (!Number.isFinite(number)) return false;
      value = clamp(number, definition.min, definition.max);
    } else if (!definition.options.some(o => o.value === value)) return false;
    if (this.values[key] === value) return false;
    this.values[key] = value; this._apply(); this._dirty = true; return true;
  }

  setPlaying(value) {
    if (this._disposed) return;
    this.playing = Boolean(value); this._lastTime = null; this._dirty = true;
  }

  get isAnimating() { return !this._disposed && this.playing; }

  _apply() {
    if (this.profileId === 'f430') this._applyDiff(); else this._applyAero();
    this._updateMarkers();
    this.root.updateMatrixWorld(true);
  }

  _applyDiff() {
    const { mode, surface, throttle } = this.values, settings = MODES[mode], road = SURFACES[surface];
    const request = throttle * settings.response;
    const half = request / 2, difference = road.grip[1] - road.grip[0];
    const transfer = half * settings.coupling * Math.abs(difference) * .75;
    const requested = [half - transfer * Math.sign(difference), half + transfer * Math.sign(difference)];
    const delivered = requested.map((t, i) => Math.min(t, road.grip[i]));
    const slip = requested.map((t, i) => clamp((t - road.grip[i]) * (1 - settings.intervention * .75) * 2));
    const support = request * settings.intervention;
    this._mechanism = { request, requested, delivered, slip, grip: [...road.grip], coupling: settings.coupling * request, support, eDiffEnabled: true, cstEnabled: mode !== 'cstoff' };
    this._inTorque.scale.y = Math.max(.008, request * .58 / .87); this._inTorque.visible = request > .001;
    this._supportRing.material.color.setHex(mode === 'cstoff' ? C.red : C.cyan);
    this._supportRing.material.emissive.setHex(mode === 'cstoff' ? C.red : C.cyan);
    this._supportRing.material.opacity = mode === 'cstoff' ? .25 : .32 + support * .68;
    this._supportNeedle.rotation.y = -Math.PI * .8 + support * Math.PI * 1.6;
    this._supportNeedle.visible = mode !== 'cstoff';
    for (let i = 0; i < 2; i++) {
      this._torqueArrows[i].scale.y = Math.max(.012, delivered[i] * .76 / .87); this._torqueArrows[i].visible = delivered[i] > .001;
      this._torqueBars[i].scale.z = Math.max(.01, delivered[i]);
      this._gripPatches[i].material.color.setHex(road.grip[i] < .4 ? 0x345c7d : 0x3d5459);
      this._gripPatches[i].material.emissive.setHex(road.grip[i] < .4 ? 0x163c58 : 0x0);
      this._slipRings[i].material.opacity = slip[i] > .001 ? .25 + slip[i] * .75 : 0;
      this._slipRings[i].visible = slip[i] > .001;
      this._streams[i].active = delivered[i] > .001;
      this._streams[i].line.material.opacity = .16 + delivered[i] * .7;
    }
    for (let i = 0; i < this._coupling.length; i++) this._coupling[i].scale.setScalar(.87 + settings.coupling * request * .19);
    this._summary = `${settings.label} · ${road.label}。${settings.text}${surface === 'split' ? '左右附着不同，示例中右后轮的扭矩通路更强。' : '左右附着相同，两条扭矩通路保持对称。'}`;
    this._readouts = [
      { label: '左轮 / 右轮 · 教学传递量', value: `${delivered[0].toFixed(2)} / ${delivered[1].toFixed(2)}` },
      { label: '稳定辅助', value: mode === 'cstoff' ? 'CST 关闭 · E-Diff 保留' : `${settings.label} 情景 · 归一化提示 ${support.toFixed(2)}` },
      { label: '可见反馈', value: slip.some(s => s > .01) ? '红色轮圈：出现示意滑移' : '后轴箭头：左右动力通路' },
    ];
    this._feedback = ['半透明壳体内的离合器环响应模式与油门。', '蓝色路块为低附着示意；箭头长度为归一化传递，非实车扭矩。', 'CST OFF 不关闭 E-Diff。'];
  }

  _applyAero() {
    const { speed, steer, scenario } = this.values;
    const frontAngle = steer * .36, rearAngle = frontAngle * (speed === 'low' ? -.42 : .26);
    for (const w of this._wheels) {
      const angle = w.axle === 'front' ? frontAngle : rearAngle;
      w.pivot.rotation.y = angle;
      const tip = V([.15, .01, 0]).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(w.pivot.position);
      this._placeRod(w.tie, [w.x + .15, .36, w.z * .59], tip);
    }
    // These symmetric kinematic traces show direction/curvature only. The two
    // wheels on each axle share an illustrative angle; no OEM Ackermann claim.
    const curvature = (Math.tan(frontAngle) - Math.tan(rearAngle)) / 2.04;
    const crab = (Math.tan(frontAngle) + Math.tan(rearAngle)) / 2;
    for (const { wheel: w, path } of this._paths) {
      const attr = path.geometry.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        const s = (i / (attr.count - 1) - .5) * .64;
        const yaw = curvature * s;
        const cx = Math.abs(curvature) < 1e-6 ? -s : -Math.sin(yaw) / curvature;
        const cz = Math.abs(curvature) < 1e-6 ? 0 : (1 - Math.cos(yaw)) / curvature;
        attr.setXYZ(i, cx + w.x * Math.cos(yaw) + w.z * Math.sin(yaw), .151, cz + crab * s - w.x * Math.sin(yaw) + w.z * Math.cos(yaw));
      }
      attr.needsUpdate = true; path.computeLineDistances(); path.geometry.computeBoundingSphere();
    }
    let open = scenario === 'straight' ? [true, true] : [false, false];
    if (scenario === 'corner' && Math.abs(steer) > .025) open = steer > 0 ? [false, true] : [true, false];
    const downforce = open.map(o => o ? .25 : .9);
    const frontOpen = scenario === 'straight';
    for (let i = 0; i < 2; i++) {
      this._flaps[i].rotation.z = open[i] ? Math.PI / 2 : 0;
      this._flaps[i].userData.pressure.material.opacity = .12 + downforce[i] * .45;
      this._downforce[i].scale.y = (.12 + downforce[i] * .36) / .87;
      const stream = this._streams.find(s => s.name === `aero_${i ? 'right' : 'left'}`);
      stream.active = open[i]; stream.line.material.opacity = open[i] ? .84 : .13;
      const front = this._streams.find(s => s.name === `front_${i ? 'right' : 'left'}`);
      front.active = frontOpen; front.line.material.opacity = frontOpen ? .8 : .12;
    }
    const direction = Math.abs(steer) < .025 ? '回正' : steer > 0 ? '左转' : '右转';
    const airText = scenario === 'straight' ? '左右气路打开，展示减阻情景。' : scenario === 'brake' ? '左右气路关闭，展示较高下压力情景。' : Math.abs(steer) < .025 ? '方向回正，左右气路对称；拨动转向观察左右分配。' : `${direction}时内侧气路关闭、外侧打开，内侧下压力示意更强。`;
    this._mechanism = { frontAngle, rearAngle, curvature, crab, airOpen: open, frontAirOpen: frontOpen, downforce, fixedWing: true, normalizedSteering: [steer, steer * (speed === 'low' ? -.42 : .26)] };
    this._summary = `${direction} · ${speed === 'low' ? '前后轮反向，示意更紧凑的转弯轨迹。' : '前后轮同向，示意高速转向稳定性。'}${airText}`;
    this._readouts = [
      { label: '前轮 / 后轮 · 教学转向量', value: `${steer.toFixed(2)} / ${this._mechanism.normalizedSteering[1].toFixed(2)}` },
      { label: 'ALA 左 / 右气路', value: open.map(o => o ? '打开' : '关闭').join(' / ') },
      { label: '左 / 右下压力 · 教学强度', value: `${downforce[0].toFixed(2)} / ${downforce[1].toFixed(2)}` },
    ];
    this._feedback = ['轮胎、转向拉杆与虚线轨迹同步响应；转角为放大的教学设定。', '亮色流道代表旁通气流，向下箭头代表示意下压力。', 'ALA 改变内部气路，尾翼外形保持固定。'];
  }

  _updateMarkers() {
    for (const stream of this._streams) {
      for (let i = 0; i < stream.dots.length; i++) {
        const dot = stream.dots[i]; dot.visible = stream.active;
        dot.position.copy(stream.curve.getPointAt((this._phase * .28 + i / stream.dots.length) % 1));
      }
    }
  }

  update(nowSeconds = 0) {
    if (this._disposed) return false;
    let changed = this._dirty;
    if (this.playing) {
      const time = Number.isFinite(nowSeconds) ? nowSeconds : 0;
      const delta = this._lastTime === null ? 0 : clamp(time - this._lastTime, 0, .1);
      this._lastTime = time; this._phase += delta;
      this._updateMarkers();
      for (const w of this._wheels) {
        const moving = this.profileId === 'svj' ? .7 : w.axle === 'rear' ? this._mechanism.request + this._mechanism.slip[w.side === 'left' ? 0 : 1] * 2 : 0;
        // Integrate each axle output independently. Changing a control changes
        // its future angular speed, never the rotation accumulated beforehand.
        w.spin.rotation.z += delta * moving * 3;
      }
      if (this._crown) this._crown.rotation.z += delta * this._mechanism.request * 2;
      changed = true;
    } else this._lastTime = null;
    this._dirty = false; return changed;
  }

  getState() {
    return {
      profileId: this.profileId, title: this.profile.title, playing: this.playing,
      values: { ...this.values }, summary: this._summary, note: this.profile.note,
      readouts: this._readouts.map(r => ({ ...r })), feedback: [...this._feedback],
      mechanism: JSON.parse(JSON.stringify(this._mechanism)),
    };
  }

  reset() {
    if (this._disposed) return;
    this.values = Object.fromEntries(this.profile.controls.map(c => [c.key, c.value]));
    this.playing = false; this._phase = 0; this._lastTime = null;
    for (const wheel of this._wheels) wheel.spin.rotation.z = 0;
    if (this._crown) this._crown.rotation.z = 0;
    this._apply(); this._dirty = true;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true; this.playing = false;
    this.root.removeFromParent(); this.root.clear();
    for (const geometry of this._geometries) geometry.dispose();
    for (const material of this._materials) material.dispose();
    for (const texture of this._textures) texture.dispose();
    this._geometries.clear(); this._materials.clear(); this._textures.clear();
    this._wheels.length = this._streams.length = this._paths.length = 0;
  }
}

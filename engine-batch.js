import * as THREE from 'three';

// A parameterized teaching mechanism, not reverse-engineered production CAD.
// Public engine dimensions are separated from illustrative rod lengths, cylinder
// numbering, crank-pin phasing, stagger, follower layout and ideal valve timing.
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const LIFT = .0025, CAM_BASE = .021, CROWN = .018;
const wrap = (n, period = 720) => ((n % period) + period) % period;
const ORDER8 = ['L1', 'R1', 'L2', 'R2', 'L4', 'R4', 'L3', 'R3'];
const ORDER12 = ['L1', 'R1', 'L3', 'R3', 'L2', 'R2', 'L6', 'R6', 'L4', 'R4', 'L5', 'R5'];
const STAGES = [
  { stage: '做功', stageColor: '#f2aa54', description: '上止点附近点火，膨胀推动活塞下行；进、排气门保持关闭。' },
  { stage: '排气', stageColor: '#e36e70', description: '排气门打开，活塞上行，把燃烧后的气体推出气缸。' },
  { stage: '进气', stageColor: '#64b7ec', description: '进气门打开，活塞下行，新鲜充量进入气缸。' },
  { stage: '压缩', stageColor: '#a79aea', description: '进、排气门关闭，活塞上行并压缩充量，为下一次点火准备。' }
];

export const batchEngineParameters = Object.freeze({
  mclaren720s: { name: 'M840T 双涡轮 V8', layout: 'V8', bore: .093, stroke: .0735, rod: .145, pitch: .110, bankAngle: 90, valves: 4, camsPerRow: 2 },
  porsche918: { name: '918 自然吸气 V8', layout: 'V8', bore: .095, stroke: .081, rod: .145, pitch: .112, bankAngle: 90, valves: 4, camsPerRow: 2 },
  huayra: { name: 'M158 双涡轮 V12', layout: 'V12', bore: .0826, stroke: .093, rod: .155, pitch: .107, bankAngle: 60, valves: 3, camsPerRow: 1 },
  chiron: { name: '四涡轮 W16', layout: 'W16', bore: .086, stroke: .086, rod: .145, pitch: .085, bankAngle: 90, innerBankAngle: 15, valves: 4, camsPerRow: 1 },
  jesko: { name: 'Jesko 双涡轮 V8', layout: 'V8', bore: .092, stroke: .09525, rod: .158, pitch: .112, bankAngle: 90, valves: 4, camsPerRow: 2 }
});

function valveLift(phase, kind) {
  const start = kind === 'intake' ? 360 : 180;
  return phase > start && phase < start + 180 ? LIFT * Math.sin((phase - start) * DEG) ** 2 : 0;
}

function annulus(inner, outer, height, cut = false) {
  const vertices = [], indices = [], start = cut ? Math.PI / 3 : 0, length = cut ? Math.PI * 4 / 3 : TAU;
  const point = (r, a, y) => [r * Math.sin(a), y, r * Math.cos(a)];
  const quad = (a, b, c, d) => { const n = vertices.length / 3; vertices.push(...a, ...b, ...c, ...d); indices.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (let i = 0; i < 48; i++) {
    const a = start + length * i / 48, b = start + length * (i + 1) / 48, lo = -height / 2, hi = height / 2;
    quad(point(outer, a, lo), point(outer, b, lo), point(outer, b, hi), point(outer, a, hi));
    quad(point(inner, b, lo), point(inner, a, lo), point(inner, a, hi), point(inner, b, hi));
    quad(point(inner, a, hi), point(outer, a, hi), point(outer, b, hi), point(inner, b, hi));
    quad(point(inner, b, lo), point(outer, b, lo), point(outer, a, lo), point(inner, a, lo));
  }
  if (cut) for (const [a, reverse] of [[start, false], [start + length, true]]) {
    const q = [point(inner, a, -height / 2), point(outer, a, -height / 2), point(outer, a, height / 2), point(inner, a, height / 2)];
    if (reverse) q.reverse(); quad(...q);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

// Support envelope h*n+h'*t maintains physical contact with a flat translating
// follower. The same ideal lift law is used by the rendered valves and phases.
function camGeometry(fire, kind) {
  const shape = new THREE.Shape(), start = kind === 'intake' ? 360 : 180;
  for (let i = 0; i <= 240; i++) {
    const gamma = TAU * i / 240, phase = wrap(360 - 2 * gamma / DEG - fire);
    const lift = valveLift(phase, kind), derivative = phase > start && phase < start + 180 ? -2 * LIFT * Math.sin(2 * (phase - start) * DEG) : 0;
    const h = CAM_BASE + lift, y = h * Math.cos(gamma) - derivative * Math.sin(gamma), z = h * Math.sin(gamma) + derivative * Math.cos(gamma);
    if (!i) shape.moveTo(-z, y); else shape.lineTo(-z, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .006, bevelEnabled: true, bevelSize: .00025, bevelThickness: .00025, bevelSegments: 2, curveSegments: 24, steps: 1 });
  geometry.rotateY(Math.PI / 2); geometry.translate(-.003, 0, 0); return geometry;
}

function layout(spec) {
  if (spec.layout === 'W16') {
    const groups = [
      { id: 'A', label: 'A 列 · 左外', beta: -52.5, parity: 0, lane: -.009, firingOffset: 0 },
      { id: 'B', label: 'B 列 · 左内', beta: -37.5, parity: 1, lane: -.009, firingOffset: 45 },
      { id: 'C', label: 'C 列 · 右内', beta: 37.5, parity: 0, lane: .009, firingOffset: 90 },
      { id: 'D', label: 'D 列 · 右外', beta: 52.5, parity: 1, lane: .009, firingOffset: 135 }
    ];
    const cylinders = groups.flatMap(group => Array.from({ length: 4 }, (_, i) => ({ id: `${group.id}${i + 1}`, bank: group.id, index: i + 1, beta: group.beta * DEG, station: i * 2 + group.parity, lane: group.lane, fire: i * 180 + group.firingOffset })));
    const pins = Array.from({ length: 8 }, (_, station) => { const c = cylinders.find(c => c.station === station); return { x: (station - 3.5) * spec.pitch, baseAngle: c.beta - c.fire * DEG }; });
    return { groups, cylinders, pins, order: [...cylinders].sort((a, b) => a.fire - b.fire).map(c => c.id) };
  }
  const count = spec.layout === 'V12' ? 6 : 4, order = spec.layout === 'V12' ? ORDER12 : ORDER8;
  const offsets = count === 6 ? [0, 120, 240, 240, 120, 0] : [0, 180, 180, 0];
  const groups = [{ id: 'L', label: '左列', beta: -spec.bankAngle / 2, lane: -.009 }, { id: 'R', label: '右列', beta: spec.bankAngle / 2, lane: .009 }];
  const cylinders = groups.flatMap(group => Array.from({ length: count }, (_, i) => ({ id: `${group.id}${i + 1}`, bank: group.id, index: i + 1, beta: group.beta * DEG, station: i, lane: group.lane, fire: order.indexOf(`${group.id}${i + 1}`) * 720 / (count * 2) })));
  const pins = offsets.map((angle, i) => ({ x: (i - (count - 1) / 2) * spec.pitch, baseAngle: (angle - spec.bankAngle / 2) * DEG }));
  return { groups, cylinders, pins, order: [...order] };
}

/** All positions are metres; Y up, one crankshaft along X; update takes ms. */
export class BatchEngine {
  constructor(id) {
    if (!batchEngineParameters[id]) throw new Error(`未知教学发动机：${id}`);
    this.id = id; this.spec = { ...batchEngineParameters[id] }; this.plan = layout(this.spec);
    this.radius = this.spec.stroke / 2; this.head = this.spec.rod + this.radius + CROWN + .013;
    this.camY = this.head + .051 + CAM_BASE;
    this.halfSpan = this.plan.pins.length * this.spec.pitch / 2;
    this.root = new THREE.Group(); this.root.name = `${id}_complete_teaching_${this.spec.layout}`;
    this.crank = new THREE.Group(); this.crank.name = `${id}_single_shared_crankshaft`; this.root.add(this.crank);
    this.angle = 0; this.playing = false; this.speed = 'normal'; this.selectedCylinder = this.plan.cylinders[0].id;
    this._lastTime = null; this._dirty = true; this._disposed = false;
    this._meshes = []; this._cylinders = []; this._cams = []; this._pins = [];
    this._direction = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this.materials = {
      alloy: new THREE.MeshStandardMaterial({ color: '#bcc8cc', metalness: .83, roughness: .27 }),
      machined: new THREE.MeshStandardMaterial({ color: '#e1e6e4', metalness: .85, roughness: .21 }),
      steel: new THREE.MeshStandardMaterial({ color: '#778488', metalness: .88, roughness: .30 }),
      dark: new THREE.MeshStandardMaterial({ color: '#283a3d', metalness: .73, roughness: .36 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c5a775', metalness: .8, roughness: .28 }),
      black: new THREE.MeshStandardMaterial({ color: '#1b2425', metalness: .18, roughness: .5 }),
      ceramic: new THREE.MeshStandardMaterial({ color: '#edeae1', metalness: .06, roughness: .38 }),
      red: new THREE.MeshStandardMaterial({ color: '#a64132', metalness: .20, roughness: .35 }),
      spring: new THREE.MeshStandardMaterial({ color: '#455557', metalness: .83, roughness: .26 })
    };
    this.assemblyModules = this._assemblySpecs();
    this._buildCrank(); this._buildFrame();
    for (const group of this.plan.groups) this._buildRow(group);
    this._applyAngle();
  }

  _assemblySpecs() {
    const w = this.spec.layout === 'W16', camCount = this.plan.groups.length * this.spec.camsPerRow;
    const axes = w ? [[-.07, .055, -.115], [.07, .105, -.065], [-.07, .105, .065], [.07, .055, .115]] : [[0, .04, -.105], [0, .04, .105]];
    const groups = this.plan.groups.map((g, i) => ({ id: w ? `pistons-${g.id.toLowerCase()}` : g.id === 'L' ? 'pistons-left' : 'pistons-right', label: `${g.label}活塞与连杆`, color: ['#78bce6', '#ae9be3', '#87cdaa', '#ef9e88'][i], axis: axes[i], description: `${g.label}的活塞、活塞销与刚性连杆作为一个教学模块移出；缸套留在原位，两个杆端保持连接。` }));
    for (let i = 0; i < this.plan.groups.length; i++) this.plan.groups[i].assemblyGroup = groups[i].id;
    return [
      { id: 'valvetrain', label: '配气与缸盖总成', color: '#efbc72', axis: [0, .100, 0], description: `${camCount} 根教学凸轮轴、每缸 ${this.spec.valves} 个气门及其弹簧与缸盖支承共同上移。凸轮与从动件布置为原理示意。` },
      ...groups,
      { id: 'crankshaft', label: '曲轴与飞轮', color: '#8bd0ae', axis: [0, -.100, 0], description: `全部 ${this.plan.groups.length} 列活塞连杆移开后，共用曲轴、平衡块与飞轮向下移出。` }
    ];
  }

  _mesh(geometry, material, parent, name, id = null) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    if (id) mesh.userData.engineCylinder = id; parent.add(mesh); this._meshes.push(mesh); return mesh;
  }
  _cylinder(parent, radius, height, material, p, name, id = null, axis = 'y', segments = 36) {
    const mesh = this._mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material, parent, name, id); mesh.position.fromArray(p);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2; return mesh;
  }
  _ring(parent, inner, outer, height, material, p, name, id = null, axis = 'y', cut = false) {
    const mesh = this._mesh(annulus(inner, outer, height, cut), material, parent, name, id); mesh.position.fromArray(p);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2; return mesh;
  }
  _box(parent, size, material, p, name, id = null) { const mesh = this._mesh(new THREE.BoxGeometry(...size), material, parent, name, id); mesh.position.fromArray(p); return mesh; }
  _bolt(parent, p, name, id = null, axis = 'y', r = .003) {
    this._cylinder(parent, r * 1.25, .001, this.materials.steel, p, `${name}_washer`, id, axis, 20);
    const q = [...p]; q[axis === 'x' ? 0 : 1] += .0015; this._cylinder(parent, r, .003, this.materials.machined, q, name, id, axis, 6);
  }

  _buildCrank() {
    const m = this.materials, R = this.radius;
    for (let j = 0; j <= this.plan.pins.length; j++) {
      const x = (j - this.plan.pins.length / 2) * this.spec.pitch;
      this._cylinder(this.crank, .012, this.spec.pitch - .066, m.steel, [x, 0, 0], 'main_axis_between_throws', null, 'x');
      this._cylinder(this.crank, .017, .014, m.machined, [x, 0, 0], 'main_bearing_journal', null, 'x');
      this._ring(this.crank, .0169, .0178, .0012, m.gold, [x, 0, 0], 'main_journal_oil_band', null, 'x');
    }
    for (let i = 0; i < this.plan.pins.length; i++) {
      const spec = this.plan.pins[i], group = new THREE.Group(); group.name = `shared_throw_${i + 1}`; group.position.x = spec.x; group.rotation.x = spec.baseAngle; this.crank.add(group);
      const journal = this._cylinder(group, .0105, .046, m.machined, [0, R, 0], `shared_crank_pin_${i + 1}`, null, 'x'); this._pins.push({ group, journal });
      const shape = new THREE.Shape(), factor = R / .0405;
      shape.moveTo(-.018, R + .008); shape.quadraticCurveTo(0, R + .020, .018, R + .008);
      shape.lineTo(.026, -.017); shape.bezierCurveTo(.035, -.036 * factor, .026, -.057 * factor, 0, -.063 * factor);
      shape.bezierCurveTo(-.026, -.057 * factor, -.035, -.036 * factor, -.026, -.017); shape.closePath();
      for (const side of [-1, 1]) {
        const g = new THREE.ExtrudeGeometry(shape, { depth: .008, bevelEnabled: true, bevelSize: .0008, bevelThickness: .0008, bevelSegments: 2, curveSegments: 18, steps: 1 });
        g.rotateY(Math.PI / 2); g.translate(side * .028 - .004, 0, 0); this._mesh(g, m.dark, group, `balanced_crank_web_${i + 1}_${side}`);
      }
    }
    const flywheel = new THREE.Group(); flywheel.position.x = this.halfSpan + .033; this.crank.add(flywheel);
    this._ring(flywheel, .059, .076, .013, m.steel, [0, 0, 0], 'flywheel_outer_rim', null, 'x');
    this._cylinder(flywheel, .024, .021, m.dark, [0, 0, 0], 'flywheel_hub', null, 'x');
    for (let j = 0; j < 8; j++) { const a = j * TAU / 8, spoke = this._box(flywheel, [.010, .041, .011], m.steel, [0, .041 * Math.cos(a), .041 * Math.sin(a)], 'flywheel_open_spoke'); spoke.rotation.x = a; this._bolt(flywheel, [.012, .032 * Math.cos(a), .032 * Math.sin(a)], 'flywheel_fixing', null, 'x'); }
    for (let j = 0; j < 64; j++) { const a = j * TAU / 64, tooth = this._box(flywheel, [.010, .004, .004], m.machined, [0, .077 * Math.cos(a), .077 * Math.sin(a)], 'flywheel_ring_gear_tooth'); tooth.rotation.x = a; }
    this._cylinder(this.crank, .037, .019, m.dark, [-this.halfSpan - .032, 0, 0], 'front_damper', null, 'x');
    for (const d of [.027, .033, .039]) this._ring(this.crank, .035, .040, .0025, m.steel, [-this.halfSpan - d, 0, 0], 'damper_pulley_groove', null, 'x');
  }

  _buildFrame() {
    const m = this.materials;
    for (const z of [-.063, .063]) {
      this._box(this.root, [2 * this.halfSpan + .036, .012, .016], m.dark, [0, -.082, z], 'lower_crankcase_rail');
      for (const x of [-this.halfSpan, this.halfSpan]) this._box(this.root, [.026, .009, .029], m.black, [x, -.093, z], 'isolating_mount');
    }
    for (const x of [-this.halfSpan, this.halfSpan]) {
      this._ring(this.root, .019, .030, .013, m.alloy, [x, 0, 0], 'crankcase_end_bearing_carrier', null, 'x');
      for (const s of [-1, 1]) { const leg = this._box(this.root, [.014, .081, .016], m.dark, [x, -.042, s * .026], 'bearing_carrier_leg'); leg.rotation.x = -s * .3; }
    }
  }

  _buildRow(groupSpec) {
    const row = new THREE.Group(); row.name = `${groupSpec.id}_cylinder_bank`; row.rotation.x = groupSpec.beta * DEG; this.root.add(row);
    const specs = this.plan.cylinders.filter(c => c.bank === groupSpec.id), m = this.materials;
    const xs = specs.map(c => this.plan.pins[c.station].x + c.lane), rowMiddle = (xs[0] + xs.at(-1)) / 2, rowLength = xs.at(-1) - xs[0] + this.spec.bore + .024;
    for (const z of [-this.spec.bore / 2 - .002, this.spec.bore / 2 + .002]) this._box(row, [rowLength, .008, .007], m.dark, [rowMiddle, this.head + .003, z], `${groupSpec.id}_open_cylinder_head_rail`);
    const cams = {};
    for (const kind of this.spec.camsPerRow === 2 ? ['intake', 'exhaust'] : ['combined']) {
      const cam = new THREE.Group(); cam.name = `${groupSpec.id}_${kind}_camshaft`; cam.position.set(0, this.camY, kind === 'intake' ? -.023 : kind === 'exhaust' ? .023 : 0); row.add(cam);
      this._cylinder(cam, .005, rowLength + .016, m.steel, [rowMiddle, 0, 0], 'camshaft_core', null, 'x');
      for (let i = 0; i <= xs.length; i++) {
        const x = i === 0 ? xs[0] - this.spec.bore / 2 - .009 : i === xs.length ? xs.at(-1) + this.spec.bore / 2 + .009 : (xs[i - 1] + xs[i]) / 2;
        this._ring(row, .0065, .010, .007, m.gold, [x, this.camY, cam.position.z], 'camshaft_stationary_bearing', null, 'x');
        this._box(row, [.008, .024, .008], m.dark, [x, this.camY - .018, cam.position.z], 'camshaft_bearing_pedestal');
      }
      cams[kind] = cam; this._cams.push(cam);
    }
    for (const spec of specs) this._buildCylinder(spec, groupSpec, row, cams);
  }

  _buildCylinder(spec, groupSpec, row, cams) {
    const m = this.materials, r = this.spec.bore / 2, rodLength = this.spec.rod, x = this.plan.pins[spec.station].x + spec.lane;
    const assembly = new THREE.Group(); assembly.name = `${spec.id}_sectioned_cylinder`; assembly.position.x = x; row.add(assembly);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#9bcedb', transparent: true, opacity: .08, roughness: .17, metalness: .04, side: THREE.DoubleSide, depthWrite: false });
    const accent = m.gold.clone(), rodMat = m.alloy.clone(), bottom = rodLength - this.radius - .022, top = this.head - .004;
    this._ring(assembly, r, r + .0032, top - bottom, glass, [0, (top + bottom) / 2, 0], `${spec.id}_cutaway_liner`, spec.id, 'y', true).castShadow = false;
    for (const y of [bottom, top]) this._ring(assembly, r, r + .0035, .002, accent, [0, y, 0], `${spec.id}_liner_section_edge`, spec.id, 'y', true);
    this._ring(assembly, r - .006, r + .005, .004, m.alloy, [0, this.head + .001, 0], `${spec.id}_open_head_seat`, spec.id);
    for (const dx of [-r * .76, r * .76]) this._bolt(assembly, [dx, this.head + .004, -.024], `${spec.id}_head_fastener`, spec.id);
    const piston = new THREE.Group(); piston.name = `${spec.id}_piston`; assembly.add(piston);
    this._cylinder(piston, r - .0007, .006, m.machined, [0, .015, 0], `${spec.id}_piston_crown`, spec.id);
    this._ring(piston, r - .0065, r - .0011, .027, m.alloy, [0, -.0015, 0], `${spec.id}_open_piston_skirt`, spec.id, 'y', true);
    for (const y of [.0105, .0065, .0015]) this._ring(piston, r - .0017, r - .0003, .0014, m.steel, [0, y, 0], `${spec.id}_piston_ring`, spec.id);
    this._cylinder(piston, .0057, this.spec.bore - .002, m.machined, [0, 0, 0], `${spec.id}_wrist_pin`, spec.id, 'x');
    for (const dx of [-r * .68, r * .68]) this._ring(piston, .0059, .010, .010, m.alloy, [dx, 0, 0], `${spec.id}_wrist_pin_boss`, spec.id, 'x');
    const rod = new THREE.Group(); rod.name = `${spec.id}_rigid_connecting_rod`; this.root.add(rod);
    this._ring(rod, .0108, .017, .009, rodMat, [0, 0, 0], `${spec.id}_big_end`, spec.id, 'x');
    this._ring(rod, .01055, .0112, .0091, m.gold, [0, 0, 0], `${spec.id}_big_end_bearing`, spec.id, 'x');
    this._ring(rod, .0059, .0106, .008, rodMat, [0, rodLength, 0], `${spec.id}_small_end`, spec.id, 'x');
    this._ring(rod, .00575, .0063, .0082, m.gold, [0, rodLength, 0], `${spec.id}_small_end_bushing`, spec.id, 'x');
    const web = new THREE.Shape(); web.moveTo(-.009, .013); web.quadraticCurveTo(-.005, .04, -.004, rodLength * .50); web.lineTo(-.005, rodLength - .010); web.lineTo(.005, rodLength - .010); web.lineTo(.004, rodLength * .50); web.quadraticCurveTo(.005, .04, .009, .013); web.closePath();
    const webGeometry = new THREE.ExtrudeGeometry(web, { depth: .003, bevelEnabled: true, bevelSize: .0004, bevelThickness: .0003, bevelSegments: 2, curveSegments: 12 }); webGeometry.rotateY(Math.PI / 2); webGeometry.translate(-.0015, 0, 0); this._mesh(webGeometry, rodMat, rod, `${spec.id}_rod_web`, spec.id);
    for (const dx of [-.0032, .0032]) this._box(rod, [.002, rodLength - .027, .008], rodMat, [dx, rodLength / 2 + .003, 0], `${spec.id}_rod_flange`, spec.id);
    for (const dz of [-.0127, .0127]) this._bolt(rod, [0, -.006, dz], `${spec.id}_rod_cap_bolt`, spec.id, 'x', .0025);
    const gasMat = new THREE.MeshBasicMaterial({ color: STAGES[0].stageColor, transparent: true, opacity: .09, side: THREE.DoubleSide, depthWrite: false });
    const gas = this._cylinder(assembly, r - .006, 1, gasMat, [0, .17, 0], `${spec.id}_working_volume`, spec.id); gas.castShadow = false; gas.receiveShadow = false; gas.renderOrder = 1;
    const spark = this._mesh(new THREE.SphereGeometry(.005, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff2b8', transparent: true, opacity: .9, depthWrite: false }), assembly, `${spec.id}_ignition_flash`, spec.id); spark.position.set(0, this.head - .003, 0); spark.castShadow = false;
    this._cylinder(assembly, .0033, .030, m.machined, [0, this.head + .020, 0], `${spec.id}_spark_plug_body`, spec.id);
    this._cylinder(assembly, .0045, .016, m.ceramic, [0, this.head + .044, 0], `${spec.id}_spark_plug_ceramic`, spec.id);
    this._cylinder(assembly, .004, .008, m.red, [0, this.head + .056, 0], `${spec.id}_ignition_terminal`, spec.id);
    const valveSpecs = this.spec.valves === 3 ? [{ kind: 'intake', dx: -.017, dz: -.015, radius: .010 }, { kind: 'intake', dx: .017, dz: -.015, radius: .010 }, { kind: 'exhaust', dx: 0, dz: .022, radius: .013 }] : ['intake', 'exhaust'].flatMap(kind => [-.015, .015].map(dx => ({ kind, dx, dz: kind === 'intake' ? -.023 : .023, radius: .009 })));
    const valves = [];
    for (let i = 0; i < valveSpecs.length; i++) {
      const { kind, dx, dz, radius } = valveSpecs[i], valve = new THREE.Group(); valve.position.set(dx, this.head, dz); assembly.add(valve);
      this._cylinder(valve, radius, .002, m.machined, [0, 0, 0], `${spec.id}_${kind}_valve_head`, spec.id);
      this._cylinder(valve, .0021, .047, m.steel, [0, .0235, 0], `${spec.id}_${kind}_valve_stem`, spec.id);
      this._ring(valve, .0023, .0065, .002, m.steel, [0, .040, 0], `${spec.id}_${kind}_spring_retainer`, spec.id);
      this._ring(assembly, radius + .0002, radius + .002, .002, m.gold, [dx, this.head + .001, dz], `${spec.id}_${kind}_valve_seat`, spec.id);
      const cam = cams[kind] || cams.combined, single = this.spec.camsPerRow === 1;
      const camX = single ? x + (i - (valveSpecs.length - 1) / 2) * .016 : x + dx;
      const followerX = camX - x - dx, followerZ = cam.position.z - dz;
      this._box(valve, [.010, .004, .018], m.machined, [followerX, .049, followerZ], `${spec.id}_${kind}_flat_cam_follower`, spec.id);
      if (single) {
        const bridge = this._box(valve, [Math.max(.008, Math.abs(followerX) + .008), .004, Math.abs(followerZ) + .008], m.steel, [followerX / 2, .044, followerZ / 2], `${spec.id}_${kind}_offset_follower_bridge`, spec.id); bridge.userData.teaching = true;
      }
      const lobe = this._mesh(camGeometry(spec.fire, kind), m.machined, cam, `${spec.id}_${kind}_cam_lobe_${i}`, spec.id); lobe.position.x = camX;
      const springPoints = Array.from({ length: 73 }, (_, j) => { const t = j / 72, a = TAU * 4.5 * t; return new THREE.Vector3(.0052 * Math.cos(a), .024 * t, .0052 * Math.sin(a)); });
      const spring = this._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 72, .0007, 6, false), m.spring, assembly, `${spec.id}_${kind}_valve_spring`, spec.id); spring.position.set(dx, this.head + .016, dz);
      valves.push({ kind, valve, spring, cam, lobe, followerX, followerZ });
    }
    this._cylinders.push({ ...spec, x, assemblyGroup: groupSpec.assemblyGroup, piston, rod, gas, spark, accent, rodMat, glass, valves, row,
      axis: new THREE.Vector3(0, Math.cos(spec.beta), Math.sin(spec.beta)), pistonPosition: new THREE.Vector3(), crankPin: new THREE.Vector3(), phase: 0, stageIndex: 0, intakeLift: 0, exhaustLift: 0, sparkOn: false });
  }

  _applyAngle() {
    const theta = this.angle * DEG, R = this.radius, length = this.spec.rod;
    this.crank.rotation.x = theta; for (const cam of this._cams) cam.rotation.x = theta / 2;
    for (const c of this._cylinders) {
      const alpha = theta + this.plan.pins[c.station].baseAngle, phi = alpha - c.beta;
      const axial = R * Math.cos(phi) + Math.sqrt(length * length - R * R * Math.sin(phi) ** 2);
      c.crankPin.set(c.x, R * Math.cos(alpha), R * Math.sin(alpha)); c.pistonPosition.copy(c.axis).multiplyScalar(axial); c.pistonPosition.x = c.x;
      c.piston.position.y = axial; c.rod.position.copy(c.crankPin); c.rod.quaternion.setFromUnitVectors(this._up, this._direction.subVectors(c.pistonPosition, c.crankPin).normalize());
      c.phase = wrap(this.angle - c.fire); c.stageIndex = Math.floor(c.phase / 180); c.intakeLift = valveLift(c.phase, 'intake'); c.exhaustLift = valveLift(c.phase, 'exhaust');
      for (const { kind, valve, spring } of c.valves) { const lift = kind === 'intake' ? c.intakeLift : c.exhaustLift; valve.position.y = this.head - lift; spring.scale.y = (.024 - lift) / .024; }
      c.gas.position.y = (this.head + axial + CROWN) / 2; c.gas.scale.y = Math.max(.001, this.head - axial - CROWN);
      const selected = c.id === this.selectedCylinder;
      c.gas.material.color.set(STAGES[c.stageIndex].stageColor); c.gas.material.opacity = selected ? .22 : .07; c.glass.opacity = selected ? .13 : .06;
      c.accent.color.set(selected ? '#ead199' : '#657c81'); c.accent.emissive.set(selected ? '#32280f' : '#000000'); c.accent.emissiveIntensity = selected ? .32 : 0; c.rodMat.color.set(selected ? '#dbc69e' : '#aab9bd');
      c.sparkOn = c.phase < Math.min(14, 720 / this._cylinders.length / 3); c.spark.visible = c.sparkOn; c.spark.scale.setScalar(.65 + .55 * (1 - Math.min(1, c.phase / 14)));
    }
    this.root.updateMatrixWorld(true); this._dirty = true;
  }
  setAngle(degrees) { if (!Number.isFinite(degrees)) throw new Error('曲轴角度必须是有限数值'); if (!this._disposed) { this.angle = Math.max(0, Math.min(720, degrees)); this._lastTime = null; this._applyAngle(); } return this; }
  setPlaying(value) { if (!this._disposed && Boolean(value) !== this.playing) { this.playing = Boolean(value); this._lastTime = null; this._dirty = true; } return this; }
  setSpeed(speed) { if (!['slow', 'normal'].includes(speed)) throw new Error(`未知教学速度：${speed}`); if (!this._disposed && speed !== this.speed) { this.speed = speed; this._lastTime = null; this._dirty = true; } return this; }
  selectCylinder(id) { if (!this._cylinders.some(c => c.id === id)) throw new Error(`未知气缸：${id}`); if (!this._disposed && this.selectedCylinder !== id) { this.selectedCylinder = id; this._applyAngle(); } return this; }
  get isAnimating() { return this.playing && !this._disposed; }
  update(now = performance.now()) {
    if (this._disposed) return false;
    if (this.playing && Number.isFinite(now)) { if (this._lastTime !== null) { const elapsed = Math.max(0, (now - this._lastTime) / 1000); if (elapsed) { this.angle = wrap(this.angle + elapsed * (this.speed === 'slow' ? 45 : 90)); this._applyAngle(); } } this._lastTime = now; }
    const dirty = this._dirty; this._dirty = false; return dirty;
  }
  getState() {
    return { angle: this.angle, crankAngle: wrap(this.angle, 360), camAngle: wrap(this.angle / 2, 360), playing: this.playing, speed: this.speed, selectedCylinder: this.selectedCylinder, firingOrder: [...this.plan.order],
      cylinderGroups: this.plan.groups.map(g => ({ id: g.id, label: g.label, cylinders: this._cylinders.filter(c => c.bank === g.id).map(c => c.id) })),
      parameters: { bore: this.spec.bore, stroke: this.spec.stroke, crankRadius: this.radius, rodLength: this.spec.rod, bankAngle: this.spec.bankAngle, innerBankAngle: this.spec.innerBankAngle || null, rowAngles: this.plan.groups.map(g => g.beta), cylinderCount: this._cylinders.length, valvesPerCylinder: this.spec.valves, camshaftCount: this._cams.length, firingInterval: 720 / this._cylinders.length, crankshaftCount: 1, crankPinCount: this.plan.pins.length, headPlane: this.head, crownHeight: CROWN, maxValveLift: LIFT, teachingInternals: true, cycleSeconds: this.speed === 'slow' ? 16 : 8 },
      teachingNote: '教学缸号与示例点火顺序；连杆长度、曲柄相位、缸列错位、凸轮从动件和理想配气时序为原理示意，并非原厂内部结构或控制标定。',
      cylinders: this._cylinders.map(c => ({ id: c.id, bank: c.bank, index: c.index, phase: c.phase, ...STAGES[c.stageIndex], selected: c.id === this.selectedCylinder, firingAngle: c.fire, crankStation: c.station, pistonPosition: c.pistonPosition.toArray(), crankPin: c.crankPin.toArray(), cylinderAxis: c.axis.toArray(), rodLength: c.pistonPosition.distanceTo(c.crankPin), intakeLift: c.intakeLift, exhaustLift: c.exhaustLift, spark: c.sparkOn })) };
  }
  pick(raycaster) {
    if (this._disposed) return null; this.root.updateWorldMatrix(true, true);
    const visible = mesh => { for (let n = mesh; n; n = n.parent) if (!n.visible) return false; return true; };
    return raycaster.intersectObjects(this._meshes, false).find(hit => visible(hit.object))?.object.userData.engineCylinder || null;
  }
  dispose() {
    if (this._disposed) return;
    const geometries = new Set(), materials = new Set(Object.values(this.materials));
    for (const mesh of this._meshes) { geometries.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material); }
    for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
    this.root.removeFromParent(); this.root.clear(); this._meshes.length = 0; this._cylinders.length = 0; this._cams.length = 0; this._pins.length = 0; this.playing = false; this._disposed = true; this._lastTime = null;
  }
}

export class McLaren720SEngine extends BatchEngine { constructor() { super('mclaren720s'); } }
export class Porsche918Engine extends BatchEngine { constructor() { super('porsche918'); } }
export class HuayraEngine extends BatchEngine { constructor() { super('huayra'); } }
export class ChironEngine extends BatchEngine { constructor() { super('chiron'); } }
export class JeskoEngine extends BatchEngine { constructor() { super('jesko'); } }

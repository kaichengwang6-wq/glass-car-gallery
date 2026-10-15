import * as THREE from 'three';

// Independent teaching mechanism. L/R identifiers, rod length and valve timing
// are illustrative; they are not a claim about Ferrari's production firing order.
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const R = .0405, BORE = .092, ROD = .140, PITCH = .110;
const HEAD = .2115, CROWN = .018, LIFT = .0025, CAM_BASE = .021;
const CAM_Y = HEAD + .051 + CAM_BASE;
const OFFSETS = [0, 180, 180, 0];
const ORDER = ['L1', 'R1', 'L2', 'R2', 'L4', 'R4', 'L3', 'R3'];
const STAGES = [
  { stage: '做功', stageColor: '#f2aa54', description: '上止点附近点火；膨胀推动活塞下行，连杆将力传给曲轴。进、排气门关闭。' },
  { stage: '排气', stageColor: '#e36e70', description: '排气门打开，活塞向上运动，把燃烧后的气体推出气缸。' },
  { stage: '进气', stageColor: '#64b7ec', description: '进气门打开，活塞向下运动，示意新鲜充量进入气缸。' },
  { stage: '压缩', stageColor: '#a79aea', description: '进、排气门关闭，活塞向上运动并压缩缸内气体，准备下一次点火。' }
];
const wrap = (n, period = 720) => ((n % period) + period) % period;

function valveLift(phase, kind) {
  const start = kind === 'intake' ? 360 : 180;
  if (phase <= start || phase >= start + 180) return 0;
  const t = (phase - start) * DEG;
  return LIFT * Math.sin(t) ** 2;
}

function annulusGeometry(inner, outer, height, start = 0, length = TAU, segments = 72) {
  const vertices = [], indices = [];
  const putQuad = (a, b, c, d) => {
    const offset = vertices.length / 3;
    vertices.push(...a, ...b, ...c, ...d);
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };
  const point = (radius, angle, y) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];
  for (let i = 0; i < segments; i++) {
    const a = start + length * i / segments, b = start + length * (i + 1) / segments;
    const lo = -height / 2, hi = height / 2;
    putQuad(point(outer, a, lo), point(outer, b, lo), point(outer, b, hi), point(outer, a, hi));
    putQuad(point(inner, b, lo), point(inner, a, lo), point(inner, a, hi), point(inner, b, hi));
    putQuad(point(inner, a, hi), point(outer, a, hi), point(outer, b, hi), point(inner, b, hi));
    putQuad(point(inner, b, lo), point(outer, b, lo), point(outer, a, lo), point(inner, a, lo));
  }
  if (length < TAU - 1e-6) {
    for (const [angle, reverse] of [[start, false], [start + length, true]]) {
      const points = [point(inner, angle, -height / 2), point(outer, angle, -height / 2), point(outer, angle, height / 2), point(inner, angle, height / 2)];
      if (reverse) points.reverse();
      putQuad(...points);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// A flat translating follower contacts the support envelope h*n + h'*t.
// This builds a real cam profile from the same lift function that moves valves.
function camGeometry(firingAngle, kind) {
  const shape = new THREE.Shape();
  const start = kind === 'intake' ? 360 : 180;
  for (let i = 0; i <= 240; i++) {
    const gamma = TAU * i / 240;
    const phase = wrap(360 - 2 * gamma / DEG - firingAngle);
    const lift = valveLift(phase, kind);
    const derivative = phase > start && phase < start + 180 ? -2 * LIFT * Math.sin(2 * (phase - start) * DEG) : 0;
    const h = CAM_BASE + lift;
    const y = h * Math.cos(gamma) - derivative * Math.sin(gamma);
    const z = h * Math.sin(gamma) + derivative * Math.cos(gamma);
    if (i === 0) shape.moveTo(-z, y); else shape.lineTo(-z, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .007, bevelEnabled: true, bevelSize: .00035, bevelThickness: .00035, bevelSegments: 2, steps: 1 });
  geometry.rotateY(Math.PI / 2); geometry.translate(-.0035, 0, 0);
  return geometry;
}

/** Complete 90-degree flat-plane V8 teaching model, metres, Y up, crank along X. */
export class V8Engine {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'teaching_flat_plane_v8';
    this.angle = 0;
    this.playing = false;
    this.speed = 'normal';
    this.selectedCylinder = 'L1';
    this._lastTime = null;
    this._dirty = true;
    this._disposed = false;
    this._cylinders = [];
    this._cams = [];
    this._meshes = [];
    this._quaternion = new THREE.Quaternion();
    this._direction = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this.materials = {
      alloy: new THREE.MeshStandardMaterial({ color: '#bcc8cc', metalness: .83, roughness: .27 }),
      machined: new THREE.MeshStandardMaterial({ color: '#e1e6e4', metalness: .85, roughness: .21 }),
      steel: new THREE.MeshStandardMaterial({ color: '#778488', metalness: .88, roughness: .30 }),
      dark: new THREE.MeshStandardMaterial({ color: '#283a3d', metalness: .73, roughness: .36 }),
      recess: new THREE.MeshStandardMaterial({ color: '#142629', metalness: .51, roughness: .44 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c5a775', metalness: .8, roughness: .28 }),
      black: new THREE.MeshStandardMaterial({ color: '#1b2425', metalness: .18, roughness: .5 }),
      ceramic: new THREE.MeshStandardMaterial({ color: '#edeae1', metalness: .06, roughness: .38 }),
      red: new THREE.MeshStandardMaterial({ color: '#a64132', metalness: .20, roughness: .35 }),
      spring: new THREE.MeshStandardMaterial({ color: '#455557', metalness: .83, roughness: .26 })
    };
    this.crank = new THREE.Group(); this.crank.name = 'complete_flat_plane_crankshaft'; this.root.add(this.crank);
    this._buildCrank();
    this._buildFrame();
    for (const bank of ['L', 'R']) this._buildBank(bank);
    this._applyAngle();
  }

  _mesh(geometry, material, parent, name, id = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    if (id) mesh.userData.engineCylinder = id;
    parent.add(mesh); this._meshes.push(mesh); return mesh;
  }

  _cylinder(parent, radius, height, material, position, name, id = null, axis = 'y', segments = 48) {
    const mesh = this._mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material, parent, name, id);
    mesh.position.fromArray(position);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  _ring(parent, inner, outer, height, material, position, name, id = null, axis = 'y', cut = false) {
    const geometry = annulusGeometry(inner, outer, height, cut ? Math.PI / 3 : 0, cut ? Math.PI * 4 / 3 : TAU);
    const mesh = this._mesh(geometry, material, parent, name, id);
    mesh.position.fromArray(position);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  _box(parent, size, material, position, name, id = null) {
    const mesh = this._mesh(new THREE.BoxGeometry(...size), material, parent, name, id);
    mesh.position.fromArray(position); return mesh;
  }

  _bolt(parent, position, name, id = null, axis = 'y', radius = .0035) {
    this._cylinder(parent, radius * 1.24, .0011, this.materials.steel, position, `${name}_washer`, id, axis, 24);
    const raised = [...position]; raised[{ x: 0, y: 1, z: 2 }[axis]] += .0015;
    this._cylinder(parent, radius, .003, this.materials.machined, raised, name, id, axis, 6);
  }

  _buildCrank() {
    const m = this.materials;
    for (const x of [-.22, -.11, 0, .11, .22]) {
      // Main-axis metal exists only between adjacent crank webs. A continuous
      // shaft through the crank throws would cut through rods at bottom dead centre.
      this._cylinder(this.crank, .012, .072, m.steel, [x, 0, 0], 'main_axis_between_throws', null, 'x');
      this._cylinder(this.crank, .017, .025, m.machined, [x, 0, 0], 'main_bearing_journal', null, 'x');
      for (const d of [-.010, .010]) this._ring(this.crank, .0168, .0177, .0013, m.gold, [x + d, 0, 0], 'main_journal_oil_band', null, 'x');
    }
    for (let index = 0; index < 4; index++) {
      const x = (index - 1.5) * PITCH;
      const throwGroup = new THREE.Group(); throwGroup.position.x = x; throwGroup.rotation.x = OFFSETS[index] * DEG;
      this.crank.add(throwGroup);
      this._cylinder(throwGroup, .0105, .037, m.machined, [0, R, 0], `crank_pin_${index + 1}`, null, 'x');
      const shape = new THREE.Shape();
      shape.moveTo(-.018, .049); shape.quadraticCurveTo(0, .061, .018, .049);
      shape.lineTo(.026, -.017); shape.bezierCurveTo(.035, -.036, .026, -.057, 0, -.063);
      shape.bezierCurveTo(-.026, -.057, -.035, -.036, -.026, -.017); shape.closePath();
      for (const side of [-1, 1]) {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: .009, bevelEnabled: true, bevelSize: .0012, bevelThickness: .0012, bevelSegments: 3, curveSegments: 24, steps: 1 });
        geometry.rotateY(Math.PI / 2); geometry.translate(side * .024 - .0045, 0, 0);
        this._mesh(geometry, m.dark, throwGroup, `balanced_crank_web_${index + 1}_${side}`);
        this._cylinder(throwGroup, .008, .002, m.steel, [side * .030, -.034, 0], 'counterweight_machined_face', null, 'x');
      }
    }
    const flywheel = new THREE.Group(); flywheel.position.x = .253; this.crank.add(flywheel);
    this._ring(flywheel, .059, .076, .013, m.steel, [0, 0, 0], 'flywheel_outer_rim', null, 'x');
    this._cylinder(flywheel, .025, .021, m.dark, [0, 0, 0], 'flywheel_hub', null, 'x');
    for (let i = 0; i < 8; i++) {
      const a = TAU * i / 8;
      const spoke = this._box(flywheel, [.010, .042, .012], m.steel, [0, .041 * Math.cos(a), .041 * Math.sin(a)], 'flywheel_open_spoke');
      spoke.rotation.x = a;
      this._bolt(flywheel, [.012, .032 * Math.cos(a), .032 * Math.sin(a)], 'flywheel_fixing', null, 'x', .003);
    }
    for (let i = 0; i < 64; i++) {
      const a = TAU * i / 64;
      const tooth = this._box(flywheel, [.010, .004, .004], m.machined, [0, .077 * Math.cos(a), .077 * Math.sin(a)], 'flywheel_ring_gear_tooth');
      tooth.rotation.x = a;
    }
    this._cylinder(this.crank, .037, .019, m.dark, [-.252, 0, 0], 'front_damper', null, 'x');
    for (const x of [-.259, -.253, -.247]) this._ring(this.crank, .035, .040, .0025, m.steel, [x, 0, 0], 'damper_pulley_groove', null, 'x');
    this._bolt(this.crank, [-.266, 0, 0], 'crank_central_bolt', null, 'x', .009);
  }

  _buildFrame() {
    const m = this.materials;
    for (const z of [-.060, .060]) {
      this._box(this.root, [.476, .012, .016], m.dark, [0, -.078, z], 'lower_crankcase_rail');
      for (const x of [-.227, .227]) this._box(this.root, [.026, .009, .029], m.black, [x, -.089, z], 'isolating_mount');
    }
    for (const x of [-.224, .224]) {
      const bracket = this._ring(this.root, .019, .031, .013, m.alloy, [x, 0, 0], 'crankcase_end_bearing_carrier', null, 'x');
      for (const z of [-.043, .043]) {
        const strut = this._box(this.root, [.014, .080, .016], m.dark, [x, -.040, z * .55], 'bearing_carrier_leg');
        strut.rotation.x = z > 0 ? -.30 : .30;
        this._bolt(this.root, [x, -.069, z], 'crankcase_mount_bolt');
      }
      bracket.userData.structural = true;
    }
  }

  _buildBank(bank) {
    const beta = (bank === 'L' ? -45 : 45) * DEG;
    const offsetX = bank === 'L' ? -.008 : .008;
    const bankRoot = new THREE.Group(); bankRoot.name = `${bank}_cylinder_bank`; bankRoot.rotation.x = beta;
    this.root.add(bankRoot);
    const m = this.materials;
    for (const z of [-.0505, .0505]) {
      this._box(bankRoot, [.447, .008, .009], m.dark, [offsetX, HEAD + .003, z], `${bank}_open_cylinder_head_rail`);
    }
    for (const kind of ['intake', 'exhaust']) {
      const cam = new THREE.Group(); cam.name = `${bank}_${kind}_camshaft`;
      cam.position.set(offsetX, CAM_Y, kind === 'intake' ? -.026 : .026);
      bankRoot.add(cam);
      this._cylinder(cam, .005, .466, m.steel, [0, 0, 0], 'camshaft_core', null, 'x');
      for (const x of [-.214, -.11, 0, .11, .214]) {
        this._ring(bankRoot, .0065, .011, .008, m.gold, [x + offsetX, CAM_Y, cam.position.z], 'camshaft_stationary_bearing', null, 'x');
        this._box(bankRoot, [.009, .027, .009], m.dark, [x + offsetX, CAM_Y - .020, cam.position.z], 'camshaft_bearing_pedestal');
      }
      this._cams.push(cam);
      for (let index = 0; index < 4; index++) {
        const id = `${bank}${index + 1}`, fire = ORDER.indexOf(id) * 90;
        for (const dx of [-.015, .015]) {
          const lobe = this._mesh(camGeometry(fire, kind), m.machined, cam, `${id}_${kind}_cam_lobe`, id);
          lobe.position.x = (index - 1.5) * PITCH + dx;
        }
      }
      this._cylinder(cam, .017, .007, m.dark, [-.237, 0, 0], 'cam_phase_disc', null, 'x');
      this._bolt(cam, [-.242, .010, 0], 'cam_phase_marker', null, 'x', .0024);
    }

    for (let index = 0; index < 4; index++) {
      const id = `${bank}${index + 1}`, x = (index - 1.5) * PITCH + offsetX;
      const assembly = new THREE.Group(); assembly.name = `${id}_sectioned_cylinder`; assembly.position.x = x; bankRoot.add(assembly);
      const glass = new THREE.MeshPhysicalMaterial({ color: '#9bcedb', transparent: true, opacity: .105, roughness: .17, metalness: .04, side: THREE.DoubleSide, depthWrite: false, clearcoat: .35 });
      const accent = m.gold.clone();
      const rodMat = m.alloy.clone();
      const liner = this._ring(assembly, BORE / 2, BORE / 2 + .0033, .133, glass, [0, .1425, 0], `${id}_cutaway_liner`, id, 'y', true);
      liner.castShadow = false;
      for (const y of [.077, .207]) this._ring(assembly, .046, .0498, .002, accent, [0, y, 0], `${id}_liner_section_edge`, id, 'y', true);
      for (const sign of [-1, 1]) {
        const a = sign * Math.PI / 3;
        const seam = this._cylinder(assembly, .0011, .132, accent, [.048 * Math.sin(a), .1425, .048 * Math.cos(a)], `${id}_liner_cut_edge`, id);
        seam.castShadow = false;
      }
      this._ring(assembly, .0405, .052, .005, m.alloy, [0, HEAD + .001, 0], `${id}_open_head_seat`, id);
      for (const dx of [-.038, .038]) this._bolt(assembly, [dx, HEAD + .004, -.029], `${id}_head_fastener`, id);

      const piston = new THREE.Group(); piston.name = `${id}_piston`; assembly.add(piston);
      this._cylinder(piston, .0453, .006, m.machined, [0, .015, 0], `${id}_piston_crown`, id);
      this._ring(piston, .0395, .0449, .027, m.alloy, [0, -.0015, 0], `${id}_open_piston_skirt`, id, 'y', true);
      for (const y of [.0105, .0065, .0015]) {
        this._ring(piston, .0443, .0457, .0015, m.steel, [0, y, 0], `${id}_piston_ring`, id);
        this._ring(piston, .0440, .0451, .0007, m.recess, [0, y - .0012, 0], `${id}_ring_groove`, id);
      }
      this._cylinder(piston, .0057, .090, m.machined, [0, 0, 0], `${id}_wrist_pin`, id, 'x');
      for (const dx of [-.031, .031]) this._ring(piston, .0059, .0101, .011, m.alloy, [dx, 0, 0], `${id}_wrist_pin_boss`, id, 'x');
      // The crown reliefs are inset dark circular machining marks, not moving valves.
      for (const dx of [-.014, .014]) for (const dz of [-.017, .017]) {
        this._cylinder(piston, .008, .00035, m.steel, [dx, CROWN + .0001, dz], `${id}_crown_relief`, id, 'y', 32);
      }

      const rod = new THREE.Group(); rod.name = `${id}_rigid_connecting_rod`; this.root.add(rod);
      this._ring(rod, .0108, .0172, .009, rodMat, [0, 0, 0], `${id}_big_end`, id, 'x');
      this._ring(rod, .01055, .0112, .0091, m.gold, [0, 0, 0], `${id}_big_end_bearing`, id, 'x');
      this._ring(rod, .0059, .0106, .008, rodMat, [0, ROD, 0], `${id}_small_end`, id, 'x');
      this._ring(rod, .00575, .0063, .0082, m.gold, [0, ROD, 0], `${id}_small_end_bushing`, id, 'x');
      // A bevelled web plus two shallow flanges gives an actual I-section.
      const webShape = new THREE.Shape();
      webShape.moveTo(-.010, .012); webShape.quadraticCurveTo(-.006, .032, -.0045, .066);
      webShape.lineTo(-.0042, .125); webShape.lineTo(-.0065, .136); webShape.lineTo(.0065, .136);
      webShape.lineTo(.0042, .125); webShape.lineTo(.0045, .066); webShape.quadraticCurveTo(.006, .032, .010, .012); webShape.closePath();
      const webGeometry = new THREE.ExtrudeGeometry(webShape, { depth: .003, bevelEnabled: true, bevelSize: .00055, bevelThickness: .0004, bevelSegments: 2, curveSegments: 16, steps: 1 });
      webGeometry.rotateY(Math.PI / 2); webGeometry.translate(-.0015, 0, 0);
      this._mesh(webGeometry, rodMat, rod, `${id}_rod_web`, id);
      for (const dx of [-.0032, .0032]) this._box(rod, [.002, .113, .009], rodMat, [dx, .075, 0], `${id}_rod_flange`, id);
      for (const dz of [-.0127, .0127]) this._bolt(rod, [0, -.006, dz], `${id}_rod_cap_bolt`, id, 'x', .0028);

      const gasMat = new THREE.MeshBasicMaterial({ color: STAGES[0].stageColor, transparent: true, opacity: .115, side: THREE.DoubleSide, depthWrite: false });
      const gas = this._cylinder(assembly, .040, 1, gasMat, [0, .17, 0], `${id}_working_volume`, id);
      gas.castShadow = false; gas.receiveShadow = false; gas.renderOrder = 1;
      const sparkMat = new THREE.MeshBasicMaterial({ color: '#fff2b8', transparent: true, opacity: .9, depthWrite: false });
      const spark = this._mesh(new THREE.SphereGeometry(.006, 16, 12), sparkMat, assembly, `${id}_ignition_flash`, id);
      spark.position.set(0, HEAD - .003, 0); spark.castShadow = false; spark.visible = false;
      this._cylinder(assembly, .0033, .030, m.machined, [0, HEAD + .020, 0], `${id}_spark_plug_body`, id);
      this._cylinder(assembly, .0045, .016, m.ceramic, [0, HEAD + .044, 0], `${id}_spark_plug_ceramic`, id);
      this._cylinder(assembly, .004, .008, m.red, [0, HEAD + .056, 0], `${id}_ignition_terminal`, id);

      const valves = [];
      for (const kind of ['intake', 'exhaust']) for (const dx of [-.015, .015]) {
        const dz = kind === 'intake' ? -.026 : .026;
        const valve = new THREE.Group(); valve.position.set(dx, HEAD, dz); assembly.add(valve);
        this._cylinder(valve, .009, .002, m.machined, [0, 0, 0], `${id}_${kind}_valve_head`, id);
        this._cylinder(valve, .0021, .047, m.steel, [0, .0235, 0], `${id}_${kind}_valve_stem`, id);
        this._box(valve, [.010, .004, .018], m.machined, [0, .049, 0], `${id}_${kind}_flat_cam_follower`, id);
        this._ring(valve, .0023, .007, .002, m.steel, [0, .040, 0], `${id}_${kind}_spring_retainer`, id);
        this._ring(assembly, .0092, .011, .002, m.gold, [dx, HEAD + .001, dz], `${id}_${kind}_valve_seat`, id);
        const springPoints = [];
        for (let step = 0; step <= 112; step++) {
          const t = step / 112, a = TAU * 4.5 * t;
          springPoints.push(new THREE.Vector3(.0053 * Math.cos(a), .024 * t, .0053 * Math.sin(a)));
        }
        const springGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 112, .00075, 7, false);
        const spring = this._mesh(springGeometry, m.spring, assembly, `${id}_${kind}_valve_spring`, id);
        spring.position.set(dx, HEAD + .016, dz);
        valves.push({ valve, spring, kind });
      }
      this._cylinders.push({ id, bank, index: index + 1, beta, delta: OFFSETS[index], fire: ORDER.indexOf(id) * 90,
        x, piston, rod, gas, spark, accent, rodMat, glass, valves,
        axis: new THREE.Vector3(0, Math.cos(beta), Math.sin(beta)),
        pistonPosition: new THREE.Vector3(), crankPin: new THREE.Vector3(), phase: 0, stageIndex: 0, intakeLift: 0, exhaustLift: 0, sparkOn: false });
    }
  }

  _applyAngle() {
    const theta = this.angle * DEG;
    this.crank.rotation.x = theta - Math.PI / 4;
    for (const cam of this._cams) cam.rotation.x = theta / 2;
    for (const cylinder of this._cylinders) {
      const alpha = theta - Math.PI / 4 + cylinder.delta * DEG;
      const phi = alpha - cylinder.beta;
      const axial = R * Math.cos(phi) + Math.sqrt(ROD * ROD - R * R * Math.sin(phi) ** 2);
      cylinder.crankPin.set(cylinder.x, R * Math.cos(alpha), R * Math.sin(alpha));
      cylinder.pistonPosition.copy(cylinder.axis).multiplyScalar(axial); cylinder.pistonPosition.x = cylinder.x;
      cylinder.piston.position.y = axial;
      cylinder.rod.position.copy(cylinder.crankPin);
      this._direction.subVectors(cylinder.pistonPosition, cylinder.crankPin).normalize();
      cylinder.rod.quaternion.setFromUnitVectors(this._up, this._direction);
      cylinder.phase = wrap(this.angle - cylinder.fire);
      cylinder.stageIndex = Math.floor(cylinder.phase / 180);
      cylinder.intakeLift = valveLift(cylinder.phase, 'intake');
      cylinder.exhaustLift = valveLift(cylinder.phase, 'exhaust');
      for (const { valve, spring, kind } of cylinder.valves) {
        const lift = kind === 'intake' ? cylinder.intakeLift : cylinder.exhaustLift;
        valve.position.y = HEAD - lift;
        spring.scale.y = (.024 - lift) / .024;
      }
      const height = Math.max(.001, HEAD - (axial + CROWN));
      cylinder.gas.position.y = (HEAD + axial + CROWN) / 2;
      cylinder.gas.scale.y = height;
      const selected = cylinder.id === this.selectedCylinder;
      cylinder.gas.material.color.set(STAGES[cylinder.stageIndex].stageColor);
      cylinder.gas.material.opacity = selected ? .22 : .085;
      cylinder.glass.opacity = selected ? .13 : .075;
      cylinder.accent.color.set(selected ? '#ead199' : '#657c81');
      cylinder.accent.emissive.set(selected ? '#32280f' : '#000000');
      cylinder.accent.emissiveIntensity = selected ? .32 : 0;
      cylinder.rodMat.color.set(selected ? '#dbc69e' : '#aab9bd');
      cylinder.sparkOn = cylinder.phase < 14;
      cylinder.spark.visible = cylinder.sparkOn;
      cylinder.spark.scale.setScalar(.65 + .55 * (1 - Math.min(1, cylinder.phase / 14)));
    }
    this.root.updateMatrixWorld(true);
    this._dirty = true;
  }

  setAngle(degrees) {
    if (!Number.isFinite(degrees)) throw new Error('曲轴角度必须是有限数值');
    if (this._disposed) return this;
    this.angle = Math.max(0, Math.min(720, degrees)); this._lastTime = null;
    this._applyAngle(); return this;
  }

  setPlaying(value) {
    if (this._disposed) return this;
    const next = Boolean(value);
    if (next !== this.playing) { this.playing = next; this._lastTime = null; this._dirty = true; }
    return this;
  }

  setSpeed(speed) {
    if (speed !== 'slow' && speed !== 'normal') throw new Error(`未知教学速度：${speed}`);
    if (this._disposed) return this;
    if (this.speed !== speed) { this.speed = speed; this._lastTime = null; this._dirty = true; }
    return this;
  }

  selectCylinder(id) {
    if (!this._cylinders.some(cylinder => cylinder.id === id)) throw new Error(`未知气缸：${id}`);
    if (this._disposed) return this;
    if (id !== this.selectedCylinder) { this.selectedCylinder = id; this._applyAngle(); }
    return this;
  }

  get isAnimating() { return this.playing && !this._disposed; }

  update(now = performance.now()) {
    if (this._disposed) return false;
    if (this.playing && Number.isFinite(now)) {
      if (this._lastTime !== null) {
        const elapsed = Math.max(0, (now - this._lastTime) / 1000);
        if (elapsed > 0) {
          this.angle = wrap(this.angle + elapsed * (this.speed === 'slow' ? 45 : 90));
          this._applyAngle();
        }
      }
      this._lastTime = now;
    }
    const dirty = this._dirty; this._dirty = false; return dirty;
  }

  getState() {
    return {
      angle: this.angle, crankAngle: wrap(this.angle, 360), camAngle: wrap(this.angle / 2, 360),
      playing: this.playing, speed: this.speed, selectedCylinder: this.selectedCylinder,
      firingOrder: [...ORDER],
      parameters: { bore: BORE, stroke: R * 2, crankRadius: R, rodLength: ROD, bankAngle: 90, cycleSeconds: this.speed === 'slow' ? 16 : 8, maxValveLift: LIFT },
      cylinders: this._cylinders.map(cylinder => ({
        id: cylinder.id, bank: cylinder.bank, index: cylinder.index,
        phase: cylinder.phase, ...STAGES[cylinder.stageIndex], selected: cylinder.id === this.selectedCylinder,
        firingAngle: cylinder.fire,
        pistonPosition: cylinder.pistonPosition.toArray(), crankPin: cylinder.crankPin.toArray(),
        cylinderAxis: cylinder.axis.toArray(),
        rodLength: cylinder.pistonPosition.distanceTo(cylinder.crankPin),
        intakeLift: cylinder.intakeLift, exhaustLift: cylinder.exhaustLift, spark: cylinder.sparkOn
      }))
    };
  }

  pick(raycaster) {
    if (this._disposed) return null;
    this.root.updateWorldMatrix(true, true);
    const visible = mesh => { for (let node = mesh; node; node = node.parent) if (!node.visible) return false; return true; };
    const hit = raycaster.intersectObjects(this._meshes, false).find(result => visible(result.object));
    return hit?.object.userData.engineCylinder || null;
  }

  dispose() {
    if (this._disposed) return;
    const geometries = new Set(), materials = new Set(Object.values(this.materials));
    for (const mesh of this._meshes) {
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.root.removeFromParent(); this.root.clear(); this._meshes.length = 0;
    this.playing = false; this._disposed = true; this._lastTime = null;
  }
}

import * as THREE from 'three';

const vector3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
const smooth = t => t * t * (3 - 2 * t);
const lampPattern = /^(?:SVJ_head_light|SVJ_tail_light|37_projector|37_light_strip|40_tail_(?:lens|ring|inner))/i;
const tailPattern = /^(?:SVJ_tail_light|40_tail_)/i;
const clamp = t => Math.max(0, Math.min(1, t));

/** Optional v1 continuous tracks: {id,meshes,hinge,keyframes:[{t,rotation,translation}]}.
 * XYZ Euler radians and translations are relative to a model-local hinge.
 * Frames include t=0 and t=1. All tracks in a part share one normalized progress.
 * Smoothstep interpolation is deterministic in either direction; no frame history.
 */
function validTrack(track) {
  return vector3(track.hinge) && Array.isArray(track.keyframes) && track.keyframes.length >= 2 &&
    track.keyframes[0].t === 0 && track.keyframes.at(-1).t === 1 &&
    track.keyframes.every((frame, i, frames) => Number.isFinite(frame.t) &&
      (!i || frame.t > frames[i - 1].t) &&
      (frame.rotation === undefined || vector3(frame.rotation)) &&
      (frame.translation === undefined || vector3(frame.translation)));
}

/** Vehicle mechanisms, expressed in model-local metres with Y up.
 * No DOM or global event handlers. Call update(performance.now()) while rendering.
 * An arbitrary uniformly scaled/rotated drawer group may contain the model.
 */
export class CarRig {
  constructor(model, manifest, { onChange = () => {}, reducedMotion = false } = {}) {
    if (!model?.isObject3D || manifest?.version !== 1 || !Array.isArray(manifest.parts)) {
      throw new Error('车辆互动数据无效');
    }
    this.model = model;
    this.manifest = manifest;
    this.onChange = onChange;
    this.reducedMotion = Boolean(reducedMotion);
    this.parts = new Map();
    this.meshMap = new Map();
    this.allMeshes = [];
    this.lights = false;
    this._dirty = true;
    this._disposed = false;
    this._lampMaterials = [];
    this._materialReplacements = [];
    this._meshParts = new Map();
    this._inverseModel = new THREE.Matrix4();
    this._modelTransform = new THREE.Matrix4();
    this._parentTransform = new THREE.Matrix4();
    this._stayRotation = new THREE.Quaternion();
    this._rotation = new THREE.Quaternion();
    this._rotationMatrix = new THREE.Matrix4();
    this._translationMatrix = new THREE.Matrix4();
    this._endpoint = new THREE.Vector3();
    this._direction = new THREE.Vector3();

    model.traverse(node => {
      if (node.name) this.meshMap.set(node.name, node);
      if (node.isMesh) this.allMeshes.push(node);
    });
    const ids = new Set();
    const claimed = new Set();
    const definitions = manifest.parts.map(definition => {
      const tracked = Array.isArray(definition.tracks) && definition.tracks.length > 0;
      if (!definition.id || ids.has(definition.id) || (tracked ? !definition.tracks.every(validTrack) : (!Number.isFinite(definition.angle) ||
          !vector3(definition.hinge) || !vector3(definition.axis) ||
          !definition.axis.some(value => value !== 0) ||
          (definition.translation !== undefined && !vector3(definition.translation))))) {
        throw new Error(`车辆部件定义无效：${definition.id}`);
      }
      ids.add(definition.id);
      const resolveMeshes = names => {
        const meshes = new Set();
        for (const name of names || []) {
        const node = this.meshMap.get(name);
        if (!node) throw new Error(`模型中缺少部件：${name}`);
        node.traverse(child => { if (child.isMesh) meshes.add(child); });
        }
        if (!meshes.size) throw new Error(`部件没有可移动网格：${definition.id}`);
        for (const mesh of meshes) {
        if (claimed.has(mesh)) throw new Error(`网格重复归属：${mesh.name}`);
        claimed.add(mesh);
        }
        return [...meshes];
      };
      return tracked ? { ...definition, angle: 0, tracks: definition.tracks.map(track => ({ ...track, meshes: resolveMeshes(track.meshes) })) }
        : { ...definition, meshes: resolveMeshes(definition.meshes) };
    });
    // A lamp assembly can move within a clamshell which also opens. Resolve the
    // hierarchy before mutating the scene, and reject broken or cyclic parents.
    const byId = new Map(definitions.map(definition => [definition.id, definition]));
    for (const definition of definitions) {
      const visited = new Set([definition.id]);
      let ancestor = definition;
      while (ancestor.parentPart) {
        const parent = byId.get(ancestor.parentPart);
        if (!parent || visited.has(parent.id) || (ancestor.parentTrack && !parent.tracks?.some(track => track.id === ancestor.parentTrack))) {
          throw new Error(`车辆部件父级无效：${definition.id}`);
        }
        visited.add(parent.id); ancestor = parent;
      }
    }
    for (const stay of manifest.stays || []) {
      if (!ids.has(stay.part) || !vector3(stay.fixed) || !vector3(stay.attached) ||
          !Number.isFinite(stay.bodyLength) || !Number.isFinite(stay.rodLength) ||
          (stay.attachedTrack && !definitions.find(part => part.id === stay.part)?.tracks?.some(track => track.id === stay.attachedTrack))) {
        throw new Error(`支撑杆定义无效：${stay.id}`);
      }
      for (const name of [stay.body, stay.rod, stay.collar]) {
        const mesh = this.meshMap.get(name);
        if (!mesh?.isMesh || claimed.has(mesh)) throw new Error(`支撑杆网格无效：${name}`);
      }
    }

    model.updateWorldMatrix(true, true);
    for (const definition of definitions) {
      const makePivot = (track, index = '') => {
        const pivot = new THREE.Group();
        pivot.name = `interaction_pivot_${definition.id}${index}`;
        pivot.position.fromArray(track.hinge);
        model.add(pivot); pivot.updateWorldMatrix(true, false);
        for (const mesh of track.meshes) { pivot.attach(mesh); this._meshParts.set(mesh, definition.id); }
        return { definition: track, pivot, initialQuaternion: pivot.quaternion.clone(), initialPosition: pivot.position.clone() };
      };
      const tracks = definition.tracks?.map((track, index) => makePivot(track, `_${index}`));
      const primary = tracks?.[0] || makePivot(definition);
      const pivot = primary.pivot;
      this.parts.set(definition.id, {
        definition, pivot, tracks,
        axis: new THREE.Vector3().fromArray(definition.axis || [0, 1, 0]).normalize(),
        initialQuaternion: pivot.quaternion.clone(),
        initialPosition: pivot.position.clone(),
        target: 0, progress: 0, from: 0, started: 0, duration: 800
      });
    }

    model.updateWorldMatrix(true, true);
    const attached = new Set();
    const attachToParent = part => {
      if (attached.has(part.definition.id)) return;
      const parentId = part.definition.parentPart;
      if (parentId) {
        const parent = this.parts.get(parentId); attachToParent(parent);
        const carrier = part.definition.parentTrack ? parent.tracks.find(track => track.definition.id === part.definition.parentTrack).pivot : parent.pivot;
        for (const track of part.tracks || [part]) {
          carrier.attach(track.pivot);
          track.initialPosition.copy(track.pivot.position);
          track.initialQuaternion.copy(track.pivot.quaternion);
        }
        part.initialPosition.copy(part.pivot.position);
        part.initialQuaternion.copy(part.pivot.quaternion);
      }
      attached.add(part.definition.id);
    };
    for (const part of this.parts.values()) attachToParent(part);

    model.updateWorldMatrix(true, true);
    this._inverseModel.copy(model.matrixWorld).invert();
    this.stays = (manifest.stays || []).map(definition => {
      const part = this.parts.get(definition.part);
      const movingPivot = definition.attachedTrack ? part.tracks.find(track => track.definition.id === definition.attachedTrack).pivot : part.pivot;
      const fixed = new THREE.Vector3().fromArray(definition.fixed);
      const attached = new THREE.Vector3().fromArray(definition.attached);
      const localAttached = movingPivot.worldToLocal(model.localToWorld(attached.clone()));
      const segments = [definition.body, definition.rod, definition.collar].map(name => {
        const mesh = this.meshMap.get(name);
        return { mesh, restMatrix: new THREE.Matrix4().multiplyMatrices(this._inverseModel, mesh.matrixWorld) };
      });
      return { definition, part, movingPivot, fixed, attached, localAttached, segments,
        restDirection: attached.clone().sub(fixed).normalize(), length: attached.distanceTo(fixed) };
    });

    for (const mesh of this.allMeshes) {
      const explicit = manifest.lights;
      if (explicit ? ![...(explicit.head || []), ...(explicit.tail || [])].includes(mesh.name) : !lampPattern.test(mesh.name)) continue;
      const original = mesh.material;
      const materials = Array.isArray(original) ? original : [original];
      const replacements = materials.map(material => {
        const clone = material.clone();
        this._lampMaterials.push({ material: clone, color: clone.emissive?.clone(),
          intensity: clone.emissiveIntensity, tail: explicit ? (explicit.tail || []).includes(mesh.name) : tailPattern.test(mesh.name) });
        return clone;
      });
      this._materialReplacements.push({ mesh, original });
      mesh.material = Array.isArray(original) ? replacements : replacements[0];
    }
    this._updateStays();
  }

  get isAnimating() {
    return !this._disposed && [...this.parts.values()].some(part => part.progress !== part.target);
  }

  _notify() {
    this._dirty = true;
    this.onChange(this.getState(), this);
  }

  _setPart(id, open, instant) {
    const part = this.parts.get(id);
    if (!part) throw new Error(`未知部件：${id}`);
    const target = open ? 1 : 0;
    const jump = instant || this.reducedMotion;
    if (part.target === target && (!jump || part.progress === target)) return false;
    part.from = part.progress;
    part.target = target;
    part.started = performance.now();
    part.duration = Math.max(180, 800 * Math.abs(target - part.progress));
    if (jump) {
      part.progress = target;
      this._applyPart(part);
    }
    return true;
  }

  toggle(id) {
    const part = this.parts.get(id);
    if (!part) throw new Error(`未知部件：${id}`);
    return this.set(id, !part.target);
  }

  set(id, open, { instant = false } = {}) {
    if (this._disposed) return this;
    if (this._setPart(id, open, instant)) {
      this._updateStays();
      this._notify();
    }
    return this;
  }

  /** Seek and pause at an exact pose. This also prevents update() resuming a prior target. */
  setProgress(id, progress) {
    if (this._disposed) return this;
    const part = this.parts.get(id);
    if (!part) throw new Error(`未知部件：${id}`);
    if (!Number.isFinite(progress)) throw new Error('部件进度必须是有限数值');
    part.progress = part.target = part.from = clamp(progress);
    this._applyPart(part); this._updateStays(); this._notify();
    return this;
  }

  pause(id) {
    if (this._disposed) return this;
    for (const [key, part] of this.parts) if (id === undefined || key === id) part.target = part.from = part.progress;
    this._notify(); return this;
  }

  restoreState(snapshot) {
    if (this._disposed) return this;
    for (const [id, state] of Object.entries(snapshot || {})) {
      const part = this.parts.get(id); if (!part || !Number.isFinite(state.progress)) continue;
      part.progress = part.from = clamp(state.progress);
      part.target = Number.isFinite(state.target) ? clamp(state.target) : part.progress;
      part.started = performance.now(); part.duration = Math.max(180, 800 * Math.abs(part.target - part.progress));
      this._applyPart(part);
    }
    this._updateStays(); this._notify(); return this;
  }

  setAll(open, { instant = false } = {}) {
    if (this._disposed) return this;
    let changed = false;
    for (const id of this.parts.keys()) changed = this._setPart(id, open, instant) || changed;
    if (changed) {
      this._updateStays();
      this._notify();
    }
    return this;
  }

  reset({ instant = false } = {}) {
    this.setAll(false, { instant });
    this.setLights(false);
    return this;
  }

  setLights(on) {
    if (this._disposed || this.lights === Boolean(on)) return this;
    this.lights = Boolean(on);
    for (const lamp of this._lampMaterials) {
      if (!lamp.color) continue;
      if (this.lights) {
        lamp.material.emissive.set(lamp.tail ? '#ff180b' : '#fff4d9');
        lamp.material.emissiveIntensity = lamp.tail ? 2.8 : 4;
      } else {
        lamp.material.emissive.copy(lamp.color);
        lamp.material.emissiveIntensity = lamp.intensity;
      }
    }
    this._notify();
    return this;
  }

  _applyPart(part) {
    if (part.tracks) {
      for (const track of part.tracks) {
        const frames = track.definition.keyframes;
        const end = frames.findIndex(frame => frame.t >= part.progress);
        const b = frames[Math.max(1, end)], a = frames[Math.max(0, end - 1)];
        const t = smooth(clamp((part.progress - a.t) / (b.t - a.t)));
        const interpolate = key => [0, 1, 2].map(i => (a[key]?.[i] || 0) + ((b[key]?.[i] || 0) - (a[key]?.[i] || 0)) * t);
        track.pivot.position.copy(track.initialPosition).add(new THREE.Vector3(...interpolate('translation')));
        this._rotation.setFromEuler(new THREE.Euler(...interpolate('rotation'), 'XYZ'));
        track.pivot.quaternion.copy(track.initialQuaternion).multiply(this._rotation);
      }
      return;
    }
    part.pivot.position.copy(part.initialPosition);
    if (part.definition.translation) {
      // Clear the roof vertically before moving a removable cover aft.
      // Reverse motion follows the same path back to its exact seated position.
      const [x, y, z] = part.definition.translation;
      const lift = smooth(Math.min(1, part.progress / 0.55));
      const slide = smooth(Math.max(0, (part.progress - 0.55) / 0.45));
      part.pivot.position.x += x * slide;
      part.pivot.position.y += y * lift;
      part.pivot.position.z += z * slide;
    }
    this._rotation.setFromAxisAngle(part.axis, part.definition.angle * part.progress);
    part.pivot.quaternion.copy(part.initialQuaternion).multiply(this._rotation);
  }

  _updateStays() {
    this.model.updateWorldMatrix(true, true);
    if (!this.stays.length) return;
    this._inverseModel.copy(this.model.matrixWorld).invert();
    for (const stay of this.stays) {
      this._endpoint.copy(stay.localAttached).applyMatrix4(stay.movingPivot.matrixWorld).applyMatrix4(this._inverseModel);
      this._direction.subVectors(this._endpoint, stay.fixed);
      stay.length = this._direction.length();
      if (stay.length < 1e-8) continue;
      this._stayRotation.setFromUnitVectors(stay.restDirection, this._direction.normalize());
      this._rotationMatrix.makeRotationFromQuaternion(this._stayRotation);
      for (let index = 0; index < stay.segments.length; index++) {
        const { mesh, restMatrix } = stay.segments[index];
        const oldAnchor = index === 1 ? stay.attached : stay.fixed;
        const newAnchor = index === 1 ? this._endpoint : stay.fixed;
        this._modelTransform.makeTranslation(newAnchor.x, newAnchor.y, newAnchor.z)
          .multiply(this._rotationMatrix)
          .multiply(this._translationMatrix.makeTranslation(-oldAnchor.x, -oldAnchor.y, -oldAnchor.z))
          .multiply(restMatrix);
        // The manifest is model-local even when GLTF contains nested transforms.
        this._parentTransform.copy(mesh.parent.matrixWorld).invert()
          .multiply(this.model.matrixWorld).multiply(this._modelTransform)
          .decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.updateMatrix();
      }
    }
    this.model.updateWorldMatrix(true, true);
  }

  update(now = performance.now()) {
    if (this._disposed) return false;
    let changed = this._dirty;
    let moved = false;
    for (const part of this.parts.values()) {
      if (part.progress === part.target) continue;
      const t = this.reducedMotion ? 1 : Math.min(1, Math.max(0, (now - part.started) / part.duration));
      part.progress = t === 1 ? part.target : part.from + (part.target - part.from) * ease(t);
      this._applyPart(part);
      moved = true;
    }
    if (moved) {
      this._updateStays();
      changed = true;
    }
    this._dirty = false;
    return changed;
  }

  pick(raycaster) {
    if (this._disposed) return null;
    this.model.updateWorldMatrix(true, true);
    const visible = object => {
      for (let node = object; node; node = node.parent) if (!node.visible) return false;
      return true;
    };
    // Fixed bodywork participates so a far-side door cannot be picked through it.
    const hit = raycaster.intersectObjects(this.allMeshes, false).find(result => visible(result.object));
    return hit ? this._meshParts.get(hit.object) || null : null;
  }

  getState() {
    return {
      parts: Object.fromEntries([...this.parts].map(([id, part]) => [id, {
        target: part.target, progress: part.progress,
        angle: part.definition.angle * part.progress,
        position: part.pivot.position.toArray(),
        motion: part.tracks ? 'continuous-tracks' : part.definition.translation ? 'lift-off' : 'hinged',
        ...(part.tracks ? { tracks: part.tracks.map(track => ({ id: track.definition.id, position: track.pivot.position.toArray(), quaternion: track.pivot.quaternion.toArray() })) } : {})
      }])),
      lights: this.lights,
      stays: this.stays.map(stay => ({ id: stay.definition.id, length: stay.length,
        overlap: stay.definition.bodyLength + stay.definition.rodLength - stay.length }))
    };
  }

  dispose() {
    if (this._disposed) return;
    for (const { mesh, original } of this._materialReplacements) mesh.material = original;
    for (const { material } of this._lampMaterials) material.dispose();
    this._lampMaterials.length = 0;
    this._materialReplacements.length = 0;
    this.onChange = () => {};
    this._disposed = true;
  }
}

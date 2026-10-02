import * as THREE from 'three'
import { J, mirrorX } from './body'

// Poses de la muñeca: rotaciones por articulación + IK de dos huesos para
// colocar las manos (mano en la cadera, saludo, beso…).

export type JointName =
  | 'hips'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'elbowL'
  | 'wristL'
  | 'shoulderR'
  | 'elbowR'
  | 'wristR'
  | 'hipL'
  | 'kneeL'
  | 'ankleL'
  | 'hipR'
  | 'kneeR'
  | 'ankleR'

export const JOINTS: JointName[] = [
  'hips',
  'neck',
  'head',
  'shoulderL',
  'elbowL',
  'wristL',
  'shoulderR',
  'elbowR',
  'wristR',
  'hipL',
  'kneeL',
  'ankleL',
  'hipR',
  'kneeR',
  'ankleR',
]

export type Pose = Record<JointName, THREE.Quaternion> & { rootY: number; rootX: number; curlL: number; curlR: number }

const e = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'))

export function restPose(): Pose {
  const p = { rootY: 0, rootX: 0, curlL: 0, curlR: 0 } as Pose
  for (const j of JOINTS) p[j] = new THREE.Quaternion()
  return p
}

/** Brazos ligeramente separados del cuerpo y codos algo flexionados. */
function relaxedArms(p: Pose) {
  p.shoulderL = e(0.04, 0, 0.13)
  p.shoulderR = e(0.04, 0, -0.13)
  p.elbowL = e(-0.18, 0, 0.0)
  p.elbowR = e(-0.18, 0, 0.0)
  p.wristL = e(0, 0.15, 0.05)
  p.wristR = e(0, -0.15, -0.05)
  p.curlL = 0.15
  p.curlR = 0.15
}

// ─────────────── IK de brazo ───────────────
const UPPER = J.elbowL.distanceTo(J.shoulderL)
const FORE = J.wristL.distanceTo(J.elbowL)
const restUpperL = new THREE.Vector3().subVectors(J.elbowL, J.shoulderL).normalize()
const restForeL = new THREE.Vector3().subVectors(J.wristL, J.elbowL).normalize()

/**
 * Calcula rotaciones de hombro y codo para llevar la muñeca a `target`
 * (coordenadas de reposo del torso). `pole` indica hacia dónde apunta el codo.
 */
export function armIK(side: 1 | -1, target: THREE.Vector3, pole: THREE.Vector3): { shoulder: THREE.Quaternion; elbow: THREE.Quaternion } {
  const S = side === 1 ? J.shoulderL.clone() : mirrorX(J.shoulderL)
  const restU = side === 1 ? restUpperL.clone() : new THREE.Vector3(-restUpperL.x, restUpperL.y, restUpperL.z)
  const restF = side === 1 ? restForeL.clone() : new THREE.Vector3(-restForeL.x, restForeL.y, restForeL.z)
  const toT = new THREE.Vector3().subVectors(target, S)
  let d = toT.length()
  d = Math.min(d, (UPPER + FORE) * 0.999)
  d = Math.max(d, Math.abs(UPPER - FORE) + 0.01)
  const dir = toT.normalize()
  // posición del codo por ley de cosenos
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a))
  const poleDir = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize()
  const E = S.clone().addScaledVector(dir, a).addScaledVector(poleDir, h)
  const T = S.clone().addScaledVector(dir, d)
  const u = new THREE.Vector3().subVectors(E, S).normalize()
  const f = new THREE.Vector3().subVectors(T, E).normalize()

  // Marco de reposo (eje de flexión = x local) y marco objetivo
  const x0 = new THREE.Vector3(1, 0, 0)
  const z0 = new THREE.Vector3().crossVectors(x0, restU).normalize()
  const x0o = new THREE.Vector3().crossVectors(restU, z0).normalize()
  const m0 = new THREE.Matrix4().makeBasis(x0o, restU, z0)
  let x1 = new THREE.Vector3().crossVectors(u, f).multiplyScalar(-1)
  if (x1.lengthSq() < 1e-6) x1 = new THREE.Vector3(1, 0, 0)
  x1.normalize()
  const z1 = new THREE.Vector3().crossVectors(x1, u).normalize()
  const x1o = new THREE.Vector3().crossVectors(u, z1).normalize()
  const m1 = new THREE.Matrix4().makeBasis(x1o, u, z1)
  const q1 = new THREE.Quaternion().setFromRotationMatrix(m1.multiply(m0.invert()))
  const fLocal = f.clone().applyQuaternion(q1.clone().invert())
  const q2 = new THREE.Quaternion().setFromUnitVectors(restF, fLocal)
  return { shoulder: q1, elbow: q2 }
}

function ik(p: Pose, side: 1 | -1, t: [number, number, number], pole: [number, number, number], wrist: [number, number, number] = [0, 0, 0]) {
  const r = armIK(side, new THREE.Vector3(...t), new THREE.Vector3(...pole))
  if (side === 1) {
    p.shoulderL = r.shoulder
    p.elbowL = r.elbow
    p.wristL = e(...wrist)
  } else {
    p.shoulderR = r.shoulder
    p.elbowR = r.elbow
    p.wristR = e(...wrist)
  }
}

/** Peso sobre una pierna: cadera desplazada, rodilla contraria flexionada. */
function contrapposto(p: Pose, side: 1 | -1, amt = 1) {
  p.hips = e(0, -side * 0.08 * amt, side * 0.045 * amt)
  p.rootX = side * 0.018 * amt
  const sup = side === 1 ? 'L' : 'R'
  const free = side === 1 ? 'R' : 'L'
  p[`hip${sup}` as JointName] = e(0, 0, -side * 0.045 * amt)
  p[`hip${free}` as JointName] = e(-0.16 * amt, 0, -side * 0.085 * amt)
  p[`knee${free}` as JointName] = e(0.3 * amt, 0, 0)
  p[`ankle${free}` as JointName] = e(-0.08 * amt, 0, 0)
  p.neck = e(0.02, side * 0.05 * amt, -side * 0.03 * amt)
  p.head = e(0.02, side * 0.06 * amt, -side * 0.05 * amt)
}

export const POSE_BUILDERS: Record<string, () => Pose> = {
  idle() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, 1, 0.9)
    // un brazo algo adelantado y flexionado: postura más natural y con actitud
    p.shoulderR = e(-0.12, 0.1, -0.16)
    p.elbowR = e(-0.42, 0, 0)
    p.shoulderL = e(0.08, 0, 0.17)
    p.head = e(0.03, 0.08, -0.06)
    return p
  },
  hip() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, 1, 1.1)
    ik(p, 1, [0.142, 0.93, -0.005], [1, 0.1, -0.7], [0, 0, 0.5])
    p.curlL = 0.35
    p.head = e(0.04, 0.12, -0.1)
    return p
  },
  peace() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, -1, 0.9)
    ik(p, 1, [0.12, 1.53, 0.1], [1, -0.6, 0.0], [0, 0.5, 0.2])
    p.curlL = 0.9
    p.head = e(0.0, -0.08, 0.12)
    return p
  },
  kiss() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, 1, 0.9)
    ik(p, -1, [-0.03, 1.38, 0.24], [-0.6, -1, 0.1], [0.0, -0.6, -0.2])
    p.curlR = 0.2
    p.head = e(0.1, 0.1, -0.05)
    return p
  },
  hair() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, -1, 1)
    ik(p, 1, [0.13, 1.66, -0.02], [1, 0.4, -0.2], [0.3, 0, 1.2])
    p.curlL = 0.3
    p.head = e(-0.08, -0.06, 0.12)
    p.neck = e(-0.05, 0, 0.05)
    return p
  },
  cross() {
    const p = restPose()
    relaxedArms(p)
    p.hips = e(0, 0.1, 0.03)
    p.rootX = 0.01
    p.hipL = e(0.0, 0, -0.03)
    p.hipR = e(-0.14, 0.15, 0.13)
    p.kneeR = e(0.22, 0, 0)
    p.ankleR = e(0.3, 0, 0)
    ik(p, 1, [0.142, 0.93, -0.005], [1, 0.1, -0.7], [0, 0, 0.5])
    p.curlL = 0.35
    p.head = e(0.05, -0.1, 0.06)
    return p
  },
  wave() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, -1, 0.8)
    ik(p, 1, [0.36, 1.56, 0.12], [1, -1, -0.2], [0.0, 0.3, -0.2])
    p.curlL = 0
    p.head = e(0.0, 0.12, 0.08)
    return p
  },
  star() {
    const p = restPose()
    ik(p, 1, [0.52, 1.5, 0.05], [0, -1, -0.5], [0, 0, 0.2])
    ik(p, -1, [-0.52, 1.5, 0.05], [0, -1, -0.5], [0, 0, -0.2])
    p.curlL = 0
    p.curlR = 0
    p.hipL = e(0, 0, 0.12)
    p.hipR = e(0, 0, -0.12)
    p.ankleL = e(0, 0, -0.1)
    p.ankleR = e(0, 0, 0.1)
    p.rootY = -0.008
    p.head = e(-0.08, 0, 0.0)
    return p
  },
  /** Pose de presentación en la portada. */
  hero() {
    const p = restPose()
    relaxedArms(p)
    contrapposto(p, 1, 1.2)
    ik(p, 1, [0.142, 0.93, -0.005], [1, 0.1, -0.7], [0, 0, 0.5])
    p.curlL = 0.35
    p.head = e(0.05, 0.16, -0.12)
    return p
  },
}

export function getPose(id: string): Pose {
  return (POSE_BUILDERS[id] ?? POSE_BUILDERS.idle)()
}

/** Ciclo de paseo de pasarela (t en ciclos). */
export function walkPose(t: number, out: Pose): Pose {
  const ph = t * Math.PI * 2
  const s = Math.sin(ph)
  const c = Math.cos(ph)
  out.hips.setFromEuler(new THREE.Euler(0.03, s * 0.12, -s * 0.06))
  out.rootX = -s * 0.015
  out.rootY = -Math.abs(c) * 0.014 + 0.004
  const swing = 0.42
  // pierna izquierda adelante cuando s>0
  const lk = Math.max(0, -Math.sin(ph + 0.9)) * 0.75 + 0.05
  const rk = Math.max(0, Math.sin(ph + 0.9)) * 0.75 + 0.05
  out.hipL.setFromEuler(new THREE.Euler(-s * swing, 0, -0.04 + s * 0.02))
  out.hipR.setFromEuler(new THREE.Euler(s * swing, 0, 0.04 + s * 0.02))
  out.kneeL.setFromEuler(new THREE.Euler(lk, 0, 0))
  out.kneeR.setFromEuler(new THREE.Euler(rk, 0, 0))
  out.ankleL.setFromEuler(new THREE.Euler(-0.15 + s * 0.2 - lk * 0.2, 0, 0))
  out.ankleR.setFromEuler(new THREE.Euler(-0.15 - s * 0.2 - rk * 0.2, 0, 0))
  out.shoulderL.setFromEuler(new THREE.Euler(s * 0.32, 0, 0.12))
  out.shoulderR.setFromEuler(new THREE.Euler(-s * 0.32, 0, -0.12))
  out.elbowL.setFromEuler(new THREE.Euler(-0.25 - Math.max(0, s) * 0.3, 0, 0))
  out.elbowR.setFromEuler(new THREE.Euler(-0.25 - Math.max(0, -s) * 0.3, 0, 0))
  out.wristL.setFromEuler(new THREE.Euler(0, 0.2, 0))
  out.wristR.setFromEuler(new THREE.Euler(0, -0.2, 0))
  out.neck.setFromEuler(new THREE.Euler(0.02, -s * 0.05, 0))
  out.head.setFromEuler(new THREE.Euler(0.03, -s * 0.06, s * 0.03))
  out.curlL = 0.2
  out.curlR = 0.2
  return out
}

export function copyPose(src: Pose, dst: Pose) {
  for (const j of JOINTS) dst[j].copy(src[j])
  dst.rootX = src.rootX
  dst.rootY = src.rootY
  dst.curlL = src.curlL
  dst.curlR = src.curlR
}

export function blendPose(cur: Pose, target: Pose, k: number) {
  for (const j of JOINTS) cur[j].slerp(target[j], k)
  cur.rootX += (target.rootX - cur.rootX) * k
  cur.rootY += (target.rootY - cur.rootY) * k
  cur.curlL += (target.curlL - cur.curlL) * k
  cur.curlR += (target.curlR - cur.curlR) * k
}

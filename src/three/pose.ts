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

/**
 * Ciclo de paseo de pasarela (t en ciclos). `stride` (0–1) escala la zancada:
 * con valores bajos son pasitos en el sitio (para girar).
 */
export function walkPose(t: number, out: Pose, stride = 1): Pose {
  const ph = t * Math.PI * 2
  const s = Math.sin(ph) * stride
  const c = Math.cos(ph)
  out.hips.setFromEuler(new THREE.Euler(0.03, s * 0.12, -s * 0.06))
  out.rootX = -s * 0.015
  out.rootY = -Math.abs(c) * 0.014 * stride + 0.004
  const swing = 0.3
  // pierna izquierda adelante cuando s>0
  // la rodilla se flexiona al despegar el pie (aunque la zancada sea corta)
  const lift = 0.35 + 0.65 * stride
  const lk = Math.max(0, -Math.sin(ph + 0.9)) * 0.75 * lift + 0.05
  const rk = Math.max(0, Math.sin(ph + 0.9)) * 0.75 * lift + 0.05
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

// ─────────────── Transiciones con anticipación y asentamiento ───────────────

const ANTIC_END = 0.2
const MAIN_END = 0.66
const ANTIC = 0.08
const OVERSHOOT = 0.07

/**
 * Curva de transición (t de 0 a 1): retrocede un poco al principio
 * (anticipación), pasa algo de largo (sobrepaso) y se asienta con un
 * pequeño rebote amortiguado. Empieza en 0 y termina en 1.
 */
export function transitionCurve(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  if (t < ANTIC_END) {
    const u = Math.sin((t / ANTIC_END) * Math.PI * 0.5)
    return -ANTIC * u * u
  }
  if (t < MAIN_END) {
    const u = (t - ANTIC_END) / (MAIN_END - ANTIC_END)
    const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
    return -ANTIC + (1 + OVERSHOOT + ANTIC) * k
  }
  const u = (t - MAIN_END) / (1 - MAIN_END)
  return 1 + OVERSHOOT * Math.cos(u * Math.PI * 2.5) * (1 - u) * (1 - u)
}

/** Duración base de una transición entre poses (s). */
export const TRANSITION_TIME = 0.8

/**
 * Retraso de cada articulación (s): las caderas inician el movimiento y
 * cabeza, brazos y manos lo siguen (acción superpuesta).
 */
export const JOINT_DELAY: Record<JointName, number> = {
  hips: 0,
  hipL: 0,
  hipR: 0,
  kneeL: 0.02,
  kneeR: 0.02,
  ankleL: 0.03,
  ankleR: 0.03,
  neck: 0.05,
  head: 0.1,
  shoulderL: 0.05,
  shoulderR: 0.05,
  elbowL: 0.09,
  elbowR: 0.09,
  wristL: 0.13,
  wristR: 0.13,
}
const MAX_DELAY = 0.13
export const TRANSITION_TOTAL = TRANSITION_TIME + MAX_DELAY

/** Pose intermedia de la transición `from` → `to` en el instante `time` (s). */
export function transitionPose(from: Pose, to: Pose, time: number, out: Pose): Pose {
  for (const j of JOINTS) {
    const k = transitionCurve((time - JOINT_DELAY[j]) / TRANSITION_TIME)
    out[j].copy(from[j]).slerp(to[j], k)
  }
  const k = transitionCurve(time / TRANSITION_TIME)
  const kh = transitionCurve((time - MAX_DELAY) / TRANSITION_TIME)
  out.rootX = from.rootX + (to.rootX - from.rootX) * k
  // pequeña flexión de rodillas al coger impulso (el IK de pies la convierte en flexión)
  const dip = Math.sin(Math.min(1, Math.max(0, time / (TRANSITION_TIME * 0.55))) * Math.PI) * 0.012
  out.rootY = from.rootY + (to.rootY - from.rootY) * k - dip
  out.curlL = from.curlL + (to.curlL - from.curlL) * Math.min(1, Math.max(0, kh))
  out.curlR = from.curlR + (to.curlR - from.curlR) * Math.min(1, Math.max(0, kh))
  return out
}

// ─────────────── Reacciones: aplauso y saltito ───────────────

export type ReactionKind = 'euforia' | 'alegria' | 'aplauso' | 'sorpresa'

export interface Reaction {
  kind: ReactionKind
  expression: 'risa' | 'dientes' | 'sonrisa' | 'sorpresa'
  /** número de saltitos */
  hops: number
  clap: boolean
  duration: number
}

/** Reacción de la muñeca según las estrellas del jurado (1–5). */
export function reactionFor(stars: number): Reaction {
  if (stars >= 5) return { kind: 'euforia', expression: 'risa', hops: 2, clap: true, duration: 2.6 }
  if (stars >= 4) return { kind: 'alegria', expression: 'dientes', hops: 1, clap: true, duration: 2.2 }
  if (stars >= 3) return { kind: 'aplauso', expression: 'sonrisa', hops: 0, clap: true, duration: 1.8 }
  return { kind: 'sorpresa', expression: 'sorpresa', hops: 0, clap: false, duration: 1.8 }
}

export const HOP_TIME = 0.7
const HOP_HEIGHT = 0.085

/**
 * Altura del saltito (t en s desde su inicio): se agacha para coger impulso,
 * vuela en parábola y amortigua al caer. `air` indica si los pies despegan.
 */
export function hopOffset(t: number): { y: number; air: boolean } {
  const u = t / HOP_TIME
  if (u <= 0 || u >= 1) return { y: 0, air: false }
  if (u < 0.22) return { y: -0.032 * Math.sin((u / 0.22) * Math.PI * 0.5), air: false }
  if (u < 0.68) {
    const a = (u - 0.22) / 0.46
    const y = -0.032 * Math.pow(1 - a, 3) + HOP_HEIGHT * 4 * a * (1 - a)
    return { y, air: y > 0.004 }
  }
  const a = (u - 0.68) / 0.32
  return { y: -0.026 * Math.sin(a * Math.PI), air: false }
}

const clapR = new THREE.Vector3()
const clapL = new THREE.Vector3()
/**
 * Pose de aplauso (t en s): manos delante del pecho que se juntan y se
 * separan unas tres veces por segundo.
 */
export function clapPose(t: number, out: Pose): Pose {
  const open = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 3.2)
  const gap = 0.004 + 0.085 * open
  clapL.set(0.035 + gap, 1.11 + 0.01 * open, 0.2)
  clapR.set(-0.035 - gap, 1.11 + 0.01 * open, 0.2)
  const l = armIK(1, clapL, new THREE.Vector3(1, -0.7, -0.4))
  const r = armIK(-1, clapR, new THREE.Vector3(-1, -0.7, -0.4))
  out.shoulderL.copy(l.shoulder)
  out.elbowL.copy(l.elbow)
  out.shoulderR.copy(r.shoulder)
  out.elbowR.copy(r.elbow)
  out.wristL.setFromEuler(new THREE.Euler(0, -0.9, 1.2))
  out.wristR.setFromEuler(new THREE.Euler(0, 0.9, -1.2))
  out.curlL = 0
  out.curlR = 0
  return out
}

/** Encogerse de hombros con las palmas hacia fuera (reacción de sorpresa). */
export function shrugPose(out: Pose): Pose {
  ik(out, 1, [0.3, 0.98, 0.14], [1, -0.2, -1], [0, -0.8, -0.6])
  ik(out, -1, [-0.3, 0.98, 0.14], [-1, -0.2, -1], [0, 0.8, 0.6])
  out.curlL = 0
  out.curlR = 0
  out.neck = e(-0.06, 0, 0)
  out.head = e(-0.12, 0, 0.08)
  return out
}

/**
 * Pose de la reacción en el instante t (s): parte de `base` y añade
 * aplauso, saltitos o encogimiento. Devuelve también la altura extra.
 */
export function reactionPose(r: Reaction, t: number, base: Pose, out: Pose): { lift: number; air: boolean } {
  copyPose(base, out)
  let lift = 0
  let air = false
  for (let i = 0; i < r.hops; i++) {
    const h = hopOffset(t - 0.15 - i * HOP_TIME)
    lift += h.y
    air ||= h.air
  }
  if (r.clap) clapPose(t, out)
  else if (r.kind === 'sorpresa') shrugPose(out)
  if (air) {
    // en el aire los pies se recogen un poco
    out.kneeL.setFromEuler(new THREE.Euler(0.35, 0, 0))
    out.kneeR.setFromEuler(new THREE.Euler(0.35, 0, 0))
    out.ankleL.setFromEuler(new THREE.Euler(0.25, 0, 0))
    out.ankleR.setFromEuler(new THREE.Euler(0.25, 0, 0))
  }
  if (r.kind === 'euforia') out.head.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08 - 0.04 * Math.abs(Math.sin(t * 9)), 0, 0)))
  return { lift, air }
}

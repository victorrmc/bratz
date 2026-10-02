import * as THREE from 'three'
import { curveOf, ellipsoid, gauss, merge, smoothstep, surface, sweep, table } from './geo'

// Anatomía estilizada de muñeca fashion, construida por código.
// Todas las medidas están en la pose de reposo, en coordenadas de mundo
// (pies en y=0, mirando hacia +z). Altura total ≈ 1,69.

export const J = {
  hips: new THREE.Vector3(0, 0.84, 0),
  neck: new THREE.Vector3(0, 1.305, -0.004),
  head: new THREE.Vector3(0, 1.4, 0.0),
  headCenter: new THREE.Vector3(0, 1.49, 0.01),
  shoulderL: new THREE.Vector3(0.158, 1.246, -0.006),
  elbowL: new THREE.Vector3(0.168, 1.003, -0.012),
  wristL: new THREE.Vector3(0.174, 0.788, 0.0),
  hipL: new THREE.Vector3(0.074, 0.835, 0),
  kneeL: new THREE.Vector3(0.064, 0.45, 0.004),
  ankleL: new THREE.Vector3(0.058, 0.072, -0.01),
}

export const HEAD = { rx: 0.134, ry: 0.153, rz: 0.138 }
/** Región de la cara proyectada en la textura (ancho/alto medio). */
export const FACE = { w: 0.135, h: 0.17 }

export const mirrorX = (v: THREE.Vector3) => new THREE.Vector3(-v.x, v.y, v.z)

// ───────────────────────── TORSO ─────────────────────────

const W = table([
  [0.765, 0.05],
  [0.785, 0.104],
  [0.82, 0.136],
  [0.86, 0.145],
  [0.9, 0.137],
  [0.95, 0.117],
  [1.0, 0.097],
  [1.04, 0.099],
  [1.09, 0.11],
  [1.14, 0.118],
  [1.19, 0.127],
  [1.225, 0.139],
  [1.25, 0.143],
  [1.27, 0.13],
  [1.287, 0.088],
  [1.3, 0.052],
  [1.31, 0.036],
])
const DF = table([
  [0.765, 0.042],
  [0.785, 0.066],
  [0.82, 0.076],
  [0.86, 0.077],
  [0.9, 0.072],
  [0.95, 0.066],
  [1.0, 0.06],
  [1.05, 0.062],
  [1.1, 0.066],
  [1.15, 0.068],
  [1.2, 0.064],
  [1.24, 0.056],
  [1.27, 0.047],
  [1.29, 0.038],
  [1.31, 0.03],
])
const DB = table([
  [0.765, 0.046],
  [0.785, 0.072],
  [0.82, 0.088],
  [0.86, 0.09],
  [0.9, 0.081],
  [0.95, 0.07],
  [1.0, 0.06],
  [1.05, 0.06],
  [1.1, 0.063],
  [1.15, 0.065],
  [1.2, 0.064],
  [1.24, 0.06],
  [1.27, 0.052],
  [1.29, 0.042],
  [1.31, 0.03],
])

export const TORSO_Y0 = 0.765
export const TORSO_Y1 = 1.31

const BUST = { x: 0.05, y: 1.132, amp: 0.026, sx: 0.034, sy: 0.03 }

/** Busto: dos gaussianas; `bridge` rellena el canal (para prendas). */
function bust(x: number, y: number, bridge: number): number {
  const gy = gauss(y - BUST.y, BUST.sy)
  const two = gauss(x - BUST.x, BUST.sx) + gauss(x + BUST.x, BUST.sx)
  const ax = Math.max(0, Math.abs(x) - BUST.x)
  const one = gauss(ax, BUST.sx)
  return BUST.amp * gy * (two * (1 - bridge) + one * bridge * 1.02)
}

function glutes(x: number, y: number): number {
  return 0.017 * gauss(y - 0.84, 0.035) * (gauss(x - 0.05, 0.04) + gauss(x + 0.05, 0.04))
}

/**
 * Punto de la superficie del torso a la altura y y ángulo θ (0 = frente, +π/2 = izquierda/+x).
 * `off` = holgura de la prenda, `bridge` = relleno del escote.
 */
export function torsoPoint(y: number, theta: number, off = 0, bridge = 0, out = new THREE.Vector3()): THREE.Vector3 {
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const n = 2.0 + 0.6 * smoothstep(0.8, 1.0, y) * (1 - smoothstep(1.2, 1.3, y))
  const se = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n)
  const w = W(y) + off
  const d = (c >= 0 ? DF(y) : DB(y)) + off
  const x = w * se(s)
  let z = d * se(c)
  if (c > 0) z += bust(x, y, bridge) * Math.pow(c, 1.5)
  else z -= glutes(x, y) * Math.pow(-c, 1.5)
  return out.set(x, y, z)
}

export function torsoGeometry(): THREE.BufferGeometry {
  const ny = 64
  return surface(
    72,
    ny,
    (u, v, out) => {
      // más resolución en hombros y cadera
      const y = TORSO_Y0 + (TORSO_Y1 - TORSO_Y0) * (1 - Math.cos(v * Math.PI)) * 0.5
      const yy = v === 0 ? TORSO_Y0 + 0.0001 : y
      const p = torsoPoint(yy, u * Math.PI * 2 + Math.PI)
      // cierra la entrepierna y el cuello en un punto
      if (v === 0) p.set(0, TORSO_Y0 - 0.008, 0)
      out.copy(p)
    },
    { closedU: true, orient: 'auto', uvMode: 'param' },
  )
}

// ───────────── Relieve del torso (normal map procedural) ─────────────

/** y del torso para el parámetro v (la malla concentra filas en hombros y cadera). */
const torsoY = (v: number) => TORSO_Y0 + (TORSO_Y1 - TORSO_Y0) * (1 - Math.cos(v * Math.PI)) * 0.5

/** Clavícula: altura de la cresta en función de |x| (forma de S suave). */
function clavicleY(ax: number): number {
  const t = (ax - 0.016) / 0.118
  return 1.262 + 0.013 * t + 0.0035 * Math.sin(t * Math.PI * 1.6)
}

/** Relieve en metros (positivo = hacia fuera) de un punto del torso. */
export function torsoRelief(x: number, y: number, z: number): number {
  const ax = Math.abs(x)
  let h = 0
  if (z > 0) {
    const front = smoothstep(0.0, 0.03, z)
    // clavículas: cresta con el hueco supraclavicular encima
    const span = smoothstep(0.012, 0.03, ax) * (1 - smoothstep(0.118, 0.14, ax))
    const yc = clavicleY(ax)
    h += span * (0.0028 * gauss(y - yc, 0.0042) - 0.0016 * gauss(y - yc - 0.011, 0.0055) * smoothstep(0.03, 0.05, ax))
    // cabeza esternal de la clavícula y escotadura yugular
    h += 0.0012 * gauss(ax - 0.02, 0.006) * gauss(y - 1.262, 0.005)
    h -= 0.0022 * gauss(x, 0.008) * gauss(y - 1.27, 0.007)
    // esternón y línea alba (muy suaves)
    h -= 0.0006 * gauss(x, 0.006) * smoothstep(1.06, 1.12, y) * (1 - smoothstep(1.2, 1.25, y))
    h -= 0.0005 * gauss(x, 0.005) * smoothstep(0.93, 0.97, y) * (1 - smoothstep(1.03, 1.08, y))
    // caja torácica bajo el pecho
    h += 0.0007 * gauss(ax - 0.06, 0.03) * gauss(y - 1.085, 0.008)
    // ombligo
    h -= 0.0032 * gauss(x, 0.0035) * gauss(y - 0.948, 0.0045)
    h += 0.0008 * gauss(x, 0.007) * gauss(y - 0.955, 0.004)
    // crestas de la cadera
    h += 0.0012 * gauss(ax - 0.1, 0.012) * gauss(y - 0.905, 0.018)
    h *= front
  } else {
    const back = smoothstep(0.0, -0.03, z)
    // columna y omóplatos
    h -= 0.0024 * gauss(x, 0.007) * smoothstep(0.92, 0.98, y) * (1 - smoothstep(1.25, 1.29, y))
    h += 0.0016 * gauss(ax - 0.012, 0.007) * smoothstep(0.94, 1.0, y) * (1 - smoothstep(1.06, 1.12, y))
    h += 0.0024 * gauss(ax - 0.065, 0.022) * gauss(y - 1.19, 0.03) * (1 - 0.6 * gauss(ax - 0.035, 0.008))
    h -= 0.0012 * gauss(ax - 0.035, 0.006) * gauss(y - 1.18, 0.035)
    // hoyuelos lumbares
    h -= 0.0016 * gauss(ax - 0.03, 0.008) * gauss(y - 0.885, 0.01)
    h *= back
  }
  // clavícula hasta el hombro (también visible de lado)
  return h
}

/** Normal map del torso en espacio tangente (lienzo: u = vuelta, v = altura). */
export function torsoNormalCanvas(w = 512, h = 512): HTMLCanvasElement {
  const P = new Float32Array((w + 2) * (h + 2) * 3)
  const H = new Float32Array((w + 2) * (h + 2))
  const p = new THREE.Vector3()
  for (let r = -1; r <= h; r++) {
    // fila 0 del lienzo = v = 1 (flipY de la textura)
    const v = Math.min(1, Math.max(0, 1 - (r + 0.5) / h))
    const y = torsoY(v)
    for (let c = -1; c <= w; c++) {
      const u = (c + 0.5) / w
      torsoPoint(Math.max(TORSO_Y0 + 0.0001, y), u * Math.PI * 2 + Math.PI, 0, 0, p)
      const k = (r + 1) * (w + 2) + (c + 1)
      P[k * 3] = p.x
      P[k * 3 + 1] = p.y
      P[k * 3 + 2] = p.z
      H[k] = torsoRelief(p.x, p.y, p.z)
    }
  }
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const dist = (a: number, b: number) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]) || 1e-6
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const k = (r + 1) * (w + 2) + (c + 1)
      const kl = k - 1
      const kr = k + 1
      const ku = k - (w + 2) // fila de arriba = v mayor
      const kd = k + (w + 2)
      const du = (H[kr] - H[kl]) / dist(kr, kl)
      const dv = (H[ku] - H[kd]) / dist(ku, kd)
      const n = new THREE.Vector3(-du, -dv, 1).normalize()
      const o = (r * w + c) * 4
      img.data[o] = Math.round((n.x * 0.5 + 0.5) * 255)
      img.data[o + 1] = Math.round((n.y * 0.5 + 0.5) * 255)
      img.data[o + 2] = Math.round((n.z * 0.5 + 0.5) * 255)
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

export function neckGeometry(): THREE.BufferGeometry {
  const c = curveOf([
    [0, 1.27, -0.006],
    [0, 1.35, -0.002],
    [0, 1.43, 0.004],
  ])
  return sweep(c, (t) => 0.048 - 0.006 * t + 0.002 * Math.sin(t * Math.PI), { radial: 28, segments: 10, ellipse: [1, 0.93] })
}

// ───────────────────────── EXTREMIDADES ─────────────────────────

export const upperArmR = table([
  [-0.03, 0.033],
  [0.0, 0.038],
  [0.05, 0.037],
  [0.12, 0.034],
  [0.2, 0.03],
  [0.255, 0.027],
])
export const forearmR = table([
  [-0.02, 0.026],
  [0.0, 0.027],
  [0.05, 0.03],
  [0.12, 0.026],
  [0.2, 0.02],
  [0.218, 0.0185],
])
export const thighR = table([
  [-0.06, 0.04],
  [-0.03, 0.058],
  [0.0, 0.074],
  [0.06, 0.071],
  [0.18, 0.06],
  [0.3, 0.047],
  [0.39, 0.04],
])
export const shinR = table([
  [-0.03, 0.039],
  [0.0, 0.041],
  [0.04, 0.042],
  [0.11, 0.045],
  [0.22, 0.035],
  [0.33, 0.025],
  [0.39, 0.0235],
])

export interface LimbSeg {
  from: THREE.Vector3
  to: THREE.Vector3
  t0: number
  t1: number
  r: (t: number) => number
  ellipse: [number, number]
}

/** Segmento recto con perfil de radio (t en metros desde la articulación). */
export function limbGeometry(seg: LimbSeg, off = 0, from?: number, to?: number, caps = true, radial = 28): THREE.BufferGeometry {
  const len = seg.from.distanceTo(seg.to)
  const dir = new THREE.Vector3().subVectors(seg.to, seg.from).normalize()
  const a = from ?? seg.t0
  const b = to ?? seg.t1
  const p0 = seg.from.clone().addScaledVector(dir, a)
  const p1 = seg.from.clone().addScaledVector(dir, Math.min(b, len + 0.05))
  const c = new THREE.LineCurve3(p0, p1)
  return sweep(c, (t) => seg.r(a + (b - a) * t) + off, {
    radial,
    segments: 24,
    capStart: caps,
    capEnd: caps,
    ellipse: seg.ellipse,
    up: new THREE.Vector3(1, 0, 0),
  })
}

export function armSegs(side: 1 | -1) {
  const m = (v: THREE.Vector3) => (side === 1 ? v.clone() : mirrorX(v))
  const upper: LimbSeg = { from: m(J.shoulderL), to: m(J.elbowL), t0: -0.03, t1: 0.27, r: upperArmR, ellipse: [1, 0.94] }
  const fore: LimbSeg = { from: m(J.elbowL), to: m(J.wristL), t0: -0.02, t1: 0.222, r: forearmR, ellipse: [0.86, 1.08] }
  return { upper, fore }
}

export function legSegs(side: 1 | -1) {
  const m = (v: THREE.Vector3) => (side === 1 ? v.clone() : mirrorX(v))
  const thigh: LimbSeg = { from: m(J.hipL), to: m(J.kneeL), t0: -0.06, t1: 0.405, r: thighR, ellipse: [0.94, 1.0] }
  const shin: LimbSeg = { from: m(J.kneeL), to: m(J.ankleL), t0: -0.03, t1: 0.392, r: shinR, ellipse: [0.92, 1.0] }
  return { thigh, shin }
}

// ───────────────────────── MANOS ─────────────────────────

/**
 * Mano izquierda en reposo (local a la muñeca): palma hacia el muslo (−x),
 * dorso hacia +x, dedos hacia −y. z+ = lado del índice y del pulgar.
 */
export const FINGERS = [
  // índice, corazón, anular y meñique: [z, largo, radio, altura del nudillo]
  { z: 0.0128, len: 0.041, r: 0.0054, k: -0.0585 },
  { z: 0.0042, len: 0.045, r: 0.0056, k: -0.0598 },
  { z: -0.0045, len: 0.042, r: 0.0053, k: -0.0588 },
  { z: -0.0127, len: 0.034, r: 0.0047, k: -0.0558 },
]
/** Proporción de cada falange (proximal, media y distal). */
const PHAL = [0.46, 0.3, 0.24]

const palmHW = table([
  [0.007, 0.0168],
  [0.0, 0.0166],
  [-0.009, 0.0156],
  [-0.02, 0.0163],
  [-0.045, 0.0182],
  [-0.058, 0.0176],
])
const palmHT = table([
  [0.007, 0.0134],
  [0.0, 0.0127],
  [-0.009, 0.0104],
  [-0.016, 0.009],
  [-0.032, 0.0082],
  [-0.05, 0.0074],
  [-0.058, 0.0066],
])

/** Altura de los nudillos en función de z (interpolada entre los dedos). */
const knuckleLine = table([...FINGERS].reverse().map((f) => [f.z, f.k] as [number, number]))

/** Palma esculpida: nudillos y tendones en el dorso, eminencias tenar e hipotenar en la palma. */
function palmGeometry(): THREE.BufferGeometry {
  const y0 = 0.007
  const y1 = -0.064
  return surface(
    36,
    26,
    (u, v, out) => {
      const y = y0 + (y1 - y0) * v
      const a = u * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const se = (t: number) => Math.sign(t) * Math.pow(Math.abs(t), 2 / 2.6)
      // cierre redondeado siguiendo la línea de nudillos (el meñique nace más arriba)
      const yk = knuckleLine(palmHW(y) * se(sn)) + 0.009
      const close = y < yk ? Math.sqrt(Math.max(0, 1 - ((y - yk) / 0.0135) ** 2)) : 1
      const open = v === 0 ? 0.3 : 1
      let x = palmHT(y) * se(c) * close * open
      const z = palmHW(y) * se(sn) * close * open
      const dorsal = Math.max(0, c) ** 2
      const palmar = Math.max(0, -c) ** 1.5
      // el dorso es algo más plano y el lado de la palma más mullido
      x -= 0.0012 * palmar * gauss(y + 0.03, 0.02)
      let knuckles = 0
      let tendons = 0
      for (const f of FINGERS) {
        knuckles += gauss(z - f.z, 0.0034) * gauss(y - f.k - 0.0025, 0.0042)
        tendons += gauss(z - f.z * 0.82, 0.0017)
      }
      x += dorsal * (0.0019 * knuckles + 0.0005 * tendons * smoothstep(-0.012, -0.024, y) * (1 - smoothstep(-0.048, -0.056, y)))
      // eminencia tenar (base del pulgar) e hipotenar
      x -= palmar * (0.0032 * gauss(z - 0.0095, 0.0055) * gauss(y + 0.019, 0.01) + 0.0017 * gauss(z + 0.011, 0.005) * gauss(y + 0.032, 0.013))
      out.set(x, y, z)
    },
    { closedU: true, orient: 'auto' },
  )
}

interface FingerBuild {
  skin: THREE.BufferGeometry
  /** marco de la uña: posición, eje hacia la punta y dorso */
  nail: { at: THREE.Vector3; tip: THREE.Vector3; back: THREE.Vector3; r: number }
}

/** Dedo con tres falanges, nudillos marcados y yema; `c` = flexión. */
function fingerGeometry(f: (typeof FINGERS)[number], c: number): FingerBuild {
  const dir = (a: number) => new THREE.Vector3(-Math.sin(a), -Math.cos(a), -f.z * 0.07)
  const ang = [c * 0.85, c * 0.85 + c * 1.15, c * 0.85 + c * 1.15 + c * 0.8]
  const len = PHAL.map((k) => k * f.len)
  const mcp = new THREE.Vector3(0.0006, f.k, f.z)
  const d = ang.map((a) => dir(a).normalize())
  const pip = mcp.clone().addScaledVector(d[0], len[0])
  const dip = pip.clone().addScaledVector(d[1], len[1])
  const tip = dip.clone().addScaledVector(d[2], len[2])
  const back = 0.015
  const pts = [
    mcp.clone().addScaledVector(d[0], -back),
    mcp.clone(),
    mcp.clone().addScaledVector(d[0], len[0] * 0.5),
    pip.clone(),
    pip.clone().addScaledVector(d[1], len[1] * 0.5),
    dip.clone(),
    dip.clone().addScaledVector(d[2], len[2] * 0.55),
    tip.clone(),
  ]
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const L = curve.getLength()
  const at = (dd: number) => dd / L
  const vM = at(back)
  const vP = at(back + len[0])
  const vD = at(back + len[0] + len[1])
  const r = f.r
  const radius = (v: number, a: number) => {
    const dorsal = Math.max(0, -Math.sin(a)) ** 2
    const palmar = Math.max(0, Math.sin(a)) ** 2
    let k = r * (1 - 0.2 * smoothstep(vM, 1, v)) * (1 + 0.1 * (1 - smoothstep(0, vM * 1.5, v)))
    k *= 1 + 0.06 * gauss(v - vP, 0.03) + 0.04 * gauss(v - vD, 0.025) - 0.03 * gauss(v - (vM + vP) / 2, 0.05)
    k += dorsal * (0.0011 * gauss(v - vM, 0.035) + 0.0005 * gauss(v - vP, 0.03) + 0.0003 * gauss(v - vD, 0.025))
    // yemas
    k += palmar * (0.0004 * gauss(v - (vP + vD) / 2, 0.04) + 0.0005 * gauss(v - (vD + 1) / 2, 0.06))
    return k
  }
  const skin = sweep(curve, radius, { radial: 14, segments: 22, capStart: true, capEnd: true, ellipse: [1, 0.86], up: new THREE.Vector3(0, 0, 1) })
  const nailAt = dip.clone().addScaledVector(d[2], len[2] * 0.26)
  const backDir = new THREE.Vector3(Math.cos(ang[2]), -Math.sin(ang[2]), 0)
  return { skin, nail: { at: nailAt, tip: d[2].clone(), back: backDir, r: r * 0.8 * 0.86 } }
}

/** Pulgar con eminencia en la base; `c` = flexión hacia la palma. */
function thumbGeometry(c: number): FingerBuild {
  const k = Math.min(1, c)
  const pts: [number, number, number][] = [
    [-0.002, -0.008, 0.009],
    [-0.005, -0.018, 0.016],
    [-0.0074, -0.028, 0.0192 - 0.002 * k],
    [-0.0092 - 0.004 * k, -0.0375 + 0.002 * k, 0.0196 - 0.006 * k],
    [-0.0102 - 0.007 * k, -0.0462 + 0.004 * k, 0.0186 - 0.011 * k],
  ]
  const curve = curveOf(pts)
  const radius = (v: number, a: number) => {
    const dorsal = Math.max(0, -Math.sin(a)) ** 2
    let rr = 0.0063 - 0.0012 * smoothstep(0.15, 1, v) + 0.0012 * gauss(v - 0.12, 0.1)
    rr += dorsal * 0.0005 * gauss(v - 0.62, 0.06)
    return rr
  }
  const skin = sweep(curve, radius, { radial: 14, segments: 18, capStart: true, capEnd: true, ellipse: [1, 0.88] })
  const tipDir = curve.getTangentAt(0.88).normalize()
  const back = new THREE.Vector3(0.3, 0, 1)
  back.addScaledVector(tipDir, -back.dot(tipDir)).normalize()
  return { skin, nail: { at: curve.getPointAt(0.8), tip: tipDir, back, r: 0.0052 * 0.88 } }
}

/** Mano izquierda (local a la muñeca) con la flexión dada: piel y marcos para las uñas. */
export function handParts(curl: number): { skin: THREE.BufferGeometry; nails: FingerBuild['nail'][] } {
  const parts = [palmGeometry()]
  const nails: FingerBuild['nail'][] = []
  FINGERS.forEach((f, i) => {
    const fb = fingerGeometry(f, curl * (1 + i * 0.18) + 0.08)
    parts.push(fb.skin)
    nails.push(fb.nail)
  })
  const th = thumbGeometry(curl)
  parts.push(th.skin)
  nails.push(th.nail)
  return { skin: merge(parts), nails }
}

/** Matriz que coloca una uña (eje −y hacia la punta, dorso +x) en su dedo. */
export function nailMatrix(n: FingerBuild['nail']): THREE.Matrix4 {
  const X = n.back.clone().normalize()
  const Y = n.tip.clone().negate().normalize()
  X.addScaledVector(Y, -X.dot(Y)).normalize()
  const Z = new THREE.Vector3().crossVectors(X, Y)
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(n.at)
}

// ───────────────────────── PIES ─────────────────────────

/** Radio del pie a lo largo del recorrido talón → dedos (t 0..1). */
export function footR(t: number): number {
  return 0.024 * (0.9 + 0.35 * Math.sin(Math.min(1, t * 1.15) * Math.PI) - 0.32 * smoothstep(0.75, 1, t))
}
/** Sección del pie: [vertical, horizontal] respecto al radio. */
export const FOOT_ELLIPSE: [number, number] = [0.66, 1.0]

/**
 * Pie descalzo (local al tobillo). `arch` 0 = plano, 1 = de puntillas (tacón alto).
 */
export function footGeometry(arch = 0): THREE.BufferGeometry {
  return sweep(curveOf(footPath(arch)), footR, { radial: 20, segments: 20, capStart: true, capEnd: true, ellipse: FOOT_ELLIPSE })
}

/**
 * Recorrido talón → dedos relativo al tobillo. El pie gira hacia abajo
 * (flexión plantar) y los dedos quedan apoyados en horizontal.
 */
export function footPath(arch: number): [number, number, number][] {
  const th = arch * 0.66
  const c = Math.cos(th)
  const s = Math.sin(th)
  const rot = (z: number, y: number): [number, number, number] => [0, y * c - z * s, z * c + y * s]
  const heel = rot(-0.036, -0.044)
  const mid = rot(0.0, -0.049)
  const arc = rot(0.045, -0.054)
  const ball = rot(0.078, -0.058)
  const toe: [number, number, number] = [0, ball[1] - 0.001, ball[2] + 0.03 - arch * 0.004]
  return [heel, mid, arc, ball, toe]
}

/** Tobillo/empeine que une la pierna con el pie (siempre visible). */
export function ankleGeometry(arch: number): THREE.BufferGeometry {
  const p = footPath(arch)
  const mid = p[1]
  const arc = p[2]
  const c = curveOf([
    [0, 0.022, 0.0],
    [0, 0.0, 0.0],
    [0, (mid[1] + arc[1]) / 2 + 0.006, (mid[2] + arc[2]) / 2 - 0.004],
  ])
  return sweep(c, (t) => 0.021 - 0.003 * t, { radial: 20, segments: 10, capStart: true, capEnd: true, ellipse: [1, 0.95] })
}

/** Altura (relativa al tobillo) de la planta bajo los dedos: sirve para apoyar en el suelo. */
export function toeBottom(arch: number): number {
  const p = footPath(arch)
  return p[3][1] - footR(0.78) * FOOT_ELLIPSE[0]
}

// ───────────────────────── CABEZA ─────────────────────────

export interface FaceShape {
  lipFullness: number
}

/**
 * Esculpe la cabeza a partir de una dirección unitaria (rejilla lat/long).
 * Devuelve la posición relativa al centro de la cabeza.
 */
export function headPoint(dx: number, dy: number, dz: number, shape: FaceShape, out = new THREE.Vector3()): THREE.Vector3 {
  // afinado progresivo de la mandíbula (sin esquinas)
  const jt = Math.max(0, Math.min(1, (0.15 - dy) / 1.13))
  const jaw = jt * jt * (1.6 - 0.6 * jt)
  let sx = 1 - 0.42 * jaw
  sx *= 1 + 0.03 * gauss(dy + 0.1, 0.25)
  let sz = dz >= 0 ? 1 - 0.1 * jaw : 1 - 0.42 * jaw
  // cráneo algo mayor por detrás y arriba
  if (dz < 0) sz *= 1 + 0.07 * smoothstep(-0.2, 0.6, dy)
  const sy = 1 + (dy > 0 ? 0.02 * dy : 0.05 * dy * jaw)
  let x = dx * HEAD.rx * sx
  const y = dy * HEAD.ry * sy
  let z = dz * HEAD.rz * sz
  const front = smoothstep(0.25, 0.75, dz)
  // cara algo plana (estilo muñeca)
  z -= 0.011 * smoothstep(0.35, 1, dz) * (1 - Math.abs(dy) * 0.6)
  // barbilla redondeada
  z += 0.014 * gauss(dy + 0.8, 0.16) * Math.max(0, dz)
  // pómulos
  x *= 1 + 0.02 * gauss(dy + 0.15, 0.15) * front
  if (front > 0) {
    // nariz pequeña y respingona
    z += front * (0.0105 * gauss(x, 0.0085) * gauss(y + 0.036, 0.012) + 0.0045 * gauss(x, 0.0062) * gauss(y + 0.012, 0.02))
    // labios con volumen
    const L = shape.lipFullness
    z += front * L * (0.0058 * gauss(x, 0.02) * gauss(y + 0.068, 0.0055) + 0.0072 * gauss(x, 0.018) * gauss(y + 0.082, 0.0068))
    // cuencas de los ojos
    z -= front * 0.0045 * gauss(Math.abs(x) - 0.046, 0.019) * gauss(y + 0.002, 0.015)
    // arco de las cejas
    z += front * 0.003 * gauss(Math.abs(x) - 0.048, 0.03) * gauss(y - 0.036, 0.01)
  }
  return out.set(x, y, z)
}

/**
 * z (relativa al centro de la cabeza) de la superficie frontal en el punto (x, y)
 * de la cara. Se resuelve invirtiendo headPoint con Newton.
 */
export function headSurfaceZ(x: number, y: number, shape: FaceShape): number {
  let lon = Math.asin(Math.max(-0.99, Math.min(0.99, x / HEAD.rx)))
  let lat = Math.asin(Math.max(-0.99, Math.min(0.99, y / HEAD.ry)))
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  const at = (lo: number, la: number, out: THREE.Vector3) =>
    headPoint(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), shape, out)
  for (let i = 0; i < 12; i++) {
    at(lon, lat, p)
    const ex = p.x - x
    const ey = p.y - y
    if (Math.abs(ex) + Math.abs(ey) < 1e-7) break
    const e = 1e-4
    at(lon + e, lat, q)
    const a = (q.x - p.x) / e
    const c = (q.y - p.y) / e
    at(lon, lat + e, q)
    const b = (q.x - p.x) / e
    const d = (q.y - p.y) / e
    const det = a * d - b * c || 1e-9
    lon -= (d * ex - b * ey) / det
    lat -= (-c * ex + a * ey) / det
  }
  return at(lon, lat, p).z
}

/** Geometría de la cabeza con UV proyectadas de frente para la cara pintada. */
export function headGeometry(shape: FaceShape, nu = 96, nv = 72): THREE.BufferGeometry {
  const g = surface(
    nu,
    nv,
    (u, v, out) => {
      const lon = -Math.PI + u * Math.PI * 2
      const lat = Math.PI / 2 - v * Math.PI
      const cl = Math.cos(lat)
      headPoint(cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon), shape, out)
    },
    { closedU: true, orient: 'auto', uvMode: 'param' },
  )
  // UV planares: la cara se pinta en vista frontal.
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const lonU = uv.getX(i) // 0..1 → -π..π
    const lon = -Math.PI + lonU * Math.PI * 2
    let u = 0.5 + x / (2 * FACE.w)
    if (Math.abs(lon) > Math.PI / 2) u = lon > 0 ? 1 + (Math.abs(lon) - Math.PI / 2) : -(Math.abs(lon) - Math.PI / 2)
    const vv = 0.5 + y / (2 * FACE.h)
    uv.setXY(i, u, vv)
  }
  uv.needsUpdate = true
  g.translate(J.headCenter.x, J.headCenter.y, J.headCenter.z)
  return g
}

export function earGeometry(side: 1 | -1): THREE.BufferGeometry {
  const e = ellipsoid(0.011, 0.024, 0.017, 18, 14)
  // concavidad interior
  const pos = e.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (x > 0) pos.setX(i, x - 0.006 * gauss(y / 0.024, 0.45) * gauss(z / 0.017, 0.5))
    // lóbulo más fino abajo
    if (y < -0.012) pos.setZ(i, z * 0.8)
  }
  e.computeVertexNormals()
  e.rotateY(side === 1 ? -0.35 : Math.PI + 0.35)
  e.rotateZ(side * 0.1)
  e.translate(side * HEAD.rx * 1.0 + J.headCenter.x, J.headCenter.y - 0.012, J.headCenter.z - 0.014)
  return e
}

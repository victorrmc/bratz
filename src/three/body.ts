import * as THREE from 'three'
import { curveOf, ellipsoid, gauss, merge, smoothstep, surface, sweep, table } from './geo'

// Anatomía estilizada de muñeca fashion, construida por código.
// Todas las medidas están en la pose de reposo, en coordenadas de mundo
// (pies en y=0, mirando hacia +z). Altura total ≈ 1,69.

export const J = {
  hips: new THREE.Vector3(0, 0.84, 0),
  neck: new THREE.Vector3(0, 1.305, -0.004),
  head: new THREE.Vector3(0, 1.4, 0.0),
  headCenter: new THREE.Vector3(0, 1.5, 0.01),
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
    { closedU: true, orient: 'auto' },
  )
}

export function neckGeometry(): THREE.BufferGeometry {
  const c = curveOf([
    [0, 1.27, -0.006],
    [0, 1.35, -0.002],
    [0, 1.43, 0.004],
  ])
  return sweep(c, (t) => 0.046 - 0.006 * t + 0.002 * Math.sin(t * Math.PI), { radial: 28, segments: 10, ellipse: [1, 0.93] })
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
  [-0.06, 0.05],
  [-0.025, 0.066],
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

/** Mano izquierda en reposo: palma hacia el muslo (−x), dedos hacia −y. */
export const FINGERS = [
  // [desplazamiento z, largo, radio, curvatura]
  { z: 0.0135, len: 0.04, r: 0.0058, curl: 0.25 },
  { z: 0.0045, len: 0.044, r: 0.006, curl: 0.3 },
  { z: -0.0048, len: 0.042, r: 0.0058, curl: 0.35 },
  { z: -0.0135, len: 0.034, r: 0.0051, curl: 0.42 },
]

export function fingerCurve(f: (typeof FINGERS)[number], curlExtra = 0): THREE.CatmullRomCurve3 {
  const k = f.curl + curlExtra
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    const ang = k * t * 1.4
    pts.push([-Math.sin(ang) * f.len * t * 0.55, -0.058 - Math.cos(ang * 0.6) * f.len * t, f.z * (1 - 0.15 * t)])
  }
  return curveOf(pts)
}

export function handGeometry(curl = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  // palma: elipsoide aplanado
  const palm = ellipsoid(0.0145, 0.036, 0.023, 28, 18)
  palm.translate(0.0, -0.034, 0.0)
  parts.push(palm)
  for (const f of FINGERS) {
    parts.push(sweep(fingerCurve(f, curl), (t) => f.r * (1 - 0.18 * t), { radial: 12, segments: 8, capEnd: true, capStart: true, ellipse: [0.9, 1] }))
  }
  // pulgar
  const thumb = curveOf([
    [-0.006, -0.018, 0.018],
    [-0.012, -0.034, 0.03],
    [-0.016, -0.05, 0.034],
  ])
  parts.push(sweep(thumb, (t) => 0.0072 * (1 - 0.2 * t), { radial: 12, segments: 8, capEnd: true, capStart: true }))
  return merge(parts)
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
  const jaw = Math.pow(smoothstep(0.08, -0.98, dy), 1.35)
  let sx = 1 - 0.32 * jaw
  sx *= 1 + 0.045 * gauss(dy + 0.25, 0.32)
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

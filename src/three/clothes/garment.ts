import * as THREE from 'three'
import { J, TORSO_Y0, torsoPoint, armSegs, legSegs, limbGeometry, mirrorX, type LimbSeg } from '../body'
import { gauss, merge, smoothstep, surface, sweep, table, curveOf, lerp } from '../geo'

// Prendas ajustadas al cuerpo: torso, mangas, perneras y faldas.

export type Neck = 'crew' | 'v' | 'sweetheart' | 'tube' | 'halter' | 'square' | 'off' | 'cowl' | 'bikini' | 'none'

/** Altura del borde superior del escote en función de θ (0 = frente). */
export function necklineTop(neck: Neck): (theta: number) => number {
  return (th: number) => {
    const c = Math.cos(th)
    const s = Math.sin(th)
    const front = Math.max(0, c)
    const side = Math.abs(s)
    switch (neck) {
      case 'crew':
        return 1.302 - 0.022 * Math.pow(front, 3)
      case 'v':
        return lerp(1.3, 1.165, Math.pow(Math.max(0, 1 - Math.abs(Math.atan2(s, c)) / 0.55), 1.2))
      case 'cowl':
        return lerp(1.296, 1.19, Math.pow(Math.max(0, 1 - Math.abs(Math.atan2(s, c)) / 0.8), 1.6))
      case 'sweetheart': {
        const a = Math.atan2(s, c)
        // dos arcos sobre el pecho y un pico en el centro
        const cups = 1.188 + 0.012 * Math.cos(Math.abs(a) * 5.5) * front
        const dip = 0.022 * gauss(a, 0.07)
        return (front > 0.2 ? cups - dip : 1.18) + 0.012 * side * (1 - front)
      }
      case 'tube':
        return 1.19 + 0.004 * front
      case 'halter': {
        const a = Math.abs(Math.atan2(s, c))
        if (a < 0.9) return lerp(1.285, 1.17, Math.pow(a / 0.9, 0.8))
        return lerp(1.17, 1.08, smoothstep(0.9, 2.2, a))
      }
      case 'square':
        return front > 0.62 ? 1.205 : 1.205 + 0.04 * smoothstep(0.62, 0.3, front) * (1 - smoothstep(0, -0.6, c)) - (c < 0 ? 0.01 : 0)
      case 'off':
        return 1.218 + 0.006 * front
      case 'bikini': {
        const a = Math.atan2(s, c)
        const cupL = gauss(a - 0.45, 0.22)
        const cupR = gauss(a + 0.45, 0.22)
        return 1.105 + 0.075 * Math.max(cupL, cupR) * front
      }
      case 'none':
        return 1.3
    }
  }
}

export interface TorsoGarmentOpts {
  top: (th: number) => number
  bottom: (th: number) => number
  off: number | ((y: number, th: number) => number)
  bridge?: number
  openFront?: number
  closeBottom?: boolean
  nu?: number
  nv?: number
}

export function torsoGarment(o: TorsoGarmentOpts): THREE.BufferGeometry {
  const gap = o.openFront ?? 0
  const t0 = gap
  const t1 = Math.PI * 2 - gap
  const offF = typeof o.off === 'number' ? () => o.off as number : o.off
  return surface(
    o.nu ?? 72,
    o.nv ?? 44,
    (u, v, out) => {
      const th = t0 + (t1 - t0) * u
      const yb = o.bottom(th)
      const yt = o.top(th)
      // más filas cerca de los bordes
      const vv = v
      const y = yb + (yt - yb) * vv
      if (o.closeBottom && v === 0 && yb <= TORSO_Y0 + 0.001) {
        out.set(0, TORSO_Y0 - 0.012, 0)
        return
      }
      torsoPoint(Math.max(TORSO_Y0 + 0.0005, y), th, offF(y, th), o.bridge ?? 0.7, out)
    },
    { closedU: gap === 0, orient: 'auto' },
  )
}

/** Ribete (dobladillo) a lo largo de un borde para dar grosor a la tela. */
export function hemAlong(points: THREE.Vector3[], r = 0.0024, closed = true): THREE.BufferGeometry {
  const c = new THREE.CatmullRomCurve3(points, closed, 'centripetal')
  return sweep(c, () => r, { radial: 8, segments: Math.max(24, points.length * 2), ellipse: [1, 0.7] })
}

export function torsoEdge(yOf: (th: number) => number, off: number, gap = 0, n = 64, bridge = 0.7): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const t0 = gap
  const t1 = Math.PI * 2 - gap
  const count = gap ? n : n - 1
  for (let i = 0; i <= count; i++) {
    const th = t0 + ((t1 - t0) * i) / n
    pts.push(torsoPoint(yOf(th), th, off, bridge))
  }
  return pts
}

// ───────────────────── Mangas y perneras ─────────────────────

export function sleeve(side: 1 | -1, kind: 'upper' | 'fore', from: number, to: number, off: number | ((t: number) => number)): THREE.BufferGeometry {
  const segs = armSegs(side)
  const seg = kind === 'upper' ? segs.upper : segs.fore
  return tube(seg, from, to, off)
}

export function legTube(side: 1 | -1, kind: 'thigh' | 'shin', from: number, to: number, off: number | ((t: number) => number)): THREE.BufferGeometry {
  const segs = legSegs(side)
  return tube(kind === 'thigh' ? segs.thigh : segs.shin, from, to, off)
}

function tube(seg: LimbSeg, from: number, to: number, off: number | ((t: number) => number)): THREE.BufferGeometry {
  const offF = typeof off === 'number' ? () => off : off
  const wrapped: LimbSeg = { ...seg, r: (t) => seg.r(t) + offF(t) }
  return limbGeometry(wrapped, 0, from, to, false, 32)
}

/** Ribete al final de una manga/pernera. */
export function cuff(seg: LimbSeg, t: number, off: number, r = 0.003): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(seg.to, seg.from).normalize()
  const p = seg.from.clone().addScaledVector(dir, t)
  const rad = seg.r(t) + off
  const pts: THREE.Vector3[] = []
  const up = new THREE.Vector3(1, 0, 0)
  const n1 = up.clone().sub(dir.clone().multiplyScalar(up.dot(dir))).normalize()
  const n2 = new THREE.Vector3().crossVectors(dir, n1)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    pts.push(p.clone().addScaledVector(n1, Math.cos(a) * rad * seg.ellipse[0]).addScaledVector(n2, Math.sin(a) * rad * seg.ellipse[1]))
  }
  return hemAlong(pts, r)
}

export { armSegs, legSegs }

// ───────────────────── Faldas ─────────────────────

export interface SkirtOpts {
  waist: number
  hem: number
  flare: number
  off?: number
  pleats?: number
  tiers?: number
  slit?: number
  /** Envolvente personalizada (sirena). */
  profile?: (y: number) => number
  scallop?: number
}

const legEnvX = table([
  [0.0, 0.11],
  [0.3, 0.115],
  [0.5, 0.138],
  [0.65, 0.155],
  [0.78, 0.165],
])
const legEnvZ = table([
  [0.0, 0.085],
  [0.3, 0.075],
  [0.5, 0.082],
  [0.65, 0.094],
  [0.78, 0.1],
])

/**
 * Punto base de la falda (sin deformación dinámica). θ = 0 al frente.
 * Por encima de la cadera se ajusta al torso; por debajo, envuelve las piernas.
 */
export function skirtPoint(o: SkirtOpts, y: number, th: number, out = new THREE.Vector3()): THREE.Vector3 {
  const off = o.off ?? 0.006
  const s = Math.sin(th)
  const c = Math.cos(th)
  if (y >= 0.86) {
    torsoPoint(y, th, off, 1, out)
  } else {
    // bajo la cadera no se sigue la entrepierna: se mezcla con la envolvente de las piernas
    const k = smoothstep(0.86, 0.72, y)
    const tp = torsoPoint(0.86, th, off, 1)
    const n = 2.2
    const se = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n)
    const ex = legEnvX(y) + off
    const ez = legEnvZ(y) + off
    out.set(lerp(tp.x, ex * se(s), k), y, lerp(tp.z, ez * se(c), k))
  }
  // vuelo
  const drop = Math.max(0, 0.86 - y)
  let extra = o.flare * Math.pow(drop / 0.5, 1.15)
  if (o.profile) extra = o.profile(y)
  if (o.pleats) extra += Math.min(1, drop / 0.12) * 0.006 * Math.abs(Math.sin((th * o.pleats) / 2))
  if (o.tiers) {
    const span = (o.waist - o.hem) / o.tiers
    const f = ((o.waist - y) / span) % 1
    extra += 0.012 * smoothstep(0, 1, f) * Math.min(1, (o.waist - y) / span)
  }
  if (o.scallop) extra += o.scallop * smoothstep(0.25, 0.0, y) * (0.5 + 0.5 * Math.cos(th * 9))
  const len = Math.hypot(out.x, out.z) || 1
  out.x += (out.x / len) * extra
  out.z += (out.z / len) * extra
  return out
}

export interface SkirtGeo {
  geo: THREE.BufferGeometry
  /** Datos por vértice para la deformación dinámica. */
  rest: Float32Array
  rows: number
  cols: number
}

export function skirtGeometry(o: SkirtOpts): SkirtGeo {
  const nu = 72
  const nv = Math.max(12, Math.round((o.waist - o.hem) * 70))
  const slitTh = 0.55
  const slitTop = o.slit ? lerp(o.hem, 0.84, 0.55) : -1
  const geo = surface(
    nu,
    nv,
    (u, v, out) => {
      const y = o.waist + (o.hem - o.waist) * v
      let th = u * Math.PI * 2
      if (o.slit) {
        const gap = 0.3 * smoothstep(slitTop, o.hem, y)
        th = slitTh + gap + (Math.PI * 2 - 2 * gap) * u
      }
      skirtPoint(o, y, th, out)
    },
    { closedU: !o.slit, orient: 'auto' },
  )
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  return { geo, rest: new Float32Array(pos.array), rows: nv + 1, cols: nu + 1 }
}

export function skirtHem(o: SkirtOpts): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 72; i++) pts.push(skirtPoint(o, o.hem, (i / 72) * Math.PI * 2))
  return hemAlong(pts, 0.003)
}

/**
 * Deformación dinámica: empuja la falda hacia fuera para que nunca la
 * atraviesen las piernas (en el espacio local de la cadera).
 */
export class SkirtDeformer {
  private segs: { a: THREE.Vector3; b: THREE.Vector3; r: (t: number) => number; len: number }[] = []
  constructor(
    private sg: SkirtGeo,
    private margin = 0.012,
  ) {}

  update(legs: { a: THREE.Vector3; b: THREE.Vector3; r: (t: number) => number }[]) {
    this.segs = legs.map((l) => ({ ...l, len: l.a.distanceTo(l.b) }))
    const pos = this.sg.geo.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const rest = this.sg.rest
    const { rows, cols } = this.sg
    const prevScale = new Float32Array(cols).fill(1)
    const tmp = new THREE.Vector3()
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 3
        const x = rest[k]
        const y = rest[k + 1]
        const z = rest[k + 2]
        const rr = Math.hypot(x, z) || 1e-6
        const dx = x / rr
        const dz = z / rr
        let need = rr * prevScale[i]
        if (y < 0.88) {
          for (const s of this.segs) {
            // punto del eje de la pierna a esta altura
            const t = (s.a.y - y) / (s.a.y - s.b.y || 1e-6)
            if (t < -0.15 || t > 1.05) continue
            const tc = Math.max(0, Math.min(1, t))
            tmp.copy(s.a).lerp(s.b, tc)
            const R = (s.r(tc * s.len) + this.margin) * smoothstep(0.88, 0.8, y)
            const proj = tmp.x * dx + tmp.z * dz
            const px = tmp.x - proj * dx
            const pz = tmp.z - proj * dz
            const perp2 = px * px + pz * pz
            if (perp2 < R * R) {
              const rho = proj + Math.sqrt(R * R - perp2)
              if (rho > need) need = rho
            }
          }
        }
        const scale = need / rr
        prevScale[i] = Math.max(1, scale * 0.985)
        arr[k] = x * scale
        arr[k + 1] = y
        arr[k + 2] = z * scale
      }
    }
    pos.needsUpdate = true
    this.sg.geo.computeVertexNormals()
  }
}

export const LEG_SEGS = { L: legSegs(1), R: legSegs(-1) }
export const ARM_SEGS = { L: armSegs(1), R: armSegs(-1) }
export { mirrorX, J, merge, curveOf, sweep, surface, gauss, smoothstep, lerp, table }

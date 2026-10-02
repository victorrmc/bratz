import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { HairLook, HairPieceKind } from '../data/types'
import { HAIR_BY_ID } from '../data/hair'
import { HEAD, J, headPoint } from './body'
import { curveOf, gauss, onDetailChange, smoothstep, surface, sweep, table, torus } from './geo'
import { hairTexture } from './textures'
import { getMaterialQuality } from './materials'
import type { Piece } from './clothes/wear'

// Peinados construidos por piezas. Cada vértice lleva tres atributos:
// - `hairT` (0 = raíz, 1 = punta) para las puntas de color fantasía,
// - `hairR` (0 = raíz, 1 = largo) para oscurecer la raíz,
// - `hairDir`, la dirección del mechón, para el brillo anisotrópico.
// Coletas, trenzas, moños sueltos y melenas cuelgan de una cadena de
// huesos con muelles (física secundaria): ver `HairChain`.

export interface HairResult {
  pieces: Piece[]
  update: (time: number, k: number, head: THREE.Object3D) => void
}

const HC = J.headCenter
const FACE_SHAPE = { lipFullness: 1 }

// El polo del sistema (α, β) se inclina hacia cada oreja para que el hueco
// del casquete rodee la oreja de forma natural.
const EAR_Q = {
  L: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, -0.06, -0.1).normalize()),
  R: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-1, -0.06, -0.1).normalize()),
}
const IDQ = new THREE.Quaternion()
const tq = new THREE.Quaternion()

/** Dirección en coordenadas (α alrededor del eje x desde la frente, β hacia las orejas). */
function dirAB(a: number, b: number, out = new THREE.Vector3()) {
  out.set(Math.sin(b), Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a))
  const k = smoothstep(0.45, 1.3, Math.abs(b))
  if (k > 0) {
    tq.copy(IDQ).slerp(b > 0 ? EAR_Q.L : EAR_Q.R, k)
    out.applyQuaternion(tq)
  }
  return out
}

/** Punto sobre el cuero cabelludo + grosor `off` (coordenadas de reposo absolutas). */
export function scalp(a: number, b: number, off: number, out = new THREE.Vector3()) {
  const d = dirAB(a, b)
  headPoint(d.x, d.y, d.z, FACE_SHAPE, out)
  out.addScaledVector(d, off)
  return out.add(HC)
}

const hairlineFrontBase = table([
  [0, 0.5],
  [0.25, 0.47],
  [0.55, 0.38],
  [0.85, 0.2],
  [1.1, 0.04],
  [1.38, -0.08],
])
// pequeño zigzag de mechones en el nacimiento del pelo
const hairlineFront = (b: number) => hairlineFrontBase(b) + 0.004 * Math.sin(b * 67) + 0.003 * Math.sin(b * 31 + 1)
const hairlineBack = table([
  [0, 3.82],
  [0.6, 3.7],
  [1.0, 3.55],
  [1.38, 3.3],
])
const B_MAX = 1.38

/** `hairT` constante (o calculado) para toda la pieza; `root` fija también `hairR`. */
function withT(g: THREE.BufferGeometry, fn: (i: number, uvx: number, uvy: number) => number, root?: number): THREE.BufferGeometry {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  const arr = new Float32Array(uv.count)
  for (let i = 0; i < uv.count; i++) arr[i] = fn(i, uv.getX(i), uv.getY(i))
  g.setAttribute('hairT', new THREE.BufferAttribute(arr, 1))
  if (!g.getAttribute('hairDir')) strandAttrs(g)
  if (root !== undefined) g.setAttribute('hairR', new THREE.BufferAttribute(new Float32Array(uv.count).fill(root), 1))
  return g
}

/**
 * Dirección del mechón (derivada a lo largo de v en la rejilla) y distancia
 * a la raíz. Sin rejilla, el mechón cae hacia abajo y no hay raíz oscura.
 */
function strandAttrs(g: THREE.BufferGeometry, rootFn?: (u: number, v: number) => number) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const n = pos.count
  const dir = new Float32Array(n * 3)
  const root = new Float32Array(n).fill(1)
  const grid = g.userData.grid as { nu: number; nv: number } | undefined
  if (grid && (grid.nu + 1) * (grid.nv + 1) === n) {
    const w = grid.nu + 1
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (let j = 0; j <= grid.nv; j++) {
      for (let i = 0; i <= grid.nu; i++) {
        const k = j * w + i
        a.fromBufferAttribute(pos, j > 0 ? k - w : k)
        b.fromBufferAttribute(pos, j < grid.nv ? k + w : k)
        b.sub(a)
        if (b.lengthSq() < 1e-14) b.set(0, -1, 0)
        b.normalize()
        dir.set([b.x, b.y, b.z], k * 3)
        root[k] = rootFn ? rootFn(i / grid.nu, j / grid.nv) : j / grid.nv
      }
    }
  } else for (let k = 0; k < n; k++) dir[k * 3 + 1] = -1
  g.setAttribute('hairDir', new THREE.BufferAttribute(dir, 3))
  g.setAttribute('hairR', new THREE.BufferAttribute(root, 1))
  return g
}

/** Superficie con parámetro v = 0..1 de raíz a punta (para las puntas de color). */
function tSurface(nu: number, nv: number, fn: (u: number, v: number, out: THREE.Vector3) => void, flip = false): THREE.BufferGeometry {
  const g = surface(nu, nv, fn, { flip })
  const { nu: gu, nv: gv } = g.userData.grid as { nu: number; nv: number }
  const arr = new Float32Array((gu + 1) * (gv + 1))
  for (let j = 0; j <= gv; j++) for (let i = 0; i <= gu; i++) arr[j * (gu + 1) + i] = j / gv
  g.setAttribute('hairT', new THREE.BufferAttribute(arr, 1))
  return strandAttrs(g)
}

function tSweep(curve: THREE.Curve<THREE.Vector3>, r: (t: number, a: number) => number, opts: Parameters<typeof sweep>[2] = {}): THREE.BufferGeometry {
  const g = sweep(curve, r, { ...opts, capStart: false, capEnd: false })
  const { nu: radial, nv: segs } = g.userData.grid as { nu: number; nv: number }
  const arr = new Float32Array((radial + 1) * (segs + 1))
  for (let j = 0; j <= segs; j++) for (let i = 0; i <= radial; i++) arr[j * (radial + 1) + i] = j / segs
  g.setAttribute('hairT', new THREE.BufferAttribute(arr, 1))
  return strandAttrs(g)
}

const ATTR_DEFAULTS: Record<string, number[]> = { uv: [0, 0], hairT: [0], hairR: [1], hairDir: [0, -1, 0], color: [1, 1, 1] }

/** Fusiona piezas conservando los atributos del pelo (rellena los que falten). */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const keep = ['position', 'normal', ...Object.keys(ATTR_DEFAULTS).filter((k) => parts.some((g) => g.getAttribute(k)))]
  const cleaned = parts.map((g) => {
    const c = (g.index ? g : mergeVertices(g)).clone()
    for (const k of Object.keys(c.attributes)) if (!keep.includes(k)) c.deleteAttribute(k)
    for (const k of keep) {
      if (c.getAttribute(k)) continue
      const d = ATTR_DEFAULTS[k]
      const arr = new Float32Array(c.getAttribute('position').count * d.length)
      for (let i = 0; i < arr.length; i++) arr[i] = d[i % d.length]
      c.setAttribute(k, new THREE.BufferAttribute(arr, d.length))
    }
    return c
  })
  const m = mergeGeometries(cleaned, false)
  if (!m) throw new Error('merge failed')
  return m
}

/** Generador pseudoaleatorio con semilla (mismo pelo en cada carga). */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ─────────────────────── Piezas ───────────────────────

function cap(params: Record<string, number>, sleek: boolean): THREE.BufferGeometry {
  const off = sleek ? 0.0065 : 0.012 + (params.volume ?? 0) * 0.01
  const part = params.part ?? (sleek ? 1 : 0)
  const high = params.high ?? 0
  const alpha = (ab: number, v: number) => {
    const a0 = hairlineFront(ab)
    const a1 = high ? Math.max(2.4, hairlineBack(ab) - 0.35 * high) : hairlineBack(ab)
    return a0 + (a1 - a0) * v
  }
  const g = surface(
      64,
      56,
      (u, v, out) => {
        const b = (u - 0.5) * 2 * B_MAX
        const ab = Math.abs(b)
        const a = alpha(ab, v)
        // grosor: se funde con la piel en el nacimiento del pelo
        const edgeF = smoothstep(0, 0.09, v)
        const edgeB = smoothstep(1, 0.86, v)
        const edgeS = smoothstep(B_MAX, B_MAX - 0.18, ab)
        let o = 0.0012 + off * Math.min(edgeF, edgeB, edgeS)
        // volumen en la coronilla
        if (!sleek) o += 0.006 * gauss(a - 1.4, 0.7) * (1 - ab / B_MAX)
        // raya al medio: surco suave en la parte delantera
        if (part) o -= 0.0058 * gauss(b, 0.045) * smoothstep(1.9, 0.6, a) * Math.min(1, edgeF * 2)
        scalp(a, b, Math.max(0.0016, o), out)
      },
      { orient: 'auto' },
    )
  // raíz oscura: en la raya y, más suave, en el nacimiento del pelo
  strandAttrs(g, (u, v) => {
    const b = (u - 0.5) * 2 * B_MAX
    const a = alpha(Math.abs(b), v)
    const onPart = part ? gauss(b, 0.04) * smoothstep(1.9, 0.6, a) : 0
    return Math.min(1 - 0.95 * onPart, 0.15 + smoothstep(0, 0.05, v))
  })
  return withT(g, () => 0)
}

/** Mechones peinados sobre el casquete: dan textura y evitan el aspecto de casco. */
function locks(params: Record<string, number>, sleek: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const off = sleek ? 0.0075 : 0.014 + (params.volume ?? 0) * 0.01
  const n = 26
  for (let i = 0; i < n; i++) {
    const b = ((i + 0.5 + 0.3 * Math.sin(i * 7.3)) / n - 0.5) * 2 * (B_MAX - 0.12)
    const ab = Math.abs(b)
    const a0 = hairlineFront(ab) + 0.04
    const a1 = (params.high ? 2.3 : hairlineBack(ab)) - 0.15
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (a1 - a0) * (k / 10)
      // los mechones se separan un poco de la raya y vuelven a juntarse atrás
      const bb = b * (1 + 0.06 * Math.sin((k / 10) * Math.PI))
      const p = scalp(a, bb, off + 0.0012 * Math.sin((k / 10) * Math.PI))
      pts.push([p.x, p.y, p.z])
    }
    parts.push(tSweep(curveOf(pts), (t) => (0.0032 + 0.0012 * Math.sin(i * 3.1)) * Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * (1 - 0.6 * t), { radial: 6, segments: 30, ellipse: [0.3, 1] }))
  }
  return merge(parts.map((g) => withT(g, () => 0)))
}

/** Moño retorcido (espiral) orientado según `dir`. */
function bun(anchor: THREE.Vector3, dir: THREE.Vector3, size = 1): THREE.BufferGeometry {
  const pts: [number, number, number][] = []
  const turns = 2.6
  const N = 80
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const ang = t * turns * Math.PI * 2
    const r = 0.03 * size * (1 - 0.7 * t)
    const h = 0.018 * size * Math.sin(t * Math.PI * 0.85) + 0.016 * size * t
    pts.push([Math.cos(ang) * r, h, Math.sin(ang) * r])
  }
  const g = tSweep(curveOf(pts), (t) => (0.0225 - 0.009 * t) * size, { radial: 16, segments: 120, ellipse: [1, 0.8], twist: 18 })
  orientTo(g, anchor, dir)
  return withT(g, () => 0, 1)
}

function orientTo(g: THREE.BufferGeometry, anchor: THREE.Vector3, dir: THREE.Vector3) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  g.applyQuaternion(q)
  const hd = g.getAttribute('hairDir') as THREE.BufferAttribute | undefined
  if (hd) {
    const v = new THREE.Vector3()
    for (let i = 0; i < hd.count; i++) {
      v.fromBufferAttribute(hd, i).applyQuaternion(q)
      hd.setXYZ(i, v.x, v.y, v.z)
    }
  }
  g.translate(anchor.x, anchor.y, anchor.z)
}

function hairTie(anchor: THREE.Vector3, dir: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = torus(r, 0.0045, 24, 8)
  strandAttrs(g)
  orientTo(g, anchor, dir)
  return withT(g, () => 0, 1)
}

/** Recorrido de una coleta: sale del ancla y cae con gravedad. */
function ponyCurve(anchor: THREE.Vector3, out: THREE.Vector3, length: number, wave: number, side = 0): THREE.CatmullRomCurve3 {
  const pts: [number, number, number][] = []
  const N = 9
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const outw = out.clone().multiplyScalar(0.05 * Math.min(1, t * 3) + 0.03 * t)
    const fall = -length * Math.pow(t, 1.25)
    const w = wave ? Math.sin(t * Math.PI * 3.2) * 0.022 * t : 0
    pts.push([anchor.x + outw.x + w + side * t * 0.02, anchor.y + outw.y * 0.6 + fall, anchor.z + outw.z - 0.012 * t + w * 0.4])
  }
  return curveOf(pts)
}

/** Coleta; con `bubbles` > 0 se divide en burbujas separadas por gomas. */
function pony(c: THREE.Curve<THREE.Vector3>, wave: number, thick = 1, bubbles = 0): THREE.BufferGeometry {
  const g = tSweep(
    c,
    (t, a) => {
      const base = (0.022 + 0.012 * Math.sin(Math.min(1, t * 2.2) * Math.PI)) * thick
      const tip = 1 - smoothstep(bubbles ? 0.8 : 0.55, 1, t) * 0.92
      const flut = wave ? 1 + 0.12 * Math.sin(a * 5 + t * 20) : 1 + 0.05 * Math.sin(a * 7)
      // burbujas: el grosor se estrangula en cada goma
      const bub = bubbles ? 0.45 + 0.75 * Math.pow(Math.abs(Math.sin(t * bubbles * Math.PI)), 0.6) : 1
      return base * tip * flut * bub
    },
    { radial: 18, segments: bubbles ? 72 : 36, ellipse: [1, 0.8] },
  )
  if (!bubbles) return g
  const parts = [g]
  for (let k = 1; k < bubbles; k++) {
    const t = k / bubbles
    const r = (0.022 + 0.012 * Math.sin(Math.min(1, t * 2.2) * Math.PI)) * thick * 0.45
    parts.push(hairTie(c.getPointAt(t), c.getTangentAt(t), r + 0.002))
  }
  return merge(parts)
}

/** Nodos equiespaciados a lo largo de una curva (para la cadena de física). */
function nodesOf(c: THREE.Curve<THREE.Vector3>, n: number): THREE.Vector3[] {
  return Array.from({ length: n + 1 }, (_, k) => c.getPointAt(k / n))
}

/** Melena larga detrás de los hombros. */
type CurtainStyle = 'straight' | 'wavy' | 'curly' | 'bob'
const curtainAx = table([
  [1.0, 0.15],
  [1.2, 0.16],
  [1.3, 0.17],
  [1.38, 0.155],
  [1.5, HEAD.rx + 0.02],
  [1.6, HEAD.rx + 0.02],
])
const curtainAz = table([
  [0.9, 0.105],
  [1.15, 0.098],
  [1.27, 0.1],
  [1.38, 0.125],
  [1.5, HEAD.rz + 0.016],
  [1.6, HEAD.rz + 0.016],
])

/** Punto de la melena (u = alrededor, v = raíz → punta) y su dirección hacia fuera. */
function curtainPoint(length: number, style: CurtainStyle, u: number, v: number, out: THREE.Vector3, outward?: THREE.Vector3) {
  const bob = style === 'bob'
  const tmp = new THREE.Vector3()
  const yTop = HC.y + 0.03
  const yEnd = bob ? HC.y - 0.125 : 1.3 - length
  {
    {
      const s = (u - 0.5) * 2 // −1..1
      const y = yTop + (yEnd - yTop) * v
      // ángulo alrededor (0 = espalda). A la altura de la cabeza abraza los lados.
      const headZone = smoothstep(HC.y - 0.16, HC.y - 0.02, y)
      const phiMax = bob ? 2.05 : 0.95 + 1.0 * headZone
      const phi = s * phiMax
      // radio horizontal: cabeza → hombros → espalda
      let ax: number
      let az: number
      if (bob) {
        ax = HEAD.rx + 0.022 + 0.02 * v
        az = HEAD.rz + 0.018 + 0.01 * v
      } else {
        const shoulder = gauss(y - 1.25, 0.06)
        ax = curtainAx(y) + 0.01 * shoulder
        az = curtainAz(y)
      }
      let x = Math.sin(phi) * ax
      let z = -Math.cos(phi) * az
      // centrado en la cabeza arriba y en el torso abajo
      const zc = HC.z * headZone + -0.012 * (1 - headZone)
      z += zc
      // ondas
      if (style === 'wavy') {
        const w = Math.sin(v * Math.PI * 4.5 + s * 1.5) * 0.012 * smoothstep(0.15, 0.5, v)
        x += Math.sin(phi) * w
        z -= Math.cos(phi) * w
      }
      if (bob) {
        // las puntas se recogen hacia dentro
        const curl = smoothstep(0.7, 1, v) * 0.018
        x -= Math.sin(phi) * curl
        z += Math.cos(phi) * curl
      }
      // arranque en el cuero cabelludo: mezcla con un punto del casquete
      const blend = smoothstep(0.0, 0.25, v)
      if (blend < 1 && !bob) {
        scalp(3.0 - Math.cos(phi) * 0.6, phi * 0.6, 0.012, tmp)
        out.set(tmp.x + (x - tmp.x) * blend, y, tmp.z + (z - tmp.z) * blend)
      } else out.set(x, y, z)
      // las puntas se abren ligeramente
      out.x *= 1 + 0.06 * v * Math.abs(s)
      outward?.set(Math.sin(phi), 0, -Math.cos(phi))
    }
  }
  return out
}

/** Melena larga detrás de los hombros, con mechones sueltos en el contorno. */
function curtain(length: number, style: CurtainStyle, strays = 0): THREE.BufferGeometry {
  const bob = style === 'bob'
  const g = tSurface(44, bob ? 18 : 40, (u, v, out) => curtainPoint(length, style, u, v, out), true)
  strandAttrs(g, (_u, v) => v * 2.5)
  if (!strays) return g
  const parts = [g]
  const r = rng(91)
  const p = new THREE.Vector3()
  const o = new THREE.Vector3()
  for (let i = 0; i < strays; i++) {
    // por los lados y la espalda, donde se ve la silueta
    const u = r() < 0.5 ? 0.03 + r() * 0.2 : 0.77 + r() * 0.2
    const v0 = 0.12 + r() * 0.3
    const v1 = Math.min(1, v0 + 0.35 + r() * 0.45)
    const lift = 0.004 + r() * 0.012
    const ph = r() * 6
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      curtainPoint(length, style, u + 0.03 * Math.sin(t * 3 + ph), v0 + (v1 - v0) * t, p, o)
      p.addScaledVector(o, 0.003 + lift * Math.sin(t * Math.PI * 0.9))
      pts.push([p.x, p.y, p.z])
    }
    const sg = tSweep(curveOf(pts), (t) => 0.0016 * (1 - 0.7 * t), { radial: 5, segments: 12 })
    withT(sg, (k) => v0 + (v1 - v0) * ((sg.getAttribute('hairR') as THREE.BufferAttribute).getX(k)), 1)
    parts.push(sg)
  }
  return merge(parts)
}

/**
 * Mechones sueltos sobre el contorno de la cabeza: salen del casquete y se
 * despegan un poco, para romper la silueta de casco.
 */
function flyaways(params: Record<string, number>, sleek: boolean, count: number): THREE.BufferGeometry {
  const r = rng(sleek ? 7 : 13)
  const off = sleek ? 0.0075 : 0.014 + (params.volume ?? 0) * 0.01
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const b0 = (r() - 0.5) * 2 * (B_MAX - 0.25)
    const ab = Math.abs(b0)
    const aMax = (params.high ? 2.2 : hairlineBack(ab) - 0.4) - 0.3
    const a0 = hairlineFront(ab) + 0.12 + r() * Math.max(0.1, aMax - hairlineFront(ab) - 0.12)
    const len = (sleek ? 0.035 : 0.05) + r() * 0.06
    const drift = (r() - 0.5) * 0.3
    const lift = (sleek ? 0.003 : 0.006) + r() * 0.01
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      const p = scalp(a0 + (t * len) / 0.14, b0 + drift * t, off + 0.001 + lift * t * t)
      pts.push([p.x, p.y, p.z])
    }
    parts.push(tSweep(curveOf(pts), (t) => 0.0008 * (1 - 0.6 * t), { radial: 5, segments: 10 }))
  }
  return merge(parts.map((g) => withT(g, () => 0)))
}

function curls(length: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const n = 30
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1) - 0.5) * 2
    const phi = s * 2.05
    const top = HC.y + 0.02 - Math.abs(s) * 0.03
    const yEnd = top - 0.15 - length * (0.85 + 0.15 * Math.cos(i * 1.7))
    const pts: [number, number, number][] = []
    const N = 70
    for (let k = 0; k <= N; k++) {
      const t = k / N
      const y = top + (yEnd - top) * t
      const hz = smoothstep(HC.y - 0.2, HC.y, y)
      const ax = (0.17 + 0.03 * Math.sin(t * Math.PI)) * (1 - hz) + (HEAD.rx + 0.03) * hz
      const az = (0.12 + 0.02 * Math.sin(t * Math.PI)) * (1 - hz) + (HEAD.rz + 0.028) * hz
      const ph = phi * (0.62 + 0.38 * hz)
      const cx = Math.sin(ph) * ax
      const cz = -Math.cos(ph) * az + HC.z * hz
      const ang = t * 13 + i
      const rr = 0.019 * (0.7 + t * 0.5)
      pts.push([cx + Math.cos(ang) * rr, y, cz + Math.sin(ang) * rr])
    }
    parts.push(tSweep(curveOf(pts), (t) => 0.0135 * (1 - 0.45 * t), { radial: 10, segments: 90 }))
  }
  // volumen superior (coronilla rizada)
  for (let i = 0; i < 9; i++) {
    const b = (i / 8 - 0.5) * 2.2
    const a = 1.1 + (i % 2) * 0.35
    const anchor = scalp(a, b, 0.018)
    const dir = dirAB(a, b)
    const g = bun(anchor, dir, 0.55)
    parts.push(g)
  }
  return merge(parts.map((p) => withT(p, () => 0.3)))
}

function faceStrands(length: number, wave: number, short = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const start = scalp(0.3, s * 0.95, 0.01)
    if (short) {
      // mechones cortos y ondulados que enmarcan la cara en los recogidos
      const pts: [number, number, number][] = []
      for (let k = 0; k <= 8; k++) {
        const t = k / 8
        const y = start.y + (HC.y - 0.13 - start.y) * t
        const x = s * (HEAD.rx + 0.004 + 0.008 * Math.sin(t * Math.PI)) + s * Math.sin(t * 9) * 0.006 * t
        pts.push([t < 0.15 ? start.x + (x - start.x) * (t / 0.15) : x, y, start.z + (HC.z + 0.04 - start.z) * smoothstep(0, 0.4, t)])
      }
      parts.push(tSweep(curveOf(pts), (t) => 0.007 * (1 - 0.75 * t), { radial: 10, segments: 30, ellipse: [0.5, 1] }))
      continue
    }
    const pts: [number, number, number][] = [
      [start.x, start.y, start.z],
      [s * (HEAD.rx + 0.006), HC.y - 0.02, HC.z + 0.05],
      [s * 0.125, HC.y - 0.12, HC.z + 0.035],
      [s * 0.118, 1.29, 0.068],
      [s * 0.11, 1.29 - length * 0.5, 0.098],
      [s * 0.105, 1.29 - length, 0.1],
    ]
    if (wave) for (let i = 2; i < pts.length; i++) pts[i][0] += Math.sin(i * 2.2) * 0.012 * s
    parts.push(tSweep(curveOf(pts), (t) => 0.019 * (1 - smoothstep(0.6, 1, t) * 0.8), { radial: 14, segments: 40, ellipse: [0.45, 1] }))
  }
  return merge(parts)
}

function bangs(straight: boolean): THREE.BufferGeometry {
  if (straight) {
    return tSurface(
      36,
      12,
      (u, v, out) => {
        const b = (u - 0.5) * 2 * 1.05
        const a = 1.15 - v * 1.05
        const p = scalp(Math.max(a, 0.18), b, 0.014 + 0.004 * (1 - v))
        if (a < 0.18) {
          // cae recto por delante de la frente
          const q = scalp(0.18, b, 0.014)
          p.copy(q)
          p.y -= (0.18 - a) * 0.12
          p.z += (0.18 - a) * 0.02
        }
        out.copy(p)
      },
      false,
    )
  }
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 6; i++) {
      const t = i / 6
      const a = 1.2 - t * 1.25
      const b = s * (0.06 + t * 0.85)
      const p = scalp(Math.max(a, 0.05), b, 0.016)
      if (a < 0.05) p.y -= (0.05 - a) * 0.1
      pts.push([p.x, p.y, p.z])
    }
    parts.push(tSweep(curveOf(pts), (t) => 0.021 * (1 - 0.5 * t), { radial: 14, segments: 30, ellipse: [1, 0.35] }))
  }
  return merge(parts)
}

/**
 * Trenza de tres cabos a lo largo de `path`. `ref(p)` da la normal de
 * referencia (hacia fuera); `width` es la amplitud del cruce.
 */
function plait(path: THREE.Curve<THREE.Vector3>, opts: { width: number; r: number; crosses: number; ref?: (p: THREE.Vector3) => THREE.Vector3; taper?: number; segs?: number }): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const taper = opts.taper ?? 0.45
  const side = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const N = opts.segs ?? 80
  for (let k = 0; k < 3; k++) {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = path.getPointAt(t)
      const tan = path.getTangentAt(t)
      side.crossVectors(tan, opts.ref ? opts.ref(p) : new THREE.Vector3(0, 0, 1)).normalize()
      fwd.crossVectors(side, tan).normalize()
      const ph = t * opts.crosses * Math.PI + (k * Math.PI * 2) / 3
      const w = opts.width * (1 - taper * t) * smoothstep(0, 0.12, t)
      p.addScaledVector(side, Math.sin(ph) * w).addScaledVector(fwd, Math.cos(ph * 2) * w * 0.4)
      pts.push([p.x, p.y, p.z])
    }
    parts.push(tSweep(curveOf(pts), (t) => opts.r * (1 - taper * t), { radial: 10, segments: Math.round(N * 1.5) }))
  }
  return merge(parts)
}

/** Recorrido de una de las dos trenzas que caen por delante de los hombros. */
function braidPath(s: number, length: number) {
  const start = scalp(2.2, s * 1.05, 0.006)
  return curveOf([
    [start.x, start.y, start.z],
    [s * 0.135, HC.y - 0.14, -0.01],
    [s * 0.13, 1.28, 0.06],
    [s * 0.12, 1.28 - length * 0.5, 0.095],
    [s * 0.115, 1.28 - length, 0.098],
  ])
}

function braid(path: THREE.Curve<THREE.Vector3>, width = 0.009, r = 0.0095, crosses = 16): THREE.BufferGeometry {
  const tieP = path.getPointAt(0.9)
  // un pincelito de pelo suelto tras la goma
  const tail = tSweep(
    curveOf([0.9, 0.95, 1].map((t) => path.getPointAt(t).toArray() as [number, number, number])),
    (t) => r * 1.25 * (0.75 + 0.5 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5)) * (1 - smoothstep(0.6, 1, t) * 0.85),
    { radial: 12, segments: 10 },
  )
  return merge([plait(path, { width, r, crosses }), withT(tail, () => 0.95), withT(hairTie(tieP, path.getTangentAt(0.9), width * 0.8), () => 0.9)])
}

/** Trenza de espiga lateral: nace en la nuca y cae sobre un hombro. */
function braidSidePath(s: number, length: number) {
  const start = scalp(3.15, s * 0.55, 0.008)
  return curveOf([
    [start.x, start.y, start.z],
    [s * 0.075, HC.y - 0.12, -0.085],
    [s * 0.125, 1.36, -0.03],
    [s * 0.135, 1.29, 0.055],
    [s * 0.12, 1.29 - length * 0.5, 0.098],
    [s * 0.11, 1.29 - length, 0.104],
  ])
}

/** Hilo del pelo que barre la nuca hasta la trenza lateral (para que no quede calva). */
function sweepToSide(s: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 7; i++) {
    const b = (-0.95 + (i / 6) * 1.9) * B_MAX * 0.8
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      const p = scalp(2.6 + 0.6 * t, b + (s * 0.55 - b) * t * t, 0.012 + 0.004 * Math.sin(t * Math.PI))
      pts.push([p.x, p.y, p.z])
    }
    parts.push(tSweep(curveOf(pts), (t) => 0.012 * (1 - 0.3 * t), { radial: 10, segments: 24, ellipse: [0.45, 1] }))
  }
  return merge(parts.map((g) => withT(g, () => 0, 1)))
}

/** Corona trenzada que rodea la parte de atrás de la cabeza de sien a sien. */
function braidCrown(): THREE.BufferGeometry {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 14; i++) {
    const b = (i / 14 - 0.5) * 2 * 1.22
    const p = scalp(2.72 - 0.75 * Math.pow(b / 1.22, 2), b, 0.016)
    pts.push([p.x, p.y, p.z])
  }
  const path = curveOf(pts)
  const g = plait(path, { width: 0.008, r: 0.0085, crosses: 22, taper: 0, segs: 110, ref: (p) => p.clone().sub(HC).normalize() })
  return withT(g, () => 0.15, 1)
}

/**
 * Moño suelto: base retorcida, lazadas flojas por encima y mechones
 * colgantes (cada uno con su propia cadena de física).
 */
function messyBun(anchor: THREE.Vector3, dir: THREE.Vector3, size: number, seed: number) {
  const r = rng(seed)
  const d = dir.clone().normalize()
  const e1 = new THREE.Vector3(0, 1, 0).cross(d)
  if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0)
  e1.normalize()
  const e2 = d.clone().cross(e1).normalize()
  const parts: THREE.BufferGeometry[] = [bun(anchor, d, 0.85 * size)]
  const centre = anchor.clone().addScaledVector(d, 0.026 * size)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + r() * 0.6
    // plano de la lazada: contiene la dirección del moño, girado alrededor de ella
    const u = e1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(e2, Math.sin(ang))
    const v = d.clone().multiplyScalar(0.8).addScaledVector(u.clone().cross(d), 0.35 * (r() - 0.5)).normalize()
    const R = (0.022 + r() * 0.01) * size
    const c = centre.clone().addScaledVector(u, 0.006 * size)
    const span = Math.PI * (1.45 + r() * 0.35)
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 14; k++) {
      const a = -0.25 + (k / 14) * span
      const p = c.clone().addScaledVector(u, Math.cos(a) * R).addScaledVector(v, Math.sin(a) * R * 0.9)
      pts.push([p.x, p.y, p.z])
    }
    parts.push(tSweep(curveOf(pts), (t) => 0.0085 * size * (0.55 + 0.45 * Math.sin(t * Math.PI)), { radial: 10, segments: 36, ellipse: [1, 0.7] }))
  }
  const body = merge(parts.map((g) => withT(g, () => 0.2, 1)))
  const tendrils: { g: THREE.BufferGeometry; nodes: THREE.Vector3[] }[] = []
  for (let i = 0; i < 3; i++) {
    const ang = -Math.PI / 2 + (i - 1) * 1.1 + (r() - 0.5) * 0.3
    const u = e1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(e2, Math.sin(ang))
    const start = centre.clone().addScaledVector(u, 0.022 * size)
    const len = (0.07 + r() * 0.05) * size
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      const p = start.clone().addScaledVector(u, 0.012 * t).addScaledVector(d, 0.01 * t)
      p.y -= len * t
      p.x += Math.sin(t * 7 + i) * 0.006 * t
      pts.push([p.x, p.y, p.z])
    }
    const c = curveOf(pts)
    tendrils.push({ g: tSweep(c, (t) => 0.0042 * (1 - 0.75 * t), { radial: 8, segments: 24 }), nodes: nodesOf(c, 3) })
  }
  return { body, tendrils }
}

// ─────────────────────── Flores ───────────────────────

const FLOWER_KINDS = {
  // flor de almendro: blanca con el centro rosa
  almendro: { petals: 5, color: '#fff6f4', tip: '#ffd9e4', centre: '#d84a78', size: 0.028 },
  // buganvilla: tres brácteas magenta con el centro crema
  buganvilla: { petals: 3, color: '#d81b84', tip: '#ff5fb4', centre: '#fff1c2', size: 0.026 },
  // jazmín: pequeño y blanco
  jazmin: { petals: 5, color: '#ffffff', tip: '#fffbe8', centre: '#ffd34d', size: 0.019 },
}

function colored(g: THREE.BufferGeometry, fn: (u: number, v: number) => THREE.Color): THREE.BufferGeometry {
  const { nu, nv } = g.userData.grid as { nu: number; nv: number }
  const arr = new Float32Array((nu + 1) * (nv + 1) * 3)
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) arr.set(fn(i / nu, j / nv).toArray(), (j * (nu + 1) + i) * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

/** Pétalo (u = de lado a lado, v = de la base a la punta) en el plano XY, ahuecado hacia +Z. */
function petal(len: number, width: number, angle: number, cup: number, base: THREE.Color, tip: THREE.Color) {
  const g = surface(
    6,
    6,
    (u, v, out) => {
      const across = (u - 0.5) * 2 * width * Math.pow(Math.sin(Math.PI * Math.min(0.98, 0.15 + v * 0.85)), 0.8)
      const along = len * v
      const z = cup * len * v * v + 0.25 * cup * Math.abs(across)
      out.set(Math.cos(angle) * along - Math.sin(angle) * across, Math.sin(angle) * along + Math.cos(angle) * across, z)
    },
    { fixed: true, uvMode: 'param' },
  )
  return colored(g, (_u, v) => base.clone().lerp(tip, v))
}

function flower(pos: THREE.Vector3, normal: THREE.Vector3, kind: keyof typeof FLOWER_KINDS, scale: number, spin: number): THREE.BufferGeometry {
  const f = FLOWER_KINDS[kind]
  const len = f.size * scale
  const base = new THREE.Color(f.color)
  const tip = new THREE.Color(f.tip)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < f.petals; i++) {
    const a = spin + (i / f.petals) * Math.PI * 2
    parts.push(petal(len, len * (f.petals === 3 ? 0.62 : 0.42), a, f.petals === 3 ? 0.35 : 0.22, base.clone().multiplyScalar(0.92), tip))
  }
  const c = new THREE.Color(f.centre)
  parts.push(
    colored(
      surface(8, 5, (u, v, out) => {
        const th = u * Math.PI * 2
        const ph = (v * Math.PI) / 2
        const r = len * 0.22
        out.set(Math.cos(th) * Math.cos(ph) * r, Math.sin(th) * Math.cos(ph) * r, Math.sin(ph) * r * 0.8 + len * 0.04)
      }, { fixed: true, uvMode: 'param', closedU: true }),
      () => c,
    ),
  )
  const g = merge(parts)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize()))
  g.translate(pos.x, pos.y, pos.z)
  return g
}

function leaf(pos: THREE.Vector3, normal: THREE.Vector3, angle: number, scale: number): THREE.BufferGeometry {
  const g = petal(0.022 * scale, 0.006 * scale, angle, 0.12, new THREE.Color('#3f8a3a'), new THREE.Color('#79c25a'))
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize()))
  g.translate(pos.x, pos.y, pos.z)
  return g
}

/** Flores del recogido de boda: alrededor del moño y un ramillete junto a la sien. */
function weddingFlowers(): THREE.BufferGeometry {
  const r = rng(2026)
  const parts: THREE.BufferGeometry[] = []
  const put = (a: number, b: number, kind: keyof typeof FLOWER_KINDS, scale: number, lift = 0.022) => {
    const n = dirAB(a, b)
    const p = scalp(a, b, lift)
    parts.push(flower(p, n, kind, scale, r() * 6))
    if (r() < 0.6) parts.push(leaf(p.clone().addScaledVector(n, -0.004), n, r() * 6, 0.9 + r() * 0.3))
  }
  // corona alrededor del moño (ancla baja a = 3.55)
  const ring: [number, number, keyof typeof FLOWER_KINDS][] = [
    [3.05, 0.0, 'almendro'],
    [3.12, 0.42, 'buganvilla'],
    [3.12, -0.42, 'jazmin'],
    [3.4, 0.62, 'almendro'],
    [3.4, -0.62, 'buganvilla'],
    [3.3, 0.22, 'jazmin'],
    [3.3, -0.22, 'almendro'],
  ]
  for (const [a, b, k] of ring) put(a, b, k, 0.9 + r() * 0.3)
  // ramillete en la sien izquierda, donde termina la corona trenzada
  put(2.0, 1.12, 'almendro', 1.35, 0.026)
  put(2.2, 1.2, 'buganvilla', 1.1, 0.024)
  put(1.84, 1.18, 'jazmin', 1.0, 0.024)
  put(2.08, 0.98, 'jazmin', 0.9, 0.026)
  return merge(parts)
}

let flowerMat: THREE.MeshPhysicalMaterial | null = null
function flowerMaterial() {
  flowerMat ??= new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.55,
    sheen: 0.6,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
  })
  return flowerMat
}

// ─────────────────────── Material ───────────────────────

/**
 * Material del pelo: brillo anisotrópico de Kajiya-Kay con dos lóbulos
 * (uno blanco desplazado hacia la raíz y otro teñido y granulado hacia la
 * punta), raíz más oscura y puntas de color fantasía.
 */
function hairMaterial(h: HairLook): THREE.MeshPhysicalMaterial {
  const q = getMaterialQuality()
  const base = new THREE.Color(h.base)
  const m = new THREE.MeshPhysicalMaterial({
    map: hairTexture(h.base, h.highlights, h.highlightsOn, h.tips, false),
    roughness: 0.72 - h.shine * 0.12,
    specularIntensity: 0.35,
    sheen: q === 'baja' ? 0 : 0.2,
    sheenRoughness: 0.5,
    sheenColor: base.clone().lerp(new THREE.Color('#ffffff'), 0.25),
    side: THREE.DoubleSide,
  })
  const lum = Math.max(0.03, (base.r + base.g + base.b) / 3)
  const uniforms = {
    tipsColor: { value: new THREE.Color(h.tips) },
    tipsOn: { value: h.tipsOn ? 1 : 0 },
    kkColor: { value: base.clone().lerp(new THREE.Color('#ffffff'), 0.35) },
    kkShine: { value: 0.05 + 0.16 * h.shine },
    kkExp: { value: 40 + 110 * h.shine },
    baseLum: { value: lum },
    rootDark: { value: 0.55 },
  }
  m.userData.hairUniforms = uniforms
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float hairT;\nattribute float hairR;\nattribute vec3 hairDir;\nvarying float vHairT;\nvarying float vHairR;\nvarying vec3 vHairDir;')
      .replace(
        '#include <skinnormal_vertex>',
        `#include <skinnormal_vertex>
        vec3 hDir = hairDir;
        #ifdef USE_SKINNING
          hDir = (skinMatrix * vec4(hDir, 0.0)).xyz;
        #endif
        vHairDir = normalize((modelViewMatrix * vec4(hDir, 0.0)).xyz);`,
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairT = hairT;\nvHairR = hairR;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 tipsColor;\nuniform float tipsOn;\nuniform vec3 kkColor;\nuniform float kkShine;\nuniform float kkExp;\nuniform float baseLum;\nuniform float rootDark;\nvarying float vHairT;\nvarying float vHairR;\nvarying vec3 vHairDir;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float hl = dot(diffuseColor.rgb, vec3(0.333));
        // grano de los mechones (de la textura) para romper el brillo
        float kkNoise = clamp(hl / baseLum - 1.0, -0.5, 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, tipsColor * (0.75 + 0.6 * hl), smoothstep(0.5, 0.95, vHairT) * tipsOn);
        float rootK = smoothstep(0.0, 0.35, vHairR);
        diffuseColor.rgb *= mix(rootDark, 1.0, rootK);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 V = normalize(vViewPosition);
          vec3 T = vHairDir - normal * dot(vHairDir, normal);
          T = length(T) > 1e-4 ? normalize(T) : vec3(0.0, 1.0, 0.0);
          vec3 T1 = normalize(T + normal * (-0.1 + 0.3 * kkNoise));
          vec3 T2 = normalize(T + normal * (0.15 + 0.3 * kkNoise));
          vec3 kk = vec3(0.0);
          #if NUM_DIR_LIGHTS > 0
          for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            vec3 L = directionalLights[i].direction;
            vec3 H = normalize(L + V);
            float wrap = smoothstep(-0.2, 0.6, dot(normal, L));
            float c1 = dot(T1, H);
            float c2 = dot(T2, H);
            float s1 = pow(sqrt(max(0.0, 1.0 - c1 * c1)), kkExp) * smoothstep(-1.0, 0.0, c1);
            float s2 = pow(sqrt(max(0.0, 1.0 - c2 * c2)), kkExp * 0.3) * smoothstep(-1.0, 0.0, c2);
            kk += directionalLights[i].color * wrap * (s1 * mix(kkColor, vec3(1.0), 0.45) + s2 * kkColor * (0.45 + kkNoise));
          }
          #endif
          outgoingLight += kk * kkShine * mix(0.3, 1.0, rootK);
        }
        #include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'hair-kk'
  return m
}

// ─────────────────────── Física secundaria ───────────────────────

/** Parámetros de una cadena de muelles. */
interface ChainSpec {
  /** Rigidez del muelle que devuelve cada nodo a su sitio (1/s²). */
  stiff: number
  /** Amortiguación por paso de 1/60 s (0..1, más alto = más suelto). */
  damp: number
  /** Desviación máxima de cada nodo respecto a su reposo (m). */
  maxDev: number
  /** Cuánto pesa la gravedad cuando la cabeza se inclina. */
  grav: number
  /** Brisa en reposo, para que no parezca de plástico. */
  wind: number
}

const SPECS: Record<'pony' | 'braid' | 'curtain' | 'bun' | 'tendril', ChainSpec> = {
  pony: { stiff: 30, damp: 0.965, maxDev: 0.07, grav: 5, wind: 0.25 },
  braid: { stiff: 36, damp: 0.97, maxDev: 0.055, grav: 5, wind: 0.15 },
  curtain: { stiff: 95, damp: 0.94, maxDev: 0.02, grav: 2, wind: 0.12 },
  bun: { stiff: 170, damp: 0.9, maxDev: 0.012, grav: 3, wind: 0 },
  tendril: { stiff: 42, damp: 0.95, maxDev: 0.035, grav: 5, wind: 0.35 },
}

/** Pesos de piel: cada vértice se reparte entre los dos huesos del tramo más cercano. */
function skinTo(g: THREE.BufferGeometry, nodes: THREE.Vector3[]) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const N = nodes.length - 1
  const idx = new Uint16Array(pos.count * 4)
  const wts = new Float32Array(pos.count * 4)
  const p = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ap = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    let best = Infinity
    let f = 0
    for (let k = 0; k < N; k++) {
      ab.subVectors(nodes[k + 1], nodes[k])
      ap.subVectors(p, nodes[k])
      const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-9, ab.lengthSq())))
      const d = ap.addScaledVector(ab, -t).lengthSq()
      if (d < best) {
        best = d
        f = k + t
      }
    }
    const i0 = Math.min(N - 1, Math.floor(f))
    const w = f - i0
    idx.set([i0, i0 + 1, 0, 0], i * 4)
    wts.set([1 - w, w, 0, 0], i * 4)
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4))
  g.userData.nodes = nodes
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _s = new THREE.Vector3()
const _g = new THREE.Vector3()
const _c = new THREE.Vector3()

/**
 * Mechón con física: una cadena de huesos cuyos nodos son partículas
 * (integración de Verlet) unidas por muelles a su posición de reposo
 * respecto a la cabeza. Al girar o caminar, la cadena se queda atrás,
 * rebota y se asienta. La malla se deforma con skinning en la GPU.
 */
class HairChain {
  readonly rig = new THREE.Group()
  private bones: THREE.Bone[] = []
  private rest: THREE.Vector3[]
  private restDir: THREE.Vector3[] = []
  private restLen: number[] = []
  private restDist: number[] = []
  private p: THREE.Vector3[]
  private pp: THREE.Vector3[]
  private target: THREE.Vector3[]
  private ready = false
  private phase: number

  constructor(g: THREE.BufferGeometry, mats: THREE.Material[], extra: THREE.BufferGeometry[], private spec: ChainSpec, seed: number) {
    const nodes = g.userData.nodes as THREE.Vector3[]
    this.rest = nodes
    this.phase = seed * 1.7
    for (let k = 0; k < nodes.length; k++) {
      const b = new THREE.Bone()
      b.position.copy(k === 0 ? nodes[0] : _v.subVectors(nodes[k], nodes[k - 1]))
      if (k === 0) this.rig.add(b)
      else this.bones[k - 1].add(b)
      this.bones.push(b)
      if (k < nodes.length - 1) {
        this.restDir.push(nodes[k + 1].clone().sub(nodes[k]).normalize())
        this.restLen.push(nodes[k + 1].distanceTo(nodes[k]))
      }
      this.restDist.push(nodes[k].distanceTo(HC))
    }
    this.rig.updateMatrixWorld(true)
    const skeleton = new THREE.Skeleton(this.bones)
    ;[g, ...extra].forEach((geo, i) => {
      const mesh = new THREE.SkinnedMesh(geo, mats[i] ?? mats[0])
      mesh.frustumCulled = false
      this.rig.add(mesh)
      mesh.bind(skeleton)
    })
    // al quitar el peinado se libera la textura de huesos del esqueleto
    this.rig.addEventListener('removed', () => skeleton.dispose())
    this.p = nodes.map((n) => n.clone())
    this.pp = nodes.map((n) => n.clone())
    this.target = nodes.map((n) => n.clone())
  }

  update(dt: number, time: number, gust: number) {
    const { rig, rest, p, pp, target, spec } = this
    const N = rest.length - 1
    rig.updateWorldMatrix(true, false)
    _m.copy(rig.matrixWorld)
    _m.decompose(_v, _q, _s)
    const scale = _s.x
    for (let k = 0; k <= N; k++) target[k].copy(rest[k]).applyMatrix4(_m)
    if (!this.ready || dt > 0.25 || dt < 0) {
      for (let k = 0; k <= N; k++) {
        p[k].copy(target[k])
        pp[k].copy(target[k])
      }
      this.ready = true
      if (dt > 0.25 || dt < 0) dt = 0
    }
    // la gravedad solo actúa cuando la cabeza se inclina respecto al reposo
    _g.set(0, -1, 0).applyQuaternion(_q).negate().add(_v2.set(0, -1, 0)).multiplyScalar(spec.grav * scale)
    _c.copy(HC).applyMatrix4(_m)
    const steps = Math.min(4, Math.ceil(dt * 60))
    const h = steps ? dt / steps : 0
    for (let s = 0; s < steps; s++) {
      const tt = time - dt + (s + 1) * h
      const wx = spec.wind * gust * Math.sin(tt * 1.3 + this.phase) * scale
      const wz = spec.wind * gust * 0.6 * Math.sin(tt * 0.9 + this.phase * 2) * scale
      p[0].copy(target[0])
      for (let k = 1; k <= N; k++) {
        const stiff = spec.stiff * (1 - (0.35 * k) / N)
        _v.subVectors(p[k], pp[k]).multiplyScalar(spec.damp)
        pp[k].copy(p[k])
        _v2.subVectors(target[k], p[k]).multiplyScalar(stiff).add(_g)
        _v2.x += wx
        _v2.z += wz
        p[k].add(_v).addScaledVector(_v2, h * h)
      }
      for (let k = 1; k <= N; k++) {
        // longitud fija de cada tramo
        _v.subVectors(p[k], p[k - 1])
        const len = _v.length() || 1
        p[k].copy(p[k - 1]).addScaledVector(_v, (this.restLen[k - 1] * scale) / len)
        // sin alejarse demasiado del reposo
        _v.subVectors(p[k], target[k])
        const dev = _v.length()
        const max = spec.maxDev * scale
        if (dev > max) p[k].copy(target[k]).addScaledVector(_v, max / dev)
        // sin atravesar la cabeza
        _v.subVectors(p[k], _c)
        const rmin = Math.min(this.restDist[k], HEAD.rz + 0.02) * scale
        const d = _v.length()
        if (d < rmin && d > 1e-6) p[k].copy(_c).addScaledVector(_v, rmin / d)
      }
    }
    // orientación de cada hueso a partir de las partículas
    _q2.copy(_q)
    for (let k = 0; k < N; k++) {
      _v.subVectors(p[k + 1], p[k]).normalize().applyQuaternion(_q.copy(_q2).invert())
      const b = this.bones[k]
      b.quaternion.setFromUnitVectors(this.restDir[k], _v)
      _q2.multiply(b.quaternion)
    }
  }

  /** Ángulo (rad) que se ha separado el primer tramo de su reposo. */
  swing() {
    return 2 * Math.acos(Math.min(1, Math.abs(this.bones[0].quaternion.w)))
  }
}

// ─────────────────────── Ensamblado ───────────────────────

/** Estado de la física del último peinado actualizado (lo leen los tests E2E). */
export const hairStats = { chains: 0, swing: 0, frames: 0 }
if (typeof window !== 'undefined') (window as unknown as { __claraHair: typeof hairStats }).__claraHair = hairStats

const geoCache = new Map<string, THREE.BufferGeometry>()
onDetailChange(() => geoCache.clear())
function cached(key: string, make: () => THREE.BufferGeometry, nodes?: () => THREE.Vector3[]) {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    if (!g.getAttribute('hairT')) withT(g, () => 0)
    if (!g.getAttribute('hairDir')) strandAttrs(g)
    if (nodes) skinTo(g, nodes())
    geoCache.set(key, g)
  }
  return g
}

const ANCHORS = {
  low: { a: 3.55, b: 0 },
  high: { a: 2.05, b: 0 },
}

interface Entry {
  g: THREE.BufferGeometry
  /** Con cadena de física (la geometría lleva `userData.nodes` y pesos de piel). */
  chain?: ChainSpec
  /** Material propio (flores) en vez del pelo. */
  flowers?: boolean
}

/** Número de mechones sueltos según la calidad. */
function strayCount(sleek: boolean) {
  const q = getMaterialQuality()
  const n = q === 'baja' ? 8 : q === 'media' ? 16 : 26
  return sleek ? Math.round(n * 0.6) : n
}

function pieceGeometry(kind: HairPieceKind, p: Record<string, number>): Entry[] {
  const key = `${kind}|${JSON.stringify(p)}|${getMaterialQuality()}`
  switch (kind) {
    case 'capSleek':
      return [{ g: cached(key, () => merge([cap(p, true), locks(p, true)])) }]
    case 'capVolume':
    case 'capSide':
      return [{ g: cached(key, () => merge([cap(p, false), locks(p, false)])) }]
    case 'bunLow':
    case 'bunHigh': {
      const an = kind === 'bunLow' ? ANCHORS.low : ANCHORS.high
      const anchor = scalp(an.a, an.b, 0.004)
      const dir = dirAB(an.a, an.b)
      return [{ g: cached(key, () => withT(bun(anchor, dir, kind === 'bunLow' ? 1.25 : 1.15), () => 0.2)) }]
    }
    case 'bunsSpace': {
      const gs: THREE.BufferGeometry[] = []
      for (const s of [-1, 1]) gs.push(bun(scalp(1.25, s * 0.68, 0.006), dirAB(1.25, s * 0.68), 0.75))
      return [{ g: cached(key, () => merge(gs.map((g) => withT(g, () => 0.2)))) }]
    }
    case 'ponyLow':
    case 'ponyHigh': {
      const an = kind === 'ponyLow' ? ANCHORS.low : ANCHORS.high
      const anchor = scalp(an.a, an.b, 0.006)
      const dir = dirAB(an.a, an.b)
      const c = ponyCurve(anchor, dir, p.length ?? 0.4, p.wave ?? 0)
      const g = cached(
        key,
        () => merge([pony(c, p.wave ?? 0, kind === 'ponyHigh' ? 1.1 : 0.95), hairTie(anchor.clone().addScaledVector(dir, 0.02), dir, 0.016)]),
        () => nodesOf(c, 5),
      )
      return [{ g, chain: SPECS.pony }]
    }
    case 'ponyBubble': {
      const an = ANCHORS.high
      const anchor = scalp(an.a, an.b, 0.006)
      const dir = dirAB(an.a, an.b)
      const c = ponyCurve(anchor, dir, p.length ?? 0.5, 0)
      const g = cached(
        key,
        () => merge([pony(c, 0, 1.15, p.bubbles ?? 4), hairTie(anchor.clone().addScaledVector(dir, 0.02), dir, 0.017)]),
        () => nodesOf(c, 6),
      )
      return [{ g, chain: SPECS.pony }]
    }
    case 'pigtails': {
      const out: Entry[] = []
      for (const s of [-1, 1]) {
        const a = 1.65
        const b = s * 0.92
        const anchor = scalp(a, b, 0.006)
        const dir = dirAB(a, b)
        const c = ponyCurve(anchor, dir, p.length ?? 0.3, 1, s)
        const g = cached(`${key}|${s}`, () => merge([pony(c, 1, 0.8), hairTie(anchor.clone().addScaledVector(dir, 0.018), dir, 0.013)]), () => nodesOf(c, 4))
        out.push({ g, chain: SPECS.pony })
      }
      return out
    }
    case 'curtainStraight':
    case 'curtainWavy': {
      const style = kind === 'curtainWavy' ? 'wavy' : 'straight'
      const len = p.length ?? 0.5
      const g = cached(
        key,
        () => curtain(len, style, strayCount(false) >> 1),
        () => Array.from({ length: 5 }, (_, k) => curtainPoint(len, style, 0.5, k / 4, new THREE.Vector3())),
      )
      return [{ g, chain: SPECS.curtain }]
    }
    case 'curtainCurly':
      return [{ g: cached(key, () => curls(p.length ?? 0.35)) }]
    case 'bob':
      return [{ g: cached(key, () => curtain(0, 'bob')) }]
    case 'bangsStraight':
      return [{ g: cached(key, () => bangs(true)) }]
    case 'bangsCurtain':
      return [{ g: cached(key, () => bangs(false)) }]
    case 'faceStrands':
      return [{ g: cached(key, () => faceStrands(p.length ?? 0.35, p.wave ?? 0, p.short ?? 0)) }]
    case 'braids':
      return [-1, 1].map((s) => {
        const path = braidPath(s, p.length ?? 0.4)
        return { g: cached(`${key}|${s}`, () => braid(path), () => nodesOf(path, 5)), chain: SPECS.braid }
      })
    case 'braidSide': {
      const s = p.side ?? 1
      const path = braidSidePath(s, p.length ?? 0.42)
      return [
        { g: cached(`${key}|nuca`, () => sweepToSide(s)) },
        { g: cached(key, () => braid(path, 0.013, 0.011, 26), () => nodesOf(path, 6)), chain: SPECS.braid },
      ]
    }
    case 'braidCrown':
      return [{ g: cached(key, () => braidCrown()) }]
    case 'bunMessy': {
      const an = p.high ? ANCHORS.high : { a: 3.35, b: 0 }
      const anchor = scalp(an.a, an.b, 0.004)
      const dir = dirAB(an.a, an.b)
      const size = p.size ?? 1.2
      let made: ReturnType<typeof messyBun> | undefined
      const get = () => (made ??= messyBun(anchor, dir, size, p.high ? 5 : 8))
      const bunNodes = () => [anchor.clone(), anchor.clone().addScaledVector(dir, 0.05 * size)]
      const out: Entry[] = [{ g: cached(key, () => get().body, bunNodes), chain: SPECS.bun }]
      for (let i = 0; i < 3; i++) out.push({ g: cached(`${key}|${i}`, () => get().tendrils[i].g, () => get().tendrils[i].nodes), chain: SPECS.tendril })
      return out
    }
    case 'flowers':
      return [{ g: cached(key, () => weddingFlowers()), flowers: true }]
    case 'halfUp': {
      const anchor = scalp(2.0, 0, 0.012)
      return [{ g: cached(key, () => withT(bun(anchor, dirAB(2.3, 0), 0.6), () => 0.2)) }]
    }
  }
}

const SLEEK = new Set<HairPieceKind>(['capSleek'])
const CAPS = new Set<HairPieceKind>(['capSleek', 'capVolume', 'capSide'])

export function buildHair(h: HairLook, hasHat: boolean, _hatHidesTop: boolean): HairResult {
  const style = HAIR_BY_ID[h.styleId] ?? HAIR_BY_ID['mono-bajo']
  const mat = hairMaterial(h)
  const pieces: Piece[] = []
  const chains: HairChain[] = []
  const add = (e: Entry) => {
    if (e.chain) {
      const ch = new HairChain(e.g, [mat], [], e.chain, chains.length)
      chains.push(ch)
      pieces.push({ bone: 'head', mesh: ch.rig, ownsGeometry: false })
    } else pieces.push({ bone: 'head', mesh: new THREE.Mesh(e.g, e.flowers ? flowerMaterial() : mat), ownsGeometry: false })
  }
  for (const pc of style.pieces) {
    // con gorro, los moños altos se ocultan para que no atraviesen el gorro
    if (hasHat && (pc.kind === 'bunHigh' || pc.kind === 'bunsSpace' || pc.kind === 'halfUp' || (pc.kind === 'bunMessy' && pc.params?.high))) continue
    for (const e of pieceGeometry(pc.kind, pc.params ?? {})) add(e)
    // mechones sueltos del contorno (bajo un gorro no se verían y lo atravesarían)
    if (CAPS.has(pc.kind) && !hasHat) {
      const p = pc.params ?? {}
      const sleek = SLEEK.has(pc.kind)
      add({ g: cached(`fly|${sleek}|${JSON.stringify(p)}|${getMaterialQuality()}`, () => flyaways(p, sleek, strayCount(sleek))) })
    }
  }
  let last = -1
  return {
    pieces,
    update(time, k) {
      const dt = last < 0 ? 0 : time - last
      last = time
      let swing = 0
      for (const c of chains) {
        c.update(dt, time, k)
        swing = Math.max(swing, c.swing())
      }
      hairStats.chains = chains.length
      hairStats.swing = swing
      hairStats.frames++
    },
  }
}

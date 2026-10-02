import * as THREE from 'three'
import type { HairLook, HairPieceKind } from '../data/types'
import { HAIR_BY_ID } from '../data/hair'
import { HEAD, J, headPoint } from './body'
import { curveOf, gauss, merge, onDetailChange, smoothstep, surface, sweep, table, torus } from './geo'
import { hairTexture } from './textures'
import { getMaterialQuality } from './materials'
import type { Piece } from './clothes/wear'

// Peinados construidos por piezas. Todas las piezas tienen el atributo
// `hairT` (0 = raíz, 1 = punta) para las puntas de color fantasía.

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

function withT(g: THREE.BufferGeometry, fn: (i: number, uvx: number, uvy: number) => number): THREE.BufferGeometry {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  const arr = new Float32Array(uv.count)
  for (let i = 0; i < uv.count; i++) arr[i] = fn(i, uv.getX(i), uv.getY(i))
  g.setAttribute('hairT', new THREE.BufferAttribute(arr, 1))
  return g
}

/** Superficie con parámetro v = 0..1 de raíz a punta (para las puntas de color). */
function tSurface(nu: number, nv: number, fn: (u: number, v: number, out: THREE.Vector3) => void, flip = false): THREE.BufferGeometry {
  const g = surface(nu, nv, fn, { flip })
  const { nu: gu, nv: gv } = g.userData.grid as { nu: number; nv: number }
  const arr = new Float32Array((gu + 1) * (gv + 1))
  for (let j = 0; j <= gv; j++) for (let i = 0; i <= gu; i++) arr[j * (gu + 1) + i] = j / gv
  g.setAttribute('hairT', new THREE.BufferAttribute(arr, 1))
  return g
}

function tSweep(curve: THREE.Curve<THREE.Vector3>, r: (t: number, a: number) => number, opts: Parameters<typeof sweep>[2] = {}): THREE.BufferGeometry {
  const g = sweep(curve, r, { ...opts, capStart: false, capEnd: false })
  const { nu: radial, nv: segs } = g.userData.grid as { nu: number; nv: number }
  const arr = new Float32Array((radial + 1) * (segs + 1))
  for (let j = 0; j <= segs; j++) for (let i = 0; i <= radial; i++) arr[j * (radial + 1) + i] = j / segs
  g.setAttribute('hairT', new THREE.BufferAttribute(arr, 1))
  return g
}

// ─────────────────────── Piezas ───────────────────────

function cap(params: Record<string, number>, sleek: boolean): THREE.BufferGeometry {
  const off = sleek ? 0.0065 : 0.012 + (params.volume ?? 0) * 0.01
  const part = params.part ?? (sleek ? 1 : 0)
  const high = params.high ?? 0
  return withT(
    surface(
      64,
      56,
      (u, v, out) => {
        const b = (u - 0.5) * 2 * B_MAX
        const ab = Math.abs(b)
        const a0 = hairlineFront(ab)
        const a1 = high ? Math.max(2.4, hairlineBack(ab) - 0.35 * high) : hairlineBack(ab)
        const a = a0 + (a1 - a0) * v
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
    ),
    () => 0,
  )
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
  return g
}

function orientTo(g: THREE.BufferGeometry, anchor: THREE.Vector3, dir: THREE.Vector3) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  g.applyQuaternion(q)
  g.translate(anchor.x, anchor.y, anchor.z)
}

function hairTie(anchor: THREE.Vector3, dir: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = torus(r, 0.0045, 24, 8)
  orientTo(g, anchor, dir)
  return g
}

/** Coleta: sale del ancla y cae con gravedad. */
function pony(anchor: THREE.Vector3, out: THREE.Vector3, length: number, wave: number, thick = 1, side = 0): THREE.BufferGeometry {
  const pts: [number, number, number][] = []
  const N = 9
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const outw = out.clone().multiplyScalar(0.05 * Math.min(1, t * 3) + 0.03 * t)
    const fall = -length * Math.pow(t, 1.25)
    const w = wave ? Math.sin(t * Math.PI * 3.2) * 0.022 * t : 0
    pts.push([anchor.x + outw.x + w + side * t * 0.02, anchor.y + outw.y * 0.6 + fall, anchor.z + outw.z - 0.012 * t + w * 0.4])
  }
  const c = curveOf(pts)
  return tSweep(
    c,
    (t, a) => {
      const base = (0.022 + 0.012 * Math.sin(Math.min(1, t * 2.2) * Math.PI)) * thick
      const tip = 1 - smoothstep(0.55, 1, t) * 0.92
      const flut = wave ? 1 + 0.12 * Math.sin(a * 5 + t * 20) : 1 + 0.05 * Math.sin(a * 7)
      return base * tip * flut
    },
    { radial: 18, segments: 36, ellipse: [1, 0.8] },
  )
}

/** Melena larga detrás de los hombros. */
function curtain(length: number, style: 'straight' | 'wavy' | 'curly' | 'bob'): THREE.BufferGeometry {
  const bob = style === 'bob'
  const nu = 44
  const nv = bob ? 18 : 40
  const yTop = HC.y + 0.03
  const yEnd = bob ? HC.y - 0.125 : 1.3 - length
  const tmp = new THREE.Vector3()
  return tSurface(
    nu,
    nv,
    (u, v, out) => {
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
        ax = table([
          [1.0, 0.15],
          [1.2, 0.16],
          [1.3, 0.17],
          [1.38, 0.155],
          [1.5, HEAD.rx + 0.02],
          [1.6, HEAD.rx + 0.02],
        ])(y)
        az = table([
          [0.9, 0.105],
          [1.15, 0.098],
          [1.27, 0.1],
          [1.38, 0.125],
          [1.5, HEAD.rz + 0.016],
          [1.6, HEAD.rz + 0.016],
        ])(y)
        ax += 0.01 * shoulder
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
    },
    true,
  )
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

function faceStrands(length: number, wave: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const start = scalp(0.3, s * 0.95, 0.01)
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

function braids(length: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const start = scalp(2.2, s * 1.05, 0.006)
    const path = curveOf([
      [start.x, start.y, start.z],
      [s * 0.135, HC.y - 0.14, -0.01],
      [s * 0.13, 1.28, 0.06],
      [s * 0.12, 1.28 - length * 0.5, 0.095],
      [s * 0.115, 1.28 - length, 0.098],
    ])
    const frames = new THREE.CatmullRomCurve3()
    void frames
    for (let k = 0; k < 3; k++) {
      const N = 80
      const pts: [number, number, number][] = []
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const p = path.getPointAt(t)
        const tan = path.getTangentAt(t)
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 0, 1)).normalize()
        const fwd = new THREE.Vector3().crossVectors(side, tan).normalize()
        const ph = t * 16 * Math.PI + (k * Math.PI * 2) / 3
        const w = 0.009 * (1 - 0.45 * t) * smoothstep(0, 0.12, t)
        p.addScaledVector(side, Math.sin(ph) * w).addScaledVector(fwd, Math.cos(ph * 2) * w * 0.4)
        pts.push([p.x, p.y, p.z])
      }
      parts.push(tSweep(curveOf(pts), (t) => 0.0095 * (1 - 0.45 * t), { radial: 10, segments: 120 }))
    }
    const tieP = path.getPointAt(0.9)
    parts.push(withT(hairTie(tieP, path.getTangentAt(0.9), 0.007), () => 0.9))
  }
  return merge(parts)
}

// ─────────────────────── Material ───────────────────────

function hairMaterial(h: HairLook): THREE.MeshPhysicalMaterial {
  const q = getMaterialQuality()
  const m = new THREE.MeshPhysicalMaterial({
    map: hairTexture(h.base, h.highlights, h.highlightsOn, h.tips, false),
    roughness: 0.62 - h.shine * 0.22,
    sheen: q === 'baja' ? 0 : 0.35,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(h.base).lerp(new THREE.Color('#ffffff'), 0.25),
    clearcoat: q === 'baja' ? 0 : h.shine * 0.12,
    clearcoatRoughness: 0.35,
    side: THREE.DoubleSide,
  })
  const tips = new THREE.Color(h.tips)
  const tipsOn = h.tipsOn ? 1 : 0
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tipsColor = { value: tips }
    sh.uniforms.tipsOn = { value: tipsOn }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float hairT;\nvarying float vHairT;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairT = hairT;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 tipsColor;\nuniform float tipsOn;\nvarying float vHairT;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float hl = dot(diffuseColor.rgb, vec3(0.333));
        diffuseColor.rgb = mix(diffuseColor.rgb, tipsColor * (0.75 + 0.6 * hl), smoothstep(0.5, 0.95, vHairT) * tipsOn);`,
      )
  }
  m.customProgramCacheKey = () => 'hair-tips'
  return m
}

// ─────────────────────── Ensamblado ───────────────────────

const geoCache = new Map<string, THREE.BufferGeometry>()
onDetailChange(() => geoCache.clear())
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    if (!g.getAttribute('hairT')) withT(g, () => 0)
    geoCache.set(key, g)
  }
  return g
}

const ANCHORS = {
  low: { a: 3.55, b: 0 },
  high: { a: 2.05, b: 0 },
}

function pieceGeometry(kind: HairPieceKind, p: Record<string, number>): { g: THREE.BufferGeometry; sway?: THREE.Vector3; pivot?: THREE.Vector3 }[] {
  const key = `${kind}|${JSON.stringify(p)}`
  switch (kind) {
    case 'capSleek':
      return [{ g: cached(key, () => merge([cap(p, true), locks(p, true)].map((g) => (g.getAttribute('hairT') ? g : withT(g, () => 0))))) }]
    case 'capVolume':
    case 'capSide':
      return [{ g: cached(key, () => merge([cap(p, false), locks(p, false)].map((g) => (g.getAttribute('hairT') ? g : withT(g, () => 0))))) }]
    case 'bunLow':
    case 'bunHigh': {
      const an = kind === 'bunLow' ? ANCHORS.low : ANCHORS.high
      const anchor = scalp(an.a, an.b, 0.004)
      const dir = dirAB(an.a, an.b)
      return [{ g: cached(key, () => merge([withT(bun(anchor, dir, kind === 'bunLow' ? 1.25 : 1.15), () => 0.2)])) }]
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
      const len = p.length ?? 0.4
      const g = cached(key, () =>
        merge([
          pony(anchor, dir, len, p.wave ?? 0, kind === 'ponyHigh' ? 1.1 : 0.95),
          withT(hairTie(anchor.clone().addScaledVector(dir, 0.02), dir, 0.016), () => 0),
        ]),
      )
      return [{ g, sway: new THREE.Vector3(1, 0, 0.4), pivot: anchor }]
    }
    case 'pigtails': {
      const out: { g: THREE.BufferGeometry; sway?: THREE.Vector3; pivot?: THREE.Vector3 }[] = []
      for (const s of [-1, 1]) {
        const a = 1.65
        const b = s * 0.92
        const anchor = scalp(a, b, 0.006)
        const dir = dirAB(a, b)
        const g = cached(`${key}|${s}`, () =>
          merge([pony(anchor, dir, p.length ?? 0.3, 1, 0.8, s), withT(hairTie(anchor.clone().addScaledVector(dir, 0.018), dir, 0.013), () => 0)]),
        )
        out.push({ g, sway: new THREE.Vector3(1, 0, s * 0.5), pivot: anchor })
      }
      return out
    }
    case 'curtainStraight':
      return [{ g: cached(key, () => curtain(p.length ?? 0.5, 'straight')), sway: new THREE.Vector3(1, 0, 0), pivot: HC.clone() }]
    case 'curtainWavy':
      return [{ g: cached(key, () => curtain(p.length ?? 0.5, 'wavy')), sway: new THREE.Vector3(1, 0, 0), pivot: HC.clone() }]
    case 'curtainCurly':
      return [{ g: cached(key, () => curls(p.length ?? 0.35)) }]
    case 'bob':
      return [{ g: cached(key, () => curtain(0, 'bob')) }]
    case 'bangsStraight':
      return [{ g: cached(key, () => bangs(true)) }]
    case 'bangsCurtain':
      return [{ g: cached(key, () => bangs(false)) }]
    case 'faceStrands':
      return [{ g: cached(key, () => faceStrands(p.length ?? 0.35, p.wave ?? 0)) }]
    case 'braids':
      return [{ g: cached(key, () => braids(p.length ?? 0.4)) }]
    case 'halfUp': {
      const anchor = scalp(2.0, 0, 0.012)
      return [{ g: cached(key, () => withT(bun(anchor, dirAB(2.3, 0), 0.6), () => 0.2)) }]
    }
  }
}

export function buildHair(h: HairLook, hasHat: boolean, _hatHidesTop: boolean): HairResult {
  const style = HAIR_BY_ID[h.styleId] ?? HAIR_BY_ID['mono-bajo']
  const mat = hairMaterial(h)
  const pieces: Piece[] = []
  const swingers: { obj: THREE.Object3D; axis: THREE.Vector3; phase: number }[] = []
  for (const pc of style.pieces) {
    // con gorro, los moños altos se ocultan para que no atraviesen el gorro
    if (hasHat && (pc.kind === 'bunHigh' || pc.kind === 'bunsSpace' || pc.kind === 'halfUp')) continue
    for (const { g, sway, pivot } of pieceGeometry(pc.kind, pc.params ?? {})) {
      const mesh = new THREE.Mesh(g, mat)
      if (sway && pivot) {
        // el balanceo gira la pieza alrededor de su anclaje
        const holder = new THREE.Group()
        holder.position.copy(pivot)
        mesh.position.copy(pivot).multiplyScalar(-1)
        holder.add(mesh)
        const wrapper = new THREE.Group()
        wrapper.add(holder)
        pieces.push({ bone: 'head', mesh: wrapper, ownsGeometry: false })
        swingers.push({ obj: holder, axis: sway.clone().normalize(), phase: swingers.length * 1.3 })
      } else {
        pieces.push({ bone: 'head', mesh, ownsGeometry: false })
      }
    }
  }
  return {
    pieces,
    update(time, k) {
      for (const s of swingers) {
        const a = Math.sin(time * 1.7 * k + s.phase) * 0.035 * k
        s.obj.quaternion.setFromAxisAngle(s.axis, a)
      }
    },
  }
}

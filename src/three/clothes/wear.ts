import * as THREE from 'three'
import type { ItemDef, ItemInstance } from '../../data/types'
import { fabricMaterial, solid } from '../materials'
import { torsoPoint, TORSO_Y0 } from '../body'
import { ellipsoid, extrude, heartShape, starShape, torus } from '../geo'
import {
  ARM_SEGS,
  LEG_SEGS,
  SkirtDeformer,
  cuff,
  curveOf,
  gauss,
  hemAlong,
  legTube,
  lerp,
  merge,
  necklineTop,
  skirtGeometry,
  skirtHem,
  skirtPoint,
  sleeve,
  smoothstep,
  surface,
  sweep,
  torsoEdge,
  torsoGarment,
  type Neck,
  type SkirtOpts,
} from './garment'
import type { JointName } from '../pose'

// Prendas de cuerpo: tops, partes de abajo, vestidos, monos y chaquetas.

export interface Piece {
  bone: JointName
  mesh: THREE.Object3D
  ownsGeometry: boolean
}

export interface Built {
  pieces: Piece[]
  deformers: SkirtDeformer[]
  animate?: (time: number) => void
}

type P = Record<string, number | string | boolean>
const num = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: P, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d)
const bool = (p: P, k: string) => p[k] === true

const geoCache = new Map<string, THREE.BufferGeometry>()
export function cg(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}

export function matFor(item: ItemDef, inst: ItemInstance) {
  return fabricMaterial({ fabric: item.fabric, color: inst.color, color2: inst.color2 ?? item.color2, pattern: inst.pattern })
}
export function mat2For(item: ItemDef, inst: ItemInstance) {
  const c2 = inst.color2 ?? item.color2 ?? '#ffffff'
  return fabricMaterial({ fabric: item.fabric, color: c2, pattern: 'liso' })
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, bone: JointName, owns = false): Piece {
  const me = new THREE.Mesh(g, m)
  me.castShadow = true
  return { bone, mesh: me, ownsGeometry: owns }
}

// ───────────────────── TOPS ─────────────────────

interface TopSpec {
  neck: Neck
  hem: number
  sleeve: number
  straps: string
  puff: boolean
  off: number
  bridge: number
  cozy: boolean
}

function topSpec(p: P, off = 0.0045): TopSpec {
  const neck = str(p, 'neck', 'crew') as Neck
  return {
    neck,
    hem: num(p, 'hem', 1.0),
    sleeve: num(p, 'sleeve', 0),
    straps: str(p, 'straps', 'none'),
    puff: bool(p, 'puff'),
    off: off + (bool(p, 'cozy') ? 0.006 : 0),
    bridge: ['crew', 'v', 'cowl', 'square', 'halter', 'off'].includes(neck) ? 0.85 : 1,
    cozy: bool(p, 'cozy'),
  }
}

/** Corpiño (torso) + mangas + tirantes. Devuelve geometrías por hueso. */
function bodiceParts(s: TopSpec, key: string, bottom: (th: number) => number, closeBottom = false): { bone: JointName; g: THREE.BufferGeometry }[] {
  const out: { bone: JointName; g: THREE.BufferGeometry }[] = []
  const top = necklineTop(s.neck)
  // en tops sin mangas, la sisa baja para dejar mover los brazos
  const sleeveless = s.sleeve <= 0
  const topF = (th: number) => {
    const t = top(th)
    if (!sleeveless || s.neck === 'off' || s.neck === 'tube' || s.neck === 'bikini') return t
    const side = Math.pow(Math.abs(Math.sin(th)), 6)
    return Math.min(t, lerp(t, 1.195, side))
  }
  const offF = (y: number) => s.off + (s.cozy ? 0.002 * Math.sin(y * 300) : 0)
  out.push({
    bone: 'hips',
    g: cg(`bod|${key}`, () =>
      merge([
        torsoGarment({ top: topF, bottom, off: offF, bridge: s.bridge, closeBottom }),
        hemAlong(torsoEdge(topF, s.off + 0.0005, 0, 72, s.bridge), 0.0022),
        ...(closeBottom ? [] : [hemAlong(torsoEdge(bottom, s.off + 0.0008, 0, 72, s.bridge), 0.0026)]),
      ]),
    ),
  })
  // mangas
  if (s.sleeve > 0) {
    for (const [side, bone, fbone] of [
      [1, 'shoulderL', 'elbowL'],
      [-1, 'shoulderR', 'elbowR'],
    ] as const) {
      const segs = side === 1 ? ARM_SEGS.L : ARM_SEGS.R
      const startT = s.neck === 'off' ? 0.045 : -0.065
      const upperLen = Math.min(0.27, 0.27 * Math.min(1, s.sleeve))
      const puff = s.puff ? 0.016 : 0
      const off = s.off + 0.001
      const offF = (t: number) => off + puff * Math.sin(Math.max(0, Math.min(1, (t - startT) / (upperLen - startT))) * Math.PI)
      out.push({
        bone,
        g: cg(`slv|${key}|${side}`, () =>
          merge([sleeve(side, 'upper', startT, upperLen, offF), cuff(segs.upper, upperLen, off + (s.sleeve < 1 ? puff * 0.2 : 0)), ...(s.neck === 'off' ? [cuff(segs.upper, startT, off + 0.002)] : [])]),
        ),
      })
      if (s.sleeve > 1) {
        const foreLen = 0.218 * Math.min(1, s.sleeve - 1) + 0.002
        out.push({
          bone: fbone,
          g: cg(`fslv|${key}|${side}`, () => merge([sleeve(side, 'fore', -0.025, foreLen, off), cuff(segs.fore, foreLen, off)])),
        })
      }
    }
  }
  // tirantes
  if (s.straps === 'thin' || s.straps === 'wide') {
    const w = s.straps === 'thin' ? 0.0028 : 0.009
    for (const side of [1, -1]) {
      const thF = side * 0.42
      const thB = side * (Math.PI - 0.5)
      const f = torsoPoint(topF(thF) - 0.004, thF, s.off + 0.001, s.bridge)
      const b = torsoPoint(topF(thB) - 0.004, thB, s.off + 0.001, s.bridge)
      const c = curveOf([
        [f.x, f.y, f.z],
        [side * 0.088, 1.265, 0.038],
        [side * 0.094, 1.296, 0.0],
        [side * 0.09, 1.27, -0.042],
        [b.x, b.y, b.z],
      ])
      out.push({ bone: 'hips', g: cg(`strap|${key}|${side}`, () => sweep(c, () => w, { radial: 8, segments: 30, ellipse: [0.25, 1] })) })
    }
  }
  if (s.straps === 'halter') {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.sin(a) * 0.046, 1.335 + 0.012 * Math.cos(a), -0.004 + Math.cos(a) * 0.044))
    }
    out.push({ bone: 'neck', g: cg('halterband', () => hemAlong(pts, 0.004)) })
  }
  return out
}

function topBottom(hem: number) {
  return (th: number) => hem + 0.004 * Math.cos(th)
}

export function buildTop(item: ItemDef, inst: ItemInstance): Built {
  const p = item.params ?? {}
  const m = matFor(item, inst)
  const pieces: Piece[] = []
  if (item.model === 'shellTop') return shellTop(item, inst)
  const s = topSpec(p)
  const key = `${item.id}`
  for (const part of bodiceParts(s, key, topBottom(s.hem))) pieces.push(mesh(part.g, m, part.bone))
  if (bool(p, 'lacing')) {
    // cordones del corsé
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 10; i++) {
      const y = s.hem + 0.01 + (i / 10) * 0.16
      const tp = torsoPoint(y, 0, s.off + 0.003, 1)
      pts.push([(i % 2 ? 1 : -1) * 0.012, y, tp.z])
    }
    pieces.push(mesh(cg(`lace|${key}`, () => sweep(curveOf(pts), () => 0.0012, { radial: 6, segments: 60 })), solid('#ff5fae', { roughness: 0.4 }), 'hips'))
  }
  if (bool(p, 'fringe')) pieces.push(mesh(cg(`fringe|${key}`, () => fringe(topBottom(s.hem), s.off + 0.002, 0.05)), m, 'hips'))
  return { pieces, deformers: [] }
}

function fringe(yOf: (th: number) => number, off: number, len: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 40; i++) {
    const th = (i / 40) * Math.PI * 2
    const a = torsoPoint(yOf(th), th, off, 1)
    const b = torsoPoint(Math.max(TORSO_Y0 + 0.01, yOf(th) - len), th, off + 0.006, 1)
    parts.push(sweep(new THREE.LineCurve3(a, b), () => 0.0016, { radial: 5, segments: 2 }))
  }
  return merge(parts)
}

function shellTop(item: ItemDef, inst: ItemInstance): Built {
  const m = matFor(item, inst)
  const pieces: Piece[] = []
  const g = cg('shells', () => {
    const parts: THREE.BufferGeometry[] = []
    for (const side of [1, -1]) {
      // concha de vieira: abanico con estrías
      const sh = surface(
        24,
        10,
        (u, v, out) => {
          const a = (u - 0.5) * 2.4
          const r = v * 0.052
          const ridge = 0.003 * Math.abs(Math.sin(u * Math.PI * 9)) * v
          const x = Math.sin(a) * r
          const y = Math.cos(a) * r * 0.95 - 0.028
          const bulge = 0.022 * (1 - (x * x + (y + 0.0) * (y + 0.0)) / 0.0027) + ridge
          out.set(side * 0.052 + x, 1.128 + y, 0.0)
          const tp = torsoPoint(out.y, Math.atan2(out.x, 0.05), 0.004, 0)
          out.z = tp.z + Math.max(0, bulge) * 0.5
        },
        { orient: 'auto' },
      )
      parts.push(sh)
    }
    return merge(parts)
  })
  pieces.push(mesh(g, m, 'hips'))
  // tiras de perlas
  const strap = cg('shellstraps', () => {
    const parts: THREE.BufferGeometry[] = []
    for (const side of [1, -1]) {
      const pts: [number, number, number][] = [
        [side * 0.052, 1.165, 0.08],
        [side * 0.088, 1.265, 0.038],
        [side * 0.094, 1.296, 0.0],
        [side * 0.09, 1.27, -0.045],
        [side * 0.07, 1.14, -0.07],
      ]
      parts.push(sweep(curveOf(pts), () => 0.0022, { radial: 8, segments: 30 }))
    }
    const band: THREE.Vector3[] = []
    for (let i = 0; i < 48; i++) band.push(torsoPoint(1.098, (i / 48) * Math.PI * 2, 0.004, 1))
    parts.push(hemAlong(band, 0.0026))
    return merge(parts)
  })
  pieces.push(mesh(strap, fabricMaterial({ fabric: 'pearl', color: '#fff6f0' }), 'hips'))
  return { pieces, deformers: [] }
}

// ───────────────────── PARTES DE ABAJO ─────────────────────

export function pantsPieces(key: string, p: P, m: THREE.Material, m2?: THREE.Material): Piece[] {
  const waist = num(p, 'waist', 0.97)
  const length = num(p, 'length', 1)
  const flare = num(p, 'flare', 0)
  const baggy = num(p, 'baggy', 0)
  const tight = bool(p, 'tight')
  const off = tight ? 0.0035 : 0.0055 + baggy * 0.004
  const pieces: Piece[] = []
  pieces.push(
    mesh(
      cg(`pw|${key}`, () =>
        merge([
          torsoGarment({ top: () => waist, bottom: () => TORSO_Y0, off: (y) => off + baggy * 0.006 * smoothstep(waist, 0.8, y), closeBottom: true, bridge: 1 }),
          hemAlong(torsoEdge(() => waist, off + 0.0012), 0.0032),
        ]),
      ),
      m,
      'hips',
    ),
  )
  const total = 0.4 + 0.39
  const thighEnd = Math.min(0.405, total * length)
  const shinEnd = total * length - 0.4
  for (const [side, tb, sb] of [
    [1, 'hipL', 'kneeL'],
    [-1, 'hipR', 'kneeR'],
  ] as const) {
    const segs = side === 1 ? LEG_SEGS.L : LEG_SEGS.R
    const thighOff = (t: number) => off + baggy * 0.012 * smoothstep(-0.06, 0.15, t) + (shinEnd <= 0 ? flare * smoothstep(0, thighEnd, t) : 0)
    const parts = [legTube(side, 'thigh', -0.06, thighEnd + (shinEnd > 0 ? 0.02 : 0), thighOff)]
    if (shinEnd <= 0) parts.push(cuff(segs.thigh, thighEnd, thighOff(thighEnd)))
    pieces.push(mesh(cg(`pt|${key}|${side}`, () => merge(parts)), m, tb))
    if (shinEnd > 0) {
      const shinOff = (t: number) => off + baggy * 0.012 + flare * Math.pow(smoothstep(0.05, Math.max(0.1, shinEnd), t), 1.6)
      pieces.push(
        mesh(
          cg(`ps|${key}|${side}`, () => merge([legTube(side, 'shin', -0.035, shinEnd, shinOff), cuff(segs.shin, shinEnd, shinOff(shinEnd))])),
          m,
          sb,
        ),
      )
    }
    if (bool(p, 'stripe') && m2) {
      // franja lateral
      pieces.push(mesh(cg(`pst|${key}|${side}`, () => stripe(segs.thigh, side, thighOff, -0.04, thighEnd)), m2, tb))
      if (shinEnd > 0) {
        const shinOff = (t: number) => off + baggy * 0.012 + flare * Math.pow(smoothstep(0.05, Math.max(0.1, shinEnd), t), 1.6)
        pieces.push(mesh(cg(`pss|${key}|${side}`, () => stripe(segs.shin, side, shinOff, -0.02, shinEnd)), m2, sb))
      }
    }
  }
  return pieces
}

function stripe(seg: (typeof LEG_SEGS)['L']['thigh'], side: number, off: (t: number) => number, from: number, to: number) {
  const dir = new THREE.Vector3().subVectors(seg.to, seg.from).normalize()
  return surface(
    3,
    20,
    (u, v, out) => {
      const t = from + (to - from) * v
      const a = (u - 0.5) * 0.28
      const r = seg.r(t) + off(t) + 0.0008
      const p = seg.from.clone().addScaledVector(dir, t)
      out.set(p.x + side * Math.cos(a) * r * seg.ellipse[0], p.y, p.z + Math.sin(a) * r * seg.ellipse[1])
    },
    { orient: 'auto' },
  )
}

function skirtPieces(key: string, o: SkirtOpts, m: THREE.Material): Built {
  const sg = skirtGeometry(o)
  const deformer = new SkirtDeformer(sg, 0.012)
  const sk = new THREE.Mesh(sg.geo, m)
  sk.castShadow = true
  const pieces: Piece[] = [
    { bone: 'hips', mesh: sk, ownsGeometry: true },
    mesh(cg(`skw|${key}`, () => hemAlong(torsoEdge(() => o.waist, (o.off ?? 0.006) + 0.0012), 0.0034)), m, 'hips'),
  ]
  if (!o.slit) {
    // dobladillo que sigue a la falda deformada: se reconstruye cada vez
    const hem = new THREE.Mesh(skirtHem(o), m)
    pieces.push({ bone: 'hips', mesh: hem, ownsGeometry: true })
    hem.visible = o.hem > 0.2
  }
  return { pieces, deformers: [deformer] }
}

export function buildBottom(item: ItemDef, inst: ItemInstance): Built {
  const p = item.params ?? {}
  const m = matFor(item, inst)
  if (item.model === 'pants') return { pieces: pantsPieces(item.id, p, m, mat2For(item, inst)), deformers: [] }
  const o: SkirtOpts = {
    waist: num(p, 'waist', 0.99),
    hem: num(p, 'hem', 0.74),
    flare: num(p, 'flare', 0.04),
    pleats: num(p, 'pleats', 0) || undefined,
    tiers: num(p, 'tiers', 0) || undefined,
    slit: num(p, 'slit', 0) || undefined,
    off: 0.0065,
  }
  return skirtPieces(item.id, o, m)
}

// ───────────────────── VESTIDOS Y MONOS ─────────────────────

export function buildDress(item: ItemDef, inst: ItemInstance): Built {
  const p = item.params ?? {}
  const m = matFor(item, inst)
  if (item.model === 'mermaid') return mermaid(item, inst)
  if (item.model === 'fairy') return fairy(item, inst)
  const s = topSpec(p)
  const pieces: Piece[] = []
  if (item.model === 'jumpsuit') {
    for (const part of bodiceParts(s, item.id, () => 0.97)) pieces.push(mesh(part.g, m, part.bone))
    pieces.push(...pantsPieces(`${item.id}-legs`, { ...p, waist: 0.975 }, m, mat2For(item, inst)))
    return { pieces, deformers: [] }
  }
  const waist = 0.985
  for (const part of bodiceParts(s, item.id, () => waist - 0.01)) pieces.push(mesh(part.g, m, part.bone))
  const sk = skirtPieces(item.id, {
    waist,
    hem: num(p, 'hem', 0.6),
    flare: num(p, 'flare', 0.05),
    tiers: num(p, 'tiers', 0) || undefined,
    slit: num(p, 'slit', 0) || undefined,
    off: 0.0058,
  }, m)
  // en los vestidos el ribete de la cintura sobra
  sk.pieces.splice(1, 1)
  return { pieces: [...pieces, ...sk.pieces], deformers: sk.deformers }
}

function mermaid(item: ItemDef, inst: ItemInstance): Built {
  const m = matFor(item, inst)
  const pieces: Piece[] = []
  const s = topSpec({ neck: 'sweetheart', sleeve: 0 })
  for (const part of bodiceParts(s, 'mermaid', () => 0.97)) pieces.push(mesh(part.g, m, part.bone))
  const o: SkirtOpts = {
    waist: 0.98,
    hem: 0.0,
    flare: 0,
    off: 0.005,
    // ajustada hasta la rodilla y aleta abierta abajo
    profile: (y) => -0.03 * smoothstep(0.75, 0.42, y) * smoothstep(0.0, 0.3, y) + 0.17 * Math.pow(smoothstep(0.34, 0.0, y), 1.5),
    scallop: 0.03,
  }
  const sk = skirtPieces('mermaid', o, m)
  sk.pieces.splice(1, 1)
  // aletas laterales de tul iridiscente
  const fin = fabricMaterial({ fabric: 'holo', color: inst.color2 ?? item.color2 ?? '#c9a7ff' })
  const finG = cg('mermaidfins', () => {
    const parts: THREE.BufferGeometry[] = []
    for (const side of [1, -1]) {
      parts.push(
        surface(
          10,
          16,
          (u, v, out) => {
            const y = 0.42 - v * 0.38
            const base = skirtPoint(o, y, side * Math.PI * 0.5)
            const w = 0.05 * Math.sin(v * Math.PI) * u + 0.07 * v * v * u
            out.set(base.x + side * w, y - 0.02 * u * v, base.z - 0.02 * u)
          },
          { orient: 'auto' },
        ),
      )
    }
    return merge(parts)
  })
  pieces.push(mesh(finG, fin, 'hips'))
  return { pieces: [...pieces, ...sk.pieces], deformers: sk.deformers }
}

function fairy(item: ItemDef, inst: ItemInstance): Built {
  const m = matFor(item, inst)
  const m2 = fabricMaterial({ fabric: 'petal', color: inst.color2 ?? item.color2 ?? '#c9a7ff', color2: inst.color })
  const pieces: Piece[] = []
  const s = topSpec({ neck: 'sweetheart', sleeve: 0, straps: 'thin' })
  for (const part of bodiceParts(s, 'fairy', () => 0.97)) pieces.push(mesh(part.g, m, part.bone))
  // falda de pétalos en dos capas
  const petals = (layer: number) =>
    cg(`petals${layer}`, () => {
      const parts: THREE.BufferGeometry[] = []
      const n = 9
      for (let i = 0; i < n; i++) {
        const th0 = ((i + layer * 0.5) / n) * Math.PI * 2
        parts.push(
          surface(
            8,
            14,
            (u, v, out) => {
              const y = 0.985 - v * (0.3 - layer * 0.07)
              const half = 0.36 * Math.sin(Math.min(1, v * 1.25) * Math.PI * 0.62) * (1 - smoothstep(0.82, 1, v) * 0.85)
              const th = th0 + (u - 0.5) * 2 * half
              const p = skirtPoint({ waist: 0.985, hem: 0.6, flare: 0.16 + layer * 0.03, off: 0.008 + layer * 0.006 }, y, th)
              // curvatura del pétalo
              const cup = 0.012 * Math.sin(u * Math.PI) * v
              const len = Math.hypot(p.x, p.z)
              out.set(p.x + (p.x / len) * cup, y, p.z + (p.z / len) * cup)
            },
            { orient: 'auto' },
          ),
        )
      }
      return merge(parts)
    })
  pieces.push(mesh(petals(0), m2, 'hips'))
  pieces.push(mesh(petals(1), m, 'hips'))
  // enagua
  const sk = skirtPieces('fairy-under', { waist: 0.985, hem: 0.72, flare: 0.08, off: 0.006 }, fabricMaterial({ fabric: 'mesh', color: '#ffffff', pattern: 'rejilla' }))
  sk.pieces.splice(1, 2)
  return { pieces: [...pieces, ...sk.pieces], deformers: sk.deformers }
}

// ───────────────────── CHAQUETAS ─────────────────────

export function buildJacket(item: ItemDef, inst: ItemInstance): Built {
  const p = item.params ?? {}
  const m = matFor(item, inst)
  if (item.model === 'wings') return wings(item, inst)
  if (item.model === 'cape') return cape(item, inst)
  const hem = num(p, 'hem', 1.0)
  const puffer = num(p, 'puffer', 0)
  const collar = str(p, 'collar', 'none')
  const open = num(p, 'open', collar === 'hood' && num(p, 'closed', 0) ? 0 : 0.14)
  const quilt = bool(p, 'quilt')
  const off = 0.015 + puffer * 0.012
  const key = item.id
  const pieces: Piece[] = []
  const offF = (y: number) => off + (quilt ? 0.004 * Math.abs(Math.sin(y * 110)) : 0) + puffer * 0.004 * gauss(y - 1.12, 0.1)
  const top = (th: number) => 1.302 - 0.025 * Math.pow(Math.max(0, Math.cos(th)), 2)
  const bottom = (th: number) => hem + (open ? 0.008 * Math.cos(th) : 0)
  pieces.push(
    mesh(
      cg(`jk|${key}`, () =>
        merge([
          torsoGarment({ top, bottom, off: offF, bridge: 1, openFront: open, nu: 80 }),
          hemAlong(torsoEdge(bottom, off + 0.001, open, 72, 1), 0.0035, !open),
          ...(open ? [frontEdges(top, bottom, offF, open)] : []),
        ]),
      ),
      m,
      'hips',
    ),
  )
  // mangas por encima de las del top
  const sl = num(p, 'sleeve', 2)
  for (const [side, bone, fbone] of [
    [1, 'shoulderL', 'elbowL'],
    [-1, 'shoulderR', 'elbowR'],
  ] as const) {
    const segs = side === 1 ? ARM_SEGS.L : ARM_SEGS.R
    const so = 0.011 + puffer * 0.01
    const q = (t: number) => so + (quilt ? 0.003 * Math.abs(Math.sin(t * 90)) : 0)
    const upperEnd = sl >= 1 ? 0.275 : 0.27 * sl
    pieces.push(mesh(cg(`jks|${key}|${side}`, () => merge([sleeve(side, 'upper', -0.07, upperEnd, q), ...(sl < 1 ? [cuff(segs.upper, upperEnd, so)] : [])])), m, bone))
    if (sl > 1) {
      const foreEnd = Math.min(0.205, 0.205 * (sl - 1))
      const wide = bool(p, 'fringe') ? 0.02 : 0
      const fq = (t: number) => q(t) + wide * smoothstep(0, foreEnd, t)
      pieces.push(mesh(cg(`jkf|${key}|${side}`, () => merge([sleeve(side, 'fore', -0.03, foreEnd, fq), cuff(segs.fore, foreEnd, fq(foreEnd), 0.004)])), m, fbone))
    }
  }
  // cuellos
  const cm = collar === 'fur' ? fabricMaterial({ fabric: 'fur', color: inst.color }) : m
  if (collar === 'lapel') pieces.push(mesh(cg(`lapel|${key}`, () => lapels(off)), m, 'hips'))
  if (collar === 'fur') pieces.push(mesh(cg('furcollar', () => furCollar()), cm, 'hips'))
  if (collar === 'high' || collar === 'rib') pieces.push(mesh(cg(`stand|${collar}`, () => standCollar(collar === 'high' ? 0.045 : 0.018, open)), m, 'hips'))
  if (collar === 'hood') pieces.push(mesh(cg('hood', () => hood()), m, 'hips'))
  if (bool(p, 'zips')) {
    pieces.push(mesh(cg(`zip|${key}`, () => zips(off)), solid('#d8dbe6', { metalness: 1, roughness: 0.2 }), 'hips'))
  }
  if (bool(p, 'fringe')) pieces.push(mesh(cg(`jfr|${key}`, () => fringe(bottom, off + 0.002, 0.06)), m, 'hips'))
  if (bool(p, 'stripe')) {
    for (const [side, bone] of [
      [1, 'shoulderL'],
      [-1, 'shoulderR'],
    ] as const) {
      const segs = side === 1 ? ARM_SEGS.L : ARM_SEGS.R
      pieces.push(mesh(cg(`jst|${key}|${side}`, () => stripeArm(segs.upper, side, 0.0125)), mat2For(item, inst), bone))
    }
  }
  return { pieces, deformers: [] }
}

function stripeArm(seg: (typeof ARM_SEGS)['L']['upper'], side: number, off: number) {
  const dir = new THREE.Vector3().subVectors(seg.to, seg.from).normalize()
  return surface(
    3,
    16,
    (u, v, out) => {
      const t = -0.02 + 0.29 * v
      const a = (u - 0.5) * 0.35
      const r = seg.r(t) + off
      const p = seg.from.clone().addScaledVector(dir, t)
      out.set(p.x + side * Math.cos(a) * r, p.y, p.z + Math.sin(a) * r)
    },
    { orient: 'auto' },
  )
}

function frontEdges(top: (th: number) => number, bottom: (th: number) => number, off: (y: number) => number, gap: number) {
  const parts: THREE.BufferGeometry[] = []
  for (const th of [gap, Math.PI * 2 - gap]) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 20; i++) {
      const y = bottom(th) + (top(th) - bottom(th)) * (i / 20)
      pts.push(torsoPoint(y, th, off(y) + 0.001, 1))
    }
    parts.push(hemAlong(pts, 0.0035, false))
  }
  return merge(parts)
}

function lapels(off: number) {
  const parts: THREE.BufferGeometry[] = []
  for (const side of [1, -1]) {
    parts.push(
      surface(
        6,
        14,
        (u, v, out) => {
          const y = 1.28 - v * 0.17
          const th = side * (0.16 + u * (0.28 - v * 0.18))
          torsoPoint(y, th, off + 0.006 + 0.002 * u, 1, out)
        },
        { orient: 'auto' },
      ),
    )
  }
  return merge(parts)
}

function furCollar() {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 30; i++) {
    const th = 0.15 + (i / 30) * (Math.PI * 2 - 0.3)
    const p = torsoPoint(1.285 - 0.03 * Math.pow(Math.max(0, Math.cos(th)), 2), th, 0.028, 1)
    pts.push([p.x, p.y, p.z])
  }
  return sweep(curveOf(pts), (t) => 0.022 + 0.004 * Math.sin(t * 60), { radial: 14, segments: 120, capStart: true, capEnd: true })
}

function standCollar(h: number, gap: number) {
  return surface(
    48,
    4,
    (u, v, out) => {
      const th = gap + (Math.PI * 2 - 2 * gap) * u
      const y = 1.29 + v * h
      const r = 0.05 + 0.006 * v
      out.set(Math.sin(th) * r, y, Math.cos(th) * r * 0.92 - 0.004)
    },
    { orient: 'auto' },
  )
}

function hood() {
  return surface(
    32,
    14,
    (u, v, out) => {
      const th = Math.PI * 0.45 + u * Math.PI * 1.1
      const y = 1.29 + v * 0.1
      const r = 0.07 + 0.05 * Math.sin(v * Math.PI)
      out.set(Math.sin(th) * r * 1.3, y, Math.cos(th) * r - 0.02)
    },
    { orient: 'auto' },
  )
}

function zips(off: number) {
  const parts: THREE.BufferGeometry[] = []
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 16; i++) {
    const y = 1.0 + i * 0.017
    pts.push(torsoPoint(y, 0.18 - i * 0.004, off + 0.004, 1))
  }
  parts.push(sweep(new THREE.CatmullRomCurve3(pts), () => 0.0016, { radial: 6, segments: 30 }))
  return merge(parts)
}

function wings(item: ItemDef, inst: ItemInstance): Built {
  const m = fabricMaterial({ fabric: 'holo', color: inst.color })
  m.side = THREE.DoubleSide
  m.transparent = true
  m.opacity = 0.82
  const m2 = fabricMaterial({ fabric: 'holo', color: inst.color2 ?? item.color2 ?? '#ffb3e6' })
  m2.side = THREE.DoubleSide
  const holders: THREE.Group[] = []
  const pieces: Piece[] = []
  for (const side of [1, -1]) {
    const holder = new THREE.Group()
    holder.position.set(side * 0.03, 1.16, -0.085)
    const g = cg(`wing|${side}`, () => wingGeo(side))
    const w = new THREE.Mesh(g, m)
    holder.add(w)
    const vein = new THREE.Mesh(cg(`wingvein|${side}`, () => wingVeins(side)), m2)
    holder.add(vein)
    const root = new THREE.Group()
    root.position.copy(new THREE.Vector3(0, 0, 0))
    root.add(holder)
    holders.push(holder)
    pieces.push({ bone: 'hips', mesh: root, ownsGeometry: false })
  }
  return {
    pieces,
    deformers: [],
    animate(t) {
      holders.forEach((h, i) => {
        const s = i === 0 ? 1 : -1
        h.rotation.set(0, s * (-0.35 - 0.25 * (0.5 + 0.5 * Math.sin(t * 3.2))), 0)
      })
    },
  }
}

function wingShapePoint(side: number, u: number, v: number) {
  // dos lóbulos (superior grande e inferior pequeño)
  const a = u * Math.PI * 2
  const upper = Math.sin(a) > 0
  const r = (upper ? 0.27 : 0.17) * (0.6 + 0.4 * Math.abs(Math.sin(a))) * v
  const x = Math.abs(Math.cos(a + 0.25)) * r * 1.05
  const y = Math.sin(a) * r * (upper ? 1.0 : 0.85) + (upper ? 0.02 : 0)
  return [side * x, y]
}

function wingGeo(side: number) {
  return surface(
    48,
    6,
    (u, v, out) => {
      const [x, y] = wingShapePoint(side, u, v)
      out.set(x, y, -Math.abs(x) * 0.25)
    },
    { orient: 'auto' },
  )
}

function wingVeins(side: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const u = (i + 0.5) / 6
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 6; k++) {
      const [x, y] = wingShapePoint(side, u, 0.05 + 0.93 * (k / 6))
      pts.push(new THREE.Vector3(x, y, -Math.abs(x) * 0.25 + 0.001))
    }
    parts.push(sweep(new THREE.CatmullRomCurve3(pts), () => 0.0014, { radial: 5, segments: 16 }))
  }
  return merge(parts)
}

function cape(item: ItemDef, inst: ItemInstance): Built {
  const m = matFor(item, inst)
  const g = cg('cape', () =>
    surface(
      40,
      24,
      (u, v, out) => {
        const th = Math.PI * 0.42 + u * Math.PI * 1.16
        const y = 1.3 - v * 0.82
        const base = y > 0.8 ? torsoPoint(Math.min(1.3, y), th, 0.03 + 0.08 * v, 1) : skirtPoint({ waist: 0.99, hem: 0.4, flare: 0.1, off: 0.06 }, y, th)
        out.copy(base)
        out.y = y
      },
      { orient: 'auto' },
    ),
  )
  const clasp = cg('clasp', () => {
    const s = extrude(starShape(0.012, 0.45), 0.004)
    s.translate(0, 1.27, 0.07)
    return s
  })
  return {
    pieces: [mesh(g, m, 'hips'), mesh(clasp, solid('#e3b45a', { metalness: 1, roughness: 0.2 }), 'hips')],
    deformers: [],
  }
}

export { heartShape, ellipsoid, torus }

import * as THREE from 'three'
import type { ItemDef, ItemInstance } from '../../data/types'
import { FOOT_ELLIPSE, J, footPath, footR, mirrorX, toeBottom } from '../body'
import { curveOf, extrude, heartShape, merge, parallelFrames, smoothstep, surface, sweep } from '../geo'
import { fabricMaterial, solid } from '../materials'
import { LEG_SEGS, cuff, legTube } from './garment'
import { cg, matFor, mat2For, type Built, type Piece } from './wear'

// Calzado: plataformas, botas, deportivas, tacones, sandalias…

interface ShoeSpec {
  arch: number
  soleFront: number
  heel: 'none' | 'stiletto' | 'block' | 'wedge'
  coverage: (t: number) => number // fracción de vuelta cubierta (1 = cerrado)
  closed: boolean
  shaft: number // altura de caña sobre el tobillo
  soleColor?: string
  pointy?: boolean
}

function spec(item: ItemDef): ShoeSpec {
  const p = item.params ?? {}
  const heel = typeof p.heel === 'number' ? p.heel : 0
  const pump = (t: number) => 0.56 + 0.44 * smoothstep(0.42, 0.72, t)
  switch (item.model) {
    case 'heels':
      return { arch: 1, soleFront: 0.006, heel: 'stiletto', coverage: pump, closed: true, shaft: 0, pointy: true }
    case 'platform':
      return { arch: 0.6, soleFront: 0.05, heel: 'block', coverage: pump, closed: true, shaft: 0 }
    case 'kneeboots':
      return { arch: 0.85, soleFront: 0.01, heel: 'stiletto', coverage: () => 1, closed: true, shaft: 0.34, pointy: true }
    case 'boots':
      return {
        arch: heel * 0.9,
        soleFront: p.lug ? 0.022 : 0.012,
        heel: 'block',
        coverage: () => 1,
        closed: true,
        shaft: p.cowboy ? 0.2 : p.fluffy ? 0.17 : 0.11,
        pointy: Boolean(p.cowboy),
        soleColor: p.lug ? '#1c1626' : '#3a2a20',
      }
    case 'sneakers':
      return { arch: 0.05, soleFront: 0.024, heel: 'none', coverage: () => 1, closed: true, shaft: p.high ? 0.075 : 0, soleColor: '#ffffff' }
    case 'sandals':
      return { arch: 0.35, soleFront: 0.006, heel: 'block', coverage: () => 0, closed: false, shaft: 0 }
    case 'ballet':
      return { arch: 0, soleFront: 0.005, heel: 'none', coverage: (t) => (t > 0.66 ? 1 : 0.5), closed: true, shaft: 0 }
    case 'wedge':
      return { arch: 0.62, soleFront: 0.03, heel: 'wedge', coverage: (t) => (t > 0.6 ? 1 : t < 0.2 ? 0.6 : 0.4), closed: true, shaft: 0 }
    case 'flipflops':
      return { arch: 0, soleFront: 0.014, heel: 'none', coverage: () => 0, closed: false, shaft: 0 }
    default:
      return { arch: 0, soleFront: 0.01, heel: 'none', coverage: () => 1, closed: true, shaft: 0 }
  }
}

export function shoeLift(s: { arch: number; soleFront: number }) {
  return s.soleFront - J.ankleL.y - toeBottom(s.arch)
}

/** Carcasa del zapato alrededor del pie (cubre una fracción centrada en la planta). */
function shell(arch: number, off: number, coverage: (t: number) => number, pointy: boolean, from = 0, to = 1): THREE.BufferGeometry {
  const path = curveOf(footPath(arch))
  const segs = 28
  const frames = parallelFrames(path, segs, new THREE.Vector3(0, 1, 0))
  const [ev, eh] = FOOT_ELLIPSE
  return surface(
    28,
    segs,
    (u, v, out) => {
      const t = from + (to - from) * v
      const j = Math.round(t * segs)
      const f = frames[j]
      const cov = Math.max(0.05, coverage(t))
      const a = Math.PI + (u - 0.5) * 2 * Math.PI * cov
      let r = footR(t) + off
      if (pointy && t > 0.8) r *= 1 - 0.3 * smoothstep(0.8, 1, t)
      // extremos redondeados: la punta y el talón se cierran
      const tipK = smoothstep(0.86, 1, t)
      const heelK = smoothstep(0.1, 0, t)
      const tipExt = Math.sin(tipK * Math.PI * 0.5) * r * (pointy ? 0.85 : 0.6) - Math.sin(heelK * Math.PI * 0.5) * r * 0.55
      r *= Math.cos(tipK * Math.PI * 0.5) * 0.92 + 0.08 * (1 - tipK) + (tipK > 0 ? 0.0 : 0)
      r *= Math.sqrt(Math.max(0.0, 1 - heelK * heelK * 0.97))
      out.copy(f.p)
        .addScaledVector(f.t, tipExt)
        .addScaledVector(f.n, Math.cos(a) * r * (ev + 0.15))
        .addScaledVector(f.b, Math.sin(a) * r * eh)
    },
    { orient: 'auto' },
  )
}

/** Suela: perfil plano bajo el pie, hasta `bottom(t)` (relativo al tobillo). */
function sole(arch: number, bottom: (t: number, top: number) => number, widen = 0.003): THREE.BufferGeometry {
  const path = curveOf(footPath(arch))
  const segs = 30
  const frames = parallelFrames(path, segs, new THREE.Vector3(0, 1, 0))
  const [ev, eh] = FOOT_ELLIPSE
  // contorno: 0..1 recorre la sección (arriba izq → arriba der → abajo der → abajo izq)
  return surface(
    24,
    segs,
    (u, v, out) => {
      const j = Math.round(v * segs)
      const f = frames[j]
      const t = v
      const w = (footR(t) * eh + widen) * (0.35 + 0.65 * Math.sin(Math.min(1, Math.min(t, 1 - t) * 6 + 0.05) * Math.PI * 0.5))
      const top = f.p.y - footR(t) * ev * 0.92
      const bot = Math.min(top - 0.003, bottom(t, top))
      const a = u * Math.PI * 2
      const side = Math.cos(a)
      const isTop = Math.sin(a) > 0
      // sección redondeada
      const x = side * w * (1 - 0.15 * Math.pow(Math.abs(Math.sin(a)), 4))
      const y = isTop ? top : bot
      const zf = f.p.z + t * 0.012 - 0.006
      out.set(f.p.x + x, y + (isTop ? 0 : 0) + Math.sin(a) * 0.0005, zf)
    },
    { closedU: true, orient: 'auto' },
  )
}

function stiletto(arch: number, ground: number, block: boolean): THREE.BufferGeometry {
  const pts = footPath(arch)
  const heel = new THREE.Vector3(...pts[0])
  const top = heel.y - footR(0) * FOOT_ELLIPSE[0]
  const h = top - ground
  const g = new THREE.CylinderGeometry(block ? 0.016 : 0.0105, block ? 0.013 : 0.0032, h, 16, 1)
  g.translate(0, top - h / 2, heel.z + 0.004 + (block ? 0 : -0.004))
  if (!block) {
    // pequeña inclinación hacia delante del tacón de aguja
    g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0.12, 0))
  }
  return g
}

function laces(arch: number): THREE.BufferGeometry {
  const path = curveOf(footPath(arch))
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const t = 0.35 + i * 0.09
    const p = path.getPointAt(t)
    const r = footR(t) * (FOOT_ELLIPSE[0] + 0.15) + 0.0015
    const a = new THREE.Vector3(-0.012, p.y + r, p.z - 0.004)
    const b = new THREE.Vector3(0.012, p.y + r, p.z + 0.004)
    parts.push(sweep(new THREE.LineCurve3(a, b), () => 0.0016, { radial: 6, segments: 2 }))
  }
  return merge(parts)
}

function sandalStraps(arch: number): THREE.BufferGeometry {
  const path = curveOf(footPath(arch))
  const parts: THREE.BufferGeometry[] = []
  for (const t of [0.42, 0.62, 0.82]) {
    const p = path.getPointAt(t)
    const r = footR(t) + 0.0025
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.5 + (i / 12) * Math.PI
      pts.push([Math.cos(a) * r * FOOT_ELLIPSE[1] * -1, p.y + Math.sin(a) * r * FOOT_ELLIPSE[0], p.z])
    }
    // sólo la parte de arriba
    parts.push(sweep(curveOf(pts.map(([x, y, z]) => [x, Math.max(y, p.y - footR(t) * 0.6), z])), () => 0.0022, { radial: 6, segments: 16, ellipse: [0.5, 1] }))
  }
  // tira del tobillo
  const ank: [number, number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ank.push([Math.sin(a) * 0.027, 0.0, Math.cos(a) * 0.026 - 0.006])
  }
  parts.push(sweep(curveOf(ank), () => 0.0025, { radial: 6, segments: 30, ellipse: [0.5, 1] }))
  return merge(parts)
}

function flipStrap(): THREE.BufferGeometry {
  const pts: [number, number, number][] = [
    [-0.022, -0.06, 0.035],
    [-0.012, -0.045, 0.06],
    [0, -0.052, 0.085],
    [0.012, -0.045, 0.06],
    [0.022, -0.06, 0.035],
  ]
  const g = sweep(curveOf(pts), () => 0.003, { radial: 6, segments: 24, ellipse: [0.5, 1] })
  const h = extrude(heartShape(0.008), 0.003)
  h.rotateX(-1.1)
  h.translate(0, -0.047, 0.085)
  return merge([g, h])
}

function bow(arch: number): THREE.BufferGeometry {
  const path = curveOf(footPath(arch))
  const p = path.getPointAt(0.7)
  const r = footR(0.7) * (FOOT_ELLIPSE[0] + 0.15) + 0.003
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const loop = new THREE.TorusGeometry(0.006, 0.0018, 6, 12)
    loop.scale(1, 0.6, 1)
    loop.rotateX(-Math.PI / 2)
    loop.translate(s * 0.007, p.y + r, p.z)
    parts.push(loop)
  }
  return merge(parts)
}

export function buildShoes(item: ItemDef, inst: ItemInstance): Built & { lift: number; arch: number; hideFeet: boolean } {
  const s = spec(item)
  const m = matFor(item, inst)
  const lift = shoeLift(s)
  const ground = -(J.ankleL.y + lift)
  const pieces: Piece[] = []
  const soleM = s.soleColor ? solid(s.soleColor, { roughness: 0.6 }) : item.model === 'wedge' ? fabricMaterial({ fabric: 'cotton', color: item.color2 ?? '#d9b98a', pattern: 'rayas', color2: '#b8925e' }) : m
  const key = item.id
  const geos = cg(`shoe|${key}`, () => {
    const parts: THREE.BufferGeometry[] = []
    if (s.closed) parts.push(shell(s.arch, 0.0035, s.coverage, Boolean(s.pointy)))
    if (item.model === 'sandals') parts.push(sandalStraps(s.arch))
    if (item.model === 'flipflops') parts.push(flipStrap())
    if (item.model === 'platform') {
      // tira merceditas
      const path = curveOf(footPath(s.arch))
      const p = path.getPointAt(0.32)
      const pts: [number, number, number][] = []
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (i / 10)
        pts.push([Math.cos(a) * 0.026, p.y + Math.sin(a) * 0.02, p.z])
      }
      parts.push(sweep(curveOf(pts), () => 0.003, { radial: 6, segments: 14, ellipse: [0.5, 1] }))
    }
    return merge(parts)
  })
  const soleG = cg(`sole|${key}`, () => {
    const parts: THREE.BufferGeometry[] = []
    const bottom =
      s.heel === 'wedge'
        ? () => ground
        : s.arch < 0.2
          ? () => ground
          : (t: number, top: number) => (t > 0.58 ? ground : top - 0.006)
    parts.push(sole(s.arch, bottom, item.model === 'sneakers' ? 0.006 : 0.003))
    if (s.heel === 'stiletto' || s.heel === 'block') {
      if (s.arch >= 0.2) parts.push(stiletto(s.arch, ground, s.heel === 'block'))
    }
    return merge(parts)
  })
  for (const [side, bone] of [
    [1, 'ankleL'],
    [-1, 'ankleR'],
  ] as const) {
    const ankle = side === 1 ? J.ankleL : mirrorX(J.ankleL)
    const g1 = new THREE.Mesh(geos, m)
    g1.position.copy(ankle)
    const g2 = new THREE.Mesh(soleG, soleM)
    g2.position.copy(ankle)
    pieces.push({ bone, mesh: g1, ownsGeometry: false }, { bone, mesh: g2, ownsGeometry: false })
    if (item.model === 'sneakers') {
      const l = new THREE.Mesh(cg('laces', () => laces(s.arch)), solid('#ffffff', { roughness: 0.7 }))
      l.position.copy(ankle)
      pieces.push({ bone, mesh: l, ownsGeometry: false })
      const st = new THREE.Mesh(cg('swoosh', () => swoosh(s.arch)), mat2For(item, inst))
      st.position.copy(ankle)
      pieces.push({ bone, mesh: st, ownsGeometry: false })
    }
    if (item.model === 'ballet') {
      const b = new THREE.Mesh(cg('balletbow', () => bow(s.arch)), m)
      b.position.copy(ankle)
      pieces.push({ bone, mesh: b, ownsGeometry: false })
    }
    if (s.shaft > 0) {
      const segs = side === 1 ? LEG_SEGS.L : LEG_SEGS.R
      const from = 0.392 - s.shaft
      const fluffy = item.params?.fluffy === true
      const off = (t: number) => 0.0045 + (fluffy ? 0.012 : 0) + (item.params?.cowboy ? 0.006 * smoothstep(from + 0.05, 0.392, 0.392 - t + from) : 0)
      const shaftG = cg(`shaft|${key}|${side}`, () => merge([legTube(side, 'shin', from, 0.405, off), cuff(segs.shin, from, off(from) + 0.001, fluffy ? 0.008 : 0.003)]))
      pieces.push({ bone: side === 1 ? 'kneeL' : 'kneeR', mesh: new THREE.Mesh(shaftG, m), ownsGeometry: false })
    }
  }
  return { pieces, deformers: [], lift, arch: s.arch, hideFeet: s.closed }
}

function swoosh(arch: number): THREE.BufferGeometry {
  const path = curveOf(footPath(arch))
  const parts: THREE.BufferGeometry[] = []
  for (const side of [1, -1]) {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 10; i++) {
      const t = 0.15 + i * 0.06
      const p = path.getPointAt(t)
      const r = footR(t) * FOOT_ELLIPSE[1] + 0.0045
      pts.push([side * r, p.y - 0.004 + Math.sin((i / 10) * Math.PI) * 0.008, p.z])
    }
    parts.push(sweep(curveOf(pts), (t) => 0.0035 * (1 - 0.6 * t), { radial: 6, segments: 20, ellipse: [0.3, 1] }))
  }
  return merge(parts)
}

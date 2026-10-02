import * as THREE from 'three'
import type { ItemDef, ItemInstance } from '../../data/types'
import { HEAD, J, headPoint, mirrorX, torsoPoint } from '../body'
import { curveOf, ellipsoid, extrude, heartShape, merge, roundedRectShape, smoothstep, starShape, surface, sweep, torus, ellipseShape } from '../geo'
import { fabricMaterial, solid } from '../materials'
import { scalp } from '../hair'
import { ARM_SEGS } from './garment'
import { cg, matFor, mat2For, type Built, type Piece } from './wear'

// Bolsos, joyas, gafas, gorros y accesorios del pelo.

const HC = J.headCenter
const metal = (c: string) => fabricMaterial({ fabric: 'metal', color: c })
const gem = (c: string) => fabricMaterial({ fabric: 'gem', color: c })

function m(g: THREE.BufferGeometry, mat: THREE.Material, bone: Piece['bone'], pos?: THREE.Vector3): Piece {
  const me = new THREE.Mesh(g, mat)
  if (pos) me.position.copy(pos)
  me.castShadow = true
  return { bone, mesh: me, ownsGeometry: false }
}

/** Z de la superficie de la cara en (x, y) relativos al centro de la cabeza. */
export function faceZ(x: number, y: number): number {
  let best = 0
  let bestD = 1e9
  const p = new THREE.Vector3()
  for (let i = 0; i <= 40; i++) {
    for (let j = 0; j <= 40; j++) {
      const lon = -0.9 + (i / 40) * 1.8
      const lat = -0.9 + (j / 40) * 1.8
      headPoint(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon), { lipFullness: 1 }, p)
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = p.z
      }
    }
  }
  return best
}

// ─────────────────────── BOLSOS ───────────────────────

const HAND_R = mirrorX(J.wristL).add(new THREE.Vector3(0, -0.05, 0.004))

function strapAround(pts: [number, number, number][], r = 0.0028, flat = true) {
  return sweep(curveOf(pts), () => r, { radial: 8, segments: 60, ellipse: flat ? [0.35, 1] : [1, 1] })
}

export function buildBag(item: ItemDef, inst: ItemInstance): Built {
  const mat = matFor(item, inst)
  const gold = metal('#e3b45a')
  const pieces: Piece[] = []
  const key = item.id
  switch (item.model) {
    case 'baguette': {
      // bolso baguette colgado de la mano
      const body = cg('baguette', () => {
        const g = extrude(roundedRectShape(0.13, 0.055, 0.02), 0.032, 0.01)
        g.rotateY(Math.PI / 2)
        g.translate(HAND_R.x - 0.012, HAND_R.y - 0.1, HAND_R.z)
        return g
      })
      pieces.push(m(body, mat, 'wristR'))
      pieces.push(m(cg('baguettestrap', () => strapAround([[HAND_R.x - 0.012, HAND_R.y - 0.075, HAND_R.z - 0.045], [HAND_R.x - 0.008, HAND_R.y, HAND_R.z - 0.012], [HAND_R.x - 0.008, HAND_R.y, HAND_R.z + 0.012], [HAND_R.x - 0.012, HAND_R.y - 0.075, HAND_R.z + 0.045]], 0.0035)), mat, 'wristR'))
      pieces.push(m(cg('baguetteclasp', () => {
        const g = extrude(roundedRectShape(0.024, 0.014, 0.004), 0.004)
        g.rotateY(-Math.PI / 2)
        g.translate(HAND_R.x - 0.03, HAND_R.y - 0.1, HAND_R.z)
        return g
      }), gold, 'wristR'))
      break
    }
    case 'heartBag': {
      const g = cg('heartbag', () => {
        const b = extrude(heartShape(0.06), 0.028, 0.012)
        b.translate(HAND_R.x - 0.012, HAND_R.y - 0.115, HAND_R.z)
        return b
      })
      pieces.push(m(g, mat, 'wristR'))
      pieces.push(m(cg('heartbaghandle', () => torusAt(HAND_R.clone().add(new THREE.Vector3(-0.012, -0.03, 0)), 0.03, 0.003, 'x')), gold, 'wristR'))
      break
    }
    case 'clutch': {
      const g = cg('clutch', () => {
        const b = extrude(roundedRectShape(0.11, 0.055, 0.012), 0.02, 0.008)
        b.rotateY(Math.PI / 2)
        b.rotateX(0.2)
        b.translate(HAND_R.x - 0.016, HAND_R.y - 0.02, HAND_R.z + 0.02)
        return b
      })
      pieces.push(m(g, mat, 'wristR'))
      break
    }
    case 'backpack': {
      const g = cg('backpack', () => {
        const b = extrude(roundedRectShape(0.15, 0.17, 0.05), 0.06, 0.02)
        b.translate(0, 1.12, -0.12)
        return b
      })
      pieces.push(m(g, mat, 'hips'))
      for (const s of [1, -1]) {
        pieces.push(m(cg(`bpstrap${s}`, () => strapAround([[s * 0.05, 1.2, -0.1], [s * 0.08, 1.3, -0.02], [s * 0.09, 1.27, 0.06], [s * 0.1, 1.12, 0.085], [s * 0.1, 1.05, -0.06]], 0.0045)), mat, 'hips'))
      }
      pieces.push(m(cg('bppocket', () => {
        const b = extrude(heartShape(0.035), 0.012, 0.006)
        b.translate(0, 1.1, -0.155)
        b.rotateY(Math.PI)
        b.translate(0, 0, -0.31)
        return b
      }), fabricMaterial({ fabric: 'holo', color: '#ffffff' }), 'hips'))
      break
    }
    case 'basket':
    case 'tote': {
      const basket = item.model === 'basket'
      const g = cg(item.model, () => {
        const b = surface(
          32,
          10,
          (u, v, out) => {
            const a = u * Math.PI * 2
            const w = basket ? 0.085 - 0.02 * v : 0.09
            const d = basket ? 0.035 : 0.03
            out.set(Math.cos(a) * w * 0.45 + HAND_R.x - 0.02, HAND_R.y - 0.08 - v * (basket ? 0.13 : 0.18), Math.sin(a) * d + Math.cos(a) * w * 0.9 + HAND_R.z)
          },
          { closedU: true, orient: 'auto' },
        )
        const bottom = ellipsoid(0.04, 0.008, 0.08, 16, 8)
        bottom.translate(HAND_R.x - 0.02, HAND_R.y - (basket ? 0.21 : 0.26), HAND_R.z)
        return merge([b, bottom])
      })
      pieces.push(m(g, basket ? fabricMaterial({ fabric: 'cotton', color: inst.color, pattern: 'rayas', color2: '#b8925e' }) : mat, 'wristR'))
      pieces.push(m(cg(`${item.model}handle`, () => strapAround([[HAND_R.x - 0.02, HAND_R.y - 0.08, HAND_R.z - 0.07], [HAND_R.x - 0.01, HAND_R.y + 0.005, HAND_R.z - 0.02], [HAND_R.x - 0.01, HAND_R.y + 0.005, HAND_R.z + 0.02], [HAND_R.x - 0.02, HAND_R.y - 0.08, HAND_R.z + 0.07]], 0.004, false)), basket ? solid('#8a5a3c', { roughness: 0.6 }) : mat2For(item, inst), 'wristR'))
      if (basket) pieces.push(m(cg('basketflower', () => flower(new THREE.Vector3(HAND_R.x - 0.06, HAND_R.y - 0.12, HAND_R.z + 0.03), new THREE.Vector3(-1, 0, 0.2), 0.022)), fabricMaterial({ fabric: 'cotton', color: '#ff5fae' }), 'wristR'))
      break
    }
    case 'fanny': {
      const g = cg('fanny', () => {
        const b = ellipsoid(0.07, 0.035, 0.03, 24, 12)
        b.translate(0.0, 0.975, 0.105)
        return b
      })
      pieces.push(m(g, mat, 'hips'))
      const belt: [number, number, number][] = []
      for (let i = 0; i <= 32; i++) {
        const th = (i / 32) * Math.PI * 2
        const p = torsoPoint(0.975, th, 0.022, 1)
        belt.push([p.x, p.y, p.z])
      }
      pieces.push(m(cg('fannybelt', () => sweep(new THREE.CatmullRomCurve3(belt.slice(0, 32).map((p) => new THREE.Vector3(...p)), true), () => 0.006, { radial: 6, segments: 64, ellipse: [1, 0.3] })), solid('#1c1626', { roughness: 0.5 }), 'hips'))
      break
    }
    default: {
      // bolso bandolera (tachuelas, flecos, pelo, disco, concha)
      const pos = new THREE.Vector3(-0.085, 0.915, 0.112)
      let body: THREE.BufferGeometry
      if (item.model === 'discoBag') body = ellipsoid(0.055, 0.055, 0.055, 24, 16)
      else if (item.model === 'shellBag') body = shellShape(0.07)
      else if (item.model === 'furBag') body = ellipsoid(0.07, 0.055, 0.035, 24, 16)
      else body = extrude(roundedRectShape(0.12, 0.09, 0.02), 0.035, 0.008)
      const g = cg(`cross|${item.model}`, () => {
        const b = body.clone()
        b.rotateY(0.25)
        b.translate(pos.x, pos.y, pos.z)
        return b
      })
      const bm = item.model === 'discoBag' ? fabricMaterial({ fabric: 'sequin', color: inst.color, pattern: 'lentejuelas' }) : mat
      pieces.push(m(g, bm, 'hips'))
      // correa cruzada desde el hombro izquierdo
      const pts: [number, number, number][] = [
        [-0.135, 0.95, 0.105],
        [-0.13, 1.05, 0.09],
        [-0.11, 1.17, 0.09],
        [-0.095, 1.262, 0.04],
        [-0.096, 1.298, 0.0],
        [-0.09, 1.26, -0.06],
        [-0.04, 1.1, -0.08],
        [0.06, 0.97, -0.09],
        [0.13, 0.95, -0.02],
        [0.12, 0.94, 0.07],
        [-0.04, 0.95, 0.105],
      ]
      pieces.push(m(cg('crossstrap', () => strapAround(pts, 0.004)), item.model === 'studded' ? solid('#c0c4d6', { metalness: 1, roughness: 0.25 }) : mat, 'hips'))
      if (item.model === 'studded') pieces.push(m(cg('studs', () => studsOn(pos)), metal('#d8dbe6'), 'hips'))
      if (item.model === 'fringeBag') pieces.push(m(cg('bagfringe', () => fringeUnder(pos)), mat, 'hips'))
    }
  }
  void key
  return { pieces, deformers: [] }
}

function torusAt(c: THREE.Vector3, R: number, r: number, axis: 'x' | 'y' | 'z') {
  const g = torus(R, r, 28, 8)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(c.x, c.y, c.z)
  return g
}

function shellShape(s: number) {
  return surface(
    24,
    10,
    (u, v, out) => {
      const a = (u - 0.5) * 2.6
      const r = v * s
      const ridge = 0.004 * Math.abs(Math.sin(u * Math.PI * 8)) * v
      out.set(Math.sin(a) * r, Math.cos(a) * r - s * 0.5, 0.025 * Math.sin(v * Math.PI * 0.9) + ridge)
    },
    { orient: 'auto' },
  )
}

function studsOn(pos: THREE.Vector3) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      const s = new THREE.ConeGeometry(0.005, 0.008, 6)
      s.rotateX(Math.PI / 2)
      s.translate(pos.x - 0.045 + i * 0.03, pos.y - 0.03 + j * 0.03, pos.z + 0.024)
      parts.push(s)
    }
  return merge(parts)
}

function fringeUnder(pos: THREE.Vector3) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 14; i++) {
    const x = pos.x - 0.055 + i * 0.0085
    parts.push(sweep(new THREE.LineCurve3(new THREE.Vector3(x, pos.y - 0.04, pos.z), new THREE.Vector3(x, pos.y - 0.1, pos.z + 0.004)), () => 0.0016, { radial: 5, segments: 2 }))
  }
  return merge(parts)
}

export function flower(c: THREE.Vector3, normal: THREE.Vector3, size: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const p = ellipsoid(size * 0.55, size * 0.32, size * 0.12, 12, 8)
    p.translate(size * 0.55, 0, 0)
    p.rotateZ(a)
    parts.push(p)
  }
  const center = ellipsoid(size * 0.25, size * 0.25, size * 0.2, 10, 8)
  center.translate(0, 0, size * 0.08)
  parts.push(center)
  const g = merge(parts)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize()))
  g.translate(c.x, c.y, c.z)
  return g
}

// ─────────────────────── JOYAS ───────────────────────

const LOBE = (s: number) => new THREE.Vector3(s * (HEAD.rx * 1.0 + 0.006), HC.y - 0.036, HC.z - 0.012)

export function buildJewel(item: ItemDef, inst: ItemInstance): Built {
  const pieces: Piece[] = []
  const c = inst.color
  const mat = item.fabric === 'metal' ? metal(c) : item.fabric === 'gem' ? gem(c) : matFor(item, inst)
  switch (item.model) {
    case 'hoops':
    case 'heartHoops': {
      for (const s of [1, -1]) {
        const g = cg(`${item.model}${s}`, () => {
          const l = LOBE(s)
          if (item.model === 'hoops') return torusAt(l.clone().add(new THREE.Vector3(0, -0.026, 0)), 0.026, 0.0022, 'x')
          const sh = heartShape(0.024)
          const pts = sh.getSpacedPoints(48).map((p) => new THREE.Vector3(l.x, l.y - 0.026 + p.y, l.z + p.x))
          return sweep(new THREE.CatmullRomCurve3(pts, true), () => 0.0019, { radial: 8, segments: 60 })
        })
        pieces.push(m(g, mat, 'head'))
      }
      break
    }
    case 'starStuds':
    case 'crossDrops':
    case 'featherDrops':
    case 'pearlDrops': {
      for (const s of [1, -1]) {
        const g = cg(`${item.model}${s}`, () => {
          const l = LOBE(s)
          let d: THREE.BufferGeometry
          if (item.model === 'starStuds') {
            d = extrude(starShape(0.011, 0.45), 0.003)
            d.rotateY(Math.PI / 2)
            d.translate(l.x, l.y - 0.004, l.z)
          } else if (item.model === 'crossDrops') {
            const sh = new THREE.Shape()
            const w = 0.003
            sh.moveTo(-w, 0.012).lineTo(w, 0.012).lineTo(w, 0.004).lineTo(0.008, 0.004).lineTo(0.008, -0.002).lineTo(w, -0.002).lineTo(w, -0.02).lineTo(-w, -0.02).lineTo(-w, -0.002).lineTo(-0.008, -0.002).lineTo(-0.008, 0.004).lineTo(-w, 0.004).closePath()
            d = extrude(sh, 0.003)
            d.rotateY(Math.PI / 2)
            d.translate(l.x, l.y - 0.03, l.z)
            d = merge([d, chain(l, l.clone().add(new THREE.Vector3(0, -0.018, 0)))])
          } else if (item.model === 'featherDrops') {
            const parts: THREE.BufferGeometry[] = []
            for (let i = 0; i < 2; i++) {
              const f = ellipsoid(0.008, 0.03, 0.002, 12, 8)
              f.rotateZ(i ? 0.25 : -0.15)
              f.translate(l.x, l.y - 0.045 - i * 0.008, l.z + (i ? 0.008 : -0.004))
              parts.push(f)
            }
            parts.push(chain(l, l.clone().add(new THREE.Vector3(0, -0.015, 0))))
            d = merge(parts)
          } else {
            const p = ellipsoid(0.0075, 0.0085, 0.0075, 14, 10)
            p.translate(l.x, l.y - 0.02, l.z)
            d = merge([p, chain(l, l.clone().add(new THREE.Vector3(0, -0.012, 0)))])
          }
          return d
        })
        pieces.push(m(g, mat, 'head'))
      }
      break
    }
    case 'choker':
    case 'diamondChoker': {
      const g = cg(item.model, () => {
        const pts: THREE.Vector3[] = []
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2
          pts.push(new THREE.Vector3(Math.sin(a) * 0.0435, 1.345, Math.cos(a) * 0.041 - 0.001))
        }
        return sweep(new THREE.CatmullRomCurve3(pts, true), () => 0.006, { radial: 8, segments: 64, ellipse: [0.35, 1] })
      })
      pieces.push(m(g, mat, 'neck'))
      if (item.model === 'diamondChoker') {
        pieces.push(m(cg('diamonds', () => beadsOn((t) => new THREE.Vector3(Math.sin(t * Math.PI * 2) * 0.047, 1.345, Math.cos(t * Math.PI * 2) * 0.045 - 0.001), 36, 0.0042)), gem('#ffffff'), 'neck'))
      } else {
        pieces.push(m(cg('chokercharm', () => {
          const h = extrude(heartShape(0.008), 0.003)
          h.translate(0, 1.33, 0.047)
          return h
        }), metal('#e3b45a'), 'neck'))
      }
      break
    }
    case 'chainLock':
    case 'heartPendant':
    case 'pearls':
    case 'shells': {
      const curve = (t: number) => {
        const th = t * Math.PI * 2
        const front = Math.pow(Math.max(0, Math.cos(th)), 1.5)
        const y = 1.31 - 0.085 * front
        return torsoPoint(y, th, 0.011 + 0.004 * front, 0.9)
      }
      if (item.model === 'pearls') pieces.push(m(cg('pearlsN', () => beadsOn(curve, 56, 0.0055)), fabricMaterial({ fabric: 'pearl', color: c }), 'hips'))
      else if (item.model === 'shells') {
        pieces.push(m(cg('shellcord', () => cordOn(curve, 0.0012)), solid('#8a5a3c', { roughness: 0.7 }), 'hips'))
        pieces.push(m(cg('shellbeads', () => shellsOn(curve)), fabricMaterial({ fabric: 'pearl', color: c }), 'hips'))
      } else {
        pieces.push(m(cg('chainN', () => cordOn(curve, item.model === 'chainLock' ? 0.0022 : 0.0012)), item.model === 'chainLock' ? metal(c) : metal('#e3b45a'), 'hips'))
        const pend = cg(`pend|${item.model}`, () => {
          const p = curve(0)
          let g: THREE.BufferGeometry
          if (item.model === 'heartPendant') g = extrude(heartShape(0.016), 0.006, 0.003)
          else {
            const body = extrude(roundedRectShape(0.018, 0.016, 0.004), 0.006, 0.002)
            const shackle = torus(0.007, 0.0018, 16, 6, Math.PI)
            shackle.rotateX(Math.PI / 2)
            shackle.translate(0, 0.008, 0)
            g = merge([body, shackle])
          }
          g.translate(p.x, p.y - 0.015, p.z + 0.006)
          return g
        })
        pieces.push(m(pend, item.model === 'heartPendant' ? gem(c) : metal(c), 'hips'))
      }
      break
    }
    case 'bangles':
    case 'watch':
    case 'studCuff':
    case 'cuff': {
      // en la muñeca izquierda (el reloj de Clara va ahí)
      const seg = ARM_SEGS.L.fore
      const dir = new THREE.Vector3().subVectors(seg.to, seg.from).normalize()
      const at = (t: number) => seg.from.clone().addScaledVector(dir, t)
      if (item.model === 'bangles') {
        const cols = [c, '#c9a7ff', '#3de0c4', '#fff16a']
        cols.forEach((col, i) => {
          const g = cg(`bangle${i}`, () => {
            const t = torus(seg.r(0.2) + 0.006, 0.0028, 28, 8)
            t.translate(0, 0, 0)
            const p = at(0.185 + i * 0.008)
            t.translate(p.x + (i % 2) * 0.002, p.y, p.z)
            return t
          })
          pieces.push(m(g, fabricMaterial({ fabric: 'plastic', color: col }), 'elbowL'))
        })
      } else {
        const width = item.model === 'watch' ? 0.016 : item.model === 'cuff' ? 0.026 : 0.024
        const g = cg(`band|${item.model}`, () =>
          surface(
            32,
            3,
            (u, v, out) => {
              const a = u * Math.PI * 2
              const t = 0.19 - width / 2 + v * width
              const p = at(t)
              const r = seg.r(t) + 0.0035
              out.set(p.x + Math.cos(a) * r * seg.ellipse[0], p.y, p.z + Math.sin(a) * r * seg.ellipse[1])
            },
            { closedU: true, orient: 'auto' },
          ),
        )
        pieces.push(m(g, item.model === 'cuff' ? metal(c) : matFor(item, inst), 'elbowL'))
        if (item.model === 'watch') {
          const face = cg('watchface', () => {
            const f = extrude(roundedRectShape(0.024, 0.02, 0.005), 0.005, 0.002)
            f.rotateY(Math.PI / 2)
            const p = at(0.19)
            f.translate(p.x + seg.r(0.19) * seg.ellipse[0] + 0.006, p.y, p.z)
            return f
          })
          pieces.push(m(face, solid('#d9d9e0', { metalness: 1, roughness: 0.25 }), 'elbowL'))
          const screen = cg('watchscreen', () => {
            const f = new THREE.PlaneGeometry(0.017, 0.014)
            f.rotateY(Math.PI / 2)
            const p = at(0.19)
            f.translate(p.x + seg.r(0.19) * seg.ellipse[0] + 0.0092, p.y, p.z)
            return f
          })
          pieces.push(m(screen, watchScreen(), 'elbowL'))
        }
        if (item.model === 'studCuff') pieces.push(m(cg('cuffstuds', () => beadsOn((t) => {
          const a = t * Math.PI * 2
          const p = at(0.19)
          const r = seg.r(0.19) + 0.006
          return new THREE.Vector3(p.x + Math.cos(a) * r * seg.ellipse[0], p.y, p.z + Math.sin(a) * r * seg.ellipse[1])
        }, 10, 0.0035, true)), metal('#d8dbe6'), 'elbowL'))
      }
      break
    }
  }
  return { pieces, deformers: [] }
}

let watchMat: THREE.MeshBasicMaterial | null = null
function watchScreen() {
  if (watchMat) return watchMat
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const x = cv.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 64, 64)
  g.addColorStop(0, '#2b1240')
  g.addColorStop(1, '#ff5fae')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  x.fillStyle = '#fff'
  x.font = 'bold 20px sans-serif'
  x.textAlign = 'center'
  x.fillText('9:41', 32, 30)
  x.fillStyle = '#ffb3d9'
  x.beginPath()
  x.arc(32, 46, 6, 0, Math.PI * 2)
  x.fill()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  watchMat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
  return watchMat
}

function chain(a: THREE.Vector3, b: THREE.Vector3) {
  return sweep(new THREE.LineCurve3(a, b), () => 0.0008, { radial: 5, segments: 2 })
}

function beadsOn(f: (t: number) => THREE.Vector3, n: number, r: number, closed = true) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const t = closed ? i / n : i / (n - 1)
    const p = f(t)
    const b = ellipsoid(r, r, r, 10, 8)
    b.translate(p.x, p.y, p.z)
    parts.push(b)
  }
  return merge(parts)
}

function cordOn(f: (t: number) => THREE.Vector3, r: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 64; i++) pts.push(f(i / 64))
  return sweep(new THREE.CatmullRomCurve3(pts, true), () => r, { radial: 6, segments: 128 })
}

function shellsOn(f: (t: number) => THREE.Vector3) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = -3; i <= 3; i++) {
    const p = f(i * 0.035)
    const s = shellShape(0.012)
    s.rotateZ(Math.PI)
    s.translate(p.x, p.y - 0.008, p.z + 0.004)
    parts.push(s)
  }
  return merge(parts)
}

// ─────────────────────── GAFAS ───────────────────────

const EYE_Y = HC.y - 0.003
let eyeZ = 0
function frontZ() {
  if (!eyeZ) eyeZ = HC.z + faceZ(0.048, -0.003) + 0.03
  return eyeZ
}

function lensShape(model: string): THREE.Shape {
  switch (model) {
    case 'heartGlasses':
      return heartShape(0.026)
    case 'starGlasses':
      return starShape(0.03, 0.55)
    case 'catEye': {
      const s = new THREE.Shape()
      s.moveTo(-0.026, 0.004)
      s.quadraticCurveTo(-0.02, 0.02, 0.0, 0.014)
      s.quadraticCurveTo(0.024, 0.024, 0.032, 0.018)
      s.quadraticCurveTo(0.026, -0.018, 0.0, -0.016)
      s.quadraticCurveTo(-0.026, -0.016, -0.026, 0.004)
      return s
    }
    case 'round':
      return ellipseShape(0.019, 0.019)
    case 'rect':
      return roundedRectShape(0.042, 0.018, 0.004)
    case 'butterfly': {
      const s = new THREE.Shape()
      s.moveTo(-0.022, 0.012)
      s.quadraticCurveTo(0.0, 0.026, 0.03, 0.02)
      s.quadraticCurveTo(0.03, -0.004, 0.02, -0.016)
      s.quadraticCurveTo(0.0, -0.028, -0.018, -0.016)
      s.quadraticCurveTo(-0.028, -0.004, -0.022, 0.012)
      return s
    }
    case 'oval':
      return ellipseShape(0.024, 0.014)
    case 'aviator': {
      const s = new THREE.Shape()
      s.moveTo(-0.022, 0.014)
      s.quadraticCurveTo(0.0, 0.02, 0.024, 0.014)
      s.quadraticCurveTo(0.03, -0.012, 0.008, -0.024)
      s.quadraticCurveTo(-0.022, -0.026, -0.024, -0.004)
      s.closePath()
      return s
    }
    case 'big':
      return roundedRectShape(0.05, 0.04, 0.014)
    case 'gemGlasses':
      return ellipseShape(0.024, 0.02)
    default:
      return roundedRectShape(0.042, 0.022, 0.01)
  }
}

export function buildGlasses(item: ItemDef, inst: ItemInstance): Built {
  const pieces: Piece[] = []
  const frameM = item.fabric === 'metal' ? metal(inst.color) : item.fabric === 'gem' ? metal('#e8eaf4') : matFor(item, inst)
  const lensM = new THREE.MeshPhysicalMaterial({
    color: item.model === 'heartGlasses' || item.model === 'starGlasses' ? inst.color : '#3a2a40',
    transparent: true,
    opacity: 0.55,
    roughness: 0.05,
    metalness: 0.2,
    iridescence: item.fabric === 'holo' || item.model === 'shield' ? 1 : 0.4,
    clearcoat: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const z = frontZ()
  if (item.model === 'shield' || item.model === 'sport') {
    const g = cg(`shield|${item.model}`, () =>
      surface(
        36,
        6,
        (u, v, out) => {
          const a = (u - 0.5) * 2.2
          const h = (item.model === 'shield' ? 0.04 : 0.026) * (1 - 0.35 * Math.abs(u - 0.5) * 2)
          const r = HEAD.rx + 0.03
          out.set(Math.sin(a) * r, EYE_Y + 0.006 + (v - 0.5) * h, HC.z + Math.cos(a) * (z - HC.z))
        },
        { orient: 'auto' },
      ),
    )
    const lm = fabricMaterial({ fabric: 'holo', color: inst.color })
    pieces.push(m(g, item.model === 'shield' ? lm : lensM, 'head'))
    if (item.model === 'sport') pieces.push(m(cg('sportframe', () => templeArms(z, 0.003)), frameM, 'head'))
    return { pieces, deformers: [] }
  }
  const shape = lensShape(item.model)
  const frame = cg(`frame|${item.model}`, () => {
    const parts: THREE.BufferGeometry[] = []
    for (const s of [1, -1]) {
      const pts = shape.getSpacedPoints(64).map((p) => new THREE.Vector3(s * (0.048 + p.x * (s > 0 ? 1 : -1)), EYE_Y + p.y, z))
      parts.push(sweep(new THREE.CatmullRomCurve3(pts, true), () => (item.model === 'round' || item.model === 'aviator' ? 0.0018 : 0.0034), { radial: 8, segments: 96, ellipse: [1, 0.8] }))
    }
    // puente
    parts.push(sweep(curveOf([[-0.026, EYE_Y + 0.006, z], [0, EYE_Y + 0.011, z + 0.003], [0.026, EYE_Y + 0.006, z]]), () => 0.0022, { radial: 6, segments: 10 }))
    parts.push(templeArms(z, 0.0022))
    return merge(parts)
  })
  pieces.push(m(frame, frameM, 'head'))
  const lens = cg(`lens|${item.model}`, () => {
    const parts: THREE.BufferGeometry[] = []
    for (const s of [1, -1]) {
      const g = new THREE.ShapeGeometry(shape, 24)
      if (s < 0) g.scale(-1, 1, 1)
      g.translate(s * 0.048, EYE_Y, z - 0.001)
      parts.push(g)
    }
    return merge(parts)
  })
  pieces.push(m(lens, lensM, 'head'))
  if (item.model === 'gemGlasses') {
    pieces.push(m(cg('glassgems', () => {
      const parts: THREE.BufferGeometry[] = []
      for (const s of [1, -1]) {
        const pts = shape.getSpacedPoints(14)
        for (const p of pts.slice(0, 14)) {
          const b = ellipsoid(0.0028, 0.0028, 0.002, 8, 6)
          b.translate(s * (0.048 + p.x * s), EYE_Y + p.y, z + 0.003)
          parts.push(b)
        }
      }
      return merge(parts)
    }), gem('#ffffff'), 'head'))
  }
  return { pieces, deformers: [] }
}

function templeArms(z: number, r: number) {
  const parts: THREE.BufferGeometry[] = []
  for (const s of [1, -1]) {
    parts.push(
      sweep(
        curveOf([
          [s * 0.074, EYE_Y + 0.006, z - 0.004],
          [s * (HEAD.rx + 0.006), EYE_Y + 0.004, HC.z + 0.03],
          [s * (HEAD.rx + 0.008), EYE_Y - 0.004, HC.z - 0.03],
        ]),
        () => r,
        { radial: 6, segments: 16 },
      ),
    )
  }
  return merge(parts)
}

// ─────────────────────── GORROS ───────────────────────

const HAT_Y = HC.y + 0.034
const HAT_RX = HEAD.rx + 0.03
const HAT_RZ = HEAD.rz + 0.03

/** Sólido de revolución elíptico (corona + ala) a partir de un perfil (r, y). */
function hatLathe(profile: [number, number][], tiltX = -0.12, segments = 48, warp?: (a: number, r: number, y: number) => number): THREE.BufferGeometry {
  const prof = profile
  const g = surface(
    segments,
    prof.length - 1,
    (u, v, out) => {
      const a = u * Math.PI * 2
      const k = Math.round(v * (prof.length - 1))
      const [r, y] = prof[k]
      const yy = warp ? y + warp(a, r, y) : y
      out.set(Math.sin(a) * r * HAT_RX, yy, Math.cos(a) * r * HAT_RZ)
    },
    { closedU: true, orient: 'auto' },
  )
  g.rotateX(tiltX)
  g.translate(HC.x, HAT_Y, HC.z - 0.008)
  return g
}

function domeProfile(h: number, n = 10, r0 = 1): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2)
    out.push([Math.cos(a) * r0 + 0.0001, Math.sin(a) * h])
  }
  return out.reverse()
}

export function buildHat(item: ItemDef, inst: ItemInstance): Built & { hidesTop: boolean } {
  const pieces: Piece[] = []
  const mat = matFor(item, inst)
  const m2 = mat2For(item, inst)
  const key = item.model
  switch (item.model) {
    case 'bucket':
      pieces.push(m(cg(key, () => hatLathe([...domeProfile(0.175, 12, 1.0), [1.0, -0.01], [1.38, -0.045], [1.41, -0.05]])), mat, 'head'))
      break
    case 'beret':
      pieces.push(m(cg(key, () => {
        const g = ellipsoid(0.17, 0.05, 0.16, 32, 14)
        g.rotateZ(0.25)
        g.translate(HC.x + 0.02, HAT_Y + 0.105, HC.z - 0.015)
        return g
      }), mat, 'head'))
      pieces.push(m(cg('beretstem', () => {
        const g = new THREE.CylinderGeometry(0.004, 0.005, 0.014, 8)
        g.translate(HC.x + 0.04, HAT_Y + 0.16, HC.z - 0.015)
        return g
      }), mat, 'head'))
      break
    case 'cowboy':
      pieces.push(m(cg(key, () => hatLathe([...domeProfile(0.165, 10, 1.0).map(([r, y]) => [r * (1 - 0.1 * (y / 0.165)), y] as [number, number]), [1.0, -0.005], [1.3, 0.0], [1.62, 0.012], [1.66, 0.025]], -0.1, 64, (a, r) => (r > 1.15 ? 0.06 * Math.pow(Math.abs(Math.sin(a)), 2) * (r - 1.15) : 0))), mat, 'head'))
      pieces.push(m(cg('cowboyband', () => hatLathe([[1.005, 0.012], [0.99, 0.035]], -0.1)), metal('#e3b45a'), 'head'))
      break
    case 'beanie':
      pieces.push(m(cg(key, () => hatLathe([...domeProfile(0.18, 12, 1.0), [1.02, -0.035], [1.07, -0.035], [1.07, 0.01]], -0.2)), mat, 'head'))
      pieces.push(m(cg('pompom', () => {
        const g = ellipsoid(0.03, 0.03, 0.03, 12, 10)
        g.translate(HC.x, HAT_Y + 0.2, HC.z - 0.04)
        return g
      }), fabricMaterial({ fabric: 'fur', color: inst.color }), 'head'))
      break
    case 'cap':
      pieces.push(m(cg(key, () => hatLathe(domeProfile(0.17, 12, 1.0), -0.15)), mat, 'head'))
      pieces.push(m(cg('capvisor', () => {
        const g = surface(20, 6, (u, v, out) => {
          const a = (u - 0.5) * 2.0
          const r = 1 + v * 0.62
          out.set(Math.sin(a) * HAT_RX * r * 0.92, 0.0 - v * 0.012 + 0.006 * Math.cos(a * 1.5), Math.cos(a) * HAT_RZ * r)
        }, { orient: 'auto' })
        g.rotateX(-0.15)
        g.translate(HC.x, HAT_Y, HC.z - 0.008)
        return g
      }), mat, 'head'))
      break
    case 'sunhat':
      pieces.push(m(cg(key, () => hatLathe([...domeProfile(0.16, 10, 1.0), [1.0, -0.01], [1.5, -0.025], [2.1, -0.05], [2.14, -0.055]], -0.12, 72, (a, r) => (r > 1.4 ? 0.02 * Math.sin(a * 3) * (r - 1.4) : 0))), mat, 'head'))
      pieces.push(m(cg('sunband', () => hatLathe([[1.005, 0.0], [0.995, 0.03]], -0.12)), m2, 'head'))
      break
    case 'fedora':
      pieces.push(m(cg(key, () => hatLathe([...domeProfile(0.19, 10, 1.0), [1.0, -0.01], [1.45, -0.005], [1.5, 0.01]], -0.12, 48, (a, r, y) => (r < 0.6 && y > 0.12 ? -0.02 * Math.cos(a) ** 2 : 0))), mat, 'head'))
      pieces.push(m(cg('fedoraband', () => hatLathe([[1.005, 0.005], [0.995, 0.032]], -0.12)), solid('#1c1626', { roughness: 0.6 }), 'head'))
      break
    case 'furHat':
      pieces.push(m(cg(key, () => hatLathe([...domeProfile(0.2, 12, 1.12), [1.15, -0.035], [1.0, -0.04]], -0.15)), mat, 'head'))
      break
    case 'visor':
      pieces.push(m(cg(key, () => hatLathe([[0.99, 0.02], [0.97, 0.06]], -0.18)), mat, 'head'))
      pieces.push(m(cg('visorbrim', () => {
        const g = surface(20, 6, (u, v, out) => {
          const a = (u - 0.5) * 2.2
          const r = 1 + v * 0.7
          out.set(Math.sin(a) * HAT_RX * r * 0.95, 0.025 - v * 0.01, Math.cos(a) * HAT_RZ * r)
        }, { orient: 'auto' })
        g.rotateX(-0.18)
        g.translate(HC.x, HAT_Y, HC.z - 0.008)
        return g
      }), fabricMaterial({ fabric: 'holo', color: '#e6dcff' }), 'head'))
      break
    case 'crown':
      pieces.push(m(cg(key, () => crownGeo(0.045, 8)), metal(inst.color), 'head'))
      pieces.push(m(cg('crowngems', () => crownGems(0.045, 8)), gem('#ff2d8a'), 'head'))
      break
    case 'bandana':
    case 'headscarf':
      pieces.push(m(cg(key, () => {
        const parts: THREE.BufferGeometry[] = [
          surface(40, 20, (u, v, out) => {
            const b = (u - 0.5) * 2 * 1.3
            const a = 0.55 + v * 3.0
            scalp(a, b, 0.026, out)
          }, { orient: 'auto' }),
        ]
        // nudo atrás
        const k = scalp(3.4, 0, 0.03)
        const knot = ellipsoid(0.02, 0.016, 0.016, 12, 10)
        knot.translate(k.x, k.y, k.z)
        parts.push(knot)
        for (const s of [1, -1]) {
          parts.push(sweep(curveOf([[k.x, k.y, k.z], [k.x + s * 0.03, k.y - 0.05, k.z - 0.02], [k.x + s * 0.045, k.y - 0.11, k.z - 0.01]]), (t) => 0.012 * (1 - 0.6 * t), { radial: 8, segments: 12, ellipse: [1, 0.3] }))
        }
        return merge(parts)
      }), mat, 'head'))
      break
  }
  return { pieces, deformers: [], hidesTop: true }
}

function crownGeo(h: number, points: number) {
  return surface(
    points * 8,
    6,
    (u, v, out) => {
      const a = u * Math.PI * 2
      const spike = Math.pow(Math.abs(Math.cos((u * points * Math.PI))), 3)
      const y = v * (0.016 + h * spike)
      const r = 0.62 - v * 0.03
      out.set(Math.sin(a) * HAT_RX * r, y, Math.cos(a) * HAT_RZ * r)
    },
    { closedU: true, orient: 'auto' },
  ).rotateX(-0.25).translate(HC.x, HAT_Y + 0.085, HC.z - 0.025)
}

function crownGems(h: number, points: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    const g = ellipsoid(0.006, 0.006, 0.006, 10, 8)
    g.translate(Math.sin(a) * HAT_RX * 0.6, 0.016 + h, Math.cos(a) * HAT_RZ * 0.6)
    parts.push(g)
  }
  return merge(parts).rotateX(-0.25).translate(HC.x, HAT_Y + 0.085, HC.z - 0.025)
}

// ─────────────────── ACCESORIOS DEL PELO ───────────────────

export function buildHairAcc(item: ItemDef, inst: ItemInstance, ponyAnchor: { a: number; b: number } | null): Built {
  const pieces: Piece[] = []
  const mat = item.fabric === 'metal' ? metal(inst.color) : item.fabric === 'gem' ? gem(inst.color) : matFor(item, inst)
  const key = item.model
  const at = (a: number, b: number, off = 0.026) => scalp(a, b, off)
  const nrm = (a: number, b: number) => at(a, b, 0.05).sub(at(a, b, 0.0)).normalize()
  switch (item.model) {
    case 'butterflyClips':
    case 'starPins':
    case 'pearlPins':
    case 'safetyPins': {
      const spots: [number, number][] = item.model === 'safetyPins' ? [[0.8, 0.7], [0.95, 0.78], [1.1, 0.86]] : [[0.75, -0.5], [0.8, -0.85], [0.75, 0.5], [0.8, 0.85]]
      const g = cg(`${key}`, () => {
        const parts: THREE.BufferGeometry[] = []
        for (const [a, b] of spots) {
          let s: THREE.BufferGeometry
          if (item.model === 'butterflyClips') {
            const w: THREE.BufferGeometry[] = []
            for (const sd of [1, -1]) {
              const e = ellipsoid(0.011, 0.014, 0.002, 12, 8)
              e.rotateZ(sd * 0.5)
              e.translate(sd * 0.009, 0.004, 0)
              const e2 = ellipsoid(0.008, 0.009, 0.002, 12, 8)
              e2.rotateZ(-sd * 0.4)
              e2.translate(sd * 0.007, -0.01, 0)
              w.push(e, e2)
            }
            s = merge(w)
          } else if (item.model === 'starPins') s = extrude(starShape(0.012, 0.45), 0.003)
          else if (item.model === 'pearlPins') s = ellipsoid(0.007, 0.007, 0.007, 12, 8)
          else s = sweep(curveOf([[-0.018, 0, 0], [0.018, 0, 0], [0.02, 0.004, 0], [-0.016, 0.005, 0]]), () => 0.0012, { radial: 6, segments: 16 })
          const p = at(a, b, 0.02)
          s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm(a, b)))
          s.translate(p.x, p.y, p.z)
          parts.push(s)
        }
        return merge(parts)
      })
      pieces.push(m(g, item.model === 'pearlPins' ? fabricMaterial({ fabric: 'pearl', color: inst.color }) : mat, 'head'))
      break
    }
    case 'scrunchie':
    case 'claw':
    case 'bow': {
      const an = ponyAnchor ?? { a: 3.0, b: 0 }
      const p = at(an.a, an.b, 0.03)
      const d = nrm(an.a, an.b)
      const g = cg(`${key}|${an.a}|${an.b}`, () => {
        let s: THREE.BufferGeometry
        if (item.model === 'scrunchie') {
          s = surface(48, 10, (u, v, out) => {
            const a = u * Math.PI * 2
            const b = v * Math.PI * 2
            const R = 0.03
            const r = 0.012 + 0.003 * Math.sin(a * 12)
            out.set((R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a))
          }, { closedU: true })
        } else if (item.model === 'claw') {
          const parts: THREE.BufferGeometry[] = []
          for (let i = 0; i < 6; i++) {
            const x = -0.03 + i * 0.012
            parts.push(sweep(curveOf([[x, 0, 0.01], [x, 0.012, 0.0], [x, 0.0, -0.014]]), () => 0.004, { radial: 8, segments: 10, capEnd: true }))
          }
          s = merge(parts)
          s.rotateX(Math.PI / 2)
        } else {
          s = bowGeo(0.05)
          s.rotateX(Math.PI / 2)
        }
        s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d))
        s.translate(p.x, p.y, p.z)
        return s
      })
      pieces.push(m(g, mat, 'head'))
      break
    }
    case 'headband':
    case 'sweatband':
    case 'tiara':
    case 'pearlTiara':
    case 'fairyCrown':
    case 'flowerCrown': {
      const a0 = item.model === 'sweatband' ? 0.55 : 1.0
      const g = cg(`${key}`, () => {
        const pts: THREE.Vector3[] = []
        for (let i = 0; i <= 30; i++) {
          const b = -1.3 + (i / 30) * 2.6
          pts.push(at(item.model === 'sweatband' ? a0 + 0.12 * Math.abs(b) : a0 + 0.1 * Math.abs(b), b, item.model === 'sweatband' ? 0.02 : 0.024))
        }
        if (item.model === 'sweatband') {
          // cierra por detrás
          for (let i = 1; i < 20; i++) {
            const b = 1.3 + (i / 20) * (Math.PI * 2 - 2.6)
            const p = at(3.4, Math.sin(b) * 1.2, 0.022)
            pts.push(p)
          }
        }
        const curve = new THREE.CatmullRomCurve3(pts, item.model === 'sweatband', 'centripetal')
        const r = item.model === 'headband' ? 0.009 : item.model === 'sweatband' ? 0.011 : 0.0028
        const parts = [sweep(curve, () => r, { radial: 10, segments: 80, ellipse: item.model === 'headband' ? [1, 1.4] : [1, 1] })]
        if (item.model === 'tiara' || item.model === 'pearlTiara' || item.model === 'fairyCrown') {
          const n = item.model === 'fairyCrown' ? 9 : 7
          for (let i = 0; i < n; i++) {
            const t = 0.25 + (i / (n - 1)) * 0.5
            const p = curve.getPointAt(t)
            const h = (item.model === 'fairyCrown' ? 0.05 : 0.03) * (1 - Math.abs(t - 0.5) * 1.5)
            const s = item.model === 'pearlTiara' ? ellipsoid(0.007, 0.007, 0.007, 10, 8) : extrude(starShape(h * 0.45 + 0.004, 0.4, item.model === 'fairyCrown' ? 4 : 5), 0.003)
            s.translate(p.x, p.y + h * 0.6, p.z + 0.004)
            parts.push(s)
          }
        }
        if (item.model === 'flowerCrown') {
          for (let i = 0; i < 9; i++) {
            const t = i / 8
            const p = curve.getPointAt(t)
            parts.push(flower(p, p.clone().sub(HC).normalize(), 0.018))
          }
        }
        return merge(parts)
      })
      const mm = item.model === 'pearlTiara' ? fabricMaterial({ fabric: 'pearl', color: inst.color }) : mat
      pieces.push(m(g, mm, 'head'))
      break
    }
    case 'flower': {
      const g = cg('hairflower', () => flower(at(1.15, 0.95, 0.03), nrm(1.15, 0.95), 0.03))
      pieces.push(m(g, mat, 'head'))
      break
    }
  }
  return { pieces, deformers: [] }
}

function bowGeo(s: number) {
  const parts: THREE.BufferGeometry[] = []
  for (const side of [1, -1]) {
    const loop = surface(24, 8, (u, v, out) => {
      const a = u * Math.PI * 2
      const b = (v - 0.5) * 2
      const x = side * (0.5 + 0.5 * Math.cos(a)) * s
      const y = Math.sin(a) * s * 0.42 * (0.4 + 0.6 * Math.abs(x / s))
      out.set(x, y, b * s * 0.18)
    }, { closedU: true, orient: 'auto' })
    parts.push(loop)
    parts.push(sweep(curveOf([[0, 0, 0], [side * s * 0.25, -s * 0.5, 0], [side * s * 0.35, -s * 0.9, 0]]), () => s * 0.09, { radial: 8, segments: 10, ellipse: [1, 0.25] }))
  }
  const knot = ellipsoid(s * 0.16, s * 0.18, s * 0.14, 10, 8)
  parts.push(knot)
  return merge(parts)
}

export const smooth = smoothstep

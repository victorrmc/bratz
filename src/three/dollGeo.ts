import * as THREE from 'three'
import type { NailShape } from '../data/types'
import { J, armSegs, earGeometry, footGeometry, ankleGeometry, headGeometry, legSegs, limbGeometry, mirrorX, neckGeometry, torsoGeometry, FINGERS } from './body'
import { ellipsoid, merge, onDetailChange, sweep } from './geo'
import { nailGeometry } from './nails'
import { keyed, markDone } from './geoCache'

// Geometría del cuerpo de la muñeca: torso, extremidades, cabeza, manos y pies.
// Separada de DollRig para que el worker (dollGeo.worker.ts) pueda generarla sin
// cargar ropa, caras pintadas ni materiales. Cada pieza pasa por la caché por
// clave de geoCache.ts (memoria → IndexedDB → construir).

const footCache = new Map<number, { foot: THREE.BufferGeometry; ankle: THREE.BufferGeometry }>()
export function footFor(arch: number) {
  const k = Math.round(arch * 100) / 100
  let f = footCache.get(k)
  if (!f) {
    f = { foot: keyed(`pie|${k}`, () => footGeometry(k)), ankle: keyed(`tobillo|${k}`, () => ankleGeometry(k)) }
    footCache.set(k, f)
  }
  return f
}

function withSphere(g: THREE.BufferGeometry, c: THREE.Vector3, r: number) {
  const sph = ellipsoid(r, r, r, 20, 14)
  sph.translate(c.x, c.y, c.z)
  return merge([g, sph])
}

// Geometrías del cuerpo compartidas entre muñecas
let body: ReturnType<typeof buildBody> | null = null
export const bodyParts = () => (body ??= buildBody())
function buildBody() {
  const L = armSegs(1)
  const R = armSegs(-1)
  const LL = legSegs(1)
  const RL = legSegs(-1)
  return {
    torso: keyed('torso', torsoGeometry),
    neck: keyed('cuello', neckGeometry),
    upperL: keyed('brazo-L', () => limbGeometry(L.upper)),
    foreL: keyed('antebrazo-L', () => withSphere(limbGeometry(L.fore), J.elbowL, 0.0245)),
    upperR: keyed('brazo-R', () => limbGeometry(R.upper)),
    foreR: keyed('antebrazo-R', () => withSphere(limbGeometry(R.fore), mirrorX(J.elbowL), 0.0245)),
    thighL: keyed('muslo-L', () => limbGeometry(LL.thigh)),
    shinL: keyed('pierna-L', () => withSphere(limbGeometry(LL.shin), J.kneeL, 0.0375)),
    thighR: keyed('muslo-R', () => limbGeometry(RL.thigh)),
    shinR: keyed('pierna-R', () => withSphere(limbGeometry(RL.shin), mirrorX(J.kneeL), 0.0375)),
    ears: keyed('orejas', () => merge([earGeometry(1), earGeometry(-1)])),
  }
}

// Piezas sueltas de la mano: solo hacen falta para construir una mano que no esté en caché
let handKit: ReturnType<typeof buildHandKit> | null = null
function buildHandKit() {
  return {
    palm: (() => {
      const g = ellipsoid(0.0135, 0.034, 0.022, 24, 16)
      g.translate(0, -0.034, 0)
      return g
    })(),
    fingerSegs: FINGERS.map((f) => {
      const a = f.len * 0.55
      const b = f.len * 0.45
      return {
        prox: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.002, 0), new THREE.Vector3(0, -a, 0)), (t) => f.r * (1 - 0.06 * t), {
          radial: 12,
          segments: 4,
          capStart: true,
          capEnd: true,
          ellipse: [0.88, 1],
        }),
        dist: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.001, 0), new THREE.Vector3(0, -b, 0)), (t) => f.r * 0.94 * (1 - 0.12 * t), {
          radial: 12,
          segments: 4,
          capStart: true,
          capEnd: true,
          ellipse: [0.88, 1],
        }),
        a,
        b,
      }
    }),
    thumb: {
      prox: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.002, 0), new THREE.Vector3(0, -0.02, 0)), () => 0.0072, {
        radial: 12,
        segments: 4,
        capStart: true,
        capEnd: true,
      }),
      dist: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.001, 0), new THREE.Vector3(0, -0.017, 0)), (t) => 0.0066 * (1 - 0.1 * t), {
        radial: 12,
        segments: 4,
        capStart: true,
        capEnd: true,
      }),
    },

  }
}


const handCache = new Map<string, { skin: THREE.BufferGeometry; nails: THREE.BufferGeometry }>()
const headCache = new Map<number, THREE.BufferGeometry>()
onDetailChange(() => {
  handCache.clear()
  footCache.clear()
  headCache.clear()
  body = null
  handKit = null
})

/** Cabeza esculpida (depende del grosor de labios de cada muñeca). */
export function headFor(lipFullness: number): THREE.BufferGeometry {
  let g = headCache.get(lipFullness)
  if (!g) {
    g = keyed(`cabeza|${lipFullness}`, () => headGeometry({ lipFullness }))
    headCache.set(lipFullness, g)
  }
  return g
}

/** Construye la mano (coordenadas locales de la muñeca) con los dedos flexionados. */
export function handGeometry(side: 'L' | 'R', curlIn: number, shape: NailShape) {
  const curl = CURLS.reduce((a, b) => (Math.abs(b - curlIn) < Math.abs(a - curlIn) ? b : a))
  const key = `${side}|${curl}|${shape}`
  const hit = handCache.get(key)
  if (hit) return hit
  let built: { skin: THREE.BufferGeometry; nails: THREE.BufferGeometry } | null = null
  const make = () => (built ??= bakeHand(side, curl, shape))
  const res = { skin: keyed(`mano-piel|${key}`, () => make().skin), nails: keyed(`mano-unas|${key}`, () => make().nails) }
  handCache.set(key, res)
  return res
}

function bakeHand(side: 'L' | 'R', curl: number, shape: NailShape) {
  const S = (handKit ??= buildHandKit())
  const s = side === 'L' ? 1 : -1
  const root = new THREE.Group()
  const skinParts: [THREE.BufferGeometry, THREE.Object3D][] = []
  const nailParts: [THREE.BufferGeometry, THREE.Object3D][] = []
  const palm = new THREE.Object3D()
  root.add(palm)
  skinParts.push([S.palm, palm])
  FINGERS.forEach((f, i) => {
    const seg = S.fingerSegs[i]
    const c = curl * (1 + i * 0.18) + 0.08
    const knuckle = new THREE.Object3D()
    knuckle.position.set(0.0015 * s, -0.062, f.z)
    knuckle.rotation.set(0, 0, -s * c * 0.9)
    root.add(knuckle)
    skinParts.push([seg.prox, knuckle])
    const mid = new THREE.Object3D()
    mid.position.set(0, -seg.a, 0)
    mid.rotation.set(0, 0, -s * c * 1.1)
    knuckle.add(mid)
    skinParts.push([seg.dist, mid])
    const nail = new THREE.Object3D()
    nail.position.set(0, -seg.b * 0.35, 0)
    if (s < 0) nail.scale.x = -1
    mid.add(nail)
    nailParts.push([nailGeometry(shape), nail])
  })
  const tb = new THREE.Object3D()
  tb.position.set(-0.004 * s, -0.016, 0.017)
  tb.rotation.set(0.55, 0, -0.35 * s)
  root.add(tb)
  skinParts.push([S.thumb.prox, tb])
  const tm = new THREE.Object3D()
  tm.position.set(0, -0.02, 0)
  tm.rotation.set(0.2, 0, -0.15 * s)
  tb.add(tm)
  skinParts.push([S.thumb.dist, tm])
  const tn = new THREE.Object3D()
  tn.position.set(0, -0.006, 0)
  tn.rotation.y = s > 0 ? 0 : Math.PI
  tm.add(tn)
  nailParts.push([nailGeometry(shape, 0.0066), tn])
  root.updateMatrixWorld(true)
  const bake = (parts: [THREE.BufferGeometry, THREE.Object3D][]) =>
    merge(
      parts.map(([g, o]) => {
        const c = g.clone()
        c.applyMatrix4(o.matrixWorld)
        // las mallas reflejadas invierten el orden de los triángulos
        if (o.matrixWorld.determinant() < 0) {
          const idx = c.getIndex()
          if (idx) {
            const arr = idx.array as Uint16Array | Uint32Array
            for (let k = 0; k < arr.length; k += 3) {
              const t = arr[k + 1]
              arr[k + 1] = arr[k + 2]
              arr[k + 2] = t
            }
          }
          c.computeVertexNormals()
        }
        return c
      }),
    )
  return { skin: bake(skinParts), nails: bake(nailParts) }
}


/** Niveles de flexión de los dedos que se precalculan. */
export const CURLS = [0, 0.2, 0.35, 0.9]

/** Marca de «piezas base completas» para un conjunto de cabezas. */
export const baseKey = (lips: number[]) => `base|${lips.join(',')}`

/**
 * Genera todas las piezas base de una muñeca: cuerpo, cabezas pedidas, manos en
 * cada nivel de flexión (uñas almendra, las de serie) y pies descalzos.
 */
export function buildDollBase(lips: number[]) {
  bodyParts()
  for (const l of lips) headFor(l)
  for (const side of ['L', 'R'] as const) for (const c of CURLS) handGeometry(side, c, 'almendra')
  footFor(0)
  markDone(baseKey(lips))
}

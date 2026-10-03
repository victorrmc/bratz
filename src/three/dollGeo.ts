import * as THREE from 'three'
import type { NailShape } from '../data/types'
import { J, armSegs, earGeometry, footGeometry, ankleGeometry, headGeometry, legSegs, limbGeometry, mirrorX, neckGeometry, torsoGeometry, handParts, nailMatrix } from './body'
import { ellipsoid, merge, onDetailChange } from './geo'
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

const handCache = new Map<string, { skin: THREE.BufferGeometry; nails: THREE.BufferGeometry }>()
const headCache = new Map<number, THREE.BufferGeometry>()
onDetailChange(() => {
  handCache.clear()
  footCache.clear()
  headCache.clear()
  body = null
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

/** Refleja una geometría en x (mano derecha) invirtiendo el orden de los triángulos. */
function mirrorGeo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const c = g.clone()
  c.scale(-1, 1, 1)
  const idx = c.getIndex()
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array
    for (let k = 0; k < arr.length; k += 3) {
      const t = arr[k + 1]
      arr[k + 1] = arr[k + 2]
      arr[k + 2] = t
    }
  }
  return c
}

/** Mano esculpida (palma, nudillos, tres falanges y pulgar) con sus uñas. */
function bakeHand(side: 'L' | 'R', curl: number, shape: NailShape) {
  const parts = handParts(curl)
  const nails = merge(
    parts.nails.map((n) => {
      const g = nailGeometry(shape, n.r).clone()
      g.applyMatrix4(nailMatrix(n))
      return g
    }),
  )
  return side === 'L' ? { skin: parts.skin, nails } : { skin: mirrorGeo(parts.skin), nails: mirrorGeo(nails) }
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

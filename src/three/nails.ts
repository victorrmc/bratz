import * as THREE from 'three'
import type { NailLook, NailShape } from '../data/types'
import { merge, onDetailChange, orientOutward, smoothstep, surface } from './geo'
import { patternTexture } from './textures'

// Uñas: lámina curvada sobre la falange distal con forma configurable.

const LEN: Record<NailShape, number> = {
  redonda: 0.0085,
  almendra: 0.0115,
  cuadrada: 0.0105,
  stiletto: 0.0155,
  bailarina: 0.0135,
}

/** Semiancho de la uña en función de t (0 = cutícula, 1 = punta). */
function widthAt(shape: NailShape, t: number): number {
  const w = 0.0046
  switch (shape) {
    case 'redonda':
      return w * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.55) / 0.45, 2)))
    case 'almendra':
      return w * (t < 0.45 ? 1 : Math.max(0, Math.cos(((t - 0.45) / 0.55) * Math.PI * 0.5)) ** 0.8)
    case 'cuadrada':
      return w * (t < 0.92 ? 1 : 1 - (t - 0.92) * 4)
    case 'stiletto':
      return w * (t < 0.3 ? 1 : Math.max(0.02, 1 - (t - 0.3) / 0.7))
    case 'bailarina':
      return w * (t < 0.4 ? 1 : Math.max(0.42, 1 - (t - 0.4) * 1.0)) * (t > 0.97 ? Math.max(0, 1 - (t - 0.97) * 30) : 1)
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>()
onDetailChange(() => geoCache.clear())

/** Uña en coordenadas locales de la falange: eje −y hacia la punta, dorso hacia +x. */
export function nailGeometry(shape: NailShape, fingerR = 0.0058): THREE.BufferGeometry {
  const key = `${shape}|${fingerR}`
  const hit = geoCache.get(key)
  if (hit) return hit
  const len = LEN[shape]
  const r = fingerR + 0.0007
  // grosor de la lámina: fino en la cutícula y algo más en el borde libre
  const thick = (t: number) => 0.00022 + 0.00028 * smoothstep(0.35, 1, t)
  const point = (u: number, t: number, inner: number, out: THREE.Vector3) => {
    const half = widthAt(shape, t)
    const across = (u - 0.5) * 2 * half
    const rr = r - inner
    const a = across / r
    // arco transversal (curva en C) algo más marcado que el dedo y la punta ligeramente caída
    const c = 0.00035 * (1 - (across / Math.max(half, 1e-5)) ** 2)
    const y = -t * len
    out.set(Math.cos(a) * rr + c - 0.0006 * t * t, y, Math.sin(a) * rr)
    return out
  }
  const top = surface(12, 16, (u, v, out) => point(u, v, 0, out), { uvMode: 'param', orient: 'auto', fixed: true })
  // cara inferior y canto: dan volumen a la punta que sobresale del dedo
  const bottom = surface(12, 16, (u, v, out) => point(u, v, thick(v), out), { uvMode: 'param', fixed: true, flip: true })
  const edge = surface(
    48,
    1,
    (u, v, out) => {
      // contorno: lado izquierdo (t 0→1), punta y lado derecho (t 1→0)
      const k = u * 2
      const t = k <= 1 ? k : 2 - k
      const side = k <= 1 ? 0 : 1
      return point(side, t, v * thick(t), out)
    },
    { uvMode: 'param', fixed: true },
  )
  orientOutward(edge, new THREE.Vector3(r * 0.7, -len * 0.5, 0))
  edge.computeVertexNormals()
  const g = merge([top, bottom, edge])
  geoCache.set(key, g)
  return g
}

const matCache = new Map<string, THREE.MeshPhysicalMaterial>()
export function nailMaterial(n: NailLook): THREE.MeshPhysicalMaterial {
  const key = `${n.color}|${n.finish}`
  const hit = matCache.get(key)
  if (hit) return hit
  const m = new THREE.MeshPhysicalMaterial({ color: n.color, side: THREE.DoubleSide })
  switch (n.finish) {
    case 'brillo':
      m.roughness = 0.14
      m.clearcoat = 1
      m.clearcoatRoughness = 0.02
      m.envMapIntensity = 1.6
      break
    case 'mate':
      m.roughness = 0.7
      break
    case 'cromo':
      m.metalness = 1
      m.roughness = 0.08
      m.envMapIntensity = 2
      break
    case 'purpurina':
      m.map = patternTexture('purpurina', n.color)
      m.color.set('#ffffff')
      m.metalness = 0.6
      m.roughness = 0.25
      m.clearcoat = 1
      break
  }
  matCache.set(key, m)
  return m
}

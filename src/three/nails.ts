import * as THREE from 'three'
import type { NailLook, NailShape } from '../data/types'
import { onDetailChange, surface } from './geo'
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
  const g = surface(
    10,
    14,
    (u, v, out) => {
      const t = v
      const half = widthAt(shape, t)
      const across = (u - 0.5) * 2 * half
      const a = across / r
      // la punta se curva ligeramente hacia abajo y sobresale del dedo
      const y = -t * len
      const lift = 0.0012 * t * t
      out.set(Math.cos(a) * r + lift * 0.2 - 0.0006 * t * t, y, Math.sin(a) * r)
    },
    { uvMode: 'param', orient: 'auto' },
  )
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
      m.roughness = 0.12
      m.clearcoat = 1
      m.clearcoatRoughness = 0.02
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

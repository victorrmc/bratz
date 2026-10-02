import * as THREE from 'three'
import type { Fabric, PatternId } from '../data/types'
import { bumpTexture, patternTexture } from './textures'

// Fábrica de materiales con caché: telas, charol, holográficos, joyas…

const cache = new Map<string, THREE.MeshPhysicalMaterial>()

export type QualityLevel = 'baja' | 'media' | 'alta'
let quality: QualityLevel = 'alta'
export function setMaterialQuality(q: QualityLevel) {
  if (q !== quality) {
    quality = q
    for (const m of cache.values()) m.dispose()
    cache.clear()
  }
}
export const getMaterialQuality = () => quality

export interface MatSpec {
  fabric: Fabric
  color: string
  color2?: string
  pattern?: PatternId
}

export function fabricMaterial(spec: MatSpec): THREE.MeshPhysicalMaterial {
  const pattern = spec.pattern ?? 'liso'
  const key = `${spec.fabric}|${pattern}|${spec.color}|${spec.color2 ?? ''}|${quality}`
  const hit = cache.get(key)
  if (hit) return hit
  const m = build(spec, pattern)
  cache.set(key, m)
  return m
}

function build(spec: MatSpec, pattern: PatternId): THREE.MeshPhysicalMaterial {
  const hi = quality !== 'baja'
  const c2 = spec.color2 ?? '#ffffff'
  const usesMap = pattern !== 'liso' || ['denim', 'knit', 'cotton'].includes(spec.fabric)
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', side: THREE.DoubleSide })
  if (usesMap) m.map = patternTexture(pattern, spec.color, c2)
  else m.color.set(spec.color)
  m.envMapIntensity = 1
  switch (spec.fabric) {
    case 'cotton':
      m.roughness = 0.82
      m.sheen = hi ? 0.6 : 0
      m.sheenRoughness = 0.55
      m.sheenColor.set('#ffffff')
      break
    case 'knit':
      m.roughness = 0.95
      m.sheen = hi ? 1 : 0
      m.sheenRoughness = 0.7
      m.sheenColor.set(spec.color).lerp(new THREE.Color('#ffffff'), 0.5)
      if (hi) {
        m.bumpMap = bumpTexture('rayas')
        m.bumpScale = 0.6
      }
      break
    case 'satin':
      m.roughness = 0.32
      m.sheen = hi ? 1 : 0
      m.sheenRoughness = 0.25
      m.sheenColor.set(spec.color).lerp(new THREE.Color('#ffffff'), 0.65)
      m.clearcoat = hi ? 0.25 : 0
      m.clearcoatRoughness = 0.35
      break
    case 'denim':
      m.roughness = 0.9
      m.sheen = hi ? 0.4 : 0
      m.sheenColor.set('#d8e4ff')
      if (hi) {
        m.bumpMap = bumpTexture('denim')
        m.bumpScale = 0.8
      }
      break
    case 'vinyl':
      m.roughness = 0.12
      m.clearcoat = 1
      m.clearcoatRoughness = 0.04
      m.envMapIntensity = 1.4
      break
    case 'leather':
      m.roughness = 0.42
      m.clearcoat = hi ? 0.5 : 0
      m.clearcoatRoughness = 0.3
      break
    case 'holo':
      m.roughness = 0.18
      m.metalness = 0.55
      m.iridescence = 1
      m.iridescenceIOR = 1.9
      m.iridescenceThicknessRange = [180, 820]
      m.clearcoat = 0.8
      m.envMapIntensity = 1.6
      break
    case 'sequin':
      m.roughness = 0.22
      m.metalness = 0.75
      m.envMapIntensity = 1.8
      if (!m.map) m.map = patternTexture('lentejuelas', spec.color, c2)
      if (hi) {
        m.bumpMap = bumpTexture('lentejuelas')
        m.bumpScale = 2.2
        m.iridescence = 0.35
      }
      break
    case 'mesh':
      m.map = patternTexture(pattern === 'liso' ? 'rejilla' : pattern, spec.color, c2)
      m.alphaTest = 0.4
      m.transparent = false
      m.side = THREE.DoubleSide
      m.roughness = 0.6
      m.sheen = 0.5
      break
    case 'metal':
      m.roughness = 0.16
      m.metalness = 1
      m.envMapIntensity = 1.6
      break
    case 'gem':
      m.roughness = 0.04
      m.metalness = 0.2
      m.clearcoat = 1
      m.iridescence = hi ? 0.7 : 0
      m.iridescenceIOR = 2.0
      m.envMapIntensity = 2.6
      m.emissive.set(spec.color).multiplyScalar(0.08)
      break
    case 'plastic':
      m.roughness = 0.3
      m.clearcoat = 0.7
      m.clearcoatRoughness = 0.15
      break
    case 'fur':
      m.roughness = 1
      m.sheen = 1
      m.sheenRoughness = 0.9
      m.sheenColor.set('#ffffff')
      if (hi) {
        m.bumpMap = bumpTexture('purpurina')
        m.bumpScale = 3
      }
      break
    case 'pearl':
      m.roughness = 0.22
      m.iridescence = hi ? 0.6 : 0
      m.iridescenceIOR = 1.5
      m.sheen = 0.6
      m.sheenColor.set('#ffe6f4')
      m.clearcoat = 0.8
      break
    case 'scales':
      m.map = patternTexture('escamas', spec.color, c2)
      m.roughness = 0.2
      m.metalness = 0.45
      m.iridescence = hi ? 0.9 : 0
      m.iridescenceIOR = 1.7
      m.clearcoat = 0.6
      if (hi) {
        m.bumpMap = bumpTexture('escamas')
        m.bumpScale = 1.5
      }
      break
    case 'petal':
      m.roughness = 0.55
      m.sheen = 1
      m.sheenRoughness = 0.4
      m.sheenColor.set(c2)
      m.side = THREE.DoubleSide
      m.iridescence = hi ? 0.3 : 0
      break
  }
  if (pattern === 'purpurina' || pattern === 'lentejuelas') {
    m.metalness = Math.max(m.metalness, 0.6)
    m.roughness = Math.min(m.roughness, 0.3)
  }
  if (pattern === 'saten') {
    m.roughness = Math.min(m.roughness, 0.35)
    m.sheen = 1
  }
  return m
}

/** Material simple de color (detalles: suelas, hebillas…). */
export function solid(color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  const key = `solid|${color}|${JSON.stringify(opts)}|${quality}`
  const hit = cache.get(key)
  if (hit) return hit
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, ...opts })
  cache.set(key, m)
  return m
}

export function skinMaterial(color: string): THREE.MeshPhysicalMaterial {
  const key = `skin|${color}|${quality}`
  const hit = cache.get(key)
  if (hit) return hit
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.52,
    clearcoat: quality === 'baja' ? 0 : 0.12,
    clearcoatRoughness: 0.45,
    sheen: quality === 'baja' ? 0 : 0.35,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffd9d2'),
  })
  cache.set(key, m)
  return m
}

// Lógica pura del sonido (sin Web Audio): qué pista suena en cada pantalla,
// qué efecto lleva cada prenda y cómo sube la intensidad de la pasarela.

import type { ItemDef } from '../data/types'

export type Track = 'menu' | 'runway' | 'ending' | 'ibiza' | 'disco' | 'casa'
export type Sfx = 'click' | 'sparkle' | 'coin' | 'shutter' | 'fanfare' | 'whoosh' | 'error' | 'fabric' | 'zipper' | 'heel' | 'step' | 'jewel' | 'clasp' | 'applause'
export type Footwear = 'tacon' | 'bota' | 'plano' | 'descalza'

/** Pantallas cuya música depende del escenario elegido. */
const STAGED_SCREENS = new Set(['photo', 'challenge', 'jury'])

/** Pista por escenario: balear chill en Ibiza, house en la discoteca y guitarra en casa. */
export function trackForStage(stage: string): Track {
  if (stage === 'ibiza' || stage === 'beach') return 'ibiza'
  if (stage === 'disco') return 'disco'
  if (stage === 'casa') return 'casa'
  return 'menu'
}

export function trackFor(screen: string, stage: string): Track {
  if (screen === 'runway') return 'runway'
  if (screen === 'ending' || screen === 'letter') return 'ending'
  if (STAGED_SCREENS.has(screen)) return trackForStage(stage)
  return 'menu'
}

const ZIP_MODELS = new Set(['jacket', 'dress', 'jumpsuit', 'boots', 'kneeboots', 'backpack', 'fanny'])
const HEEL_MODELS = new Set(['heels', 'platform', 'kneeboots', 'wedge'])
const FLAT_MODELS = new Set(['sneakers', 'ballet', 'sandals', 'flipflops'])

/** Efecto (además del destello) que suena al ponerse una prenda. */
export function sfxForItem(item: Pick<ItemDef, 'category' | 'model'>): Sfx {
  switch (item.category) {
    case 'shoes':
      if (ZIP_MODELS.has(item.model)) return 'zipper'
      return HEEL_MODELS.has(item.model) ? 'heel' : 'step'
    case 'jewelry':
    case 'glasses':
    case 'hairAcc':
      return 'jewel'
    case 'bags':
      return ZIP_MODELS.has(item.model) ? 'zipper' : 'clasp'
    default:
      return ZIP_MODELS.has(item.model) ? 'zipper' : 'fabric'
  }
}

export function footwearFor(model: string | undefined): Footwear {
  if (!model) return 'descalza'
  if (HEEL_MODELS.has(model)) return 'tacon'
  if (FLAT_MODELS.has(model)) return 'plano'
  return 'bota'
}

// Tiempos del desfile (deben coincidir con src/three/scenes/Runway.tsx y DollRig).
export const RUNWAY = {
  walk: (0.9 - -4.6) / 0.62,
  pose: 3.2,
  turn: 0.6,
  /** Pasos por segundo del ciclo de paseo (0,95 ciclos/s, dos pasos por ciclo). */
  stepsPerSecond: 1.9,
}

export interface RunwayCue {
  phase: 'walk' | 'pose' | 'back'
  /** 0 = intro suave … 3 = clímax. */
  intensity: number
  walking: boolean
}

/** Estado de la música adaptativa a los t segundos de empezar el desfile. */
export function runwayCue(t: number): RunwayCue {
  const { walk, pose, turn } = RUNWAY
  if (t < walk) {
    // primera ida: la música crece de la intro a la base completa
    return { phase: 'walk', intensity: 0.6 + (t / walk) * 1.6, walking: true }
  }
  if (t < walk + pose) return { phase: 'pose', intensity: 3, walking: false }
  const loop = walk + pose + turn + walk
  const u = (t - walk - pose) % loop
  if (u < turn + walk) return { phase: 'back', intensity: 2.4, walking: u >= turn }
  if (u < turn + walk + walk) return { phase: 'walk', intensity: 2.4, walking: true }
  return { phase: 'pose', intensity: 3, walking: false }
}

/** Patrones de vibración (ms) que imitan el ritmo de cada efecto. */
export const HAPTICS: Record<Sfx, number[]> = {
  click: [8],
  sparkle: [6, 30, 6, 30, 6],
  coin: [10, 70, 24],
  shutter: [14, 55, 24],
  fanfare: [18, 90, 18, 90, 18, 90, 60],
  whoosh: [16],
  error: [40, 80, 60],
  fabric: [5, 25, 7, 25, 5],
  zipper: [4, 14, 4, 14, 4, 14, 4, 14, 4, 14, 4],
  heel: [22],
  step: [10],
  jewel: [4, 45, 4],
  clasp: [12, 40, 8],
  applause: [10, 50, 8, 40, 12, 60, 8, 45, 10, 70, 8, 90, 6],
}

export function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback
}

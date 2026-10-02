import { ACCESSORY_SLOTS } from '../data/items'
import { JURY_LINES } from '../data/challenges'
import type { ChallengeDef, Look, Slot, StyleTag } from '../data/types'
import { colorDistance, hexToHsl, hueDistance, isNeutral } from './color'
import { wornItems } from './look'

export interface ScoreBreakdown {
  style: number
  color: number
  accessories: number
  completeness: number
  total: number
  stars: number
  missingRequired: Slot[]
  tips: string[]
}

export const WEIGHTS = { style: 0.4, color: 0.25, accessories: 0.2, completeness: 0.15 }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const TAG_NAMES: Record<StyleTag, string> = {
  glam: 'glam',
  street: 'street',
  rock: 'rockero',
  boho: 'boho',
  fiesta: 'de fiesta',
  playa: 'playero',
  invierno: 'de invierno',
  romantico: 'romántico',
  deportivo: 'deportivo',
  y2k: 'Y2K',
  elegante: 'elegante',
  magico: 'mágico',
  ibiza: 'ibicenco',
}

export function tagLabel(t: StyleTag): string {
  return TAG_NAMES[t]
}

/** Puntuación de estilo: proporción de prendas con las etiquetas pedidas. */
export function styleScore(look: Look, ch: ChallengeDef): number {
  const worn = wornItems(look)
  if (worn.length === 0) return 0
  let hits = 0
  let extra = 0
  let banned = 0
  for (const { def } of worn) {
    const n = def.tags.filter((t) => ch.wantedTags.includes(t)).length
    if (n > 0) hits++
    if (n > 1) extra += n - 1
    if (ch.bannedTags && def.tags.some((t) => ch.bannedTags!.includes(t))) banned++
  }
  return clamp01(hits / worn.length + Math.min(0.2, extra * 0.05) - banned * 0.2)
}

/** Colores del look (color principal de cada prenda). */
export function lookColors(look: Look): string[] {
  return wornItems(look).map((w) => w.inst.color)
}

export function harmonyScore(colors: string[], mode: NonNullable<ChallengeDef['harmony']>): number {
  const chroma = colors.filter((c) => !isNeutral(c)).map((c) => hexToHsl(c).h)
  if (colors.length === 0) return 0
  if (mode === 'monocromo') {
    if (chroma.length <= 1) return 1
    let spread = 0
    for (const a of chroma) for (const b of chroma) spread = Math.max(spread, hueDistance(a, b))
    return clamp01(1 - Math.max(0, spread - 25) / 80)
  }
  if (chroma.length <= 1) return 0.9
  let maxD = 0
  for (const a of chroma) for (const b of chroma) maxD = Math.max(maxD, hueDistance(a, b))
  if (mode === 'analogo') return clamp01(1 - Math.max(0, maxD - 60) / 90)
  if (mode === 'complementario') {
    // Al menos un par opuesto (150-180º) y el resto agrupado.
    return maxD >= 140 ? 1 : clamp01(0.4 + maxD / 240)
  }
  // libre: castiga más de 3 familias de tono distintas
  const families: number[] = []
  for (const h of chroma) if (!families.some((f) => hueDistance(f, h) < 35)) families.push(h)
  return families.length <= 3 ? 1 : clamp01(1 - (families.length - 3) * 0.25)
}

export function paletteScore(colors: string[], palette: string[]): number {
  if (colors.length === 0) return 0
  let sum = 0
  for (const c of colors) {
    const d = Math.min(...palette.map((p) => colorDistance(c, p)))
    sum += clamp01(1 - Math.max(0, d - 0.08) / 0.32)
  }
  return sum / colors.length
}

export function colorScore(look: Look, ch: ChallengeDef): number {
  const colors = lookColors(look)
  if (ch.palette && ch.palette.length) return paletteScore(colors, ch.palette)
  return harmonyScore(colors, ch.harmony ?? 'libre')
}

export function accessoryCount(look: Look): number {
  return ACCESSORY_SLOTS.filter((s) => look.outfit[s]).length
}

export function accessoryScore(look: Look, ch: ChallengeDef): number {
  const n = accessoryCount(look)
  if (n < ch.minAccessories) return ch.minAccessories === 0 ? 1 : n / ch.minAccessories
  if (n > ch.minAccessories + 3) return 0.7
  return 1
}

export function completenessScore(look: Look): number {
  const o = look.outfit
  let s = 0
  if (o.dress || (o.top && o.bottom)) s += 0.65
  else if (o.top || o.bottom) s += 0.25
  if (o.shoes) s += 0.35
  return clamp01(s)
}

export function starsFor(total: number): number {
  if (total >= 0.85) return 5
  if (total >= 0.7) return 4
  if (total >= 0.52) return 3
  if (total >= 0.35) return 2
  return 1
}

export function scoreLook(look: Look, ch: ChallengeDef): ScoreBreakdown {
  const style = styleScore(look, ch)
  const color = colorScore(look, ch)
  const accessories = accessoryScore(look, ch)
  const completeness = completenessScore(look)
  const missingRequired = (ch.required ?? []).filter((s) => !look.outfit[s])
  let total =
    style * WEIGHTS.style + color * WEIGHTS.color + accessories * WEIGHTS.accessories + completeness * WEIGHTS.completeness
  let stars = starsFor(total)
  if (missingRequired.length) {
    total *= 0.8
    stars = Math.min(stars, 2)
  }
  const tips: string[] = []
  if (style < 0.6) tips.push(`Busca más prendas con estilo ${ch.wantedTags.map(tagLabel).join(' o ')}.`)
  if (color < 0.6) tips.push(ch.palette ? 'Prueba con los colores de la paleta del reto.' : 'Los colores se pelean un poco entre sí.')
  if (accessories < 1) {
    tips.push(accessoryCount(look) < ch.minAccessories ? `¡Faltan accesorios! Mínimo ${ch.minAccessories}.` : 'Demasiados accesorios: menos es más.')
  }
  if (completeness < 1) tips.push('El look está incompleto: revisa ropa y calzado.')
  if (missingRequired.length) tips.push('Te falta algo obligatorio para este reto.')
  return { style, color, accessories, completeness, total, stars, missingRequired, tips }
}

/** Comentarios divertidos del jurado (3 jueces), deterministas según semilla. */
export function juryComments(stars: number, seed: number): string[] {
  const lines = JURY_LINES[Math.max(1, Math.min(5, stars))]
  return [0, 1, 2].map((i) => lines[(seed + i) % lines.length])
}

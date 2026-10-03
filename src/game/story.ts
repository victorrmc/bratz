import { CHAPTERS, CHAPTER_BY_ID, type ChapterDef } from '../data/chapters'
import { ITEM_BY_ID } from '../data/items'
import type { Look } from '../data/types'
import { equip, wornItems } from './look'
import { scoreLook, tagLabel, type ScoreBreakdown } from './scoring'
import type { SaveData, StoryProgress } from './save'

// Lógica pura del modo historia: desbloqueo secuencial, look obligatorio,
// puntuación (la de los retos) y progreso guardado.

export interface Requirement {
  label: string
  ok: boolean
}

export interface ChapterScore {
  score: ScoreBreakdown
  requirements: Requirement[]
  passed: boolean
}

export const chapterIndex = (id: string): number => CHAPTERS.findIndex((c) => c.id === id)

export function isChapterDone(progress: StoryProgress, id: string): boolean {
  return progress.chapters[id] !== undefined
}

/** Un capítulo se abre cuando el anterior está superado (el primero, siempre). */
export function isChapterUnlocked(progress: StoryProgress, id: string): boolean {
  const i = chapterIndex(id)
  if (i < 0) return false
  return i === 0 || isChapterDone(progress, CHAPTERS[i - 1].id)
}

export function completedChapters(progress: StoryProgress): number {
  return CHAPTERS.filter((c) => isChapterDone(progress, c.id)).length
}

export function isStoryComplete(progress: StoryProgress): boolean {
  return completedChapters(progress) === CHAPTERS.length
}

/** Texto de progreso para la portada, por ejemplo «2/5». */
export function progressLabel(progress: StoryProgress): string {
  return `${completedChapters(progress)}/${CHAPTERS.length}`
}

/** Primer capítulo abierto y sin superar, o null si la historia está completa. */
export function nextChapter(progress: StoryProgress): ChapterDef | null {
  return CHAPTERS.find((c) => !isChapterDone(progress, c.id) && isChapterUnlocked(progress, c.id)) ?? null
}

export function isLastChapter(id: string): boolean {
  return chapterIndex(id) === CHAPTERS.length - 1
}

/** Estado de cada condición del look obligatorio. */
export function requirementStatus(look: Look, ch: ChapterDef): Requirement[] {
  const slotNames: Record<string, string> = {
    bag: 'Bolso',
    shoes: 'Calzado',
    glasses: 'Gafas',
    hat: 'Sombrero o gorro',
    hairAcc: 'Adorno del pelo',
    earrings: 'Pendientes',
    necklace: 'Collar',
    bracelet: 'Pulsera',
    jacket: 'Chaqueta',
    top: 'Top',
    bottom: 'Parte de abajo',
    dress: 'Vestido',
  }
  const out: Requirement[] = ch.mustWear.slots.map((s) => ({ label: slotNames[s] ?? s, ok: Boolean(look.outfit[s]) }))
  if (ch.mustWear.tag) {
    const need = ch.mustWear.count ?? 1
    const have = wornItems(look).filter((w) => w.def.tags.includes(ch.mustWear.tag!)).length
    out.push({ label: `${need} prenda${need === 1 ? '' : 's'} de estilo ${tagLabel(ch.mustWear.tag)}`, ok: have >= need })
  }
  return out
}

/**
 * Puntúa el look con el sistema de los retos. Si falta algo del look obligatorio
 * se aplica la misma penalización que a un reto con huecos obligatorios vacíos.
 */
export function scoreChapter(look: Look, ch: ChapterDef): ChapterScore {
  const score = scoreLook(look, ch.challenge)
  const requirements = requirementStatus(look, ch)
  const missing = requirements.some((r) => !r.ok)
  if (missing && score.missingRequired.length === 0) {
    score.total *= 0.8
    score.stars = Math.min(score.stars, 2)
    score.tips.push(`Falta el look obligatorio: ${ch.mustWear.label.toLowerCase()}.`)
  }
  return { score, requirements, passed: !missing && score.stars >= ch.minStars }
}

/** Guarda el capítulo superado conservando la mejor nota y la primera fecha. */
export function recordChapter(progress: StoryProgress, id: string, stars: number, now: number): StoryProgress {
  if (!CHAPTER_BY_ID[id]) return progress
  const prev = progress.chapters[id]
  const s = Math.max(1, Math.min(5, Math.round(stars)))
  return {
    chapters: {
      ...progress.chapters,
      [id]: { stars: Math.max(prev?.stars ?? 0, s), completedAt: prev?.completedAt ?? now },
    },
  }
}

/** Aplica el resultado de un intento a la partida (solo cuenta si se supera). */
export function applyChapterResult(save: SaveData, id: string, result: ChapterScore, now: number): SaveData {
  if (!result.passed) return save
  const story = recordChapter(save.story, id, result.score.stars, now)
  // al terminar la historia se abre el final (el de siempre, no se duplica)
  const endingUnlocked = save.endingUnlocked || isStoryComplete(story)
  return { ...save, story, endingUnlocked }
}

/** Look de ejemplo del capítulo sobre el look actual (para el botón de ayuda). */
export function suggestedLook(base: Look, ch: ChapterDef): Look {
  let look = base
  for (const id of ch.suggestion) {
    const item = ITEM_BY_ID[id]
    if (item) look = equip(look, item)
  }
  return look
}

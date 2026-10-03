import type { Look } from '../data/types'

// Guardado en localStorage con versión y migraciones.

export const SAVE_KEY = 'clara-ibiza-save'
export const SAVE_VERSION = 4

export type Quality = 'auto' | 'baja' | 'media' | 'alta'

export interface SavedLook {
  id: string
  name: string
  look: Look
  thumb?: string
  createdAt: number
}

/** Progreso del modo historia: capítulos superados con su mejor nota. */
export interface StoryProgress {
  chapters: Record<string, { stars: number; completedAt: number }>
}

export interface SaveData {
  version: number
  coins: number
  /** Prendas compradas o desbloqueadas (las comunes no se guardan). */
  owned: string[]
  /** Mejor puntuación por reto (estrellas 1..5). */
  challengeStars: Record<string, number>
  looks: SavedLook[]
  /** Último look en edición por muñeca. */
  current: Record<string, Look>
  activeDoll: string
  onboardingDone: boolean
  heartFound: boolean
  endingSeen: boolean
  endingUnlocked: boolean
  settings: { volume: number; muted: boolean; quality: Quality }
  story: StoryProgress
}

export const STARTING_COINS = 60

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: STARTING_COINS,
    owned: [],
    challengeStars: {},
    looks: [],
    current: {},
    activeDoll: 'clara',
    onboardingDone: false,
    heartFound: false,
    endingSeen: false,
    endingUnlocked: false,
    settings: { volume: 0.7, muted: false, quality: 'auto' },
    story: { chapters: {} },
  }
}

type AnyObj = Record<string, unknown>
const isObj = (v: unknown): v is AnyObj => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * v1: { version:1, coins, owned, completed: string[], looks: {name, look}[] }
 * v2: añade challengeStars, looks con id/createdAt, settings sin calidad.
 * v3: calidad gráfica, heartFound/endingUnlocked, look actual por muñeca.
 * v4: progreso del modo historia (las fotos de recuerdo van aparte, en IndexedDB).
 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave()
  if (!isObj(raw)) return base
  let data: AnyObj = { ...raw }
  let version = typeof data.version === 'number' ? data.version : 1

  if (version < 2) {
    const completed = Array.isArray(data.completed) ? (data.completed as unknown[]).filter((x) => typeof x === 'string') : []
    const stars: Record<string, number> = {}
    for (const id of completed as string[]) stars[id] = 3
    const looks = Array.isArray(data.looks) ? (data.looks as unknown[]) : []
    data = {
      ...data,
      challengeStars: stars,
      looks: looks.filter(isObj).map((l, i) => ({
        id: `look-${i + 1}`,
        name: typeof l.name === 'string' ? l.name : `Look ${i + 1}`,
        look: l.look,
        createdAt: 0,
      })),
      settings: { volume: 0.7, muted: false },
    }
    delete data.completed
    version = 2
  }
  if (version < 3) {
    const s = isObj(data.settings) ? data.settings : {}
    data = {
      ...data,
      settings: { ...base.settings, ...s, quality: 'auto' },
      heartFound: false,
      endingUnlocked: false,
      current: {},
    }
    version = 3
  }
  if (version < 4) {
    data = { ...data, story: { chapters: {} } }
    version = 4
  }

  const settings = isObj(data.settings) ? data.settings : {}
  const out: SaveData = {
    version: SAVE_VERSION,
    coins: typeof data.coins === 'number' && Number.isFinite(data.coins) ? Math.max(0, Math.floor(data.coins)) : base.coins,
    owned: Array.isArray(data.owned) ? (data.owned as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    challengeStars: isObj(data.challengeStars)
      ? Object.fromEntries(
          Object.entries(data.challengeStars).filter(([, v]) => typeof v === 'number' && v >= 1 && v <= 5),
        ) as Record<string, number>
      : {},
    looks: Array.isArray(data.looks)
      ? (data.looks as unknown[]).filter((l): l is SavedLook => isObj(l) && typeof l.id === 'string' && isObj(l.look))
      : [],
    current: isObj(data.current) ? (data.current as Record<string, Look>) : {},
    activeDoll: typeof data.activeDoll === 'string' ? data.activeDoll : base.activeDoll,
    onboardingDone: data.onboardingDone === true,
    heartFound: data.heartFound === true,
    endingSeen: data.endingSeen === true,
    endingUnlocked: data.endingUnlocked === true,
    settings: {
      volume: typeof settings.volume === 'number' ? Math.max(0, Math.min(1, settings.volume)) : base.settings.volume,
      muted: settings.muted === true,
      quality: (['auto', 'baja', 'media', 'alta'] as Quality[]).includes(settings.quality as Quality)
        ? (settings.quality as Quality)
        : 'auto',
    },
    story: normalizeStory(data.story),
  }
  return out
}

function normalizeStory(raw: unknown): StoryProgress {
  const chapters: StoryProgress['chapters'] = {}
  const src = isObj(raw) && isObj(raw.chapters) ? raw.chapters : {}
  for (const [id, v] of Object.entries(src)) {
    if (!isObj(v) || typeof v.stars !== 'number' || v.stars < 1 || v.stars > 5) continue
    chapters[id] = { stars: Math.round(v.stars), completedAt: typeof v.completedAt === 'number' ? v.completedAt : 0 }
  }
  return { chapters }
}

export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

function getStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function loadSave(storage: StorageLike | null = getStorage()): SaveData {
  try {
    const txt = storage?.getItem(SAVE_KEY)
    if (!txt) return defaultSave()
    return migrate(JSON.parse(txt))
  } catch {
    return defaultSave()
  }
}

export function writeSave(data: SaveData, storage: StorageLike | null = getStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(SAVE_KEY, JSON.stringify(data))
    return true
  } catch {
    // Puede fallar por cuota llena (miniaturas): reintenta sin miniaturas.
    try {
      const slim = { ...data, looks: data.looks.map((l) => ({ ...l, thumb: undefined })) }
      storage?.setItem(SAVE_KEY, JSON.stringify(slim))
      return true
    } catch {
      return false
    }
  }
}

export function clearSave(storage: StorageLike | null = getStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY)
  } catch {
    /* sin almacenamiento disponible */
  }
}

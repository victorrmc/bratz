import { ITEMS } from '../data/items'
import { CHALLENGES } from '../data/challenges'
import type { ItemDef } from '../data/types'
import type { SaveData } from './save'

// Economía de monedas de purpurina y desbloqueos.

export const COINS_PER_STAR = 10
export const FIRST_CLEAR_BONUS = 20
export const PERFECT_BONUS = 15

export interface Reward {
  coins: number
  improved: boolean
  firstClear: boolean
}

/**
 * Recompensa de un reto. Solo se paga la mejora sobre la mejor puntuación previa,
 * para que repetir un reto no sea una fuente infinita de monedas.
 */
export function rewardFor(stars: number, prevStars: number | undefined): Reward {
  const s = Math.max(1, Math.min(5, Math.round(stars)))
  const prev = prevStars ?? 0
  const firstClear = prevStars === undefined
  const improved = s > prev
  let coins = Math.max(0, s - prev) * COINS_PER_STAR
  if (firstClear) coins += FIRST_CLEAR_BONUS
  if (s === 5 && prev < 5) coins += PERFECT_BONUS
  // Siempre una propina por participar.
  if (coins === 0) coins = 2
  return { coins, improved, firstClear }
}

export function applyChallengeResult(save: SaveData, challengeId: string, stars: number): { save: SaveData; reward: Reward } {
  const prev = save.challengeStars[challengeId]
  const reward = rewardFor(stars, prev)
  const next: SaveData = {
    ...save,
    coins: save.coins + reward.coins,
    challengeStars: { ...save.challengeStars, [challengeId]: Math.max(prev ?? 0, stars) },
  }
  return { save: syncEnding(next), reward }
}

export function completedCount(save: SaveData): number {
  return CHALLENGES.filter((c) => save.challengeStars[c.id] !== undefined).length
}

export function allChallengesDone(save: SaveData): boolean {
  return completedCount(save) >= CHALLENGES.length
}

/** El final se desbloquea al completar todos los retos o con el corazón escondido. */
export function syncEnding(save: SaveData): SaveData {
  if (!save.endingUnlocked && (allChallengesDone(save) || save.heartFound)) {
    return { ...save, endingUnlocked: true }
  }
  return save
}

export const HEART_TAPS = 5

export function registerHeartTap(save: SaveData, taps: number): { save: SaveData; taps: number; triggered: boolean } {
  const n = taps + 1
  if (n >= HEART_TAPS && !save.heartFound) {
    return { save: syncEnding({ ...save, heartFound: true }), taps: 0, triggered: true }
  }
  if (n >= HEART_TAPS) return { save, taps: 0, triggered: true }
  return { save, taps: n, triggered: false }
}

/** ¿Está la prenda disponible para ponérsela? */
export function isItemUnlocked(item: ItemDef, save: SaveData): boolean {
  if (item.rarity === 'comun') return true
  if (save.owned.includes(item.id)) return true
  if (item.rarity === 'secreta' && item.unlock) return meetsRule(item, save)
  return false
}

export function meetsRule(item: ItemDef, save: SaveData): boolean {
  const r = item.unlock
  if (!r) return false
  switch (r.kind) {
    case 'challenge':
      return save.challengeStars[r.challengeId] !== undefined
    case 'challengesCompleted':
      return completedCount(save) >= r.count
    case 'ending':
      return save.endingSeen
    case 'heart':
      return save.heartFound
  }
}

export function unlockHint(item: ItemDef): string {
  const r = item.unlock
  if (!r) return item.price ? `${item.price} monedas` : ''
  switch (r.kind) {
    case 'challenge': {
      const c = CHALLENGES.find((x) => x.id === r.challengeId)
      return `Supera el reto «${c?.title ?? r.challengeId}»`
    }
    case 'challengesCompleted':
      return `Completa ${r.count} retos`
    case 'ending':
      return 'Descubre el final secreto'
    case 'heart':
      return 'Busca el corazón escondido en la portada'
  }
}

export type BuyResult = { ok: true; save: SaveData } | { ok: false; reason: 'no-encontrada' | 'no-a-la-venta' | 'ya-tienes' | 'sin-monedas' }

export function buyItem(save: SaveData, itemId: string): BuyResult {
  const item = ITEMS.find((i) => i.id === itemId)
  if (!item) return { ok: false, reason: 'no-encontrada' }
  if (item.rarity !== 'especial' || !item.price) return { ok: false, reason: 'no-a-la-venta' }
  if (save.owned.includes(item.id)) return { ok: false, reason: 'ya-tienes' }
  if (save.coins < item.price) return { ok: false, reason: 'sin-monedas' }
  return { ok: true, save: { ...save, coins: save.coins - item.price, owned: [...save.owned, item.id] } }
}

export function shopItems(): ItemDef[] {
  return ITEMS.filter((i) => i.rarity !== 'comun')
}

export function availableItems(save: SaveData): ItemDef[] {
  return ITEMS.filter((i) => isItemUnlocked(i, save))
}

/** Desbloquea todo (modo debug). */
export function unlockEverything(save: SaveData): SaveData {
  const stars: Record<string, number> = { ...save.challengeStars }
  for (const c of CHALLENGES) stars[c.id] = Math.max(stars[c.id] ?? 0, 5)
  return {
    ...save,
    coins: Math.max(save.coins, 9999),
    owned: ITEMS.filter((i) => i.rarity !== 'comun').map((i) => i.id),
    challengeStars: stars,
    heartFound: true,
    endingUnlocked: true,
    endingSeen: true,
  }
}

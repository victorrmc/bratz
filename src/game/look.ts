import { DOLL_BY_ID, DOLLS } from '../data/characters'
import { ITEM_BY_ID } from '../data/items'
import type { ItemDef, ItemInstance, Look, Slot } from '../data/types'

/** Copia profunda de un look (son datos JSON planos). */
export function cloneLook(look: Look): Look {
  return JSON.parse(JSON.stringify(look)) as Look
}

export function defaultLookFor(dollId: string): Look {
  const doll = DOLL_BY_ID[dollId] ?? DOLLS[0]
  return cloneLook({ dollId: doll.id, ...doll.defaultLook })
}

export function instanceOf(item: ItemDef): ItemInstance {
  return { itemId: item.id, color: item.color, color2: item.color2, pattern: item.pattern ?? 'liso' }
}

/** Huecos incompatibles: un vestido sustituye a top y parte de abajo. */
const CONFLICTS: Partial<Record<Slot, Slot[]>> = {
  dress: ['top', 'bottom'],
  top: ['dress'],
  bottom: ['dress'],
}

/** Pone una prenda (o la quita si ya estaba puesta). Devuelve un look nuevo. */
export function toggleItem(look: Look, item: ItemDef, instance?: ItemInstance): Look {
  const next = cloneLook(look)
  const current = next.outfit[item.slot]
  if (current && current.itemId === item.id && !instance) {
    delete next.outfit[item.slot]
    return next
  }
  next.outfit[item.slot] = instance ? { ...instance } : instanceOf(item)
  for (const s of CONFLICTS[item.slot] ?? []) delete next.outfit[s]
  return next
}

export function equip(look: Look, item: ItemDef): Look {
  const cur = look.outfit[item.slot]
  if (cur?.itemId === item.id) return look
  return toggleItem(look, item)
}

export function updateInstance(look: Look, slot: Slot, patch: Partial<ItemInstance>): Look {
  const cur = look.outfit[slot]
  if (!cur) return look
  const next = cloneLook(look)
  next.outfit[slot] = { ...cur, ...patch }
  return next
}

export function wornItems(look: Look): { slot: Slot; inst: ItemInstance; def: ItemDef }[] {
  const out: { slot: Slot; inst: ItemInstance; def: ItemDef }[] = []
  for (const [slot, inst] of Object.entries(look.outfit) as [Slot, ItemInstance | undefined][]) {
    if (!inst) continue
    const def = ITEM_BY_ID[inst.itemId]
    if (def) out.push({ slot, inst, def })
  }
  return out
}

/** Generador pseudoaleatorio determinista (mulberry32) para tests y «Sorpréndeme». */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length) % arr.length]

/** Look aleatorio con las prendas que la jugadora tiene disponibles. */
export function randomLook(base: Look, available: ItemDef[], r: () => number): Look {
  let look = cloneLook(base)
  look.outfit = {}
  const by = (slot: Slot) => available.filter((i) => i.slot === slot)
  const dresses = by('dress')
  if (dresses.length && r() < 0.35) {
    look = equip(look, pick(r, dresses))
  } else {
    const tops = by('top')
    const bottoms = by('bottom')
    if (tops.length) look = equip(look, pick(r, tops))
    if (bottoms.length) look = equip(look, pick(r, bottoms))
  }
  const shoes = by('shoes')
  if (shoes.length) look = equip(look, pick(r, shoes))
  for (const slot of ['jacket', 'bag', 'earrings', 'necklace', 'bracelet', 'glasses', 'hat', 'hairAcc'] as Slot[]) {
    const opts = by(slot)
    if (opts.length && r() < (slot === 'jacket' || slot === 'hat' || slot === 'glasses' ? 0.3 : 0.55)) {
      look = equip(look, pick(r, opts))
    }
  }
  return look
}

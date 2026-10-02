import type { Look } from '../data/types'
import { cloneLook } from './look'
import type { SavedLook } from './save'

// Operaciones puras del armario (guardar, renombrar, duplicar, borrar).

export const MAX_LOOKS = 30
export const MAX_NAME = 24

export function sanitizeName(name: string, fallback: string): string {
  const t = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
  return t.length ? t : fallback
}

let counter = 0
export function newLookId(now: number): string {
  counter = (counter + 1) % 100000
  return `look-${now.toString(36)}-${counter}`
}

export function addLook(list: SavedLook[], look: Look, name: string, now: number, thumb?: string): SavedLook[] {
  const entry: SavedLook = {
    id: newLookId(now),
    name: sanitizeName(name, `Look ${list.length + 1}`),
    look: cloneLook(look),
    thumb,
    createdAt: now,
  }
  return [entry, ...list].slice(0, MAX_LOOKS)
}

export function renameLook(list: SavedLook[], id: string, name: string): SavedLook[] {
  return list.map((l) => (l.id === id ? { ...l, name: sanitizeName(name, l.name) } : l))
}

export function duplicateLook(list: SavedLook[], id: string, now: number): SavedLook[] {
  const idx = list.findIndex((l) => l.id === id)
  if (idx < 0) return list
  const src = list[idx]
  const copy: SavedLook = {
    ...src,
    id: newLookId(now),
    name: sanitizeName(`${src.name} (copia)`, src.name),
    look: cloneLook(src.look),
    createdAt: now,
  }
  const next = [...list]
  next.splice(idx + 1, 0, copy)
  return next.slice(0, MAX_LOOKS)
}

export function deleteLook(list: SavedLook[], id: string): SavedLook[] {
  return list.filter((l) => l.id !== id)
}

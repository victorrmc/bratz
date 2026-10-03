import { useEffect, useSyncExternalStore } from 'react'
import type { ItemDef, ItemInstance, PatternId } from '../data/types'

// Caché de miniaturas de prendas: memoria + IndexedDB propia (no toca el
// guardado de la partida). Las miniaturas se generan de una en una en los
// ratos libres del navegador, primero las que están a la vista.

/** Súbelo si cambia el aspecto de las piezas 3D o el encuadre: invalida la caché. */
const THUMB_VERSION = 1
const DB_NAME = 'clara-miniaturas'
const STORE = 'miniaturas'

type Renderer = typeof import('../three/thumbs')

const mem = new Map<string, string | null>()
const listeners = new Set<() => void>()
type Job = { key: string; item: ItemDef; inst: ItemInstance }
/** primero lo que está a la vista (en orden), después el resto del catálogo */
const urgentQ: Job[] = []
const backQ: Job[] = []
const queued = new Set<string>()
let loaded: Promise<void> | null = null
let renderer: Renderer | null = null
let pumping = false
let releaseTimer = 0

export function thumbKey(item: ItemDef, color?: string, color2?: string, pattern?: PatternId): string {
  return `v${THUMB_VERSION}|${item.id}|${color ?? item.color}|${color2 ?? item.color2 ?? ''}|${pattern ?? item.pattern ?? 'liso'}`
}

const emit = () => listeners.forEach((l) => l())

// ───────────── IndexedDB (opcional: si falla, solo hay caché en memoria) ─────────────

let dbp: Promise<IDBDatabase | null> | null = null
function db(): Promise<IDBDatabase | null> {
  if (!dbp)
    dbp = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null)
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  return dbp
}

function load(): Promise<void> {
  if (!loaded)
    loaded = db().then(
      (d) =>
        new Promise<void>((resolve) => {
          if (!d) return resolve()
          try {
            const tx = d.transaction(STORE, 'readwrite')
            const st = tx.objectStore(STORE)
            const prefix = `v${THUMB_VERSION}|`
            const cur = st.openCursor()
            cur.onsuccess = () => {
              const c = cur.result
              if (!c) return
              const k = String(c.key)
              // las miniaturas de versiones anteriores se borran
              if (!k.startsWith(prefix)) c.delete()
              else if (typeof c.value === 'string' && !mem.has(k)) mem.set(k, c.value)
              c.continue()
            }
            tx.oncomplete = () => (emit(), resolve())
            tx.onerror = () => resolve()
            tx.onabort = () => resolve()
          } catch {
            resolve()
          }
        }),
    )
  return loaded
}

const pendingWrites = new Map<string, string>()
let writeTimer = 0
function persist(key: string, url: string) {
  pendingWrites.set(key, url)
  if (writeTimer) return
  writeTimer = window.setTimeout(async () => {
    writeTimer = 0
    const d = await db()
    const batch = [...pendingWrites]
    pendingWrites.clear()
    if (!d) return
    try {
      const tx = d.transaction(STORE, 'readwrite')
      for (const [k, u] of batch) tx.objectStore(STORE).put(u, k)
    } catch {
      /* sin espacio o modo privado: nos quedamos con la caché en memoria */
    }
  }, 1500)
}

// ───────────── Cola de generación ─────────────

const idle = (f: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 400 })
  else window.setTimeout(f, 30)
}

async function pump() {
  if (pumping) return
  pumping = true
  window.clearTimeout(releaseTimer)
  await load()
  try {
    renderer ??= await import('../three/thumbs')
  } catch {
    pumping = false
    return
  }
  const step = () => {
    const job = urgentQ.shift() ?? backQ.shift()
    if (!job) {
      pumping = false
      // sin trabajo pendiente: se libera el contexto WebGL de las miniaturas
      releaseTimer = window.setTimeout(() => renderer?.releaseThumbRenderer(), 8000)
      return
    }
    queued.delete(job.key)
    if (!mem.has(job.key)) {
      const url = renderer!.renderThumb(job.item, job.inst)
      mem.set(job.key, url)
      if (url) persist(job.key, url)
      emit()
    }
    idle(step)
  }
  idle(step)
}

/** Pide una miniatura. `urgent` la adelanta a las del fondo (está a la vista). */
export function requestThumb(item: ItemDef, inst?: Partial<ItemInstance>, urgent = true) {
  const color = inst?.color ?? item.color
  const color2 = inst?.color2 ?? item.color2
  const pattern = inst?.pattern ?? item.pattern ?? 'liso'
  const key = thumbKey(item, color, color2, pattern)
  if (mem.has(key)) return
  const job = { key, item, inst: { itemId: item.id, color, color2, pattern } }
  if (queued.has(key)) {
    const i = backQ.findIndex((j) => j.key === key)
    if (urgent && i >= 0) urgentQ.push(...backQ.splice(i, 1))
  } else {
    queued.add(key)
    ;(urgent ? urgentQ : backQ).push(job)
  }
  void pump()
}

/** Genera en segundo plano las miniaturas del catálogo (colores de serie). */
export function prefetchThumbs(items: ItemDef[]) {
  for (const i of items) requestThumb(i, undefined, false)
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Miniatura de la prenda con esos colores: la URL si ya está, o undefined mientras se genera. */
export function useThumb(item: ItemDef, color?: string, color2?: string, pattern?: PatternId): string | undefined {
  const key = thumbKey(item, color, color2, pattern)
  const url = useSyncExternalStore(subscribe, () => mem.get(key))
  useEffect(() => {
    requestThumb(item, { color, color2, pattern })
  }, [item, color, color2, pattern])
  return url ?? undefined
}

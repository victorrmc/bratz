// Fotos de recuerdo del modo historia, en IndexedDB (no en localStorage: pesan).
// Base de datos propia («rumbo-recuerdos») para no chocar con el álbum de fotos.

export const MEMORIES_DB = 'rumbo-recuerdos'
export const MEMORIES_STORE = 'recuerdos'
const DB_VERSION = 1

export interface Memory {
  /** Un recuerdo por capítulo: al repetirlo se sustituye la foto. */
  chapterId: string
  /** Foto JPEG como data URL. */
  image: string
  stage: string
  stars: number
  caption: string
  createdAt: number
}

type Factory = Pick<IDBFactory, 'open' | 'deleteDatabase'>

function defaultFactory(): Factory | null {
  try {
    return typeof indexedDB !== 'undefined' ? indexedDB : null
  } catch {
    return null
  }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export function openMemories(factory: Factory | null = defaultFactory()): Promise<IDBDatabase | null> {
  if (!factory) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const r = factory.open(MEMORIES_DB, DB_VERSION)
      r.onupgradeneeded = () => {
        const db = r.result
        if (!db.objectStoreNames.contains(MEMORIES_STORE)) db.createObjectStore(MEMORIES_STORE, { keyPath: 'chapterId' })
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, factory?: Factory | null): Promise<T | null> {
  const db = await openMemories(factory === undefined ? defaultFactory() : factory)
  if (!db) return null
  try {
    const tx = db.transaction(MEMORIES_STORE, mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    const [result] = await Promise.all([req(fn(tx.objectStore(MEMORIES_STORE))), done])
    return result
  } catch {
    return null
  } finally {
    db.close()
  }
}

export function isValidMemory(m: unknown): m is Memory {
  if (typeof m !== 'object' || m === null) return false
  const o = m as Record<string, unknown>
  return typeof o.chapterId === 'string' && typeof o.image === 'string' && o.image.startsWith('data:image/') && typeof o.createdAt === 'number'
}

/** Guarda (o sustituye) el recuerdo de un capítulo. Devuelve si se ha guardado. */
export async function putMemory(m: Memory, factory?: Factory | null): Promise<boolean> {
  if (!isValidMemory(m)) return false
  const r = await withStore('readwrite', (s) => s.put(m), factory)
  return r !== null
}

export async function getMemory(chapterId: string, factory?: Factory | null): Promise<Memory | null> {
  const r = await withStore<unknown>('readonly', (s) => s.get(chapterId), factory)
  return isValidMemory(r) ? r : null
}

/** Todos los recuerdos, ordenados según `order` (ids de capítulo) y luego por fecha. */
export async function listMemories(order: string[] = [], factory?: Factory | null): Promise<Memory[]> {
  const all = await withStore<unknown[]>('readonly', (s) => s.getAll(), factory)
  const rank = (id: string) => {
    const i = order.indexOf(id)
    return i < 0 ? order.length : i
  }
  return (all ?? []).filter(isValidMemory).sort((a, b) => rank(a.chapterId) - rank(b.chapterId) || a.createdAt - b.createdAt)
}

export async function clearMemories(factory?: Factory | null): Promise<boolean> {
  const r = await withStore('readwrite', (s) => s.clear(), factory)
  return r !== null
}

import * as THREE from 'three'
import { getDetail } from './geo'

// Caché de geometría procedural por clave.
//
// Las piezas de la muñeca (cuerpo, cabeza, manos, pies y pelo) se generan por
// código, y eso cuesta cientos de milisegundos en un móvil. Cada constructor se
// envuelve con `keyed(nombre, construir)`:
//  - si la pieza ya está en memoria (porque la mandó el worker o venía de
//    IndexedDB), se monta el BufferGeometry directamente con sus arrays;
//  - si no, se construye aquí y se guarda en IndexedDB para la próxima visita.
// Las claves llevan el nivel de detalle y una huella del código que genera las
// piezas (GEO_VERSION): si cambia ese código, la caché vieja se ignora y se borra.

declare const __GEO_VERSION__: string
export const GEO_VERSION = typeof __GEO_VERSION__ === 'string' ? __GEO_VERSION__ : 'dev'

type Arr = Float32Array | Uint16Array | Uint32Array | Int16Array | Uint8Array | Int8Array | Int32Array | Uint8ClampedArray

/** Geometría serializable (se puede pasar entre hilos y guardar en IndexedDB). */
export interface GeoData {
  attrs: { name: string; array: Arr; itemSize: number; normalized: boolean }[]
  index: Uint16Array | Uint32Array | null
  groups: { start: number; count: number; materialIndex?: number }[]
  userData: Record<string, unknown>
}

export function toData(g: THREE.BufferGeometry): GeoData {
  const attrs: GeoData['attrs'] = []
  for (const [name, a] of Object.entries(g.attributes)) {
    const attr = a as THREE.BufferAttribute
    attrs.push({ name, array: attr.array as Arr, itemSize: attr.itemSize, normalized: attr.normalized })
  }
  const userData = g.userData && Object.keys(g.userData).length ? (JSON.parse(JSON.stringify(g.userData)) as Record<string, unknown>) : {}
  return { attrs, index: (g.index?.array as Uint16Array | Uint32Array | undefined) ?? null, groups: g.groups.map((x) => ({ ...x })), userData }
}

export function fromData(d: GeoData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  for (const a of d.attrs) g.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized))
  if (d.index) g.setIndex(new THREE.BufferAttribute(d.index, 1))
  for (const gr of d.groups) g.addGroup(gr.start, gr.count, gr.materialIndex)
  const ud = { ...d.userData }
  // los nodos de las cadenas de pelo son Vector3
  if (Array.isArray(ud.nodes)) ud.nodes = (ud.nodes as { x: number; y: number; z: number }[]).map((n) => new THREE.Vector3(n.x, n.y, n.z))
  g.userData = ud
  return g
}

/** Arrays de una pieza (para transferirlos sin copia desde el worker). */
export function buffersOf(d: GeoData): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>()
  for (const a of d.attrs) out.add(a.array.buffer as ArrayBuffer)
  if (d.index) out.add(d.index.buffer as ArrayBuffer)
  return [...out]
}

const store = new Map<string, GeoData>()
const pending = new Set<string>()
const IS_WORKER = typeof window === 'undefined'

export const geoStats = {
  /** de dónde salió la geometría de la muñeca en esta carga */
  source: 'ninguna' as 'ninguna' | 'indexeddb' | 'worker' | 'hilo principal',
  /** milisegundos que tardó en estar lista (lectura de IndexedDB o worker) */
  ms: 0,
  /** piezas montadas desde la caché / construidas en el hilo principal */
  hits: 0,
  built: 0,
  /** piezas guardadas en IndexedDB en esta sesión */
  saved: 0,
}
if (!IS_WORKER) (window as unknown as { __claraGeo: typeof geoStats }).__claraGeo = geoStats

const fullKey = (name: string) => `${getDetail()}|${name}`

/** Devuelve la pieza `name` desde la caché o la construye (y la deja lista para guardar). */
export function keyed(name: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const k = fullKey(name)
  const d = store.get(k)
  if (d) {
    geoStats.hits++
    return fromData(d)
  }
  const g = build()
  store.set(k, toData(g))
  pending.add(k)
  geoStats.built++
  schedulePersist()
  return g
}

/** Marca (sin geometría) para saber si un conjunto de piezas ya está completo. */
export function markDone(name: string) {
  const k = fullKey(name)
  if (store.has(k)) return
  store.set(k, { attrs: [], index: null, groups: [], userData: {} })
  pending.add(k)
  schedulePersist()
}
export const isDone = (name: string) => store.has(fullKey(name))

/** Piezas nuevas desde la última llamada (el worker las devuelve con esto). */
export function takePending(): [string, GeoData][] {
  const out: [string, GeoData][] = []
  for (const k of pending) out.push([k, store.get(k)!])
  pending.clear()
  return out
}

/** Añade piezas que llegan de fuera (del worker); se guardan en IndexedDB. */
export function absorb(entries: [string, GeoData][]) {
  for (const [k, d] of entries) {
    if (store.has(k)) continue
    store.set(k, d)
    pending.add(k)
  }
  schedulePersist()
}

// ───────────────────── IndexedDB ─────────────────────

const DB_NAME = 'rumbo-geometria'
const STORE = 'piezas'
let dbp: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (IS_WORKER || GEO_VERSION === 'dev' || typeof indexedDB === 'undefined') return Promise.resolve(null)
  dbp ??= new Promise((res) => {
    try {
      const r = indexedDB.open(DB_NAME, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(STORE)
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
      r.onblocked = () => res(null)
    } catch {
      res(null)
    }
  })
  return dbp
}

const reqP = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

/** Carga en memoria las piezas guardadas para este detalle. Devuelve cuántas. */
export async function loadFromDb(): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  try {
    const prefix = `${GEO_VERSION}|${getDetail()}|`
    const tx = db.transaction(STORE, 'readonly')
    const range = IDBKeyRange.bound(prefix, prefix + '￿')
    const os = tx.objectStore(STORE)
    const [keys, values] = await Promise.all([reqP(os.getAllKeys(range)), reqP(os.getAll(range))])
    let n = 0
    keys.forEach((key, i) => {
      const k = String(key).slice(GEO_VERSION.length + 1)
      if (!store.has(k)) {
        store.set(k, values[i] as GeoData)
        n++
      }
    })
    return n
  } catch {
    return 0
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (IS_WORKER || timer) return
  // en segundo plano, poco después de montar la muñeca
  timer = setTimeout(() => {
    timer = null
    void persist()
  }, 1500)
}
if (!IS_WORKER) {
  // si se cierra o se oculta la app antes de tiempo, se guarda lo pendiente
  addEventListener('pagehide', () => void flushGeometry())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushGeometry()
  })
}

const txDone = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
    tx.onabort = () => rej(tx.error)
  })

let cleaned = false
async function persist() {
  const db = await openDb()
  if (!db || !pending.size) return
  const keys = [...pending]
  pending.clear()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const done = txDone(tx)
    const os = tx.objectStore(STORE)
    for (const k of keys) {
      const d = store.get(k)
      if (d) os.put(d, `${GEO_VERSION}|${k}`)
    }
    await done
    geoStats.saved += keys.length
  } catch {
    // sin espacio o sin permiso: se vuelve a generar la próxima vez
    return
  }
  if (cleaned) return
  cleaned = true
  // piezas de versiones anteriores del código: fuera
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const done = txDone(tx)
    const r = tx.objectStore(STORE).openKeyCursor()
    r.onsuccess = () => {
      const c = r.result
      if (!c) return
      if (!String(c.key).startsWith(`${GEO_VERSION}|`)) tx.objectStore(STORE).delete(c.key)
      c.continue()
    }
    await done
  } catch {
    // no pasa nada: se intentará en la próxima visita
  }
}

/** Fuerza el guardado pendiente (lo usan los tests E2E). */
export async function flushGeometry() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  await persist()
}

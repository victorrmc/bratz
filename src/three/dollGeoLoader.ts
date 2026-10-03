import { setDetail } from './geo'
import { baseKey, buildDollBase } from './dollGeo'
import { absorb, geoStats, isDone, loadFromDb, type GeoData } from './geoCache'

// Prepara la geometría base de la muñeca antes de montarla:
//  1. si ya está en memoria (otra pantalla, otra muñeca), no hace nada;
//  2. si está en IndexedDB (visitas anteriores), la lee: carga casi instantánea;
//  3. si no, la genera un Web Worker mientras el hilo principal sigue con la
//     escena (compilar shaders, montar React…), y después se guarda en IndexedDB;
//  4. si no hay workers o algo falla, se genera aquí mismo, como antes.

function runWorker(detail: number, lips: number[]): Promise<[string, GeoData][]> {
  return new Promise((resolve, reject) => {
    let w: Worker
    try {
      w = new Worker(new URL('./dollGeo.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) {
      reject(e)
      return
    }
    const done = () => w.terminate()
    w.onmessage = (e: MessageEvent<{ entries?: [string, GeoData][]; error?: string }>) => {
      done()
      if (e.data.entries) resolve(e.data.entries)
      else reject(new Error(e.data.error ?? 'worker'))
    }
    w.onerror = (e) => {
      done()
      reject(new Error(e.message))
    }
    w.postMessage({ detail, lips })
  })
}

const inflight = new Map<string, Promise<void>>()

export function preloadDollGeometry(detail: number, lips: number[]): Promise<void> {
  const key = `${detail}|${baseKey(lips)}`
  let p = inflight.get(key)
  if (!p) {
    p = load(detail, lips).finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}

async function load(detail: number, lips: number[]) {
  setDetail(detail)
  if (isDone(baseKey(lips))) return
  const t0 = performance.now()
  await loadFromDb()
  if (isDone(baseKey(lips))) {
    geoStats.source = 'indexeddb'
  } else {
    try {
      absorb(await runWorker(detail, lips))
      geoStats.source = 'worker'
    } catch {
      buildDollBase(lips)
      geoStats.source = 'hilo principal'
    }
  }
  geoStats.ms = Math.round(performance.now() - t0)
}

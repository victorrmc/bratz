// Worker que genera la geometría base de la muñeca fuera del hilo principal.
// Recibe el nivel de detalle y las cabezas que hacen falta, construye las piezas
// con el mismo código que el hilo principal (dollGeo.ts) y las devuelve como
// arrays transferibles (sin copia).
import { setDetail } from './geo'
import { buildDollBase } from './dollGeo'
import { buffersOf, takePending } from './geoCache'

self.onmessage = (e: MessageEvent<{ detail: number; lips: number[] }>) => {
  try {
    const t0 = performance.now()
    setDetail(e.data.detail)
    buildDollBase(e.data.lips)
    const entries = takePending()
    const transfer = new Set<ArrayBuffer>()
    for (const [, d] of entries) for (const b of buffersOf(d)) transfer.add(b)
    self.postMessage({ entries, ms: performance.now() - t0 }, { transfer: [...transfer] })
  } catch (err) {
    self.postMessage({ error: String(err) })
  }
}

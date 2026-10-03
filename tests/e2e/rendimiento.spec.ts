import type { Page } from '@playwright/test'
import { expect, openFresh, start, test } from './fixtures'

// Tarea: rendimiento en móviles reales.
// - Geometría de la muñeca generada en un Web Worker y guardada en IndexedDB.
// - Calidad baja con sonda de luz, media sin posproceso, alta con posproceso diferido.
// - Señal de «3D listo» solo con la muñeca ya en pantalla.

interface GeoStats {
  source: string
  ms: number
  hits: number
  built: number
  saved: number
}

const geo = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __claraGeo: GeoStats }).__claraGeo }))

type W = {
  __clara: {
    interaction: {
      scene: { environment: unknown; traverse: (f: (o: { isLightProbe?: boolean; isMesh?: boolean; material?: { sheen?: number; clearcoat?: number } }) => void) => void }
      rig: { root: { traverse: (f: (o: { isMesh?: boolean; material?: { sheen?: number } }) => void) => void } } | null
      gl: { info: { programs: { name: string }[] } }
    }
  }
}

/** Peticiones de trozos JS de la página (para saber qué se ha descargado). */
function trackChunks(page: Page) {
  const urls: string[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('.js')) urls.push(r.url())
  })
  return urls
}

const lighting = (page: Page) =>
  page.evaluate(() => {
    const { scene, rig } = (window as unknown as W).__clara.interaction
    let probes = 0
    scene.traverse((o) => {
      if (o.isLightProbe) probes++
    })
    let sheen = 0
    rig?.root.traverse((o) => {
      if (o.isMesh && o.material?.sheen) sheen++
    })
    return { env: scene.environment !== null, probes, sheen }
  })

test('la geometría de la muñeca sale del worker y, al volver, de IndexedDB', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await expect.poll(async () => (await geo(page)).source).toBe('worker')
  const first = await geo(page)
  expect(first.hits, 'piezas montadas desde lo que generó el worker').toBeGreaterThan(10)
  // se guarda en segundo plano poco después de montar la muñeca
  await expect.poll(async () => (await geo(page)).saved, { timeout: 20_000 }).toBeGreaterThan(10)

  await page.reload()
  await start(page)
  const second = await geo(page)
  expect(second.source).toBe('indexeddb')
  expect(second.built, 'nada se regenera en la segunda carga (cuerpo, cabeza, manos, pies y pelo)').toBe(0)
  expect(second.hits).toBeGreaterThanOrEqual(first.hits)
})

test('la señal de 3D listo llega con la muñeca en pantalla', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  const r = await page.evaluate(() => ({
    mark: performance.getEntriesByName('rumbo:3d-listo').length,
    rig: Boolean((window as unknown as W).__clara.interaction.rig),
  }))
  expect(r).toEqual({ mark: 1, rig: true })
})

test('calidad baja: sonda de luz en vez de entorno y sin descargar el posproceso', async ({ page, errors }) => {
  void errors
  const chunks = trackChunks(page)
  await openFresh(page, 'q=baja')
  await page.waitForTimeout(1500)
  expect(await lighting(page)).toEqual({ env: false, probes: 1, sheen: 0 })
  expect(chunks.some((u) => /\/post-[\w-]+\.js$/.test(u)), 'el trozo del posproceso no se pide').toBe(false)
})

test('calidad media: reflejos del entorno, sin terciopelo y sin posproceso', async ({ page, errors }) => {
  void errors
  const chunks = trackChunks(page)
  await openFresh(page, 'q=media')
  await page.waitForTimeout(1500)
  expect(await lighting(page)).toEqual({ env: true, probes: 0, sheen: 0 })
  expect(chunks.some((u) => /\/post-[\w-]+\.js$/.test(u))).toBe(false)
})

test('calidad alta: el posproceso llega después de mostrar la muñeca', async ({ page, errors }) => {
  void errors
  const chunks = trackChunks(page)
  await openFresh(page, 'q=alta')
  await expect.poll(() => chunks.some((u) => /\/post-[\w-]+\.js$/.test(u)), { timeout: 30_000 }).toBe(true)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as W).__clara.interaction.gl.info.programs.some((p) => p.name === 'EffectMaterial')), { timeout: 60_000 })
    .toBe(true)
  expect(await lighting(page)).toMatchObject({ env: true, probes: 0 })
})

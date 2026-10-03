// Mide los FPS medios durante 10 s en el estudio y en la pasarela con la CPU
// ralentizada 4x (viewport móvil), y el tiempo de carga del 3D.
// Uso: node scripts/perf.mjs [url]
//   SCREENS=studio,runway  pantallas para los FPS ('' para saltarlos)
//   LOADS=3                repeticiones de la medida de carga (0 para saltarla)
//   RATE=4                 ralentización de la CPU
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:4173/bratz/'
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const results = []
const loads = []
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]

/**
 * Carga 3D: desde el toque en «Toca para empezar» hasta que la muñeca lleva tres
 * fotogramas en pantalla (marca `rumbo:3d-listo`). Se mide la primera visita (sin
 * caché de geometría) y la segunda (con la geometría ya en IndexedDB), cada una
 * con la CPU a 1x y a la ralentización pedida.
 */
async function measureLoad(rate) {
  const b = await chromium.launch({ args: ARGS })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  const out = []
  for (let visit = 0; visit < 2; visit++) {
    await p.goto(base)
    await p.getByTestId('start').waitFor()
    await p.waitForTimeout(500)
    await p.evaluate(() => performance.mark('rumbo:clic'))
    await p.getByTestId('start').click()
    await p.waitForFunction(() => performance.getEntriesByName('rumbo:3d-listo').length > 0, null, { timeout: 120000, polling: 50 })
    out.push(
      await p.evaluate(() => {
        const a = performance.getEntriesByName('rumbo:clic')[0].startTime
        const z = performance.getEntriesByName('rumbo:3d-listo')[0].startTime
        return { s: +((z - a) / 1000).toFixed(2), geo: window.__claraGeo?.source ?? '?' }
      }),
    )
    // tiempo para que la geometría se guarde en IndexedDB
    await p.waitForTimeout(4000)
  }
  await b.close()
  return out
}

for (const rate of [1, +(process.env.RATE ?? 4)]) {
  const n = +(process.env.LOADS ?? 3)
  if (!n) break
  const first = []
  const second = []
  for (let i = 0; i < n; i++) {
    const [a, c] = await measureLoad(rate)
    first.push(a.s)
    second.push(c.s)
    console.log(`carga cpu ${rate}x: primera ${a.s} s (${a.geo}), segunda ${c.s} s (${c.geo})`)
  }
  loads.push({ cpu: `${rate}x`, primera: median(first), segunda: median(second), muestras: { primera: first, segunda: second } })
}

for (const screen of (process.env.SCREENS ?? 'studio,runway').split(',').filter(Boolean)) {
  const b = await chromium.launch({ args: ARGS })
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  await p.goto(base)
  await p.getByTestId('start').click()
  await p.waitForSelector('[data-screen="home"]', { timeout: 120000 })
  const cdp = await p.context().newCDPSession(p)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.RATE ?? 4) })
  await p.evaluate((s) => {
    const st = window.__clara.store.getState()
    st.finishOnboarding()
    st.go(s)
  }, screen)
  if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS })
  // margen para que el DPR adaptativo se estabilice
  await p.waitForTimeout(30000)
  const r = await p.evaluate(
    () =>
      new Promise((res) => {
        const samples = []
        let n = 0
        let last = performance.now()
        const t0 = last
        const f = () => {
          const now = performance.now()
          samples.push(now - last)
          last = now
          n++
          if (now - t0 < 10000) requestAnimationFrame(f)
          else {
            const sorted = [...samples].sort((a, b) => a - b)
            const p95 = sorted[Math.floor(sorted.length * 0.95)]
            const g = window.__clara.interaction.gl
            res({ fps: n / ((now - t0) / 1000), p95FrameMs: p95, minFps: 1000 / p95, quality: window.__clara.store.getState().quality, canvas: `${g.domElement.width}x${g.domElement.height}` })
          }
        }
        requestAnimationFrame(f)
      }),
  )
  results.push({ screen, throttle: '4x', ...r })
  console.log(screen, JSON.stringify(r))
  await b.close()
}
fs.mkdirSync('docs', { recursive: true })
fs.writeFileSync('docs/perf.json', JSON.stringify({ date: new Date().toISOString(), results, carga3d: loads }, null, 2))

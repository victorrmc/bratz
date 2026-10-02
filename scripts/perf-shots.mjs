// Capturas de rendimiento (tarea «rendimiento en móviles»).
// Uso: node scripts/perf-shots.mjs <antes|despues> [url]   (con `npm run preview` en marcha)
//
// - estudio-auto: el estudio con la calidad automática tras 30 s con la CPU 4x más
//   lenta, como mide scripts/perf.mjs (se ve a qué resolución acaba el lienzo).
// - estudio-media / estudio-baja: la misma vista con la calidad fijada.
// - portada: la portada 3D al terminar de cargar.
// Los FPS de cada captura se anotan en docs/screenshots/rendimiento/<fase>/fps.json.
import { chromium } from 'playwright'
import fs from 'node:fs'

const phase = process.argv[2] ?? 'despues'
const base = process.argv[3] ?? 'http://localhost:4173/bratz/'
const dir = `docs/screenshots/rendimiento/${phase}`
fs.mkdirSync(dir, { recursive: true })
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const out = {}

async function shot(name, query, { throttle = 0, wait = 6000, screen = 'studio' } = {}) {
  const b = await chromium.launch({ args: ARGS })
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  await p.goto(base + query)
  await p.getByTestId('start').click()
  await p.waitForSelector('[data-screen="home"]', { timeout: 120000 })
  if (screen !== 'home') {
    await p.evaluate((s) => {
      const st = window.__clara.store.getState()
      st.finishOnboarding()
      st.go(s)
    }, screen)
  }
  if (throttle) {
    const cdp = await p.context().newCDPSession(p)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  }
  await p.waitForTimeout(wait)
  const info = await p.evaluate(
    () =>
      new Promise((res) => {
        let n = 0
        const t0 = performance.now()
        const f = () => {
          n++
          if (performance.now() - t0 < 5000) requestAnimationFrame(f)
          else {
            const g = window.__clara.interaction.gl
            res({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), quality: window.__clara.store.getState().quality, canvas: `${g.domElement.width}x${g.domElement.height}` })
          }
        }
        requestAnimationFrame(f)
      }),
  )
  await p.screenshot({ path: `${dir}/${name}.png` })
  out[name] = info
  console.log(name, JSON.stringify(info))
  await b.close()
}

await shot('estudio-auto', '', { throttle: 4, wait: 30000 })
await shot('estudio-media', '?q=media')
await shot('estudio-baja', '?q=baja')
await shot('portada', '', { screen: 'home', wait: 3000 })
fs.writeFileSync(`${dir}/fps.json`, JSON.stringify(out, null, 2))

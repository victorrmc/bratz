// Mide los FPS medios durante 10 s en el estudio y en la pasarela con la CPU
// ralentizada 4x (viewport móvil). Uso: node scripts/perf.mjs [url]
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:4173/bratz/'
const results = []
for (const screen of (process.env.SCREENS ?? 'studio,runway').split(',')) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
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
fs.writeFileSync('docs/perf.json', JSON.stringify({ date: new Date().toISOString(), results }, null, 2))

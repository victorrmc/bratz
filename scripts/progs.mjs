import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?q=baja&dpr=0.5')
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(2000)
  console.log(await p.evaluate(() => { const g = window.__clara.interaction.gl; const s = window.__clara.store.getState(); return JSON.stringify({ programs: g.info.programs.length, geos: g.info.memory.geometries, tex: g.info.memory.textures, calls: g.info.render.calls, frame: g.info.render.frame, q: s.quality }) }))
}
await b.close()

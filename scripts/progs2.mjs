import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?q=baja&dpr=0.5')
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
await p.waitForTimeout(6000)
let prev = new Set()
for (let i = 0; i < 8; i++) {
  const list = await p.evaluate(() => window.__clara.interaction.gl.info.programs.map((x) => x.id + ':' + x.name + ':' + x.usedTimes))
  const ids = new Set(list.map((s) => s.split(':')[0]))
  const added = list.filter((s) => !prev.has(s.split(':')[0]))
  if (i) console.log('t', i, 'count', list.length, 'new', added.join(', '))
  prev = ids
  await p.waitForTimeout(1500)
}
await b.close()

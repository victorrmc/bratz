import { chromium } from 'playwright'
const [, , q = '', throttle = '1'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?' + q)
await p.waitForSelector('[data-screen]', { timeout: 90000 })
const cdp = await p.context().newCDPSession(p)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(2500)
  console.log(await p.evaluate(() => { const g = window.__clara.interaction.gl; return `t=${performance.now().toFixed(0)} fps=${window.__clara.interaction.fps.toFixed(1)} q=${window.__clara.store.getState().quality} canvas=${g.domElement.width}x${g.domElement.height}` }))
}
await b.close()

import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?q=baja&dpr=0.5')
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
await p.waitForTimeout(8000)
const cdp = await p.context().newCDPSession(p)
let layers = []
cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers })
await cdp.send('LayerTree.enable')
await p.waitForTimeout(2000)
const drawn = layers.filter((l) => l.drawsContent)
console.log('layers', layers.length, 'drawsContent', drawn.length)
for (const l of drawn.slice(0, 40)) {
  let reasons = []
  try { reasons = (await cdp.send('LayerTree.compositingReasons', { layerId: l.layerId })).compositingReasonIds } catch {}
  console.log(l.width + 'x' + l.height, l.offsetX, l.offsetY, reasons.join(','))
}
await b.close()

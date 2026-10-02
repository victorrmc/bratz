import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?q=baja&dpr=0.5')
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
await p.addStyleTag({ content: '*{backdrop-filter:none!important}' })
await p.waitForTimeout(6000)
await b.startTracing(p, { path: '/tmp/t2.json', categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'gpu'] })
await p.waitForTimeout(2000)
await b.stopTracing()
await b.close()
const ev = JSON.parse(fs.readFileSync('/tmp/t2.json', 'utf8')).traceEvents
const c = new Map()
for (const e of ev) if (['Paint', 'PaintImage', 'RasterTask', 'UpdateLayer', 'Layout', 'UpdateLayerTree', 'PrePaint', 'Commit', 'DrawFrame', 'BeginFrame'].includes(e.name)) c.set(e.name, (c.get(e.name) || 0) + 1)
console.log([...c.entries()])
const paints = ev.filter((e) => e.name === 'Paint').slice(0, 8).map((e) => JSON.stringify(e.args?.data?.clip ?? e.args?.data ?? {}).slice(0, 200))
console.log(paints.join('\n'))

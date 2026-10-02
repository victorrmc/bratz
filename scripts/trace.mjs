import { chromium } from 'playwright'
import fs from 'node:fs'
const [, , q = 'q=baja&dpr=0.5'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?' + q)
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
await p.addStyleTag({ content: '*{backdrop-filter:none!important}' })
await p.evaluate(() => window.__clara.interaction.scene.children.forEach((c) => (c.visible = false)))
await p.waitForTimeout(5000)
await b.startTracing(p, { path: '/tmp/trace.json', categories: ['gpu', 'viz', 'cc', 'toplevel', 'disabled-by-default-gpu.service', 'blink', 'v8'] })
await p.waitForTimeout(3000)
await b.stopTracing()
await b.close()
const t = JSON.parse(fs.readFileSync('/tmp/trace.json', 'utf8'))
const ev = t.traceEvents || t
const names = new Map()
const threads = new Map()
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') threads.set(e.pid + ':' + e.tid, e.args.name)
for (const e of ev) {
  if (e.ph !== 'X' || !e.dur) continue
  const th = threads.get(e.pid + ':' + e.tid) || '?'
  const k = th + ' | ' + e.name
  names.set(k, (names.get(k) || 0) + e.dur)
}
console.log([...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => (v / 1000).toFixed(0) + 'ms ' + k).join('\n'))

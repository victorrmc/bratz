// Renderiza varias vistas en una sola hoja: node scripts/sheet.mjs out.png "q1" "q2" ...
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
const [, , out, ...queries] = process.argv
const base = process.env.URL ?? 'http://localhost:5173/'
const W = +(process.env.W ?? 420), H = +(process.env.H ?? 640)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const files = []
const C = +(process.env.C ?? 2)
const jobs = queries.map((q, i) => [q, i])
async function worker() { while (jobs.length) { const [q, i] = jobs.shift(); await run(q, i) } }
async function run(q, i) {
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  page.on('pageerror', (e) => console.log('pageerror', q, e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', q, m.text()) })
  await page.goto(base + '?' + q)
  await page.waitForTimeout(+(process.env.WAIT ?? 3000))
  const f = `/tmp/sheet_${i}.png`
  await page.screenshot({ path: f, timeout: 90000 })
  files[i] = f
  await page.close()
}
await Promise.all(Array.from({ length: C }, worker))
await browser.close()
execFileSync('python3', ['scripts/montage.py', out, ...files])

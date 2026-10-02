// Capturas de los escenarios de la sesión de fotos (tarea 4, «Escenarios vivos»).
// Uso: node scripts/screenshots-escenarios.mjs <antes|despues> [calidad]
// Necesita `npx vite preview --port 4173` en marcha.
import { chromium } from 'playwright'
import fs from 'node:fs'

const tag = process.argv[2] ?? 'despues'
const q = process.argv[3] ?? 'alta'
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const out = `docs/screenshots/escenarios-vivos/${tag}`
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
const S = (fn, arg) => page.evaluate(`(() => { const c = window.__clara; const s = c.store.getState(); (${fn})(s, c, ${JSON.stringify(arg ?? null)}) })()`)

await page.goto(`${base}?q=${q}&dpr=1`)
await page.evaluate(() => localStorage.clear())
await page.goto(`${base}?q=${q}&dpr=1`)
await page.getByTestId('start').click()
await page.waitForSelector('[data-screen="home"]', { timeout: 120000 })
await S((s) => { s.finishOnboarding(); s.debugUnlockAll(); s.go('photo') })
await page.waitForSelector('[data-testid="stage-disco"]')
const stages = await page.$$eval('[data-testid^="stage-"]', (els) => els.map((e) => e.getAttribute('data-testid').slice(6)))
for (const st of stages) {
  await S((s, c, st) => s.setStage(st), st)
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${out}/${st}.png` })
  console.log('ok', st)
}
// secuencia del atardecer: el sol baja hasta hundirse en el mar
if (tag === 'despues') {
  await S((s) => s.setStage('beach'))
  await S((s) => s.setStage('ibiza'))
  // esperas acumuladas: a los 5 s, 35 s y 56 s de entrar en el escenario
  for (const [wait, name] of [[5, 'ibiza-sol-1'], [30, 'ibiza-sol-2'], [21, 'ibiza-sol-3']]) {
    await page.waitForTimeout(wait * 1000)
    await page.screenshot({ path: `${out}/${name}.png` })
    console.log('ok', name)
  }
}
await browser.close()
if (errors.length) console.log('ERRORES', errors)

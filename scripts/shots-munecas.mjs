// Capturas de la tarea «muñecas con acabado comercial»: node scripts/shots-munecas.mjs <prefijo> [filtro]
// Cara de frente y en 3/4, ojos de cerca, manos y cuerpo (Clara y el resto de muñecas).
import { chromium } from 'playwright'
import fs from 'node:fs'

const prefix = process.argv[2] ?? 'despues'
const only = process.argv[3]
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const out = 'docs/screenshots/munecas'
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

const W = (ms) => page.waitForTimeout(ms)
const S = (fn, arg) => page.evaluate(`(() => { const c = window.__clara; const s = c.store.getState(); (${fn})(s, c, ${JSON.stringify(arg ?? null)}) })()`)
const shot = async (name, wait = 6000) => {
  if (only && !name.includes(only)) return
  await W(wait)
  await page.screenshot({ path: `${out}/${prefix}-${name}.png` })
  console.log('ok', name)
}
const hideUI = (on) => page.evaluate((on) => {
  let st = document.getElementById('hide-ui')
  if (!st) {
    st = document.createElement('style')
    st.id = 'hide-ui'
    document.head.appendChild(st)
  }
  st.textContent = on ? '.ui-layer,.topbar,.toasts{display:none!important}' : ''
}, on)

await page.goto(base + '?q=alta&dpr=1')
await page.getByTestId('start').click()
await page.waitForSelector('[data-screen="home"]', { timeout: 120000 })
await W(3000)
await S((s) => { s.finishOnboarding(); s.go('studio') })
await W(4000)
await hideUI(true)
// sin parpadeo para que las capturas sean estables
await S((s, c) => { c.interaction.dollRotY = 0; s.setCam('cara') })
await shot('01-cara', 7000)
await S((s, c) => { c.interaction.dollRotY = -0.6 })
await shot('02-cara-tres-cuartos', 5000)
await S((s, c) => { c.interaction.dollRotY = 0; c.interaction.zoom = 0.45 })
await shot('03-ojos', 5000)
await S((s, c) => { c.interaction.zoom = 1; s.setCam('manos') })
await shot('04-manos', 7000)
await S((s, c) => { c.interaction.zoom = 0.6 })
await shot('05-manos-cerca', 5000)
await S((s, c) => { c.interaction.zoom = 1; s.setCam('cuerpo') })
await shot('06-cuerpo', 6000)
await S((s, c) => { c.interaction.dollRotY = -0.5 })
await shot('07-cuerpo-tres-cuartos', 5000)
// clavículas y escote: vestido palabra de honor
await S((s, c) => { c.interaction.dollRotY = 0; s.setCam('cara'); c.interaction.zoom = 1.6 })
await shot('08-busto', 6000)
await S((s, c) => { c.interaction.zoom = 1 })
for (const d of ['nayra', 'vega', 'alba']) {
  await S((s, c, d) => s.setDoll(d), d)
  await shot(`09-cara-${d}`, 8000)
}
await browser.close()
if (errors.length) console.log('ERRORES', errors)

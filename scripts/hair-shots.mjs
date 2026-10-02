// Capturas del pelo (tarea 2): node scripts/hair-shots.mjs <carpeta> <peinado,peinado,…> [movimiento]
// Necesita `npx vite preview --port 4173` en marcha.
import { chromium } from 'playwright'
import fs from 'node:fs'

const [, , out = 'docs/screenshots/pelo/antes', list = 'mono-bajo', motion] = process.argv
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
const W = (ms) => page.waitForTimeout(ms)
const S = (fn, arg) => page.evaluate(`(() => { const c = window.__clara; const s = c.store.getState(); (${fn})(s, c, ${JSON.stringify(arg ?? null)}) })()`)

await page.goto(base + '?q=alta&dpr=1')
await page.getByTestId('start').click()
await page.waitForSelector('[data-screen="home"]', { timeout: 120000 })
await S((s) => { s.finishOnboarding(); s.go('studio') })
await W(6000)
await page.addStyleTag({ content: '.ui-layer,.topbar,.toasts{display:none!important}' })

for (const id of list.split(',')) {
  await S((s, c, id) => s.setLook((l) => ({ ...l, hair: { ...l.hair, styleId: id } })), id)
  const views = [
    ['frente', 'cara', 0],
    ['tres-cuartos', 'cara', -0.8],
    ['espalda', 'cuerpo', Math.PI],
  ]
  // vista de la nuca de cerca (moños, trenzas y flores), si se pide con NUCA=1
  if (process.env.NUCA) views.push(['nuca', 'cara', 2.5])
  for (const [name, cam, rot] of views) {
    await S((s, c, a) => { c.interaction.dollRotY = a[1]; s.setCam(a[0]) }, [cam, rot])
    await W(5000)
    await page.screenshot({ path: `${out}/${id}-${name}.png` })
    console.log('ok', id, name)
  }
  if (motion) {
    // giro rápido: la captura sale a mitad del giro, con el pelo reaccionando
    await S((s, c) => { c.interaction.dollRotY = 0; s.setCam('cuerpo') })
    await W(4000)
    await S((s, c) => { c.interaction.dollRotY = 2.2 })
    await W(260)
    await page.screenshot({ path: `${out}/${id}-giro.png` })
    console.log('ok', id, 'giro')
  }
}
await browser.close()
if (errors.length) {
  console.log('ERRORES', errors)
  process.exit(1)
}

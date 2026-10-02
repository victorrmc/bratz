// Capturas para la revisión visual: node scripts/screenshots.mjs <ronda> [filtro]
import { chromium } from 'playwright'
import fs from 'node:fs'

const round = process.argv[2] ?? 'r1'
const only = process.argv[3]
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const out = `docs/screenshots/${round}`
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

const W = (ms) => page.waitForTimeout(ms)
const S = (fn, arg) => page.evaluate(`(() => { const c = window.__clara; const s = c.store.getState(); (${fn})(s, c, ${JSON.stringify(arg ?? null)}) })()`)
const shot = async (name, wait = 7000) => {
  if (only && !name.includes(only)) return
  await W(wait)
  await page.screenshot({ path: `${out}/${name}.png` })
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
await shot('00-portada-2d', 1500)
await page.getByTestId('start').click()
await page.waitForSelector('[data-screen="home"]', { timeout: 120000 })
await shot('01-inicio', 9000)
await S((s) => { s.finishOnboarding(); s.go('studio') })
await shot('02-estudio')
// muñeca: frente, perfil, espalda y primer plano
await hideUI(true)
await S((s, c) => { c.interaction.dollRotY = 0 })
await shot('03-muneca-frente', 5000)
await S((s, c) => { c.interaction.dollRotY = -Math.PI / 2 })
await shot('04-muneca-perfil', 5000)
await S((s, c) => { c.interaction.dollRotY = Math.PI })
await shot('05-muneca-espalda', 5000)
await S((s, c) => { c.interaction.dollRotY = 0; s.setCam('cara') })
await shot('06-muneca-cara', 6000)
await S((s) => s.setCam('manos'))
await shot('07-muneca-manos', 6000)
await S((s) => s.setCam('pies'))
await shot('08-muneca-pies', 6000)
await S((s) => s.setCam('cuerpo'))
await hideUI(false)
for (const d of ['nayra', 'vega', 'alba']) {
  await S((s, c, d) => s.setDoll(d), d)
  await shot(`09-muneca-${d}`, 8000)
}
await S((s) => s.setDoll('clara'))
await S((s) => s.setTab('pelo'))
await shot('10-estudio-pelo', 5000)
await S((s) => s.setTab('maquillaje'))
await shot('11-estudio-maquillaje', 5000)
await S((s) => s.setTab('unas'))
await shot('12-estudio-unas', 5000)
await S((s) => { s.setTab('ropa'); s.go('challenges') })
await shot('13-retos', 6000)
await S((s) => s.startChallenge('reto-disco'))
await shot('14-reto', 6000)
await S((s) => s.submitChallenge())
await shot('15-jurado', 9000)
await S((s) => s.go('photo'))
for (const st of ['disco', 'mall', 'beach', 'redcarpet', 'room', 'ibiza', 'casa']) {
  await S((s, c, st) => s.setStage(st), st)
  await shot(`16-foto-${st}`, 8000)
}
await S((s) => s.go('runway'))
await shot('17-pasarela', 9000)
await S((s) => { s.saveLook('Atardecer en Ibiza'); s.go('wardrobe') })
await shot('18-armario', 5000)
await S((s) => s.go('shop'))
await shot('19-tienda', 6000)
await S((s) => { s.debugUnlockAll(); s.go('ending') })
await shot('20-final-pasarela', 9000)
await S((s) => s.go('letter'))
await shot('21-carta', 9000)
await browser.close()
if (errors.length) console.log('ERRORES', errors)

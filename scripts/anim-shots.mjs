// Capturas de la tarea de animación (antes/después).
// Uso: node scripts/anim-shots.mjs <prefijo> [lista de expresiones separadas por comas]
// Requiere el servidor de vista previa: npx vite preview --port 4173
import { chromium } from 'playwright'
import fs from 'node:fs'

const [, , prefix = 'despues', exprList = 'sonrisa,guino,seria,dientes,sorpresa,risa'] = process.argv
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const dir = 'docs/screenshots/animacion'
fs.mkdirSync(dir, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
const st = (fn) => page.evaluate(`(() => { const s = window.__clara.store.getState(); return (${fn})(s) })()`)
const shot = (name) => page.screenshot({ path: `${dir}/${prefix}-${name}.png` })

await page.goto(base + '?q=baja')
await page.evaluate(() => localStorage.clear())
await page.goto(base + '?q=baja')
await page.getByTestId('start').click()
await page.locator('[data-screen="home"]').waitFor({ timeout: 90_000 })
await st('s => s.finishOnboarding()')

// Expresiones (cámara de cara)
await st("s => s.go('studio')")
await page.waitForTimeout(1500)
await st("s => s.setCam('cara')")
for (const e of exprList.split(',')) {
  await st(`s => s.setExpression('${e}')`)
  await page.waitForTimeout(e === 'risa' ? 900 : 1500)
  await shot(`cara-${e}`)
}
await st("s => s.setExpression('sonrisa')")

// Transición entre poses: secuencia de fotogramas
await st("s => s.setCam('cuerpo')")
await page.waitForTimeout(1500)
await st("s => s.setPose('wave')")
for (const [i, ms] of [[1, 60], [2, 180], [3, 400], [4, 900]]) {
  await page.waitForTimeout(ms - (i > 1 ? [0, 60, 180, 400][i - 1] : 0))
  await shot(`transicion-${i}`)
}

// Pasarela
await st("s => s.go('runway')")
for (const [i, ms] of [2500, 2000, 2500, 3500, 2500].entries()) {
  await page.waitForTimeout(ms)
  await shot(`pasarela-${i + 1}`)
}

// Jurado: reacción
await st("s => s.go('challenges')")
await page.waitForTimeout(800)
await st("s => s.startChallenge('reto-disco')")
await page.waitForTimeout(800)
await st('s => s.submitChallenge()')
for (const ms of [300, 500, 700, 1500]) {
  await page.waitForTimeout(ms)
  await shot(`jurado-${ms}`)
}
if (errs.length) console.log('ERRORES:\n' + errs.join('\n'))
await browser.close()

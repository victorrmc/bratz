// Capturas de la tarea 8 (miniaturas, filtros, transiciones).
// Uso: node scripts/shots-t8.mjs <prefijo>   (con `npx vite preview --port 4173` en marcha)
import { chromium } from 'playwright'
const prefix = process.argv[2] ?? 'despues'
const dir = 'docs/screenshots/t8-miniaturas'
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })
const errs = []
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
const q = '?q=media'
await page.goto(base + q)
await page.evaluate(() => localStorage.clear())
await page.goto(base + q)
await page.getByTestId('start').click()
await page.locator('[data-screen="home"]').waitFor({ timeout: 90_000 })
await page.evaluate(() => window.__clara.store.getState().finishOnboarding())
await page.getByTestId('menu-studio').click()
await page.getByTestId('editor-sheet').waitFor()
const settle = async (ms = 6000) => {
  if (prefix === 'antes') ms = 1500
  // espera a que las miniaturas de lo visible estén listas (si existen)
  await page.waitForFunction(() => document.querySelectorAll('.card .glyph:not(img)').length === 0, null, { timeout: ms }).catch(() => {})
  // baja la lista hasta la cuadrícula (el editor de la prenda puesta va encima)
  await page.evaluate(() => {
    const g = document.querySelector('.sheet .grid')
    if (g && g.parentElement) g.parentElement.scrollTop = g.offsetTop - 6
  })
  await page.waitForTimeout(800)
}
await settle(120_000)
await page.screenshot({ path: `${dir}/${prefix}-01-vestidor-tops.png` })
for (const [cat, n] of [['dresses', '02-vestidos'], ['shoes', '03-calzado'], ['bags', '04-bolsos'], ['jewelry', '05-joyas'], ['hats', '06-gorros']]) {
  await page.getByTestId(`cat-${cat}`).click()
  await settle(120_000)
  await page.screenshot({ path: `${dir}/${prefix}-${n}.png` })
}
// microinteracción al equiparse
await page.getByTestId('cat-tops').click()
await settle(60_000)
await page.evaluate(() => {
  const c = document.querySelector('[data-testid="item-top-corazon"]')
  c?.scrollIntoView({ block: 'center' })
})
await page.getByTestId('item-top-corazon').click()
// congela la animación a mitad para poder verla en la captura
await page.evaluate(() => document.getAnimations().forEach((a) => ((a.currentTime = 200), a.pause())))
await page.screenshot({ path: `${dir}/${prefix}-07-equipar.png` })
await page.waitForTimeout(1200)
// buscador y filtros
if (await page.getByTestId('search-toggle').count()) {
  await page.getByTestId('search-toggle').click()
  await page.getByTestId('search').fill('ibiza')
  await page.waitForTimeout(300)
  await settle(60_000)
  await page.screenshot({ path: `${dir}/${prefix}-08-buscar.png` })
  await page.getByTestId('search-close').click()
  await page.getByTestId('cat-dresses').click()
  await page.getByTestId('filters-toggle').click()
  await page.getByTestId('filter-tag-glam').click()
  await page.getByTestId('filter-color-rosa').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${dir}/${prefix}-09-filtros.png` })
  await page.getByTestId('filters-toggle').click()
  await settle(60_000)
  await page.screenshot({ path: `${dir}/${prefix}-09b-filtrado.png` })
  await page.getByTestId('filters-clear').click()
}
// transición entre pantallas: captura a mitad
// transición: se lanza y se congela en el mismo instante (el render por software es lento)
await page.evaluate(async () => {
  window.__clara.store.getState().go('home')
  const g = document.querySelector('.screen-ghost')
  if (g) {
    const f = g.cloneNode(true)
    f.style.animation = 'none'
    f.style.opacity = '0.5'
    f.style.transform = 'translate3d(22px,0,0) scale(0.993)'
    f.classList.add('congelada')
    document.body.appendChild(f)
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  document.getAnimations().forEach((a) => ((a.currentTime = 150), a.pause()))
})
await page.screenshot({ path: `${dir}/${prefix}-10-transicion.png` })
await page.evaluate(() => document.querySelectorAll('.screen-ghost').forEach((g) => g.remove()))
await page.evaluate(() => document.getAnimations().forEach((a) => a.play()))
await page.waitForTimeout(1500)
await page.screenshot({ path: `${dir}/${prefix}-11-portada-tras-transicion.png` })
// tienda
await page.evaluate(() => window.__clara.store.getState().go('shop'))
await page.waitForTimeout(500)
await settle(120_000)
await page.screenshot({ path: `${dir}/${prefix}-12-tienda.png` })
console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'sin errores de consola')
await browser.close()

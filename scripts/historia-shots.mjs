// Capturas del modo historia. Uso: node scripts/historia-shots.mjs antes|despues (con `npx vite preview --port 4173` en marcha)
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'despues'
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const dir = 'docs/screenshots/historia'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
const shot = async (name, wait = 1500) => {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${dir}/${tag}-${name}.png` })
}
const store = (fn) => page.evaluate(`(() => { const s = window.__clara.store.getState(); return (${fn})(s) })()`)

await page.goto(`${base}?q=baja`)
await page.evaluate(() => localStorage.clear())
await page.goto(`${base}?q=baja`)
await page.getByTestId('start').click()
await page.locator('[data-screen="home"]').waitFor({ timeout: 90_000 })
await store('s => s.finishOnboarding()')
await shot('1-portada', 3000)

if (tag === 'despues') {
  await page.getByTestId('menu-story').click()
  await shot('2-capitulos')
  await page.getByTestId('chapter-1').click()
  await shot('3-vineta-entrada', 2500)
  await page.getByTestId('vignette-next').click()
  await page.getByTestId('editor-sheet').waitFor()
  await page.getByTestId('chapter-autodress').click()
  await shot('4-reto')
  await page.getByTestId('submit-chapter').click()
  await page.getByTestId('jury').waitFor()
  await shot('5-jurado', 3500)
  await page.getByTestId('jury-continue').click()
  await page.getByTestId('memory-photo').waitFor({ timeout: 60_000 })
  await shot('6-recuerdo', 2500)
  await page.getByTestId('memory-continue').click()
  await shot('7-vineta-cierre', 2500)
  // capítulos 2–4 deprisa para llegar a Dalt Vila
  await page.getByTestId('vignette-next').click()
  for (const n of [2, 3]) {
    await page.getByTestId(`chapter-${n}`).click()
    await page.getByTestId('vignette-next').click()
    await page.getByTestId('chapter-autodress').click()
    await page.getByTestId('submit-chapter').click()
    await page.getByTestId('jury-continue').click()
    await page.getByTestId('memory-continue').click({ timeout: 60_000 })
    await page.getByTestId('vignette-next').click()
  }
  await page.getByTestId('chapter-4').click()
  await shot('8-dalt-vila', 4000)
  await page.getByTestId('back').click()
  await page.getByTestId('back').click()
  await shot('9-portada-progreso', 2500)
  await page.getByTestId('menu-memories').click()
  await shot('10-album', 2500)
}
await browser.close()

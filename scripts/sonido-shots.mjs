// Capturas de la tarea de sonido. Uso: node scripts/sonido-shots.mjs <prefijo>  (con vite preview en :4173)
import { chromium } from 'playwright'
const prefix = process.argv[2] ?? 'despues'
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const dir = 'docs/screenshots/sonido/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('console', (m) => m.type() === 'error' && console.log('error:', m.text()))
await page.goto(base + '?q=baja')
await page.evaluate(() => localStorage.clear())
await page.goto(base + '?q=baja')
await page.getByTestId('start').click()
await page.locator('[data-screen="home"]').waitFor({ timeout: 90000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: dir + prefix + '-1-portada.png' })
await page.evaluate(() => window.__clara.store.getState().finishOnboarding())
await page.getByTestId('menu-studio').click()
await page.waitForTimeout(2500)
await page.screenshot({ path: dir + prefix + '-2-estudio.png' })
if (await page.getByTestId('settings-open').count()) {
  await page.getByTestId('settings-open').first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: dir + prefix + '-3-ajustes.png' })
}
await browser.close()

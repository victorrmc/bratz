// Capturas de la tarea PWA. Uso: node scripts/pwa-shots.mjs antes|despues (con `npm run preview` en marcha)
import fs from 'node:fs'
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'despues'
const base = process.env.URL ?? 'http://localhost:4173/bratz/'
const dir = 'docs/screenshots/pwa'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const vp = { viewport: { width: 390, height: 844 }, hasTouch: true }

// 1) Pantalla de arranque: lo que se ve mientras llega el JavaScript (red lenta).
{
  const ctx = await browser.newContext(vp)
  const page = await ctx.newPage()
  await page.route('**/assets/*.js', () => {}) // el JS no llega nunca
  await page.goto(base, { waitUntil: 'commit' })
  await page.waitForTimeout(1500)
  // captura por CDP: la de Playwright espera a las fuentes y la página nunca termina de cargar
  const cdp = await ctx.newCDPSession(page)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(`${dir}/${tag}-1-arranque.png`, Buffer.from(data, 'base64'))
  await ctx.close()
}

// 2) Sin conexión: primera visita con red, luego se corta y se recarga.
{
  const ctx = await browser.newContext(vp)
  const page = await ctx.newPage()
  await page.goto(base)
  await page.waitForTimeout(1500)
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return
    await navigator.serviceWorker.ready
    const ready = async () => navigator.serviceWorker.controller && (await caches.match(new URL('index.html', location.href).href))
    for (let i = 0; i < 100 && !(await ready()); i++) await new Promise((r) => setTimeout(r, 100))
  })
  await ctx.setOffline(true)
  await page.reload().catch((e) => console.log('sin conexión no carga:', e.message.split('\n')[0]))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${dir}/${tag}-2-sin-conexion.png` })
  const start = page.getByTestId('start')
  if (await start.isVisible().catch(() => false)) {
    await start.click()
    await page.locator('[data-screen="home"]').waitFor({ timeout: 120_000 })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${dir}/${tag}-3-sin-conexion-3d.png` })
  }
  await ctx.close()
}
await browser.close()

import type { Page } from '@playwright/test'
import { expect, start, test } from './fixtures'

/** Espera a que el service worker controle la página y tenga la portada guardada en caché. */
async function waitForServiceWorker(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const index = await caches.match(new URL('index.html', location.href).href)
          return Boolean(navigator.serviceWorker.controller && index)
        }),
      { timeout: 60_000 },
    )
    .toBe(true)
}

test('manifest válido con iconos propios y la app es instalable', async ({ page, errors }) => {
  void errors
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const url = new URL(href!, page.url()).href
  const manifest = await (await page.request.get(url)).json()
  expect(manifest.name).toBe('Rumbo a Ibiza')
  expect(manifest.lang).toBe('es')
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('./')
  for (const size of ['192x192', '512x512']) expect(manifest.icons.some((i: { sizes: string }) => i.sizes === size)).toBe(true)
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, url).href)
    expect(res.ok(), icon.src).toBe(true)
    expect(res.headers()['content-type']).toContain('image/')
  }
  await waitForServiceWorker(page)
  // Chrome confirma que cumple los requisitos para instalarse
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  expect(installabilityErrors).toEqual([])
})

test('pantalla de arranque visible antes de que cargue el JavaScript', async ({ page }) => {
  await page.route('**/assets/*.js', () => {}) // el JS no llega
  await page.goto('./', { waitUntil: 'commit' })
  await expect(page.locator('#arranque')).toBeVisible()
  await expect(page.locator('#arranque')).toContainText('Rumbo a Ibiza')
})

test('funciona sin conexión: portada, motor 3D y estudio', async ({ page, context, errors }) => {
  void errors
  await page.goto('./?q=baja')
  await waitForServiceWorker(page)
  await context.setOffline(true)
  await page.reload()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await start(page)
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { finishOnboarding: () => void } } } }).__clara.store.getState().finishOnboarding())
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  await context.setOffline(false)
})

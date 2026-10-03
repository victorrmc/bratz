import type { Page } from '@playwright/test'
import { expect, openFresh, skipOnboarding, state, test } from './fixtures'

// Tarea 2: pelo de nueva generación (peinados nuevos y física secundaria).

const NEW_STYLES = ['boda-ibicenca', 'trenza-espiga', 'mono-despeinado', 'coleta-burbujas']

interface HairStats {
  chains: number
  swing: number
  frames: number
}

const stats = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __claraHair: HairStats }).__claraHair }))

/**
 * Cuánto oscila el pelo durante `ms` milisegundos (máximo − mínimo del
 * ángulo respecto al reposo; la gravedad sola da un ángulo fijo, no oscila).
 */
const swingRange = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<number>((resolve) => {
        const h = (window as unknown as { __claraHair: HairStats }).__claraHair
        let max = -Infinity
        let min = Infinity
        const t0 = performance.now()
        const tick = () => {
          max = Math.max(max, h.swing)
          min = Math.min(min, h.swing)
          if (performance.now() - t0 < ms) requestAnimationFrame(tick)
          else resolve(max - min)
        }
        tick()
      }),
    ms,
  )

const setRot = (page: Page, a: number) => page.evaluate((a) => ((window as unknown as { __clara: { interaction: { dollRotY: number } } }).__clara.interaction.dollRotY = a), a)

async function openHairTab(page: Page) {
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  await page.getByTestId('tab-pelo').click()
}

test('los cuatro peinados nuevos se pueden elegir y el recogido de boda lleva física', async ({ page, errors }) => {
  void errors
  await openHairTab(page)
  for (const id of NEW_STYLES) {
    const card = page.getByTestId(`hair-${id}`)
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(await state<string>(page, 's => s.look.hair.styleId')).toBe(id)
  }
  await expect(page.getByTestId('hair-boda-ibicenca')).toHaveText('Recogido de boda ibicenca')
  // el recogido de boda: moño suelto con muelle y tres mechones colgantes
  await page.getByTestId('hair-boda-ibicenca').click()
  await expect.poll(async () => (await stats(page)).chains).toBe(4)
  // la coleta de burbujas es una sola cadena
  await page.getByTestId('hair-coleta-burbujas').click()
  await expect.poll(async () => (await stats(page)).chains).toBe(1)
})

test('la coleta se balancea al girar a la muñeca y vuelve a su sitio', async ({ page, errors }) => {
  void errors
  await openHairTab(page)
  await page.getByTestId('hair-coleta-alta').click()
  await expect.poll(async () => (await stats(page)).chains).toBe(1)
  // en reposo apenas oscila (solo la brisa). En máquinas lentas el muelle
  // tarda más en asentarse tras el cambio de peinado: se espera a que lo haga.
  let calm = Infinity
  await expect
    .poll(async () => (calm = await swingRange(page, 1500)), { timeout: 30_000, intervals: [0] })
    .toBeLessThan(0.1)
  // giro rápido: la coleta se queda atrás y rebota
  await setRot(page, 3)
  const spun = await swingRange(page, 2500)
  expect(spun).toBeGreaterThan(calm + 0.05)
  // y se asienta otra vez
  await expect
    .poll(() => swingRange(page, 1500), { timeout: 30_000, intervals: [0] })
    .toBeLessThan(spun / 2)
})

test('las trenzas se mueven al caminar por la pasarela', async ({ page, errors }) => {
  void errors
  await openHairTab(page)
  await page.getByTestId('hair-trenzas').click()
  await expect.poll(async () => (await stats(page)).chains).toBe(2)
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { go: (s: string) => void } } } }).__clara.store.getState().go('runway'))
  await expect(page.locator('[data-screen="runway"]')).toBeVisible()
  const before = (await stats(page)).frames
  await expect.poll(async () => (await stats(page)).frames, { timeout: 30_000 }).toBeGreaterThan(before + 10)
  expect(await swingRange(page, 3000)).toBeGreaterThan(0.01)
})

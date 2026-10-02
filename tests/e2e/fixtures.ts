import { test as base, expect, type Page } from '@playwright/test'

// Recoge errores de consola y de página: el recorrido debe tener cero.
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await use(errors)
    expect(errors, 'errores en consola').toEqual([])
  },
})

export { expect }

/** Abre el juego con una partida nueva (calidad baja para que el render por software vaya fluido). */
export async function openFresh(page: Page, query = 'q=baja') {
  await page.goto(`./?${query}`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`./?${query}`)
  await start(page)
}

/** Pulsa «Toca para empezar» y espera a la portada 3D. */
export async function start(page: Page) {
  await page.getByTestId('start').click()
  await expect(page.locator('[data-screen="home"]')).toBeVisible({ timeout: 90_000 })
}

export async function coins(page: Page): Promise<number> {
  const txt = await page.getByTestId('coins').first().innerText()
  return Number(txt.replace(/\D/g, ''))
}

export async function state<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const s = window.__clara.store.getState(); return (${fn})(s) })()`) as Promise<T>
}

export async function skipOnboarding(page: Page) {
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { finishOnboarding: () => void } } } }).__clara.store.getState().finishOnboarding())
}

export async function back(page: Page) {
  await page.getByTestId('back').click()
}

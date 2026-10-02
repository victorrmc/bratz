import type { Page } from '@playwright/test'
import { expect, openFresh, skipOnboarding, state, test } from './fixtures'

// Banda sonora y sonido: pistas por escenario, pasarela adaptativa, efectos nuevos,
// volúmenes separados y vibración sincronizada.

type AudioDebug = { engine: { currentTrack: string | null; intensity: number; walking: boolean; footwear: string; log: { name: string }[] } }

async function audioState<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const a = window.__claraAudio; return (${fn})(a) })()`) as Promise<T>
}

const sfxNames = (page: Page) => audioState<string[]>(page, '(a) => a.engine.log.map((l) => l.name)')
const clearLog = (page: Page) => audioState<void>(page, '(a) => { a.engine.log.length = 0 }')
const vibes = (page: Page) => page.evaluate(() => (window as unknown as { __vibes: unknown[] }).__vibes)

test.beforeEach(async ({ page }) => {
  // navigator.vibrate falso que apunta los patrones (los navegadores de escritorio no vibran)
  await page.addInitScript(() => {
    const w = window as unknown as { __vibes: unknown[] }
    w.__vibes = []
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: (p: unknown) => {
        w.__vibes.push(p)
        return true
      },
    })
  })
})

test('panel de ajustes: volúmenes separados, silencio y vibración que se guardan', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await page.getByTestId('settings-open').click()
  const panel = page.getByTestId('settings-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Música', { exact: true })).toBeVisible()
  await expect(panel.getByText('Efectos', { exact: true })).toBeVisible()
  await page.getByTestId('vol-music').fill('0.3')
  await page.getByTestId('vol-sfx').fill('0.55')
  await expect(page.getByTestId('vol-music-value')).toHaveText('30 %')
  await expect(page.getByTestId('vol-sfx-value')).toHaveText('55 %')
  await page.getByTestId('settings-vibration').click()
  await expect(page.getByTestId('settings-vibration')).toHaveAttribute('aria-checked', 'false')
  await page.getByTestId('settings-mute').click()
  expect(await state<boolean>(page, 's => s.save.settings.muted')).toBe(true)
  await page.getByTestId('settings-mute').click()
  expect(await state<boolean>(page, 's => s.save.settings.muted')).toBe(false)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('clara-ibiza-audio') ?? '{}'))
  expect(stored).toEqual({ music: 0.3, sfx: 0.55, vibration: false })
  // sin vibración, los efectos no vibran
  await page.evaluate(() => ((window as unknown as { __vibes: unknown[] }).__vibes.length = 0))
  await page.getByTestId('settings-test').click()
  await expect.poll(() => sfxNames(page)).toContain('applause')
  expect(await vibes(page)).toEqual([])
  await page.getByTestId('settings-close').click()
  await expect(panel).toBeHidden()
  // se conserva al recargar
  await page.reload()
  await page.getByTestId('start').click()
  await expect(page.locator('[data-screen="home"]')).toBeVisible({ timeout: 90_000 })
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('vol-music-value')).toHaveText('30 %')
  await expect(page.getByTestId('vol-sfx-value')).toHaveText('55 %')
  await expect(page.getByTestId('settings-vibration')).toHaveAttribute('aria-checked', 'false')
})

test('pista por escenario: balear en Ibiza, house en la discoteca y guitarra en casa', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  expect(await audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('menu')
  await page.getByTestId('menu-photo').click()
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('disco')
  await page.getByTestId('photo-tab-escenario').click()
  await page.getByTestId('stage-ibiza').click()
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('ibiza')
  await page.getByTestId('stage-mall').click()
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('menu')
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { setStage: (s: string) => void } } } }).__clara.store.getState().setStage('casa'))
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('casa')
  await page.getByTestId('back').click()
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('menu')
})

test('efectos de prendas con su vibración: tela, cremallera, tacones y joyas', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  const cases: [string, string, string, number[]][] = [
    ['tops', 'top-babytee', 'fabric', [5, 25, 7, 25, 5]],
    ['jackets', 'jk-biker', 'zipper', [4, 14, 4, 14, 4, 14, 4, 14, 4, 14, 4]],
    ['shoes', 'sh-chunky', 'step', [10]],
    ['shoes', 'sh-plataforma', 'heel', [22]],
    ['jewelry', 'ear-estrella', 'jewel', [4, 45, 4]],
  ]
  for (const [cat, id, sfx, pattern] of cases) {
    await page.getByTestId(`cat-${cat}`).click()
    await clearLog(page)
    await page.evaluate(() => ((window as unknown as { __vibes: unknown[] }).__vibes.length = 0))
    await page.getByTestId(`item-${id}`).click()
    await expect.poll(() => sfxNames(page)).toContain(sfx)
    await expect.poll(() => vibes(page)).toContainEqual(pattern)
  }
  expect(await audioState<string>(page, '(a) => a.engine.footwear')).toBe('tacon')
})

test('pasarela adaptativa con tacones a tempo y aplausos del jurado', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-runway').click()
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('runway')
  const start = await audioState<number>(page, '(a) => a.engine.intensity')
  expect(start).toBeLessThan(1.5)
  expect(await audioState<boolean>(page, '(a) => a.engine.walking')).toBe(true)
  await clearLog(page)
  await page.waitForTimeout(4000)
  const steps = (await sfxNames(page)).filter((n) => n === 'heel').length
  // 1,9 pasos por segundo como máximo (el render por software puede atascar el hilo)
  expect(steps).toBeGreaterThanOrEqual(2)
  expect(steps).toBeLessThanOrEqual(10)
  // la música crece durante la ida
  await audioState<void>(page, '(a) => { a.runwayClock.t = 7 }')
  await expect.poll(() => audioState<number>(page, '(a) => a.engine.intensity')).toBeGreaterThan(start + 0.8)
  // al llegar al final de la pasarela: clímax y aplausos
  await audioState<void>(page, '(a) => { a.runwayClock.t = 8.85 }')
  await expect.poll(() => audioState<number>(page, '(a) => a.engine.intensity')).toBe(3)
  await expect.poll(() => sfxNames(page)).toContain('applause')
  expect(await audioState<boolean>(page, '(a) => a.engine.walking')).toBe(false)
  // jurado
  await page.getByTestId('back').click()
  await page.getByTestId('menu-challenges').click()
  await page.getByTestId('challenge-reto-playa').click()
  await page.getByTestId('start-challenge').click()
  await expect.poll(() => audioState<string>(page, '(a) => a.engine.currentTrack')).toBe('ibiza')
  await clearLog(page)
  await page.getByTestId('submit-challenge').click()
  await expect(page.getByTestId('jury')).toBeVisible()
  await expect.poll(() => sfxNames(page)).toContain('applause')
})

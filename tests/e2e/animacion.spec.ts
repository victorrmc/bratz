import type { Page } from '@playwright/test'
import { expect, openFresh, skipOnboarding, test } from './fixtures'

// Tarea 3: transiciones, pasarela con pies plantados, IK de pies, expresiones y reacciones.

interface RigInfo {
  expr: string
  reacting: string | null
  stats: { minClearance: number; maxSlip: number; maxLift: number; claps: number; transitions: number; mouthFrames: number; reaction: string }
  rotY: number
}

const rig = (page: Page) =>
  page.evaluate(() => {
    const r = (window as unknown as { __clara: { interaction: { rig: any } } }).__clara.interaction.rig
    return { expr: r.visibleExpression, reacting: r.reacting, stats: { ...r.stats }, rotY: r.root.parent?.rotation.y ?? 0 } as RigInfo
  })
const resetStats = (page: Page) => page.evaluate(() => (window as unknown as { __clara: { interaction: { rig: { resetStats: () => void } } } }).__clara.interaction.rig.resetStats())
const store = (page: Page, fn: string) => page.evaluate(`(() => { const s = window.__clara.store.getState(); return (${fn})(s) })()`)

test('expresiones nuevas animadas: dientes, risa y sorpresa', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  const btn = page.getByTestId('expression')
  await btn.click()
  await expect(btn).toHaveAttribute('aria-label', /Sonrisa con dientes/)
  await expect.poll(async () => (await rig(page)).expr).toBe('dientes')
  await btn.click()
  await expect.poll(async () => (await rig(page)).expr).toBe('risa')
  // la boca de la risa se abre y se cierra
  await expect.poll(async () => (await rig(page)).stats.mouthFrames, { timeout: 60_000 }).toBeGreaterThan(1)
  await btn.click()
  await btn.click()
  await expect.poll(async () => (await rig(page)).expr).toBe('sorpresa')
  await btn.click()
  await btn.click()
  await expect.poll(async () => (await rig(page)).expr).toBe('sonrisa')
})

test('transiciones entre poses sin que los pies atraviesen el suelo', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  await resetStats(page)
  for (const p of ['star', 'cross', 'wave']) {
    await store(page, `s => s.setPose('${p}')`)
    await page.waitForTimeout(700)
  }
  const info = await rig(page)
  expect(info.stats.transitions).toBe(3)
  expect(info.stats.minClearance).toBeGreaterThan(-0.003)
})

test('pasarela: pies plantados, sin atravesar el suelo y giro final', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await store(page, "s => s.go('runway')")
  await expect.poll(async () => (await rig(page)).stats.minClearance, { timeout: 60_000 }).toBeLessThan(10)
  await resetStats(page)
  // durante el giro final la muñeca rota sobre sí misma (entre 0 y 2π)
  await expect
    .poll(
      async () => {
        const r = (await rig(page)).rotY
        return r > 0.4 && r < 5.9
      },
      { timeout: 200_000, intervals: [250] },
    )
    .toBe(true)
  // tras el giro adopta la pose final con transición
  await expect.poll(async () => (await rig(page)).stats.transitions, { timeout: 120_000 }).toBeGreaterThanOrEqual(1)
  const info = await rig(page)
  expect(info.stats.minClearance).toBeGreaterThan(-0.003)
  expect(info.stats.maxSlip).toBeLessThan(0.002)
})

test('el jurado provoca una reacción con aplauso y saltito', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await store(page, "s => s.startChallenge('reto-disco')")
  await expect(page.locator('[data-screen="challenge"]')).toBeVisible()
  await store(page, 's => s.submitChallenge()')
  await expect(page.getByTestId('jury')).toBeVisible()
  const stars = Number(await page.getByTestId('jury-stars').textContent())
  const kind = stars >= 5 ? 'euforia' : stars >= 4 ? 'alegria' : stars >= 3 ? 'aplauso' : 'sorpresa'
  await expect.poll(async () => (await rig(page)).stats.reaction).toBe(kind)
  if (stars >= 3) await expect.poll(async () => (await rig(page)).stats.claps, { timeout: 120_000 }).toBeGreaterThanOrEqual(2)
  if (stars >= 4) await expect.poll(async () => (await rig(page)).stats.maxLift, { timeout: 120_000 }).toBeGreaterThan(0.05)
  // al terminar vuelve a su expresión y a la pose del jurado
  await expect.poll(async () => (await rig(page)).reacting, { timeout: 180_000 }).toBeNull()
  const info = await rig(page)
  expect(info.expr).toBe('sonrisa')
  expect(info.stats.minClearance).toBeGreaterThan(-0.003)
})

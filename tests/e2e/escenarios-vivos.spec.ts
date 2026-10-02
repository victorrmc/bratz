import fs from 'node:fs'
import { expect, openFresh, skipOnboarding, state, test } from './fixtures'
import type { Page } from '@playwright/test'

// Tarea 4 · Escenarios vivos: cada escenario se mueve y existe el «Ferry a Ibiza».

/** Franja izquierda de la foto, lejos de la muñeca: solo se ve el escenario. */
async function backdropStrip(page: Page) {
  const box = (await page.locator('div[aria-hidden="true"][style*="dashed"]').boundingBox())!
  return page.screenshot({ clip: { x: box.x + 6, y: box.y + box.height * 0.2, width: Math.max(12, box.width * 0.14), height: box.height * 0.6 } })
}

async function openPhoto(page: Page) {
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-photo').click()
  await page.getByTestId('photo-tab-escenario').click()
}

test('el ferry a Ibiza aparece en la lista y saca su foto', async ({ page, errors }) => {
  void errors
  await openPhoto(page)
  const chip = page.getByTestId('stage-ferry')
  await expect(chip).toHaveText('Ferry a Ibiza')
  await chip.click()
  expect(await state<string>(page, 's => s.stage')).toBe('ferry')
  await page.waitForTimeout(2000)
  await page.getByTestId('shutter').click()
  await expect(page.getByTestId('photo-preview')).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-photo').click()])
  expect(dl.suggestedFilename()).toMatch(/^clara-ferry-\d+\.png$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(buf.length).toBeGreaterThan(20_000)
  await page.getByTestId('close-photo').click()
})

test('los escenarios están vivos: el fondo cambia con el tiempo', async ({ page, errors }) => {
  void errors
  await openPhoto(page)
  // el secreto se desbloquea para poder ver «Nuestra casa»
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { debugUnlockAll: () => void } } } }).__clara.store.getState().debugUnlockAll())
  for (const id of ['beach', 'disco', 'ibiza', 'ferry', 'casa']) {
    await page.getByTestId(`stage-${id}`).click()
    expect(await state<string>(page, 's => s.stage')).toBe(id)
    await page.waitForTimeout(2500)
    const a = await backdropStrip(page)
    await page.waitForTimeout(1800)
    const b = await backdropStrip(page)
    expect(a.equals(b), `el escenario «${id}» debería moverse`).toBe(false)
  }
})

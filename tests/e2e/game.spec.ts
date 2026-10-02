import fs from 'node:fs'
import { back, coins, expect, openFresh, skipOnboarding, start, state, test } from './fixtures'
import { CATEGORIES, ITEMS } from '../../src/data/items'
import { CHALLENGES } from '../../src/data/challenges'
import { CLOTH_COLORS } from '../../src/data/palette'

const PHOTO_STAGES = ['disco', 'mall', 'beach', 'redcarpet', 'room', 'ibiza']

test('onboarding interactivo de 3 pasos', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('onboarding-1')).toBeVisible()
  await page.getByTestId('item-top-babytee').click()
  await expect(page.getByTestId('onboarding-2')).toBeVisible()
  // girar la muñeca arrastrando sobre el lienzo 3D
  const vp = page.viewportSize()!
  const y = vp.height * 0.3
  await page.mouse.move(vp.width * 0.25, y)
  await page.mouse.down()
  await page.mouse.move(vp.width * 0.75, y, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByTestId('onboarding-3')).toBeVisible()
  await page.getByTestId('onboarding-done').click()
  await expect(page.getByTestId('onboarding-3')).toBeHidden()
  expect(await state<boolean>(page, 's => s.save.onboardingDone')).toBe(true)
})

test('cambiar prendas de cada categoría, peinado, pelo, maquillaje y uñas', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  for (const cat of CATEGORIES) {
    await page.getByTestId(`cat-${cat.id}`).click()
    const outfit = await state<Record<string, { itemId: string }>>(page, 's => s.look.outfit')
    const item = ITEMS.find((i) => i.category === cat.id && i.rarity === 'comun' && outfit[i.slot]?.itemId !== i.id)!
    const card = page.getByTestId(`item-${item.id}`)
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    const worn = await state<string | undefined>(page, `s => s.look.outfit['${item.slot}']?.itemId`)
    expect(worn).toBe(item.id)
    // recolorear la prenda si se puede
    if (item.editable) {
      const pick = CLOTH_COLORS.find((c) => c.toLowerCase() !== item.color.toLowerCase())!
      await page.getByTestId('item-editor').getByRole('radio', { name: `Color ${pick}`, exact: true }).click()
      const color = await state<string>(page, `s => s.look.outfit['${item.slot}'].color`)
      expect(color).not.toBe(item.color)
    }
  }
  // estampado
  await page.getByTestId('cat-tops').click()
  await page.getByTestId('item-top-corazon').click()
  await page.getByTestId('pattern-leopardo').click()
  expect(await state<string>(page, `s => s.look.outfit.top.pattern`)).toBe('leopardo')
  // peinado y color de pelo
  await page.getByTestId('tab-pelo').click()
  await page.getByTestId('hair-coleta-alta').click()
  await page.getByRole('radio', { name: 'Color de pelo #b18cff' }).click()
  await page.getByRole('switch', { name: 'Puntas de color' }).click()
  expect(await state<string>(page, 's => s.look.hair.styleId')).toBe('coleta-alta')
  expect(await state<string>(page, 's => s.look.hair.base')).toBe('#b18cff')
  expect(await state<boolean>(page, 's => s.look.hair.tipsOn')).toBe(true)
  // maquillaje
  await page.getByTestId('tab-maquillaje').click()
  await page.getByTestId('liner-grafico').click()
  await page.getByRole('radio', { name: 'Labios #9c2a3a' }).click()
  await page.getByTestId('lipfinish-metal').click()
  await page.getByTestId('gems-estrellas').click()
  await page.getByRole('radio', { name: 'Sombra #4fd6b8' }).click()
  const m = await state<{ liner: string; lips: string; lipFinish: string; gems: string; eyeshadow: string }>(page, 's => s.look.makeup')
  expect(m).toMatchObject({ liner: 'grafico', lips: '#9c2a3a', lipFinish: 'metal', gems: 'estrellas', eyeshadow: '#4fd6b8' })
  // uñas
  await page.getByTestId('tab-unas').click()
  await page.getByTestId('nailshape-stiletto').click()
  await page.getByRole('radio', { name: 'Esmalte #ff2d8a' }).click()
  await page.getByTestId('nailfinish-cromo').click()
  expect(await state<object>(page, 's => s.look.nails')).toEqual({ shape: 'stiletto', color: '#ff2d8a', finish: 'cromo' })
  // cámaras predefinidas
  for (const c of ['cara', 'manos', 'pies', 'cuerpo']) {
    await page.getByTestId(`cam-${c}`).click()
    expect(await state<string>(page, 's => s.cam')).toBe(c)
  }
})

test('guardar un look, recargar y comprobar que persiste', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await page.getByTestId('item-top-holo').click() // bloqueada: no se pone
  await page.getByTestId('item-top-halter').click()
  await page.getByTestId('save-look').click()
  await page.getByTestId('look-name').fill('Atardecer en Ibiza')
  await page.getByTestId('confirm-save').click()
  await expect(page.getByTestId('look-name')).toBeHidden()
  await back(page)
  await page.reload()
  await start(page)
  await page.getByTestId('menu-wardrobe').click()
  await expect(page.getByTestId('look-name-label').first()).toHaveText('Atardecer en Ibiza')
  // renombrar, duplicar y borrar
  await page.getByTestId('rename-look').first().click()
  await page.getByTestId('rename-input').fill('Noche blanca')
  await page.getByTestId('rename-input').press('Enter')
  await expect(page.getByTestId('look-name-label').first()).toHaveText('Noche blanca')
  await page.getByTestId('duplicate-look').first().click()
  await expect(page.getByTestId('look-card')).toHaveCount(2)
  await page.getByTestId('delete-look').nth(1).click()
  await page.getByTestId('confirm-delete').click()
  await expect(page.getByTestId('look-card')).toHaveCount(1)
  // ponérselo
  await page.getByTestId('wear-look').first().click()
  await expect(page.locator('[data-screen="studio"]')).toBeVisible()
  expect(await state<string>(page, 's => s.look.outfit.top.itemId')).toBe('top-halter')
})

test('foto en cada escenario con PNG descargable', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-photo').click()
  await page.getByTestId('photo-tab-pose').click()
  await page.getByTestId('pose-peace').click()
  await page.getByTestId('photo-tab-pegatinas').click()
  await page.getByTestId('sticker-heart').click()
  await page.getByTestId('photo-tab-marco').click()
  await page.getByTestId('frame-holo').click()
  await page.getByTestId('photo-tab-escenario').click()
  for (const id of PHOTO_STAGES) {
    await page.getByTestId(`stage-${id}`).click()
    await page.waitForTimeout(1500)
    await page.getByTestId('shutter').click()
    await expect(page.getByTestId('photo-preview')).toBeVisible()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-photo').click()])
    expect(dl.suggestedFilename()).toMatch(new RegExp(`^clara-${id}-\\d+\\.png$`))
    const file = await dl.path()
    const buf = fs.readFileSync(file!)
    expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(buf.length).toBeGreaterThan(20_000)
    await page.getByTestId('close-photo').click()
  }
  // el escenario secreto está bloqueado al principio
  await page.getByTestId('stage-casa').click()
  expect(await state<string>(page, 's => s.stage')).toBe('ibiza')
})

test('completar un reto: puntuación y monedas', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  const before = await coins(page)
  await page.getByTestId('menu-challenges').click()
  await page.getByTestId('challenge-reto-playa').click()
  await page.getByTestId('start-challenge').click()
  await expect(page.getByTestId('challenge-banner')).toBeVisible()
  await page.getByTestId('cat-tops').click()
  await page.getByTestId('item-top-bikini').click()
  await page.getByTestId('cat-bottoms').click()
  await page.getByTestId('item-short-denim').click()
  await page.getByTestId('cat-shoes').click()
  await page.getByTestId('item-sh-sandalias').click()
  await page.getByTestId('cat-bags').click()
  await page.getByTestId('item-bag-cesta').click()
  await page.getByTestId('cat-glasses').click()
  await page.getByTestId('item-gl-playa').click()
  await page.getByTestId('submit-challenge').click()
  await expect(page.getByTestId('jury')).toBeVisible()
  const stars = Number(await page.getByTestId('jury-stars').textContent())
  expect(stars).toBeGreaterThanOrEqual(3)
  const reward = Number((await page.getByTestId('jury-reward').innerText()).replace(/\D/g, ''))
  expect(reward).toBeGreaterThan(0)
  await expect.poll(() => coins(page)).toBe(before + reward)
  expect(await state<number>(page, "s => s.save.challengeStars['reto-playa']")).toBe(stars)
})

test('comprar en la tienda', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  const before = await coins(page)
  await page.getByTestId('menu-shop').click()
  await page.getByTestId('shop-top-crochet').getByRole('button').first().click()
  await page.getByTestId('buy-top-crochet').click()
  await expect(page.getByTestId('shop-top-crochet')).toContainText('¡Tuya!')
  await expect.poll(() => coins(page)).toBe(before - 55)
  // sin monedas suficientes no se puede comprar la más cara
  await page.getByTestId('buy-dress-gala').click()
  await expect(page.getByTestId('shop-dress-gala')).not.toContainText('¡Tuya!')
  // la prenda comprada ya se puede usar en el estudio
  await back(page)
  await page.getByTestId('menu-studio').click()
  await page.getByTestId('item-top-crochet').click()
  expect(await state<string>(page, 's => s.look.outfit.top.itemId')).toBe('top-crochet')
})

test('final secreto con el atajo del corazón y la carta', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  for (let i = 0; i < 5; i++) await page.getByTestId('secret-heart').click()
  await page.getByTestId('go-ending').click()
  await expect(page.locator('[data-screen="ending"]')).toBeVisible()
  // la pasarela especial termina sola y abre la carta
  await expect(page.getByTestId('letter')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId('letter-dates')).toHaveText(/Ibiza/)
  await expect(page.getByTestId('letter')).toContainText('Nos vamos a vivir juntos a Ibiza')
  await page.getByTestId('letter-home').click()
  await expect(page.getByTestId('menu-ending')).toBeVisible()
  // el escenario secreto queda desbloqueado
  await page.getByTestId('menu-photo').click()
  await page.getByTestId('stage-casa').click()
  expect(await state<string>(page, 's => s.stage')).toBe('casa')
  await page.getByTestId('shutter').click()
  await expect(page.getByTestId('photo-preview')).toBeVisible()
})

test('final secreto al completar todos los retos', async ({ page, errors }) => {
  void errors
  test.setTimeout(600_000)
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-challenges').click()
  for (const c of CHALLENGES) {
    await page.getByTestId(`challenge-${c.id}`).click()
    await page.getByTestId('start-challenge').click()
    await page.getByTestId('surprise').click()
    await page.getByTestId('submit-challenge').click()
    await expect(page.getByTestId('jury')).toBeVisible()
    await page.getByTestId('to-challenges').click()
  }
  expect(await state<boolean>(page, 's => s.save.endingUnlocked')).toBe(true)
  await back(page)
  await page.getByTestId('menu-ending').click()
  await page.getByTestId('skip-to-letter').click()
  await expect(page.getByTestId('letter')).toBeVisible()
  await expect(page.getByTestId('letter-dates')).toBeVisible()
})

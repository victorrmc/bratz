import { back, expect, openFresh, skipOnboarding, start, state, test } from './fixtures'
import { ITEMS } from '../../src/data/items'
import { itemColorFamily, normalize } from '../../src/game/filters'

// Tarea 8: miniaturas 3D de las prendas, transiciones, microinteracciones y filtros.

async function openStudio(page: import('@playwright/test').Page) {
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
}

const thumbsInDb = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('clara-miniaturas', 1)
        req.onsuccess = () => {
          try {
            const c = req.result.transaction('miniaturas').objectStore('miniaturas').count()
            c.onsuccess = () => resolve(c.result)
            c.onerror = () => resolve(-1)
          } catch {
            resolve(-1)
          }
        }
        req.onerror = () => resolve(-1)
      }),
  )

test('las tarjetas muestran miniaturas renderizadas de la pieza 3D y se cachean', async ({ page, errors }) => {
  void errors
  await openStudio(page)
  const card = page.getByTestId('item-top-corazon')
  const img = card.locator('img.glyph')
  await expect(img).toBeVisible({ timeout: 90_000 })
  const info = await img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight, src: el.src.slice(0, 11) }))
  expect(info.src).toBe('data:image/')
  expect(info.w).toBeGreaterThan(100)
  expect(info.h).toBe(info.w)
  // la imagen no está vacía: tiene píxeles opacos de la prenda
  const opaque = await img.evaluate((el: HTMLImageElement) => {
    const c = document.createElement('canvas')
    c.width = el.naturalWidth
    c.height = el.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(el, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++
    return n / (c.width * c.height)
  })
  expect(opaque).toBeGreaterThan(0.05)
  // todas las tarjetas visibles de la categoría acaban con miniatura
  await expect(page.locator('.sheet .card svg.glyph')).toHaveCount(0, { timeout: 120_000 })
  // al recolorear la prenda puesta, su miniatura se regenera con el color nuevo
  await card.click()
  const before = await img.getAttribute('src')
  await page.getByTestId('item-editor').getByRole('radio', { name: 'Color #7fd6ff', exact: true }).click()
  await expect.poll(() => card.locator('img.glyph').getAttribute('src'), { timeout: 60_000 }).not.toBe(before)
  // se guardan en IndexedDB propia y sobreviven a recargar
  await expect.poll(() => thumbsInDb(page), { timeout: 30_000 }).toBeGreaterThan(5)
  await page.reload()
  await start(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('item-top-babytee').locator('img.glyph')).toBeVisible({ timeout: 15_000 })
})

test('buscador y filtros por estilo y color en el vestidor', async ({ page, errors }) => {
  void errors
  await openStudio(page)
  // búsqueda en todo el vestidor, sin tildes
  await page.getByTestId('search-toggle').click()
  await expect(page.getByTestId('search')).toBeFocused()
  await page.getByTestId('search').fill('vaquéro')
  const expected = ITEMS.filter((i) => normalize(i.name).includes('vaquero'))
  await expect(page.getByTestId('filter-count')).toContainText(`${expected.length} prendas en todo el vestidor`)
  for (const i of expected) await expect(page.getByTestId(`item-${i.id}`)).toBeVisible()
  await expect(page.locator('.sheet .card')).toHaveCount(expected.length)
  // equiparse desde los resultados
  const jeans = expected.find((i) => i.rarity === 'comun')!
  await page.getByTestId(`item-${jeans.id}`).click()
  expect(await state<string | undefined>(page, `s => s.look.outfit['${jeans.slot}']?.itemId`)).toBe(jeans.id)
  // sin resultados
  await page.getByTestId('search').fill('zzz')
  await expect(page.getByTestId('filter-empty')).toBeVisible()
  await page.getByTestId('search-close').click()
  await expect(page.getByTestId('search')).toHaveCount(0)
  await expect(page.getByTestId('cat-tops')).toBeVisible()
  // filtros por estilo y color dentro de la categoría
  await page.getByTestId('cat-dresses').click()
  await page.getByTestId('filters-toggle').click()
  await page.getByTestId('filter-tag-glam').click()
  await expect(page.getByTestId('filter-tag-glam')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('filter-color-rojo').click()
  const want = ITEMS.filter((i) => i.category === 'dresses' && i.tags.includes('glam') && itemColorFamily(i) === 'rojo')
  expect(want.length).toBeGreaterThan(0)
  await expect(page.locator('.sheet .card')).toHaveCount(want.length)
  for (const i of want) await expect(page.getByTestId(`item-${i.id}`)).toBeVisible()
  await expect(page.getByTestId('filters-toggle')).toContainText('2')
  await page.getByTestId('filters-clear').click()
  await expect(page.locator('.sheet .card')).toHaveCount(ITEMS.filter((i) => i.category === 'dresses').length)
})

test('microinteracción al ponerse una prenda', async ({ page, errors }) => {
  void errors
  await openStudio(page)
  const card = page.getByTestId('item-top-palabra')
  await card.click()
  await expect(card.getByTestId('equip-burst')).toBeAttached()
  await expect(card.locator('.worn-tick')).toBeVisible()
  await expect(card).toHaveClass(/fx-on/)
  // la tarjeta tocada no salta aunque aparezca el editor encima
  await expect(card).toBeInViewport()
  // y la animación se limpia sola
  await expect(card.getByTestId('equip-burst')).toHaveCount(0, { timeout: 5_000 })
  await expect(card).not.toHaveClass(/fx-on/)
  // la categoría marca que hay algo puesto
  await expect(page.getByTestId('cat-tops').locator('.worn-dot')).toBeVisible()
  // quitarla
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await expect(card.locator('.worn-tick')).toHaveCount(0)
})

test('transiciones entre pantallas sin interfaz fantasma', async ({ page, errors }) => {
  void errors
  await openStudio(page)
  await back(page)
  // la pantalla nueva está montada al instante; lo que sale es una copia inerte
  await expect(page.locator('[data-screen="home"]')).toBeAttached()
  const ghosts = page.locator('.screen-ghost')
  if (await ghosts.count()) {
    const g = ghosts.first()
    await expect(g).toHaveAttribute('aria-hidden', 'true')
    expect(await g.locator('[data-testid]').count()).toBe(0)
    expect(await g.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
  }
  // y desaparece sola
  await expect(ghosts).toHaveCount(0, { timeout: 3_000 })
  // muchos cambios seguidos: ni copias acumuladas ni pantallas duplicadas
  await page.evaluate(() => {
    const s = (window as unknown as { __clara: { store: { getState: () => { go: (x: string) => void } } } }).__clara.store.getState()
    for (const x of ['studio', 'home', 'shop', 'wardrobe', 'home', 'challenges', 'home']) s.go(x)
  })
  await expect(page.locator('[data-screen]')).toHaveCount(1)
  await expect(page.locator('[data-screen="home"]')).toBeAttached()
  await expect(ghosts).toHaveCount(0, { timeout: 3_000 })
  // la pantalla final queda totalmente opaca y usable
  await expect.poll(() => page.locator('[data-screen="home"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 3_000 }).toBe('1')
  await page.getByTestId('menu-shop').click()
  await expect(page.locator('[data-screen="shop"]')).toBeVisible()
  await expect(page.getByTestId('back')).toHaveCount(1)
})

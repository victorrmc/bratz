import { expect, openFresh, skipOnboarding, state, test } from './fixtures'

// Acabado de las muñecas: ojos 3D, relieve de cara y torso, piel y manos nuevas.
// Comprueba además que Clara conserva su descripción (moño bajo caoba, uñas oscuras y reloj).

interface DollInfo {
  eyes: { visible: boolean; meshes: number; cornea: boolean; vertices: number } | null
  headAlpha: boolean
  headNormal: boolean
  torsoNormal: boolean
  skinPatched: boolean
  hands: number
}

/** Inspecciona la muñeca de la escena 3D actual. */
async function dollInfo(page: import('@playwright/test').Page, id = 'clara'): Promise<DollInfo> {
  return page.evaluate((id) => {
    type O = {
      name: string
      visible: boolean
      children: O[]
      isMesh?: boolean
      material?: { transparent?: boolean; alphaMap?: unknown; normalMap?: unknown; onBeforeCompile?: { toString(): string }; customProgramCacheKey?: () => string }
      geometry?: { getAttribute(n: string): { count: number } }
      traverse(f: (o: O) => void): void
    }
    const scene = (window as unknown as { __clara: { interaction: { scene: O } } }).__clara.interaction.scene
    let doll: O | null = null
    scene.traverse((o) => {
      if (o.name === `doll-${id}`) doll = o
    })
    if (!doll) throw new Error('muñeca no encontrada')
    let eyes: O | null = null
    const meshes: O[] = []
    ;(doll as O).traverse((o) => {
      if (o.name === 'ojos') eyes = o
      if (o.isMesh) meshes.push(o)
    })
    const e = eyes as O | null
    const head = meshes.find((m) => m.material?.alphaMap)
    const torso = meshes.find((m) => m.material?.normalMap && !m.material?.alphaMap)
    return {
      eyes: e
        ? {
            visible: e.visible,
            meshes: e.children.length,
            cornea: e.children.some((c) => c.material?.transparent),
            vertices: e.children.reduce((n, c) => n + (c.geometry?.getAttribute('position').count ?? 0), 0),
          }
        : null,
      headAlpha: Boolean(head),
      headNormal: Boolean(head?.material?.normalMap),
      torsoNormal: Boolean(torso),
      skinPatched: meshes.some((m) => m.material?.customProgramCacheKey?.().startsWith('skin-sss')),
      hands: meshes.filter((m) => m.name.startsWith('mano-') && (m.geometry?.getAttribute('position').count ?? 0) > 600).length,
    }
  }, id)
}

test('ojos 3D con córnea, párpados, relieve de cara y torso, y piel con subsurface', async ({ page, errors }) => {
  void errors
  await openFresh(page, 'q=alta&dpr=1')
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { setCam: (c: string) => void } } } }).__clara.store.getState().setCam('cara'))
  await page.waitForTimeout(1500)
  const info = await dollInfo(page)
  expect(info.eyes, 'ojos 3D').not.toBeNull()
  await expect.poll(async () => (await dollInfo(page)).eyes!.visible).toBe(true)
  // globo, córnea, línea de pestañas, párpado inferior y pliegue
  expect(info.eyes!.meshes).toBe(5)
  expect(info.eyes!.cornea).toBe(true)
  expect(info.headAlpha, 'recorte del almendrado').toBe(true)
  expect(info.headNormal, 'normal map de nariz y labios').toBe(true)
  expect(info.torsoNormal, 'normal map del torso').toBe(true)
  expect(info.skinPatched, 'piel con subsurface y rim').toBe(true)

  // guiño: queda un solo ojo 3D (el otro está cerrado y pintado)
  const both = info.eyes!.vertices
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { setExpression: (e: string) => void } } } }).__clara.store.getState().setExpression('guino'))
  await expect.poll(async () => (await dollInfo(page)).eyes!.vertices).toBeLessThan(both)
  // (el parpadeo oculta los ojos 3D un instante)
  await expect.poll(async () => (await dollInfo(page)).eyes!.visible).toBe(true)

  // la cara se renderiza (captura no vacía)
  const png = await page.evaluate(() => (window as unknown as { __clara: { interaction: { capture: (o: object) => string | null } } }).__clara.interaction.capture({ w: 240, h: 320, post: false }))
  expect(png?.length ?? 0).toBeGreaterThan(5000)
})

test('Clara conserva moño bajo caoba, uñas oscuras y reloj en la muñeca izquierda; manos nuevas', async ({ page, errors }) => {
  void errors
  await openFresh(page)
  await skipOnboarding(page)
  await page.getByTestId('menu-studio').click()
  await expect(page.getByTestId('editor-sheet')).toBeVisible()
  const look = await state<{ hair: { styleId: string; base: string }; nails: { color: string }; outfit: Record<string, { itemId: string }> }>(page, 's => s.look')
  expect(look.hair.styleId).toBe('mono-bajo')
  expect(look.hair.base.toLowerCase()).toBe('#5a2018')
  // uñas oscuras (luminancia baja)
  const n = parseInt(look.nails.color.slice(1), 16)
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  expect(lum).toBeLessThan(80)
  expect(look.outfit.bracelet.itemId).toBe('br-reloj')
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { setCam: (c: string) => void } } } }).__clara.store.getState().setCam('manos'))
  await page.waitForTimeout(1000)
  const info = await dollInfo(page)
  // dos manos con palma, tres falanges por dedo y pulgar (también en calidad baja)
  expect(info.hands).toBe(2)
  await expect.poll(async () => (await dollInfo(page)).eyes?.visible).toBe(true)
})

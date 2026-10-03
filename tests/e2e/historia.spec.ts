import type { Page } from '@playwright/test'
import { expect, openFresh, skipOnboarding, start, state, test } from './fixtures'
import { CHAPTERS, STORY_TEXT } from '../../src/data/chapters'

// Modo historia «Rumbo a Ibiza»: los cinco capítulos, el álbum de recuerdos y el guardado.

async function playChapter(page: Page, n: number) {
  await page.getByTestId(`chapter-${n}`).click()
  await expect(page.getByTestId('vignette-intro')).toBeVisible()
  await expect(page.getByTestId('vignette-intro')).toContainText(CHAPTERS[n - 1].intro.title)
  await page.getByTestId('vignette-next').click()
  await expect(page.getByTestId('chapter-banner')).toBeVisible()
  expect(await state<string>(page, 's => s.stage')).toBe(CHAPTERS[n - 1].stage)
  // la ayuda pone el look de ejemplo y cumple el look obligatorio
  await page.getByTestId('chapter-autodress').click()
  for (const r of await page.getByTestId('requirement').all()) await expect(r).toHaveAttribute('data-ok', 'true')
  await page.getByTestId('submit-chapter').click()
  await expect(page.getByTestId('jury')).toBeVisible()
  await expect(page.getByTestId('chapter-passed')).toBeVisible()
  await page.getByTestId('jury-continue').click()
  // foto automática del recuerdo en el escenario del capítulo
  const photo = page.getByTestId('memory-photo')
  await expect(photo).toBeVisible({ timeout: 60_000 })
  expect(await photo.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/)
  await page.getByTestId('memory-continue').click()
  await expect(page.getByTestId('vignette-outro')).toContainText(CHAPTERS[n - 1].outro.title)
  await page.getByTestId('vignette-next').click()
}

async function memoryCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const r = indexedDB.open('rumbo-recuerdos')
        r.onsuccess = () => {
          const db = r.result
          if (!db.objectStoreNames.contains('recuerdos')) return resolve(0)
          const c = db.transaction('recuerdos').objectStore('recuerdos').count()
          c.onsuccess = () => {
            resolve(c.result)
            db.close()
          }
        }
        r.onerror = () => resolve(-1)
      }),
  )
}

test('historia completa: cinco capítulos, final, álbum de recuerdos y guardado tras recargar', async ({ page, errors }) => {
  void errors
  test.setTimeout(900_000)
  await openFresh(page)
  await skipOnboarding(page)
  // el álbum de una partida nueva está vacío
  await page.getByTestId('menu-memories').click()
  await expect(page.getByTestId('album-empty')).toBeVisible()
  await page.getByTestId('back').click()
  await expect(page.getByTestId('menu-story-progress')).toHaveText('0/5')
  await page.getByTestId('menu-story').click()
  await expect(page.getByTestId('story-map')).toBeVisible()
  await expect(page.getByTestId('story-progress')).toHaveText('0/5')

  // desbloqueo secuencial: el capítulo 2 está cerrado
  await page.getByTestId('chapter-2').click({ force: true })
  await expect(page.getByText(STORY_TEXT.locked)).toBeVisible()
  expect(await state<string>(page, 's => s.storyPhase')).toBe('map')

  // capítulo 1 sin el look obligatorio: el jurado no lo da por superado
  await page.getByTestId('chapter-1').click()
  await page.getByTestId('vignette-next').click()
  await expect(page.getByTestId('chapter-banner')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __clara: { store: { getState: () => { setLook: (f: (l: { outfit: object }) => object) => void } } } }).__clara.store.getState().setLook((l) => ({ ...l, outfit: {} })))
  await expect(page.getByTestId('requirement').first()).toHaveAttribute('data-ok', 'false')
  await page.getByTestId('submit-chapter').click()
  await expect(page.getByTestId('chapter-failed')).toBeVisible()
  await page.getByTestId('jury-retry').click()
  await expect(page.getByTestId('chapter-banner')).toBeVisible()
  expect(await state<number>(page, 's => Object.keys(s.save.story.chapters).length')).toBe(0)
  await page.getByTestId('back').click()
  await expect(page.getByTestId('story-map')).toBeVisible()

  for (let n = 1; n <= 4; n++) {
    await playChapter(page, n)
    await expect(page.getByTestId('story-map')).toBeVisible()
    await expect(page.getByTestId('story-progress')).toHaveText(`${n}/5`)
  }
  // el capítulo 5 enlaza con el final y la carta de siempre
  await playChapter(page, 5)
  await expect(page.locator('[data-screen="ending"]')).toBeVisible()
  await page.getByTestId('skip-to-letter').click()
  await expect(page.getByTestId('letter')).toBeVisible()
  await page.getByTestId('letter-home').click()
  await expect(page.getByTestId('menu-ending')).toBeVisible()
  await expect(page.getByTestId('menu-story-progress')).toHaveText('5/5')

  // álbum de recuerdos: una foto por capítulo
  await page.getByTestId('menu-memories').click()
  for (const c of CHAPTERS) await expect(page.getByTestId(`memory-${c.id}`)).toBeVisible()
  await page.getByTestId(`memory-${CHAPTERS[3].id}`).click()
  await expect(page.getByTestId('memory-big')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('memory-big')).toBeHidden()
  await page.getByTestId('back').click()

  // tras recargar sigue todo: progreso en localStorage y fotos en IndexedDB
  await page.reload()
  await start(page)
  await expect(page.getByTestId('menu-story-progress')).toHaveText('5/5')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('clara-ibiza-save') ?? '{}'))
  expect(saved.version).toBe(4)
  expect(Object.keys(saved.story.chapters).sort()).toEqual(CHAPTERS.map((c) => c.id).sort())
  expect(await memoryCount(page)).toBe(5)
  await page.getByTestId('menu-memories').click()
  await expect(page.locator('[data-testid^="memory-cap-"]')).toHaveCount(5)
  await page.getByTestId('back').click()
  await page.getByTestId('menu-story').click()
  await expect(page.getByTestId('story-progress')).toHaveText('5/5')
  await expect(page.getByTestId('story-ending')).toBeVisible()
})

test('una partida antigua (v3) carga sin perder nada y sube a v4', async ({ page, errors }) => {
  void errors
  await page.goto('./?q=baja')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem(
      'clara-ibiza-save',
      JSON.stringify({
        version: 3,
        coins: 321,
        owned: ['top-holo'],
        challengeStars: { 'reto-disco': 4 },
        looks: [],
        current: {},
        activeDoll: 'clara',
        onboardingDone: true,
        heartFound: false,
        endingSeen: false,
        endingUnlocked: false,
        settings: { volume: 0.5, muted: false, quality: 'auto' },
      }),
    )
  })
  await page.goto('./?q=baja')
  await start(page)
  await expect(page.getByTestId('coins').first()).toContainText('321')
  await expect(page.getByTestId('menu-story-progress')).toHaveText('0/5')
  expect(await state<number>(page, 's => s.save.challengeStars["reto-disco"]')).toBe(4)
  expect(await state<string[]>(page, 's => s.save.owned')).toEqual(['top-holo'])
  // al guardar cualquier cosa ya se escribe como v4
  await page.getByTestId('audio-toggle').click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('clara-ibiza-save') ?? '{}'))
  expect(saved.version).toBe(4)
  expect(saved.coins).toBe(321)
  expect(saved.story).toEqual({ chapters: {} })
})

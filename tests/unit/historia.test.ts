import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHAPTERS, CHAPTER_BY_ID } from '../../src/data/chapters'
import { CHALLENGE_BY_ID } from '../../src/data/challenges'
import { ITEM_BY_ID } from '../../src/data/items'
import { POSES, STAGE_BY_ID } from '../../src/data/stages'
import type { Look } from '../../src/data/types'
import { defaultLookFor, equip } from '../../src/game/look'
import { clearMemories, getMemory, isValidMemory, listMemories, MEMORIES_DB, openMemories, putMemory, type Memory } from '../../src/game/memories'
import { defaultSave, loadSave, migrate, SAVE_VERSION, writeSave, type StorageLike, type StoryProgress } from '../../src/game/save'
import {
  applyChapterResult,
  chapterIndex,
  completedChapters,
  isChapterDone,
  isChapterUnlocked,
  isLastChapter,
  isStoryComplete,
  nextChapter,
  progressLabel,
  recordChapter,
  requirementStatus,
  scoreChapter,
  suggestedLook,
} from '../../src/game/story'

const naked = (): Look => ({ ...defaultLookFor('clara'), outfit: {} })
const empty = (): StoryProgress => ({ chapters: {} })
const done = (n: number): StoryProgress => {
  let p = empty()
  for (const c of CHAPTERS.slice(0, n)) p = recordChapter(p, c.id, 4, 1000)
  return p
}

describe('capítulos de la historia', () => {
  it('son cinco, en orden y con ids únicos', () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(5)
    expect(new Set(CHAPTERS.map((c) => c.challenge.id)).size).toBe(5)
    expect(CHAPTER_BY_ID['cap-ferry'].number).toBe(2)
  })
  it('usan escenarios y poses que existen, con Dalt Vila nuevo y el ferry y la casa de antes', () => {
    for (const c of CHAPTERS) {
      expect(STAGE_BY_ID[c.stage], c.stage).toBeDefined()
      expect(c.challenge.stage).toBe(c.stage)
      expect(POSES.some((p) => p.id === c.pose)).toBe(true)
    }
    expect(CHAPTERS.map((c) => c.stage)).toEqual(['room', 'ferry', 'beach', 'daltvila', 'casa'])
  })
  it('tienen viñetas de entrada y cierre y textos en español', () => {
    for (const c of CHAPTERS) {
      expect(c.intro.lines.length).toBeGreaterThan(0)
      expect(c.outro.lines.length).toBeGreaterThan(0)
      expect(c.memory.length).toBeGreaterThan(3)
      expect(c.mustWear.label.length).toBeGreaterThan(3)
    }
  })
  it('no se mezclan con los 15 retos ni duplican ids', () => {
    for (const c of CHAPTERS) expect(CHALLENGE_BY_ID[c.challenge.id]).toBeUndefined()
  })
  it('el look obligatorio va también en los huecos obligatorios del reto', () => {
    for (const c of CHAPTERS) expect(c.challenge.required).toEqual(c.mustWear.slots)
  })
  it('el look de ayuda usa prendas comunes y supera cada capítulo', () => {
    for (const c of CHAPTERS) {
      for (const id of c.suggestion) expect(ITEM_BY_ID[id]?.rarity, id).toBe('comun')
      const r = scoreChapter(suggestedLook(naked(), c), c)
      expect(r.requirements.every((q) => q.ok), c.id).toBe(true)
      expect(r.score.stars, c.id).toBeGreaterThanOrEqual(c.minStars)
      expect(r.passed).toBe(true)
    }
  })
})

describe('desbloqueo secuencial y progreso', () => {
  it('solo el primero está abierto al empezar', () => {
    const p = empty()
    expect(CHAPTERS.map((c) => isChapterUnlocked(p, c.id))).toEqual([true, false, false, false, false])
    expect(isChapterUnlocked(p, 'no-existe')).toBe(false)
    expect(nextChapter(p)?.id).toBe('cap-maleta')
    expect(progressLabel(p)).toBe('0/5')
  })
  it('superar un capítulo abre el siguiente', () => {
    const p = done(2)
    expect(isChapterDone(p, 'cap-ferry')).toBe(true)
    expect(isChapterUnlocked(p, 'cap-playa')).toBe(true)
    expect(isChapterUnlocked(p, 'cap-daltvila')).toBe(false)
    expect(nextChapter(p)?.id).toBe('cap-playa')
    expect(completedChapters(p)).toBe(2)
    expect(progressLabel(p)).toBe('2/5')
  })
  it('la historia completa no tiene siguiente capítulo', () => {
    const p = done(5)
    expect(isStoryComplete(p)).toBe(true)
    expect(nextChapter(p)).toBeNull()
    expect(isLastChapter('cap-casa')).toBe(true)
    expect(isLastChapter('cap-maleta')).toBe(false)
    expect(chapterIndex('cap-daltvila')).toBe(3)
  })
  it('guarda la mejor nota y la primera fecha', () => {
    let p = recordChapter(empty(), 'cap-maleta', 3, 100)
    p = recordChapter(p, 'cap-maleta', 5.2, 200)
    expect(p.chapters['cap-maleta']).toEqual({ stars: 5, completedAt: 100 })
    p = recordChapter(p, 'cap-maleta', 2, 300)
    expect(p.chapters['cap-maleta'].stars).toBe(5)
    expect(recordChapter(p, 'inventado', 5, 1)).toBe(p)
  })
})

describe('reto de estilo del capítulo', () => {
  it('sin el look obligatorio no se supera, aunque el resto sea perfecto', () => {
    const ch = CHAPTER_BY_ID['cap-daltvila']
    // sin la prenda ibicenca: un vestido elegante que no lo es en lugar del top campesino
    const look = equip(suggestedLook(naked(), ch), ITEM_BY_ID['dress-slip'])
    const r = scoreChapter(look, ch)
    expect(r.requirements.find((q) => q.label.includes('ibicenco'))?.ok).toBe(false)
    expect(r.passed).toBe(false)
    expect(r.score.stars).toBeLessThanOrEqual(2)
    expect(r.score.tips.some((t) => t.includes('look obligatorio'))).toBe(true)
  })
  it('sin el hueco obligatorio aplica la penalización de los retos una sola vez', () => {
    const ch = CHAPTER_BY_ID['cap-ferry']
    const look = suggestedLook(naked(), ch)
    delete look.outfit.glasses
    const r = scoreChapter(look, ch)
    expect(r.score.missingRequired).toEqual(['glasses'])
    expect(r.score.tips.filter((t) => t.includes('look obligatorio'))).toHaveLength(0)
    expect(r.passed).toBe(false)
  })
  it('lista el estado de cada condición', () => {
    const ch = CHAPTER_BY_ID['cap-maleta']
    expect(requirementStatus(naked(), ch)).toEqual([
      { label: 'Bolso', ok: false },
      { label: 'Calzado', ok: false },
    ])
    expect(requirementStatus(suggestedLook(naked(), ch), ch).every((r) => r.ok)).toBe(true)
  })
  it('la ayuda ignora prendas que no existan', () => {
    const ch = { ...CHAPTER_BY_ID['cap-maleta'], suggestion: ['no-existe', 'top-babytee'] }
    expect(suggestedLook(naked(), ch).outfit.top?.itemId).toBe('top-babytee')
  })
})

describe('resultado en la partida', () => {
  const pass = (id: string) => scoreChapter(suggestedLook(naked(), CHAPTER_BY_ID[id]), CHAPTER_BY_ID[id])
  it('un intento fallido no cambia nada', () => {
    const s = defaultSave()
    const fail = scoreChapter(naked(), CHAPTER_BY_ID['cap-maleta'])
    expect(applyChapterResult(s, 'cap-maleta', fail, 1)).toBe(s)
  })
  it('superarlo lo guarda y el quinto abre el final de siempre', () => {
    let s = defaultSave()
    for (const c of CHAPTERS.slice(0, 4)) s = applyChapterResult(s, c.id, pass(c.id), 5)
    expect(completedChapters(s.story)).toBe(4)
    expect(s.endingUnlocked).toBe(false)
    s = applyChapterResult(s, 'cap-casa', pass('cap-casa'), 6)
    expect(isStoryComplete(s.story)).toBe(true)
    expect(s.endingUnlocked).toBe(true)
  })
})

describe('guardado v4 y migración', () => {
  const memStorage = (): StorageLike & { data: Map<string, string> } => {
    const data = new Map<string, string>()
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
  }
  it('la versión sube a 4 y la partida nueva trae la historia vacía', () => {
    expect(SAVE_VERSION).toBe(4)
    expect(defaultSave().story).toEqual({ chapters: {} })
  })
  it('una partida v3 completa carga sin perder nada', () => {
    const v3 = {
      version: 3,
      coins: 345,
      owned: ['top-holo', 'dress-sirena'],
      challengeStars: { 'reto-disco': 5, 'reto-playa': 2 },
      looks: [{ id: 'look-1', name: 'Noche', look: naked(), createdAt: 9, thumb: 'data:image/jpeg;base64,AA' }],
      current: { clara: naked() },
      activeDoll: 'vega',
      onboardingDone: true,
      heartFound: true,
      endingSeen: true,
      endingUnlocked: true,
      settings: { volume: 0.3, muted: true, quality: 'baja' },
    }
    const s = migrate(v3)
    const { version, story, ...rest } = s
    expect(version).toBe(4)
    expect(story).toEqual({ chapters: {} })
    const { version: _v, ...old } = v3
    void _v
    expect(rest).toEqual(old)
  })
  it('las partidas v1 y v2 siguen migrando hasta la v4', () => {
    const s1 = migrate({ version: 1, coins: 5, completed: ['reto-disco'], looks: [] })
    expect(s1.version).toBe(4)
    expect(s1.challengeStars).toEqual({ 'reto-disco': 3 })
    expect(s1.story.chapters).toEqual({})
    const s2 = migrate({ version: 2, coins: 10, challengeStars: { 'reto-rock': 4 }, settings: { volume: 0.4, muted: false } })
    expect(s2.version).toBe(4)
    expect(s2.challengeStars).toEqual({ 'reto-rock': 4 })
    expect(s2.settings.volume).toBe(0.4)
  })
  it('el progreso v4 se conserva y se limpia lo inválido', () => {
    const s = migrate({
      version: 4,
      story: { chapters: { 'cap-maleta': { stars: 4.4, completedAt: 77 }, 'cap-ferry': { stars: 9 }, 'cap-playa': 'x', 'cap-casa': { stars: 3 } } },
    })
    expect(s.story.chapters).toEqual({ 'cap-maleta': { stars: 4, completedAt: 77 }, 'cap-casa': { stars: 3, completedAt: 0 } })
    expect(migrate({ version: 4, story: 'roto' }).story).toEqual({ chapters: {} })
  })
  it('ida y vuelta por el almacenamiento', () => {
    const st = memStorage()
    const s = { ...defaultSave(), story: done(3) }
    expect(writeSave(s, st)).toBe(true)
    expect(loadSave(st).story).toEqual(done(3))
    st.data.set('clara-ibiza-save', JSON.stringify({ version: 3, coins: 99 }))
    const up = loadSave(st)
    expect(up.coins).toBe(99)
    expect(up.version).toBe(4)
  })
})

describe('recuerdos en IndexedDB', () => {
  const mem = (chapterId: string, createdAt = 1): Memory => ({ chapterId, image: 'data:image/jpeg;base64,AAAA', stage: 'room', stars: 4, caption: 'Hola', createdAt })
  beforeEach(async () => {
    await clearMemories()
  })
  it('usa su propia base de datos', async () => {
    expect(MEMORIES_DB).toBe('rumbo-recuerdos')
    const db = await openMemories()
    expect(db?.name).toBe('rumbo-recuerdos')
    db?.close()
  })
  it('guarda, sustituye, lista en orden y borra', async () => {
    expect(await putMemory(mem('cap-ferry', 5))).toBe(true)
    expect(await putMemory(mem('cap-maleta', 9))).toBe(true)
    expect(await putMemory({ ...mem('cap-ferry', 7), stars: 5 })).toBe(true)
    const order = CHAPTERS.map((c) => c.id)
    const list = await listMemories(order)
    expect(list.map((m) => m.chapterId)).toEqual(['cap-maleta', 'cap-ferry'])
    expect(list[1].stars).toBe(5)
    expect((await getMemory('cap-ferry'))?.createdAt).toBe(7)
    expect(await getMemory('cap-casa')).toBeNull()
    // sin orden: por fecha; ids desconocidos al final
    expect((await listMemories()).map((m) => m.chapterId)).toEqual(['cap-ferry', 'cap-maleta'])
    await putMemory(mem('otro', 0))
    expect((await listMemories(order)).map((m) => m.chapterId)).toEqual(['cap-maleta', 'cap-ferry', 'otro'])
    expect(await clearMemories()).toBe(true)
    expect(await listMemories(order)).toEqual([])
  })
  it('rechaza recuerdos inválidos', async () => {
    expect(isValidMemory(null)).toBe(false)
    expect(isValidMemory({ ...mem('a'), image: 'http://fuera.com/x.jpg' })).toBe(false)
    expect(await putMemory({ ...mem('a'), image: 'javascript:alert(1)' })).toBe(false)
  })
  it('sin IndexedDB no falla: devuelve vacío', async () => {
    expect(await openMemories(null)).toBeNull()
    expect(await putMemory(mem('a'), null)).toBe(false)
    expect(await listMemories([], null)).toEqual([])
    expect(await getMemory('a', null)).toBeNull()
    expect(await clearMemories(null)).toBe(false)
  })
  it('si abrir la base de datos falla, también devuelve vacío', async () => {
    const broken = {
      open: () => {
        throw new Error('bloqueado')
      },
      deleteDatabase: () => {
        throw new Error('no')
      },
    } as unknown as IDBFactory
    expect(await openMemories(broken)).toBeNull()
    expect(await listMemories([], broken)).toEqual([])
  })
  it('una fábrica aparte no ve los recuerdos de otra', async () => {
    const other = new IDBFactory()
    await putMemory(mem('cap-maleta'))
    expect(await listMemories([], other)).toEqual([])
  })
})

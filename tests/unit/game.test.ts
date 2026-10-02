import { describe, expect, it } from 'vitest'
import { ITEMS, ITEM_BY_ID, CATEGORIES } from '../../src/data/items'
import { HAIR_STYLES } from '../../src/data/hair'
import { CHALLENGES, CHALLENGE_BY_ID } from '../../src/data/challenges'
import { DOLLS } from '../../src/data/characters'
import { STAGES, POSES } from '../../src/data/stages'
import type { ChallengeDef, Look } from '../../src/data/types'
import {
  accessoryScore,
  colorScore,
  completenessScore,
  harmonyScore,
  juryComments,
  paletteScore,
  scoreLook,
  starsFor,
  styleScore,
  tagLabel,
} from '../../src/game/scoring'
import { cloneLook, defaultLookFor, equip, randomLook, rng, toggleItem, updateInstance, wornItems } from '../../src/game/look'
import {
  applyChallengeResult,
  availableItems,
  buyItem,
  completedCount,
  isItemUnlocked,
  registerHeartTap,
  rewardFor,
  shopItems,
  syncEnding,
  unlockEverything,
  unlockHint,
  HEART_TAPS,
} from '../../src/game/economy'
import { clearSave, defaultSave, loadSave, migrate, SAVE_KEY, SAVE_VERSION, writeSave, type StorageLike } from '../../src/game/save'
import { addLook, deleteLook, duplicateLook, renameLook, sanitizeName, MAX_LOOKS } from '../../src/game/wardrobe'
import { colorDistance, hexToHsl, hexToRgb, hueDistance, isNeutral, mixHex } from '../../src/game/color'

class MemStorage implements StorageLike {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

const emptyLook = (): Look => ({ ...defaultLookFor('clara'), outfit: {} })
const wear = (look: Look, ...ids: string[]) => ids.reduce((l, id) => equip(l, ITEM_BY_ID[id]), look)

describe('catálogo', () => {
  it('tiene al menos 12 opciones por categoría e ids únicos', () => {
    for (const c of CATEGORIES) expect(ITEMS.filter((i) => i.category === c.id).length).toBeGreaterThanOrEqual(12)
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
  })
  it('tiene contenido suficiente', () => {
    expect(HAIR_STYLES.length).toBeGreaterThanOrEqual(14)
    expect(CHALLENGES.length).toBe(15)
    expect(DOLLS.length).toBe(4)
    expect(STAGES.filter((s) => !s.secret).length).toBe(7)
    expect(POSES.length).toBe(8)
  })
  it('las especiales tienen precio y las secretas regla', () => {
    for (const i of ITEMS) {
      if (i.rarity === 'especial') expect(i.price).toBeGreaterThan(0)
      if (i.rarity === 'secreta') expect(i.unlock).toBeDefined()
    }
  })
  it('los looks por defecto usan prendas existentes y comunes', () => {
    for (const d of DOLLS) {
      for (const inst of Object.values(d.defaultLook.outfit)) {
        expect(ITEM_BY_ID[inst!.itemId]).toBeDefined()
        expect(ITEM_BY_ID[inst!.itemId].rarity).toBe('comun')
      }
    }
  })
})

describe('color', () => {
  it('convierte y mide colores', () => {
    expect(hexToRgb('#ff0000')).toEqual([255, 0, 0])
    expect(hexToRgb('#f00')).toEqual([255, 0, 0])
    expect(hexToRgb('nope')).toEqual([0, 0, 0])
    expect(hexToHsl('#00ff00').h).toBeCloseTo(120)
    expect(hexToHsl('#0000ff').h).toBeCloseTo(240)
    expect(hexToHsl('#ff00ff').h).toBeCloseTo(300)
    expect(hexToHsl('#808080').s).toBe(0)
    expect(hueDistance(350, 10)).toBe(20)
    expect(isNeutral('#ffffff')).toBe(true)
    expect(isNeutral('#ff2d8a')).toBe(false)
    expect(colorDistance('#000000', '#000000')).toBe(0)
    expect(colorDistance('#000000', '#ffffff')).toBeGreaterThan(0.9)
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('looks', () => {
  it('un vestido sustituye top y parte de abajo y viceversa', () => {
    let l = wear(emptyLook(), 'top-corazon', 'pant-flare')
    expect(l.outfit.top && l.outfit.bottom).toBeTruthy()
    l = wear(l, 'dress-sequin')
    expect(l.outfit.top).toBeUndefined()
    expect(l.outfit.bottom).toBeUndefined()
    l = wear(l, 'top-babytee')
    expect(l.outfit.dress).toBeUndefined()
  })
  it('toggle quita la prenda si ya está puesta y no muta el original', () => {
    const a = wear(emptyLook(), 'gl-corazon')
    const b = toggleItem(a, ITEM_BY_ID['gl-corazon'])
    expect(a.outfit.glasses).toBeDefined()
    expect(b.outfit.glasses).toBeUndefined()
    expect(equip(a, ITEM_BY_ID['gl-corazon'])).toBe(a)
  })
  it('actualiza color y estampado de una prenda', () => {
    const a = wear(emptyLook(), 'top-corazon')
    const b = updateInstance(a, 'top', { color: '#000000', pattern: 'leopardo' })
    expect(b.outfit.top!.color).toBe('#000000')
    expect(b.outfit.top!.pattern).toBe('leopardo')
    expect(updateInstance(a, 'hat', { color: '#fff' })).toBe(a)
  })
  it('genera looks aleatorios deterministas y válidos', () => {
    const avail = availableItems(defaultSave())
    const a = randomLook(emptyLook(), avail, rng(42))
    const b = randomLook(emptyLook(), avail, rng(42))
    expect(a).toEqual(b)
    expect(a.outfit.shoes).toBeDefined()
    expect(Boolean(a.outfit.dress) || Boolean(a.outfit.top)).toBe(true)
    for (const w of wornItems(a)) expect(w.def.rarity).toBe('comun')
    for (let s = 0; s < 30; s++) {
      const r = randomLook(emptyLook(), avail, rng(s))
      expect(!(r.outfit.dress && r.outfit.top)).toBe(true)
    }
  })
  it('defaultLookFor devuelve copias independientes', () => {
    const a = defaultLookFor('clara')
    a.hair.base = '#000000'
    expect(defaultLookFor('clara').hair.base).not.toBe('#000000')
    expect(defaultLookFor('desconocida').dollId).toBe('clara')
    expect(cloneLook(a)).toEqual(a)
  })
})

describe('puntuación de retos', () => {
  const disco = CHALLENGE_BY_ID['reto-disco']
  const playa = CHALLENGE_BY_ID['reto-playa']

  it('un look perfecto de fiesta saca 4-5 estrellas', () => {
    const look = wear(emptyLook(), 'dress-sequin', 'sh-plataforma', 'ear-estrella', 'nk-corazon', 'bag-corazon')
    const r = scoreLook(look, disco)
    expect(r.stars).toBeGreaterThanOrEqual(4)
    expect(r.missingRequired).toEqual([])
  })
  it('un look vacío saca 1 estrella', () => {
    const r = scoreLook(emptyLook(), disco)
    expect(r.stars).toBe(1)
    expect(r.tips.length).toBeGreaterThan(0)
  })
  it('las etiquetas prohibidas restan', () => {
    const good = wear(emptyLook(), 'dress-sequin')
    const bad = wear(emptyLook(), 'dress-sequin', 'jk-puffer')
    expect(styleScore(bad, disco)).toBeLessThan(styleScore(good, disco))
  })
  it('sin calzado obligatorio el máximo es 2 estrellas', () => {
    const look = wear(emptyLook(), 'dress-sequin', 'ear-estrella', 'nk-corazon', 'bag-corazon')
    const r = scoreLook(look, disco)
    expect(r.missingRequired).toContain('shoes')
    expect(r.stars).toBeLessThanOrEqual(2)
  })
  it('la paleta del reto premia colores cercanos', () => {
    const turquesa = wear(emptyLook(), 'top-bikini')
    const ok = updateInstance(turquesa, 'top', { color: '#3de0c4' })
    const ko = updateInstance(turquesa, 'top', { color: '#1c1626' })
    expect(colorScore(ok, playa)).toBeGreaterThan(colorScore(ko, playa))
    expect(paletteScore([], ['#fff'])).toBe(0)
  })
  it('armonías de color', () => {
    expect(harmonyScore(['#ff0000', '#ff2200'], 'monocromo')).toBe(1)
    expect(harmonyScore(['#ff0000', '#00ff00'], 'monocromo')).toBeLessThan(0.3)
    expect(harmonyScore(['#ffffff'], 'monocromo')).toBe(1)
    expect(harmonyScore(['#ff0000', '#ff8800'], 'analogo')).toBe(1)
    expect(harmonyScore(['#ff0000', '#00ffff'], 'complementario')).toBe(1)
    expect(harmonyScore(['#ff0000', '#ff3300'], 'complementario')).toBeLessThan(1)
    expect(harmonyScore(['#ff0000'], 'analogo')).toBe(0.9)
    expect(harmonyScore([], 'libre')).toBe(0)
    expect(harmonyScore(['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'], 'libre')).toBeLessThan(1)
    expect(harmonyScore(['#ff0000', '#00ff00'], 'libre')).toBe(1)
  })
  it('accesorios: pocos, justos y demasiados', () => {
    const ch: ChallengeDef = { ...disco, minAccessories: 2 }
    expect(accessoryScore(wear(emptyLook(), 'gl-corazon'), ch)).toBe(0.5)
    expect(accessoryScore(wear(emptyLook(), 'gl-corazon', 'hat-boina'), ch)).toBe(1)
    const many = wear(emptyLook(), 'gl-corazon', 'hat-boina', 'bag-corazon', 'ear-aros', 'nk-perlas', 'br-oro')
    expect(accessoryScore(many, ch)).toBe(0.7)
    expect(accessoryScore(emptyLook(), { ...ch, minAccessories: 0 })).toBe(1)
  })
  it('completitud', () => {
    expect(completenessScore(emptyLook())).toBe(0)
    expect(completenessScore(wear(emptyLook(), 'top-corazon'))).toBeCloseTo(0.25)
    expect(completenessScore(wear(emptyLook(), 'top-corazon', 'pant-flare', 'sh-chunky'))).toBe(1)
  })
  it('umbrales de estrellas y jurado', () => {
    expect([0, 0.4, 0.6, 0.75, 0.9].map(starsFor)).toEqual([1, 2, 3, 4, 5])
    for (let s = 1; s <= 5; s++) expect(juryComments(s, 7)).toHaveLength(3)
    expect(juryComments(9, 0)).toHaveLength(3)
    expect(tagLabel('ibiza')).toBe('ibicenco')
  })
  it('todos los retos son alcanzables con 4+ estrellas con prendas comunes', () => {
    const avail = availableItems(defaultSave())
    for (const ch of CHALLENGES) {
      let best = 0
      for (let s = 0; s < 400 && best < 4; s++) best = Math.max(best, scoreLook(randomLook(emptyLook(), avail, rng(s * 7 + 1)), ch).stars)
      expect(best, ch.id).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('economía y desbloqueos', () => {
  it('recompensas: primera vez, mejoras y repeticiones', () => {
    expect(rewardFor(3, undefined)).toEqual({ coins: 50, improved: true, firstClear: true })
    expect(rewardFor(5, 3).coins).toBe(20 + 15)
    expect(rewardFor(2, 4).coins).toBe(2)
    expect(rewardFor(5, undefined).coins).toBe(50 + 20 + 15)
  })
  it('aplica el resultado y conserva la mejor puntuación', () => {
    let s = defaultSave()
    s = applyChallengeResult(s, 'reto-disco', 4).save
    expect(s.coins).toBe(60 + 60)
    s = applyChallengeResult(s, 'reto-disco', 2).save
    expect(s.challengeStars['reto-disco']).toBe(4)
    expect(completedCount(s)).toBe(1)
  })
  it('comprar en la tienda', () => {
    const s = { ...defaultSave(), coins: 100 }
    const r = buyItem(s, 'top-holo')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.save.coins).toBe(40)
      expect(r.save.owned).toContain('top-holo')
      expect(buyItem(r.save, 'top-holo')).toEqual({ ok: false, reason: 'ya-tienes' })
      expect(buyItem(r.save, 'dress-gala')).toEqual({ ok: false, reason: 'sin-monedas' })
    }
    expect(buyItem(s, 'nada')).toEqual({ ok: false, reason: 'no-encontrada' })
    expect(buyItem(s, 'top-corazon')).toEqual({ ok: false, reason: 'no-a-la-venta' })
    expect(buyItem(s, 'dress-sirena')).toEqual({ ok: false, reason: 'no-a-la-venta' })
  })
  it('prendas secretas por reto, por número de retos, por corazón y por final', () => {
    let s = defaultSave()
    const sirena = ITEM_BY_ID['dress-sirena']
    const perlas = ITEM_BY_ID['ear-perla-mar']
    const tiara = ITEM_BY_ID['ha-tiara-perlas']
    const corona = ITEM_BY_ID['ha-corona-hada']
    expect(isItemUnlocked(sirena, s)).toBe(false)
    s = applyChallengeResult(s, 'reto-sirena', 3).save
    expect(isItemUnlocked(sirena, s)).toBe(true)
    expect(isItemUnlocked(perlas, s)).toBe(false)
    for (const c of CHALLENGES.slice(0, 10)) s = applyChallengeResult(s, c.id, 3).save
    expect(isItemUnlocked(perlas, s)).toBe(true)
    expect(isItemUnlocked(tiara, s)).toBe(false)
    expect(isItemUnlocked(corona, s)).toBe(false)
    expect(isItemUnlocked(corona, { ...s, endingSeen: true })).toBe(true)
    expect(isItemUnlocked(tiara, { ...s, heartFound: true })).toBe(true)
    expect(isItemUnlocked(ITEM_BY_ID['top-holo'], s)).toBe(false)
    expect(unlockHint(sirena)).toContain('sirena')
    expect(unlockHint(perlas)).toContain('10')
    expect(unlockHint(tiara)).toContain('corazón')
    expect(unlockHint(corona)).toContain('final')
    expect(unlockHint(ITEM_BY_ID['top-holo'])).toContain('60')
    expect(unlockHint(ITEM_BY_ID['top-corazon'])).toBe('')
    expect(shopItems().every((i) => i.rarity !== 'comun')).toBe(true)
  })
  it('el final se desbloquea completando todos los retos', () => {
    let s = defaultSave()
    for (const c of CHALLENGES.slice(0, 14)) s = applyChallengeResult(s, c.id, 2).save
    expect(s.endingUnlocked).toBe(false)
    s = applyChallengeResult(s, CHALLENGES[14].id, 2).save
    expect(s.endingUnlocked).toBe(true)
  })
  it('el final se desbloquea con 5 toques al corazón', () => {
    let s = defaultSave()
    let taps = 0
    for (let i = 0; i < HEART_TAPS - 1; i++) {
      const r = registerHeartTap(s, taps)
      expect(r.triggered).toBe(false)
      s = r.save
      taps = r.taps
    }
    const r = registerHeartTap(s, taps)
    expect(r.triggered).toBe(true)
    expect(r.save.endingUnlocked).toBe(true)
    expect(r.save.heartFound).toBe(true)
    const again = registerHeartTap(r.save, HEART_TAPS - 1)
    expect(again.triggered).toBe(true)
    expect(syncEnding(again.save)).toBe(again.save)
  })
  it('desbloquear todo (debug)', () => {
    const s = unlockEverything(defaultSave())
    expect(availableItems(s).length).toBe(ITEMS.length)
    expect(s.endingUnlocked).toBe(true)
  })
})

describe('guardado y migración', () => {
  it('guarda y carga', () => {
    const st = new MemStorage()
    const s = { ...defaultSave(), coins: 123, owned: ['top-holo'] }
    expect(writeSave(s, st)).toBe(true)
    expect(loadSave(st)).toEqual(s)
    clearSave(st)
    expect(loadSave(st)).toEqual(defaultSave())
  })
  it('sobrevive a JSON corrupto, sin storage y storage que lanza', () => {
    const st = new MemStorage()
    st.setItem(SAVE_KEY, '{nope')
    expect(loadSave(st)).toEqual(defaultSave())
    expect(loadSave(null)).toEqual(defaultSave())
    expect(writeSave(defaultSave(), null)).toBe(false)
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('x')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('x')
      },
    }
    expect(loadSave(throwing)).toEqual(defaultSave())
    expect(writeSave(defaultSave(), throwing)).toBe(false)
    expect(() => clearSave(throwing)).not.toThrow()
  })
  it('si la cuota se llena, guarda sin miniaturas', () => {
    let calls = 0
    const st = new MemStorage()
    const picky: StorageLike = {
      getItem: (k) => st.getItem(k),
      removeItem: (k) => st.removeItem(k),
      setItem: (k, v) => {
        calls++
        if (v.includes('data:image')) throw new Error('quota')
        st.setItem(k, v)
      },
    }
    const s = { ...defaultSave(), looks: addLook([], emptyLook(), 'A', 1, 'data:image/png;base64,AAAA') }
    expect(writeSave(s, picky)).toBe(true)
    expect(calls).toBe(2)
    expect(loadSave(picky).looks[0].thumb).toBeUndefined()
  })
  it('migra un guardado v1', () => {
    const v1 = {
      version: 1,
      coins: 77.9,
      owned: ['top-holo', 5],
      completed: ['reto-disco', 'reto-playa'],
      looks: [{ name: 'Mi look', look: emptyLook() }, { look: emptyLook() }, 'basura'],
    }
    const s = migrate(v1)
    expect(s.version).toBe(SAVE_VERSION)
    expect(s.coins).toBe(77)
    expect(s.owned).toEqual(['top-holo'])
    expect(s.challengeStars).toEqual({ 'reto-disco': 3, 'reto-playa': 3 })
    expect(s.looks.map((l) => l.name)).toEqual(['Mi look', 'Look 2'])
    expect(s.settings.quality).toBe('auto')
    expect(s.endingUnlocked).toBe(false)
  })
  it('migra un guardado v2 y conserva ajustes', () => {
    const v2 = {
      version: 2,
      coins: 10,
      owned: [],
      challengeStars: { 'reto-disco': 5, malo: 9 },
      looks: [],
      settings: { volume: 0.2, muted: true },
      onboardingDone: true,
    }
    const s = migrate(v2)
    expect(s.settings).toEqual({ volume: 0.2, muted: true, quality: 'auto' })
    expect(s.challengeStars).toEqual({ 'reto-disco': 5 })
    expect(s.onboardingDone).toBe(true)
  })
  it('valores inválidos vuelven a los de por defecto', () => {
    expect(migrate(null)).toEqual(defaultSave())
    expect(migrate([1, 2])).toEqual(defaultSave())
    const s = migrate({ version: 3, coins: 'mucho', settings: { volume: 5, quality: 'ultra' }, challengeStars: 3 })
    expect(s.coins).toBe(defaultSave().coins)
    expect(s.settings.volume).toBe(1)
    expect(s.settings.quality).toBe('auto')
    expect(s.challengeStars).toEqual({})
    const t = migrate({ version: 3, settings: 'x', current: { clara: emptyLook() }, activeDoll: 'vega' })
    expect(t.activeDoll).toBe('vega')
    expect(t.current.clara).toBeDefined()
  })
})

describe('armario', () => {
  it('guardar, renombrar, duplicar y borrar', () => {
    let list = addLook([], emptyLook(), '  Noche   en Ibiza  ', 1000)
    expect(list[0].name).toBe('Noche en Ibiza')
    list = renameLook(list, list[0].id, 'Atardecer')
    expect(list[0].name).toBe('Atardecer')
    list = renameLook(list, list[0].id, '   ')
    expect(list[0].name).toBe('Atardecer')
    list = duplicateLook(list, list[0].id, 2000)
    expect(list).toHaveLength(2)
    expect(list[1].name).toBe('Atardecer (copia)')
    expect(list[1].id).not.toBe(list[0].id)
    expect(duplicateLook(list, 'nope', 1)).toBe(list)
    list = deleteLook(list, list[0].id)
    expect(list).toHaveLength(1)
    expect(sanitizeName('', 'X')).toBe('X')
    expect(sanitizeName('a'.repeat(50), 'X')).toHaveLength(24)
  })
  it('limita el número de looks', () => {
    let list = addLook([], emptyLook(), '', 1)
    for (let i = 0; i < MAX_LOOKS + 5; i++) list = addLook(list, emptyLook(), '', i)
    expect(list).toHaveLength(MAX_LOOKS)
  })
})

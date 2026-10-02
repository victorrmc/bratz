import { describe, expect, it } from 'vitest'
import { CATEGORIES, ITEMS, ITEM_BY_ID } from '../../src/data/items'
import { COLOR_FAMILIES, EMPTY_FILTER, availableFacets, colorFamily, filterItems, isFiltering, itemColorFamily, matchesItem, normalize } from '../../src/game/filters'

const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? ''

describe('familias de color', () => {
  it('clasifica colores básicos', () => {
    expect(colorFamily('#ff5fae')).toBe('rosa')
    expect(colorFamily('#e8243c')).toBe('rojo')
    expect(colorFamily('#ff9b4a')).toBe('naranja')
    expect(colorFamily('#fff16a')).toBe('amarillo')
    expect(colorFamily('#b8f25c')).toBe('verde')
    expect(colorFamily('#5b84d6')).toBe('azul')
    expect(colorFamily('#8f5bff')).toBe('morado')
    expect(colorFamily('#8a5a3c')).toBe('marron')
    expect(colorFamily('#1c1626')).toBe('negro')
    expect(colorFamily('#ffffff')).toBe('blanco')
    expect(colorFamily('#f3e6d4')).toBe('blanco')
    expect(colorFamily('#c0c4d6')).toBe('gris')
    expect(colorFamily('#777777')).toBe('gris')
    expect(colorFamily('#333333')).toBe('negro')
  })
  it('distingue el dorado solo en metales', () => {
    expect(colorFamily('#e3b45a', true)).toBe('dorado')
    expect(colorFamily('#e3b45a')).toBe('amarillo')
    expect(itemColorFamily(ITEM_BY_ID['ear-aros'])).toBe('dorado')
  })
  it('todas las familias tienen nombre visible en español y todas las prendas tienen familia', () => {
    for (const c of COLOR_FAMILIES) expect(c.name.length).toBeGreaterThan(2)
    const ids = new Set(COLOR_FAMILIES.map((c) => c.id))
    for (const i of ITEMS) expect(ids.has(itemColorFamily(i))).toBe(true)
  })
})

describe('búsqueda y filtros', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalize('  Cazadora MOTERA Rosá ')).toBe('cazadora motera rosa')
  })
  it('sin filtro devuelve la misma lista', () => {
    expect(isFiltering(EMPTY_FILTER)).toBe(false)
    expect(filterItems(ITEMS, EMPTY_FILTER)).toBe(ITEMS)
  })
  it('busca por nombre sin tildes y por varias palabras', () => {
    const r = filterItems(ITEMS, { ...EMPTY_FILTER, query: 'vaquero' })
    expect(r.length).toBeGreaterThan(1)
    expect(r.every((i) => normalize(i.name).includes('vaquer') || normalize(catName(i.category)).includes('vaquer'))).toBe(true)
    const r2 = filterItems(ITEMS, { ...EMPTY_FILTER, query: 'ibicenco blanco' })
    expect(r2.map((i) => i.name)).toContain('Palazzo blanco ibicenco')
    expect(filterItems(ITEMS, { ...EMPTY_FILTER, query: 'Cala Comté' }).map((i) => i.name)).toEqual(['Top de conchas de Cala Comte'])
  })
  it('busca por estilo, color y categoría', () => {
    expect(filterItems(ITEMS, { ...EMPTY_FILTER, query: 'romántico' }).every((i) => i.tags.includes('romantico') || /romantic/.test(normalize(i.name)))).toBe(true)
    const rosa = filterItems(ITEMS, { ...EMPTY_FILTER, query: 'rosa' })
    expect(rosa.length).toBeGreaterThan(10)
    const gafas = filterItems(ITEMS, { ...EMPTY_FILTER, query: 'gafas' }, (i) => catName(i.category))
    expect(gafas.length).toBe(ITEMS.filter((i) => i.category === 'glasses').length)
  })
  it('combina estilos (o) y colores (o) con «y» entre grupos', () => {
    const f = { query: '', tags: ['rock' as const, 'boho' as const], colors: ['negro' as const] }
    const r = filterItems(ITEMS, f)
    expect(r.length).toBeGreaterThan(0)
    for (const i of r) {
      expect(i.tags.some((t) => t === 'rock' || t === 'boho')).toBe(true)
      expect(itemColorFamily(i)).toBe('negro')
    }
    expect(matchesItem(ITEM_BY_ID['top-corazon'], f)).toBe(false)
  })
  it('una búsqueda sin resultados devuelve una lista vacía', () => {
    expect(filterItems(ITEMS, { ...EMPTY_FILTER, query: 'zzzz nada' })).toEqual([])
  })
  it('solo ofrece estilos y colores presentes', () => {
    const tops = ITEMS.filter((i) => i.category === 'tops')
    const f = availableFacets(tops)
    for (const t of f.tags) expect(tops.some((i) => i.tags.includes(t))).toBe(true)
    for (const c of f.colors) expect(tops.some((i) => itemColorFamily(i) === c)).toBe(true)
    expect(f.colors.length).toBeGreaterThan(3)
  })
})

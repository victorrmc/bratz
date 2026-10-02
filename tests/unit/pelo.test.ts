import { describe, expect, it } from 'vitest'
import { HAIR_BY_ID, HAIR_STYLES } from '../../src/data/hair'

describe('peinados de nueva generación', () => {
  it('hay 20 peinados con ids únicos', () => {
    expect(HAIR_STYLES.length).toBe(20)
    expect(new Set(HAIR_STYLES.map((h) => h.id)).size).toBe(HAIR_STYLES.length)
  })

  it('el recogido de boda ibicenca lleva flores, corona trenzada y moño suelto', () => {
    const boda = HAIR_BY_ID['boda-ibicenca']
    expect(boda.name).toBe('Recogido de boda ibicenca')
    const kinds = boda.pieces.map((p) => p.kind)
    expect(kinds).toEqual(expect.arrayContaining(['flowers', 'braidCrown', 'bunMessy']))
    expect(boda.tags).toContain('ibiza')
  })

  it('los cuatro peinados nuevos tienen casquete y alguna pieza con física', () => {
    const physics = ['bunMessy', 'ponyBubble', 'braidSide']
    for (const id of ['boda-ibicenca', 'trenza-espiga', 'mono-despeinado', 'coleta-burbujas']) {
      const kinds = HAIR_BY_ID[id].pieces.map((p) => p.kind)
      expect(kinds[0]).toMatch(/^cap/)
      expect(kinds.some((k) => physics.includes(k))).toBe(true)
    }
  })
})

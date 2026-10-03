import { describe, expect, it } from 'vitest'
import { HAPTICS, RUNWAY, footwearFor, runwayCue, sfxForItem, trackFor, trackForStage } from '../../src/audio/mapping'
import { DEFAULT_AUDIO_SETTINGS, parseAudioSettings } from '../../src/audio/settings'
import { ITEMS } from '../../src/data/items'

describe('banda sonora', () => {
  it('cada escenario tiene su pista', () => {
    expect(trackForStage('ibiza')).toBe('ibiza')
    expect(trackForStage('beach')).toBe('ibiza')
    expect(trackForStage('disco')).toBe('disco')
    expect(trackForStage('casa')).toBe('casa')
    expect(trackForStage('mall')).toBe('menu')
  })

  it('la pista depende de la pantalla y, en fotos y retos, del escenario', () => {
    expect(trackFor('home', 'disco')).toBe('menu')
    expect(trackFor('studio', 'ibiza')).toBe('menu')
    expect(trackFor('photo', 'disco')).toBe('disco')
    expect(trackFor('challenge', 'ibiza')).toBe('ibiza')
    expect(trackFor('jury', 'casa')).toBe('casa')
    expect(trackFor('runway', 'ibiza')).toBe('runway')
    expect(trackFor('ending', 'disco')).toBe('ending')
    expect(trackFor('letter', 'disco')).toBe('ending')
  })

  it('la pasarela sube de intensidad hasta el clímax de la pose', () => {
    const a = runwayCue(0)
    const b = runwayCue(RUNWAY.walk * 0.9)
    const pose = runwayCue(RUNWAY.walk + 1)
    expect(a.walking).toBe(true)
    expect(b.intensity).toBeGreaterThan(a.intensity)
    expect(pose).toEqual({ phase: 'pose', intensity: 3, walking: false })
    // vuelta: primero gira sin andar y luego regresa andando
    const turn = runwayCue(RUNWAY.walk + RUNWAY.pose + 0.2)
    expect(turn).toMatchObject({ phase: 'back', walking: false })
    expect(runwayCue(RUNWAY.walk + RUNWAY.pose + 2).walking).toBe(true)
    // siguientes vueltas: nunca baja de la base completa
    for (let t = RUNWAY.walk + RUNWAY.pose; t < 120; t += 0.7) expect(runwayCue(t).intensity).toBeGreaterThanOrEqual(2.4)
  })

  it('cada prenda tiene un efecto con su patrón de vibración', () => {
    for (const item of ITEMS) {
      const sfx = sfxForItem(item)
      expect(HAPTICS[sfx].length).toBeGreaterThan(0)
    }
    const byId = (id: string) => sfxForItem(ITEMS.find((i) => i.id === id)!)
    expect(byId('top-babytee')).toBe('fabric')
    expect(byId('jk-biker')).toBe('zipper')
    expect(byId('sh-aguja')).toBe('heel')
    expect(byId('sh-chunky')).toBe('step')
    expect(byId('ear-aros')).toBe('jewel')
  })

  it('tipo de calzado para los pasos de la pasarela', () => {
    expect(footwearFor('heels')).toBe('tacon')
    expect(footwearFor('wedge')).toBe('tacon')
    expect(footwearFor('boots')).toBe('bota')
    expect(footwearFor('sneakers')).toBe('plano')
    expect(footwearFor(undefined)).toBe('descalza')
  })

  it('los ajustes de sonido se leen con valores por defecto y límites', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('no es json')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('{"music":2,"sfx":-1,"vibration":false}')).toEqual({ music: 1, sfx: 0, vibration: false })
    expect(parseAudioSettings('{"music":0.25,"sfx":"x"}')).toEqual({ music: 0.25, sfx: DEFAULT_AUDIO_SETTINGS.sfx, vibration: true })
  })
})

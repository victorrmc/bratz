// Director de sonido: elige la pista según pantalla y escenario, lleva la música
// adaptativa de la pasarela y pone efectos a lo que pasa en el juego.

import { useEffect } from 'react'
import { useGame } from '../store/game'
import { ITEM_BY_ID } from '../data/items'
import { audio } from './engine'
import { footwearFor, runwayCue, sfxForItem, trackFor } from './mapping'
import { useAudioSettings } from './settings'

/** Reloj del desfile en segundos (accesible para pruebas). */
const runwayClock = { t: 0 }

// Acceso para pruebas automáticas
;(window as unknown as { __claraAudio: unknown }).__claraAudio = { engine: audio, settings: useAudioSettings, runwayClock }

type Outfit = ReturnType<typeof useGame.getState>['look']['outfit']

function changedItems(prev: Outfit, next: Outfit): string[] {
  const out: string[] = []
  for (const slot of Object.keys(next) as (keyof Outfit)[]) {
    const id = next[slot]?.itemId
    if (id && id !== prev[slot]?.itemId) out.push(id)
  }
  return out
}

function syncFootwear() {
  const shoes = useGame.getState().look.outfit.shoes?.itemId
  audio.footwear = footwearFor(shoes ? ITEM_BY_ID[shoes]?.model : undefined)
}

export function useAudioDirector() {
  const screen = useGame((s) => s.screen)
  const stage = useGame((s) => s.stage)
  const settings = useGame((s) => s.save.settings)
  const audioReady = useGame((s) => s.audioReady)
  const mix = useAudioSettings()

  useEffect(() => {
    const unlock = () => {
      audio.unlock()
      useGame.getState().setAudioReady()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    audio.setVolume(settings.volume, settings.muted)
  }, [settings.volume, settings.muted, audioReady])

  useEffect(() => {
    audio.setMix(mix.music, mix.sfx)
  }, [mix.music, mix.sfx, audioReady])

  // pista por pantalla y escenario
  useEffect(() => {
    if (!audioReady) return
    audio.playTrack(trackFor(screen, stage))
  }, [screen, stage, audioReady])

  // efectos de prendas: tela, cremallera, tacones, joyas…
  useEffect(() => {
    syncFootwear()
    return useGame.subscribe((s, prev) => {
      if (s.look.outfit === prev.look.outfit) return
      syncFootwear()
      if (s.look.dollId !== prev.look.dollId || (s.screen !== 'studio' && s.screen !== 'challenge')) return
      const ids = changedItems(prev.look.outfit, s.look.outfit)
      // «Sorpréndeme» o ponerse un look entero: un solo efecto de tela
      if (ids.length > 2) return audio.play('fabric')
      const item = ids.length ? ITEM_BY_ID[ids[ids.length - 1]] : undefined
      if (item) audio.play(sfxForItem(item))
    })
  }, [])

  // aplausos del jurado, más fuertes cuantas más estrellas
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.jury && s.jury !== prev.jury) {
        const stars = s.jury.score.stars
        setTimeout(() => audio.play('applause', stars / 5), 450)
      }
    })
  }, [])

  // pasarela: la música sube de intensidad y los pasos siguen el desfile
  useEffect(() => {
    if (screen !== 'runway' || !audioReady) return
    // Reloj con el mismo paso limitado (50 ms) que la escena de la pasarela,
    // para que los tirones de carga no desincronicen los pasos del desfile.
    runwayClock.t = 0
    let last = performance.now()
    let phase = ''
    let raf = 0
    const tick = () => {
      const now = performance.now()
      runwayClock.t += Math.min(0.05, (now - last) / 1000)
      last = now
      const cue = runwayCue(runwayClock.t)
      audio.setIntensity(cue.intensity)
      audio.walking = cue.walking
      if (cue.phase !== phase) {
        if (cue.phase === 'pose') audio.play('applause', 0.5)
        phase = cue.phase
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      audio.walking = false
      audio.setIntensity(1)
    }
  }, [screen, audioReady])
}

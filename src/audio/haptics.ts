// Vibración háptica sincronizada con los efectos de sonido.

import { useAudioSettings } from './settings'

let pending: ReturnType<typeof setTimeout> | null = null

/**
 * Vibra con un patrón (ms encendido/apagado). `delayMs` retrasa el inicio para que
 * coincida con el momento en que el efecto sale de verdad por el altavoz.
 */
export function vibrate(pattern: number | number[], delayMs = 0) {
  if (!useAudioSettings.getState().vibration) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  const fire = () => {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* sin vibración */
    }
  }
  if (pending) clearTimeout(pending)
  pending = null
  if (delayMs < 4) fire()
  else pending = setTimeout(fire, delayMs)
}

let lastSfx = -1e9

/** Marca que un efecto acaba de programar su propia vibración. */
export function markSfxVibration() {
  lastSfx = typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Vibración corta de los botones. Si en este mismo gesto ya ha sonado un efecto con su
 * patrón, no lo pisa: así la vibración sigue el ritmo del sonido.
 */
export function buzz(ms = 12) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastSfx < 60) return
  vibrate(ms)
}

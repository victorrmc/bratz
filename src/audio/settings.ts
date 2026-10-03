// Ajustes de sonido propios (volumen de música, de efectos y vibración).
// Van en su propia clave de localStorage para no tocar el formato del guardado.

import { create } from 'zustand'
import { clamp01 } from './mapping'

export const AUDIO_SETTINGS_KEY = 'clara-ibiza-audio'

export interface AudioSettings {
  music: number
  sfx: number
  vibration: boolean
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { music: 0.8, sfx: 0.9, vibration: true }

export function parseAudioSettings(raw: string | null): AudioSettings {
  try {
    const d = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    return {
      music: clamp01(d.music, DEFAULT_AUDIO_SETTINGS.music),
      sfx: clamp01(d.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
      vibration: typeof d.vibration === 'boolean' ? d.vibration : DEFAULT_AUDIO_SETTINGS.vibration,
    }
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
}

function read(): AudioSettings {
  try {
    return parseAudioSettings(localStorage.getItem(AUDIO_SETTINGS_KEY))
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
}

interface Store extends AudioSettings {
  set: (p: Partial<AudioSettings>) => void
}

export const useAudioSettings = create<Store>((set, get) => ({
  ...read(),
  set: (p) => {
    set(p)
    const { music, sfx, vibration } = get()
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ music, sfx, vibration }))
    } catch {
      /* sin almacenamiento */
    }
  },
}))

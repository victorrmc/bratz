import type { EffectComposer } from 'postprocessing'

// Compositor de posproceso activo (lo registra el trozo diferido de post.tsx
// y lo usa la captura de fotos).
let composer: EffectComposer | null = null
export const getComposer = () => composer
export function setComposer(c: EffectComposer | null) {
  composer = c
}

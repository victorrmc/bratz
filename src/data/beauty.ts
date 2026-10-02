import type { EyelinerStyle, FaceGem, LashStyle, LipFinish, NailLook, NailShape } from './types'

export const LINERS: { id: EyelinerStyle; name: string }[] = [
  { id: 'none', name: 'Sin delineado' },
  { id: 'fino', name: 'Fino' },
  { id: 'gato', name: 'Ojo de gato' },
  { id: 'grafico', name: 'Gráfico' },
]

export const LASHES: { id: LashStyle; name: string }[] = [
  { id: 'natural', name: 'Naturales' },
  { id: 'volumen', name: 'Volumen' },
  { id: 'drama', name: 'Drama' },
]

export const LIP_FINISHES: { id: LipFinish; name: string }[] = [
  { id: 'mate', name: 'Mate' },
  { id: 'gloss', name: 'Gloss' },
  { id: 'metal', name: 'Metalizado' },
]

export const FACE_GEMS: { id: FaceGem; name: string }[] = [
  { id: 'none', name: 'Ninguna' },
  { id: 'estrellas', name: 'Estrellas' },
  { id: 'corazones', name: 'Corazones' },
  { id: 'brillantes', name: 'Brillantes' },
  { id: 'pecas', name: 'Pecas' },
  { id: 'mariposa', name: 'Mariposa' },
]

export const NAIL_SHAPES: { id: NailShape; name: string }[] = [
  { id: 'redonda', name: 'Redonda' },
  { id: 'almendra', name: 'Almendra' },
  { id: 'cuadrada', name: 'Cuadrada' },
  { id: 'stiletto', name: 'Stiletto' },
  { id: 'bailarina', name: 'Bailarina' },
]

export const NAIL_FINISHES: { id: NailLook['finish']; name: string }[] = [
  { id: 'brillo', name: 'Brillo' },
  { id: 'mate', name: 'Mate' },
  { id: 'cromo', name: 'Cromo' },
  { id: 'purpurina', name: 'Purpurina' },
]

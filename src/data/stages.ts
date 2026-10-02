import type { PoseDef, StageDef } from './types'

export const STAGES: StageDef[] = [
  { id: 'disco', name: 'Discoteca neón', mood: 'Luces de neón, bola de espejos y mucho ritmo.' },
  { id: 'mall', name: 'Centro comercial', mood: 'Escaparates brillantes y bolsas de compras.' },
  { id: 'beach', name: 'Playa al atardecer', mood: 'Arena dorada, palmeras y cielo naranja.' },
  { id: 'redcarpet', name: 'Alfombra roja', mood: 'Photocall, focos y flashes de los paparazzi.' },
  { id: 'room', name: 'Habitación Y2K', mood: 'Peluches, pósteres, lámpara de lava y teléfono de concha.' },
  { id: 'ibiza', name: 'Ibiza al atardecer', mood: 'Casitas blancas, buganvillas y el sol cayendo frente a Es Vedrà.' },
  { id: 'ferry', name: 'Ferry a Ibiza', mood: 'Cubierta de madera, brisa salada, gaviotas y la isla esperándonos al fondo.' },
  {
    id: 'casa',
    name: 'Nuestra casa en Ibiza',
    mood: 'Una terraza blanca con vistas al mar, un columpio y dos tazas de café. Nuestro futuro.',
    secret: true,
  },
]

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s]))

export const POSES: PoseDef[] = [
  { id: 'idle', name: 'Natural' },
  { id: 'hip', name: 'Mano en la cadera' },
  { id: 'peace', name: 'Signo de la paz' },
  { id: 'kiss', name: 'Lanzar un beso' },
  { id: 'hair', name: 'Mano en el pelo' },
  { id: 'cross', name: 'Pierna cruzada' },
  { id: 'wave', name: 'Saludo' },
  { id: 'star', name: 'Estrella' },
]

import type { HairStyleDef } from './types'

// Peinados: composición de piezas 3D (casquete, coletas, moños, melenas…).
export const HAIR_STYLES: HairStyleDef[] = [
  {
    id: 'mono-bajo',
    name: 'Moño bajo pulido',
    pieces: [{ kind: 'capSleek' }, { kind: 'bunLow' }],
    tags: ['elegante', 'glam'],
  },
  {
    id: 'coleta-baja',
    name: 'Coleta baja',
    pieces: [{ kind: 'capSleek' }, { kind: 'ponyLow', params: { length: 0.36 } }],
    tags: ['elegante', 'street'],
  },
  {
    id: 'coleta-alta',
    name: 'Coleta alta',
    pieces: [{ kind: 'capSleek', params: { high: 1 } }, { kind: 'ponyHigh', params: { length: 0.42, wave: 0 } }],
    tags: ['deportivo', 'glam', 'y2k'],
  },
  {
    id: 'coleta-ondas',
    name: 'Coleta alta con ondas',
    pieces: [{ kind: 'capSleek', params: { high: 1 } }, { kind: 'ponyHigh', params: { length: 0.5, wave: 1 } }],
    tags: ['glam', 'fiesta'],
  },
  {
    id: 'coletas',
    name: 'Dos coletas altas',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'pigtails', params: { length: 0.3 } }],
    tags: ['y2k', 'street'],
  },
  {
    id: 'liso-largo',
    name: 'Liso largo',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'curtainStraight', params: { length: 0.5 } }, { kind: 'faceStrands', params: { length: 0.38 } }],
    tags: ['glam', 'elegante'],
  },
  {
    id: 'ondas',
    name: 'Ondas de sirena',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'curtainWavy', params: { length: 0.56 } }, { kind: 'faceStrands', params: { length: 0.4, wave: 1 } }],
    tags: ['boho', 'romantico', 'playa'],
  },
  {
    id: 'rizos',
    name: 'Rizos voluminosos',
    pieces: [{ kind: 'capVolume', params: { part: 0, volume: 1 } }, { kind: 'curtainCurly', params: { length: 0.36 } }],
    tags: ['boho', 'fiesta'],
  },
  {
    id: 'mono-alto',
    name: 'Moño alto',
    pieces: [{ kind: 'capSleek', params: { high: 1 } }, { kind: 'bunHigh' }],
    tallTop: true,
    tags: ['elegante', 'deportivo'],
  },
  {
    id: 'space-buns',
    name: 'Moñitos espaciales',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'bunsSpace' }],
    tallTop: true,
    tags: ['y2k', 'fiesta', 'street'],
  },
  {
    id: 'trenzas',
    name: 'Dos trenzas',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'braids', params: { length: 0.42 } }],
    tags: ['boho', 'romantico'],
  },
  {
    id: 'bob-flequillo',
    name: 'Bob con flequillo',
    pieces: [{ kind: 'capVolume', params: { part: 0 } }, { kind: 'bob' }, { kind: 'bangsStraight' }],
    tags: ['y2k', 'rock'],
  },
  {
    id: 'flequillo-largo',
    name: 'Liso con flequillo',
    pieces: [{ kind: 'capVolume', params: { part: 0 } }, { kind: 'curtainStraight', params: { length: 0.58 } }, { kind: 'bangsStraight' }],
    tags: ['rock', 'y2k'],
  },
  {
    id: 'cortina',
    name: 'Flequillo cortina y ondas',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'curtainWavy', params: { length: 0.42 } }, { kind: 'bangsCurtain' }],
    tags: ['boho', 'romantico'],
  },
  {
    id: 'semirecogido',
    name: 'Semirecogido',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'curtainWavy', params: { length: 0.46 } }, { kind: 'halfUp' }],
    tags: ['romantico', 'glam'],
  },
  {
    id: 'melena-media',
    name: 'Media melena',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'curtainStraight', params: { length: 0.24 } }, { kind: 'faceStrands', params: { length: 0.22 } }],
    tags: ['street', 'elegante'],
  },
  {
    id: 'boda-ibicenca',
    name: 'Recogido de boda ibicenca',
    pieces: [
      { kind: 'capVolume', params: { part: 1 } },
      { kind: 'braidCrown' },
      { kind: 'bunMessy', params: { high: 0, size: 1.25 } },
      { kind: 'flowers' },
      { kind: 'faceStrands', params: { short: 1 } },
    ],
    tags: ['ibiza', 'romantico', 'boho', 'elegante'],
  },
  {
    id: 'trenza-espiga',
    name: 'Trenza lateral de espiga',
    pieces: [{ kind: 'capVolume', params: { part: 1 } }, { kind: 'braidSide', params: { side: 1, length: 0.44 } }],
    tags: ['boho', 'playa', 'romantico'],
  },
  {
    id: 'mono-despeinado',
    name: 'Moño despeinado',
    pieces: [{ kind: 'capVolume', params: { part: 0 } }, { kind: 'bunMessy', params: { high: 1, size: 1.1 } }, { kind: 'faceStrands', params: { short: 1 } }],
    tallTop: true,
    tags: ['street', 'playa', 'boho'],
  },
  {
    id: 'coleta-burbujas',
    name: 'Coleta de burbujas',
    pieces: [{ kind: 'capSleek', params: { high: 1 } }, { kind: 'ponyBubble', params: { length: 0.5, bubbles: 4 } }],
    tags: ['y2k', 'fiesta', 'deportivo'],
  },
]

export const HAIR_BY_ID: Record<string, HairStyleDef> = Object.fromEntries(HAIR_STYLES.map((h) => [h.id, h]))

// Tipos del catálogo. Todo el contenido del juego son datos tipados:
// añadir prendas, peinados o retos no requiere tocar la lógica.

export type StyleTag =
  | 'glam'
  | 'street'
  | 'rock'
  | 'boho'
  | 'fiesta'
  | 'playa'
  | 'invierno'
  | 'romantico'
  | 'deportivo'
  | 'y2k'
  | 'elegante'
  | 'magico'
  | 'ibiza'

export type Rarity = 'comun' | 'especial' | 'secreta'

export type Category =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'jackets'
  | 'shoes'
  | 'bags'
  | 'jewelry'
  | 'glasses'
  | 'hats'
  | 'hairAcc'

/** Huecos que puede ocupar una prenda en el look. */
export type Slot =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'jacket'
  | 'shoes'
  | 'bag'
  | 'earrings'
  | 'necklace'
  | 'bracelet'
  | 'glasses'
  | 'hat'
  | 'hairAcc'

export type Fabric =
  | 'cotton'
  | 'satin'
  | 'denim'
  | 'vinyl'
  | 'leather'
  | 'holo'
  | 'sequin'
  | 'knit'
  | 'mesh'
  | 'metal'
  | 'gem'
  | 'plastic'
  | 'fur'
  | 'pearl'
  | 'scales'
  | 'petal'

export type PatternId =
  | 'liso'
  | 'denim'
  | 'escoces'
  | 'leopardo'
  | 'cebra'
  | 'purpurina'
  | 'lentejuelas'
  | 'saten'
  | 'rejilla'
  | 'corazones'
  | 'estrellas'
  | 'flores'
  | 'rayas'
  | 'escamas'

/** Condición de desbloqueo de las prendas secretas. */
export type UnlockRule =
  | { kind: 'challenge'; challengeId: string }
  | { kind: 'challengesCompleted'; count: number }
  | { kind: 'ending' }
  | { kind: 'heart' }

export interface ItemDef {
  id: string
  name: string
  category: Category
  slot: Slot
  /** Plantilla geométrica y parámetros con los que se construye la malla. */
  model: string
  params?: Record<string, number | string | boolean>
  fabric: Fabric
  color: string
  color2?: string
  pattern?: PatternId
  /** Si la prenda permite cambiar color y estampado. */
  editable: boolean
  tags: StyleTag[]
  rarity: Rarity
  /** Precio en monedas de purpurina (solo especiales). */
  price?: number
  unlock?: UnlockRule
  /** Pequeña descripción o recuerdo (prendas secretas). */
  story?: string
}

export interface ItemInstance {
  itemId: string
  color: string
  color2?: string
  pattern: PatternId
}

export type HairPieceKind =
  | 'capSleek'
  | 'capVolume'
  | 'capSide'
  | 'bunLow'
  | 'bunHigh'
  | 'bunsSpace'
  | 'ponyLow'
  | 'ponyHigh'
  | 'pigtails'
  | 'curtainStraight'
  | 'curtainWavy'
  | 'curtainCurly'
  | 'bob'
  | 'bangsStraight'
  | 'bangsCurtain'
  | 'braids'
  | 'faceStrands'
  | 'halfUp'
  | 'bunMessy'
  | 'ponyBubble'
  | 'braidSide'
  | 'braidCrown'
  | 'flowers'

export interface HairStyleDef {
  id: string
  name: string
  pieces: { kind: HairPieceKind; params?: Record<string, number> }[]
  /** Oculta la cara superior bajo gorros (moños altos). */
  tallTop?: boolean
  tags: StyleTag[]
}

export interface HairLook {
  styleId: string
  base: string
  highlights: string
  highlightsOn: boolean
  tips: string
  tipsOn: boolean
  /** 0..1 */
  shine: number
}

export type LipFinish = 'mate' | 'gloss' | 'metal'
export type EyelinerStyle = 'none' | 'fino' | 'gato' | 'grafico'
export type LashStyle = 'natural' | 'volumen' | 'drama'
export type FaceGem = 'none' | 'estrellas' | 'corazones' | 'brillantes' | 'pecas' | 'mariposa'
export type Expression = 'sonrisa' | 'guino' | 'seria' | 'dientes' | 'sorpresa' | 'risa'

export interface MakeupLook {
  eyeshadow: string
  eyeshadowAmt: number
  liner: EyelinerStyle
  linerColor: string
  lashes: LashStyle
  blush: string
  blushAmt: number
  highlighter: number
  lips: string
  lipFinish: LipFinish
  lipAmt: number
  gems: FaceGem
  gemColor: string
}

export type NailShape = 'redonda' | 'almendra' | 'cuadrada' | 'stiletto' | 'bailarina'
export interface NailLook {
  shape: NailShape
  color: string
  finish: 'brillo' | 'mate' | 'cromo' | 'purpurina'
}

export interface Look {
  dollId: string
  outfit: Partial<Record<Slot, ItemInstance>>
  hair: HairLook
  makeup: MakeupLook
  nails: NailLook
}

export interface DollDef {
  id: string
  name: string
  style: 'glam' | 'street' | 'rock' | 'boho'
  styleName: string
  personality: string
  quote: string
  color: string
  skin: string
  skinShade: string
  eyes: string
  brows: string
  /** Rasgos de la cara que cambian entre muñecas. */
  face: {
    lipFullness: number
    eyeSize: number
    browArch: number
    freckles?: boolean
  }
  defaultLook: Omit<Look, 'dollId'>
}

export interface ChallengeDef {
  id: string
  title: string
  brief: string
  icon: string
  wantedTags: StyleTag[]
  bannedTags?: StyleTag[]
  /** Colores objetivo (hex). Si no hay, se puntúa la armonía. */
  palette?: string[]
  harmony?: 'monocromo' | 'analogo' | 'complementario' | 'libre'
  minAccessories: number
  required?: Slot[]
  timeLimit?: number
  stage: string
}

export interface StageDef {
  id: string
  name: string
  mood: string
  secret?: boolean
}

export interface PoseDef {
  id: string
  name: string
}

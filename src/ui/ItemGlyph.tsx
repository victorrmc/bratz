import { useId } from 'react'
import type { ItemDef, PatternId } from '../data/types'
import { useThumb } from './thumbs'

// Miniaturas del catálogo. La imagen buena es un render de la propia pieza 3D
// (ver ui/thumbs.ts); mientras se genera, o si no se puede, se muestra una
// ilustración vectorial de la prenda (64×64).

const SHAPES: Record<string, string> = {
  top: 'M20 14c4 3 20 3 24 0l8 6-4 8-4-2v22H20V26l-4 2-4-8z',
  shellTop: 'M12 30c0-8 6-12 10-12s8 4 10 8c2-4 6-8 10-8s10 4 10 12c-6 2-14 2-20 0-6 2-14 2-20 0z',
  pants: 'M18 8h28l4 50h-12l-6-30-6 30H14z',
  skirt: 'M20 10h24l12 40H8z',
  dress: 'M24 6h16l-2 14 16 36H10l16-36z',
  jumpsuit: 'M22 6h20v18l4 32h-10l-4-22-4 22H18l4-32z',
  mermaid: 'M24 6h16l-2 16c2 10 0 20-4 26l12 10H18l12-10c-4-6-6-16-4-26z',
  fairy: 'M24 6h16l-2 14 10 10-6 4 8 12-10-2-8 10-8-10-10 2 8-12-6-4 10-10z',
  jacket: 'M22 8l-10 6v40h12V24l8 10 8-10v30h12V14l-10-6-10 10z',
  cape: 'M20 8h24l14 48H6z',
  wings: 'M32 30C22 8 6 10 6 22s14 10 26 8zm0 0c10-22 26-20 26-8s-14 10-26 8zm0 0C24 40 12 46 14 54s14-6 18-24zm0 0c8 10 20 16 18 24s-14-6-18-24z',
  heels: 'M10 44c8-2 14-10 20-12 8-2 18 6 24 10v6H40l-2-4H14v14h-4z',
  platform: 'M10 30c8 0 14 4 20 4s14-6 24-4v10l-2 14H40l-2-10H14v10H8z',
  kneeboots: 'M20 4h14l-2 34 20 8v8H30l-2-6h-6v10h-4z',
  boots: 'M18 14h16v24l18 6v10H16z',
  sneakers: 'M6 36c0-6 6-10 10-10l10 2 6 6 16 4c6 2 10 4 10 10v4H6z',
  sandals: 'M8 46h48v6H8zM14 46c4-10 10-12 14-12M26 46c2-8 8-12 14-12M38 46c2-6 6-10 10-10',
  ballet: 'M8 40c10-8 34-8 46 2 2 4 0 8-6 8H14c-6 0-8-6-6-10z',
  wedge: 'M8 40c10-6 30-10 44 0v8l-4 8H12l-4-6z',
  flipflops: 'M14 10c10-2 16 6 14 24s-6 24-12 24-10-8-10-22 0-24 8-26zM18 18l-4 14M18 18l6 14',
  baguette: 'M6 26h52v20c0 4-4 6-8 6H14c-4 0-8-2-8-6zM18 26c0-10 28-10 28 0',
  heartBag: 'M32 56S8 42 8 26a12 12 0 0 1 24-6 12 12 0 0 1 24 6c0 16-24 30-24 30zM22 14c0-10 20-10 20 0',
  clutch: 'M6 22h52v24c0 3-3 6-6 6H12c-3 0-6-3-6-6zM6 22l26 14 26-14',
  backpack: 'M14 18c0-8 8-12 18-12s18 4 18 12v34c0 4-4 6-8 6H22c-4 0-8-2-8-6zM22 34h20v14H22z',
  basket: 'M10 26h44l-6 30H16zM18 26c0-14 28-14 28 0',
  tote: 'M12 22h40l-4 36H16zM22 22c0-12 20-12 20 0',
  fanny: 'M10 30c0-6 10-10 22-10s22 4 22 10-10 12-22 12-22-6-22-12zM2 28h8M54 28h8',
  studded: 'M10 24h44v28H10zM18 24c0-12 28-12 28 0',
  fringeBag: 'M10 20h44v22H10zM14 42v14M20 42v14M26 42v14M32 42v14M38 42v14M44 42v14M50 42v14',
  furBag: 'M32 18c14 0 24 8 24 20s-10 20-24 20S8 50 8 38s10-20 24-20zM22 18c0-12 20-12 20 0',
  discoBag: 'M32 16a20 20 0 1 1 0 40 20 20 0 0 1 0-40zM24 16c0-10 16-10 16 0',
  shellBag: 'M32 56L8 28c4-10 14-18 24-18s20 8 24 18z',
  hoops: 'M18 10v6M18 30a12 12 0 1 0 0.1 0zM46 10v6M46 30a12 12 0 1 0 0.1 0z',
  starStuds: 'M18 18l3 7h7l-6 5 2 7-6-4-6 4 2-7-6-5h7zM46 18l3 7h7l-6 5 2 7-6-4-6 4 2-7-6-5h7z',
  crossDrops: 'M16 16h4v8h6v4h-6v18h-4V28h-6v-4h6zM44 16h4v8h6v4h-6v18h-4V28h-6v-4h6z',
  featherDrops: 'M18 10c8 10 8 30 0 44-8-14-8-34 0-44zM46 10c8 10 8 30 0 44-8-14-8-34 0-44z',
  heartHoops: 'M18 52S6 44 6 34a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 10-12 18-12 18zM46 52s-12-8-12-18a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 10-12 18-12 18z',
  pearlDrops: 'M18 14v14M18 40a8 8 0 1 1 0.1 0zM46 14v14M46 40a8 8 0 1 1 0.1 0z',
  choker: 'M8 22c8 10 40 10 48 0v8c-8 10-40 10-48 0zM28 34h8l-4 6z',
  diamondChoker: 'M8 22c8 10 40 10 48 0v8c-8 10-40 10-48 0z',
  chainLock: 'M8 12c4 22 44 22 48 0M24 34h16v14H24zM27 34v-5a5 5 0 0 1 10 0v5',
  heartPendant: 'M8 10c4 24 44 24 48 0M32 52s-10-6-10-13a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 7-10 13-10 13z',
  pearls: 'M8 14c4 30 44 30 48 0',
  shells: 'M8 14c4 30 44 30 48 0M32 50l-8-10c2-4 6-6 8-6s6 2 8 6z',
  bangles: 'M32 14a18 8 0 1 1-0.1 0zM32 26a18 8 0 1 1-0.1 0zM32 38a18 8 0 1 1-0.1 0z',
  watch: 'M24 4h16v12H24zM24 48h16v12H24zM20 16h24v32H20z',
  studCuff: 'M8 22h48v20H8z',
  cuff: 'M8 20c10-4 38-4 48 0v24c-10 4-38 4-48 0z',
  heartGlasses: 'M18 44S4 36 4 26a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 10-14 18-14 18zM46 44S32 36 32 26a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 10-14 18-14 18z',
  starGlasses: 'M18 14l4 9h10l-8 6 3 10-9-6-9 6 3-10-8-6h10zM46 14l4 9h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z',
  catEye: 'M4 26c4-4 12-6 22-2v8c-2 6-10 8-16 4-4-2-6-6-6-10zM60 26c-4-4-12-6-22-2v8c2 6 10 8 16 4 4-2 6-6 6-10zM26 28h12',
  round: 'M18 20a10 10 0 1 1-0.1 0zM46 20a10 10 0 1 1-0.1 0zM28 30h8',
  shield: 'M4 24c18-6 38-6 56 0l-4 14c-16 4-32 4-48 0z',
  aviator: 'M6 22h22c0 12-4 18-12 18S6 32 6 22zM36 22h22c0 10-2 18-10 18s-12-6-12-18zM28 24h8',
  rect: 'M4 24h24v12H4zM36 24h24v12H36zM28 28h8',
  butterfly: 'M4 20c8-4 18-2 24 4-2 10-8 14-16 12S4 28 4 20zM60 20c-8-4-18-2-24 4 2 10 8 14 16 12s8-8 8-16z',
  oval: 'M16 22a12 8 0 1 1-0.1 0zM48 22a12 8 0 1 1-0.1 0zM28 30h8',
  sport: 'M4 26c14-8 42-8 56 0v8c-14 6-42 6-56 0z',
  big: 'M4 20h24v18c0 4-4 6-8 6H8c-2 0-4-2-4-6zM36 20h24v18c0 4-2 6-4 6h-12c-4 0-8-2-8-6zM28 24h8',
  gemGlasses: 'M18 22a12 10 0 1 1-0.1 0zM46 22a12 10 0 1 1-0.1 0z',
  bucket: 'M18 18c0-6 6-10 14-10s14 4 14 10l2 14 10 8H6l10-8z',
  beret: 'M6 34c0-12 14-20 30-18 14 2 22 10 20 18-8 4-42 4-50 0zM40 14l2-6',
  cowboy: 'M20 28l2-16c4-4 8 0 10 0s6-4 10 0l2 16zM2 30c8 6 52 6 60 0-2 8-14 12-30 12S4 38 2 30z',
  beanie: 'M12 40c0-18 8-28 20-28s20 10 20 28zM10 40h44v8H10zM32 12a5 5 0 1 1 0.1 0',
  cap: 'M10 38c0-16 10-24 22-24s22 8 22 24zM10 38h50c0 4-4 6-10 6H10z',
  sunhat: 'M20 30c0-10 4-16 12-16s12 6 12 16zM2 34c8-6 52-6 60 0-6 8-20 10-30 10S8 42 2 34z',
  fedora: 'M18 32l2-16c6-4 10 2 12 0 2 2 6-4 12 0l2 16zM4 34c8-4 48-4 56 0-6 6-48 6-56 0z',
  furHat: 'M10 42c0-20 10-30 22-30s22 10 22 30c-8 4-36 4-44 0z',
  visor: 'M8 30c8-6 40-6 48 0v6H8zM8 36c10 8 34 10 48 4',
  crown: 'M8 46V18l12 12 12-18 12 18 12-12v28z',
  bandana: 'M6 24c10-10 42-10 52 0L32 50zM54 24l6 10M58 26l-2 12',
  headscarf: 'M8 30c4-14 44-14 48 0-6 8-42 8-48 0zM52 34l8 10M50 36l2 14',
  butterflyClips: 'M32 18v28M32 22c-4-10-20-12-20 0s10 10 20 4M32 22c4-10 20-12 20 0s-10 10-20 4M32 30c-4 2-14 6-10 14s10-6 10-14M32 30c4 2 14 6 10 14s-10-6-10-14',
  scrunchie: 'M32 12a20 20 0 1 1-0.1 0zM32 22a10 10 0 1 0 0.1 0z',
  headband: 'M6 46C6 22 18 10 32 10s26 12 26 36h-6c0-20-10-30-20-30S12 26 12 46z',
  tiara: 'M6 44c8-8 44-8 52 0v4c-8-6-44-6-52 0zM32 14l4 18h-8zM18 22l4 14h-6zM46 22l2 14h-6z',
  bow: 'M32 32L8 16v32zM32 32l24-16v32zM28 28h8v8h-8z',
  flower: 'M32 22a8 8 0 1 1 0.1 0zM32 6c6 0 6 10 0 14-6-4-6-14 0-14zM58 28c0 6-10 6-14 0 4-6 14-6 14 0zM6 28c0-6 10-6 14 0-4 6-14 6-14 0zM46 54c-4 4-12-2-10-8 6-2 14 4 10 8zM18 54c-4-4 4-10 10-8 2 6-6 12-10 8z',
  starPins: 'M18 8l4 9h10l-8 6 3 10-9-6-9 6 3-10-8-6h10zM46 30l3 7h7l-6 5 2 7-6-4-6 4 2-7-6-5h7z',
  claw: 'M10 30h44v8H10zM14 38v14M22 38v16M30 38v16M38 38v16M46 38v16M52 38v14M12 30c4-14 36-14 40 0',
  flowerCrown: 'M6 40c8-10 44-10 52 0M12 34a6 6 0 1 1 0.1 0zM26 28a6 6 0 1 1 0.1 0zM40 28a6 6 0 1 1 0.1 0zM52 34a6 6 0 1 1 0.1 0z',
  pearlPins: 'M16 24a7 7 0 1 1 0.1 0zM32 18a7 7 0 1 1 0.1 0zM48 24a7 7 0 1 1 0.1 0z',
  safetyPins: 'M10 20h40a6 6 0 0 1 0 12H14M10 36h40a6 6 0 0 1 0 12H14',
  sweatband: 'M6 26h52v14H6z',
  pearlTiara: 'M6 44c8-8 44-8 52 0M16 32a5 5 0 1 1 0.1 0zM32 22a7 7 0 1 1 0.1 0zM48 32a5 5 0 1 1 0.1 0z',
  fairyCrown: 'M8 46l4-26 8 14 6-22 6 18 6-18 6 22 8-14 4 26z',
}

const STROKE_ONLY = new Set(['hoops', 'pearls', 'chainLock', 'heartPendant', 'shells', 'sandals', 'flipflops', 'safetyPins', 'claw', 'flowerCrown', 'pearlDrops'])

function PatternDef({ id, pattern, c1, c2 }: { id: string; pattern: PatternId; c1: string; c2: string }) {
  switch (pattern) {
    case 'rayas':
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={c1} />
          <rect width="8" height="3" fill={c2} />
        </pattern>
      )
    case 'escoces':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={c1} />
          <rect width="12" height="4" fill={c2} opacity="0.55" />
          <rect width="4" height="12" fill={c2} opacity="0.55" />
          <rect x="7" width="1" height="12" fill="#fff" opacity="0.6" />
        </pattern>
      )
    case 'leopardo':
    case 'cebra':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={c1} />
          {pattern === 'leopardo' ? (
            <>
              <circle cx="3" cy="3" r="2" fill="none" stroke={c2} strokeWidth="1.4" />
              <circle cx="9" cy="8" r="1.6" fill="none" stroke={c2} strokeWidth="1.4" />
            </>
          ) : (
            <path d="M0 3c4 2 8-2 12 0v2C8 3 4 7 0 5zM0 9c4 2 8-2 12 0v2c-4-2-8 2-12 0z" fill={c2} />
          )}
        </pattern>
      )
    case 'corazones':
    case 'estrellas':
    case 'flores':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={c1} />
          {pattern === 'corazones' && <path d="M6 9S2 7 2 4.5a2 2 0 0 1 4-.8 2 2 0 0 1 4 .8C10 7 6 9 6 9z" fill={c2} />}
          {pattern === 'estrellas' && <path d="M6 2l1.2 2.6 2.8.3-2.1 1.9.6 2.8L6 8.2 3.5 9.6l.6-2.8L2 4.9l2.8-.3z" fill={c2} />}
          {pattern === 'flores' && (
            <>
              <circle cx="6" cy="6" r="3" fill={c2} />
              <circle cx="6" cy="6" r="1.2" fill="#ffd34d" />
            </>
          )}
        </pattern>
      )
    case 'denim':
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={c1} />
          <path d="M0 6L6 0" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
        </pattern>
      )
    case 'purpurina':
    case 'lentejuelas':
    case 'escamas':
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={c1} />
          <circle cx="2" cy="2" r="1.6" fill="#fff" opacity="0.55" />
          <circle cx="6" cy="6" r="1.6" fill="#fff" opacity="0.35" />
        </pattern>
      )
    case 'rejilla':
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0L8 8M8 0L0 8" stroke={c1} strokeWidth="1.6" />
        </pattern>
      )
    default:
      return null
  }
}

type GlyphProps = { item: ItemDef; color?: string; color2?: string; pattern?: PatternId }

export function ItemGlyph(props: GlyphProps) {
  const url = useThumb(props.item, props.color, props.color2, props.pattern)
  if (url) return <img className="glyph thumb" src={url} alt="" draggable={false} decoding="async" data-thumb={props.item.id} />
  return <VectorGlyph {...props} />
}

export function VectorGlyph({ item, color, color2, pattern }: GlyphProps) {
  const uid = useId().replace(/:/g, '')
  const c1 = color ?? item.color
  const c2 = color2 ?? item.color2 ?? '#ffffff'
  const pat = pattern ?? item.pattern ?? 'liso'
  const d = SHAPES[item.model] ?? SHAPES.top
  const stroke = STROKE_ONLY.has(item.model)
  const metal = item.fabric === 'metal' || item.fabric === 'gem' || item.fabric === 'holo' || item.fabric === 'pearl'
  const fill = pat !== 'liso' && !stroke ? `url(#p${uid})` : metal ? `url(#g${uid})` : c1
  return (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <PatternDef id={`p${uid}`} pattern={pat} c1={c1} c2={c2} />
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={c1} />
          <stop offset="0.7" stopColor={item.fabric === 'holo' ? '#b9e6ff' : c1} />
          <stop offset="1" stopColor={item.fabric === 'holo' ? '#ffc6f0' : '#ffffff'} />
        </linearGradient>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {stroke ? (
        <path d={d} fill="none" stroke={metal ? `url(#g${uid})` : c1} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d={d} fill={fill} stroke="rgba(90,20,70,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d={d} fill={`url(#s${uid})`} />
        </>
      )}
    </svg>
  )
}

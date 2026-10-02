import type { ItemDef, StyleTag } from '../data/types'
import { hexToHsl } from './color'

// Búsqueda y filtros del vestidor: lógica pura (sin React ni three.js).

export type ColorFamily = 'rosa' | 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'azul' | 'morado' | 'marron' | 'negro' | 'blanco' | 'gris' | 'dorado'

/** Familias de color en el orden en que se muestran, con su nombre y una muestra. */
export const COLOR_FAMILIES: { id: ColorFamily; name: string; swatch: string }[] = [
  { id: 'rosa', name: 'Rosa', swatch: '#ff6fb5' },
  { id: 'rojo', name: 'Rojo', swatch: '#e8243c' },
  { id: 'naranja', name: 'Naranja', swatch: '#ff8a3d' },
  { id: 'amarillo', name: 'Amarillo', swatch: '#ffd84a' },
  { id: 'dorado', name: 'Dorado', swatch: '#d9a531' },
  { id: 'verde', name: 'Verde', swatch: '#3fcf8e' },
  { id: 'azul', name: 'Azul', swatch: '#4a9dff' },
  { id: 'morado', name: 'Morado', swatch: '#a36bff' },
  { id: 'marron', name: 'Marrón', swatch: '#8a5a3c' },
  { id: 'negro', name: 'Negro', swatch: '#1d1a22' },
  { id: 'gris', name: 'Gris y plata', swatch: '#b8b8c4' },
  { id: 'blanco', name: 'Blanco', swatch: '#fbf7f2' },
]

/** Nombres de los estilos tal y como se muestran en los filtros. */
export const STYLE_NAMES: Record<StyleTag, string> = {
  glam: 'Glam',
  street: 'Street',
  rock: 'Rock',
  boho: 'Boho',
  fiesta: 'Fiesta',
  playa: 'Playa',
  invierno: 'Invierno',
  romantico: 'Romántico',
  deportivo: 'Deportivo',
  y2k: 'Y2K',
  elegante: 'Elegante',
  magico: 'Mágico',
  ibiza: 'Ibiza',
}

/** Clasifica un color hexadecimal en una familia de color reconocible. */
export function colorFamily(hex: string, metallic = false): ColorFamily {
  const { h, s, l } = hexToHsl(hex)
  // croma aproximado: lo «colorido» que es, independiente de la luminosidad
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  if (l <= 0.13 || (l < 0.22 && s < 0.3)) return 'negro'
  if (s < 0.3 && l > 0.5 && l < 0.86) return 'gris'
  if (l > 0.7 && chroma < 0.125) return 'blanco'
  if (s < 0.16) return l < 0.35 ? 'negro' : 'gris'
  if (metallic && h >= 30 && h < 58 && l > 0.4) return 'dorado'
  if (h < 12 || h >= 345) return l > 0.72 ? 'rosa' : 'rojo'
  if (h >= 15 && h < 50 && (l < 0.42 || (s < 0.6 && l < 0.75))) return 'marron'
  if (h < 38) return 'naranja'
  if (h < 68) return 'amarillo'
  if (h < 165) return 'verde'
  if (h < 255) return 'azul'
  if (h < 290) return 'morado'
  return 'rosa'
}

/** Familia de color del catálogo para una prenda. */
export function itemColorFamily(item: ItemDef): ColorFamily {
  return colorFamily(item.color, item.fabric === 'metal' || item.fabric === 'gem' || item.fabric === 'sequin')
}

/** Minúsculas y sin tildes, para comparar textos escritos a mano. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export interface ItemFilter {
  query: string
  tags: StyleTag[]
  colors: ColorFamily[]
}

export const EMPTY_FILTER: ItemFilter = { query: '', tags: [], colors: [] }

export const isFiltering = (f: ItemFilter) => normalize(f.query) !== '' || f.tags.length > 0 || f.colors.length > 0

/**
 * ¿Cumple la prenda el filtro? La búsqueda mira el nombre, los estilos y el
 * color (todas las palabras deben aparecer); estilos y colores son «o» dentro
 * de cada grupo e «y» entre grupos.
 */
export function matchesItem(item: ItemDef, f: ItemFilter, categoryName = ''): boolean {
  if (f.tags.length && !item.tags.some((t) => f.tags.includes(t))) return false
  const fam = itemColorFamily(item)
  if (f.colors.length && !f.colors.includes(fam)) return false
  const words = normalize(f.query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const famName = COLOR_FAMILIES.find((c) => c.id === fam)?.name ?? ''
  const hay = normalize([item.name, categoryName, famName, ...item.tags, ...item.tags.map((t) => STYLE_NAMES[t])].join(' '))
  return words.every((w) => hay.includes(w))
}

/** Filtra una lista de prendas conservando su orden. */
export function filterItems(items: ItemDef[], f: ItemFilter, categoryName: (item: ItemDef) => string = () => ''): ItemDef[] {
  if (!isFiltering(f)) return items
  return items.filter((i) => matchesItem(i, f, categoryName(i)))
}

/** Estilos y familias de color que aparecen en una lista de prendas (para no ofrecer filtros vacíos). */
export function availableFacets(items: ItemDef[]): { tags: StyleTag[]; colors: ColorFamily[] } {
  const tags = new Set<StyleTag>()
  const colors = new Set<ColorFamily>()
  for (const i of items) {
    i.tags.forEach((t) => tags.add(t))
    colors.add(itemColorFamily(i))
  }
  return {
    tags: (Object.keys(STYLE_NAMES) as StyleTag[]).filter((t) => tags.has(t)),
    colors: COLOR_FAMILIES.map((c) => c.id).filter((c) => colors.has(c)),
  }
}

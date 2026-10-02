import type { Expression } from '../data/types'
import type { IconName } from './Icon'

// Expresiones de la cara en el orden en que las recorre el botón.
export const EXPRESSIONS: { id: Expression; label: string; icon: IconName }[] = [
  { id: 'sonrisa', label: 'Sonrisa', icon: 'smile' },
  { id: 'dientes', label: 'Sonrisa con dientes', icon: 'grin' },
  { id: 'risa', label: 'Risa', icon: 'laugh' },
  { id: 'guino', label: 'Guiño', icon: 'wink' },
  { id: 'sorpresa', label: 'Sorpresa', icon: 'surprise' },
  { id: 'seria', label: 'Seria', icon: 'pout' },
]

export const expressionInfo = (e: Expression) => EXPRESSIONS.find((x) => x.id === e) ?? EXPRESSIONS[0]

export function nextExpression(e: Expression): Expression {
  const i = EXPRESSIONS.findIndex((x) => x.id === e)
  return EXPRESSIONS[(i + 1) % EXPRESSIONS.length].id
}

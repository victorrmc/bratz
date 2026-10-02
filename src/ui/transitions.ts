import { useGame, type Screen } from '../store/game'

// Transiciones entre pantallas sin «interfaz fantasma».
//
// En la ronda 1 la salida se animaba con AnimatePresence: la pantalla nueva
// esperaba a que terminase la vieja, y bajo carga esa animación (por
// requestAnimationFrame) se quedaba a medias, dejando la UI semitransparente
// o sin montar. Ahora:
//  - React cambia de pantalla al instante: el estado y la interfaz real nunca
//    esperan a una animación.
//  - Lo que se ve salir es una copia estática del DOM anterior, sin ids ni
//    data-testid, inerte, oculta a la accesibilidad y sin eventos de puntero.
//  - Entrada y salida son animaciones CSS por tiempo (no dependen de JS), y la
//    copia se elimina al acabar o, pase lo que pase, con un temporizador.

const DEPTH: Partial<Record<Screen, number>> = { home: 0, jury: 2, letter: 2, challenge: 2 }
const depth = (s: Screen) => DEPTH[s] ?? 1

export const EXIT_MS = 280
let dir: 'fwd' | 'back' = 'fwd'
let ghost: HTMLElement | null = null
let ghostTimer = 0

/** Dirección del último cambio de pantalla (para el sentido del deslizamiento). */
export const transitionDir = () => dir

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function removeGhost() {
  window.clearTimeout(ghostTimer)
  ghost?.remove()
  ghost = null
}

function spawnGhost(from: HTMLElement) {
  removeGhost()
  if (reducedMotion()) return
  const clone = from.cloneNode(true) as HTMLElement
  // una copia muda: nada de ids, testids, foco ni lectores de pantalla
  for (const el of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
    el.removeAttribute('id')
    el.removeAttribute('data-testid')
    el.removeAttribute('data-screen')
    el.removeAttribute('tabindex')
  }
  clone.className = `ui-layer screen-ghost ${dir}`
  clone.setAttribute('aria-hidden', 'true')
  clone.setAttribute('inert', '')
  // conserva la posición de las listas desplazadas
  const src = from.querySelectorAll<HTMLElement>('*')
  const dst = clone.querySelectorAll<HTMLElement>('*')
  const scrolls: [HTMLElement, number, number][] = []
  src.forEach((el, i) => {
    if (el.scrollTop || el.scrollLeft) scrolls.push([dst[i], el.scrollTop, el.scrollLeft])
  })
  document.body.appendChild(clone)
  for (const [el, t, l] of scrolls) {
    el.scrollTop = t
    el.scrollLeft = l
  }
  ghost = clone
  clone.addEventListener('animationend', (e) => e.target === clone && removeGhost())
  ghostTimer = window.setTimeout(removeGhost, EXIT_MS + 220)
}

let installed = false

/** Se engancha al store: justo antes de que React cambie de pantalla, copia la saliente. */
export function installScreenTransitions() {
  if (installed) return
  installed = true
  useGame.subscribe((s, prev) => {
    if (s.screen === prev.screen) return
    dir = depth(s.screen) < depth(prev.screen) ? 'back' : 'fwd'
    // los suscriptores de zustand se llaman antes de que React vuelva a pintar:
    // en el DOM sigue la pantalla anterior
    const layer = document.querySelector<HTMLElement>(`.ui-layer[data-screen="${prev.screen}"]`)
    if (layer) spawnGhost(layer)
  })
}

import { create } from 'zustand'

// Estado compartido entre la UI 2D y la escena 3D (sin re-render de React
// en cada frame: el 3D lo lee en useFrame).

export const interaction = {
  dollRotY: 0,
  zoom: 1,
  dragging: false,
  /** callbacks registrados por la escena */
  capture: null as null | ((opts: { w: number; h: number; type?: string; quality?: number; post?: boolean }) => string | null),
  fps: 60,
}

interface ViewState {
  insetBottom: number
  insetRight: number
  insetTop: number
  ready: boolean
  progress: number
  set: (p: Partial<Omit<ViewState, 'set'>>) => void
}

export const useView = create<ViewState>((set) => ({
  insetBottom: 0,
  insetRight: 0,
  insetTop: 0,
  ready: false,
  progress: 0,
  set: (p) => set(p),
}))

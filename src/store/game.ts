import { create } from 'zustand'
import type { Category, Expression, ItemDef, Look, Slot } from '../data/types'
import { DOLL_BY_ID, DOLLS } from '../data/characters'
import { CHALLENGE_BY_ID } from '../data/challenges'
import { ITEM_BY_ID } from '../data/items'
import { cloneLook, defaultLookFor, randomLook, rng, toggleItem, updateInstance } from '../game/look'
import { applyChallengeResult, availableItems, buyItem, isItemUnlocked, registerHeartTap, unlockEverything, type Reward } from '../game/economy'
import { clearSave, defaultSave, loadSave, writeSave, type Quality, type SaveData } from '../game/save'
import { addLook, deleteLook, duplicateLook, renameLook } from '../game/wardrobe'
import { scoreLook, juryComments, type ScoreBreakdown } from '../game/scoring'
import { createStorySlice, type StorySlice } from './story'

export type Screen =
  | 'home'
  | 'studio'
  | 'photo'
  | 'challenges'
  | 'challenge'
  | 'jury'
  | 'runway'
  | 'wardrobe'
  | 'shop'
  | 'ending'
  | 'letter'
  | 'story'
  | 'memories'

export type CamPreset = 'cuerpo' | 'cara' | 'manos' | 'pies'
export type EditTab = 'ropa' | 'pelo' | 'maquillaje' | 'unas'

export interface JuryResult {
  challengeId: string
  score: ScoreBreakdown
  comments: string[]
  reward: Reward
}

export interface Toast {
  id: number
  text: string
  kind?: 'info' | 'success' | 'unlock'
}

export interface State extends StorySlice {
  save: SaveData
  screen: Screen
  prevScreen: Screen
  look: Look
  expression: Expression
  pose: string
  cam: CamPreset
  tab: EditTab
  category: Category
  selectedSlot: Slot | null
  stage: string
  challengeId: string | null
  challengeStart: number
  timedChallenge: boolean
  jury: JuryResult | null
  heartTaps: number
  /** Contador que se incrementa con cada cambio de prenda (destellos). */
  sparkle: number
  confetti: number
  flash: number
  toasts: Toast[]
  quality: 'baja' | 'media' | 'alta'
  previewItem: string | null
  onboardingStep: number
  audioReady: boolean

  go: (s: Screen) => void
  back: () => void
  setDoll: (id: string) => void
  wear: (item: ItemDef) => void
  setInstance: (slot: Slot, patch: Partial<NonNullable<Look['outfit'][Slot]>>) => void
  setLook: (fn: (l: Look) => Look) => void
  surprise: () => void
  setExpression: (e: Expression) => void
  setPose: (p: string) => void
  setCam: (c: CamPreset) => void
  setTab: (t: EditTab) => void
  setCategory: (c: Category) => void
  selectSlot: (s: Slot | null) => void
  setStage: (s: string) => void
  startChallenge: (id: string, timed?: boolean) => void
  submitChallenge: () => JuryResult | null
  saveLook: (name: string, thumb?: string) => void
  renameLook: (id: string, name: string) => void
  duplicateLook: (id: string) => void
  deleteLook: (id: string) => void
  loadLook: (id: string) => void
  buy: (id: string) => boolean
  tapHeart: () => boolean
  setSettings: (p: Partial<SaveData['settings']>) => void
  setQuality: (q: 'baja' | 'media' | 'alta') => void
  finishOnboarding: () => void
  setOnboardingStep: (n: number) => void
  markEndingSeen: () => void
  toast: (text: string, kind?: Toast['kind']) => void
  dropToast: (id: number) => void
  setPreview: (id: string | null) => void
  burstConfetti: () => void
  doFlash: () => void
  debugUnlockAll: () => void
  debugReset: () => void
  setAudioReady: () => void
}

const initial = loadSave()
const firstDoll = DOLL_BY_ID[initial.activeDoll] ? initial.activeDoll : DOLLS[0].id

function persist(s: SaveData) {
  writeSave(s)
}

let toastId = 0

export const useGame = create<State>((set, get) => ({
  ...createStorySlice(set, get),
  save: initial,
  screen: 'home',
  prevScreen: 'home',
  look: initial.current[firstDoll] ? cloneLook(initial.current[firstDoll]) : defaultLookFor(firstDoll),
  expression: 'sonrisa',
  pose: 'idle',
  cam: 'cuerpo',
  tab: 'ropa',
  category: 'tops',
  selectedSlot: null,
  stage: 'disco',
  challengeId: null,
  challengeStart: 0,
  timedChallenge: false,
  jury: null,
  heartTaps: 0,
  sparkle: 0,
  confetti: 0,
  flash: 0,
  toasts: [],
  quality: 'alta',
  previewItem: null,
  onboardingStep: 0,
  audioReady: false,

  go: (screen) => set((st) => ({ screen, prevScreen: st.screen, previewItem: null, pose: screen === 'runway' || screen === 'ending' ? 'walk' : st.pose === 'walk' ? 'idle' : st.pose })),
  back: () => {
    const st = get()
    if (st.screen === 'story' && st.storyPhase !== 'map') return st.openStory()
    const map: Partial<Record<Screen, Screen>> = {
      challenge: 'challenges',
      jury: 'challenges',
      letter: 'home',
      ending: 'home',
    }
    st.go(map[st.screen] ?? 'home')
  },
  setDoll: (id) => {
    const st = get()
    const current = { ...st.save.current, [st.look.dollId]: cloneLook(st.look) }
    const next = current[id] ? cloneLook(current[id]) : defaultLookFor(id)
    const save = { ...st.save, current, activeDoll: id }
    persist(save)
    set({ save, look: next, sparkle: st.sparkle + 1 })
  },
  wear: (item) => {
    const st = get()
    if (!isItemUnlocked(item, st.save)) return
    const look = toggleItem(st.look, item)
    const worn = look.outfit[item.slot]?.itemId === item.id
    commitLook(set, get, look)
    set({ sparkle: st.sparkle + 1, selectedSlot: worn ? item.slot : null })
  },
  setInstance: (slot, patch) => commitLook(set, get, updateInstance(get().look, slot, patch)),
  setLook: (fn) => {
    commitLook(set, get, fn(cloneLook(get().look)))
    set((st) => ({ sparkle: st.sparkle + 1 }))
  },
  surprise: () => {
    const st = get()
    const look = randomLook(st.look, availableItems(st.save), rng(Date.now() & 0xffffff))
    commitLook(set, get, look)
    set({ sparkle: st.sparkle + 1 })
  },
  setExpression: (expression) => set({ expression }),
  setPose: (pose) => set({ pose }),
  setCam: (cam) => set({ cam }),
  setTab: (tab) => set({ tab, cam: tab === 'maquillaje' ? 'cara' : tab === 'unas' ? 'manos' : tab === 'pelo' ? 'cara' : get().cam === 'manos' || get().cam === 'cara' ? 'cuerpo' : get().cam }),
  setCategory: (category) => set({ category, cam: category === 'shoes' ? 'pies' : ['glasses', 'hats', 'hairAcc', 'jewelry'].includes(category) ? 'cara' : 'cuerpo' }),
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  setStage: (stage) => set({ stage }),
  startChallenge: (id, timed = false) => set({ challengeId: id, challengeStart: Date.now(), timedChallenge: timed, screen: 'challenge', prevScreen: 'challenges', jury: null, stage: CHALLENGE_BY_ID[id]?.stage ?? 'disco', cam: 'cuerpo' }),
  submitChallenge: () => {
    const st = get()
    const ch = st.challengeId ? CHALLENGE_BY_ID[st.challengeId] : null
    if (!ch) return null
    const score = scoreLook(st.look, ch)
    const before = st.save
    const { save, reward } = applyChallengeResult(before, ch.id, score.stars)
    persist(save)
    const result: JuryResult = { challengeId: ch.id, score, comments: juryComments(score.stars, Math.floor(Math.random() * 3)), reward }
    // avisos de prendas desbloqueadas
    const newly = Object.values(ITEM_BY_ID).filter((i) => i.rarity === 'secreta' && !isItemUnlocked(i, before) && isItemUnlocked(i, save))
    set({ save, jury: result, screen: 'jury', prevScreen: 'challenge', confetti: st.confetti + (score.stars >= 3 ? 1 : 0), pose: score.stars >= 4 ? 'star' : 'hip' })
    for (const i of newly) get().toast(`¡Prenda secreta desbloqueada: ${i.name}!`, 'unlock')
    if (!before.endingUnlocked && save.endingUnlocked) get().toast('¡Has desbloqueado el final secreto!', 'unlock')
    return result
  },
  saveLook: (name, thumb) => {
    const st = get()
    const save = { ...st.save, looks: addLook(st.save.looks, st.look, name, Date.now(), thumb) }
    persist(save)
    set({ save })
    get().toast('Look guardado en el armario', 'success')
  },
  renameLook: (id, name) => updateSave(set, get, (s) => ({ ...s, looks: renameLook(s.looks, id, name) })),
  duplicateLook: (id) => updateSave(set, get, (s) => ({ ...s, looks: duplicateLook(s.looks, id, Date.now()) })),
  deleteLook: (id) => updateSave(set, get, (s) => ({ ...s, looks: deleteLook(s.looks, id) })),
  loadLook: (id) => {
    const st = get()
    const l = st.save.looks.find((x) => x.id === id)
    if (!l) return
    commitLook(set, get, cloneLook(l.look))
    set({ sparkle: st.sparkle + 1, screen: 'studio', prevScreen: 'wardrobe' })
  },
  buy: (id) => {
    const st = get()
    const r = buyItem(st.save, id)
    if (!r.ok) {
      const msg = { 'sin-monedas': 'No tienes suficientes monedas', 'ya-tienes': 'Ya la tienes', 'no-a-la-venta': 'No está a la venta', 'no-encontrada': 'No existe' }[r.reason]
      get().toast(msg)
      return false
    }
    persist(r.save)
    set({ save: r.save, confetti: st.confetti + 1 })
    get().toast(`¡${ITEM_BY_ID[id]?.name} es tuya!`, 'success')
    return true
  },
  tapHeart: () => {
    const st = get()
    const r = registerHeartTap(st.save, st.heartTaps)
    if (r.save !== st.save) persist(r.save)
    set({ save: r.save, heartTaps: r.taps })
    return r.triggered
  },
  setSettings: (p) => updateSave(set, get, (s) => ({ ...s, settings: { ...s.settings, ...p } })),
  setQuality: (quality) => set({ quality }),
  finishOnboarding: () => {
    updateSave(set, get, (s) => ({ ...s, onboardingDone: true }))
    set({ onboardingStep: 3 })
  },
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  markEndingSeen: () => updateSave(set, get, (s) => ({ ...s, endingSeen: true })),
  toast: (text, kind = 'info') => {
    const id = ++toastId
    set((st) => ({ toasts: [...st.toasts.slice(-2), { id, text, kind }] }))
    setTimeout(() => get().dropToast(id), 3200)
  },
  dropToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  setPreview: (previewItem) => set({ previewItem }),
  burstConfetti: () => set((st) => ({ confetti: st.confetti + 1 })),
  doFlash: () => set((st) => ({ flash: st.flash + 1 })),
  debugUnlockAll: () => {
    updateSave(set, get, (s) => unlockEverything(s))
    get().toast('Todo desbloqueado (debug)', 'unlock')
  },
  debugReset: () => {
    clearSave()
    void get().resetStoryMemories()
    const save = defaultSave()
    set({ save, look: defaultLookFor(save.activeDoll), screen: 'home', onboardingStep: 0 })
  },
  setAudioReady: () => set({ audioReady: true }),
}))

type Setter = (p: Partial<State> | ((s: State) => Partial<State>)) => void

let lookTimer: ReturnType<typeof setTimeout> | null = null
function commitLook(set: Setter, get: () => State, look: Look) {
  set({ look })
  // el look en edición se guarda con un pequeño retardo
  if (lookTimer) clearTimeout(lookTimer)
  lookTimer = setTimeout(() => {
    const st = get()
    const save = { ...st.save, current: { ...st.save.current, [st.look.dollId]: cloneLook(st.look) }, activeDoll: st.look.dollId }
    persist(save)
    useGame.setState({ save })
  }, 250)
}

function updateSave(set: Setter, get: () => State, fn: (s: SaveData) => SaveData) {
  const save = fn(get().save)
  persist(save)
  set({ save })
}

export function effectiveQuality(setting: Quality, auto: 'baja' | 'media' | 'alta'): 'baja' | 'media' | 'alta' {
  return setting === 'auto' ? auto : setting
}

export const isDebug = () => {
  try {
    return new URLSearchParams(location.search).get('debug') === '1'
  } catch {
    return false
  }
}

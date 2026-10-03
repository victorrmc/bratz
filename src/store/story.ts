import { CHAPTERS, CHAPTER_BY_ID } from '../data/chapters'
import { PROTAGONIST_ID } from '../data/characters'
import { juryComments } from '../game/scoring'
import { applyChallengeResult } from '../game/economy'
import { writeSave } from '../game/save'
import { clearMemories, putMemory } from '../game/memories'
import { applyChapterResult, isChapterUnlocked, isLastChapter, nextChapter, scoreChapter, suggestedLook, type ChapterScore } from '../game/story'
import type { State } from './game'

// Estado del modo historia «Rumbo a Ibiza», como slice del store principal.

export type StoryPhase = 'map' | 'intro' | 'dress' | 'jury' | 'memory' | 'outro'

export interface StorySlice {
  storyChapter: string | null
  storyPhase: StoryPhase
  storyResult: (ChapterScore & { chapterId: string }) | null
  openStory: () => void
  startChapter: (id: string) => boolean
  setStoryPhase: (p: StoryPhase) => void
  helpDressChapter: () => void
  submitChapter: () => ChapterScore | null
  saveChapterMemory: (image: string) => Promise<boolean>
  finishChapter: () => void
  resetStoryMemories: () => Promise<boolean>
}

type Set = (p: Partial<State> | ((s: State) => Partial<State>)) => void
type Get = () => State

/** Pose de Clara en cada momento del capítulo. */
function poseFor(phase: StoryPhase, chapterId: string | null): string {
  const ch = chapterId ? CHAPTER_BY_ID[chapterId] : null
  if (phase === 'intro') return 'wave'
  if (phase === 'memory') return ch?.pose ?? 'hip'
  if (phase === 'outro') return 'star'
  return 'idle'
}

export function createStorySlice(set: Set, get: Get): StorySlice {
  return {
    storyChapter: null,
    storyPhase: 'map',
    storyResult: null,

    openStory: () => {
      const st = get()
      const next = nextChapter(st.save.story) ?? CHAPTERS[CHAPTERS.length - 1]
      st.go('story')
      set({ storyPhase: 'map', storyChapter: next.id, storyResult: null, stage: next.stage, pose: 'idle' })
    },

    startChapter: (id) => {
      const st = get()
      const ch = CHAPTER_BY_ID[id]
      if (!ch || !isChapterUnlocked(st.save.story, id)) return false
      // la historia es la de Clara
      if (st.look.dollId !== PROTAGONIST_ID) st.setDoll(PROTAGONIST_ID)
      set({ storyChapter: id, storyPhase: 'intro', storyResult: null, stage: ch.stage, jury: null, cam: 'cuerpo', tab: 'ropa', pose: poseFor('intro', id) })
      return true
    },

    setStoryPhase: (storyPhase) => set((s) => ({ storyPhase, pose: poseFor(storyPhase, s.storyChapter), cam: 'cuerpo' })),

    helpDressChapter: () => {
      const ch = CHAPTER_BY_ID[get().storyChapter ?? '']
      if (ch) get().setLook((l) => suggestedLook(l, ch))
    },

    submitChapter: () => {
      const st = get()
      const ch = CHAPTER_BY_ID[st.storyChapter ?? '']
      if (!ch) return null
      const result = scoreChapter(st.look, ch)
      const stars = result.score.stars
      // monedas como en los retos (solo se paga la mejora) y progreso de la historia
      const paid = applyChallengeResult(st.save, ch.challenge.id, stars)
      const save = applyChapterResult(paid.save, ch.id, result, Date.now())
      writeSave(save)
      set({
        save,
        storyResult: { ...result, chapterId: ch.id },
        storyPhase: 'jury',
        jury: { challengeId: ch.challenge.id, score: result.score, comments: juryComments(stars, Math.floor(Math.random() * 3)), reward: paid.reward },
        confetti: st.confetti + (result.passed ? 1 : 0),
        pose: stars >= 4 ? 'star' : 'hip',
      })
      if (!st.save.endingUnlocked && save.endingUnlocked) get().toast('¡Has desbloqueado el final!', 'unlock')
      return result
    },

    saveChapterMemory: async (image) => {
      const st = get()
      const ch = CHAPTER_BY_ID[st.storyChapter ?? '']
      if (!ch) return false
      const stars = st.save.story.chapters[ch.id]?.stars ?? st.storyResult?.score.stars ?? 3
      return putMemory({ chapterId: ch.id, image, stage: ch.stage, stars, caption: ch.memory, createdAt: Date.now() })
    },

    finishChapter: () => {
      const st = get()
      const id = st.storyChapter
      if (id && isLastChapter(id) && st.save.story.chapters[id]) {
        // el final y la carta de siempre
        st.go('ending')
        return
      }
      st.openStory()
    },

    resetStoryMemories: () => clearMemories(),
  }
}

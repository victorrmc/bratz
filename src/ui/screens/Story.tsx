import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/game'
import { CHAPTERS, CHAPTER_BY_ID, STORY_TEXT, type ChapterDef, type Vignette } from '../../data/chapters'
import { STAGE_BY_ID } from '../../data/stages'
import { completedChapters, isChapterDone, isChapterUnlocked, isLastChapter, isStoryComplete, requirementStatus } from '../../game/story'
import { listMemories, type Memory } from '../../game/memories'
import { tagLabel } from '../../game/scoring'
import { Btn, Modal, Stars, TopBar, useInsetReporter, useInsetTop } from '../kit'
import { Icon, type IconName } from '../Icon'
import { interaction, useView } from '../../three/view'
import { audio, buzz } from '../../audio/engine'
import StudioScreen from './Studio'
import { JuryScreen } from './Challenges'

// Modo historia «Rumbo a Ibiza»: capítulos, viñetas, reto, jurado y recuerdo.
// Los textos están en src/data/chapters.ts.

const CHAPTER_ORDER = CHAPTERS.map((c) => c.id)

/** Mide el panel inferior para que la muñeca quede en la zona libre. */
function useBottomPanel() {
  const ref = useRef<HTMLDivElement>(null)
  const setView = useView((s) => s.set)
  const reporter = useCallback((b: number, r: number) => setView({ insetBottom: b, insetRight: r }), [setView])
  useInsetReporter(ref, reporter)
  return ref
}

function ProgressBar({ done }: { done: number }) {
  return (
    <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.7)', overflow: 'hidden' }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${(done / CHAPTERS.length) * 100}%` }} style={{ height: '100%', background: 'linear-gradient(90deg,#ff7ac8,#c43bff)' }} />
    </div>
  )
}

// ───────────────────── Lista de capítulos ─────────────────────

function ChapterMap() {
  const progress = useGame((s) => s.save.story)
  const startChapter = useGame((s) => s.startChapter)
  const go = useGame((s) => s.go)
  const toast = useGame((s) => s.toast)
  const panel = useBottomPanel()
  useInsetTop(70)
  const done = completedChapters(progress)
  return (
    <>
      <TopBar title={STORY_TEXT.title} />
      <motion.div
        ref={panel}
        className="glass scroll"
        data-testid="story-map"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
        style={{ position: 'fixed', left: 10, right: 10, bottom: 'calc(var(--safe-b) + 10px)', maxHeight: '56vh', overflowY: 'auto', padding: 12, margin: '0 auto', maxWidth: 560 }}
      >
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="display" style={{ fontSize: 17 }}>{STORY_TEXT.subtitle}</span>
          <span className="display" style={{ fontSize: 17, color: 'var(--fuchsia)' }} data-testid="story-progress">
            {done}/{CHAPTERS.length}
          </span>
        </div>
        <ProgressBar done={done} />
        <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }}>
          {CHAPTERS.map((c, i) => {
            const unlocked = isChapterUnlocked(progress, c.id)
            const stars = progress.chapters[c.id]?.stars ?? 0
            return (
              <motion.li key={c.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="glass"
                  data-testid={`chapter-${c.number}`}
                  aria-disabled={!unlocked}
                  aria-label={unlocked ? `Capítulo ${c.number}: ${c.title}` : `Capítulo ${c.number} bloqueado`}
                  onClick={() => {
                    if (!unlocked) {
                      audio.error()
                      buzz(30)
                      toast(STORY_TEXT.locked)
                      return
                    }
                    audio.sparkle()
                    startChapter(c.id)
                  }}
                  style={{ width: '100%', padding: 10, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', minHeight: 64, opacity: unlocked ? 1 : 0.62 }}
                >
                  <span style={{ width: 46, height: 46, borderRadius: 14, flex: 'none', display: 'grid', placeItems: 'center', color: unlocked ? 'var(--fuchsia)' : 'var(--ink-soft)', background: 'linear-gradient(135deg,#ffd1ec,#e3d1ff)' }}>
                    <Icon name={(unlocked ? c.icon : 'lock') as IconName} width={26} height={26} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)' }}>Capítulo {c.number}</span>
                    <span className="display" style={{ display: 'block', fontSize: 17, color: 'var(--ink)' }}>
                      {unlocked ? c.title : '???'}
                    </span>
                  </span>
                  {isChapterDone(progress, c.id) && <Stars n={stars} size={15} />}
                </motion.button>
              </motion.li>
            )
          })}
        </ol>
        {isStoryComplete(progress) && (
          <Btn variant="gold" size="big" sound="sparkle" style={{ width: '100%', marginTop: 10 }} onClick={() => go('ending')} data-testid="story-ending">
            <Icon name="plane" width={22} height={22} /> {STORY_TEXT.toEnding}
          </Btn>
        )}
      </motion.div>
    </>
  )
}

// ───────────────────── Viñetas ─────────────────────

function VignetteCard({ chapter, vignette, kind, onNext }: { chapter: ChapterDef; vignette: Vignette; kind: 'intro' | 'outro'; onNext: () => void }) {
  const panel = useBottomPanel()
  useInsetTop(0)
  const last = kind === 'outro' && isLastChapter(chapter.id)
  return (
    <>
      <TopBar />
      {/* bandas de cine */}
      <motion.div aria-hidden="true" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.6 }} style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 'calc(var(--safe-t) + 54px)', background: 'linear-gradient(180deg, rgba(40,6,40,.55), rgba(40,6,40,0))', transformOrigin: 'top', pointerEvents: 'none', zIndex: 1 }} />
      <motion.section
        ref={panel}
        key={`${chapter.id}-${kind}`}
        className="glass"
        role="dialog"
        aria-label={vignette.title}
        data-testid={`vignette-${kind}`}
        initial={{ y: 60, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 130, damping: 18, delay: 0.2 }}
        style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(var(--safe-b) + 12px)', margin: '0 auto', maxWidth: 520, padding: '16px 18px 14px', zIndex: 25 }}
      >
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {STAGE_BY_ID[chapter.stage]?.name ?? ''} · {chapter.number}/{CHAPTERS.length}
        </motion.p>
        <motion.h2 className="display holo-text" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ margin: '2px 0 8px', fontSize: 'clamp(22px, 6vw, 30px)', lineHeight: 1.1 }}>
          {vignette.title}
        </motion.h2>
        <div aria-live="polite">
          {vignette.lines.map((l, i) => (
            <motion.p key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.8 }} style={{ margin: '0 0 8px', fontSize: 16, lineHeight: 1.45 }}>
              {l}
            </motion.p>
          ))}
        </div>
        {kind === 'intro' && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + vignette.lines.length * 0.8 }} style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--fuchsia)', fontWeight: 700 }}>
            <Icon name="star" width={16} height={16} style={{ verticalAlign: '-3px' }} /> Look obligatorio: {chapter.mustWear.label}
          </motion.p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Btn variant={last ? 'gold' : 'primary'} sound="sparkle" onClick={onNext} data-testid="vignette-next">
            {kind === 'intro' ? '¡A vestirse!' : last ? STORY_TEXT.toEnding : 'Seguir la historia'}
            <Icon name={last ? 'plane' : 'play'} width={20} height={20} />
          </Btn>
        </div>
      </motion.section>
    </>
  )
}

// ───────────────────── Reto ─────────────────────

function ChapterBanner({ chapter }: { chapter: ChapterDef }) {
  const look = useGame((s) => s.look)
  const help = useGame((s) => s.helpDressChapter)
  const reqs = requirementStatus(look, chapter)
  const ch = chapter.challenge
  return (
    <motion.div className="glass" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ position: 'fixed', top: 'calc(var(--safe-t) + 66px)', left: 12, right: 72, padding: '8px 12px', zIndex: 24 }} data-testid="chapter-banner">
      <strong className="display" style={{ fontSize: 17, color: 'var(--fuchsia)' }}>
        {chapter.number}. {ch.title}
      </strong>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.3 }}>
        Estilo: {ch.wantedTags.map(tagLabel).join(', ')} · Accesorios: {ch.minAccessories}+ · {chapter.minStars}★ o más
      </div>
      <div className="row wrap" style={{ gap: 4, marginTop: 4 }} aria-label="Look obligatorio">
        {reqs.map((r) => (
          <span key={r.label} className={`chip ${r.ok ? 'active' : ''}`} style={{ minHeight: 26, fontSize: 12, padding: '2px 8px' }} data-testid="requirement" data-ok={r.ok}>
            <Icon name={r.ok ? 'check' : 'close'} width={14} height={14} /> {r.label}
          </span>
        ))}
        <button
          className="chip"
          style={{ minHeight: 26, fontSize: 12, padding: '2px 8px', color: 'var(--fuchsia)', fontWeight: 800 }}
          onClick={() => {
            audio.sparkle()
            buzz(10)
            help()
          }}
          data-testid="chapter-autodress"
        >
          <Icon name="wand" width={14} height={14} /> {STORY_TEXT.helpButton}
        </button>
      </div>
    </motion.div>
  )
}

function ChapterDress({ chapter }: { chapter: ChapterDef }) {
  const submit = useGame((s) => s.submitChapter)
  return <StudioScreen mode="story" banner={<ChapterBanner chapter={chapter} />} onSubmit={submit} />
}

function ChapterJury({ chapter }: { chapter: ChapterDef }) {
  const result = useGame((s) => s.storyResult)
  const setPhase = useGame((s) => s.setStoryPhase)
  const passed = result?.passed ?? false
  return (
    <>
      <JuryScreen
        header={
          <div style={{ textAlign: 'center', marginBottom: 6 }} data-testid={passed ? 'chapter-passed' : 'chapter-failed'}>
            <div className="display" style={{ fontSize: 22, color: passed ? 'var(--fuchsia)' : 'var(--ink)' }}>
              {passed ? STORY_TEXT.passed : STORY_TEXT.failed}
            </div>
            {!passed && <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{STORY_TEXT.failedHint.replace('{n}', String(chapter.minStars))}</div>}
          </div>
        }
        actions={
          passed ? (
            <Btn variant="gold" sound="sparkle" onClick={() => setPhase('memory')} data-testid="jury-continue">
              <Icon name="camera" width={22} height={22} /> Guardar el recuerdo
            </Btn>
          ) : (
            <Btn onClick={() => setPhase('dress')} data-testid="jury-retry">
              Volver a intentarlo
            </Btn>
          )
        }
      />
    </>
  )
}

// ───────────────────── Recuerdo ─────────────────────

/** Recorta el centro del lienzo 3D a 3:4 y lo guarda como JPEG. */
function takeMemoryPhoto(): string | null {
  return interaction.capture?.({ w: 600, h: 800, type: 'image/jpeg', quality: 0.86, post: true }) ?? null
}

function ChapterMemory({ chapter }: { chapter: ChapterDef }) {
  const saveMemory = useGame((s) => s.saveChapterMemory)
  const setPhase = useGame((s) => s.setStoryPhase)
  const toast = useGame((s) => s.toast)
  const [photo, setPhoto] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  useInsetTop(0)
  useEffect(() => {
    // deja que la pose se asiente antes de disparar
    let alive = true
    const t = setTimeout(() => {
      requestAnimationFrame(() => {
        if (!alive) return
        audio.shutter()
        buzz(30)
        setFlash(true)
        const img = takeMemoryPhoto()
        if (!img) {
          toast('No se pudo hacer la foto del recuerdo')
          setPhase('outro')
          return
        }
        setPhoto(img)
        void saveMemory(img).then((ok) => {
          if (alive && !ok) toast('No se pudo guardar el recuerdo en este navegador')
        })
        useGame.getState().burstConfetti()
      })
    }, 1700)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [saveMemory, setPhase, toast])
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <>
      <TopBar title={STORY_TEXT.memoryTitle} back={false} />
      <AnimatePresence>{flash && <motion.div key="flash" className="flash" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} onAnimationComplete={() => setFlash(false)} />}</AnimatePresence>
      {!photo && (
        <motion.div className="glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', bottom: 'calc(var(--safe-b) + 18px)', left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', fontWeight: 700 }}>
          {STORY_TEXT.memorySaving}
        </motion.div>
      )}
      <AnimatePresence>
        {photo && (
          <motion.div
            key="polaroid"
            initial={{ opacity: 0, scale: 1.3, rotate: 8 }}
            animate={{ opacity: 1, scale: 1, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.3 }}
            style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16, zIndex: 26, pointerEvents: 'none' }}
          >
            <figure className="polaroid" style={{ margin: 0, background: '#fffaf6', padding: '12px 12px 0', borderRadius: 6, boxShadow: '0 18px 40px rgba(60,0,50,.4)', width: 'min(300px, 70vw)', pointerEvents: 'auto' }}>
              <img src={photo} alt={`Recuerdo: ${chapter.memory}`} data-testid="memory-photo" style={{ width: '100%', display: 'block', borderRadius: 2 }} />
              <figcaption style={{ textAlign: 'center', padding: '10px 4px 12px' }}>
                <div className="display" style={{ color: '#c2185b', fontSize: 17 }}>{chapter.memory}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{date}</div>
              </figcaption>
              <div className="row center" style={{ paddingBottom: 12 }}>
                <Btn sound="sparkle" onClick={() => setPhase('outro')} data-testid="memory-continue">
                  ¡Al álbum! <Icon name="play" width={18} height={18} />
                </Btn>
              </div>
            </figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ───────────────────── Pantalla de la historia ─────────────────────

export default function StoryScreen() {
  const phase = useGame((s) => s.storyPhase)
  const id = useGame((s) => s.storyChapter)
  const setPhase = useGame((s) => s.setStoryPhase)
  const finish = useGame((s) => s.finishChapter)
  const chapter = id ? CHAPTER_BY_ID[id] : null
  if (phase === 'map' || !chapter) return <ChapterMap />
  switch (phase) {
    case 'intro':
      return <VignetteCard chapter={chapter} vignette={chapter.intro} kind="intro" onNext={() => setPhase('dress')} />
    case 'dress':
      return <ChapterDress chapter={chapter} />
    case 'jury':
      return <ChapterJury chapter={chapter} />
    case 'memory':
      return <ChapterMemory chapter={chapter} />
    case 'outro':
      return <VignetteCard chapter={chapter} vignette={chapter.outro} kind="outro" onNext={finish} />
  }
}

// ───────────────────── Álbum de recuerdos ─────────────────────

export function MemoriesScreen() {
  const [items, setItems] = useState<Memory[] | null>(null)
  const [open, setOpen] = useState<Memory | null>(null)
  useInsetTop(0)
  useEffect(() => {
    let alive = true
    void listMemories(CHAPTER_ORDER).then((m) => alive && setItems(m))
    return () => {
      alive = false
    }
  }, [])
  return (
    <>
      <TopBar title={STORY_TEXT.albumTitle} />
      <div className="scroll" style={{ position: 'fixed', inset: 0, top: 'calc(var(--safe-t) + 66px)', overflowY: 'auto', padding: '6px 14px calc(var(--safe-b) + 16px)', background: 'linear-gradient(180deg, rgba(255,226,242,.86), rgba(233,218,255,.92))' }} data-testid="album">
        {items && items.length === 0 && (
          <div className="glass" style={{ padding: 18, maxWidth: 420, margin: '20px auto', textAlign: 'center' }} data-testid="album-empty">
            <Icon name="frame" width={36} height={36} style={{ color: 'var(--fuchsia)' }} />
            <p style={{ margin: '8px 0 0', lineHeight: 1.45 }}>{STORY_TEXT.albumEmpty}</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
          {items?.map((m, i) => {
            const ch = CHAPTER_BY_ID[m.chapterId]
            return (
              <motion.button
                key={m.chapterId}
                data-testid={`memory-${m.chapterId}`}
                aria-label={`Recuerdo: ${m.caption}`}
                initial={{ opacity: 0, y: 20, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: i % 2 ? 2.5 : -2.5 }}
                whileTap={{ scale: 0.96 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => (audio.click(), setOpen(m))}
                style={{ background: '#fffaf6', padding: '8px 8px 0', borderRadius: 4, boxShadow: '0 10px 22px rgba(60,0,50,.25)', textAlign: 'center' }}
              >
                <img src={m.image} alt="" style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block' }} />
                <span style={{ display: 'block', padding: '6px 2px 8px', fontSize: 13, fontWeight: 700, color: '#c2185b', lineHeight: 1.2 }}>
                  {ch ? `${ch.number}. ` : ''}
                  {m.caption}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} label="Recuerdo">
        {open && (
          <>
            <h2>{open.caption}</h2>
            <img src={open.image} alt={`Recuerdo: ${open.caption}`} style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 10 }} data-testid="memory-big" />
            <p>
              {STAGE_BY_ID[open.stage]?.name} · {new Date(open.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="row center wrap">
              <a className="btn" href={open.image} download={`recuerdo-${open.chapterId}.jpg`} onClick={() => audio.sparkle()}>
                <Icon name="download" width={22} height={22} /> Descargar
              </a>
              <Btn variant="secondary" onClick={() => setOpen(null)}>
                Cerrar
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

import { motion } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { useView } from '../../three/view'
import { useGame, type Screen } from '../../store/game'
import { STORY } from '../../data/story'
import { STORY_TEXT } from '../../data/chapters'
import { progressLabel } from '../../game/story'
import { Btn, AudioToggle, CoinCounter, Modal, useInsetReporter, useInsetTop } from '../kit'
import { Icon, type IconName } from '../Icon'
import { audio, buzz } from '../../audio/engine'

const MENU: { screen: Screen; label: string; icon: IconName; testid: string }[] = [
  { screen: 'studio', label: 'Estudio', icon: 'hanger', testid: 'menu-studio' },
  { screen: 'photo', label: 'Fotos', icon: 'camera', testid: 'menu-photo' },
  { screen: 'challenges', label: 'Retos', icon: 'trophy', testid: 'menu-challenges' },
  { screen: 'runway', label: 'Pasarela', icon: 'runway', testid: 'menu-runway' },
  { screen: 'wardrobe', label: 'Armario', icon: 'closet', testid: 'menu-wardrobe' },
  { screen: 'shop', label: 'Tienda', icon: 'shop', testid: 'menu-shop' },
]

export default function HomeScreen() {
  const go = useGame((s) => s.go)
  const tapHeart = useGame((s) => s.tapHeart)
  const taps = useGame((s) => s.heartTaps)
  const endingUnlocked = useGame((s) => s.save.endingUnlocked)
  const onboardingDone = useGame((s) => s.save.onboardingDone)
  const storyProgress = useGame((s) => progressLabel(s.save.story))
  const openStory = useGame((s) => s.openStory)
  const [secretOpen, setSecretOpen] = useState(false)
  const nav = useRef<HTMLElement>(null)
  const setView = useView((s) => s.set)
  const reporter = useCallback((b: number) => setView({ insetBottom: Math.max(0, b * 0.55), insetRight: 0 }), [setView])
  useInsetTop(150)
  useInsetReporter(nav, reporter)
  const start = (s: Screen) => {
    if (s === 'studio' && !onboardingDone) useGame.getState().setOnboardingStep(0)
    go(s)
  }
  return (
    <div className="home" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
      <div className="topbar">
        <div className="spacer" />
        <CoinCounter />
        <AudioToggle />
      </div>
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
        style={{ textAlign: 'center', marginTop: 'calc(var(--safe-t) + 64px)', padding: '0 16px', pointerEvents: 'auto' }}
      >
        <p className="display" style={{ margin: 0, fontSize: 'clamp(16px, 4.5vw, 22px)', color: '#fff', textShadow: '0 2px 8px rgba(150,20,100,.6)' }}>
          {STORY.homeSubtitle}
        </p>
        <h1 className="display holo-text" style={{ margin: '2px 0 0', fontSize: 'clamp(44px, 13vw, 84px)', lineHeight: 0.95, filter: 'drop-shadow(0 3px 0 #fff) drop-shadow(0 6px 14px rgba(160,20,110,.45))' }}>
          {STORY.homeTitle.split(' ').slice(0, -1).join(' ')}{' '}
          <span style={{ whiteSpace: 'nowrap' }}>
            {STORY.homeTitle.split(' ').slice(-1)[0]}
          </span>
        </h1>
        <motion.button
          aria-label="Corazón"
          data-testid="secret-heart"
          onClick={() => {
            audio.click()
            buzz(15)
            const triggered = tapHeart()
            if (triggered) {
              audio.fanfare()
              useGame.getState().burstConfetti()
              setSecretOpen(true)
            }
          }}
          whileTap={{ scale: 1.4 }}
          style={{ marginTop: 4, width: 44, height: 44, display: 'inline-grid', placeItems: 'center', color: taps > 0 ? '#ff2d8a' : 'rgba(255,255,255,.85)' }}
        >
          <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ display: 'grid' }}>
            <Icon name="heart" width={22} height={22} fill="currentColor" stroke="none" />
          </motion.span>
        </motion.button>
      </motion.header>
      <div style={{ flex: 1 }} />
      <motion.nav
        ref={nav}
        aria-label="Menú principal"
        className="glass"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 140, damping: 18 }}
        style={{ margin: '0 12px calc(var(--safe-b) + 12px)', padding: 12, pointerEvents: 'auto', alignSelf: 'center', width: 'min(560px, calc(100% - 24px))' }}
      >
        {endingUnlocked && (
          <Btn variant="gold" size="big" sound="sparkle" style={{ width: '100%', marginBottom: 10 }} onClick={() => go('ending')} data-testid="menu-ending">
            <Icon name="plane" width={24} height={24} /> Final secreto
          </Btn>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          <Btn variant="gold" sound="sparkle" onClick={openStory} data-testid="menu-story" aria-label={`${STORY_TEXT.menuLabel}, ${storyProgress} capítulos`} style={{ gridColumn: 'span 2', minHeight: 56, borderRadius: 20, justifyContent: 'space-between', padding: '6px 14px' }}>
            <span className="row" style={{ gap: 8 }}>
              <Icon name="sunset" width={26} height={26} />
              <span style={{ fontSize: 17 }}>{STORY_TEXT.menuLabel}</span>
            </span>
            <span data-testid="menu-story-progress" style={{ fontSize: 15, background: 'rgba(255,255,255,.55)', borderRadius: 999, padding: '2px 10px' }}>
              {storyProgress}
            </span>
          </Btn>
          <Btn variant="secondary" onClick={() => go('memories')} data-testid="menu-memories" style={{ minHeight: 56, borderRadius: 20, padding: '6px 4px', gap: 6 }}>
            <Icon name="frame" width={24} height={24} />
            <span style={{ fontSize: 15 }}>{STORY_TEXT.albumLabel}</span>
          </Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {MENU.map((m, i) => (
            <Btn key={m.screen} variant={i === 0 ? 'primary' : 'secondary'} onClick={() => start(m.screen)} data-testid={m.testid} style={{ flexDirection: 'column', gap: 2, minHeight: 72, padding: '6px 4px', borderRadius: 20 }}>
              <Icon name={m.icon} width={28} height={28} />
              <span style={{ fontSize: 15 }}>{m.label}</span>
            </Btn>
          ))}
        </div>
      </motion.nav>
      <Modal open={secretOpen} onClose={() => setSecretOpen(false)} label="Secreto descubierto">
        <h2>¡Has encontrado el corazón!</h2>
        <p>Igual que yo te encontré a ti. Se ha desbloqueado el final secreto y una tiara muy especial.</p>
        <div className="row center wrap">
          <Btn variant="gold" onClick={() => go('ending')} data-testid="go-ending">
            <Icon name="plane" width={22} height={22} /> Ver el final
          </Btn>
          <Btn variant="secondary" onClick={() => setSecretOpen(false)}>
            Luego
          </Btn>
        </div>
      </Modal>
    </div>
  )
}

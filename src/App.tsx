import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGame, isDebug } from './store/game'
import { useView } from './three/view'
import { audio } from './audio/engine'
import { Toasts } from './ui/kit'
import Loading from './ui/Loading'
import Splash from './ui/Splash'
import { interaction } from './three/view'
import { installScreenTransitions, transitionDir } from './ui/transitions'

// Acceso para pruebas automáticas y depuración
;(window as unknown as { __clara: unknown }).__clara = { store: useGame, interaction, view: useView }
installScreenTransitions()

// Carga diferida: el motor 3D y cada modo de juego van en trozos separados.
const Stage3D = lazy(() => import('./three/Stage3D'))
const HomeScreen = lazy(() => import('./ui/screens/Home'))
const StudioScreen = lazy(() => import('./ui/screens/Studio'))
const PhotoScreen = lazy(() => import('./ui/screens/Photo'))
const ChallengesScreen = lazy(() => import('./ui/screens/Challenges').then((m) => ({ default: m.ChallengesScreen })))
const JuryScreen = lazy(() => import('./ui/screens/Challenges').then((m) => ({ default: m.JuryScreen })))
const RunwayScreen = lazy(() => import('./ui/screens/Misc').then((m) => ({ default: m.RunwayScreen })))
const WardrobeScreen = lazy(() => import('./ui/screens/Misc').then((m) => ({ default: m.WardrobeScreen })))
const ShopScreen = lazy(() => import('./ui/screens/Misc').then((m) => ({ default: m.ShopScreen })))
const EndingScreen = lazy(() => import('./ui/screens/Misc').then((m) => ({ default: m.EndingScreen })))
const LetterScreen = lazy(() => import('./ui/screens/Misc').then((m) => ({ default: m.LetterScreen })))
const DebugPanel = lazy(() => import('./ui/Debug'))

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function NoWebGL() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(160deg,#ffd1ec,#e3d1ff)' }}>
      <div className="glass" style={{ padding: 24, maxWidth: 420, textAlign: 'center' }} role="alert">
        <h1 className="display holo-text" style={{ fontSize: 34, margin: '0 0 8px' }}>
          ¡Oh, no!
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5 }}>
          Este dispositivo o navegador no tiene activados los gráficos 3D (WebGL), así que las muñecas no pueden salir a escena.
        </p>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)' }}>Prueba a abrirlo con Chrome o Safari actualizados, o activa la aceleración por hardware.</p>
      </div>
    </div>
  )
}

function useAudioDirector() {
  const screen = useGame((s) => s.screen)
  const settings = useGame((s) => s.save.settings)
  const audioReady = useGame((s) => s.audioReady)
  useEffect(() => {
    const unlock = () => {
      audio.unlock()
      useGame.getState().setAudioReady()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  useEffect(() => {
    audio.setVolume(settings.volume, settings.muted)
  }, [settings.volume, settings.muted, audioReady])
  useEffect(() => {
    if (!audioReady) return
    audio.playTrack(screen === 'runway' ? 'runway' : screen === 'ending' || screen === 'letter' ? 'ending' : 'menu')
  }, [screen, audioReady])
}

function ScreenRouter() {
  const screen = useGame((s) => s.screen)
  let node: React.ReactNode = null
  switch (screen) {
    case 'home':
      node = <HomeScreen />
      break
    case 'studio':
      node = <StudioScreen mode="studio" />
      break
    case 'challenge':
      node = <StudioScreen mode="challenge" />
      break
    case 'photo':
      node = <PhotoScreen />
      break
    case 'challenges':
      node = <ChallengesScreen />
      break
    case 'jury':
      node = <JuryScreen />
      break
    case 'runway':
      node = <RunwayScreen />
      break
    case 'wardrobe':
      node = <WardrobeScreen />
      break
    case 'shop':
      node = <ShopScreen />
      break
    case 'ending':
      node = <EndingScreen />
      break
    case 'letter':
      node = <LetterScreen />
      break
  }
  // El cambio de pantalla es inmediato; la salida la anima una copia inerte (ui/transitions.ts)
  return (
    <div key={screen} className={`ui-layer screen-in ${transitionDir()}`} data-screen={screen}>
      <Suspense fallback={null}>{node}</Suspense>
    </div>
  )
}

export default function App() {
  const [webgl] = useState(hasWebGL)
  const [started, setStarted] = useState(false)
  const ready = useView((s) => s.ready)
  useAudioDirector()
  if (!webgl) return <NoWebGL />
  if (!started)
    return (
      <Splash
        onStart={() => {
          audio.unlock()
          audio.click()
          useGame.getState().setAudioReady()
          setStarted(true)
        }}
      />
    )
  return (
    <>
      <Suspense fallback={null}>
        <Stage3D />
      </Suspense>
      {ready && <ScreenRouter />}
      <Toasts />
      <AnimatePresence>{!ready && <Loading key="loading" />}</AnimatePresence>
      {isDebug() && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}
    </>
  )
}

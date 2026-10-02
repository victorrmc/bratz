import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, FXAA, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as EffectComposerImpl } from 'postprocessing'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/game'
import { DOLL_BY_ID, PROTAGONIST_ID } from '../data/characters'
import { ITEM_BY_ID } from '../data/items'
import { CHALLENGE_BY_ID } from '../data/challenges'
import { defaultLookFor, equip } from '../game/look'
import { DollRig } from './DollRig'
import { setMaterialQuality } from './materials'
import { setDetail } from './geo'
import { Confetti, SparkleBurst } from './effects'
import { interaction, useView } from './view'
import type { Look } from '../data/types'

const StudioScene = lazy(() => import('./scenes/Studio'))
const HomeScene = lazy(() => import('./scenes/Home'))
const StageScene = lazy(() => import('./scenes/Stages'))
const RunwayScene = lazy(() => import('./scenes/Runway'))

type Q = 'baja' | 'media' | 'alta'

let composerRef: EffectComposerImpl | null = null

// ───────────────────── Muñeca ─────────────────────

function useDollLook(): { look: Look; pose: string } {
  const screen = useGame((s) => s.screen)
  const look = useGame((s) => s.look)
  const save = useGame((s) => s.save)
  const preview = useGame((s) => s.previewItem)
  const pose = useGame((s) => s.pose)
  return useMemo(() => {
    if (screen === 'home' || screen === 'letter') {
      const l = save.current[PROTAGONIST_ID] ?? defaultLookFor(PROTAGONIST_ID)
      return { look: l, pose: screen === 'home' ? 'hero' : 'idle' }
    }
    if (screen === 'ending') {
      // look especial para la pasarela final
      let l = save.current[PROTAGONIST_ID] ?? defaultLookFor(PROTAGONIST_ID)
      for (const id of ['dress-hada', 'jk-alas', 'ha-corona-hada', 'sh-cristal']) l = equip(l, ITEM_BY_ID[id])
      return { look: l, pose: 'walk' }
    }
    if (preview && ITEM_BY_ID[preview]) return { look: equip(look, ITEM_BY_ID[preview]), pose }
    return { look, pose }
  }, [screen, look, save, preview, pose])
}

function Doll({ quality, holder, rigRef, controlledPose }: { quality: Q; holder: React.RefObject<THREE.Group | null>; rigRef: React.MutableRefObject<DollRig | null>; controlledPose: boolean }) {
  const { look, pose } = useDollLook()
  const expression = useGame((s) => s.expression)
  const screen = useGame((s) => s.screen)
  const rig = useMemo(() => {
    setMaterialQuality(quality)
    setDetail(quality === 'alta' ? 1 : quality === 'media' ? 0.75 : 0.45)
    return new DollRig(DOLL_BY_ID[look.dollId] ?? DOLL_BY_ID[PROTAGONIST_ID])
  }, [look.dollId, quality])
  useEffect(() => {
    rigRef.current = rig
    const h = holder.current
    h?.add(rig.root)
    return () => {
      rig.dispose()
      if (rigRef.current === rig) rigRef.current = null
    }
  }, [rig, holder, rigRef])
  useEffect(() => {
    rig.setExpression(screen === 'home' ? 'guino' : expression)
    rig.setLook(look)
  }, [rig, look, expression, screen])
  useEffect(() => {
    if (controlledPose) return
    if (pose === 'walk') rig.setWalking(true)
    else rig.setPose(pose)
  }, [rig, pose, controlledPose])
  useFrame((s, dt) => rig.update(Math.min(dt, 0.05), s.clock.elapsedTime))
  return null
}

// ───────────────────── Cámara ─────────────────────

// Encuadres: objetivo, altura y tamaño del área a mostrar (alto × ancho, en metros)
const PRESETS: Record<string, { target: [number, number, number]; height: number; frameH: number; frameW: number; side?: number }> = {
  cuerpo: { target: [0, 0.93, 0], height: 1.05, frameH: 1.95, frameW: 1.0 },
  cara: { target: [0, 1.5, 0.02], height: 1.53, frameH: 0.44, frameW: 0.42 },
  manos: { target: [0.23, 0.69, 0.04], height: 0.74, frameH: 0.3, frameW: 0.3, side: 0.95 },
  pies: { target: [0, 0.12, 0.05], height: 0.4, frameH: 0.42, frameW: 0.55 },
  hero: { target: [0, 0.98, 0], height: 1.15, frameH: 2.0, frameW: 1.3 },
  photo: { target: [0, 0.95, 0], height: 1.1, frameH: 2.05, frameW: 1.1 },
  jury: { target: [0, 1.0, 0], height: 1.2, frameH: 2.15, frameW: 1.2 },
}

function CameraRig({ preset, orbit = false, interactive = true }: { preset: string; orbit?: boolean; interactive?: boolean }) {
  const { camera, gl, size } = useThree()
  const insetBottom = useView((s) => s.camBottom ?? s.insetBottom)
  const insetRight = useView((s) => s.insetRight)
  const insetTop = useView((s) => s.insetTop)
  const cur = useRef({ pos: new THREE.Vector3(0, 1.2, 4), target: new THREE.Vector3(0, 1, 0), init: false })
  useEffect(() => {
    const el = gl.domElement
    if (!interactive) return
    const pts = new Map<number, { x: number; y: number }>()
    let lastPinch = 0
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      interaction.dragging = true
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      if (pts.size === 1) {
        interaction.dollRotY += (e.clientX - p.x) * 0.012
      } else if (pts.size === 2) {
        const arr = [...pts.values()]
        const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y)
        if (lastPinch) interaction.zoom = THREE.MathUtils.clamp(interaction.zoom * (lastPinch / Math.max(1, d)), 0.45, 1.6)
        lastPinch = d
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) lastPinch = 0
      if (!pts.size) interaction.dragging = false
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      interaction.zoom = THREE.MathUtils.clamp(interaction.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.45, 1.6)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl, interactive])
  useEffect(() => {
    interaction.zoom = 1
  }, [preset])
  useFrame((s, dt) => {
    const p = PRESETS[preset] ?? PRESETS.cuerpo
    const cam = camera as THREE.PerspectiveCamera
    // distancia para que el encuadre quepa en la zona libre (fuera de los paneles)
    const t2 = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const fh = Math.max(0.3, (size.height - insetBottom - insetTop) / size.height)
    const fw = Math.max(0.3, (size.width - insetRight) / size.width)
    const aspect = size.width / size.height
    const dist = Math.max(p.frameH / (t2 * fh), p.frameW / (t2 * aspect * fw)) * interaction.zoom
    const ang = orbit ? Math.sin(s.clock.elapsedTime * 0.25) * 0.35 : p.side ?? 0
    const tgt = new THREE.Vector3(...p.target)
    const pos = new THREE.Vector3(Math.sin(ang) * dist + tgt.x, p.height, Math.cos(ang) * dist + tgt.z)
    if (!cur.current.init) {
      cur.current.pos.copy(pos)
      cur.current.target.copy(tgt)
      cur.current.init = true
    }
    const k = Math.min(1, dt * 4)
    cur.current.pos.lerp(pos, k)
    cur.current.target.lerp(tgt, k)
    cam.position.copy(cur.current.pos)
    cam.lookAt(cur.current.target)
    // centra la muñeca en la zona libre de la pantalla (fuera de los paneles)
    const offY = (insetBottom - insetTop) / 2
    const offX = insetRight / 2
    if (offX || offY) cam.setViewOffset(size.width, size.height, offX, offY, size.width, size.height)
    else cam.clearViewOffset()
  })
  return null
}

function HolderControl({ holder, y, follow }: { holder: React.RefObject<THREE.Group | null>; y: number; follow: boolean }) {
  useEffect(() => {
    interaction.dollRotY = 0
  }, [follow])
  useFrame((_, dt) => {
    const h = holder.current
    if (!h) return
    h.position.set(0, y, 0)
    if (follow) h.rotation.y += (interaction.dollRotY - h.rotation.y) * Math.min(1, dt * 10)
  })
  return null
}

// ───────────────────── Captura de imagen ─────────────────────

function CaptureBridge() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    interaction.scene = scene
    interaction.gl = gl
    interaction.camera = camera
    interaction.capture = ({ w, h, type = 'image/png', quality = 0.92, post = true }) => {
      try {
        if (post && composerRef) composerRef.render()
        else gl.render(scene, camera)
        const src = gl.domElement
        const out = document.createElement('canvas')
        out.width = w
        out.height = h
        const ctx = out.getContext('2d')!
        // recorte tipo "cover"
        const sr = src.width / src.height
        const dr = w / h
        let sw = src.width
        let sh = src.height
        if (sr > dr) sw = sh * dr
        else sh = sw / dr
        ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h)
        return out.toDataURL(type, quality)
      } catch {
        return null
      }
    }
    return () => {
      interaction.capture = null
    }
  }, [gl, scene, camera])
  return null
}

function FpsMeter() {
  const acc = useRef({ t: 0, n: 0 })
  useFrame((_, dt) => {
    acc.current.t += dt
    acc.current.n++
    if (acc.current.t >= 0.5) {
      interaction.fps = acc.current.n / acc.current.t
      acc.current.t = 0
      acc.current.n = 0
    }
  })
  return null
}

function ReadySignal() {
  const set = useView((s) => s.set)
  const n = useRef(0)
  useFrame(() => {
    n.current++
    if (n.current === 3) set({ ready: true, progress: 1 })
  })
  return null
}

function Post({ quality }: { quality: Q }) {
  if (quality === 'baja') return null
  return (
    <EffectComposer
      ref={(c) => {
        composerRef = (c as unknown as EffectComposerImpl) ?? null
      }}
      multisampling={0}
      enableNormalPass={false}
    >
      <Bloom mipmapBlur intensity={quality === 'alta' ? 0.6 : 0.45} luminanceThreshold={0.88} luminanceSmoothing={0.2} radius={0.7} />
      {quality === 'alta' ? <SMAA /> : <FXAA />}
      <Vignette offset={0.32} darkness={0.42} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

// ───────────────────── Escena principal ─────────────────────

function SceneContent({ quality }: { quality: Q }) {
  const screen = useGame((s) => s.screen)
  const stage = useGame((s) => s.stage)
  const cam = useGame((s) => s.cam)
  const sparkle = useGame((s) => s.sparkle)
  const confetti = useGame((s) => s.confetti)
  const challengeId = useGame((s) => s.challengeId)
  const holder = useRef<THREE.Group>(null)
  const rigRef = useRef<DollRig | null>(null)
  const isRunway = screen === 'runway' || screen === 'ending'
  const onFinish = () => {
    useGame.getState().markEndingSeen()
    useGame.getState().go('letter')
  }
  let scene: React.ReactNode = null
  let y = 0
  let camera: React.ReactNode = null
  switch (screen) {
    case 'home':
      scene = <HomeScene quality={quality} />
      y = 0.08
      camera = <CameraRig preset="hero" orbit interactive={false} />
      break
    case 'studio':
    case 'challenge':
    case 'wardrobe':
    case 'shop':
    case 'challenges':
      scene = <StudioScene quality={quality} />
      y = 0.06
      camera = <CameraRig preset={screen === 'studio' || screen === 'challenge' ? cam : 'cuerpo'} interactive={screen !== 'challenges'} />
      break
    case 'photo':
      scene = <StageScene id={stage} quality={quality} />
      camera = <CameraRig preset="photo" />
      break
    case 'jury':
      scene = <StageScene id={(challengeId && CHALLENGE_BY_ID[challengeId]?.stage) || 'disco'} quality={quality} />
      camera = <CameraRig preset="jury" interactive={false} />
      break
    case 'letter':
      scene = <StageScene id="casa" quality={quality} />
      camera = <CameraRig preset="hero" orbit interactive={false} />
      break
    case 'runway':
    case 'ending':
      scene = <RunwayScene quality={quality} holder={holder} rig={rigRef} special={screen === 'ending'} onFinish={screen === 'ending' ? onFinish : undefined} onPose={() => useGame.getState().burstConfetti()} />
      y = 0.1
      break
  }
  return (
    <>
      <Suspense fallback={null}>{scene}</Suspense>
      <group ref={holder} />
      {!isRunway && <HolderControl holder={holder} y={y} follow={screen !== 'home' && screen !== 'letter'} />}
      {isRunway && <RunwayHolderInit holder={holder} y={y} />}
      <Doll quality={quality} holder={holder} rigRef={rigRef} controlledPose={isRunway} />
      {camera}
      <SparkleBurst trigger={sparkle} center={[0, 1.0, 0]} radius={0.45} />
      <Confetti trigger={confetti} center={isRunway ? [0, 1.4, 0.9] : [0, 1.2, 0]} />
    </>
  )
}

function RunwayHolderInit({ holder, y }: { holder: React.RefObject<THREE.Group | null>; y: number }) {
  const { camera } = useThree()
  useEffect(() => {
    holder.current?.position.set(0, y, -4.6)
    ;(camera as THREE.PerspectiveCamera).clearViewOffset()
  }, [holder, y, camera])
  return null
}

function detectQuality(): Q {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent) || Math.min(window.innerWidth, window.innerHeight) < 600
    const cores = nav.hardwareConcurrency ?? 4
    if (mobile) return cores >= 8 && (nav.deviceMemory ?? 4) >= 6 ? 'media' : 'media'
    return cores >= 4 ? 'alta' : 'media'
  } catch {
    return 'media'
  }
}

export default function Stage3D() {
  const setting = useGame((s) => s.save.settings.quality)
  const setQuality = useGame((s) => s.setQuality)
  const [auto, setAuto] = useState<Q>(() => {
    const q = new URLSearchParams(location.search).get('q')
    return q === 'baja' || q === 'media' || q === 'alta' ? q : detectQuality()
  })
  const quality: Q = setting === 'auto' ? auto : setting
  const forced = Number(new URLSearchParams(location.search).get('dpr')) || 0
  const maxDpr = forced || Math.min(window.devicePixelRatio || 1, quality === 'alta' ? 2 : quality === 'media' ? 1.5 : 1)
  const [dpr, setDpr] = useState(maxDpr)
  // al bajar de calidad no se vuelve a la resolución máxima
  useEffect(() => setDpr((d) => Math.min(d, maxDpr)), [maxDpr])
  useEffect(() => {
    if (forced) setDpr(forced)
  }, [forced])
  useEffect(() => {
    setQuality(quality)
    document.documentElement.classList.toggle('hq', quality === 'alta')
  }, [quality, setQuality])
  return (
    <Canvas
      className="stage3d"
      dpr={dpr}
      shadows={quality === 'alta'}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 30, near: 0.05, far: 80, position: [0, 1.2, 4] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.95
      }}
    >
      {!forced && <PerformanceMonitor
        ms={200}
        iterations={5}
        bounds={() => [32, 55]}
        flipflops={6}
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.2))}
        onDecline={() =>
          setDpr((d) => {
            const minDpr = quality === 'baja' ? 0.35 : quality === 'media' ? 0.6 : 0.75
            const nd = Math.max(Math.min(minDpr, maxDpr), d - 0.2)
            if (nd === d && setting === 'auto') setAuto((q) => (q === 'alta' ? 'media' : 'baja'))
            return nd
          })
        }
        onFallback={() => setting === 'auto' && setAuto('baja')}
      />}
      <SceneContent quality={quality} />
      <Post quality={quality} />
      <CaptureBridge />
      <FpsMeter />
      <ReadySignal />
    </Canvas>
  )
}

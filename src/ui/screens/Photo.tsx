import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/game'
import { STAGES, POSES } from '../../data/stages'
import { STORY } from '../../data/story'
import { Btn, IconBtn, Modal, TopBar, useInsetReporter } from '../kit'
import { Icon } from '../Icon'
import { interaction, useView } from '../../three/view'
import { audio, buzz } from '../../audio/engine'

// Sesión de fotos: escenario, pose, marco, pegatinas y disparo con flash.

type Frame = 'ninguno' | 'polaroid' | 'purpurina' | 'holo' | 'corazones'
const FRAMES: { id: Frame; name: string }[] = [
  { id: 'polaroid', name: 'Polaroid' },
  { id: 'purpurina', name: 'Purpurina' },
  { id: 'holo', name: 'Holo' },
  { id: 'corazones', name: 'Corazones' },
  { id: 'ninguno', name: 'Sin marco' },
]

type StickerKind = 'heart' | 'star' | 'sparkle' | 'lips' | 'crown' | 'omg' | 'iconic' | 'ibiza'
const STICKERS: { id: StickerKind; name: string }[] = [
  { id: 'heart', name: 'Corazón' },
  { id: 'star', name: 'Estrella' },
  { id: 'sparkle', name: 'Destello' },
  { id: 'lips', name: 'Beso' },
  { id: 'crown', name: 'Corona' },
  { id: 'omg', name: 'OMG' },
  { id: 'iconic', name: 'ICÓNICA' },
  { id: 'ibiza', name: 'Ibiza' },
]

interface Placed {
  id: number
  kind: StickerKind
  x: number
  y: number
  s: number
  r: number
}

const PATHS: Partial<Record<StickerKind, string>> = {
  heart: 'M50 88S10 62 10 36a20 20 0 0 1 40-8 20 20 0 0 1 40 8c0 26-40 52-40 52z',
  star: 'M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z',
  sparkle: 'M50 4c4 26 12 38 46 46-34 8-42 20-46 46-4-26-12-38-46-46 34-8 42-20 46-46z',
  lips: 'M8 46c10-14 26-22 42-10 16-12 32-4 42 10-10 20-26 32-42 32S18 66 8 46zM8 46c20 6 64 6 84 0',
  crown: 'M10 80V26l22 22 18-34 18 34 22-22v54z',
}
const COLORS: Record<StickerKind, string> = {
  heart: '#ff2d8a',
  star: '#ffd25a',
  sparkle: '#ffffff',
  lips: '#e8243c',
  crown: '#e3b45a',
  omg: '#ff5fae',
  iconic: '#8f5bff',
  ibiza: '#3de0c4',
}
const TEXTS: Partial<Record<StickerKind, string>> = { omg: 'OMG!', iconic: 'ICÓNICA', ibiza: 'IBIZA ✈' }

function StickerSvg({ kind }: { kind: StickerKind }) {
  const t = TEXTS[kind]
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ filter: 'drop-shadow(0 3px 4px rgba(80,0,60,.35))' }}>
      {t ? (
        <>
          <rect x="2" y="28" width="96" height="44" rx="22" fill="#fff" />
          <text x="50" y="58" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize={t.length > 6 ? 17 : 22} fill={COLORS[kind]}>
            {t}
          </text>
        </>
      ) : (
        <path d={PATHS[kind]} fill={COLORS[kind]} stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
      )}
    </svg>
  )
}

function drawSticker(ctx: CanvasRenderingContext2D, p: Placed, W: number, H: number) {
  const size = p.s * W * 0.2
  ctx.save()
  ctx.translate(p.x * W, p.y * H)
  ctx.rotate(p.r)
  ctx.scale(size / 100, size / 100)
  ctx.translate(-50, -50)
  ctx.shadowColor = 'rgba(80,0,60,.35)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 3
  const t = TEXTS[p.kind]
  ctx.lineJoin = 'round'
  if (t) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(2, 28, 96, 44, 22)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = COLORS[p.kind]
    ctx.font = `700 ${t.length > 6 ? 17 : 22}px Fredoka, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(t, 50, 58)
  } else {
    const path = new Path2D(PATHS[p.kind])
    ctx.fillStyle = COLORS[p.kind]
    ctx.fill(path)
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 5
    ctx.stroke(path)
  }
  ctx.restore()
}

function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, W: number, H: number, stageName: string) {
  const b = W * 0.045
  if (frame === 'ninguno') return
  ctx.save()
  if (frame === 'polaroid') {
    ctx.fillStyle = '#fffaf6'
    ctx.fillRect(0, 0, W, b)
    ctx.fillRect(0, 0, b, H)
    ctx.fillRect(W - b, 0, b, H)
    ctx.fillRect(0, H - b * 4, W, b * 4)
    ctx.fillStyle = '#c2185b'
    ctx.font = `600 ${b * 1.4}px Fredoka, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${STORY.herName} · ${stageName}`, W / 2, H - b * 1.6)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    if (frame === 'holo') {
      ;['#ff9fd0', '#c9a7ff', '#7fd6ff', '#b8f25c', '#fff16a', '#ff9fd0'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c))
    } else if (frame === 'purpurina') {
      g.addColorStop(0, '#ff7ac8')
      g.addColorStop(0.5, '#ffd1ec')
      g.addColorStop(1, '#ff2d8a')
    } else {
      g.addColorStop(0, '#ffd1ec')
      g.addColorStop(1, '#ffb3d9')
    }
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.roundRect(b, b, W - 2 * b, H - 2 * b, b)
    ctx.fill('evenodd')
    if (frame === 'purpurina') {
      for (let i = 0; i < 500; i++) {
        const side = Math.random()
        const x = side < 0.5 ? Math.random() * W : Math.random() < 0.5 ? Math.random() * b : W - Math.random() * b
        const y = side < 0.5 ? (Math.random() < 0.5 ? Math.random() * b : H - Math.random() * b) : Math.random() * H
        ctx.fillStyle = Math.random() < 0.5 ? '#fff' : '#ffe08a'
        ctx.globalAlpha = 0.5 + Math.random() * 0.5
        ctx.fillRect(x, y, 2.5, 2.5)
      }
      ctx.globalAlpha = 1
    }
    if (frame === 'corazones') {
      const path = new Path2D(PATHS.heart)
      for (let i = 0; i < 16; i++) {
        const t = i / 16
        const per = 2 * (W + H)
        let d = t * per
        let x: number, y: number
        if (d < W) (x = d), (y = b / 2)
        else if ((d -= W) < H) (x = W - b / 2), (y = d)
        else if ((d -= H) < W) (x = W - d), (y = H - b / 2)
        else (d -= W), (x = b / 2), (y = H - d)
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(b / 70, b / 70)
        ctx.translate(-50, -50)
        ctx.fillStyle = i % 2 ? '#ff2d8a' : '#ffffff'
        ctx.fill(path)
        ctx.restore()
      }
    }
  }
  ctx.restore()
}

export default function PhotoScreen() {
  const stage = useGame((s) => s.stage)
  const setStage = useGame((s) => s.setStage)
  const pose = useGame((s) => s.pose)
  const setPose = useGame((s) => s.setPose)
  const expression = useGame((s) => s.expression)
  const setExpression = useGame((s) => s.setExpression)
  const secretOk = useGame((s) => s.save.endingSeen || s.save.heartFound)
  const toast = useGame((s) => s.toast)
  const [frame, setFrame] = useState<Frame>('polaroid')
  const [stickers, setStickers] = useState<Placed[]>([])
  const [panel, setPanel] = useState<'escenario' | 'pose' | 'marco' | 'pegatinas'>('escenario')
  const [flash, setFlash] = useState(0)
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const setView = useView((s) => s.set)
  const insetBottom = useView((s) => s.insetBottom)
  const insetRight = useView((s) => s.insetRight)
  const reporter = useCallback((b: number, r: number) => setView({ insetBottom: b, insetRight: r }), [setView])
  useInsetReporter(sheet, reporter)
  const [vw, setVw] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const r = () => setVw({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])
  useEffect(() => {
    if (pose === 'walk' || pose === 'hero') setPose('idle')
  }, [pose, setPose])
  // rectángulo de la foto (3:4) dentro de la zona libre
  const freeW = vw.w - insetRight
  const freeH = vw.h - insetBottom - 70
  const fh = Math.min(freeH - 8, (freeW - 24) * (4 / 3))
  const fw = fh * 0.75
  const rect = { x: (freeW - fw) / 2, y: 66 + (freeH - fh) / 2, w: fw, h: fh }
  const stageDef = STAGES.find((s) => s.id === stage)!
  // la cámara encuadra exactamente el rectángulo de la foto
  const camTop = rect.y
  const camBottom = vw.h - rect.y - rect.h
  useEffect(() => {
    useView.getState().set({ insetTop: camTop, camBottom })
    return () => useView.getState().set({ insetTop: 0, camBottom: undefined })
  }, [camTop, camBottom])

  const shoot = () => {
    audio.shutter()
    buzz(30)
    setFlash((f) => f + 1)
    // espera un frame para que la escena esté actualizada
    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1
      const W = 1080
      const H = 1440
      const box = document.querySelector('.stage3d canvas')!.getBoundingClientRect()
      const shot = interaction.capture?.({ w: Math.round(box.width * dpr), h: Math.round(box.height * dpr), type: 'image/png', post: true })
      if (!shot) {
        toast('No se pudo hacer la foto')
        return
      }
      const cr = document.querySelector('.stage3d canvas')!.getBoundingClientRect()
      const img = new Image()
      img.onload = () => {
        const cv = document.createElement('canvas')
        cv.width = W
        cv.height = H
        const ctx = cv.getContext('2d')!
        const sx = ((rect.x - cr.left) / cr.width) * img.width
        const sy = ((rect.y - cr.top) / cr.height) * img.height
        const sw = (rect.w / cr.width) * img.width
        const sh = (rect.h / cr.height) * img.height
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
        for (const p of stickers) drawSticker(ctx, p, W, H)
        drawFrame(ctx, frame, W, H, stageDef.name)
        cv.toBlob((blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          setPhoto({ url, name: `clara-${stage}-${Date.now()}.png` })
          useGame.getState().burstConfetti()
        }, 'image/png')
      }
      img.src = shot
    })
  }

  const addSticker = (kind: StickerKind) => {
    audio.sparkle()
    setStickers((s) => [...s.slice(-11), { id: Date.now(), kind, x: 0.2 + Math.random() * 0.6, y: 0.15 + Math.random() * 0.5, s: 0.8 + Math.random() * 0.4, r: (Math.random() - 0.5) * 0.6 }])
  }

  return (
    <>
      <TopBar title="Sesión de fotos" />
      {/* guía del encuadre */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: 12,
          boxShadow: '0 0 0 2000px rgba(60,0,50,.18)',
          border: '2px dashed rgba(255,255,255,.8)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <FrameOverlay frame={frame} />
      </div>
      {/* pegatinas arrastrables */}
      <div style={{ position: 'fixed', left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 6, pointerEvents: 'none' }}>
        {stickers.map((p) => (
          <DraggableSticker key={p.id} p={p} w={rect.w} h={rect.h} onMove={(x, y) => setStickers((all) => all.map((q) => (q.id === p.id ? { ...q, x, y } : q)))} onRemove={() => setStickers((all) => all.filter((q) => q.id !== p.id))} />
        ))}
      </div>
      <motion.div ref={sheet} className="sheet glass" initial={{ y: 80 }} animate={{ y: 0 }} style={{ maxHeight: 'none' }}>
        <div className="tabs" role="tablist">
          {(['escenario', 'pose', 'marco', 'pegatinas'] as const).map((p) => (
            <button key={p} role="tab" aria-selected={panel === p} className={`tab ${panel === p ? 'active' : ''}`} onClick={() => (audio.click(), setPanel(p))} data-testid={`photo-tab-${p}`}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="chips" style={{ flexWrap: 'nowrap' }}>
          {panel === 'escenario' &&
            STAGES.map((s) => {
              const locked = s.secret && !secretOk
              return (
                <button
                  key={s.id}
                  className={`chip ${stage === s.id ? 'active' : ''}`}
                  aria-pressed={stage === s.id}
                  data-testid={`stage-${s.id}`}
                  onClick={() => {
                    if (locked) {
                      audio.error()
                      toast('Escenario secreto: descubre el final para desbloquearlo')
                      return
                    }
                    audio.whoosh()
                    setStage(s.id)
                  }}
                >
                  {locked ? <Icon name="lock" /> : null}
                  {locked ? '???' : s.name}
                </button>
              )
            })}
          {panel === 'pose' &&
            POSES.map((p) => (
              <button key={p.id} className={`chip ${pose === p.id ? 'active' : ''}`} aria-pressed={pose === p.id} data-testid={`pose-${p.id}`} onClick={() => (audio.click(), setPose(p.id))}>
                {p.name}
              </button>
            ))}
          {panel === 'pose' && (
            <button className="chip" onClick={() => setExpression(expression === 'sonrisa' ? 'guino' : expression === 'guino' ? 'seria' : 'sonrisa')} data-testid="photo-expression">
              <Icon name={expression === 'sonrisa' ? 'smile' : expression === 'guino' ? 'wink' : 'pout'} />
              {expression === 'sonrisa' ? 'Sonrisa' : expression === 'guino' ? 'Guiño' : 'Seria'}
            </button>
          )}
          {panel === 'marco' &&
            FRAMES.map((f) => (
              <button key={f.id} className={`chip ${frame === f.id ? 'active' : ''}`} aria-pressed={frame === f.id} onClick={() => (audio.click(), setFrame(f.id))} data-testid={`frame-${f.id}`}>
                {f.name}
              </button>
            ))}
          {panel === 'pegatinas' &&
            STICKERS.map((s) => (
              <button key={s.id} className="chip" aria-label={`Pegatina ${s.name}`} onClick={() => addSticker(s.id)} style={{ width: 52, padding: 4 }} data-testid={`sticker-${s.id}`}>
                <StickerSvg kind={s.id} />
              </button>
            ))}
        </div>
        <div className="row center" style={{ padding: '4px 10px 10px' }}>
          <motion.button
            className="shutter"
            whileTap={{ scale: 0.85 }}
            onClick={shoot}
            aria-label="Hacer foto"
            data-testid="shutter"
            style={{ width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff 0, #ffd1ec 40%, #ff2d8a 100%)', border: '5px solid #fff', boxShadow: '0 6px 18px rgba(255,45,138,.5)', display: 'grid', placeItems: 'center', color: '#fff' }}
          >
            <Icon name="camera" width={32} height={32} />
          </motion.button>
          {stickers.length > 0 && <IconBtn icon="trash" label="Quitar pegatinas" onClick={() => setStickers([])} />}
        </div>
      </motion.div>
      <AnimatePresence>{flash > 0 && <motion.div key={flash} className="flash" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} />}</AnimatePresence>
      <Modal open={!!photo} onClose={() => setPhoto(null)} label="Tu foto">
        {photo && (
          <>
            <h2>¡Qué foto!</h2>
            <img src={photo.url} alt={`Foto de Clara en ${stageDef.name}`} style={{ width: '100%', borderRadius: 14, display: 'block', marginBottom: 12, boxShadow: 'var(--shadow)' }} data-testid="photo-preview" />
            <div className="row center wrap">
              <a className="btn" href={photo.url} download={photo.name} data-testid="download-photo" onClick={() => audio.sparkle()}>
                <Icon name="download" width={22} height={22} /> Descargar PNG
              </a>
              <Btn variant="secondary" onClick={() => setPhoto(null)} data-testid="close-photo">
                Otra foto
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

function FrameOverlay({ frame }: { frame: Frame }) {
  if (frame === 'ninguno') return null
  const border =
    frame === 'polaroid'
      ? { borderWidth: '4.5% 4.5% 16% 4.5%', borderColor: '#fffaf6' }
      : frame === 'holo'
        ? { borderWidth: '4.5%', borderImage: 'linear-gradient(135deg,#ff9fd0,#c9a7ff,#7fd6ff,#b8f25c,#fff16a,#ff9fd0) 1' }
        : frame === 'purpurina'
          ? { borderWidth: '4.5%', borderImage: 'linear-gradient(135deg,#ff7ac8,#ffd1ec,#ff2d8a) 1' }
          : { borderWidth: '4.5%', borderColor: '#ffc6e4' }
  return <div style={{ position: 'absolute', inset: 0, borderStyle: 'solid', borderRadius: 10, ...border, borderWidth: undefined, borderTopWidth: 14, borderLeftWidth: 14, borderRightWidth: 14, borderBottomWidth: frame === 'polaroid' ? 50 : 14 }} />
}

function DraggableSticker({ p, w, h, onMove, onRemove }: { p: Placed; w: number; h: number; onMove: (x: number, y: number) => void; onRemove: () => void }) {
  const size = p.s * w * 0.2
  const start = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)
  return (
    <div
      role="button"
      aria-label="Pegatina (arrastra para mover, doble toque para quitar)"
      tabIndex={0}
      onDoubleClick={onRemove}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, moved: false }
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        s.moved = true
        onMove(Math.min(1, Math.max(0, s.px + (e.clientX - s.x) / w)), Math.min(1, Math.max(0, s.py + (e.clientY - s.y) / h)))
      }}
      onPointerUp={() => (start.current = null)}
      style={{ position: 'absolute', left: p.x * w - size / 2, top: p.y * h - size / 2, width: size, height: size, transform: `rotate(${p.r}rad)`, pointerEvents: 'auto', touchAction: 'none', cursor: 'grab' }}
    >
      <StickerSvg kind={p.kind} />
    </div>
  )
}

import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import { audio, buzz } from '../audio/engine'
import { useGame } from '../store/game'
import { Coin, Icon, type IconName } from './Icon'
import { useView } from '../three/view'
import { SettingsButton } from './Settings'

// Componentes base de la UI con microinteracciones (escala, brillo, vibración).

type BtnProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'gold'
  size?: 'small' | 'big'
  sound?: 'click' | 'none' | 'sparkle'
}

export function Btn({ children, variant = 'primary', size, sound = 'click', className = '', onClick, ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.04, filter: 'brightness(1.08)' }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={`btn ${variant === 'primary' ? '' : variant} ${size ?? ''} ${className}`}
      onClick={(e) => {
        if (sound === 'click') audio.click()
        if (sound === 'sparkle') audio.sparkle()
        buzz(10)
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function IconBtn({ icon, label, active, onClick, className = '', ...rest }: { icon: IconName; label: string; active?: boolean; onClick?: () => void; className?: string } & Omit<HTMLMotionProps<'button'>, 'onClick' | 'children'>) {
  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      className={`icon-btn ${active ? 'active' : ''} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={() => {
        audio.click()
        buzz(8)
        onClick?.()
      }}
      {...rest}
    >
      <Icon name={icon} />
    </motion.button>
  )
}

export function CoinCounter() {
  const coins = useGame((s) => s.save.coins)
  return (
    <motion.div key={coins} className="coins" initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} aria-label={`${coins} monedas de purpurina`} data-testid="coins">
      <Coin />
      <span>{coins}</span>
    </motion.div>
  )
}

export function AudioToggle() {
  const muted = useGame((s) => s.save.settings.muted)
  const setSettings = useGame((s) => s.setSettings)
  return <IconBtn icon={muted ? 'mute' : 'volume'} label={muted ? 'Activar sonido' : 'Silenciar'} active={!muted} onClick={() => setSettings({ muted: !muted })} data-testid="audio-toggle" />
}

export function TopBar({ title, children, back = true }: { title?: string; children?: ReactNode; back?: boolean }) {
  const goBack = useGame((s) => s.back)
  return (
    <div className="topbar">
      {back && <IconBtn icon="back" label="Volver" onClick={goBack} data-testid="back" />}
      {title && (
        <h1 className="display" style={{ margin: 0, fontSize: 22, color: '#fff', textShadow: '0 2px 8px rgba(160,20,110,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </h1>
      )}
      <div className="spacer" />
      {children}
      <CoinCounter />
      <SettingsButton />
      <AudioToggle />
    </div>
  )
}

export function Modal({ open, onClose, children, label }: { open: boolean; onClose?: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k)
    ref.current?.querySelector<HTMLElement>('button, input')?.focus()
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="modal glass"
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className={`toast glass ${t.kind ?? ''}`} initial={{ y: -20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            {t.kind === 'unlock' ? '✨ ' : ''}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Stars({ n, size = 28, animate = false }: { n: number; size?: number; animate?: boolean }) {
  return (
    <div className="row" aria-label={`${n} de 5 estrellas`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          width={size}
          height={size}
          initial={animate ? { scale: 0, rotate: -90 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animate ? 0.3 + i * 0.25 : 0, type: 'spring', stiffness: 300, damping: 12 }}
        >
          <path
            d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z"
            fill={i <= n ? 'url(#starg)' : 'rgba(255,255,255,.6)'}
            stroke={i <= n ? '#c48a2a' : 'rgba(150,90,140,.5)'}
            strokeWidth="1.2"
          />
          <defs>
            <linearGradient id="starg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff5c2" />
              <stop offset="0.5" stopColor="#ffd25a" />
              <stop offset="1" stopColor="#f0a020" />
            </linearGradient>
          </defs>
        </motion.svg>
      ))}
    </div>
  )
}

/** Mide la altura de un panel inferior para centrar la muñeca en la zona libre. */
export function useInsetTop(px: number) {
  useEffect(() => {
    useView.getState().set({ insetTop: px })
    return () => useView.getState().set({ insetTop: 0 })
  }, [px])
}

export function useInsetReporter(ref: React.RefObject<HTMLElement | null>, setter: (bottom: number, right: number) => void) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return setter(0, 0)
      const landscape = window.innerWidth > window.innerHeight && window.innerWidth >= 700
      if (landscape) setter(0, window.innerWidth - r.left)
      else setter(window.innerHeight - r.top, 0)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      setter(0, 0)
    }
  }, [ref, setter])
}

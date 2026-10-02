import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useView } from '../../three/view'
import { useGame } from '../../store/game'
import { STORY } from '../../data/story'
import { ITEM_BY_ID } from '../../data/items'
import { DOLL_BY_ID } from '../../data/characters'
import { isItemUnlocked, shopItems, unlockHint } from '../../game/economy'
import { Btn, IconBtn, Modal, TopBar, useInsetReporter, useInsetTop } from '../kit'
import { Coin, Icon } from '../Icon'
import { ItemGlyph } from '../ItemGlyph'
import { audio } from '../../audio/engine'

// ───────────────────── Pasarela ─────────────────────

export function RunwayScreen() {
  const go = useGame((s) => s.go)
  const dollId = useGame((s) => s.look.dollId)
  return (
    <>
      <TopBar title="Pasarela" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass" style={{ position: 'fixed', bottom: 'calc(var(--safe-b) + 14px)', left: '50%', x: '-50%', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap' }} data-testid="runway-ui">
        <span className="display" style={{ fontSize: 17 }}>
          {DOLL_BY_ID[dollId]?.name} en la pasarela
        </span>
        <Btn variant="secondary" size="small" onClick={() => go('studio')}>
          Cambiar look
        </Btn>
      </motion.div>
    </>
  )
}

// ───────────────────── Armario ─────────────────────

export function WardrobeScreen() {
  const looks = useGame((s) => s.save.looks)
  const load = useGame((s) => s.loadLook)
  const rename = useGame((s) => s.renameLook)
  const duplicate = useGame((s) => s.duplicateLook)
  const remove = useGame((s) => s.deleteLook)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  return (
    <>
      <TopBar title="Armario" />
      <div className="scroll" style={{ position: 'fixed', inset: 0, top: 'calc(var(--safe-t) + 66px)', padding: '0 12px calc(var(--safe-b) + 16px)', background: 'linear-gradient(180deg, rgba(255,214,236,.35), rgba(255,214,236,.75))' }}>
        {looks.length === 0 && (
          <div className="glass" style={{ padding: 20, textAlign: 'center', maxWidth: 420, margin: '20px auto' }} data-testid="wardrobe-empty">
            <Icon name="closet" width={48} height={48} style={{ color: 'var(--pink)' }} />
            <p style={{ fontSize: 17 }}>Tu armario está vacío. Crea un look en el estudio y pulsa «Guardar look».</p>
            <Btn onClick={() => useGame.getState().go('studio')}>Ir al estudio</Btn>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {looks.map((l, i) => (
            <motion.div key={l.id} className="glass" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }} style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="look-card">
              <button onClick={() => (audio.sparkle(), load(l.id))} aria-label={`Ponerse ${l.name}`} style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '3/4', background: 'linear-gradient(160deg,#ffe0f1,#e9dcff)' }} data-testid="wear-look">
                {l.thumb ? <img src={l.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Icon name="hanger" width={48} height={48} style={{ color: 'var(--pink)' }} />}
              </button>
              {editing === l.id ? (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    rename(l.id, name)
                    setEditing(null)
                  }}
                >
                  <input className="text-input" style={{ minHeight: 44, fontSize: 15 }} autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-label="Nuevo nombre" data-testid="rename-input" />
                  <IconBtn icon="check" label="Confirmar nombre" type="submit" />
                </form>
              ) : (
                <div className="display" style={{ fontSize: 15, textAlign: 'center', minHeight: 22 }} data-testid="look-name-label">
                  {l.name}
                </div>
              )}
              <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
                <IconBtn icon="edit" label="Renombrar" onClick={() => (setEditing(l.id), setName(l.name))} data-testid="rename-look" />
                <IconBtn icon="copy" label="Duplicar" onClick={() => duplicate(l.id)} data-testid="duplicate-look" />
                <IconBtn icon="trash" label="Borrar" onClick={() => setConfirm(l.id)} data-testid="delete-look" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} label="Borrar look">
        <h2>¿Borrar este look?</h2>
        <p>No se puede deshacer.</p>
        <div className="row center">
          <Btn variant="secondary" onClick={() => setConfirm(null)}>
            Cancelar
          </Btn>
          <Btn
            onClick={() => {
              if (confirm) remove(confirm)
              setConfirm(null)
            }}
            data-testid="confirm-delete"
          >
            Borrar
          </Btn>
        </div>
      </Modal>
    </>
  )
}

// ───────────────────── Tienda ─────────────────────

export function ShopScreen() {
  const save = useGame((s) => s.save)
  const buy = useGame((s) => s.buy)
  const setPreview = useGame((s) => s.setPreview)
  const preview = useGame((s) => s.previewItem)
  const items = shopItems()
  const sheet = useRef<HTMLDivElement>(null)
  const setView = useView((s) => s.set)
  const reporter = useCallback((b: number, r: number) => setView({ insetBottom: b, insetRight: r }), [setView])
  useInsetTop(70)
  useInsetReporter(sheet, reporter)
  return (
    <>
      <TopBar title="Tienda" />
      <div ref={sheet} className="sheet glass" style={{ maxHeight: '50vh' }}>
        <div className="section-title" style={{ padding: '8px 12px 0', margin: 0 }}>
          <span>Toca para probar · Las secretas se ganan jugando</span>
        </div>
        <div className="scroll">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
            {items.map((it) => {
              const owned = isItemUnlocked(it, save)
              const secret = it.rarity === 'secreta'
              const hidden = secret && !owned
              return (
                <motion.div key={it.id} whileTap={{ scale: 0.95 }} className={`card ${preview === it.id ? 'worn' : ''}`} style={{ aspectRatio: '0.78', display: 'flex', flexDirection: 'column', padding: 6 }} data-testid={`shop-${it.id}`}>
                  <button onClick={() => (audio.click(), setPreview(hidden ? null : it.id))} aria-label={hidden ? 'Prenda secreta' : `Probar ${it.name}`} style={{ flex: 1, width: '100%', display: 'grid', placeItems: 'center' }}>
                    {hidden ? <Icon name="lock" width={40} height={40} style={{ color: '#c38bff' }} /> : <ItemGlyph item={it} />}
                  </button>
                  <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'center', lineHeight: 1.15, minHeight: 26 }}>{hidden ? '???' : it.name}</div>
                  {owned ? (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#2f9e6a', textAlign: 'center' }}>¡Tuya!</span>
                  ) : secret ? (
                    <span style={{ fontSize: 10.5, textAlign: 'center', color: 'var(--ink-soft)', lineHeight: 1.2 }}>{unlockHint(it)}</span>
                  ) : (
                    <Btn variant="gold" size="small" style={{ minHeight: 36, padding: '0 8px', fontSize: 14 }} sound="none" onClick={() => (buy(it.id) ? (audio.coin(), audio.sparkle()) : audio.error())} data-testid={`buy-${it.id}`} aria-label={`Comprar ${it.name} por ${it.price} monedas`}>
                      <Coin width={18} height={18} /> {it.price}
                    </Btn>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ───────────────────── Final ─────────────────────

export function EndingScreen() {
  return (
    <>
      <TopBar title="" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1.2 }} style={{ position: 'fixed', top: 'calc(var(--safe-t) + 64px)', left: 12, right: 12, textAlign: 'center', pointerEvents: 'none' }}>
        <h1 className="display holo-text" style={{ fontSize: 'clamp(24px, 7vw, 48px)', margin: 0, filter: 'drop-shadow(0 2px 0 #fff)' }}>
          {STORY.endingTitle}
        </h1>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} style={{ position: 'fixed', bottom: 'calc(var(--safe-b) + 16px)', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <Btn variant="secondary" size="small" onClick={() => (useGame.getState().markEndingSeen(), useGame.getState().go('letter'))} data-testid="skip-to-letter">
          Ir a la carta
        </Btn>
      </motion.div>
    </>
  )
}

export function LetterScreen() {
  const go = useGame((s) => s.go)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => {
      setOpen(true)
      audio.sparkle()
    }, 900)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16, zIndex: 30 }} data-testid="letter">
      <div style={{ position: 'relative', width: 'min(460px, 100%)' }}>
        {/* sobre */}
        <motion.div
          initial={{ y: 80, rotate: -6, opacity: 0 }}
          animate={{ y: open ? 120 : 0, rotate: 0, opacity: open ? 0 : 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 14 }}
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
        >
          <svg viewBox="0 0 200 140" width="80%" aria-hidden="true">
            <rect x="5" y="20" width="190" height="115" rx="10" fill="#ffd1ec" stroke="#fff" strokeWidth="4" />
            <path d="M5 30l95 60 95-60" fill="#ffb3d9" stroke="#fff" strokeWidth="4" />
            <path d="M100 98s-14-9-14-18a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 9-14 18-14 18z" fill="#ff2d8a" />
          </svg>
        </motion.div>
        <motion.article
          className="glass"
          initial={{ scaleY: 0.05, opacity: 0, y: 40 }}
          animate={open ? { scaleY: 1, opacity: 1, y: 0 } : {}}
          transition={{ type: 'spring', stiffness: 70, damping: 15 }}
          style={{ transformOrigin: 'top', padding: '22px 22px 18px', background: 'linear-gradient(180deg, rgba(255,250,252,.97), rgba(255,236,246,.95))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}
          aria-label="Carta"
        >
          <h1 className="display holo-text" style={{ margin: '0 0 6px', fontSize: 30 }}>
            {STORY.endingTitle}
          </h1>
          {STORY.letter.map((p, i) => (
            <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={open ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.8 + i * 0.7 }} style={{ margin: '0 0 10px', lineHeight: 1.5, fontSize: i === 0 ? 19 : 16.5, fontWeight: i === 0 ? 800 : 500, color: 'var(--ink)' }}>
              {p}
            </motion.p>
          ))}
          <motion.div initial={{ opacity: 0 }} animate={open ? { opacity: 1 } : {}} transition={{ delay: 0.8 + STORY.letter.length * 0.7 }}>
            <p className="display" style={{ textAlign: 'right', fontSize: 22, color: 'var(--fuchsia)', margin: '4px 0' }}>
              {STORY.signature}
            </p>
            <p style={{ textAlign: 'center', fontWeight: 800, color: 'var(--ink-soft)', margin: '10px 0 14px' }} data-testid="letter-dates">
              {STORY.dates}
            </p>
            <div className="row center">
              <Btn onClick={() => go('home')} data-testid="letter-home">
                <Icon name="home" width={20} height={20} /> Volver al inicio
              </Btn>
            </div>
          </motion.div>
        </motion.article>
      </div>
    </div>
  )
}

export const _unused = ITEM_BY_ID

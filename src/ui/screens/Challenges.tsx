import { motion } from 'framer-motion'
import { useState, type ReactElement } from 'react'
import { useGame } from '../../store/game'
import { CHALLENGES, JUDGES } from '../../data/challenges'
import { tagLabel } from '../../game/scoring'
import { completedCount } from '../../game/economy'
import { Btn, Modal, Stars, TopBar } from '../kit'
import { Icon, type IconName } from '../Icon'
import { Coin } from '../Icon'
import type { ChallengeDef } from '../../data/types'

export function ChallengesScreen() {
  const stars = useGame((s) => s.save.challengeStars)
  const save = useGame((s) => s.save)
  const startChallenge = useGame((s) => s.startChallenge)
  const [open, setOpen] = useState<ChallengeDef | null>(null)
  const [timed, setTimed] = useState(true)
  const done = completedCount(save)
  return (
    <>
      <TopBar title="Retos de estilo" />
      <div style={{ position: 'fixed', inset: 0, top: 'calc(var(--safe-t) + 66px)', overflowY: 'auto', padding: '0 12px calc(var(--safe-b) + 16px)' }} className="scroll">
        <div className="glass" style={{ padding: '10px 14px', marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="display" style={{ fontSize: 17 }}>
              Completados {done}/{CHALLENGES.length}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Al completarlos todos… ✈</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.7)', marginTop: 6, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(done / CHALLENGES.length) * 100}%` }} style={{ height: '100%', background: 'linear-gradient(90deg,#ff7ac8,#c43bff)' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {CHALLENGES.map((c, i) => (
            <motion.button
              key={c.id}
              className="glass"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setOpen(c)}
              data-testid={`challenge-${c.id}`}
              style={{ padding: 12, textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', minHeight: 76 }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#ffd1ec,#e3d1ff)', color: 'var(--fuchsia)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name={c.icon as IconName} width={30} height={30} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 17, color: 'var(--ink)' }}>
                  {c.title}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 2 }}>
                  <Stars n={stars[c.id] ?? 0} size={16} />
                  {c.timeLimit && <Icon name="timer" width={16} height={16} style={{ color: 'var(--ink-soft)' }} aria-label="Con tiempo" />}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} label="Reto">
        {open && (
          <>
            <h2>{open.title}</h2>
            <p>{open.brief}</p>
            <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
              {open.wantedTags.map((t) => (
                <span key={t} className="chip active" style={{ minHeight: 32 }}>
                  {tagLabel(t)}
                </span>
              ))}
              {open.palette?.map((c) => (
                <span key={c} className="swatch" style={{ width: 28, height: 28, background: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
            <p style={{ fontSize: 14 }}>
              Mínimo {open.minAccessories} accesorio{open.minAccessories === 1 ? '' : 's'}
              {open.required?.length ? ' · Obligatorio: ' + open.required.map((r) => ({ shoes: 'calzado', bag: 'bolso', jacket: 'chaqueta' })[r as 'shoes'] ?? r).join(', ') : ''}
            </p>
            {open.timeLimit && (
              <label className="row" style={{ marginBottom: 12, gap: 10, minHeight: 44 }}>
                <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} style={{ width: 24, height: 24, accentColor: '#ff2d8a' }} data-testid="timed" />
                Con cuenta atrás ({open.timeLimit} s)
              </label>
            )}
            <div className="row center">
              <Btn
                size="big"
                sound="sparkle"
                onClick={() => {
                  startChallenge(open.id, Boolean(open.timeLimit && timed))
                  setOpen(null)
                }}
                data-testid="start-challenge"
              >
                ¡A vestirse!
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

const JUDGE_FACE: Record<string, ReactElement> = {
  perla: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="20" fill="#f6d2c2" />
      <path d="M10 30c0-16 10-24 22-24s22 8 22 24c-4-8-10-12-22-12S14 22 10 30z" fill="#e8f1ff" />
      <circle cx="18" cy="16" r="5" fill="#fff" />
      <circle cx="46" cy="16" r="5" fill="#fff" />
      <path d="M22 32c2-2 6-2 8 0M34 32c2-2 6-2 8 0" stroke="#3a1238" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M26 44c3 3 9 3 12 0" stroke="#c2185b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="56" r="3" fill="#fff" />
    </svg>
  ),
  kiko: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="20" fill="#c08a68" />
      <path d="M12 26c2-14 12-20 20-20s18 6 20 20c-6-6-12-8-20-8s-14 2-20 8z" fill="#8f5bff" />
      <rect x="16" y="28" width="13" height="8" rx="3" fill="#2b1240" />
      <rect x="35" y="28" width="13" height="8" rx="3" fill="#2b1240" />
      <path d="M29 31h6" stroke="#2b1240" strokeWidth="2" />
      <path d="M25 45c4 3 10 3 14 0" stroke="#3a1238" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  ),
  gata: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 26L14 6l12 12h12l12-12 2 20c2 4 2 10 0 14-4 12-14 18-20 18s-16-6-20-18c-2-4-2-10 0-14z" fill="#f2c26b" />
      <ellipse cx="24" cy="32" rx="4" ry="5" fill="#3de0c4" />
      <ellipse cx="40" cy="32" rx="4" ry="5" fill="#3de0c4" />
      <path d="M24 30v4M40 30v4" stroke="#14301c" strokeWidth="2" />
      <path d="M30 40h4l-2 3zM32 43c-2 3-5 3-7 1M32 43c2 3 5 3 7 1M8 38l12 2M8 44l12-1M56 38l-12 2M56 44l-12-1" stroke="#7a4a20" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M20 8l4 8M44 8l-4 8" stroke="#ff7ac8" strokeWidth="3" />
    </svg>
  ),
}

export function JuryScreen() {
  const jury = useGame((s) => s.jury)
  const go = useGame((s) => s.go)
  const startChallenge = useGame((s) => s.startChallenge)
  if (!jury) return null
  const sc = jury.score
  const bars: [string, number][] = [
    ['Estilo', sc.style],
    ['Colores', sc.color],
    ['Accesorios', sc.accessories],
    ['Look completo', sc.completeness],
  ]
  return (
    <>
      <TopBar title="El jurado" />
      <motion.div
        className="glass"
        data-testid="jury"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 140, damping: 18 }}
        style={{ position: 'fixed', left: 10, right: 10, bottom: 'calc(var(--safe-b) + 10px)', maxHeight: '62vh', overflowY: 'auto', padding: 14, margin: '0 auto', maxWidth: 560 }}
      >
        <div className="row" style={{ justifyContent: 'center', flexDirection: 'column' }}>
          <Stars n={sc.stars} size={40} animate />
          <span className="sr-only" data-testid="jury-stars">
            {sc.stars}
          </span>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.8, type: 'spring' }} className="coins" style={{ marginTop: 8 }} data-testid="jury-reward">
            <Coin /> +{jury.reward.coins}
          </motion.div>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {JUDGES.map((j, i) => (
            <motion.div key={j.id} initial={{ x: i % 2 ? 40 : -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 + i * 0.35 }} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', border: `3px solid ${j.color}`, flex: 'none', overflow: 'hidden' }}>{JUDGE_FACE[j.id]}</div>
              <div className="glass" style={{ padding: '8px 12px', borderRadius: '4px 16px 16px 16px', flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: j.color }}>
                  {j.name} · {j.role}
                </div>
                <div style={{ fontSize: 15 }}>{jury.comments[i]}</div>
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          {bars.map(([label, v]) => (
            <div key={label} style={{ marginBottom: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                <span>{label}</span>
                <span>{Math.round(v * 100)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.7)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ delay: 1.2, duration: 0.8 }} style={{ height: '100%', background: 'linear-gradient(90deg,#ff7ac8,#c43bff)' }} />
              </div>
            </div>
          ))}
          {sc.tips.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 14 }}>
              {sc.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="row center wrap" style={{ marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => startChallenge(jury.challengeId)} data-testid="retry">
            Repetir
          </Btn>
          <Btn onClick={() => go('challenges')} data-testid="to-challenges">
            Más retos
          </Btn>
        </div>
      </motion.div>
    </>
  )
}

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useView } from '../three/view'
import { STORY } from '../data/story'

// Pantalla de carga con barra de progreso purpurina.

export default function Loading() {
  const real = useView((s) => s.progress)
  const [p, setP] = useState(0.05)
  useEffect(() => {
    // avance suave mientras se descarga y compila el 3D
    const t = setInterval(() => setP((v) => Math.max(real, v + (0.92 - v) * 0.06)), 80)
    return () => clearInterval(t)
  }, [real])
  return (
    <motion.div
      role="progressbar"
      aria-label="Cargando"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      data-testid="loading"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at 50% 30%, #ffe3f3 0%, #ffb9dd 45%, #c9a7ff 100%)',
      }}
    >
      <div style={{ textAlign: 'center', width: 'min(320px, 80vw)' }}>
        <motion.svg viewBox="0 0 64 64" width="84" height="84" animate={{ scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} aria-hidden="true">
          <defs>
            <linearGradient id="lh" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff9fd0" />
              <stop offset="1" stopColor="#ff2d8a" />
            </linearGradient>
          </defs>
          <path d="M32 56C10 42 4 30 4 21 4 12 11 6 19 6c6 0 10 3 13 8 3-5 7-8 13-8 8 0 15 6 15 15 0 9-6 21-28 35z" fill="url(#lh)" stroke="#fff" strokeWidth="3" />
          <path d="M44 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" />
        </motion.svg>
        <h1 className="display holo-text" style={{ fontSize: 40, margin: '8px 0 4px' }}>
          {STORY.homeTitle}
        </h1>
        <p className="display" style={{ margin: '0 0 18px', color: '#fff', textShadow: '0 1px 6px rgba(150,20,100,.5)', fontSize: 16 }}>
          Preparando el vestidor…
        </p>
        <div style={{ height: 16, borderRadius: 999, background: 'rgba(255,255,255,.6)', border: '2px solid #fff', overflow: 'hidden', boxShadow: '0 4px 12px rgba(140,30,110,.2)' }}>
          <motion.div style={{ height: '100%', width: `${p * 100}%`, background: 'linear-gradient(90deg,#ff7ac8,#ff2d8a,#c43bff,#7fd6ff)', backgroundSize: '200% 100%', borderRadius: 999 }} animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} />
        </div>
        <p style={{ marginTop: 8, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(150,20,100,.5)' }}>{Math.round(p * 100)} %</p>
      </div>
    </motion.div>
  )
}

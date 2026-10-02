import { motion } from 'framer-motion'
import { STORY } from '../data/story'

// Portada 2D ligera: se muestra al instante y el 3D se carga al tocar.
export default function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at 50% 28%, #ffe7f5 0%, #ffb5da 40%, #b98bff 100%)',
      }}
    >
      {Array.from({ length: 14 }, (_, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          width={14 + (i % 4) * 8}
          height={14 + (i % 4) * 8}
          aria-hidden="true"
          style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8], rotate: [0, 45, 0] }}
          transition={{ repeat: Infinity, duration: 2.4 + (i % 3), delay: i * 0.2 }}
        >
          <path d="M12 1c1 7 4 10 11 11-7 1-10 4-11 11-1-7-4-10-11-11 7-1 10-4 11-11z" fill="#fff" />
        </motion.svg>
      ))}
      <div style={{ textAlign: 'center', padding: 24, position: 'relative', maxWidth: 520 }}>
        <motion.svg viewBox="0 0 64 64" width="120" height="120" aria-hidden="true" animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <defs>
            <linearGradient id="sh" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffb3dc" />
              <stop offset="0.6" stopColor="#ff2d8a" />
              <stop offset="1" stopColor="#c43bff" />
            </linearGradient>
          </defs>
          <path d="M32 58C9 43 3 31 3 21 3 11 11 5 19 5c6 0 10 3 13 8 3-5 7-8 13-8 8 0 16 6 16 16 0 10-6 22-29 37z" fill="url(#sh)" stroke="#fff" strokeWidth="3" />
          <path d="M18 14c-4 1-7 5-7 9" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
          <path d="M46 15l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" />
        </motion.svg>
        <p className="display" style={{ margin: '12px 0 0', fontSize: 'clamp(17px, 4.6vw, 24px)', color: '#fff', textShadow: '0 2px 8px rgba(150,20,100,.6)' }}>
          {STORY.homeSubtitle}
        </p>
        <h1 className="display holo-text" style={{ margin: '4px 0 26px', fontSize: 'clamp(48px, 14vw, 92px)', lineHeight: 0.95, filter: 'drop-shadow(0 3px 0 #fff) drop-shadow(0 6px 14px rgba(160,20,110,.45))' }}>
          {STORY.homeTitle}
        </h1>
        <button className="btn big pulse" onClick={onStart} data-testid="start">
          Toca para empezar
        </button>
        <p style={{ marginTop: 16, color: '#fff', fontWeight: 700, textShadow: '0 1px 4px rgba(150,20,100,.5)' }}>Sube el volumen: hay música 🎶</p>
      </div>
    </div>
  )
}

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useGame } from '../../store/game'
import { interaction } from '../../three/view'
import { Btn } from '../kit'
import { Icon, type IconName } from '../Icon'
import { audio } from '../../audio/engine'

// Tutorial interactivo de 3 pasos (solo la primera vez).

const STEPS: { title: string; text: string; icon: IconName }[] = [
  { title: '¡Hola, soy Clara!', text: 'Toca cualquier prenda del panel para vestirme.', icon: 'hanger' },
  { title: 'Gírame', text: 'Arrastra el dedo sobre mí para verme por todos lados. Pellizca para acercarte.', icon: 'hand' },
  { title: '¡Brilla y gana!', text: 'Supera retos para ganar monedas de purpurina y canjéalas en la tienda. Hay sorpresas escondidas…', icon: 'sparkle' },
]

export default function Onboarding() {
  const step = useGame((s) => s.onboardingStep)
  const setStep = useGame((s) => s.setOnboardingStep)
  const finish = useGame((s) => s.finishOnboarding)
  const sparkle = useGame((s) => s.sparkle)
  const startSparkle = useRef(sparkle)
  const startRot = useRef(interaction.dollRotY)
  // paso 1: completar al ponerse una prenda
  useEffect(() => {
    if (step === 0 && sparkle !== startSparkle.current) {
      audio.sparkle()
      startRot.current = interaction.dollRotY
      setStep(1)
    }
  }, [sparkle, step, setStep])
  // paso 2: completar al girar a la muñeca
  useEffect(() => {
    if (step !== 1) return
    const t = setInterval(() => {
      if (Math.abs(interaction.dollRotY - startRot.current) > 0.6) {
        audio.sparkle()
        setStep(2)
      }
    }, 120)
    return () => clearInterval(t)
  }, [step, setStep])
  if (step > 2) return null
  const s = STEPS[step]
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        className="glass"
        role="dialog"
        aria-label={`Tutorial, paso ${step + 1} de 3`}
        data-testid={`onboarding-${step + 1}`}
        initial={{ y: -20, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -10, opacity: 0 }}
        style={{ position: 'fixed', top: 'calc(var(--safe-t) + 118px)', left: 12, width: 'min(340px, calc(100% - 84px))', padding: '14px 16px', zIndex: 40, pointerEvents: step === 1 ? 'none' : 'auto' }}
      >
        <div className="row" style={{ gap: 10 }}>
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#ff7ac8,#c43bff)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon name={s.icon} width={26} height={26} />
          </motion.div>
          <div>
            <div className="display" style={{ fontSize: 18, color: 'var(--fuchsia)' }}>
              {s.title} <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{step + 1}/3</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.35 }}>{s.text}</div>
          </div>
        </div>
        {step === 2 && (
          <Btn sound="sparkle" style={{ width: '100%', marginTop: 10 }} onClick={finish} data-testid="onboarding-done">
            ¡A brillar!
          </Btn>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { audio } from '../audio/engine'
import { useAudioSettings } from '../audio/settings'
import { useGame } from '../store/game'
import { Btn, IconBtn, Modal } from './kit'

// Panel de ajustes de sonido: música, efectos, silencio general y vibración.

function Switch({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId: string }) {
  return (
    <motion.button
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        audio.click()
        onChange(!on)
      }}
      style={{ flex: 'none', width: 58, height: 34, borderRadius: 999, background: on ? 'linear-gradient(135deg,#ff7ac8,#ff2d8a)' : '#e9d3e3', position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.12)' }}
    >
      <span style={{ position: 'absolute', top: 4, left: on ? 28 : 4, width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.2)', transition: 'left .18s' }} />
    </motion.button>
  )
}

function Volume({ label, value, onChange, testId }: { label: string; value: number; onChange: (v: number) => void; testId: string }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }} data-testid={`${testId}-value`}>
          {Math.round(value * 100)} %
        </span>
      </span>
      <input className="slider" type="range" min={0} max={1} step={0.05} value={value} aria-label={`Volumen de ${label.toLowerCase()}`} data-testid={testId} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/** Prueba de efectos: tela, cremallera, dos tacones y aplausos. */
function demo() {
  audio.fabric()
  setTimeout(() => audio.zipper(), 380)
  setTimeout(() => audio.heel(-0.3), 950)
  setTimeout(() => audio.heel(0.3), 1250)
  setTimeout(() => audio.applause(0.8), 1650)
}

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { music, sfx, vibration, set } = useAudioSettings()
  const muted = useGame((s) => s.save.settings.muted)
  const setSettings = useGame((s) => s.setSettings)
  const lastPreview = useRef(0)
  return (
    <Modal open={open} onClose={onClose} label="Ajustes de sonido">
      <div data-testid="settings-panel" style={{ display: 'grid', gap: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Ajustes</h2>
          <IconBtn icon="close" label="Cerrar ajustes" onClick={onClose} data-testid="settings-close" />
        </div>
        <Volume label="Música" value={music} onChange={(v) => set({ music: v })} testId="vol-music" />
        <Volume
          label="Efectos"
          value={sfx}
          testId="vol-sfx"
          onChange={(v) => {
            set({ sfx: v })
            audio.setMix(music, v)
            // muestra corta del nuevo volumen, sin saturar al arrastrar
            const now = performance.now()
            if (now - lastPreview.current > 250) {
              lastPreview.current = now
              audio.heel()
            }
          }}
        />
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontWeight: 700 }}>Silencio general</span>
          <Switch on={muted} onChange={(v) => setSettings({ muted: v })} label="Silencio general" testId="settings-mute" />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span>
            <span style={{ fontWeight: 700, display: 'block' }}>Vibración</span>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Sigue el ritmo de los efectos</span>
          </span>
          <Switch
            on={vibration}
            onChange={(v) => {
              set({ vibration: v })
              if (v) audio.sparkle()
            }}
            label="Vibración"
            testId="settings-vibration"
          />
        </div>
        <Btn variant="secondary" sound="none" onClick={demo} data-testid="settings-test">
          Probar efectos
        </Btn>
      </div>
    </Modal>
  )
}

/** Botón de engranaje que abre el panel de ajustes. */
export function SettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconBtn icon="gear" label="Ajustes" onClick={() => setOpen(true)} data-testid="settings-open" />
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

import { useEffect, useState } from 'react'
import { useGame } from '../store/game'
import { interaction } from '../three/view'
import type { Quality } from '../game/save'

// Panel de depuración (?debug=1): FPS, desbloquear todo, final y calidad.

export default function DebugPanel() {
  const [fps, setFps] = useState(0)
  const [open, setOpen] = useState(true)
  const quality = useGame((s) => s.save.settings.quality)
  const effective = useGame((s) => s.quality)
  const setSettings = useGame((s) => s.setSettings)
  useEffect(() => {
    const t = setInterval(() => setFps(interaction.fps), 400)
    return () => clearInterval(t)
  }, [])
  const st = useGame.getState
  return (
    <div
      data-testid="debug"
      className="glass"
      style={{ position: 'fixed', left: 8, bottom: 'calc(var(--safe-b) + 8px)', zIndex: 200, padding: 8, fontSize: 13, borderRadius: 14, maxWidth: 230, background: 'rgba(30,10,40,.78)', color: '#fff' }}
    >
      <button onClick={() => setOpen(!open)} style={{ fontWeight: 800, minHeight: 32 }} data-testid="debug-fps">
        FPS {fps.toFixed(0)} · {effective}
      </button>
      {open && (
        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          <button className="chip" data-testid="debug-unlock" onClick={() => st().debugUnlockAll()}>
            Desbloquear todo
          </button>
          <button
            className="chip"
            data-testid="debug-ending"
            onClick={() => {
              st().debugUnlockAll()
              st().go('ending')
            }}
          >
            Saltar al final
          </button>
          <button className="chip" data-testid="debug-reset" onClick={() => st().debugReset()}>
            Resetear guardado
          </button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Calidad
            <select value={quality} onChange={(e) => setSettings({ quality: e.target.value as Quality })} data-testid="debug-quality" style={{ minHeight: 32, borderRadius: 8 }}>
              <option value="auto">auto</option>
              <option value="baja">baja</option>
              <option value="media">media</option>
              <option value="alta">alta</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

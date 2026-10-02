import * as THREE from 'three'
import type { PatternId } from '../data/types'
import { mixHex } from '../game/color'

// Texturas procedurales generadas en canvas (recoloreables en tiempo real).

const SIZE = 256
const cache = new Map<string, THREE.CanvasTexture>()

function canvas(size = SIZE) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

/** Generador pseudoaleatorio determinista para que las texturas sean estables. */
function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const lighten = (c: string, t: number) => mixHex(c, '#ffffff', t)
const darken = (c: string, t: number) => mixHex(c, '#000000', t)

type Painter = (ctx: CanvasRenderingContext2D, c1: string, c2: string, S: number) => void

/** Dibuja algo repitiéndolo en los bordes para que la textura sea continua. */
function tiled(_ctx: CanvasRenderingContext2D, S: number, x: number, y: number, draw: (x: number, y: number) => void) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy)
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
}
function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + r)
  ctx.bezierCurveTo(x - r * 0.2, y + r * 0.75, x - r * 1.1, y + r * 0.2, x - r, y - r * 0.3)
  ctx.bezierCurveTo(x - r * 0.9, y - r * 0.95, x - r * 0.2, y - r * 0.9, x, y - r * 0.45)
  ctx.bezierCurveTo(x + r * 0.2, y - r * 0.9, x + r * 0.9, y - r * 0.95, x + r, y - r * 0.3)
  ctx.bezierCurveTo(x + r * 1.1, y + r * 0.2, x + r * 0.2, y + r * 0.75, x, y + r)
  ctx.closePath()
}

function noise(ctx: CanvasRenderingContext2D, S: number, amt: number, seed: number) {
  const img = ctx.getImageData(0, 0, S, S)
  const r = rand(seed)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amt
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
}

const PAINTERS: Record<PatternId, Painter> = {
  liso(ctx, c1, _c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    // trama de tejido sutil
    ctx.globalAlpha = 0.06
    ctx.fillStyle = '#000'
    for (let i = 0; i < S; i += 2) ctx.fillRect(0, i, S, 1)
    ctx.globalAlpha = 0.04
    for (let i = 0; i < S; i += 2) ctx.fillRect(i, 0, 1, S)
    ctx.globalAlpha = 1
    noise(ctx, S, 10, 3)
  },
  denim(ctx, c1, _c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const r = rand(11)
    // sarga diagonal
    for (let i = -S; i < S * 2; i += 3) {
      ctx.strokeStyle = r() > 0.5 ? lighten(c1, 0.22 + r() * 0.12) : darken(c1, 0.12)
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + S, S)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // desgastes
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`
      const x = r() * S
      const y = r() * S
      tiled(ctx, S, x, y, (xx, yy) => ctx.fillRect(xx, yy, 2 + r() * 30, 1.5))
    }
    noise(ctx, S, 26, 12)
  },
  escoces(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const bands = [
      { p: 0, w: 70, c: c2, a: 0.55 },
      { p: 110, w: 26, c: c2, a: 0.4 },
      { p: 170, w: 10, c: '#ffffff', a: 0.55 },
      { p: 200, w: 40, c: darken(c1, 0.35), a: 0.45 },
      { p: 252, w: 3, c: '#fff16a', a: 0.7 },
    ]
    for (const b of bands) {
      ctx.globalAlpha = b.a
      ctx.fillStyle = b.c
      ctx.fillRect(0, b.p, S, b.w)
      ctx.fillRect(b.p, 0, b.w, S)
    }
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = '#000'
    for (let i = -S; i < S * 2; i += 4) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + S, S)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },
  leopardo(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const r = rand(5)
    for (let k = 0; k < 26; k++) {
      const x = r() * S
      const y = r() * S
      const sz = 9 + r() * 9
      tiled(ctx, S, x, y, (xx, yy) => {
        ctx.fillStyle = darken(c1, 0.25)
        ctx.beginPath()
        ctx.ellipse(xx, yy, sz * 0.75, sz * 0.6, r() * 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = c2
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        for (let i = 0; i < 4; i++) {
          const a0 = i * 1.6 + r() * 0.6
          ctx.beginPath()
          ctx.arc(xx, yy, sz, a0, a0 + 0.9)
          ctx.stroke()
        }
      })
    }
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = c2
      const x = r() * S
      const y = r() * S
      tiled(ctx, S, x, y, (xx, yy) => {
        ctx.beginPath()
        ctx.arc(xx, yy, 2 + r() * 2.5, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    noise(ctx, S, 14, 6)
  },
  cebra(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = c2
    for (let i = 0; i < 8; i++) {
      const y0 = (i / 8) * S
      ctx.beginPath()
      for (let x = 0; x <= S; x += 4) {
        const y = y0 + Math.sin((x / S) * Math.PI * 2 * 2 + i) * 9 + Math.sin((x / S) * Math.PI * 2 * 5) * 3
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      for (let x = S; x >= 0; x -= 4) {
        const y = y0 + 11 + Math.sin((x / S) * Math.PI * 2 * 2 + i + 0.6) * 9 + Math.sin((x / S) * Math.PI * 2 * 3) * 3
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    }
  },
  purpurina(ctx, c1, _c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const r = rand(9)
    for (let k = 0; k < 2600; k++) {
      const v = r()
      ctx.fillStyle = v > 0.75 ? '#ffffff' : v > 0.4 ? lighten(c1, 0.5) : darken(c1, 0.3)
      ctx.globalAlpha = 0.5 + r() * 0.5
      ctx.fillRect(r() * S, r() * S, 1.6, 1.6)
    }
    ctx.globalAlpha = 1
  },
  lentejuelas(ctx, c1, _c2, S) {
    ctx.fillStyle = darken(c1, 0.35)
    ctx.fillRect(0, 0, S, S)
    const n = 16
    const step = S / n
    const r = rand(4)
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = i * step + (j % 2 ? step / 2 : 0)
        const y = j * step * 0.9
        tiled(ctx, S, x, y, (xx, yy) => {
          const t = r()
          const g = ctx.createRadialGradient(xx - 2, yy - 3, 0.5, xx, yy, step * 0.62)
          g.addColorStop(0, t > 0.8 ? '#ffffff' : lighten(c1, 0.55))
          g.addColorStop(0.45, lighten(c1, 0.1 + t * 0.2))
          g.addColorStop(1, darken(c1, 0.25))
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(xx, yy, step * 0.6, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    }
  },
  saten(ctx, c1, _c2, S) {
    const g = ctx.createLinearGradient(0, 0, S, S)
    g.addColorStop(0, c1)
    g.addColorStop(0.25, lighten(c1, 0.18))
    g.addColorStop(0.5, c1)
    g.addColorStop(0.75, lighten(c1, 0.12))
    g.addColorStop(1, c1)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  },
  rejilla(ctx, c1, _c2, S) {
    ctx.clearRect(0, 0, S, S)
    ctx.strokeStyle = c1
    ctx.lineWidth = 5
    const step = S / 6
    for (let i = -S; i <= S * 2; i += step) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + S, S)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(i, S)
      ctx.lineTo(i + S, 0)
      ctx.stroke()
    }
  },
  corazones(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const n = 4
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = (i + (j % 2 ? 0.5 : 0)) * (S / n) + S / n / 2
        const y = j * (S / n) + S / n / 2
        tiled(ctx, S, x, y, (xx, yy) => {
          ctx.fillStyle = c2
          heartPath(ctx, xx, yy, 12)
          ctx.fill()
        })
      }
    noise(ctx, S, 8, 2)
  },
  estrellas(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const r = rand(21)
    for (let k = 0; k < 18; k++) {
      const x = r() * S
      const y = r() * S
      const sz = 6 + r() * 10
      const rot = r()
      tiled(ctx, S, x, y, (xx, yy) => {
        ctx.fillStyle = c2
        starPath(ctx, xx, yy, sz, rot)
        ctx.fill()
      })
    }
    noise(ctx, S, 8, 2)
  },
  flores(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    const r = rand(33)
    for (let k = 0; k < 14; k++) {
      const x = r() * S
      const y = r() * S
      const sz = 9 + r() * 8
      const rot = r() * 6
      tiled(ctx, S, x, y, (xx, yy) => {
        ctx.fillStyle = mixHex(c2, '#3fae6a', 0.6)
        ctx.beginPath()
        ctx.ellipse(xx + sz, yy + sz * 0.6, sz * 0.6, sz * 0.25, 0.6, 0, Math.PI * 2)
        ctx.fill()
        for (let p = 0; p < 5; p++) {
          const a = rot + (p / 5) * Math.PI * 2
          ctx.fillStyle = p % 2 ? c2 : lighten(c2, 0.2)
          ctx.beginPath()
          ctx.ellipse(xx + Math.cos(a) * sz * 0.55, yy + Math.sin(a) * sz * 0.55, sz * 0.5, sz * 0.32, a, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#ffd34d'
        ctx.beginPath()
        ctx.arc(xx, yy, sz * 0.25, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    noise(ctx, S, 8, 2)
  },
  rayas(ctx, c1, c2, S) {
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = c2
    for (let i = 0; i < 8; i++) ctx.fillRect(0, i * (S / 8), S, S / 16)
    noise(ctx, S, 8, 2)
  },
  escamas(ctx, c1, c2, S) {
    ctx.fillStyle = darken(c1, 0.3)
    ctx.fillRect(0, 0, S, S)
    const n = 10
    const step = S / n
    for (let j = n + 1; j >= -1; j--) {
      for (let i = 0; i <= n; i++) {
        const x = i * step + (j % 2 ? step / 2 : 0)
        const y = j * step * 0.6
        tiled(ctx, S, x, y, (xx, yy) => {
          const t = ((yy % S) + S) % S
          const base = mixHex(c1, c2, t / S)
          const g = ctx.createRadialGradient(xx, yy - step * 0.4, 1, xx, yy, step * 0.75)
          g.addColorStop(0, lighten(base, 0.5))
          g.addColorStop(0.6, base)
          g.addColorStop(1, darken(base, 0.35))
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(xx, yy, step * 0.62, 0, Math.PI)
          ctx.fill()
        })
      }
    }
  },
}

export function patternTexture(pattern: PatternId, c1: string, c2 = '#ffffff'): THREE.CanvasTexture {
  const key = `${pattern}|${c1}|${c2}`
  const hit = cache.get(key)
  if (hit) return hit
  const cv = canvas()
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  PAINTERS[pattern](ctx, c1, c2, SIZE)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  // Escala por estampado (UV en unidades de 10 cm)
  const scale: Partial<Record<PatternId, number>> = {
    liso: 1,
    denim: 1.2,
    escoces: 0.9,
    leopardo: 0.8,
    cebra: 0.8,
    purpurina: 1.1,
    lentejuelas: 3.2,
    rejilla: 2.2,
    corazones: 1.3,
    estrellas: 1.2,
    flores: 1.1,
    rayas: 0.9,
    escamas: 2.2,
  }
  const s = scale[pattern] ?? 1
  t.repeat.set(s, s)
  if (cache.size > 120) {
    const first = cache.keys().next().value as string
    cache.get(first)?.dispose()
    cache.delete(first)
  }
  cache.set(key, t)
  return t
}

/** Mapa de relieve en escala de grises para un estampado (purpurina, lentejuelas…). */
export function bumpTexture(pattern: PatternId): THREE.CanvasTexture {
  return patternTexture(pattern, '#808080', '#404040')
}

/** Textura de mechones de pelo (v = raíz → punta). */
export function hairTexture(base: string, hi: string, hiOn: boolean, tips: string, tipsOn: boolean, alongU = false): THREE.CanvasTexture {
  const key = `hair|${base}|${hi}|${hiOn}|${tips}|${tipsOn}|${alongU}`
  const hit = cache.get(key)
  if (hit) return hit
  const S = 256
  const cv = canvas(S)
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  const r = rand(77)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)
  // mechones finos
  for (let i = 0; i < 900; i++) {
    const x = r() * S
    const w = 0.5 + r() * 1.2
    const v = r()
    ctx.fillStyle = v > 0.6 ? lighten(base, 0.05 + r() * 0.1) : darken(base, 0.1 + r() * 0.2)
    ctx.globalAlpha = 0.2 + r() * 0.35
    ctx.fillRect(x, 0, w, S)
  }
  ctx.globalAlpha = 1
  if (hiOn) {
    for (let i = 0; i < 18; i++) {
      const x = r() * S
      const w = 2 + r() * 5
      const g = ctx.createLinearGradient(x, 0, x + w, 0)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.5, hi)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.globalAlpha = 0.55
      ctx.fillRect(x, 0, w, S)
    }
    ctx.globalAlpha = 1
  }
  if (tipsOn) {
    const g = ctx.createLinearGradient(0, S * 0.55, 0, S)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, tips)
    ctx.fillStyle = g
    ctx.globalAlpha = 0.95
    ctx.fillRect(0, S * 0.55, S, S * 0.45)
    ctx.globalAlpha = 1
  }
  let out: HTMLCanvasElement = cv
  if (alongU) {
    const c2 = canvas(S)
    const x = c2.getContext('2d')!
    x.translate(S / 2, S / 2)
    x.rotate(-Math.PI / 2)
    x.drawImage(cv, -S / 2, -S / 2)
    out = c2
  }
  const t = new THREE.CanvasTexture(out)
  t.wrapS = t.wrapT = alongU ? THREE.RepeatWrapping : THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  cache.set(key, t)
  return t
}

/** Sprite de destello en forma de estrella de 4 puntas (para partículas). */
let sparkleTex: THREE.CanvasTexture | null = null
export function sparkleTexture(): THREE.CanvasTexture {
  if (sparkleTex) return sparkleTex
  const S = 128
  const cv = canvas(S)
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,240,250,0.8)')
  g.addColorStop(0.4, 'rgba(255,180,230,0.15)')
  g.addColorStop(1, 'rgba(255,180,230,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.moveTo(S / 2, 2)
  ctx.quadraticCurveTo(S / 2 + 5, S / 2 - 5, S - 2, S / 2)
  ctx.quadraticCurveTo(S / 2 + 5, S / 2 + 5, S / 2, S - 2)
  ctx.quadraticCurveTo(S / 2 - 5, S / 2 + 5, 2, S / 2)
  ctx.quadraticCurveTo(S / 2 - 5, S / 2 - 5, S / 2, 2)
  ctx.fill()
  sparkleTex = new THREE.CanvasTexture(cv)
  sparkleTex.colorSpace = THREE.SRGBColorSpace
  return sparkleTex
}

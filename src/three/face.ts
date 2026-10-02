import * as THREE from 'three'
import type { DollDef, Expression, MakeupLook } from '../data/types'
import { FACE } from './body'
import { mixHex } from '../game/color'

// Cara pintada (estilo muñeca) en vista frontal, en coordenadas de mundo
// relativas al centro de la cabeza (y hacia arriba). El maquillaje son capas.

export interface FaceOpts {
  doll: DollDef
  makeup: MakeupLook
  expression: Expression
  closed: boolean
  res: number
}

type Ctx = CanvasRenderingContext2D

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Mezcla un color con blanco/negro. */
const tint = (hex: string, t: number) => (t >= 0 ? mixHex(hex, '#ffffff', t) : mixHex(hex, '#000000', -t))

function setWorld(ctx: Ctx, w: number, h: number) {
  const k = w / (2 * FACE.w)
  ctx.setTransform(k, 0, 0, -k, w / 2, h / 2)
}

// Geometría del ojo (lado s = +1 izquierda de la muñeca / derecha del espectador)
function eyePts(s: number, size: number) {
  const cx = s * 0.0475
  const cy = -0.002
  const k = size * 1.22
  return {
    cx,
    cy,
    inner: [cx - s * 0.0245 * k, cy - 0.003 * k] as const,
    outer: [cx + s * 0.0262 * k, cy + 0.0042 * k] as const,
    top: cy + 0.0158 * k,
    bottom: cy - 0.0142 * k,
    k,
  }
}

function upperLid(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number) {
  const [ix, iy] = e.inner
  const [ox, oy] = e.outer
  ctx.moveTo(ix, iy)
  ctx.bezierCurveTo(ix + s * 0.006 * e.k, e.top + 0.002 * e.k, ox - s * 0.016 * e.k, e.top + 0.0035 * e.k, ox, oy)
}
function lowerLid(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number) {
  const [ix, iy] = e.inner
  const [ox] = e.outer
  ctx.bezierCurveTo(ox - s * 0.008 * e.k, e.bottom - 0.001 * e.k, ix + s * 0.01 * e.k, e.bottom + 0.0005 * e.k, ix, iy)
}

function almond(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number) {
  ctx.beginPath()
  upperLid(ctx, e, s)
  lowerLid(ctx, e, s)
  ctx.closePath()
}

function drawEyeshadow(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number, m: MakeupLook) {
  if (m.eyeshadowAmt <= 0.01) return
  const a = m.eyeshadowAmt
  ctx.save()
  const g = ctx.createRadialGradient(e.cx + s * 0.008, e.cy + 0.012, 0.002, e.cx + s * 0.006, e.cy + 0.01, 0.034)
  g.addColorStop(0, rgba(m.eyeshadow, 0.85 * a))
  g.addColorStop(0.5, rgba(m.eyeshadow, 0.5 * a))
  g.addColorStop(1, rgba(m.eyeshadow, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(e.cx + s * 0.006, e.cy + 0.011, 0.036, 0.021, s * 0.12, 0, Math.PI * 2)
  ctx.fill()
  // brillo en el centro del párpado
  const g2 = ctx.createRadialGradient(e.cx, e.top + 0.004, 0, e.cx, e.top + 0.004, 0.012)
  g2.addColorStop(0, `rgba(255,255,255,${0.35 * a})`)
  g2.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g2
  ctx.fillRect(e.cx - 0.02, e.top - 0.01, 0.04, 0.03)
  ctx.restore()
}

function drawOpenEye(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number, o: FaceOpts) {
  const { doll, makeup } = o
  // pliegue del párpado
  ctx.save()
  ctx.strokeStyle = rgba(doll.skinShade, 0.75)
  ctx.lineWidth = 0.0011
  ctx.lineCap = 'round'
  ctx.beginPath()
  const [ix, iy] = e.inner
  const [ox, oy] = e.outer
  ctx.moveTo(ix + s * 0.004, iy + 0.008 * e.k)
  ctx.bezierCurveTo(ix + s * 0.01, e.top + 0.0085 * e.k, ox - s * 0.014, e.top + 0.009 * e.k, ox + s * 0.001, oy + 0.006)
  ctx.stroke()
  ctx.restore()

  // esclerótica
  ctx.save()
  almond(ctx, e, s)
  ctx.clip()
  const sg = ctx.createLinearGradient(0, e.top, 0, e.bottom)
  sg.addColorStop(0, '#d9d2dc')
  sg.addColorStop(0.35, '#fbf8fb')
  sg.addColorStop(1, '#efe8ee')
  ctx.fillStyle = sg
  ctx.fillRect(e.cx - 0.04, e.bottom - 0.01, 0.08, 0.05)
  // iris
  const ir = 0.0128 * e.k
  const icx = e.cx + s * 0.0012
  const icy = e.cy + 0.0012
  const ig = ctx.createRadialGradient(icx, icy - 0.003, ir * 0.1, icx, icy, ir)
  const ic = doll.eyes
  ig.addColorStop(0, tint(ic, 0.25))
  ig.addColorStop(0.45, tint(ic, 0.12))
  ig.addColorStop(0.8, ic)
  ig.addColorStop(1, tint(ic, -0.6))
  ctx.fillStyle = ig
  ctx.beginPath()
  ctx.arc(icx, icy, ir, 0, Math.PI * 2)
  ctx.fill()
  // fibras del iris
  ctx.strokeStyle = rgba(tint(ic, 0.45), 0.35)
  ctx.lineWidth = 0.00025
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(icx + Math.cos(a) * ir * 0.45, icy + Math.sin(a) * ir * 0.45)
    ctx.lineTo(icx + Math.cos(a + 0.1) * ir * 0.9, icy + Math.sin(a + 0.1) * ir * 0.9)
    ctx.stroke()
  }
  // anillo límbico
  ctx.strokeStyle = rgba(tint(ic, -0.75), 0.9)
  ctx.lineWidth = 0.0011
  ctx.beginPath()
  ctx.arc(icx, icy, ir - 0.0005, 0, Math.PI * 2)
  ctx.stroke()
  // pupila
  ctx.fillStyle = '#0b0608'
  ctx.beginPath()
  ctx.arc(icx, icy, ir * 0.42, 0, Math.PI * 2)
  ctx.fill()
  // sombra del párpado sobre el ojo
  const shg = ctx.createLinearGradient(0, e.top + 0.002, 0, e.cy)
  shg.addColorStop(0, 'rgba(40,20,30,0.55)')
  shg.addColorStop(1, 'rgba(40,20,30,0)')
  ctx.fillStyle = shg
  ctx.fillRect(e.cx - 0.04, e.cy, 0.08, 0.03)
  // brillos (luz desde arriba a la izquierda del espectador)
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.beginPath()
  ctx.ellipse(icx - 0.0045 * e.k, icy + 0.0045 * e.k, 0.0036 * e.k, 0.0029 * e.k, 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(icx + 0.0044 * e.k, icy - 0.0042 * e.k, 0.0014 * e.k, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(icx + 0.002, icy - 0.006 * e.k, 0.006 * e.k, 0.0022 * e.k, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // línea inferior y lagrimal
  ctx.save()
  ctx.strokeStyle = rgba(tint(doll.skinShade, -0.35), 0.55)
  ctx.lineWidth = 0.0007
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.bezierCurveTo(ox - s * 0.008 * e.k, e.bottom - 0.001 * e.k, ix + s * 0.01 * e.k, e.bottom + 0.0005 * e.k, ix, iy)
  ctx.stroke()
  ctx.fillStyle = 'rgba(230,140,150,0.8)'
  ctx.beginPath()
  ctx.ellipse(ix + s * 0.0012, iy, 0.0016, 0.0012, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // pestañas inferiores
  ctx.save()
  ctx.strokeStyle = rgba(makeup.linerColor === '#1a1220' ? '#2a1a22' : '#1a1220', 0.7)
  ctx.lineWidth = 0.0005
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const t = 0.35 + i * 0.13
    const x = ix + (ox - ix) * t
    const y = e.bottom + 0.0015 + Math.pow(Math.abs(t - 0.5) * 2, 2) * 0.006
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + s * 0.0012 * t, y - 0.0028 - 0.001 * t)
    ctx.stroke()
  }
  ctx.restore()

  drawUpperLashLine(ctx, e, s, o, false)
}

function drawUpperLashLine(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number, o: FaceOpts, closed: boolean) {
  const { makeup } = o
  const [ix, iy] = e.inner
  const [ox, oy] = e.outer
  const liner = makeup.liner
  const lc = makeup.linerColor
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // línea de pestañas base (siempre)
  ctx.strokeStyle = '#1b1016'
  ctx.lineWidth = closed ? 0.0016 : 0.0021
  ctx.beginPath()
  if (closed) {
    ctx.moveTo(ix, iy + 0.001)
    ctx.bezierCurveTo(ix + s * 0.01, e.cy - 0.0075, ox - s * 0.012, e.cy - 0.006, ox, oy - 0.001)
  } else upperLid(ctx, e, s)
  ctx.stroke()

  // delineado
  if (liner !== 'none') {
    const w = liner === 'fino' ? 0.0016 : liner === 'gato' ? 0.0028 : 0.0034
    ctx.strokeStyle = lc
    ctx.fillStyle = lc
    ctx.lineWidth = w
    if (!closed) {
      ctx.beginPath()
      upperLid(ctx, e, s)
      ctx.stroke()
    }
    if (liner === 'gato' || liner === 'grafico') {
      const len = liner === 'gato' ? 0.0125 : 0.017
      ctx.beginPath()
      ctx.moveTo(ox - s * 0.007, closed ? oy - 0.001 : oy + 0.004)
      ctx.quadraticCurveTo(ox + s * len * 0.45, oy + 0.004, ox + s * len, oy + len * 0.62)
      ctx.lineTo(ox - s * 0.002, oy + 0.0005)
      ctx.closePath()
      ctx.fill()
    }
    if (liner === 'grafico') {
      // línea flotante sobre el pliegue
      ctx.lineWidth = 0.0011
      ctx.beginPath()
      ctx.moveTo(ix + s * 0.008, e.top + 0.0105)
      ctx.bezierCurveTo(ix + s * 0.02, e.top + 0.015, ox - s * 0.006, e.top + 0.013, ox + s * 0.017, oy + 0.0145)
      ctx.stroke()
    }
  }

  // pestañas superiores
  const count = makeup.lashes === 'natural' ? 9 : makeup.lashes === 'volumen' ? 13 : 17
  const lenBase = makeup.lashes === 'natural' ? 0.005 : makeup.lashes === 'volumen' ? 0.0072 : 0.0095
  ctx.strokeStyle = '#140a10'
  for (let i = 0; i < count; i++) {
    const t = 0.08 + (i / (count - 1)) * 0.92
    // punto sobre el párpado
    const p = closed ? closedLidPoint(e, s, t) : bez(e, s, t)
    const len = lenBase * (0.55 + 0.75 * t * t)
    const ang = (closed ? -Math.PI / 2 - s * (0.2 + 0.9 * t) : Math.PI / 2 - s * (0.25 + 1.0 * t * t)) as number
    ctx.lineWidth = 0.00075 * (1 - 0.3 * t) + (makeup.lashes === 'drama' ? 0.0003 : 0)
    ctx.beginPath()
    ctx.moveTo(p[0], p[1])
    const ex = p[0] + Math.cos(ang) * len
    const ey = p[1] + Math.sin(ang) * len
    const cx = p[0] + Math.cos(ang + s * 0.5) * len * 0.6
    const cy = p[1] + Math.sin(ang + s * 0.5) * len * 0.6 + (closed ? -0.001 : 0.0015)
    ctx.quadraticCurveTo(cx, cy, ex, ey)
    ctx.stroke()
  }
  ctx.restore()
}

function bez(e: ReturnType<typeof eyePts>, s: number, t: number): [number, number] {
  const [ix, iy] = e.inner
  const [ox, oy] = e.outer
  const p1 = [ix + s * 0.006 * e.k, e.top + 0.002 * e.k]
  const p2 = [ox - s * 0.016 * e.k, e.top + 0.0035 * e.k]
  const u = 1 - t
  return [
    u * u * u * ix + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * ox,
    u * u * u * iy + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * oy,
  ]
}
function closedLidPoint(e: ReturnType<typeof eyePts>, s: number, t: number): [number, number] {
  const [ix, iy] = e.inner
  const [ox, oy] = e.outer
  const p1 = [ix + s * 0.01, e.cy - 0.0075]
  const p2 = [ox - s * 0.012, e.cy - 0.006]
  const u = 1 - t
  return [
    u * u * u * ix + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * ox,
    u * u * u * (iy + 0.001) + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * (oy - 0.001),
  ]
}

function drawClosedEye(ctx: Ctx, e: ReturnType<typeof eyePts>, s: number, o: FaceOpts) {
  // párpado cerrado: piel con un poco de sombra
  drawUpperLashLine(ctx, e, s, o, true)
}

function drawBrow(ctx: Ctx, s: number, o: FaceOpts, raise: number) {
  const { doll } = o
  const arch = doll.face.browArch
  const x0 = s * 0.023
  const x1 = s * 0.075
  const yb = 0.03 + raise
  ctx.save()
  ctx.fillStyle = rgba(doll.brows, 0.92)
  ctx.beginPath()
  // forma superior
  ctx.moveTo(x0, yb + 0.002)
  ctx.bezierCurveTo(s * 0.035, yb + 0.0085 * arch, s * 0.052, yb + 0.0125 * arch, s * 0.06, yb + 0.012 * arch)
  ctx.quadraticCurveTo(s * 0.07, yb + 0.0105 * arch, x1, yb + 0.002 * arch)
  // forma inferior
  ctx.quadraticCurveTo(s * 0.068, yb + 0.0075 * arch, s * 0.059, yb + 0.0085 * arch)
  ctx.bezierCurveTo(s * 0.05, yb + 0.0085 * arch, s * 0.036, yb + 0.003 * arch, x0, yb - 0.0018)
  ctx.closePath()
  ctx.fill()
  // pelitos
  ctx.strokeStyle = rgba(tint(doll.brows, -0.3), 0.6)
  ctx.lineWidth = 0.00035
  for (let i = 0; i < 26; i++) {
    const t = i / 25
    const x = x0 + (x1 - x0) * t
    const y = yb + (0.001 + 0.0085 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.85)) * arch
    ctx.beginPath()
    ctx.moveTo(x, y - 0.0016)
    ctx.lineTo(x + s * 0.0024, y + 0.0014)
    ctx.stroke()
  }
  ctx.restore()
}

function drawLips(ctx: Ctx, o: FaceOpts) {
  const { makeup, doll, expression } = o
  const L = doll.face.lipFullness
  const hw = 0.025 * Math.pow(L, 0.5) * (expression === 'seria' ? 0.94 : expression === 'sonrisa' ? 1.06 : 1)
  const cy = -0.0752
  const up = 0.0098 * L
  const lo = 0.0128 * L
  const smileL = expression === 'sonrisa' ? 0.0045 : expression === 'guino' ? 0.0042 : 0.0
  const smileR = expression === 'sonrisa' ? 0.0045 : expression === 'guino' ? 0.0005 : 0.0
  const open = expression === 'sonrisa' ? 0.0032 : 0
  const lipBase = mixHex(doll.skinShade, '#c46a6a', 0.55)
  const col = mixHex(lipBase, makeup.lips, makeup.lipAmt)

  // Coordenadas de comisuras
  const lx = -hw
  const rx = hw
  const ly = cy + smileR // lado derecho de la muñeca (izquierda del espectador)
  const ry = cy + smileL

  const upperPath = () => {
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.bezierCurveTo(lx + 0.006, cy + up * 0.55, -0.0085, cy + up * 1.05, -0.0035, cy + up * 0.98)
    ctx.quadraticCurveTo(0, cy + up * 0.72, 0.0035, cy + up * 0.98)
    ctx.bezierCurveTo(0.0085, cy + up * 1.05, rx - 0.006, cy + up * 0.55, rx, ry)
    // línea media
    ctx.bezierCurveTo(rx - 0.008, cy + 0.0006 - open * 0.2, 0.006, cy + 0.0012, 0, cy + 0.0004)
    ctx.bezierCurveTo(-0.006, cy + 0.0012, lx + 0.008, cy + 0.0006 - open * 0.2, lx, ly)
    ctx.closePath()
  }
  const lowerPath = () => {
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.bezierCurveTo(lx + 0.008, cy - open - 0.0008, -0.006, cy - open - 0.0006, 0, cy - open - 0.0004)
    ctx.bezierCurveTo(0.006, cy - open - 0.0006, rx - 0.008, cy - open - 0.0008, rx, ry)
    ctx.bezierCurveTo(rx - 0.004, cy - lo * 0.7, 0.012, cy - lo * 1.1, 0, cy - lo * 1.1)
    ctx.bezierCurveTo(-0.012, cy - lo * 1.1, lx + 0.004, cy - lo * 0.7, lx, ly)
    ctx.closePath()
  }

  ctx.save()
  // sombra suave bajo el labio inferior
  const sh = ctx.createRadialGradient(0, cy - lo * 1.35, 0.001, 0, cy - lo * 1.35, 0.014)
  sh.addColorStop(0, rgba(doll.skinShade, 0.45))
  sh.addColorStop(1, rgba(doll.skinShade, 0))
  ctx.fillStyle = sh
  ctx.fillRect(-0.03, cy - 0.03, 0.06, 0.02)

  if (open > 0) {
    // boca abierta: dientes
    ctx.fillStyle = '#5a1f2c'
    ctx.beginPath()
    ctx.moveTo(lx + 0.002, ly)
    ctx.bezierCurveTo(-0.01, cy + 0.0015, 0.01, cy + 0.0015, rx - 0.002, ry)
    ctx.bezierCurveTo(0.01, cy - open * 1.4, -0.01, cy - open * 1.4, lx + 0.002, ly)
    ctx.fill()
    ctx.fillStyle = '#fbf7f4'
    ctx.beginPath()
    ctx.moveTo(lx + 0.004, ly - 0.0002)
    ctx.bezierCurveTo(-0.01, cy + 0.0012, 0.01, cy + 0.0012, rx - 0.004, ry - 0.0002)
    ctx.bezierCurveTo(0.01, cy - open * 0.6, -0.01, cy - open * 0.6, lx + 0.004, ly - 0.0002)
    ctx.fill()
  }

  for (const [path, isUpper] of [
    [upperPath, true],
    [lowerPath, false],
  ] as const) {
    path()
    const g = ctx.createLinearGradient(0, cy + (isUpper ? up : -lo), 0, cy)
    if (makeup.lipFinish === 'metal') {
      g.addColorStop(0, tint(col, -0.25))
      g.addColorStop(0.5, tint(col, 0.35))
      g.addColorStop(1, tint(col, -0.15))
    } else {
      g.addColorStop(0, tint(col, isUpper ? -0.12 : 0.04))
      g.addColorStop(1, tint(col, isUpper ? 0.02 : -0.2))
    }
    ctx.fillStyle = g
    ctx.fill()
    ctx.save()
    ctx.clip()
    // volumen lateral
    const vg = ctx.createRadialGradient(0, cy, 0.004, 0, cy, hw * 1.1)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(60,10,25,0.35)')
    ctx.fillStyle = vg
    ctx.fillRect(-0.04, cy - 0.03, 0.08, 0.06)
    // textura de líneas verticales del labio
    ctx.strokeStyle = 'rgba(80,20,35,0.12)'
    ctx.lineWidth = 0.00025
    for (let i = -10; i <= 10; i++) {
      const x = (i / 10) * hw
      ctx.beginPath()
      ctx.moveTo(x, cy - lo * 1.2)
      ctx.lineTo(x * 1.05, cy + up * 1.1)
      ctx.stroke()
    }
    ctx.restore()
  }
  // línea entre labios
  ctx.strokeStyle = rgba(tint(col, -0.55), 0.85)
  ctx.lineWidth = 0.0008
  ctx.beginPath()
  ctx.moveTo(lx, ly)
  ctx.bezierCurveTo(lx + 0.008, cy + 0.0006 - open * 0.2, -0.006, cy + 0.0012, 0, cy + 0.0004)
  ctx.bezierCurveTo(0.006, cy + 0.0012, rx - 0.008, cy + 0.0006 - open * 0.2, rx, ry)
  ctx.stroke()
  // comisuras
  ctx.lineWidth = 0.0006
  ctx.strokeStyle = rgba(doll.skinShade, 0.8)
  for (const [x, y, d] of [
    [lx, ly, -1],
    [rx, ry, 1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + d * 0.0016, y + 0.0006, x + d * 0.0022, y + 0.0018 + (expression === 'seria' ? -0.0016 : 0))
    ctx.stroke()
  }
  // brillos (gloss / metal)
  if (makeup.lipFinish !== 'mate') {
    const a = makeup.lipFinish === 'gloss' ? 0.7 : 0.5
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.beginPath()
    ctx.ellipse(0.003, cy - lo * 0.5, 0.0052, 0.0013, -0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`
    ctx.beginPath()
    ctx.ellipse(-0.009, cy + up * 0.55, 0.0035, 0.001, 0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0.0095, cy + up * 0.55, 0.003, 0.0009, -0.15, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function star(ctx: Ctx, x: number, y: number, r: number, rot = 0) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * Math.PI * 2 + Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
function heart(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.bezierCurveTo(x - r * 0.2, y - r * 0.75, x - r * 1.1, y - r * 0.2, x - r, y + r * 0.3)
  ctx.bezierCurveTo(x - r * 0.9, y + r * 0.95, x - r * 0.2, y + r * 0.9, x, y + r * 0.45)
  ctx.bezierCurveTo(x + r * 0.2, y + r * 0.9, x + r * 0.9, y + r * 0.95, x + r, y + r * 0.3)
  ctx.bezierCurveTo(x + r * 1.1, y - r * 0.2, x + r * 0.2, y - r * 0.75, x, y - r)
  ctx.closePath()
}

function drawGems(ctx: Ctx, o: FaceOpts) {
  const { makeup } = o
  const c = makeup.gemColor
  const shine = (x: number, y: number, r: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y + r * 0.3, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.save()
  switch (makeup.gems) {
    case 'estrellas':
      for (const [x, y, r] of [
        [0.074, -0.024, 0.0042],
        [0.083, -0.012, 0.0028],
        [0.066, -0.034, 0.0022],
      ]) {
        ctx.fillStyle = c
        star(ctx, x, y, r, 0.2)
        ctx.fill()
        shine(x, y, r)
      }
      break
    case 'corazones':
      for (const [x, y, r] of [
        [-0.07, -0.028, 0.0045],
        [-0.079, -0.016, 0.0026],
      ]) {
        ctx.fillStyle = c
        heart(ctx, x, y, r)
        ctx.fill()
        shine(x, y, r)
      }
      break
    case 'brillantes':
      for (let i = 0; i < 7; i++) {
        const t = i / 6
        for (const s of [-1, 1]) {
          const x = s * (0.05 + t * 0.03)
          const y = -0.022 + t * 0.012 - Math.sin(t * Math.PI) * 0.004
          const r = 0.0017 + 0.0008 * Math.sin(t * Math.PI)
          const g = ctx.createRadialGradient(x - r * 0.3, y + r * 0.3, 0, x, y, r)
          g.addColorStop(0, '#ffffff')
          g.addColorStop(0.5, c)
          g.addColorStop(1, tint(c, -0.3))
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    case 'pecas':
      drawFreckles(ctx, '#a0583a', 0.55)
      break
    case 'mariposa': {
      const x = 0.08
      const y = 0.0
      ctx.fillStyle = c
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(x + s * 0.0045, y + 0.003, 0.0045, 0.0062, s * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(x + s * 0.0035, y - 0.0045, 0.003, 0.004, -s * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = tint(c, -0.5)
      ctx.fillRect(x - 0.0006, y - 0.007, 0.0012, 0.013)
      shine(x + 0.004, y + 0.004, 0.004)
      break
    }
  }
  ctx.restore()
}

function drawFreckles(ctx: Ctx, color: string, a: number) {
  let seed = 7
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  ctx.fillStyle = rgba(color, a)
  for (let i = 0; i < 46; i++) {
    const s = r() < 0.5 ? -1 : 1
    const x = s * (0.006 + r() * 0.06)
    const y = -0.035 + r() * 0.024 - Math.abs(x) * 0.08
    ctx.beginPath()
    ctx.arc(x, y, 0.0005 + r() * 0.0007, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Pinta la cara completa. Devuelve el lienzo de color y el de rugosidad/metal. */
export function paintFace(o: FaceOpts): { color: HTMLCanvasElement; rm: HTMLCanvasElement } {
  const w = o.res
  const h = Math.round(w * (FACE.h / FACE.w))
  const cv = makeCanvas(w, h)
  const ctx = cv.getContext('2d')!
  const { doll, makeup, expression } = o
  ctx.fillStyle = doll.skin
  ctx.fillRect(0, 0, w, h)
  setWorld(ctx, w, h)

  // Contorno suave y calidez
  const warm = ctx.createRadialGradient(0, -0.04, 0.01, 0, -0.04, 0.09)
  warm.addColorStop(0, rgba(mixHex(doll.skin, '#ff9a8a', 0.3), 0.25))
  warm.addColorStop(1, rgba(doll.skin, 0))
  ctx.fillStyle = warm
  ctx.fillRect(-0.15, -0.2, 0.3, 0.4)
  for (const s of [-1, 1]) {
    const cg = ctx.createRadialGradient(s * 0.105, -0.06, 0.005, s * 0.105, -0.06, 0.05)
    cg.addColorStop(0, rgba(doll.skinShade, 0.35))
    cg.addColorStop(1, rgba(doll.skinShade, 0))
    ctx.fillStyle = cg
    ctx.fillRect(-0.15, -0.2, 0.3, 0.4)
  }

  // Colorete
  if (makeup.blushAmt > 0.01) {
    for (const s of [-1, 1]) {
      const g = ctx.createRadialGradient(s * 0.062, -0.042, 0.002, s * 0.062, -0.042, 0.03)
      g.addColorStop(0, rgba(makeup.blush, 0.55 * makeup.blushAmt))
      g.addColorStop(1, rgba(makeup.blush, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(s * 0.062, -0.042, 0.034, 0.024, s * -0.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (doll.face.freckles) drawFreckles(ctx, '#a8653f', 0.45)

  // Nariz: sombras y puente
  ctx.save()
  const nshade = rgba(doll.skinShade, 0.55)
  ctx.fillStyle = nshade
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(s * 0.0062, -0.0462, 0.0026, 0.0014, s * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = rgba(doll.skinShade, 0.5)
  ctx.lineWidth = 0.0008
  ctx.beginPath()
  ctx.moveTo(-0.0085, -0.043)
  ctx.quadraticCurveTo(0, -0.0505, 0.0085, -0.043)
  ctx.stroke()
  const bridge = ctx.createLinearGradient(-0.012, 0, 0.012, 0)
  bridge.addColorStop(0, rgba(doll.skinShade, 0))
  bridge.addColorStop(0.2, rgba(doll.skinShade, 0.18))
  bridge.addColorStop(0.5, rgba(doll.skinShade, 0))
  bridge.addColorStop(0.8, rgba(doll.skinShade, 0.18))
  bridge.addColorStop(1, rgba(doll.skinShade, 0))
  ctx.fillStyle = bridge
  ctx.fillRect(-0.012, -0.04, 0.024, 0.04)
  ctx.restore()

  // Iluminador
  if (makeup.highlighter > 0.01) {
    const hA = makeup.highlighter
    const spots: [number, number, number, number][] = [
      [-0.06, -0.022, 0.016, 0.006],
      [0.06, -0.022, 0.016, 0.006],
      [0, -0.036, 0.004, 0.003],
      [0, -0.063, 0.004, 0.002],
      [0, 0.03, 0.006, 0.012],
    ]
    for (const [x, y, rx, ry] of spots) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry))
      g.addColorStop(0, `rgba(255,248,240,${0.55 * hA})`)
      g.addColorStop(1, 'rgba(255,248,240,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, x === 0 ? 0 : (x > 0 ? 1 : -1) * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Ojos
  const wink = expression === 'guino'
  for (const s of [-1, 1]) {
    const e = eyePts(s, doll.face.eyeSize)
    drawEyeshadow(ctx, e, s, makeup)
    const closed = o.closed || (wink && s === 1)
    if (closed) drawClosedEye(ctx, e, s, o)
    else drawOpenEye(ctx, e, s, o)
  }
  // Cejas
  for (const s of [-1, 1]) drawBrow(ctx, s, o, expression === 'guino' && s === 1 ? -0.002 : expression === 'sonrisa' ? 0.001 : 0)

  drawLips(ctx, o)
  drawGems(ctx, o)

  // Mapa de rugosidad (G) y metal (B)
  const rw = Math.round(w / 4)
  const rh = Math.round(h / 4)
  const rm = makeCanvas(rw, rh)
  const r = rm.getContext('2d')!
  r.fillStyle = 'rgb(255,140,0)'
  r.fillRect(0, 0, rw, rh)
  setWorld(r, rw, rh)
  const lipR = makeup.lipFinish === 'gloss' ? 30 : makeup.lipFinish === 'metal' ? 70 : 190
  const lipM = makeup.lipFinish === 'metal' ? 150 : 0
  r.fillStyle = `rgb(255,${lipR},${lipM})`
  r.beginPath()
  r.ellipse(0, -0.0775, 0.026, 0.0125, 0, 0, Math.PI * 2)
  r.fill()
  if (!o.closed) {
    r.fillStyle = 'rgb(255,25,0)'
    for (const s of [-1, 1]) {
      if (wink && s === 1) continue
      const e = eyePts(s, doll.face.eyeSize)
      almond(r, e, s)
      r.fill()
    }
  }
  if (makeup.highlighter > 0.3) {
    r.fillStyle = `rgba(255,70,40,${makeup.highlighter * 0.6})`
    for (const s of [-1, 1]) {
      r.beginPath()
      r.ellipse(s * 0.06, -0.022, 0.015, 0.006, s * 0.35, 0, Math.PI * 2)
      r.fill()
    }
  }
  if (makeup.gems !== 'none' && makeup.gems !== 'pecas') {
    r.fillStyle = 'rgb(255,20,120)'
    r.beginPath()
    r.ellipse(0.075, -0.02, 0.014, 0.022, 0, 0, Math.PI * 2)
    r.ellipse(-0.07, -0.024, 0.014, 0.016, 0, 0, Math.PI * 2)
    r.fill()
  }
  return { color: cv, rm }
}

export function faceTextures(o: FaceOpts): { map: THREE.CanvasTexture; rm: THREE.CanvasTexture } {
  const { color, rm } = paintFace(o)
  const map = new THREE.CanvasTexture(color)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
  const t = new THREE.CanvasTexture(rm)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return { map, rm: t }
}

import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Constructores de geometría paramétrica. Todas las UV están en
// unidades de mundo (1 unidad UV = 0,1 m) para que los estampados
// tengan el mismo tamaño en cualquier prenda.

export const UV_SCALE = 10

/** Nivel de detalle global (1 = alto). Reduce segmentos en calidad media/baja. */
let DETAIL = 1
const detailListeners: (() => void)[] = []
export function setDetail(d: number) {
  if (d === DETAIL) return
  DETAIL = d
  for (const f of detailListeners) f()
}
export const getDetail = () => DETAIL
/** Registra una caché de geometrías que debe vaciarse si cambia el detalle. */
export function onDetailChange(f: () => void) {
  detailListeners.push(f)
}

/** Superficie paramétrica (u,v ∈ [0,1]) con UV en unidades de mundo. */
export function surface(
  nu: number,
  nv: number,
  fn: (u: number, v: number, out: THREE.Vector3) => void,
  opts: { closedU?: boolean; uvMode?: 'world' | 'param'; flip?: boolean; orient?: 'auto'; fixed?: boolean } = {},
): THREE.BufferGeometry {
  if (!opts.fixed && DETAIL < 1) {
    nu = Math.max(4, Math.round(nu * DETAIL))
    nv = Math.max(2, Math.round(nv * DETAIL))
  }
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  const grid: THREE.Vector3[][] = []
  for (let j = 0; j <= nv; j++) {
    const row: THREE.Vector3[] = []
    for (let i = 0; i <= nu; i++) {
      fn(i / nu, j / nv, p)
      row.push(p.clone())
    }
    grid.push(row)
  }
  // UV en mundo: u = longitud de arco acumulada en la fila central, v = a lo largo de la columna central
  const uvMode = opts.uvMode ?? 'world'
  const uArc: number[][] = []
  const vArc: number[][] = []
  for (let j = 0; j <= nv; j++) {
    const a: number[] = [0]
    for (let i = 1; i <= nu; i++) a.push(a[i - 1] + grid[j][i].distanceTo(grid[j][i - 1]))
    uArc.push(a)
  }
  for (let i = 0; i <= nu; i++) {
    const a: number[] = [0]
    for (let j = 1; j <= nv; j++) a.push(a[j - 1] + grid[j][i].distanceTo(grid[j - 1][i]))
    vArc.push(a)
  }
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const q = grid[j][i]
      pos.push(q.x, q.y, q.z)
      if (uvMode === 'world') uv.push(uArc[j][i] * UV_SCALE, vArc[i][j] * UV_SCALE)
      else uv.push(i / nu, j / nv)
    }
  }
  const w = nu + 1
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * w + i
      const b = a + 1
      const c = a + w
      const d = c + 1
      if (opts.flip) idx.push(a, b, c, b, d, c)
      else idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.userData.grid = { nu, nv }
  if (opts.orient === 'auto') orientOutward(g)
  g.computeVertexNormals()
  if (opts.closedU) fixSeamNormals(g, nu, nv)
  return g
}

/** Invierte el orden de los triángulos si la mayoría mira hacia el centroide. */
export function orientOutward(g: THREE.BufferGeometry, center?: THREE.Vector3) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const index = g.getIndex()!
  const c = center ?? new THREE.Vector3()
  if (!center) {
    for (let i = 0; i < pos.count; i++) c.x += pos.getX(i), c.y += pos.getY(i), c.z += pos.getZ(i)
    c.divideScalar(pos.count)
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3()
  const n = new THREE.Vector3(), m = new THREE.Vector3()
  let vote = 0
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i))
    b.fromBufferAttribute(pos, index.getX(i + 1))
    d.fromBufferAttribute(pos, index.getX(i + 2))
    m.copy(a).add(b).add(d).divideScalar(3).sub(c)
    n.subVectors(b, a).cross(d.sub(a))
    vote += Math.sign(n.dot(m))
  }
  if (vote < 0) {
    const arr = index.array as Uint16Array | Uint32Array
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1]
      arr[i + 1] = arr[i + 2]
      arr[i + 2] = t
    }
    index.needsUpdate = true
  }
}

/** Promedia las normales de la costura para superficies cerradas en u. */
function fixSeamNormals(g: THREE.BufferGeometry, nu: number, nv: number) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute
  const w = nu + 1
  const t = new THREE.Vector3()
  for (let j = 0; j <= nv; j++) {
    const a = j * w
    const b = j * w + nu
    t.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
    n.setXYZ(a, t.x, t.y, t.z)
    n.setXYZ(b, t.x, t.y, t.z)
  }
  n.needsUpdate = true
}

/**
 * Barrido de un perfil circular/elíptico a lo largo de una curva.
 * u = alrededor, v = a lo largo (raíz → punta).
 */
export function sweep(
  curve: THREE.Curve<THREE.Vector3>,
  radius: (t: number, angle: number) => number,
  opts: { radial?: number; segments?: number; capStart?: boolean; capEnd?: boolean; ellipse?: [number, number]; twist?: number; up?: THREE.Vector3 } = {},
): THREE.BufferGeometry {
  const radial = Math.max(5, Math.round((opts.radial ?? 16) * (DETAIL < 1 ? Math.max(0.6, DETAIL) : 1)))
  const segs = Math.max(2, Math.round((opts.segments ?? 24) * DETAIL))
  const [ex, ez] = opts.ellipse ?? [1, 1]
  // Marcos de transporte paralelo
  const frames = parallelFrames(curve, segs, opts.up)
  const geo = surface(
    radial,
    segs,
    (u, v, out) => {
      const j = Math.round(v * segs)
      const { p, n, b } = frames[j]
      const a = u * Math.PI * 2 + (opts.twist ?? 0) * v
      const r = radius(v, a)
      out.copy(p)
        .addScaledVector(n, Math.cos(a) * r * ex)
        .addScaledVector(b, Math.sin(a) * r * ez)
    },
    { closedU: true, flip: true, fixed: true },
  )
  const parts = [geo]
  if (opts.capStart) parts.push(capAt(frames[0], radius(0, 0) * 0.98, radial, ex, ez, true))
  if (opts.capEnd) parts.push(capAt(frames[segs], Math.max(radius(1, 0), 0.0005), radial, ex, ez, false))
  return parts.length === 1 ? geo : merge(parts)
}

interface Frame {
  p: THREE.Vector3
  t: THREE.Vector3
  n: THREE.Vector3
  b: THREE.Vector3
}

export function parallelFrames(curve: THREE.Curve<THREE.Vector3>, segs: number, up?: THREE.Vector3): Frame[] {
  const out: Frame[] = []
  let prevN: THREE.Vector3 | null = null
  for (let j = 0; j <= segs; j++) {
    const t = j / segs
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t).normalize()
    let n: THREE.Vector3
    if (!prevN) {
      const ref = up ? up.clone() : Math.abs(tan.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
      n = ref.sub(tan.clone().multiplyScalar(ref.dot(tan))).normalize()
    } else {
      n = prevN.clone().sub(tan.clone().multiplyScalar(prevN.dot(tan))).normalize()
    }
    const b = new THREE.Vector3().crossVectors(tan, n).normalize()
    out.push({ p, t: tan, n, b })
    prevN = n
  }
  return out
}

function capAt(f: Frame, r: number, radial: number, ex: number, ez: number, start: boolean): THREE.BufferGeometry {
  // Casquete semiesférico suave para cerrar los extremos. En calidad baja basta con
  // dos anillos: dedos y cordones ocupan muy pocos píxeles y sus triángulos son de
  // lo más caro de la muñeca en GPUs modestas.
  const rings = DETAIL >= 1 ? 5 : Math.max(2, Math.round(5 * DETAIL))
  return surface(
    radial,
    rings,
    (u, v, out) => {
      const a = u * Math.PI * 2
      const phi = (v * Math.PI) / 2
      const rr = Math.cos(phi) * r
      const along = Math.sin(phi) * r * 0.9 * (start ? -1 : 1)
      out.copy(f.p)
        .addScaledVector(f.t, along)
        .addScaledVector(f.n, Math.cos(a) * rr * ex)
        .addScaledVector(f.b, Math.sin(a) * rr * ez)
    },
    { closedU: true, orient: 'auto', fixed: true },
  )
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // conserva solo los atributos presentes en todas las piezas (hairT incluido)
  const keep = ['position', 'normal', 'uv', 'hairT'].filter((k) => parts.every((g) => g.getAttribute(k)))
  const cleaned = parts.map((g) => {
    let c = g.index ? g : mergeVertices(g)
    if (Object.keys(c.attributes).some((k) => !keep.includes(k))) {
      c = c.clone()
      for (const k of Object.keys(c.attributes)) if (!keep.includes(k)) c.deleteAttribute(k)
    }
    return c
  })
  const m = mergeGeometries(cleaned, false)
  if (!m) throw new Error('merge failed')
  return m
}

/** Curva Catmull-Rom centrípeta a partir de puntos. */
export function curveOf(points: [number, number, number][], closed = false): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal')
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s))

/** Interpolación suave en una tabla [x, y] ordenada por x (monótona cúbica sencilla). */
export function table(points: [number, number][]): (x: number) => number {
  return (x: number) => {
    if (x <= points[0][0]) return points[0][1]
    const last = points[points.length - 1]
    if (x >= last[0]) return last[1]
    let i = 0
    while (x > points[i + 1][0]) i++
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const t = (x - x0) / (x1 - x0)
    // Hermite con tangentes Catmull-Rom
    const m0 = i > 0 ? (y1 - points[i - 1][1]) / (x1 - points[i - 1][0]) : (y1 - y0) / (x1 - x0)
    const m1 = i + 2 < points.length ? (points[i + 2][1] - y0) / (points[i + 2][0] - x0) : (y1 - y0) / (x1 - x0)
    const h = x1 - x0
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1
  }
}

/** Extrusión redondeada de una forma 2D (gafas, corazones, estrellas…). */
export function extrude(shape: THREE.Shape, depth: number, bevel = depth * 0.4, curveSegments = 24): THREE.BufferGeometry {
  // menos segmentos con poco detalle (piezas pequeñas en pantalla)
  const low = DETAIL < 0.5
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: low ? 1 : 3,
    curveSegments: low ? Math.max(4, Math.round(curveSegments * 0.4)) : curveSegments,
  })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return g
}

export function heartShape(s = 1): THREE.Shape {
  const sh = new THREE.Shape()
  sh.moveTo(0, -0.9 * s)
  sh.bezierCurveTo(-0.15 * s, -0.7 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s)
  sh.bezierCurveTo(-1.0 * s, 0.75 * s, -0.4 * s, 0.95 * s, 0, 0.5 * s)
  sh.bezierCurveTo(0.4 * s, 0.95 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s)
  sh.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.7 * s, 0, -0.9 * s)
  return sh
}

export function starShape(r = 1, inner = 0.45, points = 5): THREE.Shape {
  const sh = new THREE.Shape()
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2
    const rr = i % 2 === 0 ? r : r * inner
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) sh.moveTo(x, y)
    else sh.lineTo(x, y)
  }
  return sh
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const sh = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  sh.moveTo(x + r, y)
  sh.lineTo(x + w - r, y)
  sh.quadraticCurveTo(x + w, y, x + w, y + r)
  sh.lineTo(x + w, y + h - r)
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  sh.lineTo(x + r, y + h)
  sh.quadraticCurveTo(x, y + h, x, y + h - r)
  sh.lineTo(x, y + r)
  sh.quadraticCurveTo(x, y, x + r, y)
  return sh
}

export function ellipseShape(rx: number, ry: number): THREE.Shape {
  const sh = new THREE.Shape()
  sh.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
  return sh
}

/** Esfera (o elipsoide) con UV de mundo. */
export function ellipsoid(rx: number, ry: number, rz: number, nu = 24, nv = 16): THREE.BufferGeometry {
  return surface(
    nu,
    nv,
    (u, v, out) => {
      const lon = u * Math.PI * 2
      const lat = Math.PI / 2 - v * Math.PI
      out.set(Math.cos(lat) * Math.sin(lon) * rx, Math.sin(lat) * ry, Math.cos(lat) * Math.cos(lon) * rz)
    },
    { closedU: true, orient: 'auto' },
  )
}

/** Toroide con UV de mundo. */
export function torus(R: number, r: number, nu = 32, nv = 12, arc = Math.PI * 2): THREE.BufferGeometry {
  return surface(
    nu,
    nv,
    (u, v, out) => {
      const a = u * arc
      const b = v * Math.PI * 2
      out.set((R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a))
    },
    { closedU: arc >= Math.PI * 2 },
  )
}

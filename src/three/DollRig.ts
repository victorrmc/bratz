import * as THREE from 'three'
import type { DollDef, Expression, Look, MakeupLook, NailShape } from '../data/types'
import {
  J,
  armSegs,
  earGeometry,
  footGeometry,
  ankleGeometry,
  headGeometry,
  legSegs,
  limbGeometry,
  mirrorX,
  neckGeometry,
  torsoGeometry,
  FINGERS,
  footPath,
} from './body'
import { ellipsoid, merge, onDetailChange, sweep } from './geo'
import { faceTextures } from './face'
import { skinMaterial, getMaterialQuality } from './materials'
import { nailGeometry, nailMaterial } from './nails'
import {
  blendPose,
  copyPose,
  getPose,
  reactionFor,
  reactionPose,
  restPose,
  transitionPose,
  walkPose,
  TRANSITION_TOTAL,
  type JointName,
  type Pose,
  type Reaction,
} from './pose'
import { buildOutfit, type Piece, type OutfitResult } from './clothes'
import { buildHair, type HairResult } from './hair'

export type BoneName = JointName | 'root' | 'fingerL' | 'fingerR'

const PIVOTS: Record<JointName, THREE.Vector3> = {
  hips: J.hips,
  neck: J.neck,
  head: J.head,
  shoulderL: J.shoulderL,
  elbowL: J.elbowL,
  wristL: J.wristL,
  shoulderR: mirrorX(J.shoulderL),
  elbowR: mirrorX(J.elbowL),
  wristR: mirrorX(J.wristL),
  hipL: J.hipL,
  kneeL: J.kneeL,
  ankleL: J.ankleL,
  hipR: mirrorX(J.hipL),
  kneeR: mirrorX(J.kneeL),
  ankleR: mirrorX(J.ankleL),
}

const PARENT: Record<JointName, JointName | 'root'> = {
  hips: 'root',
  neck: 'hips',
  head: 'neck',
  shoulderL: 'hips',
  elbowL: 'shoulderL',
  wristL: 'elbowL',
  shoulderR: 'hips',
  elbowR: 'shoulderR',
  wristR: 'elbowR',
  hipL: 'hips',
  kneeL: 'hipL',
  ankleL: 'kneeL',
  hipR: 'hips',
  kneeR: 'hipR',
  ankleR: 'kneeR',
}

const mergedCache = new Map<string, THREE.BufferGeometry>()
onDetailChange(() => mergedCache.clear())
const footCache = new Map<number, { foot: THREE.BufferGeometry; ankle: THREE.BufferGeometry }>()
function footFor(arch: number) {
  const k = Math.round(arch * 100) / 100
  let f = footCache.get(k)
  if (!f) {
    f = { foot: footGeometry(k), ankle: ankleGeometry(k) }
    footCache.set(k, f)
  }
  return f
}

function withSphere(g: THREE.BufferGeometry, c: THREE.Vector3, r: number) {
  const sph = ellipsoid(r, r, r, 20, 14)
  sph.translate(c.x, c.y, c.z)
  return merge([g, sph])
}

// Geometrías del cuerpo compartidas entre muñecas
let shared: ReturnType<typeof buildShared> | null = null
function buildShared() {
  const L = armSegs(1)
  const R = armSegs(-1)
  const LL = legSegs(1)
  const RL = legSegs(-1)
  return {
    torso: torsoGeometry(),
    neck: neckGeometry(),
    upperL: limbGeometry(L.upper),
    foreL: withSphere(limbGeometry(L.fore), J.elbowL, 0.0245),
    upperR: limbGeometry(R.upper),
    foreR: withSphere(limbGeometry(R.fore), mirrorX(J.elbowL), 0.0245),
    thighL: limbGeometry(LL.thigh),
    shinL: withSphere(limbGeometry(LL.shin), J.kneeL, 0.0375),
    thighR: limbGeometry(RL.thigh),
    shinR: withSphere(limbGeometry(RL.shin), mirrorX(J.kneeL), 0.0375),
    ears: merge([earGeometry(1), earGeometry(-1)]),
    palm: (() => {
      const g = ellipsoid(0.0135, 0.034, 0.022, 24, 16)
      g.translate(0, -0.034, 0)
      return g
    })(),
    fingerSegs: FINGERS.map((f) => {
      const a = f.len * 0.55
      const b = f.len * 0.45
      return {
        prox: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.002, 0), new THREE.Vector3(0, -a, 0)), (t) => f.r * (1 - 0.06 * t), {
          radial: 12,
          segments: 4,
          capStart: true,
          capEnd: true,
          ellipse: [0.88, 1],
        }),
        dist: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.001, 0), new THREE.Vector3(0, -b, 0)), (t) => f.r * 0.94 * (1 - 0.12 * t), {
          radial: 12,
          segments: 4,
          capStart: true,
          capEnd: true,
          ellipse: [0.88, 1],
        }),
        a,
        b,
      }
    }),
    thumb: {
      prox: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.002, 0), new THREE.Vector3(0, -0.02, 0)), () => 0.0072, {
        radial: 12,
        segments: 4,
        capStart: true,
        capEnd: true,
      }),
      dist: sweep(new THREE.LineCurve3(new THREE.Vector3(0, 0.001, 0), new THREE.Vector3(0, -0.017, 0)), (t) => 0.0066 * (1 - 0.1 * t), {
        radial: 12,
        segments: 4,
        capStart: true,
        capEnd: true,
      }),
    },

  }
}

const CURLS = [0, 0.2, 0.35, 0.9]

type FaceTex = { map: THREE.CanvasTexture; rm: THREE.CanvasTexture }
const FACE_CACHE_MAX = 10

// temporales del IK de piernas
const _h = new THREE.Vector3()
const _k = new THREE.Vector3()
const _a = new THREE.Vector3()
const _t = new THREE.Vector3()
const _d = new THREE.Vector3()
const _p = new THREE.Vector3()
const _f = new THREE.Vector3()
const _q0 = new THREE.Quaternion()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _UP = new THREE.Vector3(0, 1, 0)

/** Métricas de animación (las leen los tests E2E). */
export interface AnimStats {
  /** distancia mínima entre la suela y el suelo (negativa = atraviesa) */
  minClearance: number
  /** deslizamiento máximo por fotograma del pie de apoyo, en pasarela */
  maxSlip: number
  /** altura máxima alcanzada en un saltito */
  maxLift: number
  claps: number
  transitions: number
  mouthFrames: number
  reaction: string
  shownExpression: string
  frames: number
}
const handCache = new Map<string, { skin: THREE.BufferGeometry; nails: THREE.BufferGeometry }>()
onDetailChange(() => {
  handCache.clear()
  footCache.clear()
  shared = null
})

/** Construye la mano (coordenadas locales de la muñeca) con los dedos flexionados. */
function handGeometry(side: 'L' | 'R', curlIn: number, shape: NailShape) {
  const curl = CURLS.reduce((a, b) => (Math.abs(b - curlIn) < Math.abs(a - curlIn) ? b : a))
  const key = `${side}|${curl}|${shape}`
  const hit = handCache.get(key)
  if (hit) return hit
  if (!shared) shared = buildShared()
  const S = shared
  const s = side === 'L' ? 1 : -1
  const root = new THREE.Group()
  const skinParts: [THREE.BufferGeometry, THREE.Object3D][] = []
  const nailParts: [THREE.BufferGeometry, THREE.Object3D][] = []
  const palm = new THREE.Object3D()
  root.add(palm)
  skinParts.push([S.palm, palm])
  FINGERS.forEach((f, i) => {
    const seg = S.fingerSegs[i]
    const c = curl * (1 + i * 0.18) + 0.08
    const knuckle = new THREE.Object3D()
    knuckle.position.set(0.0015 * s, -0.062, f.z)
    knuckle.rotation.set(0, 0, -s * c * 0.9)
    root.add(knuckle)
    skinParts.push([seg.prox, knuckle])
    const mid = new THREE.Object3D()
    mid.position.set(0, -seg.a, 0)
    mid.rotation.set(0, 0, -s * c * 1.1)
    knuckle.add(mid)
    skinParts.push([seg.dist, mid])
    const nail = new THREE.Object3D()
    nail.position.set(0, -seg.b * 0.35, 0)
    if (s < 0) nail.scale.x = -1
    mid.add(nail)
    nailParts.push([nailGeometry(shape), nail])
  })
  const tb = new THREE.Object3D()
  tb.position.set(-0.004 * s, -0.016, 0.017)
  tb.rotation.set(0.55, 0, -0.35 * s)
  root.add(tb)
  skinParts.push([S.thumb.prox, tb])
  const tm = new THREE.Object3D()
  tm.position.set(0, -0.02, 0)
  tm.rotation.set(0.2, 0, -0.15 * s)
  tb.add(tm)
  skinParts.push([S.thumb.dist, tm])
  const tn = new THREE.Object3D()
  tn.position.set(0, -0.006, 0)
  tn.rotation.y = s > 0 ? 0 : Math.PI
  tm.add(tn)
  nailParts.push([nailGeometry(shape, 0.0066), tn])
  root.updateMatrixWorld(true)
  const bake = (parts: [THREE.BufferGeometry, THREE.Object3D][]) =>
    merge(
      parts.map(([g, o]) => {
        const c = g.clone()
        c.applyMatrix4(o.matrixWorld)
        // las mallas reflejadas invierten el orden de los triángulos
        if (o.matrixWorld.determinant() < 0) {
          const idx = c.getIndex()
          if (idx) {
            const arr = idx.array as Uint16Array | Uint32Array
            for (let k = 0; k < arr.length; k += 3) {
              const t = arr[k + 1]
              arr[k + 1] = arr[k + 2]
              arr[k + 2] = t
            }
          }
          c.computeVertexNormals()
        }
        return c
      }),
    )
  const res = { skin: bake(skinParts), nails: bake(nailParts) }
  handCache.set(key, res)
  return res
}

export class DollRig {
  readonly root = new THREE.Group()
  readonly bones = {} as Record<JointName, THREE.Group>
  readonly attach = {} as Record<JointName, THREE.Group>
  doll: DollDef
  private headMesh: THREE.Mesh
  private headMat: THREE.MeshPhysicalMaterial
  private faceCache = new Map<string, FaceTex>()
  private faceApplied = ''
  private skin: THREE.MeshPhysicalMaterial
  private hands = {} as Record<'L' | 'R', { skin: THREE.Mesh; nails: THREE.Mesh; curl: number }>
  private nailShape: NailShape = 'almendra'
  private feet: { L: THREE.Mesh; R: THREE.Mesh }
  private ankles: THREE.Mesh[] = []
  private outfit: OutfitResult | null = null
  private hair: HairResult | null = null
  private pose: Pose = restPose()
  private target: Pose = getPose('idle')
  private from: Pose = restPose()
  /** tiempo dentro de la transición actual (negativo: sin transición) */
  private transT = -1
  private targetId = 'idle'
  private walking = false
  private walkT = 0
  /** zancada del paseo (0–1); baja para dar pasitos al girar */
  walkStride = 1
  /** si está activo, la muñeca avanza según el pie de apoyo (pies plantados) */
  locomotion = false
  private travel = new THREE.Vector3()
  private contact = { L: new THREE.Vector3(), R: new THREE.Vector3() }
  private prevContact = { L: new THREE.Vector3(), R: new THREE.Vector3() }
  private stance: 'L' | 'R' | null = null
  private prevStanceWorld = new THREE.Vector3()
  private hasPrevStance = false
  private footArch = 0
  private reaction: { r: Reaction; t: number; after: string; base: Pose; lastOpen: number } | null = null
  private reactTarget: Pose = restPose()
  private shownExpr: Expression = 'sonrisa'
  private exprT = 10
  private mouthFrame = 1
  readonly stats: AnimStats = { minClearance: Infinity, maxSlip: 0, maxLift: 0, claps: 0, transitions: 0, mouthFrames: 0, reaction: '', shownExpression: 'sonrisa', frames: 0 }
  private blinkT = 3.5
  blinkEnabled = true
  private blinkHold = 0
  private faceKey = ''
  expression: Expression = 'sonrisa'
  idleAmount = 1
  heelLift = 0
  private skinMeshes: THREE.Mesh[] = []

  constructor(doll: DollDef) {
    this.doll = doll
    if (!shared) shared = buildShared()
    const S = shared
    this.skin = skinMaterial(doll.skin)
    this.root.name = `doll-${doll.id}`

    // Jerarquía de huesos
    for (const j of Object.keys(PIVOTS) as JointName[]) {
      const g = new THREE.Group()
      g.name = j
      this.bones[j] = g
      // grupo con desplazamiento -pivote: ahí se cuelgan mallas en coordenadas de reposo
      const a = new THREE.Group()
      a.position.copy(PIVOTS[j]).multiplyScalar(-1)
      g.add(a)
      this.attach[j] = a
    }
    for (const j of Object.keys(PIVOTS) as JointName[]) {
      const p = PARENT[j]
      const parentPivot = p === 'root' ? new THREE.Vector3() : PIVOTS[p]
      this.bones[j].position.copy(PIVOTS[j]).sub(parentPivot)
      ;(p === 'root' ? this.root : this.bones[p]).add(this.bones[j])
    }

    const add = (bone: JointName, geo: THREE.BufferGeometry, mat: THREE.Material = this.skin) => {
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = true
      this.attach[bone].add(m)
      this.skinMeshes.push(m)
      return m
    }
    add('hips', S.torso)
    add('neck', S.neck)
    add('shoulderL', S.upperL)
    add('elbowL', S.foreL)
    add('shoulderR', S.upperR)
    add('elbowR', S.foreR)
    add('hipL', S.thighL)
    add('kneeL', S.shinL)
    add('hipR', S.thighR)
    add('kneeR', S.shinR)
    add('head', S.ears)

    // Cabeza con la cara pintada
    this.headMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 1,
      metalness: 1,
      clearcoat: getMaterialQuality() === 'baja' ? 0 : 0.15,
      clearcoatRoughness: 0.4,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffd9d2'),
    })
    this.headMesh = new THREE.Mesh(headGeometry({ lipFullness: doll.face.lipFullness }), this.headMat)
    this.headMesh.castShadow = true
    this.attach.head.add(this.headMesh)

    // Manos: palma + dedos fusionados en una malla (y otra para las uñas)
    for (const side of ['L', 'R'] as const) {
      const hand = new THREE.Group()
      hand.position.copy(PIVOTS[`wrist${side}`])
      hand.scale.setScalar(1.18)
      this.attach[`wrist${side}`].add(hand)
      const geo = handGeometry(side, 0.15, 'almendra')
      const skinM = new THREE.Mesh(geo.skin, this.skin)
      const nailM = new THREE.Mesh(geo.nails, nailMaterial({ shape: 'almendra', color: '#3a0f1f', finish: 'brillo' }))
      hand.add(skinM, nailM)
      this.hands[side] = { skin: skinM, nails: nailM, curl: 0.15 }
      this.skinMeshes.push(skinM)
    }

    // Pies descalzos
    const mkFoot = (side: 'L' | 'R') => {
      const m = new THREE.Mesh(footFor(0).foot, this.skin)
      m.position.copy(PIVOTS[`ankle${side}`])
      this.attach[`ankle${side}`].add(m)
      const a = new THREE.Mesh(footFor(0).ankle, this.skin)
      a.position.copy(PIVOTS[`ankle${side}`])
      this.attach[`ankle${side}`].add(a)
      this.ankles.push(a)
      return m
    }
    this.feet = { L: mkFoot('L'), R: mkFoot('R') }
    copyPose(this.target, this.pose)
  }

  /** Aplica un look completo (ropa, pelo, maquillaje, uñas). */
  setLook(look: Look) {
    this.setMakeup(look.makeup)
    // Uñas
    this.nailShape = look.nails.shape
    for (const side of ['L', 'R'] as const) {
      const h = this.hands[side]
      const g = handGeometry(side, h.curl, this.nailShape)
      h.skin.geometry = g.skin
      h.nails.geometry = g.nails
      h.nails.material = nailMaterial(look.nails)
    }
    // Ropa
    this.clearMerged()
    this.clearPieces(this.outfit?.pieces)
    this.outfit = buildOutfit(look)
    this.addPieces(this.outfit.pieces)
    this.heelLift = this.outfit.heelLift
    this.footArch = this.outfit.footArch
    const ff = footFor(this.outfit.footArch)
    const fg = ff.foot
    for (const a of this.ankles) a.geometry = ff.ankle
    this.feet.L.geometry = fg
    this.feet.R.geometry = fg
    this.feet.L.visible = this.feet.R.visible = !this.outfit.hideFeet
    // Pelo
    this.clearPieces(this.hair?.pieces)
    this.hair = buildHair(look.hair, Boolean(look.outfit.hat), this.outfit.hatHidesTop)
    for (const p of this.hair.pieces) this.attach[p.bone].add(p.mesh)
  }

  /**
   * Añade las piezas fusionando las que comparten hueso y material en una
   * sola malla (menos llamadas de dibujo: clave para el rendimiento en móvil).
   */
  private addPieces(pieces?: Piece[]) {
    const groups = new Map<string, { bone: JointName; mat: THREE.Material; items: THREE.Mesh[] }>()
    this.mergedOut = []
    for (const p of pieces ?? []) {
      const m = p.mesh
      const mergeable =
        m instanceof THREE.Mesh && !p.ownsGeometry && m.children.length === 0 && !Array.isArray(m.material) && !m.geometry.getAttribute('hairT') && m.rotation.x === 0 && m.rotation.y === 0 && m.rotation.z === 0 && m.scale.x === 1
      if (!mergeable) {
        p.mesh.castShadow = true
        this.attach[p.bone].add(p.mesh)
        continue
      }
      const mat = (m as THREE.Mesh).material as THREE.Material
      const key = `${p.bone}|${mat.uuid}`
      let g = groups.get(key)
      if (!g) groups.set(key, (g = { bone: p.bone, mat, items: [] }))
      g.items.push(m as THREE.Mesh)
    }
    for (const g of groups.values()) {
      if (g.items.length === 1) {
        g.items[0].castShadow = true
        this.attach[g.bone].add(g.items[0])
        continue
      }
      const key = g.items.map((m) => `${m.geometry.uuid}@${m.position.x.toFixed(4)},${m.position.y.toFixed(4)},${m.position.z.toFixed(4)}`).join('|')
      let geo = mergedCache.get(key)
      if (!geo) {
        geo = merge(
          g.items.map((m) => {
            const c = m.geometry.clone()
            if (m.position.lengthSq() > 0) c.translate(m.position.x, m.position.y, m.position.z)
            return c
          }),
        )
        mergedCache.set(key, geo)
        if (mergedCache.size > 80) {
          const first = mergedCache.keys().next().value as string
          mergedCache.delete(first)
        }
      }
      const mesh = new THREE.Mesh(geo, g.mat)
      mesh.castShadow = true
      this.attach[g.bone].add(mesh)
      this.mergedOut.push(mesh)
    }
  }
  private mergedOut: THREE.Mesh[] = []
  private clearPieces(pieces?: Piece[]) {
    for (const p of pieces ?? []) {
      p.mesh.removeFromParent()
      if (p.ownsGeometry && p.mesh instanceof THREE.Mesh) p.mesh.geometry.dispose()
    }
  }
  private clearMerged() {
    for (const m of this.mergedOut) m.removeFromParent()
    this.mergedOut = []
  }

  setMakeup(m: MakeupLook) {
    const key = JSON.stringify([m, getMaterialQuality()])
    if (key === this.faceKey) return
    this.faceKey = key
    this.lastMakeup = m
    // las texturas viejas se liberan después de poner las nuevas
    const old = [...this.faceCache.values()]
    this.faceCache.clear()
    this.faceApplied = ''
    this.applyFace(false)
    for (const f of old) {
      f.map.dispose()
      f.rm.dispose()
    }
  }
  private lastMakeup: MakeupLook | null = null

  setExpression(e: Expression) {
    if (e === this.expression) return
    this.expression = e
    if (!this.reaction) this.showExpression(e)
  }

  /** Expresión visible ahora mismo (la de una reacción tiene prioridad). */
  get visibleExpression(): Expression {
    return this.shownExpr
  }

  private showExpression(e: Expression) {
    if (e === this.shownExpr) return
    this.shownExpr = e
    this.exprT = 0
    this.stats.shownExpression = e
    // un parpadeo rápido disimula el cambio de textura y le da vida
    if (this.blinkEnabled && e !== 'risa') {
      this.applyFace(true)
      this.blinkHold = 0.09
    } else this.applyFace(false)
  }

  /** Texturas de la cara para una expresión, con caché (se pintan una vez). */
  private faceTex(expr: Expression, closed: boolean, mouth: number): FaceTex | null {
    const m = this.lastMakeup
    if (!m) return null
    const key = `${expr}|${closed ? 1 : 0}|${mouth}`
    let f = this.faceCache.get(key)
    if (f) {
      // al final del orden de uso
      this.faceCache.delete(key)
      this.faceCache.set(key, f)
      return f
    }
    const res = getMaterialQuality() === 'baja' ? 512 : 1024
    f = faceTextures({ doll: this.doll, makeup: m, expression: expr, closed, mouth, res: closed ? res / 2 : res })
    this.faceCache.set(key, f)
    if (this.faceCache.size > FACE_CACHE_MAX) {
      for (const [k, v] of this.faceCache) {
        if (k === key || v.map === this.headMat.map) continue
        v.map.dispose()
        v.rm.dispose()
        this.faceCache.delete(k)
        break
      }
    }
    return f
  }

  private applyFace(closed: boolean) {
    const expr = this.shownExpr
    const mouth = expr === 'risa' ? this.mouthFrame : 1
    const key = `${expr}|${closed}|${mouth}`
    if (key === this.faceApplied && this.headMat.map) return
    const f = this.faceTex(expr, closed, mouth)
    if (!f) return
    this.faceApplied = key
    const first = !this.headMat.map
    this.headMat.map = f.map
    this.headMat.roughnessMap = f.rm
    this.headMat.metalnessMap = f.rm
    if (first) this.headMat.needsUpdate = true
  }

  /** Cambia de pose con una transición con anticipación y asentamiento. */
  setPose(id: string) {
    this.walking = false
    if (this.reaction) {
      // se adoptará al terminar la reacción
      this.reaction.after = id
      return
    }
    if (id === this.targetId && this.transT < 0 && !this.wasWalking) return
    this.targetId = id
    this.wasWalking = false
    copyPose(this.pose, this.from)
    this.target = getPose(id)
    this.transT = 0
    this.stats.transitions++
  }
  private wasWalking = false

  setWalking(on: boolean) {
    if (on) this.wasWalking = true
    this.walking = on
  }

  /** Pose instantánea (sin transición), útil para capturas. */
  snapPose() {
    copyPose(this.target, this.pose)
    this.transT = -1
  }

  /** Reacción a la nota del jurado: expresión, saltitos y aplauso. */
  react(stars: number) {
    const r = reactionFor(stars)
    this.walking = false
    this.transT = -1
    this.reaction = { r, t: 0, after: this.targetId, base: getPose(this.targetId === 'star' ? 'idle' : this.targetId), lastOpen: 1 }
    this.stats.reaction = r.kind
    this.showExpression(r.expression)
  }

  /** Reacción en curso (o null). */
  get reacting(): string | null {
    return this.reaction?.r.kind ?? null
  }

  /**
   * Devuelve (y pone a cero) lo que la muñeca ha avanzado sobre su soporte
   * desde la última llamada, en coordenadas locales del soporte.
   */
  takeTravel(out = new THREE.Vector3()) {
    out.set(this.travel.x, 0, this.travel.z)
    this.root.position.x -= this.travel.x
    this.root.position.z -= this.travel.z
    for (const f of ['L', 'R'] as const) {
      this.prevContact[f].sub(out)
      this.contact[f].sub(out)
    }
    this.travel.set(0, 0, 0)
    return out
  }

  /** Punto de apoyo actual (coordenadas locales del soporte), para girar sobre él. */
  stancePoint(out = new THREE.Vector3()): THREE.Vector3 | null {
    if (!this.stance) return null
    return out.copy(this.contact[this.stance])
  }

  resetStats() {
    Object.assign(this.stats, { minClearance: Infinity, maxSlip: 0, maxLift: 0, claps: 0, transitions: 0, mouthFrames: 0, frames: 0 })
  }

  update(dt: number, time: number) {
    // Parpadeo
    this.blinkT -= dt
    if (this.blinkHold > 0) {
      this.blinkHold -= dt
      if (this.blinkHold <= 0) this.applyFace(false)
    } else if (this.blinkT <= 0 && this.blinkEnabled && this.shownExpr !== 'risa') {
      this.applyFace(true)
      this.blinkHold = 0.12
      this.blinkT = 2.5 + Math.random() * 3
    }
    // Risa: la boca se abre y se cierra a golpes de carcajada
    this.exprT += dt
    if (this.shownExpr === 'risa') {
      const f = Math.sin(this.exprT * 14) > -0.2 ? 1 : 0.55
      if (f !== this.mouthFrame) {
        this.mouthFrame = f
        this.stats.mouthFrames++
        if (this.blinkHold <= 0) this.applyFace(false)
      }
    }

    let lift = 0
    const rx = this.reaction
    if (rx) {
      rx.t += dt
      const res = reactionPose(rx.r, rx.t, rx.base, this.reactTarget)
      lift = res.lift
      blendPose(this.pose, this.reactTarget, Math.min(1, dt * 16))
      if (rx.r.clap) {
        const open = Math.cos(rx.t * Math.PI * 2 * 3.2)
        if (open > 0.9 && rx.lastOpen <= 0.9) this.stats.claps++
        rx.lastOpen = open
      }
      this.stats.maxLift = Math.max(this.stats.maxLift, lift)
      if (rx.t >= rx.r.duration) {
        this.reaction = null
        this.showExpression(this.expression)
        const after = rx.after
        this.targetId = ''
        this.setPose(after)
      }
    } else if (this.walking) {
      this.walkT += dt * 0.8
      walkPose(this.walkT, this.target, this.walkStride)
      blendPose(this.pose, this.target, Math.min(1, dt * 14))
      this.transT = -1
    } else if (this.transT >= 0) {
      this.transT += dt
      if (this.transT >= TRANSITION_TOTAL) {
        this.transT = -1
        copyPose(this.target, this.pose)
      } else transitionPose(this.from, this.target, this.transT, this.pose)
    } else copyPose(this.target, this.pose)

    const p = this.pose
    for (const j of Object.keys(this.bones) as JointName[]) this.bones[j].quaternion.copy(p[j])
    // Respiración y balanceo (idle)
    const k = this.walking || rx ? 0 : this.idleAmount
    const br = Math.sin(time * 1.6) * 0.012 * k
    this.bones.neck.rotateX(-br * 0.5)
    this.bones.shoulderL.rotateZ(br * 0.3)
    this.bones.shoulderR.rotateZ(-br * 0.3)
    const sway = Math.sin(time * 0.55) * k
    this.bones.hips.rotateZ(sway * 0.012)
    this.bones.head.rotateY(Math.sin(time * 0.4) * 0.04 * k)
    this.bones.head.rotateZ(Math.sin(time * 0.33) * 0.02 * k)
    this.animateExpression(time)
    this.root.position.x = p.rootX + sway * 0.004 + this.travel.x
    this.root.position.z = this.travel.z
    this.root.position.y = this.heelLift + p.rootY + br * 0.05 + lift
    this.bones.hips.position.y = J.hips.y + Math.abs(br) * 0.1

    this.solveFeet()
    if (this.locomotion) this.plantFeet()
    else {
      this.stance = null
      this.hasPrevStance = false
    }
    this.stats.frames++

    // Dedos: se cambia la geometría al nivel de flexión más cercano
    for (const side of ['L', 'R'] as const) {
      const curl = side === 'L' ? p.curlL : p.curlR
      const h = this.hands[side]
      const q = CURLS.reduce((a, b) => (Math.abs(b - curl) < Math.abs(a - curl) ? b : a))
      if (q !== h.curl) {
        h.curl = q
        const g = handGeometry(side, q, this.nailShape)
        h.skin.geometry = g.skin
        h.nails.geometry = g.nails
      }
    }

    this.hair?.update(time, this.walking ? 1.6 : 1, this.bones.head)
    this.outfit?.update?.(this as unknown as { bones: Record<string, THREE.Object3D> }, time)
  }

  /** Pequeños gestos de cabeza y hombros que acompañan a cada expresión. */
  private animateExpression(time: number) {
    const t = this.exprT
    const env = Math.min(1, t * 7)
    switch (this.shownExpr) {
      case 'sorpresa': {
        // respingo: la cabeza va hacia atrás y los hombros suben, y se relaja
        const take = env * (0.35 + 0.65 * Math.exp(-t * 2.5))
        this.bones.head.rotateX(-0.13 * take)
        this.bones.neck.rotateX(-0.05 * take)
        this.bones.shoulderL.rotateZ(-0.06 * take)
        this.bones.shoulderR.rotateZ(0.06 * take)
        break
      }
      case 'risa': {
        const b = Math.abs(Math.sin(t * 7))
        this.bones.head.rotateX(-(0.05 + 0.04 * b) * env)
        this.bones.head.rotateZ(Math.sin(time * 2.1) * 0.04 * env)
        this.bones.shoulderL.rotateZ(-0.035 * b * env)
        this.bones.shoulderR.rotateZ(0.035 * b * env)
        break
      }
      case 'dientes':
        this.bones.head.rotateZ(0.05 * env)
        this.bones.head.rotateX(-0.02 * env)
        break
      default:
        break
    }
  }

  /** Puntos de apoyo (talón y bola del pie) en coordenadas de reposo del tobillo. */
  private soleY() {
    return -this.heelLift
  }

  /** Altura mínima de la suela respecto al suelo, en coordenadas de mundo. */
  private soleClearance(side: 'L' | 'R', floorY: number, mid?: THREE.Vector3) {
    const fp = footPath(this.footArch)
    const ankle = PIVOTS[`ankle${side}`]
    const att = this.attach[`ankle${side}`]
    att.updateWorldMatrix(true, false)
    let min = Infinity
    if (mid) mid.set(0, 0, 0)
    for (const z of [fp[0][2], fp[3][2] + 0.02]) {
      _p.set(ankle.x, this.soleY(), ankle.z + z).applyMatrix4(att.matrixWorld)
      min = Math.min(min, _p.y - floorY)
      if (mid) mid.addScaledVector(_p, 0.5)
    }
    return min
  }

  /**
   * IK de pies: si la pose o un hundimiento de cadera meten el pie bajo el
   * suelo, se eleva el tobillo flexionando la rodilla (IK de dos huesos) y
   * se conserva la orientación del pie.
   */
  private solveFeet() {
    const parent = this.root.parent
    const floorY = parent ? parent.getWorldPosition(_f).y : 0
    for (const side of ['L', 'R'] as const) {
      const c = this.soleClearance(side, floorY)
      if (c < -0.0005) this.legIK(side, -c)
      this.stats.minClearance = Math.min(this.stats.minClearance, this.soleClearance(side, floorY))
    }
  }

  private legIK(side: 'L' | 'R', raise: number) {
    const hip = this.bones[`hip${side}`]
    const knee = this.bones[`knee${side}`]
    const ankle = this.bones[`ankle${side}`]
    ankle.updateWorldMatrix(true, false)
    hip.getWorldPosition(_h)
    knee.getWorldPosition(_k)
    ankle.getWorldPosition(_a)
    const footQ = ankle.getWorldQuaternion(_q0)
    const l1 = _k.distanceTo(_h)
    const l2 = _a.distanceTo(_k)
    _t.copy(_a).addScaledVector(_UP, raise)
    _d.subVectors(_t, _h)
    const d = THREE.MathUtils.clamp(_d.length(), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9999)
    _d.normalize()
    // la rodilla sigue doblándose hacia donde ya apuntaba (o hacia delante)
    _p.subVectors(_k, _h)
    _p.addScaledVector(_d, -_p.dot(_d))
    _f.set(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(_q1))
    _p.addScaledVector(_f, 0.004)
    _p.normalize()
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a))
    // nueva rodilla
    _f.copy(_h).addScaledVector(_d, a).addScaledVector(_p, hh)
    this.rotateBone(hip, _k.sub(_h), _p.subVectors(_f, _h))
    knee.getWorldPosition(_k)
    ankle.getWorldPosition(_a)
    _t.copy(_h).addScaledVector(_d, d)
    this.rotateBone(knee, _a.sub(_k), _t.sub(_k))
    // el pie mantiene su orientación en el mundo
    knee.getWorldQuaternion(_q1)
    ankle.quaternion.copy(_q1.invert().multiply(footQ))
  }

  /** Gira un hueso para que la dirección `from` (mundo) pase a ser `to`. */
  private rotateBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
    _q2.setFromUnitVectors(from.normalize(), to.normalize())
    const world = bone.getWorldQuaternion(new THREE.Quaternion())
    const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion())
    bone.quaternion.copy(parentQ.invert().multiply(_q2).multiply(world))
  }

  /**
   * Pies plantados: el pie de apoyo no se desliza. Lo que se movería hacia
   * atrás se convierte en avance de la muñeca sobre su soporte.
   */
  private plantFeet() {
    const parent = this.root.parent
    if (!parent) return
    const floorY = parent.getWorldPosition(_f).y
    const cL = this.soleClearance('L', floorY, _a)
    parent.worldToLocal(this.contact.L.copy(_a))
    const cR = this.soleClearance('R', floorY, _a)
    parent.worldToLocal(this.contact.R.copy(_a))
    let st: 'L' | 'R'
    if (this.walking) {
      // la pierna izquierda apoya desde que está más adelantada hasta que despega
      st = Math.cos(this.walkT * Math.PI * 2) < 0 ? 'L' : 'R'
    } else {
      st = this.stance ?? (cL <= cR ? 'L' : 'R')
      // histéresis para no alternar por ruido
      if (st === 'L' && cR < cL - 0.003) st = 'R'
      else if (st === 'R' && cL < cR - 0.003) st = 'L'
    }
    if (st === this.stance) {
      _d.subVectors(this.contact[st], this.prevContact[st])
      _d.y = 0
      this.travel.sub(_d)
      this.root.position.x -= _d.x
      this.root.position.z -= _d.z
      this.contact.L.sub(_d)
      this.contact.R.sub(_d)
    } else this.hasPrevStance = false
    this.stance = st
    this.prevContact.L.copy(this.contact.L)
    this.prevContact.R.copy(this.contact.R)
    // deslizamiento real en el mundo (debería ser ~0)
    this.root.updateWorldMatrix(false, false)
    parent.localToWorld(_t.copy(this.contact[st]))
    if (this.hasPrevStance) {
      const slip = Math.hypot(_t.x - this.prevStanceWorld.x, _t.z - this.prevStanceWorld.z)
      this.stats.maxSlip = Math.max(this.stats.maxSlip, slip)
    }
    this.prevStanceWorld.copy(_t)
    this.hasPrevStance = true
  }

  /** Posición de mundo de una articulación (para la falda dinámica, cámaras…). */
  jointWorld(j: JointName, out = new THREE.Vector3()) {
    return this.bones[j].getWorldPosition(out)
  }

  dispose() {
    this.clearPieces(this.outfit?.pieces)
    this.clearPieces(this.hair?.pieces)
    this.headMesh.geometry.dispose()
    this.headMat.dispose()
    for (const f of this.faceCache.values()) {
      f.map.dispose()
      f.rm.dispose()
    }
    this.faceCache.clear()
    this.root.removeFromParent()
  }
}

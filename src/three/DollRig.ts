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
} from './body'
import { ellipsoid, merge, onDetailChange, sweep } from './geo'
import { faceTextures } from './face'
import { skinMaterial, getMaterialQuality } from './materials'
import { nailGeometry, nailMaterial } from './nails'
import { blendPose, copyPose, getPose, restPose, walkPose, type JointName, type Pose } from './pose'
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
  private faceOpen: { map: THREE.Texture; rm: THREE.Texture } | null = null
  private faceClosed: { map: THREE.Texture; rm: THREE.Texture } | null = null
  private skin: THREE.MeshPhysicalMaterial
  private hands = {} as Record<'L' | 'R', { skin: THREE.Mesh; nails: THREE.Mesh; curl: number }>
  private nailShape: NailShape = 'almendra'
  private feet: { L: THREE.Mesh; R: THREE.Mesh }
  private ankles: THREE.Mesh[] = []
  private outfit: OutfitResult | null = null
  private hair: HairResult | null = null
  private pose: Pose = restPose()
  private target: Pose = getPose('idle')
  private walking = false
  private walkT = 0
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
    const key = JSON.stringify([m, this.expression, getMaterialQuality()])
    if (key === this.faceKey) return
    this.faceKey = key
    const res = getMaterialQuality() === 'baja' ? 512 : 1024
    this.faceOpen?.map.dispose()
    this.faceOpen?.rm.dispose()
    this.faceClosed?.map.dispose()
    this.faceClosed?.rm.dispose()
    this.faceOpen = faceTextures({ doll: this.doll, makeup: m, expression: this.expression, closed: false, res })
    this.faceClosed = faceTextures({ doll: this.doll, makeup: m, expression: this.expression, closed: true, res: res / 2 })
    this.applyFace(false)
    this.lastMakeup = m
  }
  private lastMakeup: MakeupLook | null = null

  setExpression(e: Expression) {
    if (e === this.expression) return
    this.expression = e
    if (this.lastMakeup) this.setMakeup(this.lastMakeup)
  }

  private applyFace(closed: boolean) {
    const f = closed ? this.faceClosed : this.faceOpen
    if (!f) return
    const first = !this.headMat.map
    this.headMat.map = f.map
    this.headMat.roughnessMap = f.rm
    this.headMat.metalnessMap = f.rm
    if (first) this.headMat.needsUpdate = true
  }

  setPose(id: string) {
    this.walking = false
    this.target = getPose(id)
  }

  setWalking(on: boolean) {
    this.walking = on
  }

  /** Pose instantánea (sin transición), útil para capturas. */
  snapPose() {
    copyPose(this.target, this.pose)
  }

  update(dt: number, time: number) {
    // Parpadeo
    this.blinkT -= dt
    if (this.blinkHold > 0) {
      this.blinkHold -= dt
      if (this.blinkHold <= 0) this.applyFace(false)
    } else if (this.blinkT <= 0 && this.blinkEnabled) {
      this.applyFace(true)
      this.blinkHold = 0.12
      this.blinkT = 2.5 + Math.random() * 3
    }

    if (this.walking) {
      this.walkT += dt * 0.95
      walkPose(this.walkT, this.target)
    }
    blendPose(this.pose, this.target, Math.min(1, dt * (this.walking ? 14 : 6)))

    const p = this.pose
    for (const j of Object.keys(this.bones) as JointName[]) this.bones[j].quaternion.copy(p[j])
    // Respiración y balanceo (idle)
    const k = this.walking ? 0 : this.idleAmount
    const br = Math.sin(time * 1.6) * 0.012 * k
    this.bones.neck.rotateX(-br * 0.5)
    this.bones.shoulderL.rotateZ(br * 0.3)
    this.bones.shoulderR.rotateZ(-br * 0.3)
    const sway = Math.sin(time * 0.55) * k
    this.bones.hips.rotateZ(sway * 0.012)
    this.bones.head.rotateY(Math.sin(time * 0.4) * 0.04 * k)
    this.bones.head.rotateZ(Math.sin(time * 0.33) * 0.02 * k)
    this.root.position.x = p.rootX + sway * 0.004
    this.root.position.y = this.heelLift + p.rootY + br * 0.05
    this.bones.hips.position.y = J.hips.y + Math.abs(br) * 0.1

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

  /** Posición de mundo de una articulación (para la falda dinámica, cámaras…). */
  jointWorld(j: JointName, out = new THREE.Vector3()) {
    return this.bones[j].getWorldPosition(out)
  }

  dispose() {
    this.clearPieces(this.outfit?.pieces)
    this.clearPieces(this.hair?.pieces)
    this.headMesh.geometry.dispose()
    this.headMat.dispose()
    this.faceOpen?.map.dispose()
    this.faceClosed?.map.dispose()
    this.root.removeFromParent()
  }
}

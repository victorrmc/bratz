import * as THREE from 'three'
import type { DollDef, Expression, Look, MakeupLook } from '../data/types'
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
import { ellipsoid, sweep } from './geo'
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
    foreL: limbGeometry(L.fore),
    upperR: limbGeometry(R.upper),
    foreR: limbGeometry(R.fore),
    thighL: limbGeometry(LL.thigh),
    shinL: limbGeometry(LL.shin),
    thighR: limbGeometry(RL.thigh),
    shinR: limbGeometry(RL.shin),
    earL: earGeometry(1),
    earR: earGeometry(-1),
    palm: (() => {
      const g = ellipsoid(0.0135, 0.034, 0.022, 24, 16)
      g.translate(0, -0.034, 0)
      return g
    })(),
    joint: ellipsoid(1, 1, 1, 20, 14),
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

interface Finger {
  knuckle: THREE.Group
  mid: THREE.Group
  nail: THREE.Mesh
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
  private fingers: { L: Finger[]; R: Finger[] } = { L: [], R: [] }
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
    add('head', S.earL)
    add('head', S.earR)
    // Articulaciones redondeadas (rodillas/codos) para que no se vean huecos al doblar
    for (const [bone, pos, r] of [
      ['elbowL', J.elbowL, 0.0255],
      ['elbowR', mirrorX(J.elbowL), 0.0255],
      ['kneeL', J.kneeL, 0.0375],
      ['kneeR', mirrorX(J.kneeL), 0.0375],
    ] as [JointName, THREE.Vector3, number][]) {
      const m = add(bone, S.joint)
      m.position.copy(pos)
      m.scale.setScalar(r)
    }

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

    // Manos
    for (const side of ['L', 'R'] as const) {
      const s = side === 'L' ? 1 : -1
      const wrist = this.attach[`wrist${side}`]
      const hand = new THREE.Group()
      hand.position.copy(PIVOTS[`wrist${side}`])
      hand.scale.setScalar(1.18)
      wrist.add(hand)
      const palm = new THREE.Mesh(S.palm, this.skin)
      hand.add(palm)
      this.skinMeshes.push(palm)
      FINGERS.forEach((f, i) => {
        const seg = S.fingerSegs[i]
        const knuckle = new THREE.Group()
        knuckle.position.set(0.0015 * s, -0.062, f.z)
        const prox = new THREE.Mesh(seg.prox, this.skin)
        knuckle.add(prox)
        const mid = new THREE.Group()
        mid.position.set(0, -seg.a, 0)
        knuckle.add(mid)
        const dist = new THREE.Mesh(seg.dist, this.skin)
        mid.add(dist)
        const nail = new THREE.Mesh(nailGeometry('almendra'), nailMaterial({ shape: 'almendra', color: '#3a0f1f', finish: 'brillo' }))
        nail.position.set(0, -seg.b * 0.35, 0)
        if (s < 0) nail.scale.x = -1
        mid.add(nail)
        hand.add(knuckle)
        this.fingers[side].push({ knuckle, mid, nail })
        this.skinMeshes.push(prox, dist)
      })
      // pulgar
      const tb = new THREE.Group()
      tb.position.set(-0.004 * s, -0.016, 0.017)
      tb.rotation.set(0.55, 0, -0.35 * s)
      const tp = new THREE.Mesh(S.thumb.prox, this.skin)
      tb.add(tp)
      const tm = new THREE.Group()
      tm.position.set(0, -0.02, 0)
      tm.rotation.set(0.2, 0, -0.15 * s)
      tb.add(tm)
      const td = new THREE.Mesh(S.thumb.dist, this.skin)
      tm.add(td)
      const tn = new THREE.Mesh(nailGeometry('almendra', 0.0066), nailMaterial({ shape: 'almendra', color: '#3a0f1f', finish: 'brillo' }))
      tn.position.set(0, -0.006, 0)
      tn.rotation.y = s > 0 ? 0 : Math.PI
      tm.add(tn)
      hand.add(tb)
      this.skinMeshes.push(tp, td)
      this.fingers[side].push({ knuckle: tb, mid: tm, nail: tn })
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
    for (const side of ['L', 'R'] as const) {
      for (const f of this.fingers[side]) {
        f.nail.geometry = nailGeometry(look.nails.shape, f === this.fingers[side][4] ? 0.0066 : 0.0058)
        f.nail.material = nailMaterial(look.nails)
      }
    }
    // Ropa
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
    this.addPieces(this.hair.pieces)
  }

  private addPieces(pieces?: Piece[]) {
    for (const p of pieces ?? []) {
      p.mesh.castShadow = true
      this.attach[p.bone].add(p.mesh)
    }
  }
  private clearPieces(pieces?: Piece[]) {
    for (const p of pieces ?? []) {
      p.mesh.removeFromParent()
      if (p.ownsGeometry && p.mesh instanceof THREE.Mesh) p.mesh.geometry.dispose()
    }
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
    this.headMat.map = f.map
    this.headMat.roughnessMap = f.rm
    this.headMat.metalnessMap = f.rm
    this.headMat.needsUpdate = true
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

    // Dedos
    for (const side of ['L', 'R'] as const) {
      const curl = side === 'L' ? p.curlL : p.curlR
      const s = side === 'L' ? 1 : -1
      this.fingers[side].forEach((f, i) => {
        if (i === 4) return
        const c = curl * (1 + i * 0.18) + 0.08
        f.knuckle.rotation.set(0, 0, -s * c * 0.9)
        f.mid.rotation.set(0, 0, -s * c * 1.1)
      })
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

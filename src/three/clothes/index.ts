import * as THREE from 'three'
import type { Look, Slot } from '../../data/types'
import { ITEM_BY_ID } from '../../data/items'
import { HAIR_BY_ID } from '../../data/hair'
import { J, mirrorX, thighR, shinR } from '../body'
import { buildBottom, buildDress, buildJacket, buildTop, type Built, type Piece } from './wear'
import { buildShoes } from './shoes'
import { buildBag, buildGlasses, buildHairAcc, buildHat, buildJewel } from './accessories'
import type { SkirtDeformer } from './garment'

export type { Piece }

export interface OutfitResult {
  pieces: Piece[]
  heelLift: number
  footArch: number
  hideFeet: boolean
  hatHidesTop: boolean
  update?: (rig: { bones: Record<string, THREE.Object3D> }, time: number) => void
}

const ORDER: Slot[] = ['dress', 'top', 'bottom', 'jacket', 'shoes', 'bag', 'earrings', 'necklace', 'bracelet', 'glasses', 'hat', 'hairAcc']

export function buildOutfit(look: Look): OutfitResult {
  const pieces: Piece[] = []
  const deformers: SkirtDeformer[] = []
  const anims: ((t: number) => void)[] = []
  let heelLift = 0
  let footArch = 0
  let hideFeet = false
  let hatHidesTop = false
  const style = HAIR_BY_ID[look.hair.styleId]
  const pony = style?.pieces.find((p) => ['ponyLow', 'ponyHigh', 'bunLow', 'bunHigh'].includes(p.kind))
  const ponyAnchor = pony ? (pony.kind === 'ponyLow' || pony.kind === 'bunLow' ? { a: 3.55, b: 0 } : { a: 2.05, b: 0 }) : null
  for (const slot of ORDER) {
    const inst = look.outfit[slot]
    if (!inst) continue
    const item = ITEM_BY_ID[inst.itemId]
    if (!item) continue
    let b: Built | null = null
    switch (item.category) {
      case 'tops':
        b = buildTop(item, inst)
        break
      case 'bottoms':
        b = buildBottom(item, inst)
        break
      case 'dresses':
        b = buildDress(item, inst)
        break
      case 'jackets':
        b = buildJacket(item, inst)
        break
      case 'shoes': {
        const s = buildShoes(item, inst)
        heelLift = s.lift
        footArch = s.arch
        hideFeet = s.hideFeet
        b = s
        break
      }
      case 'bags':
        b = buildBag(item, inst)
        break
      case 'jewelry':
        b = buildJewel(item, inst)
        break
      case 'glasses':
        b = buildGlasses(item, inst)
        break
      case 'hats': {
        const h = buildHat(item, inst)
        hatHidesTop = h.hidesTop
        b = h
        break
      }
      case 'hairAcc':
        if (look.outfit.hat && !['scrunchie', 'claw'].includes(item.model)) continue
        b = buildHairAcc(item, inst, ponyAnchor)
        break
    }
    if (!b) continue
    for (const p of b.pieces) p.mesh.userData.slot = slot
    pieces.push(...b.pieces)
    deformers.push(...b.deformers)
    if (b.animate) anims.push(b.animate)
  }

  const qa = new THREE.Quaternion()
  const qb = new THREE.Quaternion()
  const hipR = mirrorX(J.hipL)
  const kneeRel = J.kneeL.clone().sub(J.hipL)
  const ankleRel = J.ankleL.clone().sub(J.kneeL)
  const kneeRelR = mirrorX(J.kneeL).sub(hipR)
  const ankleRelR = mirrorX(J.ankleL).sub(mirrorX(J.kneeL))

  return {
    pieces,
    heelLift,
    footArch,
    hideFeet,
    hatHidesTop,
    update(rig, time) {
      for (const a of anims) a(time)
      if (!deformers.length) return
      // segmentos de las piernas en el espacio de la cadera
      const segs: { a: THREE.Vector3; b: THREE.Vector3; r: (t: number) => number }[] = []
      for (const [hipP, kRel, aRel, hipB, kneeB] of [
        [J.hipL, kneeRel, ankleRel, 'hipL', 'kneeL'],
        [hipR, kneeRelR, ankleRelR, 'hipR', 'kneeR'],
      ] as const) {
        qa.copy(rig.bones[hipB].quaternion)
        qb.copy(qa).multiply(rig.bones[kneeB].quaternion)
        const knee = hipP.clone().add(kRel.clone().applyQuaternion(qa))
        const ankle = knee.clone().add(aRel.clone().applyQuaternion(qb))
        const top = hipP.clone().add(new THREE.Vector3(0, 0.06, 0).applyQuaternion(qa))
        segs.push({ a: top, b: knee, r: (t) => thighR(t - 0.06) })
        segs.push({ a: knee, b: ankle, r: shinR })
      }
      for (const d of deformers) d.update(segs)
    },
  }
}

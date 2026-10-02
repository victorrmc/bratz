import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getPose, hopOffset, reactionFor, restPose, transitionCurve, transitionPose, walkPose, TRANSITION_TOTAL, JOINTS } from '../../src/three/pose'
import { mouthShape } from '../../src/three/face'
import { DollRig } from '../../src/three/DollRig'
import { DOLL_BY_ID, PROTAGONIST_ID } from '../../src/data/characters'

describe('curva de transición', () => {
  const samples = Array.from({ length: 1001 }, (_, i) => transitionCurve(i / 1000))
  it('empieza en 0 y acaba en 1', () => {
    expect(transitionCurve(0)).toBe(0)
    expect(transitionCurve(1)).toBe(1)
    expect(transitionCurve(-1)).toBe(0)
    expect(transitionCurve(2)).toBe(1)
  })
  it('tiene anticipación (retrocede) y sobrepaso (asentamiento)', () => {
    expect(Math.min(...samples)).toBeLessThan(-0.05)
    expect(Math.max(...samples)).toBeGreaterThan(1.04)
  })
  it('es continua', () => {
    for (let i = 1; i < samples.length; i++) expect(Math.abs(samples[i] - samples[i - 1])).toBeLessThan(0.01)
  })
})

describe('transición entre poses', () => {
  it('parte de la pose inicial y llega a la final', () => {
    const a = getPose('idle')
    const b = getPose('wave')
    const out = restPose()
    transitionPose(a, b, 0, out)
    for (const j of JOINTS) expect(out[j].angleTo(a[j])).toBeLessThan(1e-6)
    transitionPose(a, b, TRANSITION_TOTAL, out)
    for (const j of JOINTS) expect(out[j].angleTo(b[j])).toBeLessThan(1e-6)
  })
  it('la cadera arranca antes que las manos (acción superpuesta)', () => {
    const a = getPose('idle')
    const b = getPose('star')
    const out = restPose()
    transitionPose(a, b, 0.35, out)
    const hip = out.hips.angleTo(a.hips) / Math.max(1e-6, b.hips.angleTo(a.hips))
    const wrist = out.wristL.angleTo(a.wristL) / Math.max(1e-6, b.wristL.angleTo(a.wristL))
    expect(hip).toBeGreaterThan(wrist)
  })
})

describe('reacciones', () => {
  it('elige la reacción según las estrellas', () => {
    expect(reactionFor(5)).toMatchObject({ kind: 'euforia', expression: 'risa', hops: 2, clap: true })
    expect(reactionFor(4)).toMatchObject({ kind: 'alegria', expression: 'dientes', hops: 1, clap: true })
    expect(reactionFor(3)).toMatchObject({ kind: 'aplauso', hops: 0, clap: true })
    expect(reactionFor(1)).toMatchObject({ kind: 'sorpresa', expression: 'sorpresa', clap: false })
  })
  it('el saltito se agacha antes de despegar y vuelve al suelo', () => {
    const ys = Array.from({ length: 100 }, (_, i) => hopOffset(i * 0.007).y)
    const iMin = ys.indexOf(Math.min(...ys))
    const iMax = ys.indexOf(Math.max(...ys))
    expect(ys[iMin]).toBeLessThan(-0.02)
    expect(iMin).toBeLessThan(iMax)
    expect(ys[iMax]).toBeGreaterThan(0.07)
    expect(hopOffset(10).y).toBe(0)
  })
})

describe('expresiones', () => {
  it('la sonrisa con dientes, la sorpresa y la risa abren la boca', () => {
    expect(mouthShape('dientes').open).toBeGreaterThan(mouthShape('sonrisa').open)
    expect(mouthShape('sorpresa').width).toBeLessThan(0.8)
    expect(mouthShape('risa', 1).open).toBeGreaterThan(mouthShape('risa', 0.5).open)
    expect(mouthShape('risa').tongue).toBe(true)
  })
})

describe('paseo', () => {
  it('con zancada corta la pierna oscila menos', () => {
    const a = walkPose(0.25, restPose(), 1)
    const b = walkPose(0.25, restPose(), 0.15)
    expect(b.hipL.angleTo(new THREE.Quaternion())).toBeLessThan(a.hipL.angleTo(new THREE.Quaternion()) * 0.5)
  })
})

describe('DollRig: pies e inercia', () => {
  const setup = () => {
    const rig = new DollRig(DOLL_BY_ID[PROTAGONIST_ID])
    const holder = new THREE.Group()
    holder.position.y = 0.1
    holder.add(rig.root)
    return { rig, holder }
  }

  it('en la pasarela los pies no atraviesan el suelo ni patinan, y avanza', () => {
    const { rig, holder } = setup()
    rig.locomotion = true
    rig.setWalking(true)
    const v = new THREE.Vector3()
    let t = 0
    for (let i = 0; i < 300; i++) {
      t += 1 / 60
      rig.update(1 / 60, t)
      rig.takeTravel(v)
      holder.position.add(v)
    }
    expect(rig.stats.minClearance).toBeGreaterThan(-0.002)
    expect(rig.stats.maxSlip).toBeLessThan(1e-6)
    expect(holder.position.z).toBeGreaterThan(3)
  })

  it('las transiciones flexionan rodillas sin hundir los pies', () => {
    const { rig } = setup()
    let t = 0
    for (const id of ['wave', 'star', 'cross', 'hip']) {
      rig.setPose(id)
      for (let i = 0; i < 70; i++) rig.update(1 / 60, (t += 1 / 60))
    }
    expect(rig.stats.transitions).toBe(4)
    expect(rig.stats.minClearance).toBeGreaterThan(-0.002)
  })

  it('reacciona a 5 estrellas con saltitos, aplausos y risa, y vuelve a la pose', () => {
    const { rig } = setup()
    rig.setPose('star')
    rig.react(5)
    expect(rig.visibleExpression).toBe('risa')
    let t = 0
    for (let i = 0; i < 200; i++) rig.update(1 / 60, (t += 1 / 60))
    expect(rig.stats.claps).toBeGreaterThanOrEqual(5)
    expect(rig.stats.maxLift).toBeGreaterThan(0.06)
    expect(rig.stats.minClearance).toBeGreaterThan(-0.002)
    expect(rig.reacting).toBeNull()
    expect(rig.visibleExpression).toBe('sonrisa')
  })
})

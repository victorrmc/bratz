import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buffersOf, fromData, geoStats, isDone, keyed, markDone, takePending, toData } from '../../src/three/geoCache'
import { setDetail } from '../../src/three/geo'
import { CURLS, baseKey, buildDollBase } from '../../src/three/dollGeo'
// @ts-expect-error: módulo .mjs sin tipos (plugin de Vite)
import { collectIntrinsics } from '../../scripts/r3f-catalogue.mjs'

describe('caché de geometría', () => {
  it('serializa y reconstruye una geometría con índice, grupos y nodos de pelo', () => {
    const g = new THREE.TorusGeometry(1, 0.3, 6, 12)
    g.addGroup(0, 6, 1)
    g.userData = { grid: { nu: 12, nv: 6 }, nodes: [new THREE.Vector3(1, 2, 3)] }
    const d = toData(g)
    const back = fromData(structuredClone(d))
    expect(back.getAttribute('position').array).toEqual(g.getAttribute('position').array)
    expect(back.getIndex()?.count).toBe(g.getIndex()?.count)
    expect(back.groups.at(-1)).toMatchObject({ start: 0, count: 6, materialIndex: 1 })
    expect(back.userData.grid).toEqual({ nu: 12, nv: 6 })
    expect(back.userData.nodes[0]).toBeInstanceOf(THREE.Vector3)
    expect(back.userData.nodes[0].toArray()).toEqual([1, 2, 3])
    // sin buffers repetidos (se transfieren sin copia desde el worker)
    const bufs = buffersOf(d)
    expect(new Set(bufs).size).toBe(bufs.length)
  })

  it('construye cada pieza una vez por nivel de detalle y la reutiliza después', () => {
    setDetail(0.5)
    let calls = 0
    const make = () => {
      calls++
      return new THREE.BoxGeometry()
    }
    const before = geoStats.hits
    keyed('prueba-caja', make)
    keyed('prueba-caja', make)
    expect(calls).toBe(1)
    expect(geoStats.hits).toBe(before + 1)
    setDetail(0.6)
    keyed('prueba-caja', make)
    expect(calls).toBe(2)
    markDone('prueba')
    expect(isDone('prueba')).toBe(true)
    setDetail(1)
  })

  it('las piezas base de la muñeca quedan listas para enviarlas desde el worker', () => {
    takePending()
    setDetail(0.3)
    buildDollBase([1.3])
    const entries = takePending()
    const names = entries.map(([k]) => k.split('|').slice(1).join('|'))
    expect(names).toContain('torso')
    expect(names).toContain('cabeza|1.3')
    // manos en cada nivel de flexión, piel y uñas, a los dos lados
    expect(names.filter((n) => n.startsWith('mano-')).length).toBe(CURLS.length * 2 * 2)
    expect(names).toContain(baseKey([1.3]))
    expect(isDone(baseKey([1.3]))).toBe(true)
    setDetail(1)
  })
})

describe('catálogo reducido de react-three-fiber', () => {
  it('incluye los elementos JSX del juego y los de los componentes de drei usados', () => {
    const names: Set<string> = collectIntrinsics(decodeURIComponent(new URL('../..', import.meta.url).pathname))
    for (const n of ['mesh', 'group', 'fog', 'instancedMesh', 'points', 'meshPhysicalMaterial', 'directionalLight', 'hemisphereLight']) expect(names.has(n), n).toBe(true)
    // ContactShadows (drei) pinta con una cámara ortográfica
    expect(names.has('orthographicCamera')).toBe(true)
    // nada de componentes de drei que el juego no importa
    expect(names.has('positionalAudio')).toBe(false)
  })
})

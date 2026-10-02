import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sparkleTexture } from './textures'
import { heartShape, starShape } from './geo'

// Partículas: destellos al cambiar de prenda y confeti al completar un look.

const SPARK_N = 90

export function SparkleBurst({ trigger, center = [0, 1, 0], radius = 0.5 }: { trigger: number; center?: [number, number, number]; radius?: number }) {
  const ref = useRef<THREE.Points>(null)
  const state = useMemo(() => {
    const pos = new Float32Array(SPARK_N * 3)
    const vel = new Float32Array(SPARK_N * 3)
    const size = new Float32Array(SPARK_N)
    const col = new Float32Array(SPARK_N * 3)
    return { pos, vel, size, col, life: 0 }
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(state.col, 3))
    return g
  }, [state])
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: sparkleTexture(),
        size: 0.09,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => {
    if (!trigger) return
    const palette = ['#ffffff', '#ffd1ec', '#ff7ac8', '#e2c6ff', '#fff3b0']
    const c = new THREE.Color()
    for (let i = 0; i < SPARK_N; i++) {
      const a = Math.random() * Math.PI * 2
      const h = (Math.random() - 0.3) * 1.6
      const r = radius * (0.6 + Math.random() * 0.6)
      state.pos.set([center[0] + Math.cos(a) * r, center[1] + h * 0.6, center[2] + Math.sin(a) * r], i * 3)
      state.vel.set([Math.cos(a) * 0.25, 0.4 + Math.random() * 0.6, Math.sin(a) * 0.25], i * 3)
      c.set(palette[i % palette.length]).multiplyScalar(1.6)
      state.col.set([c.r, c.g, c.b], i * 3)
    }
    state.life = 1
  }, [trigger, state, center, radius])
  useFrame((_, dt) => {
    if (!ref.current) return
    if (state.life <= 0) {
      ref.current.visible = false
      return
    }
    ref.current.visible = true
    state.life -= dt * 0.9
    for (let i = 0; i < SPARK_N; i++) {
      state.pos[i * 3] += state.vel[i * 3] * dt
      state.pos[i * 3 + 1] += state.vel[i * 3 + 1] * dt
      state.pos[i * 3 + 2] += state.vel[i * 3 + 2] * dt
    }
    geo.attributes.position.needsUpdate = true
    mat.opacity = Math.min(1, state.life * 2)
    mat.size = 0.05 + 0.06 * Math.abs(Math.sin(state.life * 18))
  })
  return <points ref={ref} geometry={geo} material={mat} visible={false} frustumCulled={false} />
}

const CONF_N = 260

export function Confetti({ trigger, center = [0, 1, 0] }: { trigger: number; center?: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(
    () => ({
      p: new Float32Array(CONF_N * 3),
      v: new Float32Array(CONF_N * 3),
      r: new Float32Array(CONF_N * 3),
      w: new Float32Array(CONF_N * 3),
      life: 0,
    }),
    [],
  )
  const geo = useMemo(() => {
    // mezcla de estrellas, corazones y tiras
    const g = new THREE.ShapeGeometry(heartShape(0.5), 6)
    g.scale(0.025, 0.025, 0.025)
    return g
  }, [])
  const geoStar = useMemo(() => {
    const g = new THREE.ShapeGeometry(starShape(0.5, 0.45), 1)
    g.scale(0.03, 0.03, 0.03)
    return g
  }, [])
  void geoStar
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.6, roughness: 0.3, emissiveIntensity: 0.3 }), [])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const cols = ['#ff5fae', '#ff2d8a', '#c9a7ff', '#fff16a', '#7fd6ff', '#ffffff', '#e3b45a']
    const c = new THREE.Color()
    for (let i = 0; i < CONF_N; i++) mesh.setColorAt(i, c.set(cols[i % cols.length]))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])
  useEffect(() => {
    if (!trigger) return
    for (let i = 0; i < CONF_N; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 0.5 + Math.random() * 1.6
      data.p.set([center[0] + (Math.random() - 0.5) * 0.3, center[1] + 0.4, center[2] + (Math.random() - 0.5) * 0.3], i * 3)
      data.v.set([Math.cos(a) * s, 2.2 + Math.random() * 2.4, Math.sin(a) * s * 0.6 + 0.4], i * 3)
      data.r.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3)
      data.w.set([(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12], i * 3)
    }
    data.life = 3.2
  }, [trigger, data, center])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const pv = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dtRaw) => {
    const mesh = ref.current
    if (!mesh) return
    if (data.life <= 0) {
      mesh.visible = false
      return
    }
    const dt = Math.min(dtRaw, 0.05)
    mesh.visible = true
    data.life -= dt
    for (let i = 0; i < CONF_N; i++) {
      const k = i * 3
      data.v[k + 1] -= 3.2 * dt
      // rozamiento de aire: caen como papel
      data.v[k] *= 0.985
      data.v[k + 2] *= 0.985
      if (data.v[k + 1] < -0.6) data.v[k + 1] = -0.6 + Math.sin(data.life * 5 + i) * 0.1
      data.p[k] += data.v[k] * dt + Math.sin(data.life * 3 + i) * 0.003
      data.p[k + 1] += data.v[k + 1] * dt
      data.p[k + 2] += data.v[k + 2] * dt
      for (let j = 0; j < 3; j++) data.r[k + j] += data.w[k + j] * dt
      e.set(data.r[k], data.r[k + 1], data.r[k + 2])
      q.setFromEuler(e)
      pv.set(data.p[k], data.p[k + 1], data.p[k + 2])
      m4.compose(pv, q, one)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, CONF_N]} visible={false} frustumCulled={false} />
}

/** Destellos flotantes permanentes (ambiente glam). */
export function FloatingGlints({ count = 40, area = [3, 2.2, 2], center = [0, 1.1, -0.5], color = '#ffd6f0' }: { count?: number; area?: [number, number, number]; center?: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.Points>(null)
  const { geo, phases } = useMemo(() => {
    const p = new Float32Array(count * 3)
    const ph = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      p.set([center[0] + (Math.random() - 0.5) * area[0], center[1] + (Math.random() - 0.5) * area[1], center[2] + (Math.random() - 0.5) * area[2]], i * 3)
      ph[i] = Math.random() * 10
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return { geo: g, phases: ph }
  }, [count, area, center])
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: sparkleTexture(),
        size: 0.07,
        color: new THREE.Color(color).multiplyScalar(1.5),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color],
  )
  useFrame((s) => {
    const t = s.clock.elapsedTime
    mat.size = 0.05 + 0.025 * Math.sin(t * 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < count; i++) pos.setY(i, pos.getY(i) + Math.sin(t * 0.8 + phases[i]) * 0.0006)
    pos.needsUpdate = true
  })
  return <points ref={ref} geometry={geo} material={mat} />
}

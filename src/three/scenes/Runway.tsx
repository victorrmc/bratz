import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GlamEnvironment, ThreePointLights } from '../env'
import { FloatingGlints } from '../effects'
import { Bulbs, GradientSky, Islet, Sea } from './common'
import { patternTexture } from '../textures'
import type { DollRig } from '../DollRig'

// Pasarela con cámara cinematográfica. El director mueve a la muñeca y la cámara.

export interface RunwayProps {
  quality: string
  holder: React.RefObject<THREE.Group | null>
  rig: React.RefObject<DollRig | null>
  special?: boolean
  onFinish?: () => void
  onPose?: () => void
}

const START_Z = -4.6
const END_Z = 0.9
const SPEED = 0.62

function Audience({ special }: { special: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 40
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: special ? '#3a2240' : '#24122e', roughness: 0.9 }), [special])
  useMemo(() => {
    requestAnimationFrame(() => {
      const m = ref.current
      if (!m) return
      const mtx = new THREE.Matrix4()
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1
        const row = Math.floor(i / 20)
        const z = START_Z + ((i >> 1) % 10) * 0.6
        mtx.makeTranslation(side * (1.5 + row * 0.6), 0.45 + row * 0.15, z)
        m.setMatrixAt(i, mtx)
      }
      m.instanceMatrix.needsUpdate = true
    })
  }, [])
  return <instancedMesh ref={ref} args={[geo, mat, N]} />
}

function Flashes() {
  const ref = useRef<THREE.Group>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    ref.current?.children.forEach((c, i) => {
      const on = Math.sin(t * 6.3 + i * 3.1) > 0.94
      ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setScalar(on ? 9 : 0.1)
    })
  })
  return (
    <group ref={ref}>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[(i % 2 ? 1 : -1) * (2.4 + (i % 3) * 0.5), 1.1 + (i % 3) * 0.2, START_Z - 1 + i * 0.35]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Petals() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 160
  const data = useMemo(() => Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 6, y: Math.random() * 4, z: START_Z + Math.random() * 7, r: Math.random() * 6, s: 0.3 + Math.random() * 0.4 })), [])
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.03, 8)
    g.scale(1, 0.6, 1)
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff8fc7', side: THREE.DoubleSide, roughness: 0.6 }), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  useFrame((s, dt) => {
    const m = ref.current
    if (!m) return
    const t = s.clock.elapsedTime
    data.forEach((d, i) => {
      d.y -= d.s * dt
      if (d.y < 0) d.y = 4
      d.r += dt * 2
      e.set(d.r, d.r * 0.7, 0)
      q.setFromEuler(e)
      v.set(d.x + Math.sin(t + i) * 0.2, d.y, d.z)
      m4.compose(v, q, one)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} />
}

export default function RunwayScene({ quality, holder, rig, special = false, onFinish, onPose }: RunwayProps) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const state = useRef({ t: 0, phase: 'walk' as 'walk' | 'pose' | 'back', posed: false, finished: false })
  const strip = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 24; i++) pts.push([0.62, 0.105, START_Z - 0.6 + i * 0.32], [-0.62, 0.105, START_Z - 0.6 + i * 0.32])
    return pts
  }, [])
  const floorTex = useMemo(() => {
    const t = patternTexture('purpurina', special ? '#ffd6c0' : '#1c1626').clone()
    t.repeat.set(4, 30)
    t.needsUpdate = true
    return t
  }, [special])
  const look = useMemo(() => new THREE.Vector3(), [])
  const camPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const st = state.current
    const h = holder.current
    const r = rig.current
    if (!h || !r) return
    st.t += dt
    const walkDur = (END_Z - START_Z) / SPEED
    if (st.phase === 'walk') {
      r.setWalking(true)
      h.position.z = START_Z + st.t * SPEED
      h.rotation.y = 0
      if (h.position.z >= END_Z) {
        h.position.z = END_Z
        st.phase = 'pose'
        st.t = 0
        r.setPose(special ? 'kiss' : 'hip')
        onPose?.()
      }
    } else if (st.phase === 'pose') {
      if (st.t > (special ? 4.5 : 3.2)) {
        if (special) {
          if (!st.finished) {
            st.finished = true
            onFinish?.()
          }
        } else {
          st.phase = 'back'
          st.t = 0
        }
      }
    } else {
      // vuelta y regreso
      h.rotation.y = Math.min(Math.PI, st.t * 4)
      if (st.t > 0.6) {
        r.setWalking(true)
        h.position.z = END_Z - (st.t - 0.6) * SPEED
      }
      if (h.position.z < START_Z) {
        st.phase = 'walk'
        st.t = 0
      }
    }
    // Cámara cinematográfica
    const z = h.position.z
    const progress = st.phase === 'walk' ? Math.min(1, st.t / walkDur) : 1
    if (st.phase === 'walk' && progress < 0.4) {
      // plano lateral amplio que acompaña
      camPos.set(3.4 - progress * 4, 1.45, z + 3.0)
      look.set(0, 1.0, z)
    } else if (st.phase === 'walk') {
      // plano frontal bajo, en retroceso
      camPos.set(0.45, 1.0, z + 4.2 - (progress - 0.4) * 1.2)
      look.set(0, 1.05, z)
    } else if (st.phase === 'pose') {
      // primer plano de la pose
      const k = Math.min(1, st.t / 1.5)
      camPos.set(0.3 - k * 0.2, 1.3, END_Z + 3.6 - k * 1.4)
      look.set(0, 1.25, END_Z)
    } else {
      camPos.set(-2.4, 1.5, z + 3.4)
      look.set(0, 1.0, z)
    }
    // en vertical hace falta más distancia para que quepa la figura entera
    const fit = Math.max(1, 0.75 / (size.width / size.height))
    camPos.sub(look).multiplyScalar(fit).add(look)
    camera.position.lerp(camPos, Math.min(1, dt * 2.5))
    camera.lookAt(look)
  })

  return (
    <>
      {special ? (
        <>
          <GlamEnvironment tint="#ffb38a" accent="#ff7ab8" intensity={0.95} />
          <ThreePointLights key1="#ffd9b8" fill="#ffa8c8" rim="#ff9a5a" k={1.1} />
          <GradientSky top="#6f63c9" mid="#ff8f9f" bottom="#ffbf7a" />
          <mesh position={[0, 1.2, -28]}>
            <circleGeometry args={[2, 48]} />
            <meshBasicMaterial color={new THREE.Color('#ffcf7a').multiplyScalar(2.2)} toneMapped={false} />
          </mesh>
          <Sea color="#5866c8" sun="#ffb46b" y={-0.3} z={-2} />
          <Islet position={[2.5, -0.3, -18]} scale={2.8} color="#6a4573" />
          <Petals />
        </>
      ) : (
        <>
          <GlamEnvironment tint="#ff7ac8" accent="#8f5bff" intensity={0.85} />
          <ThreePointLights key1="#fff0f8" fill="#ff5fae" rim="#8fd6ff" k={1.05} />
          <color attach="background" args={['#0f0518']} />
          <fog attach="fog" args={['#0f0518', 5, 14]} />
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#0f0518" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.2, START_Z - 1.2]}>
            <planeGeometry args={[5, 3.2]} />
            <meshBasicMaterial color={new THREE.Color('#ff5fae').multiplyScalar(0.9)} toneMapped={false} />
          </mesh>
          <Audience special={false} />
          <Flashes />
        </>
      )}
      {/* la pasarela */}
      <mesh position={[0, 0.05, (START_Z + END_Z) / 2 - 0.2]} receiveShadow>
        <boxGeometry args={[1.2, 0.1, END_Z - START_Z + 1.6]} />
        <meshPhysicalMaterial map={floorTex} color={special ? '#ffffff' : '#ffffff'} roughness={0.25} clearcoat={1} metalness={0.3} />
      </mesh>
      <Bulbs points={strip} color={special ? '#ffe2a8' : '#ff7ac8'} size={0.022} intensity={2.6} />
      <FloatingGlints count={quality === 'baja' ? 20 : 50} area={[4, 3, 6]} center={[0, 1.4, -1.5]} color={special ? '#ffe0b8' : '#ffd6f0'} />
    </>
  )
}

export const RUNWAY_Y = 0.1

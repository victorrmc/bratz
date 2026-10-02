import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GlamEnvironment, ThreePointLights } from '../env'
import { FloatingGlints } from '../effects'
import { Bougainvillea, Bulbs, FloatingShape, GlossyFloor, GradientSky, Islet, NeonTube, Palm, Sea, WhiteHouse } from './common'
import { patternTexture } from '../textures'
import { extrude, heartShape, roundedRectShape, starShape } from '../geo'

// Escenarios de la sesión de fotos (y fondos de los retos).

function Shadow({ quality, y = 0.002, color = '#5a2a4a' }: { quality: string; y?: number; color?: string }) {
  if (quality === 'baja') return null
  return <ContactShadows position={[0, y, 0]} opacity={0.55} scale={2.4} blur={2.4} far={1.6} resolution={512} color={color} />
}

function Disco({ quality }: { quality: string }) {
  const ball = useRef<THREE.Mesh>(null)
  const tiles = useRef<THREE.InstancedMesh>(null)
  const spots = useRef<THREE.Group>(null)
  const N = 12
  const tileGeo = useMemo(() => new THREE.PlaneGeometry(0.46, 0.46), [])
  const tileMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (ball.current) ball.current.rotation.y = t * 0.4
    if (spots.current) spots.current.children.forEach((c, i) => (c.rotation.z = Math.sin(t * 0.8 + i * 2) * 0.5))
    const m = tiles.current
    if (m) {
      const mtx = new THREE.Matrix4()
      const c = new THREE.Color()
      const cols = ['#ff2d8a', '#8f5bff', '#3de0c4', '#ffb3d9', '#2f6bff']
      let k = 0
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          mtx.makeRotationX(-Math.PI / 2).setPosition(-2.75 + i * 0.5, 0.003, -3.6 + j * 0.5)
          m.setMatrixAt(k, mtx)
          const on = Math.sin(t * 3 + i * 0.7 + j * 1.3) > 0.2
          m.setColorAt(k, c.set(cols[(i + j + Math.floor(t * 2)) % cols.length]).multiplyScalar(on ? 0.9 : 0.12))
          k++
        }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })
  return (
    <>
      <GlamEnvironment tint="#7a2fd6" accent="#ff2d8a" intensity={0.8} />
      <ThreePointLights key1="#ffe6f6" fill="#ff3fa0" rim="#3de0ff" k={0.9} />
      <color attach="background" args={['#14061f']} />
      <fog attach="fog" args={['#1a0828', 4, 12]} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[14, 14]} />
        <meshPhysicalMaterial color="#1a0b26" roughness={0.15} clearcoat={1} />
      </mesh>
      <instancedMesh ref={tiles} args={[tileGeo, tileMat, N * N]} />
      <mesh position={[0, 2.6, -3.8]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#1e0b2c" roughness={0.9} />
      </mesh>
      <NeonTube points={[[-2.4, 0.6, -3.7], [-2.4, 2.6, -3.7], [-1.6, 3.0, -3.7]]} color="#ff2d8a" />
      <NeonTube points={[[2.4, 0.6, -3.7], [2.4, 2.6, -3.7], [1.6, 3.0, -3.7]]} color="#3de0ff" />
      {/* corazón de neón */}
      <NeonTube points={heartShape(0.7).getSpacedPoints(60).map((p) => [p.x, 1.9 + p.y, -3.65] as [number, number, number])} color="#ff5fae" radius={0.022} />
      {/* bola de espejos */}
      <mesh ref={ball} position={[0, 2.9, -1.2]}>
        <icosahedronGeometry args={[0.32, 3]} />
        <meshStandardMaterial color="#e8e8f4" metalness={1} roughness={0.05} flatShading envMapIntensity={2.5} />
      </mesh>
      <group ref={spots}>
        {['#ff2d8a', '#3de0ff', '#c38bff'].map((c, i) => (
          <mesh key={c} position={[-1.6 + i * 1.6, 3.2, -0.8]} rotation-x={0.0}>
            <coneGeometry args={[0.7, 3.2, 24, 1, true]} />
            <meshBasicMaterial color={c} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <FloatingGlints count={50} color="#d6c0ff" />
      <Shadow quality={quality} color="#000000" />
    </>
  )
}

function Mall({ quality }: { quality: string }) {
  const tiles = useMemo(() => {
    const t = patternTexture('escoces', '#efe3f2', '#d6c2ea').clone()
    t.repeat.set(8, 8)
    t.needsUpdate = true
    return t
  }, [])
  const windows = [
    { x: -2.2, c: '#ffb3d9' },
    { x: 0, c: '#c9a7ff' },
    { x: 2.2, c: '#7fd6ff' },
  ]
  return (
    <>
      <GlamEnvironment tint="#ffd6ec" accent="#c9b6ff" intensity={0.55} />
      <ThreePointLights key1="#ffffff" fill="#ffc6e4" rim="#b9a4ff" k={0.8} />
      <color attach="background" args={['#cdb3ea']} />
      <fog attach="fog" args={['#e9d6f2', 7, 15]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshPhysicalMaterial map={tiles} roughness={0.2} clearcoat={1} />
      </mesh>
      {windows.map((w) => (
        <group key={w.x} position={[w.x, 0, -3]}>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[2, 2.8, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.25, 0.06]}>
            <planeGeometry args={[1.7, 2.1]} />
            <meshStandardMaterial color={w.c} emissive={w.c} emissiveIntensity={0.8} />
          </mesh>
          {/* maniquí abstracto */}
          <mesh position={[0, 0.95, 0.15]}>
            <capsuleGeometry args={[0.13, 0.5, 6, 12]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.3} clearcoat={1} />
          </mesh>
          <mesh position={[0, 1.42, 0.15]}>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.3} clearcoat={1} />
          </mesh>
          <mesh position={[0, 2.62, 0.08]}>
            <boxGeometry args={[1.4, 0.22, 0.04]} />
            <meshStandardMaterial color={w.c} emissive={w.c} emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
      {/* bolsas de compras */}
      {[
        [-0.75, '#ff5fae'],
        [-0.55, '#c38bff'],
        [0.7, '#3de0c4'],
      ].map(([x, c]) => (
        <group key={x as number} position={[x as number, 0, 0.35]} rotation-y={(x as number) * 0.8}>
          <mesh position-y={0.13}>
            <boxGeometry args={[0.2, 0.26, 0.08]} />
            <meshPhysicalMaterial color={c as string} roughness={0.4} clearcoat={0.6} />
          </mesh>
          <mesh position-y={0.28} rotation-x={0}>
            <torusGeometry args={[0.05, 0.006, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {[-3.3, 3.3].map((x) => (
        <group key={x} position={[x, 0, -1.8]}>
          <mesh position-y={0.25}>
            <cylinderGeometry args={[0.25, 0.2, 0.5, 20]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position-y={0.85}>
            <icosahedronGeometry args={[0.45, 1]} />
            <meshStandardMaterial color="#4caf6a" flatShading roughness={0.8} />
          </mesh>
        </group>
      ))}
      <Shadow quality={quality} />
    </>
  )
}

function Beach({ quality }: { quality: string }) {
  const sand = useMemo(() => {
    const t = patternTexture('purpurina', '#f2c99a').clone()
    t.repeat.set(20, 20)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <>
      <GlamEnvironment tint="#ffb07a" accent="#ff7ab8" intensity={0.9} />
      <ThreePointLights key1="#ffd7b0" fill="#ff9fc8" rim="#ff9a5a" k={1.05} />
      <GradientSky top="#7f6bd8" mid="#ff8fa8" bottom="#ffb87a" />
      <mesh position={[0, 1.5, -24]}>
        <circleGeometry args={[1.8, 48]} />
        <meshBasicMaterial color={new THREE.Color('#ffd27a').multiplyScalar(2.2)} toneMapped={false} />
      </mesh>
      <Sea color="#4b6fd0" sun="#ffb56b" y={0.0} z={-2.5} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 1.5]} receiveShadow>
        <planeGeometry args={[30, 9]} />
        <meshStandardMaterial map={sand} roughness={0.95} />
      </mesh>
      <Palm position={[-2.2, 0, -1.6]} scale={0.95} lean={0.25} />
      <Palm position={[2.6, 0, -2.4]} scale={1.1} lean={-0.2} />
      {/* toalla de rayas */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={0.3} position={[1.1, 0.01, 0.6]}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial map={patternTexture('rayas', '#ff5fae', '#ffffff')} roughness={0.9} />
      </mesh>
      <Islet position={[-4, 0, -18]} scale={2} color="#6f4a78" />
      <Shadow quality={quality} y={0.012} color="#8a4a3a" />
    </>
  )
}

function RedCarpet({ quality }: { quality: string }) {
  const flashes = useRef<THREE.Group>(null)
  const wall = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const x = cv.getContext('2d')!
    x.fillStyle = '#2a0f22'
    x.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        x.save()
        x.translate(32 + i * 64, 32 + j * 64)
        x.fillStyle = (i + j) % 2 ? '#e3b45a' : '#ff2d8a'
        x.beginPath()
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2
          const r = k % 2 ? 9 : 20
          k ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        x.fill()
        x.restore()
      }
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(4, 2)
    return t
  }, [])
  useFrame((s) => {
    const g = flashes.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.children.forEach((c, i) => {
      const on = Math.sin(t * 7 + i * 2.7) > 0.93
      ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setScalar(on ? 8 : 0.15)
    })
  })
  return (
    <>
      <GlamEnvironment tint="#ffe0ea" accent="#ffd27a" intensity={0.9} />
      <ThreePointLights key1="#ffffff" fill="#ffd0e0" rim="#ffe1a0" k={1.1} />
      <color attach="background" args={['#120610']} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#1a0d14" roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -1]}>
        <planeGeometry args={[1.8, 10]} />
        <meshStandardMaterial color="#b3122e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.6, -2.4]}>
        <planeGeometry args={[6, 3.2]} />
        <meshStandardMaterial map={wall} roughness={0.7} />
      </mesh>
      {[-1.1, 1.1].map((x) =>
        [-1.5, 0.2].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position-y={0.45}>
              <cylinderGeometry args={[0.03, 0.05, 0.9, 12]} />
              <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.2} />
            </mesh>
            <mesh position-y={0.92}>
              <sphereGeometry args={[0.05, 12, 8]} />
              <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.2} />
            </mesh>
          </group>
        )),
      )}
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.65]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.85, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#7a0f2a" roughness={0.5} />
        </mesh>
      ))}
      <group ref={flashes}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[(i % 2 ? 1 : -1) * (2 + (i % 3) * 0.4), 1.2 + (i % 4) * 0.25, 0.5 - i * 0.35]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshBasicMaterial toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Shadow quality={quality} />
    </>
  )
}

function Room({ quality }: { quality: string }) {
  const lava = useRef<THREE.Group>(null)
  useFrame((s) => {
    const g = lava.current
    if (!g) return
    g.children.forEach((c, i) => (c.position.y = 0.95 + Math.sin(s.clock.elapsedTime * 0.6 + i * 2) * 0.12))
  })
  const heart = useMemo(() => extrude(heartShape(0.18), 0.08, 0.05), [])
  const posters = ['#ff5fae', '#8f5bff', '#3de0c4']
  return (
    <>
      <GlamEnvironment tint="#ffc2e2" accent="#c9b6ff" intensity={0.55} />
      <ThreePointLights key1="#fff2f8" fill="#ffb3d9" rim="#c9a7ff" k={0.8} />
      <color attach="background" args={['#f7b3d6']} />
      <mesh position={[0, 1.8, -2.6]}>
        <planeGeometry args={[9, 3.6]} />
        <meshStandardMaterial map={patternTexture('corazones', '#ff9fd0', '#ff5fae')} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c9a7ff" roughness={0.8} />
      </mesh>
      {/* alfombra peluda */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.006}>
        <circleGeometry args={[0.9, 48]} />
        <meshPhysicalMaterial color="#ffffff" roughness={1} sheen={1} sheenColor="#ffd1ec" />
      </mesh>
      {/* cama */}
      <group position={[-1.7, 0, -1.9]}>
        <mesh position-y={0.25}>
          <boxGeometry args={[1.6, 0.5, 1.1]} />
          <meshPhysicalMaterial color="#c9a7ff" roughness={0.6} sheen={1} />
        </mesh>
        <mesh position={[0, 0.8, -0.5]}>
          <boxGeometry args={[1.6, 1.0, 0.1]} />
          <meshPhysicalMaterial color="#ff8fc7" roughness={0.4} clearcoat={0.6} />
        </mesh>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} geometry={heart} position={[x, 0.68, -0.3]}>
            <meshPhysicalMaterial color="#ff2d8a" roughness={0.5} sheen={1} />
          </mesh>
        ))}
      </group>
      {/* lámpara de lava */}
      <group position={[1.6, 0, -1.6]}>
        <mesh position-y={0.35}>
          <cylinderGeometry args={[0.1, 0.15, 0.7, 20]} />
          <meshPhysicalMaterial color="#c0c4d6" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position-y={0.95}>
          <capsuleGeometry args={[0.12, 0.35, 8, 16]} />
          <meshPhysicalMaterial color="#ffb3e6" transparent opacity={0.45} roughness={0.05} />
        </mesh>
        <group ref={lava}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.05 + i * 0.01, 12, 10]} />
              <meshBasicMaterial color={new THREE.Color('#ff2d8a').multiplyScalar(2)} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
      {posters.map((c, i) => (
        <group key={c} position={[0.4 + i * 0.8, 2.1 + (i % 2) * 0.2, -2.58]} rotation-z={(i - 1) * 0.08}>
          <mesh>
            <planeGeometry args={[0.6, 0.8]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position-z={0.01} geometry={i === 1 ? extrude(heartShape(0.18), 0.01) : extrude(starShape(0.2, 0.45), 0.01)}>
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      <FloatingShape kind="heart" position={[-0.8, 2.6, -2.2]} scale={0.2} color="#ff5fae" />
      <FloatingShape kind="star" position={[2.4, 2.4, -2]} scale={0.18} color="#fff16a" emissive={0.3} />
      <FloatingGlints count={24} />
      <Shadow quality={quality} y={0.01} />
    </>
  )
}

function IbizaSunset({ quality, home = false }: { quality: string; home?: boolean }) {
  const lights = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pts.push([-2.4 + t * 4.8, 2.5 - Math.sin(t * Math.PI) * 0.35, -1.6])
    }
    return pts
  }, [])
  const tiles = useMemo(() => {
    const t = patternTexture('escoces', '#e9a07a', '#d6825e').clone()
    t.repeat.set(6, 6)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <>
      <GlamEnvironment tint="#ffb38a" accent="#ff7ab8" intensity={0.95} />
      <ThreePointLights key1="#ffd9b8" fill="#ffa8c8" rim="#ff9a5a" k={1.05} />
      {home ? <GradientSky top="#2e3a8c" mid="#e77fa6" bottom="#ffb27a" /> : <GradientSky top="#6f63c9" mid="#ff8f9f" bottom="#ffbf7a" />}
      <mesh position={[2.2, 0.7, -26]}>
        <circleGeometry args={[1.6, 48]} />
        <meshBasicMaterial color={new THREE.Color('#ffcf7a').multiplyScalar(2.2)} toneMapped={false} />
      </mesh>
      <Sea color="#5866c8" sun="#ffb46b" y={-0.6} z={-4} />
      <Islet position={[-1.5, -0.6, -16]} scale={2.6} color="#6a4573" />
      {/* terraza */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial map={tiles} roughness={0.85} />
      </mesh>
      {/* murete blanco */}
      <mesh position={[0, 0.25, -2.4]}>
        <boxGeometry args={[7, 0.5, 0.2]} />
        <meshStandardMaterial color="#fbf6ef" roughness={0.9} />
      </mesh>
      {!home && (
        <>
          <WhiteHouse position={[-2.8, 0, -1.6]} size={[1.4, 1.6, 1.2]} />
          <WhiteHouse position={[-1.8, 0, -3.6]} size={[1.2, 2.2, 1]} />
          <WhiteHouse position={[2.9, 0, -2.2]} size={[1.4, 1.2, 1.2]} />
          <Bougainvillea position={[-2.1, 1.5, -1.1]} count={60} spread={[0.8, 0.6, 0.3]} />
          <Bougainvillea position={[2.4, 1.15, -1.6]} count={50} spread={[0.7, 0.4, 0.3]} />
        </>
      )}
      {home && <HomeProps />}
      <Bulbs points={lights} color="#ffe2a8" size={0.028} intensity={2.4} />
      <FloatingGlints count={30} color="#ffe0b8" />
      <Shadow quality={quality} y={0.004} color="#7a3a30" />
    </>
  )
}

/** Detalles de "nuestra casa": columpio, mesa con dos tazas y olivo. */
function HomeProps() {
  const swing = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (swing.current) swing.current.rotation.x = Math.sin(s.clock.elapsedTime * 1.1) * 0.08
  })
  const arch = useMemo(() => {
    const outer = roundedRectShape(1.6, 2.6, 0.02)
    const hole = new THREE.Path()
    hole.moveTo(-0.55, -1.2)
    hole.lineTo(0.55, -1.2)
    hole.lineTo(0.55, 0.5)
    hole.absarc(0, 0.5, 0.55, 0, Math.PI, false)
    hole.lineTo(-0.55, -1.2)
    outer.holes.push(hole)
    return new THREE.ShapeGeometry(outer, 24)
  }, [])
  const wall = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-1.6, 0)
    sh.lineTo(1.6, 0)
    sh.lineTo(1.6, 2.4)
    sh.quadraticCurveTo(0, 2.75, -1.6, 2.4)
    sh.lineTo(-1.6, 0)
    const door = new THREE.Path()
    door.moveTo(-0.45, 0)
    door.lineTo(0.45, 0)
    door.lineTo(0.45, 1.45)
    door.absarc(0, 1.45, 0.45, 0, Math.PI, false)
    door.lineTo(-0.45, 0)
    sh.holes.push(door)
    return new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 20 })
  }, [])
  const doorGeo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.45, 0)
    sh.lineTo(0.45, 0)
    sh.lineTo(0.45, 1.45)
    sh.absarc(0, 1.45, 0.45, 0, Math.PI, false)
    sh.lineTo(-0.45, 0)
    return new THREE.ShapeGeometry(sh, 20)
  }, [])
  const lightsArc = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI * (i / 18)
      pts.push([Math.cos(a) * 0.62, 1.45 + Math.sin(a) * 0.62, -1.05])
    }
    return pts
  }, [])
  return (
    <group>
      {/* nuestra puerta: pared encalada con arco y puerta azul ibicenca */}
      <mesh geometry={wall} position={[0, 0, -1.3]}>
        <meshStandardMaterial color="#fbf6ef" roughness={0.9} />
      </mesh>
      <mesh geometry={doorGeo} position={[0, 0, -1.25]}>
        <meshStandardMaterial color="#2c6fb3" roughness={0.5} />
      </mesh>
      <mesh position={[0.28, 0.95, -1.22]}>
        <sphereGeometry args={[0.03, 12, 8]} />
        <meshStandardMaterial color="#e3b45a" metalness={1} roughness={0.2} />
      </mesh>
      <Bulbs points={lightsArc} color="#ffe2a8" size={0.026} intensity={2.6} />
      <Bougainvillea position={[-1.05, 2.15, -1.05]} count={70} spread={[1.0, 0.5, 0.3]} />
      <Bougainvillea position={[1.15, 1.9, -1.05]} count={50} spread={[0.7, 0.6, 0.3]} />
      <mesh geometry={arch} position={[-1.35, 1.3, -1.25]} rotation-y={0.35} visible={false}>
        <meshStandardMaterial color="#fbf6ef" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <group ref={swing} position={[1.35, 2.3, -0.7]}>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, -0.75, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1.5, 6]} />
            <meshStandardMaterial color="#d9b98a" />
          </mesh>
        ))}
        <mesh position={[0, -1.5, 0]}>
          <boxGeometry args={[0.55, 0.04, 0.25]} />
          <meshStandardMaterial color="#c08a5a" roughness={0.7} />
        </mesh>
      </group>
      <group position={[0.85, 0, -0.35]}>
        <mesh position-y={0.36}>
          <cylinderGeometry args={[0.28, 0.28, 0.03, 32]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position-y={0.18}>
          <cylinderGeometry args={[0.03, 0.05, 0.36, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {[-0.08, 0.08].map((x, i) => (
          <mesh key={x} position={[x, 0.41, 0.02 * i]}>
            <cylinderGeometry args={[0.03, 0.025, 0.06, 16]} />
            <meshPhysicalMaterial color={i ? '#ff9fd0' : '#7fd6ff'} clearcoat={1} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <group position={[-1.0, 0, -0.9]}>
        <mesh position-y={0.2}>
          <cylinderGeometry args={[0.2, 0.15, 0.4, 20]} />
          <meshStandardMaterial color="#d6825e" roughness={0.8} />
        </mesh>
        <mesh position-y={0.95}>
          <icosahedronGeometry args={[0.45, 1]} />
          <meshStandardMaterial color="#7f9a63" flatShading roughness={0.9} />
        </mesh>
      </group>
      <FloatingShape kind="heart" position={[0, 2.35, -1.0]} scale={0.22} color="#ff5fae" emissive={0.3} />
    </group>
  )
}

export default function StageScene({ id, quality }: { id: string; quality: string }) {
  switch (id) {
    case 'disco':
      return <Disco quality={quality} />
    case 'mall':
      return <Mall quality={quality} />
    case 'beach':
      return <Beach quality={quality} />
    case 'redcarpet':
      return <RedCarpet quality={quality} />
    case 'room':
      return <Room quality={quality} />
    case 'casa':
      return <IbizaSunset quality={quality} home />
    case 'ibiza':
    default:
      return <IbizaSunset quality={quality} />
  }
}

export { GlossyFloor }

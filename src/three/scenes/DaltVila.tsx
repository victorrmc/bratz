import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AmbientParticles, AmbientSky, GlamEnvironment, seeded, ThreePointLights } from '../env'
import { Bougainvillea } from './common'

// «Cena en Dalt Vila»: noche entre murallas encaladas, farolillos de papel,
// la catedral arriba y una mesa con velas. Todo procedural.

// encalado bajo la luna: blanco azulado (los farolillos ponen los tonos cálidos)
const WALL = '#8689c6'
/** Los decorados apenas reflejan el entorno: la noche se ve oscura y Clara sigue bien iluminada. */
const NIGHT_ENV = 0.12
const LANTERN_COLORS = ['#ff8fb8', '#ffb35c', '#ffe27a', '#fff3e0', '#ff6f91', '#ffcf6b']

/** Adoquines pintados en canvas. */
function cobbleTexture() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const x = cv.getContext('2d')!
  x.fillStyle = '#3f3a55'
  x.fillRect(0, 0, 256, 256)
  const rnd = seeded(11)
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 16 : 0
    for (let col = -1; col < 8; col++) {
      const cx = col * 32 + off + 16 + (rnd() - 0.5) * 4
      const cy = row * 32 + 16 + (rnd() - 0.5) * 4
      const l = 34 + rnd() * 12
      x.fillStyle = `hsl(${250 + rnd() * 30}, ${10 + rnd() * 8}%, ${l}%)`
      x.beginPath()
      x.ellipse(cx, cy, 13 + rnd() * 2, 12 + rnd() * 2, rnd() * Math.PI, 0, Math.PI * 2)
      x.fill()
      x.fillStyle = 'rgba(255,255,255,.12)'
      x.beginPath()
      x.ellipse(cx - 3, cy - 4, 6, 4, 0, 0, Math.PI * 2)
      x.fill()
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(5, 4)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Muralla encalada con almenas y una puerta en arco. */
function Wall({ x = 0, z = -2.4, width = 9, height = 1.15 }: { x?: number; z?: number; width?: number; height?: number }) {
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-width / 2, 0)
    sh.lineTo(width / 2, 0)
    sh.lineTo(width / 2, height)
    // almenas
    const n = 13
    const step = width / n
    for (let i = n - 1; i >= 0; i--) {
      const x0 = -width / 2 + i * step
      if (i % 2 === 0) {
        sh.lineTo(x0 + step, height + 0.28)
        sh.lineTo(x0, height + 0.28)
      } else {
        sh.lineTo(x0 + step, height)
        sh.lineTo(x0, height)
      }
    }
    sh.lineTo(-width / 2, 0)
    const door = new THREE.Path()
    const dx = -2.3
    door.moveTo(dx - 0.32, 0)
    door.lineTo(dx + 0.32, 0)
    door.lineTo(dx + 0.32, 0.6)
    door.absarc(dx, 0.6, 0.32, 0, Math.PI, false)
    door.lineTo(dx - 0.32, 0)
    sh.holes.push(door)
    return new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 18 })
  }, [width, height])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo} position-z={-0.45} receiveShadow>
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color={WALL} roughness={0.95} />
      </mesh>
      {/* interior oscuro tras la puerta, con luz cálida al fondo */}
      <mesh position={[-2.3, 0.5, -0.6]}>
        <planeGeometry args={[0.7, 1.0]} />
        <meshBasicMaterial color="#5a2f22" />
      </mesh>
      <mesh position={[-2.3, 0.4, -0.58]}>
        <circleGeometry args={[0.16, 20]} />
        <meshBasicMaterial color={new THREE.Color('#ffb25c').multiplyScalar(1.6)} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Casita encalada de la ciudad alta con una ventana encendida. */
function NightHouse({ position, size, lit = true }: { position: [number, number, number]; size: [number, number, number]; lit?: boolean }) {
  return (
    <group position={position}>
      <mesh position-y={size[1] / 2}>
        <boxGeometry args={size} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[size[0] * 0.18, size[1] * 0.55, size[2] / 2 + 0.003]}>
        <planeGeometry args={[size[0] * 0.18, size[1] * 0.26]} />
        {lit ? <meshBasicMaterial color={new THREE.Color('#ffc46e').multiplyScalar(1.3)} toneMapped={false} /> : <meshStandardMaterial envMapIntensity={NIGHT_ENV} color="#27407a" />}
      </mesh>
      <mesh position={[-size[0] * 0.22, size[1] * 0.3, size[2] / 2 + 0.003]}>
        <planeGeometry args={[size[0] * 0.2, size[1] * 0.5]} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color="#2c5aa0" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Baluarte redondeado en la esquina. */
function Bastion({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.8}>
        <cylinderGeometry args={[0.85, 1.0, 1.6, 28, 1, false, Math.PI * 0.5, Math.PI]} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color={WALL} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI * 0.58 + (i / 5) * Math.PI * 0.84
        return (
          <mesh key={i} position={[Math.sin(a) * 0.82, 1.73, Math.cos(a) * 0.82]} rotation-y={a}>
            <boxGeometry args={[0.24, 0.26, 0.2]} />
            <meshStandardMaterial envMapIntensity={NIGHT_ENV} color={WALL} roughness={0.95} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Catedral de Santa María en lo alto: torre cuadrada y nave. */
function Cathedral({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={1.2}>
        <boxGeometry args={[2.4, 2.4, 1.4]} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color="#a9a6cf" roughness={0.9} />
      </mesh>
      <mesh position={[0.9, 2.9, 0.1]}>
        <boxGeometry args={[0.8, 3.4, 0.8]} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color="#b0add6" roughness={0.9} />
      </mesh>
      <mesh position={[0.9, 4.85, 0.1]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[0.6, 0.6, 4]} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color="#8d86b4" roughness={0.9} />
      </mesh>
      {/* campanario iluminado */}
      {[-0.2, 0.2].map((dx) => (
        <mesh key={dx} position={[0.9 + dx, 4.1, 0.51]}>
          <planeGeometry args={[0.14, 0.42]} />
          <meshBasicMaterial color={new THREE.Color('#ffc979').multiplyScalar(1.4)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Farolillos de papel colgados en una guirnalda que se mece con la brisa. */
function Lanterns({ from, to, sag = 0.35, count = 9, seed = 1 }: { from: [number, number, number]; to: [number, number, number]; sag?: number; count?: number; seed?: number }) {
  const group = useRef<THREE.Group>(null)
  const { wire, lanterns } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0)))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const rnd = seeded(seed)
    const ls = Array.from({ length: count }, (_, i) => {
      const t = (i + 0.5) / count
      return { p: curve.getPoint(t), color: LANTERN_COLORS[Math.floor(rnd() * LANTERN_COLORS.length)], s: 0.8 + rnd() * 0.45, ph: rnd() * 6.28 }
    })
    return { wire: new THREE.TubeGeometry(curve, 48, 0.005, 5, false), lanterns: ls }
  }, [from, to, sag, count, seed])
  // farolillo: cuerpo de papel (torneado) con brillo propio
  const body = useMemo(() => {
    const prof: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const v = i / 10
      prof.push(new THREE.Vector2(0.012 + Math.sin(v * Math.PI) * 0.075, -v * 0.19))
    }
    return new THREE.LatheGeometry(prof, 16)
  }, [])
  const mats = useMemo(() => {
    const m = new Map<string, THREE.MeshBasicMaterial>()
    for (const c of LANTERN_COLORS) m.set(c, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.5), toneMapped: false }))
    return m
  }, [])
  useFrame((s) => {
    const g = group.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.children.forEach((c, i) => {
      if (i === 0) return
      const l = lanterns[i - 1]
      c.rotation.z = Math.sin(t * 1.3 + l.ph) * 0.12 + Math.sin(t * 0.7 + l.ph * 2) * 0.05
      c.rotation.x = Math.cos(t * 1.1 + l.ph) * 0.08
    })
  })
  return (
    <group ref={group}>
      <mesh geometry={wire}>
        <meshBasicMaterial color="#2a2030" />
      </mesh>
      {lanterns.map((l, i) => (
        <group key={i} position={l.p} scale={l.s}>
          <mesh geometry={body} material={mats.get(l.color)} />
          <mesh position-y={-0.2}>
            <cylinderGeometry args={[0.02, 0.02, 0.02, 8]} />
            <meshBasicMaterial color="#3a2a20" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Mesa de cena con mantel, vela que titila y dos copas. */
function DinnerTable({ position }: { position: [number, number, number] }) {
  const flame = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const k = 0.85 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.06
    if (flame.current) flame.current.scale.set(1, k, 1)
    if (light.current) light.current.intensity = 1.4 * k
  })
  return (
    <group position={position}>
      <mesh position-y={0.72}>
        <cylinderGeometry args={[0.36, 0.36, 0.03, 32]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.8} />
      </mesh>
      <mesh position-y={0.62}>
        <cylinderGeometry args={[0.37, 0.4, 0.2, 32, 1, true]} />
        <meshStandardMaterial color="#f7efe4" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.3}>
        <cylinderGeometry args={[0.03, 0.05, 0.6, 10]} />
        <meshStandardMaterial color="#2b2430" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 12]} />
        <meshStandardMaterial color="#fff6e8" roughness={0.6} />
      </mesh>
      <mesh ref={flame} position={[0, 0.885, 0]}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshBasicMaterial color={new THREE.Color('#ffcf73').multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0.95, 0]} color="#ffb766" intensity={1.4} distance={2.2} decay={2} />
      {[-0.17, 0.17].map((x) => (
        <group key={x} position={[x, 0.735, 0.08]}>
          <mesh position-y={0.06}>
            <cylinderGeometry args={[0.004, 0.004, 0.08, 6]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.6} roughness={0.1} transparent opacity={0.6} />
          </mesh>
          <mesh position-y={0.12}>
            <cylinderGeometry args={[0.03, 0.012, 0.06, 14, 1, true]} />
            <meshPhysicalMaterial color="#ffd6e6" roughness={0.1} transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function DaltVila({ quality }: { quality: string }) {
  const cobbles = useMemo(cobbleTexture, [])
  const moonDir = useMemo<[number, number, number]>(() => [-0.35, 0.32, -1], [])
  return (
    <>
      <GlamEnvironment tint="#4b4f9e" accent="#ffb070" intensity={0.45} />
      <ThreePointLights key1="#ffd6aa" fill="#8d8cff" rim="#c4a8ff" k={0.8} />
      <AmbientSky top="#070b2e" mid="#28296a" bottom="#5b3f7d" sunColor="#d8e2ff" sunDir={moonDir} halo={0.55} clouds={0.25} />
      <fog attach="fog" args={['#262a62', 9, 34]} />
      {/* luna y estrellas */}
      <mesh position={[-2.6, 5.0, -16]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color={new THREE.Color('#fff6e2').multiplyScalar(1.3)} toneMapped={false} fog={false} />
      </mesh>
      <AmbientParticles kind="chispas" count={90} area={[36, 9, 2]} center={[0, 6.5, -20]} color="#ffffff" size={0.3} quality={quality} seed={51} />
      {/* plaza empedrada */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial map={cobbles} roughness={0.75} envMapIntensity={NIGHT_ENV} />
      </mesh>
      {/* murallas, baluarte y la ciudad alta al fondo */}
      <Wall />
      <Bastion position={[3.6, 0, -2.6]} />
      {/* la ciudad alta, escalonada colina arriba */}
      <mesh position={[0, 0.2, -10]}>
        <boxGeometry args={[22, 1.2, 8]} />
        <meshStandardMaterial envMapIntensity={NIGHT_ENV} color="#2c2a55" roughness={1} />
      </mesh>
      <NightHouse position={[-4.6, 0.3, -7.2]} size={[1.6, 1.2, 1.2]} />
      <NightHouse position={[-2.6, 0.5, -8.2]} size={[1.3, 1.5, 1.0]} lit={false} />
      <NightHouse position={[0.2, 0.7, -7.8]} size={[1.2, 1.0, 1.0]} />
      <NightHouse position={[2.6, 0.6, -8.4]} size={[1.5, 1.3, 1.1]} />
      <NightHouse position={[4.8, 0.3, -7.4]} size={[1.3, 1.0, 1.0]} lit={false} />
      <NightHouse position={[-1.0, 1.2, -9.8]} size={[1.8, 1.0, 1.0]} lit={false} />
      <NightHouse position={[1.6, 1.4, -10.4]} size={[1.1, 1.2, 1.0]} />
      <Cathedral position={[-2.2, 1.6, -12.5]} />
      <Bougainvillea position={[-3.4, 1.05, -2.35]} count={46} spread={[0.7, 0.4, 0.2]} />
      <Bougainvillea position={[1.2, 1.15, -2.35]} count={38} spread={[0.6, 0.3, 0.2]} />
      {/* farolillos */}
      <Lanterns from={[-3.6, 2.45, -1.6]} to={[3.4, 2.5, -1.6]} sag={0.45} count={11} seed={3} />
      <Lanterns from={[-3.2, 2.95, -3.4]} to={[3.0, 3.0, -3.4]} sag={0.3} count={9} seed={8} />
      {/* luz cálida de los farolillos sobre Clara */}
      <pointLight position={[0.6, 2.1, -0.9]} color="#ffb37a" intensity={2.2} distance={4.5} decay={2} />
      <pointLight position={[-1.8, 1.9, -1.7]} color="#ff9a6a" intensity={2.4} distance={3.2} decay={2} />
      <DinnerTable position={[1.05, 0, -0.55]} />
      <AmbientParticles kind="luciernagas" count={18} area={[5, 1.6, 2]} center={[0, 1.2, -1.2]} color="#ffd08a" size={0.035} quality={quality} seed={52} />
      {quality !== 'baja' && <ContactShadows position={[0, 0.003, 0]} opacity={0.6} scale={2.4} blur={2.4} far={1.6} resolution={512} color="#1c1436" />}
    </>
  )
}

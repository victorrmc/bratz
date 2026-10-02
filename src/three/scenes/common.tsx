import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { extrude, heartShape, starShape } from '../geo'
import { patternTexture } from '../textures'

// Piezas comunes de escenografía.

export function GradientSky({ top, mid, bottom, radius = 30 }: { top: string; mid: string; bottom: string; radius?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}',
        fragmentShader:
          'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bottom, smoothstep(0.0, 0.25, -h)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n }',
      }),
    [top, mid, bottom],
  )
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  )
}

/** Suelo brillante: reflector real en calidad alta, físico en el resto. */
export function GlossyFloor({ color, quality, size = 14, mirror = 0.45, roughness = 0.35 }: { color: string; quality: string; size?: number; mirror?: number; roughness?: number }) {
  if (quality === 'alta') {
    return (
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[size / 2, 64]} />
        <MeshReflectorMaterial
          color={color}
          blur={[300, 80]}
          resolution={512}
          mixBlur={1}
          mixStrength={mirror * 3}
          roughness={roughness}
          depthScale={0.8}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          metalness={0.2}
          mirror={mirror}
        />
      </mesh>
    )
  }
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[size / 2, 64]} />
      <meshPhysicalMaterial color={color} roughness={roughness * 0.8} clearcoat={1} clearcoatRoughness={0.15} />
    </mesh>
  )
}

/** Podio redondo con purpurina y borde dorado. */
export function Podium({ color = '#ffb3d9', radius = 0.6, height = 0.06 }: { color?: string; radius?: number; height?: number }) {
  const tex = useMemo(() => {
    const t = patternTexture('purpurina', color).clone()
    t.repeat.set(6, 6)
    t.needsUpdate = true
    return t
  }, [color])
  return (
    <group>
      <mesh position-y={height / 2} receiveShadow castShadow>
        <cylinderGeometry args={[radius, radius * 1.02, height, 64]} />
        <meshPhysicalMaterial map={tex} metalness={0.5} roughness={0.3} clearcoat={1} />
      </mesh>
      <mesh position-y={height} rotation-x={Math.PI / 2}>
        <torusGeometry args={[radius, 0.012, 12, 96]} />
        <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.18} />
      </mesh>
    </group>
  )
}

const heartGeo = (() => {
  let g: THREE.BufferGeometry | null = null
  return () => (g ??= extrude(heartShape(0.5), 0.22, 0.12, 20))
})()
const starGeo = (() => {
  let g: THREE.BufferGeometry | null = null
  return () => (g ??= extrude(starShape(0.5, 0.48), 0.14, 0.08, 10))
})()

export function FloatingShape({ kind, position, scale = 1, color, speed = 1, emissive = 0 }: { kind: 'heart' | 'star'; position: [number, number, number]; scale?: number; color: string; speed?: number; emissive?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const phase = useMemo(() => Math.random() * 10, [])
  useFrame((s) => {
    const m = ref.current
    if (!m) return
    const t = s.clock.elapsedTime * speed + phase
    m.position.y = position[1] + Math.sin(t * 0.8) * 0.08 * scale
    m.rotation.y = Math.sin(t * 0.5) * 0.6
    m.rotation.z = kind === 'star' ? t * 0.2 : Math.sin(t * 0.7) * 0.1
  })
  return (
    <mesh ref={ref} geometry={kind === 'heart' ? heartGeo() : starGeo()} position={position} scale={scale}>
      <meshPhysicalMaterial color={color} metalness={0.3} roughness={0.15} clearcoat={1} iridescence={0.6} emissive={color} emissiveIntensity={emissive} />
    </mesh>
  )
}

/** Hilera de bombillas (camerino, guirnaldas). */
export function Bulbs({ points, color = '#fff2d6', size = 0.035, intensity = 2.2 }: { points: [number, number, number][]; color?: string; size?: number; intensity?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(size, 12, 8), [size])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false }), [color, intensity])
  useMemo(() => {
    requestAnimationFrame(() => {
      const m = ref.current
      if (!m) return
      const mtx = new THREE.Matrix4()
      points.forEach((p, i) => m.setMatrixAt(i, mtx.makeTranslation(p[0], p[1], p[2])))
      m.instanceMatrix.needsUpdate = true
    })
  }, [points])
  return <instancedMesh ref={ref} args={[geo, mat, points.length]} frustumCulled={false} />
}

export function NeonTube({ points, color, radius = 0.018, intensity = 3 }: { points: [number, number, number][]; color: string; radius?: number; intensity?: number }) {
  const geo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(c, Math.max(16, points.length * 12), radius, 8, false)
  }, [points, radius])
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(intensity)} toneMapped={false} />
    </mesh>
  )
}

/** Palmera estilizada. */
export function Palm({ position, scale = 1, lean = 0.2 }: { position: [number, number, number]; scale?: number; lean?: number }) {
  const { trunk, leaves } = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push(new THREE.Vector3(Math.sin(t * 1.4) * lean * 3 * t, t * 3, 0))
    }
    const c = new THREE.CatmullRomCurve3(pts)
    const trunk = new THREE.TubeGeometry(c, 24, 0.09, 10, false)
    const top = pts[pts.length - 1]
    const lv: THREE.BufferGeometry[] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const shape = new THREE.Shape()
      shape.moveTo(0, 0)
      shape.quadraticCurveTo(0.6, 0.18, 1.4, 0)
      shape.quadraticCurveTo(0.6, -0.12, 0, 0)
      const g = new THREE.ShapeGeometry(shape, 8)
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k)
        pos.setZ(k, -0.35 * x * x)
      }
      g.rotateX(-Math.PI / 2)
      g.rotateZ(-0.25)
      g.rotateY(a)
      g.translate(top.x, top.y, top.z)
      lv.push(g)
    }
    const leaves = lv
    return { trunk, leaves }
  }, [lean])
  return (
    <group position={position} scale={scale}>
      <mesh geometry={trunk}>
        <meshStandardMaterial color="#8a6040" roughness={0.9} />
      </mesh>
      {leaves.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={i % 2 ? '#2f8f5a' : '#3aa36a'} side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** Mar con brillo animado. */
export function Sea({ color = '#2b7bbf', y = -0.02, z = -6, size = 80, sun = '#ffb36b' }: { color?: string; y?: number; z?: number; size?: number; sun?: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, sun: { value: new THREE.Color(sun) } },
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader:
          'uniform float t; uniform vec3 c; uniform vec3 sun; varying vec2 vUv; varying vec3 vW; void main(){ float d = clamp((-vW.z - 2.0) / 40.0, 0.0, 1.0); float w = sin(vW.x*3.0 + t*1.2 + sin(vW.z*2.0+t))*0.5+0.5; float glit = pow(max(0.0, sin(vW.x*9.0 + t*2.0) * sin(vW.z*7.0 - t*1.5)), 24.0); float path = exp(-abs(vW.x)*0.35) * d; vec3 col = mix(c*0.8, c*1.25, w*0.3) ; col = mix(col, sun, path*0.55 + glit*path*1.5); col = mix(col, sun*0.9 + c*0.2, d*0.35); gl_FragColor = vec4(col,1.0);\n#include <colorspace_fragment>\n }',
      }),
    [color, sun],
  )
  useFrame((s) => {
    mat.uniforms.t.value = s.clock.elapsedTime
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, z - size / 2 + 4]} material={mat}>
      <planeGeometry args={[size, size, 1, 1]} />
    </mesh>
  )
}

/** Es Vedrà: el islote mágico de Ibiza en el horizonte. */
export function Islet({ position, scale = 1, color = '#6d4a6a' }: { position: [number, number, number]; scale?: number; color?: string }) {
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1.4, 9, 6)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      const n = Math.sin(p.getX(i) * 7 + y * 5) * 0.08 + Math.cos(p.getZ(i) * 6) * 0.06
      p.setX(i, p.getX(i) * (1 + n) * (y > 0.3 ? 0.8 : 1))
      p.setZ(i, p.getZ(i) * (1 + n))
    }
    g.computeVertexNormals()
    g.scale(1.6, 1, 0.8)
    return g
  }, [])
  return (
    <mesh geometry={geo} position={position} scale={scale}>
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </mesh>
  )
}

/** Casita blanca ibicenca. */
export function WhiteHouse({ position, size = [1, 0.8, 1], rot = 0 }: { position: [number, number, number]; size?: [number, number, number]; rot?: number }) {
  return (
    <group position={position} rotation-y={rot}>
      <mesh position-y={size[1] / 2} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#fbf6ef" roughness={0.85} />
      </mesh>
      <mesh position={[0, size[1] * 0.45, size[2] / 2 + 0.002]}>
        <planeGeometry args={[size[0] * 0.22, size[1] * 0.35]} />
        <meshStandardMaterial color="#2c6fb3" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Racimo de buganvilla (flores fucsia). */
export function Bougainvillea({ position, count = 40, spread = [0.6, 0.4, 0.2] }: { position: [number, number, number]; count?: number; spread?: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.05, 0), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e0218a', roughness: 0.6, flatShading: true }), [])
  useMemo(() => {
    requestAnimationFrame(() => {
      const m = ref.current
      if (!m) return
      const mtx = new THREE.Matrix4()
      const c = new THREE.Color()
      for (let i = 0; i < count; i++) {
        const s = 0.6 + Math.random() * 0.8
        mtx.makeScale(s, s, s).setPosition((Math.random() - 0.5) * spread[0], (Math.random() - 0.5) * spread[1], (Math.random() - 0.5) * spread[2])
        m.setMatrixAt(i, mtx)
        m.setColorAt(i, c.set(Math.random() < 0.2 ? '#3a8f4f' : Math.random() < 0.5 ? '#e0218a' : '#ff4fa8'))
      }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })
  }, [count, spread])
  return <instancedMesh ref={ref} args={[geo, mat, count]} position={position} />
}

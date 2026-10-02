import { ContactShadows } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { GlamEnvironment, ThreePointLights } from '../env'
import { FloatingGlints } from '../effects'
import { Bulbs, FloatingShape, GlossyFloor, GradientSky, Podium } from './common'
import { roundedRectShape } from '../geo'

// Vestidor: ciclorama rosa, suelo reflectante, podio, espejo con bombillas y burro de ropa.

export default function StudioScene({ quality }: { quality: string }) {
  const mirrorBulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i < 7; i++) {
      pts.push([-2.05, 0.5 + i * 0.27, -1.7])
      pts.push([-0.95, 0.5 + i * 0.27, -1.7])
    }
    for (let i = 1; i < 4; i++) pts.push([-2.05 + i * 0.275, 2.15, -1.7])
    return pts
  }, [])
  const archBulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI * (i / 26)
      pts.push([Math.cos(a) * 1.15, 1.05 + Math.sin(a) * 1.15, -1.05])
    }
    for (let i = 1; i <= 5; i++) {
      pts.push([1.15, 1.05 - i * 0.2, -1.05])
      pts.push([-1.15, 1.05 - i * 0.2, -1.05])
    }
    return pts
  }, [])
  const archGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    pts.push(new THREE.Vector3(1.15, 0, -1.08))
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * (i / 40)
      pts.push(new THREE.Vector3(Math.cos(a) * 1.15, 1.05 + Math.sin(a) * 1.15, -1.08))
    }
    pts.push(new THREE.Vector3(-1.15, 0, -1.08))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05), 120, 0.05, 10, false)
  }, [])
  const curtain = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.1, 3.4, 40, 1)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 18) * 0.05)
    g.computeVertexNormals()
    return g
  }, [])
  const frame = useMemo(() => {
    const outer = roundedRectShape(1.25, 1.85, 0.12)
    outer.holes.push(roundedRectShape(1.0, 1.6, 0.08))
    return new THREE.ShapeGeometry(outer, 12)
  }, [])
  return (
    <>
      <GlamEnvironment tint="#ffc2e2" accent="#c9b6ff" intensity={0.6} />
      <ThreePointLights shadows={quality === 'alta'} k={0.85} />
      <GradientSky top="#e9d6ff" mid="#ffd3ec" bottom="#f7b6d9" />
      <fog attach="fog" args={['#f9cfe6', 6, 16]} />
      {/* ciclorama */}
      <mesh position={[0, 2.4, -0.5]} rotation-y={Math.PI}>
        <cylinderGeometry args={[3.4, 3.4, 5, 64, 1, true, -Math.PI * 0.55, Math.PI * 1.1]} />
        {quality === 'baja' ? <meshLambertMaterial color="#ffd6ec" side={THREE.BackSide} /> : <meshStandardMaterial color="#ffd6ec" side={THREE.BackSide} roughness={0.9} />}
      </mesh>
      <GlossyFloor color="#f7bfe0" quality={quality} />
      {/* arco de camerino con bombillas */}
      <mesh geometry={archGeo}>
        <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.22} />
      </mesh>
      <Bulbs points={archBulbs} color="#fff0d6" size={0.03} intensity={2.4} />
      {/* fondo del arco: satén con brillo */}
      <mesh position={[0, 1.05, -1.12]}>
        <circleGeometry args={[1.12, 48, 0, Math.PI]} />
        <meshStandardMaterial color="#ff9fd0" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.525, -1.12]}>
        <planeGeometry args={[2.24, 1.05]} />
        <meshStandardMaterial color="#ff9fd0" roughness={0.5} metalness={0.15} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={curtain} position={[sd * 1.95, 1.7, -0.95]} rotation-y={-sd * 0.35}>
          <meshPhysicalMaterial color="#ff5fae" roughness={0.38} sheen={quality === 'baja' ? 0 : 1} sheenColor="#ffd1ec" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Podium color="#ffc6e6" radius={0.62} />
      {/* espejo de camerino */}
      <group>
        <mesh position={[-1.5, 1.33, -1.72]} geometry={frame}>
          <meshPhysicalMaterial color="#ffffff" roughness={0.3} clearcoat={1} />
        </mesh>
        <mesh position={[-1.5, 1.33, -1.73]}>
          <planeGeometry args={[1.0, 1.6]} />
          <meshPhysicalMaterial color="#e8dff5" metalness={1} roughness={0.06} />
        </mesh>
        <Bulbs points={mirrorBulbs} />
      </group>
      {/* burro de ropa */}
      <group position={[1.55, 0, -1.4]}>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.85, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1.7, 8]} />
            <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.2} />
          </mesh>
        ))}
        <mesh position={[0, 1.68, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.014, 0.014, 1.05, 8]} />
          <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.2} />
        </mesh>
        {['#ff5fae', '#c9a7ff', '#7fd6ff', '#fff16a', '#ff2d8a', '#3de0c4'].map((c, i) => (
          <group key={c} position={[-0.4 + i * 0.16, 1.62, 0]} rotation-y={Math.PI / 2 + (i % 2 ? 0.2 : -0.2)}>
            <mesh position-y={-0.3}>
              <cylinderGeometry args={[0.07, 0.17, 0.62, 16, 1, true]} />
              <meshPhysicalMaterial color={c} roughness={0.4} sheen={1} side={THREE.DoubleSide} />
            </mesh>
            <mesh position-y={0.01} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.035, 0.004, 6, 16, Math.PI]} />
              <meshPhysicalMaterial color="#e8eaf4" metalness={1} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
      <FloatingShape kind="heart" position={[-1.1, 2.3, -1.4]} scale={0.35} color="#ff5fae" />
      <FloatingShape kind="star" position={[1.2, 2.45, -1.2]} scale={0.3} color="#ffd76a" emissive={0.25} />
      <FloatingShape kind="heart" position={[2.3, 1.0, -0.9]} scale={0.22} color="#c38bff" />
      <FloatingShape kind="star" position={[-2.4, 2.0, -0.6]} scale={0.18} color="#7fd6ff" />
      <FloatingGlints count={quality === 'baja' ? 16 : 40} />
      {quality !== 'baja' && <ContactShadows position={[0, 0.062, 0]} opacity={0.55} scale={2.2} blur={2.4} far={1.6} resolution={512} color="#8a3b6e" />}
    </>
  )
}

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DollShadow } from '../shadow'
import { GlamEnvironment, ThreePointLights } from '../env'
import { FloatingGlints } from '../effects'
import { FloatingShape, GlossyFloor, GradientSky, Islet, Podium, Sea } from './common'
import { heartShape } from '../geo'

// Portada: atardecer rosa de Ibiza, corazón luminoso y Clara posando.

export default function HomeScene({ quality }: { quality: string }) {
  const ring = useRef<THREE.Mesh>(null)
  const heartLine = useMemo(() => {
    const pts = heartShape(1).getSpacedPoints(120).map((p) => new THREE.Vector3(p.x, p.y, 0))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.022, 8, true)
  }, [])
  useFrame((s) => {
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial
      const k = 1.05 + Math.sin(s.clock.elapsedTime * 2) * 0.25
      m.color.setRGB(1.0 * k, 0.25 * k, 0.62 * k)
    }
  })
  return (
    <>
      <GlamEnvironment tint="#ffc0d8" accent="#ffb37a" intensity={0.6} />
      <ThreePointLights key1="#fff0e0" fill="#ffb0d0" rim="#ffa36b" k={0.85} />
      <GradientSky top="#8a6cf0" mid="#ff7fb6" bottom="#ffa36b" />
      <Sea color="#7a6bd6" sun="#ffb07a" y={-0.35} z={-3} />
      <Islet position={[3.2, -0.4, -14]} scale={2.2} color="#7b4f86" />
      <mesh position={[0, 1.2, -2.2]}>
        <mesh ref={ring} geometry={heartLine} scale={1.25} position={[0, 0.05, 0]}>
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      </mesh>
      <GlossyFloor color="#ffcfe6" quality={quality} size={9} mirror={0.5} />
      <Podium color="#ffc0e0" radius={0.6} height={0.08} />
      <FloatingShape kind="heart" position={[-1.3, 2.0, -1.2]} scale={0.32} color="#ff5fae" />
      <FloatingShape kind="star" position={[1.35, 2.2, -1.1]} scale={0.32} color="#ffd76a" emissive={0.3} />
      <FloatingShape kind="star" position={[-1.7, 0.9, -0.8]} scale={0.18} color="#c38bff" />
      <FloatingShape kind="heart" position={[1.6, 0.8, -0.6]} scale={0.18} color="#ff9fd0" />
      <FloatingGlints count={quality === 'baja' ? 20 : 60} area={[3.5, 2.6, 2]} />
      <DollShadow quality={quality} y={0.082} opacity={0.5} color="#8a3b6e" />
    </>
  )
}

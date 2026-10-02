import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

// Entorno de iluminación generado por código (sin HDRI externos): una sala
// con paneles emisivos tipo softbox que da reflejos glam en charol y joyas.

const cache = new Map<string, THREE.Texture>()

function buildEnvScene(tint: string, accent: string): THREE.Scene {
  const scene = new THREE.Scene()
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(0.35), side: THREE.BackSide }),
  )
  room.position.y = 3
  scene.add(room)
  const panel = (w: number, h: number, color: string, intensity: number, pos: [number, number, number], look: [number, number, number] = [0, 1, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(...look)
    scene.add(m)
  }
  // key softbox, fill rosa, contra lila y techo
  panel(3, 3, '#ffffff', 6, [3, 3.5, 3.5])
  panel(2.5, 4, tint, 3.5, [-4, 2, 2])
  panel(2, 4, accent, 4, [0, 2.5, -5])
  panel(6, 6, '#ffffff', 1.6, [0, 6.5, 0])
  panel(1, 5, '#ffffff', 5, [5, 2, -2])
  // suelo cálido
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(0.6) }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.9
  scene.add(floor)
  return scene
}

export function GlamEnvironment({ tint = '#ffc2e2', accent = '#c9b6ff', intensity = 0.9 }: { tint?: string; accent?: string; intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const key = `${tint}|${accent}`
    let tex = cache.get(key)
    if (!tex) {
      const pm = new THREE.PMREMGenerator(gl)
      const envScene = buildEnvScene(tint, accent)
      tex = pm.fromScene(envScene, 0.035).texture
      pm.dispose()
      envScene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      cache.set(key, tex)
    }
    scene.environment = tex
    scene.environmentIntensity = intensity
  }, [gl, scene, tint, accent, intensity])
  return null
}

/** Iluminación de estudio de tres puntos. */
export function ThreePointLights({ key1 = '#fff3ea', fill = '#ffb8e0', rim = '#b9a4ff', k = 1, shadows = false }: { key1?: string; fill?: string; rim?: string; k?: number; shadows?: boolean }) {
  return (
    <>
      <directionalLight
        position={[1.6, 2.8, 2.4]}
        intensity={2.1 * k}
        color={key1}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={2}
        shadow-camera-bottom={-0.2}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-2.4, 1.6, 1.4]} intensity={0.9 * k} color={fill} />
      <directionalLight position={[-0.6, 2.4, -2.6]} intensity={2.2 * k} color={rim} />
      <directionalLight position={[1.8, 1.2, -2.2]} intensity={1.0 * k} color={rim} />
      <hemisphereLight args={['#fff4fb', '#f0b7d8', 0.35 * k]} />
    </>
  )
}

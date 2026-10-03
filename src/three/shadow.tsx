import { ContactShadows } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

// Sombra bajo la muñeca.
//
// ContactShadows (drei) vuelve a pintar la escena desde abajo a 512 × 512 y la
// desenfoca dos veces en cada fotograma: en calidad media era lo más caro de
// todo el estudio. Fuera de la calidad alta se usa una mancha suave fija, que no
// cuesta nada por fotograma (la muñeca está siempre de pie sobre el mismo punto).

let blobTex: THREE.CanvasTexture | null = null
function blobTexture() {
  if (blobTex) return blobTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  blobTex = new THREE.CanvasTexture(c)
  return blobTex
}

export function DollShadow({ quality, y, color, opacity = 0.55, scale = 2.2 }: { quality: string; y: number; color: string; opacity?: number; scale?: number }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, alphaMap: blobTexture(), transparent: true, opacity: opacity * 0.85, depthWrite: false, toneMapped: false }),
    [color, opacity],
  )
  useEffect(() => () => mat.dispose(), [mat])
  if (quality === 'alta') return <ContactShadows position={[0, y, 0]} opacity={opacity} scale={scale} blur={2.4} far={1.6} resolution={512} color={color} />
  return (
    <mesh position={[0, y + 0.001, 0]} rotation-x={-Math.PI / 2} material={mat} renderOrder={1}>
      <planeGeometry args={[0.62, 0.46]} />
    </mesh>
  )
}

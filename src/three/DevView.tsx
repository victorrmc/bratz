import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DollRig } from './DollRig'
import { DOLL_BY_ID } from '../data/characters'
import { defaultLookFor, toggleItem } from '../game/look'
import { ITEM_BY_ID } from '../data/items'

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.7
    return () => env.dispose()
  }, [gl, scene])
  return null
}

function Doll({ id, pose }: { id: string; pose: string }) {
  const rig = useMemo(() => new DollRig(DOLL_BY_ID[id]), [id])
  useEffect(() => {
    const look = defaultLookFor(id)
    const items = new URLSearchParams(location.search).get('items')
    if (items) {
      look.outfit = {}
      for (const it of items.split(',')) {
        const def = ITEM_BY_ID[it]
        if (def) Object.assign(look, toggleItem(look, def))
      }
    }
    const hair = new URLSearchParams(location.search).get('hair')
    if (hair) look.hair.styleId = hair
    rig.setLook(look)
    rig.setPose(pose)
    rig.blinkEnabled = false
    rig.snapPose()
  }, [rig, id, pose])
  useFrame((s, dt) => rig.update(dt, s.clock.elapsedTime))
  return <primitive object={rig.root} />
}

export default function DevView() {
  const q = new URLSearchParams(location.search)
  const cam = q.get('cam') ?? 'body'
  const id = q.get('doll') ?? 'clara'
  const rot = Number(q.get('rot') ?? 0)
  const pose = q.get('pose') ?? 'idle'
  const camPos: Record<string, [number, number, number, number]> = {
    body: [0, 0.95, 3.0, 0.9],
    face: [0, 1.53, 0.65, 1.52],
    head: [0, 1.5, 1.2, 1.45],
    hands: [0.35, 0.82, 0.55, 0.8],
    feet: [0, 0.2, 0.55, 0.07],
  }
  const c = camPos[cam]
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, background: '#f6dff0' }}
      camera={{ position: [Math.sin(rot) * c[2], c[1], Math.cos(rot) * c[2]], fov: 30 }}
      onCreated={({ camera }) => camera.lookAt(0, c[3], 0)}
      gl={{ preserveDrawingBuffer: true }}
    >
      <Env />
      <directionalLight position={[1.5, 2.5, 2]} intensity={2.2} color="#fff4ec" />
      <directionalLight position={[-2, 1.5, 1]} intensity={0.8} color="#ffc0e6" />
      <directionalLight position={[0, 2, -2.5]} intensity={1.6} color="#c9b6ff" />
      <hemisphereLight args={['#ffffff', '#f2c4e0', 0.4]} />
      <Doll id={id} pose={pose} />
    </Canvas>
  )
}

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { ItemDef, ItemInstance } from '../data/types'
import { buildBottom, buildDress, buildJacket, buildTop, type Built } from './clothes/wear'
import { buildShoes } from './clothes/shoes'
import { buildBag, buildGlasses, buildHairAcc, buildHat, buildJewel } from './clothes/accessories'

// Miniaturas reales de las prendas: se construye la propia pieza 3D (la misma
// que lleva la muñeca), se renderiza en un lienzo pequeño fuera de pantalla y
// se devuelve como imagen. El renderizador se crea bajo demanda y se libera
// cuando deja de usarse, para no tener dos contextos WebGL vivos sin motivo.

export const THUMB_SIZE = 168

interface Ctx {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  env: THREE.Texture
}

let ctx: Ctx | null = null

function ensure(): Ctx {
  if (ctx) return ctx
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(1)
  renderer.setSize(THUMB_SIZE, THUMB_SIZE, false)
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  const pm = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const env = pm.fromScene(room, 0.04).texture
  pm.dispose()
  room.dispose()
  scene.environment = env
  scene.environmentIntensity = 0.75
  // luz de estudio: principal cálida, relleno rosa y contraluz lila
  const key = new THREE.DirectionalLight('#fff3ea', 2.2)
  key.position.set(1.5, 2.5, 3)
  const fill = new THREE.DirectionalLight('#ffc6e6', 0.9)
  fill.position.set(-2.5, 1, 1.5)
  const rim = new THREE.DirectionalLight('#c9b6ff', 1.6)
  rim.position.set(-0.5, 2, -3)
  scene.add(key, fill, rim, new THREE.HemisphereLight('#fff6fb', '#f2bfdc', 0.45))
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  ctx = { renderer, scene, camera, env }
  return ctx
}

/** Libera el contexto WebGL de las miniaturas (se recrea si vuelve a hacer falta). */
export function releaseThumbRenderer() {
  if (!ctx) return
  const c = ctx
  ctx = null
  c.env.dispose()
  c.renderer.dispose()
  c.renderer.forceContextLoss()
}

function build(item: ItemDef, inst: ItemInstance): Built | null {
  switch (item.category) {
    case 'tops':
      return buildTop(item, inst)
    case 'bottoms':
      return buildBottom(item, inst)
    case 'dresses':
      return buildDress(item, inst)
    case 'jackets':
      return buildJacket(item, inst)
    case 'shoes':
      return buildShoes(item, inst)
    case 'bags':
      return buildBag(item, inst)
    case 'jewelry':
      return buildJewel(item, inst)
    case 'glasses':
      return buildGlasses(item, inst)
    case 'hats':
      return buildHat(item, inst)
    case 'hairAcc':
      return buildHairAcc(item, inst, null)
  }
  return null
}

// Orientación de la cámara por plantilla: casi todo de frente en tres cuartos;
// lo que se lleva a la espalda se ve por detrás y el calzado de perfil.
const YAW_BACK = new Set(['backpack', 'wings', 'cape'])
const BAG_FRONT = new Set(['fanny'])
const YAW_SIDE = new Set(['heels', 'platform', 'boots', 'kneeboots', 'sneakers', 'sandals', 'ballet', 'wedge', 'flipflops'])

function viewFor(item: ItemDef): { yaw: number; pitch: number } {
  if (YAW_BACK.has(item.model)) return { yaw: Math.PI + 0.35, pitch: 0.12 }
  if (YAW_SIDE.has(item.model)) return { yaw: 0.95, pitch: 0.32 }
  // los bolsos cuelgan de la mano derecha con la cara hacia fuera (-x)
  if (item.category === 'bags' && !BAG_FRONT.has(item.model)) return { yaw: -1.2, pitch: 0.12 }
  // el pendiente izquierdo (x > 0) se ve de lado, como cuelga de la oreja
  if (item.slot === 'earrings') return { yaw: 1.25, pitch: 0.08 }
  if (item.category === 'glasses') return { yaw: 0.3, pitch: 0.1 }
  if (item.category === 'hats' || item.category === 'hairAcc') return { yaw: 0.4, pitch: 0.3 }
  return { yaw: 0.32, pitch: 0.1 }
}

const box = new THREE.Box3()
const tmp = new THREE.Box3()
const v = new THREE.Vector3()

/**
 * Renderiza la prenda con sus colores y devuelve una imagen (data URL), o
 * null si no se puede (sin WebGL, prenda vacía…).
 */
export function renderThumb(item: ItemDef, inst: ItemInstance): string | null {
  let built: Built | null = null
  const holder = new THREE.Group()
  try {
    built = build(item, inst)
    if (!built || !built.pieces.length) return null
    const c = ensure()
    let pieces = built.pieces
    // pendientes y pulseras van a pares: basta con el del lado izquierdo (x > 0)
    if (item.slot === 'earrings' || item.slot === 'bracelet') {
      const left = pieces.filter((p) => {
        p.mesh.updateMatrixWorld(true)
        return tmp.setFromObject(p.mesh).getCenter(v).x > -0.005
      })
      if (left.length) pieces = left
    }
    // las piezas están en coordenadas de reposo del cuerpo: se cuelgan tal cual
    for (const p of pieces) holder.add(p.mesh)
    const view = viewFor(item)
    holder.rotation.set(view.pitch, -view.yaw, 0, 'YXZ')
    holder.updateMatrixWorld(true)
    // encuadre ajustado a la caja de la pieza ya girada
    const boxes: THREE.Box3[] = []
    holder.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.geometry) return
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      boxes.push(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld))
    })
    box.makeEmpty()
    for (const b of boxes) box.union(b)
    // en los bolsos el asa larga empequeñece el bolso: se encuadra el cuerpo
    // y solo el arranque del asa
    if (item.category === 'bags' && !box.isEmpty()) {
      const H = box.max.y - box.min.y
      const body = boxes.filter((b) => b.max.y - b.min.y < 0.55 * H)
      if (body.length) {
        const top = box.max.y
        box.makeEmpty()
        for (const b of body) box.union(b)
        box.max.y = Math.min(top, box.max.y + 0.45 * (box.max.y - box.min.y))
      }
    }
    if (box.isEmpty()) return null
    box.getCenter(v)
    const size = box.getSize(new THREE.Vector3())
    const half = (Math.max(size.x, size.y) / 2) * 1.1 + 0.002
    const cam = c.camera
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.position.set(v.x, v.y, box.max.z + 5)
    cam.near = 0.1
    cam.far = 5 + size.z + 5
    cam.lookAt(v.x, v.y, v.z)
    cam.updateProjectionMatrix()
    c.scene.add(holder)
    c.renderer.render(c.scene, cam)
    c.scene.remove(holder)
    const url = c.renderer.domElement.toDataURL('image/webp', 0.86)
    return url.startsWith('data:image/') ? url : null
  } catch {
    return null
  } finally {
    holder.removeFromParent()
    for (const p of built?.pieces ?? []) {
      p.mesh.removeFromParent()
      if (p.ownsGeometry && p.mesh instanceof THREE.Mesh) p.mesh.geometry.dispose()
    }
  }
}

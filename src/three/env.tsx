import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
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

// ───────────────────── Ambiente: cielos y partículas ─────────────────────

export interface SkyStops {
  top: string
  mid: string
  bottom: string
}

/** Pseudoaleatorio con semilla: los escenarios salen siempre iguales. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SKY_VERT = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
const SKY_FRAG = `
uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
uniform vec3 dTop; uniform vec3 dMid; uniform vec3 dBottom;
uniform vec3 sunDir; uniform vec3 sunColor;
uniform float dusk; uniform float halo; uniform float clouds; uniform float t;
varying vec3 vP;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  float h = vP.y;
  vec3 a = mix(top, dTop, dusk); vec3 m = mix(mid, dMid, dusk); vec3 b = mix(bottom, dBottom, dusk);
  vec3 c = h > 0.0 ? mix(m, a, smoothstep(0.0, 0.55, h)) : mix(m, b, smoothstep(0.0, 0.25, -h));
  float s = max(dot(normalize(vP), normalize(sunDir)), 0.0);
  c += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 48.0) * 0.5) * halo;
  if (clouds > 0.0) {
    // nubes alargadas que derivan muy despacio, solo cerca del horizonte
    vec2 q = vec2(atan(vP.x, -vP.z) * 3.0 + t * 0.006, h * 18.0);
    float n = vnoise(q * vec2(1.0, 1.0)) * 0.6 + vnoise(q * 2.3 + 7.1) * 0.3 + vnoise(q * 5.1 - 3.7) * 0.1;
    float band = smoothstep(0.02, 0.1, h) * (1.0 - smoothstep(0.2, 0.42, h));
    float k = smoothstep(0.52, 0.78, n) * band * clouds;
    vec3 cc = mix(vec3(1.0, 0.93, 0.95), sunColor, 0.35 + pow(s, 4.0) * 0.5);
    c = mix(c, cc, k * 0.7);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`

/**
 * Cielo degradado de tres tonos con halo de sol y nubes procedurales.
 * Con `sunRef` el halo sigue al sol y, al bajar, el cielo vira a los tonos de `dusk`.
 */
export function AmbientSky({
  top,
  mid,
  bottom,
  dusk,
  sunColor = '#ffcf8a',
  sunDir = [0.3, 0.12, -1],
  sunRef,
  halo = 1,
  clouds = 0,
  radius = 30,
}: SkyStops & {
  dusk?: SkyStops
  sunColor?: string
  sunDir?: [number, number, number]
  sunRef?: React.RefObject<THREE.Object3D | null>
  halo?: number
  clouds?: number
  radius?: number
}) {
  const mat = useMemo(() => {
    const d = dusk ?? { top, mid, bottom }
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(top) },
        mid: { value: new THREE.Color(mid) },
        bottom: { value: new THREE.Color(bottom) },
        dTop: { value: new THREE.Color(d.top) },
        dMid: { value: new THREE.Color(d.mid) },
        dBottom: { value: new THREE.Color(d.bottom) },
        sunDir: { value: new THREE.Vector3(...sunDir) },
        sunColor: { value: new THREE.Color(sunColor) },
        dusk: { value: 0 },
        halo: { value: halo },
        clouds: { value: clouds },
        t: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, mid, bottom, dusk, sunColor, sunDir.join(), halo, clouds])
  useEffect(() => () => mat.dispose(), [mat])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame((s) => {
    mat.uniforms.t.value = s.clock.elapsedTime
    const sun = sunRef?.current
    if (sun) {
      sun.getWorldPosition(v).normalize()
      mat.uniforms.sunDir.value.copy(v)
      // al ponerse el sol el cielo se apaga hacia los tonos del anochecer
      mat.uniforms.dusk.value = 1 - THREE.MathUtils.smoothstep(v.y, -0.07, 0.1)
    }
  })
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  )
}

export type ParticleKind = 'polvo' | 'luciernagas' | 'chispas'
const KIND_ID: Record<ParticleKind, number> = { polvo: 0, luciernagas: 1, chispas: 2 }

const PART_VERT = `
attribute vec4 seed;
uniform float uT; uniform float uSize; uniform float uPx; uniform float uKind; uniform vec3 uArea;
varying float vA;
void main(){
  vec3 p = position;
  float t = uT;
  if (uKind < 0.5) {
    // polvo de luz: sube muy despacio, se mece y titila
    p.y = mod(p.y + uArea.y * 0.5 + t * 0.05 * (0.4 + seed.z), uArea.y) - uArea.y * 0.5;
    p.x += sin(t * 0.25 * (0.5 + seed.x) + seed.y * 6.28) * 0.18;
    p.z += cos(t * 0.21 * (0.5 + seed.w) + seed.x * 6.28) * 0.12;
    float edge = smoothstep(0.5, 0.35, abs(p.y / uArea.y));
    vA = edge * (0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.8 + seed.w * 1.6) + seed.x * 40.0)));
  } else if (uKind < 1.5) {
    // luciérnagas: vagan en curvas suaves y se encienden a ratos
    p += vec3(sin(t * 0.45 * (0.6 + seed.x) + seed.y * 6.28), sin(t * 0.6 * (0.6 + seed.z) + seed.w * 6.28) * 0.5, cos(t * 0.38 * (0.6 + seed.w) + seed.x * 6.28)) * 0.3;
    vA = pow(max(0.0, sin(t * (0.7 + seed.z * 0.9) + seed.y * 30.0)), 2.5);
  } else {
    // chispas: destellos breves y nítidos (sal, purpurina)
    p.x += sin(t * 0.3 + seed.y * 6.28) * 0.05;
    vA = pow(max(0.0, sin(t * (1.6 + seed.z * 2.4) + seed.x * 50.0)), 12.0);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.55 + 0.9 * seed.z) * uPx / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`
const PART_FRAG = `
uniform vec3 uColor; uniform float uOpacity;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.16, 0.0, d);
  gl_FragColor = vec4(uColor * (a * 0.7 + core * 1.3), (a * 0.8 + core) * vA * uOpacity);
  #include <colorspace_fragment>
}`

/**
 * Partículas ambientales animadas en GPU (sin coste de CPU por partícula):
 * polvo de luz, luciérnagas o chispas. En calidad baja se usa la mitad.
 */
export function AmbientParticles({
  kind = 'polvo',
  count = 60,
  area = [4, 2.6, 3],
  center = [0, 1.3, -0.8],
  color = '#fff0d6',
  size = 0.035,
  opacity = 1,
  quality = 'media',
  seed = 7,
}: {
  kind?: ParticleKind
  count?: number
  area?: [number, number, number]
  center?: [number, number, number]
  color?: string
  size?: number
  opacity?: number
  quality?: string
  seed?: number
}) {
  const n = Math.max(4, Math.round(count * (quality === 'baja' ? 0.5 : quality === 'alta' ? 1.25 : 1)))
  const geo = useMemo(() => {
    const rnd = seeded(seed)
    const pos = new Float32Array(n * 3)
    const sd = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      pos.set([(rnd() - 0.5) * area[0], (rnd() - 0.5) * area[1], (rnd() - 0.5) * area[2]], i * 3)
      sd.set([rnd(), rnd(), rnd(), rnd()], i * 4)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('seed', new THREE.BufferAttribute(sd, 4))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(...area))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, area.join(), seed])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uT: { value: 0 },
          uSize: { value: size },
          uPx: { value: 500 },
          uKind: { value: KIND_ID[kind] },
          uArea: { value: new THREE.Vector3(...area) },
          uColor: { value: new THREE.Color(color).multiplyScalar(1.6) },
          uOpacity: { value: opacity },
        },
        vertexShader: PART_VERT,
        fragmentShader: PART_FRAG,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, area.join(), color, size, opacity],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const db = useMemo(() => new THREE.Vector2(), [])
  useFrame((s) => {
    mat.uniforms.uT.value = s.clock.elapsedTime
    const cam = s.camera as THREE.PerspectiveCamera
    s.gl.getDrawingBufferSize(db)
    mat.uniforms.uPx.value = db.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 30) / 2))
  })
  return <points geometry={geo} material={mat} position={center} renderOrder={5} />
}
